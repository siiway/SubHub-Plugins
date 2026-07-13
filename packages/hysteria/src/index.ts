import type { ParsedNode, ProtocolParser } from '@siiway/subhub-plugin-sdk';
import { collectParams, labelFromHash, parseAlpn, toParsableUrl } from '@siiway/subhub-plugin-sdk';

function parseSpeed(value: string | null): number | undefined {
  if (!value) return undefined;
  const num = Number.parseInt(value.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(num) ? num : undefined;
}

/** Hysteria v1：`hysteria://host:port?params#name`。 */
export const hysteriaParser: ProtocolParser = {
  id: 'hysteria',
  label: 'Hysteria',
  schemes: ['hysteria://'],
  parse(link: string): ParsedNode | null {
    try {
      const url = toParsableUrl(link, 'hysteria');
      const server = url.hostname;
      const port = Number.parseInt(url.port || '443', 10);
      if (!server || !Number.isFinite(port)) return null;

      const params = url.searchParams;
      const node: ParsedNode = {
        protocol: 'hysteria',
        name: labelFromHash(url, server),
        server,
        port,
        tls: true,
        extra: collectParams(url),
      };
      const auth = params.get('auth') ?? params.get('auth_str');
      if (auth) node.password = auth;
      const sni = params.get('peer') ?? params.get('sni');
      if (sni) node.sni = sni;
      const obfs = params.get('obfs');
      if (obfs) node.obfs = obfs;
      const alpn = parseAlpn(params.get('alpn'));
      if (alpn) node.alpn = alpn;
      const up = parseSpeed(params.get('upmbps') ?? params.get('up'));
      if (up !== undefined) node.upMbps = up;
      const down = parseSpeed(params.get('downmbps') ?? params.get('down'));
      if (down !== undefined) node.downMbps = down;
      node.skipCertVerify = params.get('insecure') === '1';
      return node;
    } catch {
      return null;
    }
  },
};
