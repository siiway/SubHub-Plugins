import type { ParsedNode, ProtocolParser } from '@siiway/subhub-plugin-sdk';
import { collectParams, labelFromHash, parseAlpn, toParsableUrl } from '@siiway/subhub-plugin-sdk';

/** VLESS：`vless://uuid@host:port?params#name` 格式。 */
export const vlessParser: ProtocolParser = {
  id: 'vless',
  label: 'VLESS',
  schemes: ['vless://'],
  parse(link: string): ParsedNode | null {
    try {
      const url = toParsableUrl(link, 'vless');
      const server = url.hostname;
      const port = Number.parseInt(url.port || '443', 10);
      if (!server || !Number.isFinite(port)) return null;

      const params = url.searchParams;
      const network = params.get('type') ?? 'tcp';
      const security = params.get('security') ?? '';
      const node: ParsedNode = {
        protocol: 'vless',
        name: labelFromHash(url, server),
        server,
        port,
        network,
        extra: collectParams(url),
      };
      if (url.username) node.uuid = decodeURIComponent(url.username);
      const flow = params.get('flow');
      if (flow) node.flow = flow;

      if (network === 'ws' || network === 'httpupgrade' || network === 'splithttp') {
        const host = params.get('host');
        if (host) node.wsHost = host;
        node.wsPath = params.get('path') ?? '/';
      }
      if (network === 'grpc') {
        const svc = params.get('serviceName');
        if (svc) node.grpcServiceName = svc;
      }

      if (security === 'tls' || security === 'reality') {
        node.tls = true;
        const sni = params.get('sni');
        if (sni) node.sni = sni;
        const fp = params.get('fp');
        if (fp) node.fingerprint = fp;
        const alpn = parseAlpn(params.get('alpn'));
        if (alpn) node.alpn = alpn;
        if (security === 'reality') {
          const pbk = params.get('pbk');
          if (pbk) node.realityPublicKey = pbk;
          const sid = params.get('sid');
          if (sid) node.realityShortId = sid;
        }
      }
      return node;
    } catch {
      return null;
    }
  },
};
