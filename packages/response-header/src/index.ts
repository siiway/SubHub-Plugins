/**
 * 示例中间件插件（方案3）：为响应统一附加标识头，演示通用请求生命周期机制。
 */

import type { Plugin } from '@siiway/subhub-plugin-sdk';

export const responseHeaderPlugin: Plugin = {
  name: 'response-header',
  version: '1.0.0',
  onResponse(_ctx, response): Response {
    const headers = new Headers(response.headers);
    if (!headers.has('X-Powered-By')) headers.set('X-Powered-By', 'SubHub-Plugins');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
