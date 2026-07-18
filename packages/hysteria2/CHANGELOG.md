# @siiway/subhub-plugin-hysteria2

## 0.1.1

### Patch Changes

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
