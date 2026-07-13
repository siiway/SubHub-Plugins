import type { ParsedNode, ProtocolParser } from '@siiway/subhub-plugin-sdk';
import { collectParams, labelFromHash, toParsableUrl } from '@siiway/subhub-plugin-sdk';

/** Hysteria2：`hysteria2://` 与别名 `hy2://`。 */
export const hysteria2Parser: ProtocolParser = {
  id: 'hysteria2',
  label: 'Hysteria2',
  schemes: ['hysteria2://', 'hy2://'],
  parse(link: string): ParsedNode | null {
    try {
      const scheme = link.toLowerCase().startsWith('hy2://') ? 'hy2' : 'hysteria2';
      const url = toParsableUrl(link, scheme);
      const server = url.hostname;
      const port = Number.parseInt(url.port || '443', 10);
      if (!server || !Number.isFinite(port)) return null;

      const params = url.searchParams;
      const node: ParsedNode = {
        protocol: 'hysteria2',
        name: labelFromHash(url, server),
        server,
        port,
        tls: true,
        extra: collectParams(url),
      };
      if (url.username) node.password = decodeURIComponent(url.username);
      const sni = params.get('sni');
      if (sni) node.sni = sni;
      const obfs = params.get('obfs');
      if (obfs) node.obfs = obfs;
      const obfsPassword = params.get('obfs-password');
      if (obfsPassword) node.obfsPassword = obfsPassword;
      node.skipCertVerify = params.get('insecure') === '1';
      return node;
    } catch {
      return null;
    }
  },
};
