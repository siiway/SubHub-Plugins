/**
 * @siiway/subhub-plugin-sdk
 *
 * SubHub 插件开发 SDK：导出插件系统核心类型（方案3）与协议解析插件共用的工具函数。
 * 第三方插件只需依赖本包即可开发协议解析 / 订阅格式 / 中间件插件。
 */

export type {
  ParsedNode,
  ParsedEntry,
  ProtocolParser,
  FormatResult,
  SubscriptionFormatter,
  FormatContext,
  PluginContext,
  RequestHook,
  ResponseHook,
  Plugin,
  PluginRegistryLike,
} from './types';

export {
  decodeBase64,
  toParsableUrl,
  labelFromHash,
  parseAlpn,
  collectParams,
} from './shared';
