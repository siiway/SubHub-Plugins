---
'@siiway/subhub-plugin-sdk': minor
'@siiway/subhub-plugin-vmess': minor
'@siiway/subhub-plugin-vless': minor
'@siiway/subhub-plugin-trojan': minor
'@siiway/subhub-plugin-shadowsocks': minor
'@siiway/subhub-plugin-hysteria2': minor
'@siiway/subhub-plugin-hysteria': minor
'@siiway/subhub-plugin-anytls': minor
'@siiway/subhub-plugin-base64': minor
'@siiway/subhub-plugin-clash': minor
'@siiway/subhub-plugin-response-header': minor
---

首次发布：SubHub 插件系统拆分为独立 npm 包。

- `@siiway/subhub-plugin-sdk`：插件核心类型（`ParsedNode` / `ProtocolParser` / `SubscriptionFormatter` / `Plugin` 等）与协议解析共用工具（`decodeBase64` / `toParsableUrl` / `labelFromHash` / `parseAlpn` / `collectParams`）。
- 协议解析插件：vmess、vless、trojan、shadowsocks(ss)、hysteria2、hysteria、anytls。
- 订阅格式插件：base64、clash（Clash / Mihomo YAML）。
- 中间件示例插件：response-header。
