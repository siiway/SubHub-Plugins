import type { FormatResult, ParsedEntry, SubscriptionFormatter } from '@siiway/subhub-plugin-sdk';

/** UTF-8 安全的 Base64 编码。 */
function utf8ToBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * 通用 Base64 订阅格式（v2rayN / Shadowrocket 等）。
 * 保持原有行为：把原始链接换行拼接后整体 Base64 编码。
 */
export const base64Formatter: SubscriptionFormatter = {
  id: 'base64',
  label: '通用 Base64',
  aliases: ['v2ray', 'default'],
  format(entries: ParsedEntry[]): FormatResult {
    const links = entries.map((entry) => entry.raw).join('\n');
    return {
      body: utf8ToBase64(links),
      contentType: 'text/plain; charset=utf-8',
    };
  },
};
