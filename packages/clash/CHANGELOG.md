# @siiway/subhub-plugin-clash

## 0.1.1

### Patch Changes

- e8eca7e: 新增 TUIC 协议解析插件（`tuic://`）。

  - `@siiway/subhub-plugin-tuic`：解析 `tuic://uuid:password@host:port?params#name`，支持 `congestion_control`、`udp_relay_mode`、`alpn`、`sni`、`reduce_rtt`、`disable_sni`、`allow_insecure` 等参数。
  - `@siiway/subhub-plugin-sdk`：`ParsedNode` 新增 TUIC 相关字段（`congestionControl` / `udpRelayMode` / `reduceRtt` / `disableSni`）。
  - `@siiway/subhub-plugin-clash`：Clash / Mihomo YAML 订阅支持输出 TUIC 节点。

- Updated dependencies [e8eca7e]
  - @siiway/subhub-plugin-sdk@0.2.0

## 0.1.0

### Minor Changes

- 569bf6d: 首次发布：SubHub 插件系统拆分为独立 npm 包。

  - `@siiway/subhub-plugin-sdk`：插件核心类型（`ParsedNode` / `ProtocolParser` / `SubscriptionFormatter` / `Plugin` 等）与协议解析共用工具（`decodeBase64` / `toParsableUrl` / `labelFromHash` / `parseAlpn` / `collectParams`）。
  - 协议解析插件：vmess、vless、trojan、shadowsocks(ss)、hysteria2、hysteria、anytls。
  - 订阅格式插件：base64、clash（Clash / Mihomo YAML）。
  - 中间件示例插件：response-header。

### Patch Changes

- Updated dependencies [569bf6d]
  - @siiway/subhub-plugin-sdk@0.1.0
