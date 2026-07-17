# SubHub Plugins

[SubHub](https://github.com/siiway/SubHub) 插件 monorepo。每个插件独立发布为 npm 包，供 SubHub（或任何兼容宿主）按需安装、启用。

## 插件类型

| 类型 | 说明 | 扩展点 |
| --- | --- | --- |
| 协议解析（parser） | 把原始代理链接解析为规范化 `ParsedNode` | `ProtocolParser` |
| 订阅格式（formatter） | 把节点列表输出为某种订阅格式 | `SubscriptionFormatter` |
| 中间件（middleware） | 在请求生命周期中注入逻辑 | `Plugin.onRequest` / `onResponse` |

## 包一览

| npm 包 | 类型 | 说明 |
| --- | --- | --- |
| `@siiway/subhub-plugin-sdk` | — | 核心类型 + 共用工具，插件开发依赖 |
| `@siiway/subhub-plugin-vmess` | parser | VMess `vmess://` |
| `@siiway/subhub-plugin-vless` | parser | VLESS `vless://` |
| `@siiway/subhub-plugin-trojan` | parser | Trojan `trojan://` |
| `@siiway/subhub-plugin-shadowsocks` | parser | Shadowsocks `ss://` |
| `@siiway/subhub-plugin-hysteria2` | parser | Hysteria2 `hysteria2://` / `hy2://` |
| `@siiway/subhub-plugin-hysteria` | parser | Hysteria `hysteria://` |
| `@siiway/subhub-plugin-anytls` | parser | AnyTLS `anytls://` |
| `@siiway/subhub-plugin-base64` | formatter | 通用 Base64 订阅 |
| `@siiway/subhub-plugin-clash` | formatter | Clash / Mihomo YAML 订阅 |
| `@siiway/subhub-plugin-response-header` | middleware | 响应头示例插件 |
| `@siiway/subhub-plugin-subcheck` | middleware | 代理可用性检测插件 |

## 开发

使用 npm workspaces 管理，需 Node.js >= 20。

```bash
npm install        # 安装并链接所有 workspace
npm run build      # 先构建 SDK，再构建全部插件包
```

各插件仅依赖 `@siiway/subhub-plugin-sdk`。编写一个插件：

```ts
import type { ProtocolParser, ParsedNode } from '@siiway/subhub-plugin-sdk';

export const myParser: ProtocolParser = {
  id: 'myproto',
  label: 'My Protocol',
  schemes: ['myproto://'],
  parse(link): ParsedNode | null {
    // ...
    return null;
  },
};
```

## 发布

采用 [Changesets](https://github.com/changesets/changesets) + GitHub Actions 自动发布。

1. 修改插件后添加变更集：`npm run changeset`（选择受影响的包与语义化级别）。
2. 提交并合入 `main`。
3. `.github/workflows/release.yml` 会自动开一个「Version Packages」PR；合入后，改动过的包会被自动 `changeset publish` 到 npm。

需在仓库 Secrets 配置 `NPM_TOKEN`（具备 `@siiway` 组织发布权限的 npm 自动化令牌）。

## License

MIT
