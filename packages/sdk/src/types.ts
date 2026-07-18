/**
 * SubHub 插件系统核心类型定义。
 *
 * 设计目标（方案3）：提供一套通用的服务端插件 / 中间件机制，允许在请求生命周期中
 * 注入自定义逻辑，并作为承载"协议解析插件"（方案2）与"订阅格式转换插件"（方案1）
 * 的统一扩展点。
 */

/** 规范化后的节点模型，协议解析插件的产物，订阅格式插件的输入。 */
export interface ParsedNode {
  /** 归一化协议 id，如 'vmess' | 'vless' | 'trojan' | 'ss' | 'hysteria2' | 'hysteria' | 'anytls' */
  protocol: string;
  /** 展示名称 / 备注 */
  name: string;
  /** 服务器地址 */
  server: string;
  /** 端口 */
  port: number;

  // --- 凭据 ---
  uuid?: string;
  password?: string;
  /** 加密方式：ss 的 method / vmess 的 scy */
  cipher?: string;
  alterId?: number;
  flow?: string;

  // --- 传输层 ---
  /** tcp | ws | grpc | h2 | httpupgrade | splithttp ... */
  network?: string;
  wsPath?: string;
  wsHost?: string;
  grpcServiceName?: string;

  // --- TLS / REALITY ---
  tls?: boolean;
  sni?: string;
  fingerprint?: string;
  alpn?: string[];
  skipCertVerify?: boolean;
  realityPublicKey?: string;
  realityShortId?: string;

  // --- Hysteria 系列 ---
  obfs?: string;
  obfsPassword?: string;
  upMbps?: number;
  downMbps?: number;

  // --- TUIC ---
  /** 拥塞控制算法：cubic | new_reno | bbr */
  congestionControl?: string;
  /** UDP 转发模式：native | quic */
  udpRelayMode?: string;
  /** 0-RTT 握手 */
  reduceRtt?: boolean;
  /** 是否禁用 SNI */
  disableSni?: boolean;

  /** 其余未归一化的原始查询参数，供格式插件按需取用 */
  extra?: Record<string, string>;
}

/** 一条订阅条目：保留原始链接 + 解析结果（解析失败时 node 为 null）。 */
export interface ParsedEntry {
  raw: string;
  node: ParsedNode | null;
}

/**
 * 协议解析插件（方案2）。
 * 负责把某类原始代理链接解析为规范化的 {@link ParsedNode}。
 */
export interface ProtocolParser {
  /** 协议 id，如 'vmess' */
  id: string;
  /** 展示名，如 'VMess' */
  label: string;
  /** 处理的 URI 前缀，如 ['vmess://']；用于按前缀路由 */
  schemes: string[];
  /** 解析单条链接；无法解析返回 null */
  parse: (link: string) => ParsedNode | null;
}

/** 订阅格式插件的输出。 */
export interface FormatResult {
  body: string;
  contentType: string;
}

/**
 * 订阅格式转换插件（方案1）。
 * 负责把一组解析条目转换为特定客户端可识别的订阅内容（Base64 / Clash YAML ...）。
 */
export interface SubscriptionFormatter {
  /** 格式 id，如 'base64' | 'clash' */
  id: string;
  /** 展示名 */
  label: string;
  /** target 查询参数的别名，如 clash: ['mihomo', 'clash-meta'] */
  aliases?: string[];
  /** 生成订阅内容 */
  format: (entries: ParsedEntry[], ctx: FormatContext) => FormatResult;
}

/** 传递给订阅格式插件的上下文。 */
export interface FormatContext {
  /** 订阅显示名称（通常为分组名） */
  title: string;
}

/** 请求生命周期上下文，在中间件之间共享。 */
export interface PluginContext {
  /**
   * 宿主环境绑定。SDK 与具体运行时解耦，故此处为 unknown；
   * 宿主（如 SubHub Worker）在使用处收紧为自身的 Env 类型。
   */
  env: unknown;
  request: Request;
  url: URL;
  /** 跨中间件共享的可变状态 */
  state: Map<string, unknown>;
}

/** 请求中间件：返回 Response 可短路后续处理；返回 undefined 继续。 */
export type RequestHook = (
  ctx: PluginContext,
) => Promise<Response | undefined> | Response | undefined;

/** 响应中间件：可对即将返回的 Response 进行加工。 */
export type ResponseHook = (ctx: PluginContext, response: Response) => Promise<Response> | Response;

/**
 * 插件定义。一个插件可同时：
 * - 在 {@link Plugin.register} 中向注册表登记协议解析器 / 订阅格式器；
 * - 通过 {@link Plugin.onRequest} / {@link Plugin.onResponse} 注入请求生命周期逻辑。
 */
export interface Plugin {
  /** 插件唯一名称 */
  name: string;
  /** 版本（可选） */
  version?: string;
  /** 注册期回调：向注册表登记扩展点 */
  register?: (registry: PluginRegistryLike) => void;
  /** 请求进入时的中间件 */
  onRequest?: RequestHook;
  /** 响应返回前的中间件 */
  onResponse?: ResponseHook;
}

/**
 * 注册表对插件暴露的最小接口（避免 register 回调直接依赖具体实现类，
 * 便于测试与解耦）。
 */
export interface PluginRegistryLike {
  registerParser: (parser: ProtocolParser) => void;
  registerFormatter: (formatter: SubscriptionFormatter) => void;
}
