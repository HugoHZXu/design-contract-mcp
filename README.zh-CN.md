# Design Contract MCP

[English](README.md) | [简体中文](README.zh-CN.md)

> 📋 **说明。** 这是一个 Figma-to-Code MCP 服务器，基于设计系统的 AI 合约从 Figma 设计稿生成 React 代码。
> MCP 逻辑已基本完成。目前仓库使用与真实 Figma MCP 输出和 Code Connect 映射格式一致的本地模拟数据，原因是尚未有机会对接真实 Figma 环境进行集成测试。

Design Contract MCP 是一个**合约优先的 Figma-to-Code MCP**。当组件库通过 Code Connect 连接到 Figma 之后，这个 MCP 可以：

1. 通过 Figma MCP 获取选中 frame 的设计数据
2. 加载从组件库生成的 AI 合约产物
3. 将 Figma 组件映射到对应的实现组件
4. 构建一份上下文数据包，包含设计数据、组件合约、tokens 和模式规则
5. 用合约指导 AI 生成代码，并校验生成的 React 代码是否符合合约
6. 返回结构化的生成上下文和校验报告

本仓库已经完整实现了 MCP 的全部逻辑。目前尚未对接真实 Figma MCP 端点和真实 Code Connect 数据进行集成测试，所以仓库使用与真实 Figma MCP 输出和 Code Connect 映射格式非常接近的本地 fixture 来模拟。这样可以在本地验证完整的"合约解析 → 上下文构建 → 校验"链路，未来接入真实 Figma/Code Connect 数据源时只需替换数据读取层，核心 MCP 逻辑几乎不需要改动。

