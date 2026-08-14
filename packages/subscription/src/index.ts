import type {
  ParsedEntry,
  ParsedNode,
  Plugin,
  SubscriptionParser,
} from '@siiway/subhub-plugin-sdk';
import { decodeBase64 } from '@siiway/subhub-plugin-sdk';
import { parseYaml, getProxies, type YamlValue } from './yaml';

// ─── Clash YAML → ParsedNode ─────────────────────────────────────────

function str(v: YamlValue, fallback = ''): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback;
}

function num(v: YamlValue, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function bool(v: YamlValue): boolean | undefined {
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  return undefined;
}

function arr(v: YamlValue): string[] | undefined {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return undefined;
}

function obj(v: YamlValue): Record<string, YamlValue> | undefined {
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) return v;
  return undefined;
}

function applyTls(node: ParsedNode, proxy: Record<string, YamlValue>): void {
  if (bool(proxy['tls'])) node.tls = true;
  const sni = str(proxy['servername']);
  if (sni) node.sni = sni;
  const fp = str(proxy['client-fingerprint']);
  if (fp) node.fingerprint = fp;
  const alpn = arr(proxy['alpn']);
  if (alpn) node.alpn = alpn;
  if (bool(proxy['skip-cert-verify'])) node.skipCertVerify = true;
}

function applyReality(node: ParsedNode, proxy: Record<string, YamlValue>): void {
  const reality = obj(proxy['reality-opts']);
  if (reality) {
    const pk = str(reality['public-key']);
    if (pk) node.realityPublicKey = pk;
    const sid = str(reality['short-id']);
    if (sid) node.realityShortId = sid;
  }
}

function applyWsOpts(node: ParsedNode, proxy: Record<string, YamlValue>): void {
  if (str(proxy['network']) === 'ws' || str(proxy['network']) === 'h2' || str(proxy['network']) === 'httpupgrade') {
    const ws = obj(proxy['ws-opts']);
    if (ws) {
      node.wsPath = str(ws['path'], '/');
      const headers = obj(ws['headers']);
      if (headers) node.wsHost = str(headers['Host']);
    } else {
      node.wsPath = '/';
    }
  }
}

function applyGrpcOpts(node: ParsedNode, proxy: Record<string, YamlValue>): void {
  if (str(proxy['network']) === 'grpc') {
    const grpc = obj(proxy['grpc-opts']);
    if (grpc) {
      node.grpcServiceName = str(grpc['grpc-service-name']);
    }
  }
}

function fromClashVmess(proxy: Record<string, YamlValue>): ParsedNode {
  const node: ParsedNode = {
    protocol: 'vmess',
    name: str(proxy['name']),
    server: str(proxy['server']),
    port: num(proxy['port']),
    uuid: str(proxy['uuid']),
    alterId: num(proxy['alterId'], 0),
    cipher: str(proxy['cipher'], 'auto'),
    network: str(proxy['network'], 'tcp'),
  };
  applyTls(node, proxy);
  applyWsOpts(node, proxy);
  applyGrpcOpts(node, proxy);
  return node;
}

function fromClashVless(proxy: Record<string, YamlValue>): ParsedNode {
  const f = str(proxy['flow']);
  const node: ParsedNode = {
    protocol: 'vless',
    name: str(proxy['name']),
    server: str(proxy['server']),
    port: num(proxy['port']),
    uuid: str(proxy['uuid']),
    network: str(proxy['network'], 'tcp'),
    ...(f ? { flow: f } : {}),
  };
  applyTls(node, proxy);
  applyReality(node, proxy);
  applyWsOpts(node, proxy);
  applyGrpcOpts(node, proxy);
  return node;
}

function fromClashTrojan(proxy: Record<string, YamlValue>): ParsedNode {
  const node: ParsedNode = {
    protocol: 'trojan',
    name: str(proxy['name']),
    server: str(proxy['server']),
    port: num(proxy['port']),
    password: str(proxy['password']),
  };
  applyTls(node, proxy);
  applyWsOpts(node, proxy);
  applyGrpcOpts(node, proxy);
  return node;
}

function fromClashSs(proxy: Record<string, YamlValue>): ParsedNode {
  return {
    protocol: 'ss',
    name: str(proxy['name']),
    server: str(proxy['server']),
    port: num(proxy['port']),
    cipher: str(proxy['cipher']),
    password: str(proxy['password']),
  };
}

