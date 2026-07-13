import type { ParsedNode, ProtocolParser } from '@siiway/subhub-plugin-sdk';
import { decodeBase64 } from '@siiway/subhub-plugin-sdk';

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;
}

/** VMess：`vmess://<base64(json)>` 格式。 */
export const vmessParser: ProtocolParser = {
  id: 'vmess',
  label: 'VMess',
  schemes: ['vmess://'],
  parse(link: string): ParsedNode | null {
    try {
      const json = JSON.parse(decodeBase64(link.slice('vmess://'.length))) as Record<
        string,
        unknown
      >;
      const server = str(json.add);
      const port = Number.parseInt(str(json.port), 10);
      if (!server || !Number.isFinite(port)) return null;

      const network = str(json.net, 'tcp');
      const tls = str(json.tls) === 'tls';
      const node: ParsedNode = {
        protocol: 'vmess',
        name: str(json.ps) || str(json.remarks) || server,
        server,
        port,
        uuid: str(json.id),
        alterId: Number.parseInt(str(json.aid, '0'), 10) || 0,
        cipher: str(json.scy) || 'auto',
        network,
        tls,
      };
      if (network === 'ws' || network === 'h2' || network === 'httpupgrade') {
        const host = str(json.host);
        if (host) node.wsHost = host;
        node.wsPath = str(json.path, '/');
      }
      if (network === 'grpc') {
        const svc = str(json.path);
        if (svc) node.grpcServiceName = svc;
      }
      const sni = str(json.sni) || str(json.host);
      if (tls && sni) node.sni = sni;
      return node;
    } catch {
      return null;
    }
  },
};