本项目与 [`hugo-ui`](https://github.com/HugoHZXu/hugo-ui) 设计系统仓库配合使用：

- **[`hugo-ui`](https://github.com/HugoHZXu/hugo-ui)** 维护 `@hugo-ui/mui` 组件库源码，并通过 GitHub Releases 发布版本化的 AI 合约产物。
- **Design Contract MCP**（本仓库）负责获取设计数据、解析组件映射、加载 AI 合约、构建生成上下文，并校验生成的 React 代码。

## 它能做什么

通过仓库内置的"编辑资料弹窗"示例（使用本地模拟数据代替真实 Figma 数据），你可以体验完整链路：

1. 将 Figma MCP 格式的工具输出标准化为本地设计样例数据（目前使用模拟数据）
2. 从 Code Connect 风格的 manifest 中解析设计节点到组件的映射关系
3. 从已验证的 `@hugo-ui/mui` AI 合约包中加载组件合约和 token 使用策略
4. 生成一份上下文数据包，整合设计数据、映射信息、组件合约、设计 tokens、页面模式规则，以及预期要用到的组件清单
5. 校验生成的 React 代码，检查导入来源、props 合法性、禁用 props、组件覆盖情况和硬编码颜色值
6. 返回结构化的生成上下文和校验报告，供 AI 编码助手或下游应用消费

## 架构总览

目标工作流会连接真实的 Figma 和 Code Connect：

```text
组件库 (hugo-ui)
  通过 GitHub Release 发布 AI 合约
        │
        ▼
AI 合约产物  ◄───── Code Connect 映射 Figma ↔ 组件
        │                        ▲
        ▼                        │
Design Contract MCP ──► 通过 Figma MCP 获取 frame 数据
        │              （目前用本地 fixture 模拟）
        ▼
生成上下文数据包（设计数据 + 映射 + 合约 + tokens）
        │
        ▼
AI 编码助手生成 React
        │
        ▼
校验器检查导入、props、组件覆盖、原始颜色
        │
        ▼
校验通过的 React 代码
```

目前 Figma MCP 数据和 Code Connect 映射使用 `fixtures/figma/` 和 `code-connect/` 下的本地模拟数据，这样无需连接真实 Figma 就能端到端运行整个 MCP 流水线。AI 合约本身是真实的——使用的是真正的 `@hugo-ui/mui` 合约快照，来源可以是仓库提交的 vendor 兜底副本，也可以是本地缓存的 GitHub Release 产物。

想了解更详细的架构说明，请参阅 [docs/architecture.zh-CN.md](docs/architecture.zh-CN.md) ([English](docs/architecture.md))。
想了解如何从当前状态落地到生产部署，请参阅 [docs/mvp-to-product.zh-CN.md](docs/mvp-to-product.zh-CN.md) ([English](docs/mvp-to-product.md))。

## 快速开始

### 前置条件

- Node.js 18+
- npm

### 运行步骤

```bash
# 安装依赖
npm install

# 验证 vendor 目录下的 hugo-ui 合约完整性
npm run contract:verify:hugo-ui

# 标准化 Figma 捕获数据
npm run figma:normalize

# 构建上下文数据包
npm run context:pack

# 校验通过样例（应该显示校验通过）
npm run validate

# 校验失败样例（应该显示校验失败，用于演示负向场景）
npm run validate:bad
```

运行完以上命令后，你可以查看 `generated/` 目录下的上下文数据包、生成样例和校验报告。

## 接入真实 Figma

目前仓库使用本地模拟 fixture（格式与真实 Figma MCP 输出和 Code Connect 映射一致），因此无需连接 Figma 就能运行完整流水线。当组件库完成 Code Connect 配置后，要接入真实 Figma 工作流：

1. 将 fixture 读取器替换为真实的 Figma MCP 客户端，从 Figma 获取 frame 数据
2. 将静态的 `code-connect/manifest.json` 替换为设计系统发布的真实 Code Connect 映射数据
3. 同步与组件库版本匹配的 `@hugo-ui/mui` AI 合约版本
4. MCP 服务的核心逻辑——上下文构建、合约适配、校验——不需要改动
5. AI 编码助手调用 `build_generation_context` 获取完整上下文，基于合约指导生成 React，然后调用 `validate_generated_code` 校验输出

> 💡 MCP 服务本身只负责**上下文解析和代码校验**，不调用 LLM，也不生成代码——代码生成由调用它的 AI 编码客户端完成。

## 管理 hugo-ui 合约版本

`vendor/hugo-ui/mui-ai-contract/` 下提交了一份可复现的 vendor 兜底快照。运行时工具也可以读取解压到 `.cache/hugo-ui/mui-ai-contract/<version>/` 的发布产物。

查看本地合约状态：

```bash
npm run contract:status:hugo-ui
```

列出 `HugoHZXu/hugo-ui` 上已发布的 `mui-ai-contract-v*` 版本：

```bash
npm run contract:list:hugo-ui
```

同步合约到本地缓存。`installed` 会读取本地 `@hugo-ui/mui` 包版本，并选择不高于该版本的最新合约：

```bash
npm run contract:sync:hugo-ui -- --version installed
```

其他支持的版本选择方式：

```bash
# 最新版本
npm run contract:sync:hugo-ui -- --version latest

# 指定版本
npm run contract:sync:hugo-ui -- --version 1.0.2

# 指定 release tag
npm run contract:sync:hugo-ui -- --tag mui-ai-contract-v1.0.2
```

同步脚本会自动下载 `hugo-ui-mui-ai-contract-v<version>.tgz`，校验对应的 `.tgz.sha256`，把快照解压到 `.cache/hugo-ui/mui-ai-contract/<version>/`，检查必需文件，并读取 `provenance.json` 溯源信息。

同步脚本会校验 Release tag、包文件名和 `provenance.contractVersion` 三者是否一致。例如 tag `mui-ai-contract-v<version>` 应该包含 `hugo-ui-mui-ai-contract-v<version>.tgz`，解压后的 provenance 应该记录 `contractVersion: "<version>"`；如果不一致，同步会失败。

本地开发时，也可以直接消费已经下载好的包：

```bash
npm run contract:sync:hugo-ui -- \
  --from-file /path/to/hugo-ui-mui-ai-contract-v<version>.tgz
```

通过环境变量 `HUGO_UI_CONTRACT_VERSION` 可以设置默认使用的合约来源，支持 `vendor`、`latest`、`installed`，或者像 `1.0.2` 这样的具体版本号。运行时会依次从 vendor 快照和本地缓存中解析合约。

## 通过 stdio 运行 MCP 服务

```bash
npm run mcp:server
```

这个命令用于本地手动调试。配置本地 MCP 客户端时，可以直接启动服务进程：

```bash
./node_modules/.bin/tsx mcp-server/src/server.ts
```

stdio 模式下服务暴露以下工具：

- `get_design_context(frameId)` — 获取设计上下文
- `get_code_connect_map(nodeId)` — 获取组件映射
- `get_component_contract(componentName, contractVersion?)` — 获取组件合约
- `build_generation_context(frameId, contractVersion?)` — 构建生成上下文
- `validate_generated_code(code, expectedComponentUsage, contractVersion?)` — 校验生成代码
- `get_contract_status()` — 查看合约状态

## 通过 Streamable HTTP 运行 MCP 服务

```bash
npm run mcp:http
```

HTTP 入口默认监听 `127.0.0.1:3000`，提供：

- `POST /mcp` — MCP Streamable HTTP 协议端点
- `GET /healthz` — 健康检查

可配置的环境变量：

```bash
MCP_HTTP_HOST=127.0.0.1
MCP_HTTP_PORT=3000
MCP_ALLOWED_HOSTS=localhost,127.0.0.1
MCP_ALLOWED_ORIGINS=http://localhost:3000
HUGO_UI_CONTRACT_VERSION=latest
HUGO_UI_CONTRACT_SYNC=startup
MCP_AUTH_MODE=external
MCP_AUTH_PROVIDER=cloud-platform
MCP_AUTH_CONTEXT_HEADERS=x-authenticated-user-email,x-authenticated-user-id
MCP_LOG_LEVEL=info
```

多数内部部署会在平台、负载均衡或反向代理层终止 TLS 并完成认证，再通过 HTTP 转发到 Node 进程。`MCP_AUTH_MODE=external` 表示认证由上游处理。`MCP_ALLOWED_HOSTS` 限制可接受的 Host 请求头，`MCP_ALLOWED_ORIGINS` 在存在 `Origin` 请求头时限制浏览器来源。`HUGO_UI_CONTRACT_SYNC=startup` 会在进程启动时执行一次 GitHub Release 同步，之后的 MCP 请求直接读取本地缓存。

## 通过 Node HTTPS 运行 MCP 服务

仓库也提供了 Node HTTPS 入口，适用于需要由该进程自行终止 TLS 的环境：

```bash
npm run mcp:https
```

必需的证书配置：

```bash
MCP_HTTPS_KEY_FILE=/path/to/server.key
MCP_HTTPS_CERT_FILE=/path/to/server.crt
MCP_HTTPS_HOST=127.0.0.1
MCP_HTTPS_PORT=3443
```

证书材料可以来自原始环境变量、Base64 编码的环境变量，或部署平台提供的文件路径：

```bash
# 直接传入证书内容
MCP_HTTPS_KEY="-----BEGIN PRIVATE KEY-----..."
MCP_HTTPS_CERT="-----BEGIN CERTIFICATE-----..."
MCP_HTTPS_CA="-----BEGIN CERTIFICATE-----..."

# Base64 编码
MCP_HTTPS_KEY_BASE64=...
MCP_HTTPS_CERT_BASE64=...
MCP_HTTPS_CA_BASE64=...

# 文件路径
MCP_HTTPS_KEY_FILE=/path/to/server.key
MCP_HTTPS_CERT_FILE=/path/to/server.crt
MCP_HTTPS_CA_FILE=/path/to/ca.crt

# 证书密码（如果有）
MCP_HTTPS_PASSPHRASE=...
```

HTTPS 入口与 HTTP 入口使用相同的 MCP 请求处理器、缓存解析器、健康检查、日志、Host 校验和认证模式。当网关、SSO、IAM 或白名单服务在请求到达本进程前完成认证时，同样使用 `MCP_AUTH_MODE=external`。

MCP 日志以 JSON Lines 格式写入 stderr。支持的 `MCP_LOG_LEVEL` 有 `debug`、`info`、`warn`、`error` 和 `silent`。日志内容包括 HTTP 启动配置、请求 ID、请求方法、URL、状态码、耗时、Host、远端地址、MCP 工具名、工具耗时、合约版本解析结果、校验通过/失败摘要，以及错误信息。

## 本地命令行工具

除了启动 MCP 服务，你也可以直接在本地运行各个工具：

**标准化 Figma 捕获数据**：

```bash
npm run figma:normalize
```

**生成上下文数据包**：

```bash
npm run context:pack
```

> 💡 `npm run context:pack` 会先自动运行 `npm run figma:normalize`，保证标准化数据始终从原始捕获数据派生。

**构建生成上下文**：

```bash
npm run mcp:context
```

**针对指定合约版本构建上下文**：

```bash
./node_modules/.bin/tsx mcp-server/src/local-cli.ts \
  build-generation-context frame-edit-profile \
  --contract-version latest
```

**读取设计上下文**：

```bash
npm run mcp:design
```

**校验通过样例**：

```bash
npm run validate
```

**校验失败样例**：

```bash
npm run validate:bad
```

`npm run validate` 会断言样例代码有效；`npm run validate:bad` 会断言无效样例仍然校验失败——如果负向样例意外通过了校验，CI 就会报错，避免校验器被改坏。

## 校验范围

校验器会检查以下内容：

- 映射组件是否从合约指定的包导入
- JSX 上使用的 props 是否都在适配后的组件合约中声明
- 是否使用了被标记为禁用的 props
- 生成的 JSX 是否覆盖了上下文包中预期要用到的所有组件
- 是否出现 `#FF0000`、`rgb(...)`、`hsl(...)` 这类硬编码的原始颜色值

校验器会把真实 hugo-ui 合约中的 `props[]`、`forbiddenProps`、`discouragedProps`、`generationRules`、`validationRules` 和 `tokenPolicy` 适配为内部校验格式。上下文包会保留原始合约数据，便于追溯每一条校验规则的来源。

> 💡 TypeScript 编译、视觉回归测试、无障碍检查或生产策略校验等能力，可以在下游代码生成流水线中补充。

## 链路追踪示例

下面以"编辑资料弹窗"中的"名字输入框"为例，走一遍完整链路：

1. **原始捕获**：[`edit-profile-modal.mcp-context.json`](fixtures/figma/mcp/edit-profile-modal.mcp-context.json) 记录了 Figma MCP 返回的原始结果
2. **标准化数据**：运行 `npm run figma:normalize` 生成 [`edit-profile-modal.fixture.json`](fixtures/figma/edit-profile-modal.fixture.json)，保留节点 ID、组件 ID、属性、布局、Code Connect 片段、文本内容等
3. **设计节点**：标准化数据中包含 `node-input-first-name`，这是一个 `Input/Text` 实例，标签文本和示例值从 Code Connect 上下文中保留下来
4. **组件映射**：[`manifest.json`](code-connect/manifest.json) 把 `node-input-first-name` 映射到 `@hugo-ui/mui` 的 `Input` 组件，并指向对应的合约文件
5. **组件合约**：vendor 目录下的 Input 合约定义了导入路径、props 列表、AI 使用建议、不推荐 props、生成规则、校验规则和 token 策略
6. **合约适配**：[`hugo-ui-mui.ts`](mcp-server/src/contract-adapters/hugo-ui-mui.ts) 把原始合约转换成校验器内部格式，同时保留原始数据和策略元数据
7. **上下文包**：`npm run context:pack` 生成 [`edit-profile-modal.context-pack.json`](generated/edit-profile-modal.context-pack.json)，整合了设计数据、映射、合约、token 策略、模式规则、溯源信息和预期组件清单
8. **生成代码**：[`edit-profile-modal.generated.tsx`](generated/edit-profile-modal.generated.tsx) 从 `@hugo-ui/mui` 导入 `Button`、`Input`、`Modal`
9. **校验结果**：`npm run validate` 根据适配后的合约和预期组件清单检查代码，通过样例包含 1 个 Modal、2 个 Input 和 2 个 Button

失败样例展示了导入包错误、props 错误、硬编码颜色、组件缺失等场景的校验失败结果，可以运行：

```bash
npm run validate:bad
```

## 项目结构

```text
fixtures/figma/mcp/                     从 Figma MCP 捕获的原始工具结果
fixtures/figma/                         标准化后的 Figma-like JSON 数据
code-connect/manifest.json              带合约信息的节点到组件映射表
code-connect/mock/                      Code Connect 模板样例
.cache/hugo-ui/mui-ai-contract/         运行时同步的合约缓存（git 忽略）
vendor/hugo-ui/mui-ai-contract/         随仓库提交的 @hugo-ui/mui AI 合约兜底快照
contracts/patterns/                     页面级模式合约
mcp-server/                             MCP 服务核心代码（stdio/HTTP/HTTPS 入口、适配器、CLI、校验器）
generated/                              静态样例、上下文数据包、校验报告
docs/                                   架构说明和产品路线图文档
scripts/normalize-figma-fixture.ts      Figma MCP 捕获数据到标准样例的转换脚本
scripts/hugo-ui-contract.ts             合约版本列表、同步、状态检查和验证 CLI
scripts/sync-hugo-ui-contract.mjs       旧版合约同步脚本（保留参考）
```

## 许可证

MIT。详见 `LICENSE` 文件。
