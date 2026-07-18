---
"@siiway/subhub-plugin-tuic": minor
"@siiway/subhub-plugin-sdk": minor
"@siiway/subhub-plugin-clash": patch
---

新增 TUIC 协议解析插件（`tuic://`）。

- `@siiway/subhub-plugin-tuic`：解析 `tuic://uuid:password@host:port?params#name`，支持 `congestion_control`、`udp_relay_mode`、`alpn`、`sni`、`reduce_rtt`、`disable_sni`、`allow_insecure` 等参数。
- `@siiway/subhub-plugin-sdk`：`ParsedNode` 新增 TUIC 相关字段（`congestionControl` / `udpRelayMode` / `reduceRtt` / `disableSni`）。
- `@siiway/subhub-plugin-clash`：Clash / Mihomo YAML 订阅支持输出 TUIC 节点。
