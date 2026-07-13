import type { ParsedNode, ProtocolParser } from '@siiway/subhub-plugin-sdk';
import { decodeBase64 } from '@siiway/subhub-plugin-sdk';

/** Shadowsocks：`ss://` 支持 base64 整体编码与 `method:pass@host:port` 明文两种。 */
export const shadowsocksParser: ProtocolParser = {
  id: 'ss',
  label: 'Shadowsocks',
  schemes: ['ss://'],
  parse(link: string): ParsedNode | null {
    try {
      const raw = link.slice('ss://'.length);
      const hashIdx = raw.indexOf('#');
      const name = hashIdx >= 0 ? decodeURIComponent(raw.slice(hashIdx + 1)) : '';
      const withoutFrag = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;

      let userInfo: string;
      let hostPort: string;
      if (withoutFrag.includes('@')) {
        const atIdx = withoutFrag.lastIndexOf('@');
        const maybeB64 = withoutFrag.slice(0, atIdx);
        try {
          userInfo = decodeBase64(maybeB64);
        } catch {
          userInfo = maybeB64;
        }
        hostPort = withoutFrag.slice(atIdx + 1);
      } else {
        const decoded = decodeBase64(withoutFrag);
        const atIdx = decoded.lastIndexOf('@');
        if (atIdx < 0) return null;
        userInfo = decoded.slice(0, atIdx);
        hostPort = decoded.slice(atIdx + 1);
      }

      const methodSep = userInfo.indexOf(':');
      if (methodSep < 0) return null;
      const cipher = userInfo.slice(0, methodSep);
      const password = userInfo.slice(methodSep + 1);

      const cleanHostPort = hostPort.split('/')[0].split('?')[0];
      const lastColon = cleanHostPort.lastIndexOf(':');
      if (lastColon < 0) return null;
      const server = cleanHostPort.slice(0, lastColon).replace(/^\[/, '').replace(/\]$/, '');
      const port = Number.parseInt(cleanHostPort.slice(lastColon + 1), 10);
      if (!server || !Number.isFinite(port)) return null;

      return {
        protocol: 'ss',
        name: name || `${server}:${String(port)}`,
        server,
        port,
        cipher,
        password,
      };
    } catch {
      return null;
    }
  },
};
