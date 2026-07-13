import type { ParsedNode, ProtocolParser } from '@siiway/subhub-plugin-sdk';
import { collectParams, labelFromHash, toParsableUrl } from '@siiway/subhub-plugin-sdk';

/** AnyTLS：`anytls://password@host:port?params#name`。 */
export const anytlsParser: ProtocolParser = {
  id: 'anytls',
  label: 'AnyTLS',
  schemes: ['anytls://'],
  parse(link: string): ParsedNode | null {
    try {
      const url = toParsableUrl(link, 'anytls');
      const server = url.hostname;
      const port = Number.parseInt(url.port || '443', 10);
      if (!server || !Number.isFinite(port)) return null;

      const params = url.searchParams;
      const node: ParsedNode = {
        protocol: 'anytls',
        name: labelFromHash(url, server),
        server,
        port,
        tls: true,
        extra: collectParams(url),
      };
      if (url.username) node.password = decodeURIComponent(url.username);
      const sni = params.get('sni');
      if (sni) node.sni = sni;
      const fp = params.get('fp');
      if (fp) node.fingerprint = fp;
      node.skipCertVerify = params.get('insecure') === '1';
      return node;
    } catch {
      return null;
    }
  },
};