function fromClashHysteria2(proxy: Record<string, YamlValue>): ParsedNode {
  const node: ParsedNode = {
    protocol: 'hysteria2',
    name: str(proxy['name']),
    server: str(proxy['server']),
    port: num(proxy['port']),
    password: str(proxy['password']),
  };
  const sni = str(proxy['sni']);
  if (sni) node.sni = sni;
  const obfs = str(proxy['obfs']);
  if (obfs) node.obfs = obfs;
  const obfsPw = str(proxy['obfs-password']);
  if (obfsPw) node.obfsPassword = obfsPw;
  if (bool(proxy['skip-cert-verify'])) node.skipCertVerify = true;
  return node;
}

function fromClashHysteria(proxy: Record<string, YamlValue>): ParsedNode {
  const pw = str(proxy['auth-str']);
  const node: ParsedNode = {
    protocol: 'hysteria',
    name: str(proxy['name']),
    server: str(proxy['server']),
    port: num(proxy['port']),
    ...(pw ? { password: pw } : {}),
  };
  const sni = str(proxy['sni']);
  if (sni) node.sni = sni;
  const alpn = arr(proxy['alpn']);
  if (alpn) node.alpn = alpn;
  const up = num(proxy['up']);
  if (up > 0) node.upMbps = up;
  const down = num(proxy['down']);
  if (down > 0) node.downMbps = down;
  const obfs = str(proxy['obfs']);
  if (obfs) node.obfs = obfs;
  if (bool(proxy['skip-cert-verify'])) node.skipCertVerify = true;
  return node;
}

function fromClashTuic(proxy: Record<string, YamlValue>): ParsedNode {
  const u = str(proxy['uuid']);
  const pw = str(proxy['password']);
  const node: ParsedNode = {
    protocol: 'tuic',
    name: str(proxy['name']),
    server: str(proxy['server']),
    port: num(proxy['port']),
    ...(u ? { uuid: u } : {}),
    ...(pw ? { password: pw } : {}),
  };
  const sni = str(proxy['sni']);
  if (sni) node.sni = sni;
  const alpn = arr(proxy['alpn']);
  if (alpn) node.alpn = alpn;
  const cc = str(proxy['congestion-controller']);
  if (cc) node.congestionControl = cc;
  const udp = str(proxy['udp-relay-mode']);
  if (udp) node.udpRelayMode = udp;
  if (bool(proxy['reduce-rtt'])) node.reduceRtt = true;
  if (bool(proxy['disable-sni'])) node.disableSni = true;
  if (bool(proxy['skip-cert-verify'])) node.skipCertVerify = true;
  return node;
}

function fromClashAnytls(proxy: Record<string, YamlValue>): ParsedNode {
  const node: ParsedNode = {
    protocol: 'anytls',
    name: str(proxy['name']),
    server: str(proxy['server']),
    port: num(proxy['port']),
    password: str(proxy['password']),
  };
  const sni = str(proxy['sni']);
  if (sni) node.sni = sni;
  const fp = str(proxy['client-fingerprint']);
  if (fp) node.fingerprint = fp;
  if (bool(proxy['skip-cert-verify'])) node.skipCertVerify = true;
  return node;
}

function fromClashHttp(proxy: Record<string, YamlValue>): ParsedNode {
  const node: ParsedNode = {
    protocol: 'http',
    name: str(proxy['name']),
    server: str(proxy['server']),
    port: num(proxy['port']),
  };
  const user = str(proxy['username']);
  const pass = str(proxy['password']);
  if (user) {
    node.password = pass ? `${user}:${pass}` : user;
  }
  return node;
}

function fromClashSocks5(proxy: Record<string, YamlValue>): ParsedNode {
  const node: ParsedNode = {
    protocol: 'socks5',
    name: str(proxy['name']),
    server: str(proxy['server']),
    port: num(proxy['port']),
  };
  const user = str(proxy['username']);
  const pass = str(proxy['password']);
  if (user) {
    node.password = pass ? `${user}:${pass}` : user;
  }
  return node;
}

type ClashConverter = (proxy: Record<string, YamlValue>) => ParsedNode;

const CLASH_CONVERTERS: Record<string, ClashConverter> = {
  vmess: fromClashVmess,
  vless: fromClashVless,
  trojan: fromClashTrojan,
  ss: fromClashSs,
  shadowsocks: fromClashSs,
  hysteria2: fromClashHysteria2,
  hy2: fromClashHysteria2,
  hysteria: fromClashHysteria,
  hy: fromClashHysteria,
  tuic: fromClashTuic,
  anytls: fromClashAnytls,
  http: fromClashHttp,
  socks5: fromClashSocks5,
};

// ─── V2Ray JSON / Plain link parsing ──────────────────────────────────

