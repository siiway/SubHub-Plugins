import type { FormatResult, ParsedEntry, ParsedNode, SubscriptionFormatter } from '@siiway/subhub-plugin-sdk';
import { toYaml, type YamlValue } from './yaml';

type ClashProxy = Record<string, YamlValue>;

/** 为 ws / grpc 传输补充 Clash 的 *-opts 字段。 */
function applyTransport(proxy: ClashProxy, node: ParsedNode): void {
  if (node.network && node.network !== 'tcp') proxy.network = node.network;
  if (node.network === 'ws') {
    const wsOpts: ClashProxy = { path: node.wsPath ?? '/' };
    if (node.wsHost) wsOpts.headers = { Host: node.wsHost };
    proxy['ws-opts'] = wsOpts;
  }
  if (node.network === 'grpc' && node.grpcServiceName) {
    proxy['grpc-opts'] = { 'grpc-service-name': node.grpcServiceName };
  }
}

/** 补充 TLS / REALITY 通用字段。 */
function applyTls(proxy: ClashProxy, node: ParsedNode): void {
  if (node.tls) proxy.tls = true;
  if (node.sni) proxy.servername = node.sni;
  if (node.fingerprint) proxy['client-fingerprint'] = node.fingerprint;
  if (node.alpn) proxy.alpn = node.alpn;
  if (node.skipCertVerify) proxy['skip-cert-verify'] = true;
  if (node.realityPublicKey) {
    const reality: ClashProxy = { 'public-key': node.realityPublicKey };
    if (node.realityShortId) reality['short-id'] = node.realityShortId;
    proxy['reality-opts'] = reality;
  }
}

function buildVmess(node: ParsedNode, base: ClashProxy): ClashProxy {
  const proxy: ClashProxy = {
    ...base,
    uuid: node.uuid ?? '',
    alterId: node.alterId ?? 0,
    cipher: node.cipher ?? 'auto',
  };
  applyTransport(proxy, node);
  applyTls(proxy, node);
  return proxy;
}

function buildVless(node: ParsedNode, base: ClashProxy): ClashProxy {
  const proxy: ClashProxy = { ...base, uuid: node.uuid ?? '' };
  if (node.flow) proxy.flow = node.flow;
  applyTransport(proxy, node);
  applyTls(proxy, node);
  return proxy;
}

function buildTrojan(node: ParsedNode, base: ClashProxy): ClashProxy {
  const proxy: ClashProxy = { ...base, password: node.password ?? '' };
  applyTransport(proxy, node);
  applyTls(proxy, node);
  return proxy;
}

function buildShadowsocks(node: ParsedNode, base: ClashProxy): ClashProxy {
  return { ...base, cipher: node.cipher ?? '', password: node.password ?? '' };
}

function buildHysteria2(node: ParsedNode, base: ClashProxy): ClashProxy {
  const proxy: ClashProxy = { ...base, password: node.password ?? '' };
  if (node.sni) proxy.sni = node.sni;
  if (node.obfs) proxy.obfs = node.obfs;
  if (node.obfsPassword) proxy['obfs-password'] = node.obfsPassword;
  if (node.skipCertVerify) proxy['skip-cert-verify'] = true;
  return proxy;
}

function buildHysteria(node: ParsedNode, base: ClashProxy): ClashProxy {
  const proxy: ClashProxy = { ...base };
  if (node.password) proxy['auth-str'] = node.password;
  if (node.sni) proxy.sni = node.sni;
  if (node.alpn) proxy.alpn = node.alpn;
  if (node.upMbps !== undefined) proxy.up = node.upMbps;
  if (node.downMbps !== undefined) proxy.down = node.downMbps;
  if (node.obfs) proxy.obfs = node.obfs;
  if (node.skipCertVerify) proxy['skip-cert-verify'] = true;
  return proxy;
}

function buildTuic(node: ParsedNode, base: ClashProxy): ClashProxy {
  const proxy: ClashProxy = { ...base };
  if (node.uuid) proxy.uuid = node.uuid;
  if (node.password) proxy.password = node.password;
  if (node.sni) proxy.sni = node.sni;
  if (node.alpn) proxy.alpn = node.alpn;
  if (node.congestionControl) proxy['congestion-controller'] = node.congestionControl;
  if (node.udpRelayMode) proxy['udp-relay-mode'] = node.udpRelayMode;
  if (node.reduceRtt) proxy['reduce-rtt'] = true;
  if (node.disableSni) proxy['disable-sni'] = true;
  if (node.skipCertVerify) proxy['skip-cert-verify'] = true;
  return proxy;
}

type ClashBuilder = (node: ParsedNode, base: ClashProxy) => ClashProxy;

const BUILDERS: Partial<Record<string, ClashBuilder>> = {
  vmess: buildVmess,
  vless: buildVless,
  trojan: buildTrojan,
  ss: buildShadowsocks,
  hysteria2: buildHysteria2,
  hysteria: buildHysteria,
  anytls: buildAnytls,
  tuic: buildTuic,
};

function buildAnytls(node: ParsedNode, base: ClashProxy): ClashProxy {
  const proxy: ClashProxy = { ...base, password: node.password ?? '' };
  if (node.sni) proxy.sni = node.sni;
  if (node.fingerprint) proxy['client-fingerprint'] = node.fingerprint;
  if (node.skipCertVerify) proxy['skip-cert-verify'] = true;
  return proxy;
}

/** Clash 要求节点名唯一，重名追加序号。 */
function uniqueName(name: string, used: Set<string>): string {
  let candidate = name || 'proxy';
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${name} ${String(counter)}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

function toClashProxy(node: ParsedNode, used: Set<string>): ClashProxy | null {
  const builder = BUILDERS[node.protocol];
  if (!builder) return null;
  const base: ClashProxy = {
    name: uniqueName(node.name, used),
    type: node.protocol,
    server: node.server,
    port: node.port,
  };
  return builder(node, base);
}

/**
 * Clash / Mihomo YAML 订阅格式。
 * 把解析成功的节点映射为 Clash proxies，并生成基础的 proxy-groups 与 rules。
 */
export const clashFormatter: SubscriptionFormatter = {
  id: 'clash',
  label: 'Clash / Mihomo',
  aliases: ['mihomo', 'clash-meta'],
  format(entries: ParsedEntry[], ctx): FormatResult {
    const used = new Set<string>();
    const proxies: ClashProxy[] = [];
    for (const entry of entries) {
      if (!entry.node) continue;
      const proxy = toClashProxy(entry.node, used);
      if (proxy) proxies.push(proxy);
    }
    const names = proxies.map((proxy) => proxy.name as string);
    const config: Record<string, YamlValue> = {
      'mixed-port': 7890,
      'allow-lan': false,
      mode: 'rule',
      'log-level': 'info',
      proxies,
      'proxy-groups': [
        {
          name: ctx.title || 'PROXY',
          type: 'select',
          proxies: names.length > 0 ? names : ['DIRECT'],
        },
      ],
      rules: ['MATCH,' + (ctx.title || 'PROXY')],
    };
    return { body: toYaml(config), contentType: 'text/yaml; charset=utf-8' };
  },
};
