/**
 * SubCheck 中间件插件（方案3）。
 *
 * 拦截 `POST /api/proxies/check`，把目标代理链接转发给外部 SubCheck 探测服务做真实
 * 可用性检测，并将结果写回代理健康状态。
 *
 * 本包只依赖 `@siiway/subhub-plugin-sdk`，不直接引用宿主内部实现。会话鉴权、分组权限
 * 校验、代理读写等宿主能力由宿主在请求进入时注入到 {@link PluginContext.state}
 * （键为 {@link SUBCHECK_HOST_STATE_KEY}），插件通过 {@link SubCheckHost} 契约调用。
 */

import type { Plugin, PluginContext } from '@siiway/subhub-plugin-sdk';

/** 插件读取的环境变量子集（宿主 Env 的超集里的一部分）。 */
export interface SubCheckEnv {
  /** SubCheck 探测服务基础地址；未设置则插件不生效。 */
  SUBCHECK_URL?: string;
  /** 可选的 Bearer 令牌，用于访问受保护的 SubCheck 服务。 */
  SUBCHECK_TOKEN?: string;
}

/** 探测所需的代理最小信息。 */
export interface SubCheckProxy {
  id: string;
  group_id: string;
  /** 原始代理链接，转发给 SubCheck 服务。 */
  link: string;
}

/**
 * 宿主注入给 subcheck 的能力契约。
 * 宿主负责用自身的会话/权限/数据库实现来提供这些方法。
 */
export interface SubCheckHost {
  /** 校验会话并返回 userId；未认证返回 null。 */
  requireAuth(request: Request): Promise<string | null>;
  /** 按 id 读取代理；不存在返回 null。 */
  getProxy(id: string): Promise<SubCheckProxy | null>;
  /** 校验用户对某分组是否有访问权限。 */
  checkGroupAccess(groupId: string, userId: string, request: Request): Promise<boolean>;
  /** 写回探测结果（存活标志与错误信息）。 */
  updateProxyHealth(id: string, isAlive: boolean, error: string): Promise<void>;
}

/** 宿主注入 {@link SubCheckHost} 时使用的 {@link PluginContext.state} 键。 */
export const SUBCHECK_HOST_STATE_KEY = 'subcheck.host';

/** SubCheck 服务 `/check` 接口的响应结构。 */
interface SubCheckServiceResponse {
  results?: Array<{ alive: boolean; error?: string; delay_ms?: number | null }>;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const subCheckPlugin: Plugin = {
  name: 'subcheck',
  version: '0.1.0',

  async onRequest(ctx: PluginContext): Promise<Response | undefined> {
    if (ctx.url.pathname !== '/api/proxies/check' || ctx.request.method !== 'POST') {
      return undefined;
    }

    const env = ctx.env as SubCheckEnv;
    // 未配置探测服务地址：功能关闭，交还给宿主的其它处理。
    if (!env.SUBCHECK_URL) {
      return undefined;
    }

    const host = ctx.state.get(SUBCHECK_HOST_STATE_KEY) as SubCheckHost | undefined;
    if (!host) {
      return jsonResponse(
        { error: 'SubCheck 宿主能力未注入（缺少 SUBCHECK_HOST_STATE_KEY）' },
        500,
      );
    }

    const userId = await host.requireAuth(ctx.request);
    if (!userId) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
    }

    let body: { id?: string };
    try {
      body = (await ctx.request.clone().json()) as { id?: string };
    } catch {
      return jsonResponse({ error: 'invalid JSON body' }, 400);
    }
    if (!body.id) {
      return jsonResponse({ error: 'id required' }, 400);
    }
    const proxyId = body.id;

    const proxy = await host.getProxy(proxyId);
    if (!proxy) {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    const access = await host.checkGroupAccess(proxy.group_id, userId, ctx.request);
    if (!access) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    try {
      const subCheckUrl = env.SUBCHECK_URL.replace(/\/+$/, '') + '/check';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (env.SUBCHECK_TOKEN) {
        headers['Authorization'] = 'Bearer ' + env.SUBCHECK_TOKEN;
      }

      const subRes = await fetch(subCheckUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ links: [proxy.link] }),
      });

      if (!subRes.ok) {
        const errText = await subRes.text();
        return jsonResponse(
          {
            id: proxyId,
            is_alive: false,
            last_check: new Date().toISOString(),
            error: 'SubCheck 请求失败 (' + subRes.status + '): ' + errText,
          },
          502,
        );
      }

      const checkResult = (await subRes.json()) as SubCheckServiceResponse;
      const result = checkResult.results?.[0];

      const isAlive = result?.alive === true;
      const errorMessage = result?.error ?? '';

      await host.updateProxyHealth(proxyId, isAlive, errorMessage);

      return jsonResponse({
        id: proxyId,
        is_alive: isAlive,
        last_check: new Date().toISOString(),
        error: errorMessage,
        delay_ms: result?.delay_ms ?? null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse({ error: 'SubCheck 调用失败: ' + msg }, 502);
    }
  },
};
