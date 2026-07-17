import type { Plugin, PluginContext } from '@siiway/subhub-plugin-sdk';
import { getProxy, updateProxyHealth } from '../../SubHub/src/db/schema';
import { requireAuth, checkGroupAccess } from '../../SubHub/src/lib/auth';
import { jsonResponse } from '../../SubHub/src/lib/http';

export const subCheckPlugin: Plugin = {
  name: 'subcheck',
  version: '0.1.0',

  async onRequest(ctx: PluginContext): Promise<Response | undefined> {
    const env = ctx.env as Env;
    const url = ctx.url;

    if (url.pathname !== '/api/proxies/check' || ctx.request.method !== 'POST') {
      return undefined;
    }

    if (!env.SUBCHECK_URL) {
      return undefined;
    }

    const userId = await requireAuth(env, ctx.request);
    if (!userId) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
    }

    const cloned = ctx.request.clone();
    let body: { id: string };
    try {
      body = await cloned.json() as { id: string };
    } catch {
      return jsonResponse({ error: 'invalid JSON body' }, 400);
    }
    if (!body.id) {
      return jsonResponse({ error: 'id required' }, 400);
    }

    const proxy = await getProxy(env.DB, body.id);
    if (!proxy) {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    const access = await checkGroupAccess(env, proxy.group_id, userId, ctx.request);
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
        return jsonResponse({
          id: body.id,
          is_alive: false,
          last_check: new Date().toISOString(),
          error: 'SubCheck 请求失败 (' + subRes.status + '): ' + errText,
        }, 502);
      }

      const checkResult = await subRes.json() as {
        results?: Array<{ alive: boolean; error?: string; delay_ms?: number | null }>;
      };
      const result = checkResult.results?.[0];

      const isAlive = result?.alive === true;
      const errorMessage = result?.error || '';

      await updateProxyHealth(env.DB, body.id, isAlive, errorMessage);

      return jsonResponse({
        id: body.id,
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