function extractLinks(text: string): string[] {
  const links = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));
  return links;
}

function parseJsonSubscription(text: string): ParsedEntry[] {
  try {
    const parsed = JSON.parse(text);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items.map((item: unknown) => {
      const raw = typeof item === 'string' ? item : JSON.stringify(item);
      return { raw, node: null };
    });
  } catch {
    return [];
  }
}

function maybeDecode(text: string): string | null {
  try {
    const decoded = decodeBase64(text.trim());
    if (decoded.length > 0 && decoded.length < text.length * 2) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

function isProxyLink(text: string): boolean {
  return /^[a-z][a-z0-9+.-]+:\/\//.test(text.trim());
}

function hasProxyLinks(text: string): boolean {
  const links = extractLinks(text);
  return links.length > 0 && links.some((l) => isProxyLink(l));
}

function resolvePlainText(text: string): ParsedEntry[] {
  const links = extractLinks(text);
  return links.filter((l) => isProxyLink(l)).map((raw) => ({ raw, node: null }));
}

// ─── Format detection ─────────────────────────────────────────────────

function tryResolveClash(text: string): ParsedEntry[] | null {
  if (!text.includes('proxies:')) return null;
  try {
    const entries = parseClashSubscription(text);
    if (entries.length > 0) return entries;
    return null;
  } catch {
    return null;
  }
}

function tryResolveJson(text: string): ParsedEntry[] | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return null;
  const entries = parseJsonSubscription(text);
  return entries.length > 0 ? entries : null;
}

function tryResolveBase64(text: string): ParsedEntry[] | null {
  const decoded = maybeDecode(text);
  if (!decoded) return null;

  const fromClash = tryResolveClash(decoded);
  if (fromClash) return fromClash;

  const fromJson = tryResolveJson(decoded);
  if (fromJson) return fromJson;

  if (hasProxyLinks(decoded)) {
    const links = extractLinks(decoded);
    return links.map((raw) => ({ raw, node: null }));
  }

  return null;
}

function tryResolvePlain(text: string): ParsedEntry[] {
  return resolvePlainText(text);
}

// ─── ParsedNode → proxy link (for Clash entries) ──────────────────────

function utf8ToBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function nodeToLink(node: ParsedNode): string {
  const { protocol, name, server, port } = node;
  const label = encodeURIComponent(name);

  if (protocol === 'ss') {
    const auth = utf8ToBase64(`${node.cipher ?? 'chacha20-ietf-poly1305'}:${node.password ?? ''}`);
    return `ss://${auth}@${server}:${port}#${label}`;
  }

  if (protocol === 'trojan') {
    const params = new URLSearchParams();
    if (node.tls) params.set('security', 'tls');
    if (node.sni) params.set('sni', node.sni);
    if (node.wsPath) params.set('type', 'ws');
    if (node.wsPath) params.set('path', node.wsPath);
    if (node.wsHost) params.set('host', node.wsHost);
    const qs = params.toString();
    return `trojan://${node.password ?? ''}@${server}:${port}${qs ? '?' + qs : ''}#${label}`;
  }

  if (protocol === 'vmess') {
    const cfg: Record<string, string | number> = {
      v: '2',
      ps: name,
      add: server,
      port,
      id: node.uuid ?? '',
      aid: node.alterId ?? 0,
      scy: node.cipher ?? 'auto',
      net: node.network ?? 'tcp',
      type: 'none',
    };
    if (node.tls) cfg.tls = 'tls';
    if (node.sni) cfg.sni = node.sni;
    if (node.wsHost || node.wsPath) {
      cfg.host = node.wsHost ?? '';
      cfg.path = node.wsPath ?? '/';
    }
    if (node.grpcServiceName) cfg.path = node.grpcServiceName;
    return `vmess://${utf8ToBase64(JSON.stringify(cfg))}`;
  }

  if (protocol === 'vless') {
    const u = `vless://${node.uuid ?? ''}@${server}:${port}`;
    const params = new URLSearchParams();
    params.set('type', node.network ?? 'tcp');
    params.set('encryption', 'none');
    if (node.flow) params.set('flow', node.flow);
    if (node.wsPath) params.set('path', node.wsPath);
    if (node.wsHost) params.set('host', node.wsHost);
    if (node.grpcServiceName) params.set('serviceName', node.grpcServiceName);
    if (node.tls) params.set('security', 'tls');
    if (node.sni) params.set('sni', node.sni);
    if (node.fingerprint) params.set('fp', node.fingerprint);
    if (node.realityPublicKey) {
      params.set('security', 'reality');
      params.set('pbk', node.realityPublicKey);
      if (node.realityShortId) params.set('sid', node.realityShortId);
    }
    return `${u}?${params.toString()}#${label}`;
  }

  if (protocol === 'hysteria2' || protocol === 'hy2') {
    const pw = node.password ?? '';
    const u = `hysteria2://${pw ? pw + '@' : ''}${server}:${port}`;
    const params = new URLSearchParams();
    if (node.sni) params.set('sni', node.sni);
    if (node.obfs) params.set('obfs', node.obfs);
    if (node.obfsPassword) params.set('obfs-password', node.obfsPassword);
    if (node.skipCertVerify) params.set('insecure', '1');
    const qs = params.toString();
    return `${u}${qs ? '?' + qs : ''}#${label}`;
  }

  if (protocol === 'hysteria' || protocol === 'hy') {
    const u = `hysteria://${server}:${port}`;
    const params = new URLSearchParams();
    if (node.password) params.set('auth', node.password);
    if (node.sni) params.set('sni', node.sni);
    if (node.upMbps !== undefined) params.set('up', String(node.upMbps));
    if (node.downMbps !== undefined) params.set('down', String(node.downMbps));
    if (node.obfs) params.set('obfs', node.obfs);
    const qs = params.toString();
    return `${u}${qs ? '?' + qs : ''}#${label}`;
  }

  if (protocol === 'tuic') {
    const uuid = node.uuid ?? '';
    const pw = node.password ?? '';
    const u = `tuic://${uuid}${pw ? ':' + pw : ''}@${server}:${port}`;
    const params = new URLSearchParams();
    if (node.sni) params.set('sni', node.sni);
    if (node.congestionControl) params.set('congestion_control', node.congestionControl);
    if (node.udpRelayMode) params.set('udp_relay_mode', node.udpRelayMode);
    if (node.reduceRtt) params.set('reduce_rtt', 'true');
    if (node.skipCertVerify) params.set('allow_insecure', 'true');
    const qs = params.toString();
    return `${u}${qs ? '?' + qs : ''}#${label}`;
  }

  if (protocol === 'anytls') {
    const u = `anytls://${node.password ?? ''}@${server}:${port}`;
    const params = new URLSearchParams();
    if (node.sni) params.set('sni', node.sni);
    if (node.fingerprint) params.set('fp', node.fingerprint);
    if (node.skipCertVerify) params.set('insecure', '1');
    const qs = params.toString();
    return `${u}${qs ? '?' + qs : ''}#${label}`;
  }

  if (protocol === 'http') {
    const pw = node.password ?? '';
    const auth = pw ? `${encodeURIComponent(pw)}@` : '';
    return `http://${auth}${server}:${port}#${label}`;
  }

  if (protocol === 'socks5') {
    const pw = node.password ?? '';
    const auth = pw ? `${encodeURIComponent(pw)}@` : '';
    return `socks5://${auth}${server}:${port}#${label}`;
  }

  return name;
}

function parseClashSubscription(text: string): ParsedEntry[] {
  const doc = parseYaml(text);
  const proxies = getProxies(doc);
  return proxies.map((proxy) => {
    const type = str(proxy['type']).toLowerCase();
    const converter = CLASH_CONVERTERS[type];
    if (!converter) {
      return { raw: str(proxy['name']), node: null };
    }
    const node = converter(proxy);
    const link = nodeToLink(node);
    return { raw: link, node };
  });
}

// ─── Main resolve function ────────────────────────────────────────────

async function resolveSubscription(
  url: string,
  options?: { fetch?: typeof fetch },
): Promise<ParsedEntry[]> {
  const fetchFn = options?.fetch ?? globalThis.fetch;
  let response: Response;
  try {
    response = await fetchFn(url);
    if (!response.ok) return [];
  } catch {
    return [];
  }

  const text = await response.text();
  if (!text || text.length === 0) return [];

  const fromClash = tryResolveClash(text);
  if (fromClash) return fromClash;

  const fromJson = tryResolveJson(text);
  if (fromJson) return fromJson;

  const fromBase64 = tryResolveBase64(text);
  if (fromBase64) return fromBase64;

  return tryResolvePlain(text);
}

// ─── Plugin exports ───────────────────────────────────────────────────

export const subscriptionParser: SubscriptionParser = {
  id: 'subscription',
  label: '订阅链接解析器',
  schemes: ['https://', 'http://'],
  resolve: resolveSubscription,
};

export const subscriptionPlugin: Plugin = {
  name: 'subscription',
  register(registry) {
    registry.registerSubscriptionParser(subscriptionParser);
  },
};
