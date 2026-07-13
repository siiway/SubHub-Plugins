/** 协议解析插件共用的工具函数。 */

/** 宽松 Base64 解码：兼容 URL-safe 与缺失 padding。 */
export function decodeBase64(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  // 处理 UTF-8
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return decodeURIComponent(escape(binary));
  } catch {
    return binary;
  }
}

/** 把 `xxx://` 链接改写成可被 URL 解析的 https 链接。 */
export function toParsableUrl(link: string, scheme: string): URL {
  return new URL(link.replace(new RegExp(`^${scheme}://`, 'i'), 'https://'));
}

/** 从 URL hash 取展示名，回退到给定默认值。 */
export function labelFromHash(url: URL, fallback: string): string {
  return url.hash ? decodeURIComponent(url.hash.slice(1)) : fallback;
}

/** 把逗号分隔的 alpn 字符串拆成数组。 */
export function parseAlpn(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const list = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}

/** 收集 URL 查询参数为普通对象，作为 extra 备用。 */
export function collectParams(url: URL): Record<string, string> {
  const extra: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    extra[key] = value;
  }
  return extra;
}
