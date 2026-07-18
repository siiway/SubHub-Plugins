import type { ParsedNode, ProtocolParser } from '@siiway/subhub-plugin-sdk';
import { collectParams, labelFromHash, parseAlpn, toParsableUrl } from '@siiway/subhub-plugin-sdk';

/** 判断值是否表示布尔真（兼容 1 / true）。 */
function isTruthy(value: string | null): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

/** TUIC (v5)：`tuic://uuid:password@host:port?params#name`。 */
export const tuicParser: ProtocolParser = {
  id: 'tuic',
  label: 'TUIC',
  schemes: ['tuic://'],
  parse(link: string): ParsedNode | null {
    try {
      const url = toParsableUrl(link, 'tuic');
      const server = url.hostname;
      const port = Number.parseInt(url.port || '443', 10);
      if (!server || !Number.isFinite(port)) return null;

      const params = url.searchParams;
      const node: ParsedNode = {
        protocol: 'tuic',
        name: labelFromHash(url, server),
        server,
        port,
        tls: true,
        extra: collectParams(url),
      };

      // 凭据：userinfo 为 uuid:password
      if (url.username) node.uuid = decodeURIComponent(url.username);
      if (url.password) node.password = decodeURIComponent(url.password);

      const sni = params.get('sni');
      if (sni) node.sni = sni;
      const alpn = parseAlpn(params.get('alpn'));
      if (alpn) node.alpn = alpn;
      const fp = params.get('fp') ?? params.get('fingerprint');
      if (fp) node.fingerprint = fp;

      const cc = params.get('congestion_control') ?? params.get('congestion_controller');
      if (cc) node.congestionControl = cc;
      const udpRelayMode = params.get('udp_relay_mode') ?? params.get('udp-relay-mode');
      if (udpRelayMode) node.udpRelayMode = udpRelayMode;

      if (params.has('reduce_rtt') || params.has('reduce-rtt')) {
        node.reduceRtt = isTruthy(params.get('reduce_rtt') ?? params.get('reduce-rtt'));
      }
      if (params.has('disable_sni')) node.disableSni = isTruthy(params.get('disable_sni'));
      node.skipCertVerify = isTruthy(params.get('allow_insecure') ?? params.get('insecure'));
      return node;
    } catch {
      return null;
    }
  },
};
