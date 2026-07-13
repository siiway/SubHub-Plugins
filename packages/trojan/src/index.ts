import type { ParsedNode, ProtocolParser } from '@siiway/subhub-plugin-sdk';
import { collectParams, labelFromHash, parseAlpn, toParsableUrl } from '@siiway/subhub-plugin-sdk';

/** Trojan：`trojan://password@host:port?params#name` 格式。 */
export const trojanParser: ProtocolParser = {
  id: 'trojan',
  label: 'Trojan',
  schemes: ['trojan://'],
  parse(link: string): ParsedNode | null {
    try {
      const url = toParsableUrl(link, 'trojan');
      const server = url.hostname;
      const port = Number.parseInt(url.port || '443', 10);
      if (!server || !Number.isFinite(port)) return null;

      const params = url.searchParams;
      const network = params.get('type') ?? 'tcp';
      const security = params.get('security') ?? 'tls';
      const node: ParsedNode = {
        protocol: 'trojan',
        name: labelFromHash(url, server),
        server,
        port,
        network,
        tls: security !== 'none',
        extra: collectParams(url),
      };
      if (url.username) node.password = decodeURIComponent(url.username);

      if (network === 'ws' || network === 'httpupgrade') {
        const host = params.get('host');
        if (host) node.wsHost = host;
        node.wsPath = params.get('path') ?? '/';
      }
      if (network === 'grpc') {
        const svc = params.get('serviceName');
        if (svc) node.grpcServiceName = svc;
      }
      const sni = params.get('sni') ?? params.get('peer');
      if (sni) node.sni = sni;
      const fp = params.get('fp');
      if (fp) node.fingerprint = fp;
      const alpn = parseAlpn(params.get('alpn'));
      if (alpn) node.alpn = alpn;
      return node;
    } catch {
      return null;
    }
  },
};
