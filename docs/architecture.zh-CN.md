# 架构说明

[English](architecture.md) | [简体中文](architecture.zh-CN.md)

## 概览

Design Contract MCP 是一个**合约优先的 Figma-to-Code MCP 服务器**。当组件库通过 Code Connect 连接到 Figma 之后，这个 MCP 会通过 Figma MCP 获取设计 frame 数据，加载从组件库生成的 AI 合约产物，解析组件映射，构建生成上下文数据包，并校验生成的 React 代码是否符合合约规范。

MCP 逻辑已基本完成，但目前仓库使用与真实 Figma MCP 输出和 Code Connect 映射格式一致的本地模拟 fixture，原因是尚未有机会对接真实 Figma 环境进行集成测试。通过这些 fixture，无需连接真实 Figma 就能端到端运行完整的 MCP 流水线——合约解析、上下文构建、校验都可以在本地验证。接入真实 Figma 环境时，只需要替换数据读取层，核心 MCP 逻辑保持不变。

整个仓库围绕一条清晰的数据流来组织：

```text
Figma frame 数据（目前使用 mock fixture，对接真实 Figma 后切换）
  → 标准化的设计数据
  → Code Connect 组件映射
  → @hugo-ui/mui AI 合约包
  → 生成上下文数据包
  → AI 生成的 React 代码（由调用方的 AI 客户端生成）
  → 校验报告
```

## 双仓库关系

[`hugo-ui`](https://github.com/HugoHZXu/hugo-ui) 仓库负责维护设计系统源码，并通过 GitHub Releases 发布版本化的 `@hugo-ui/mui` AI 合约包。

本仓库通过两种方式使用这些合约：

- `vendor/hugo-ui/mui-ai-contract/`：随仓库提交的兜底快照，保证项目可以开箱即用地运行
- `.cache/hugo-ui/mui-ai-contract/<version>/`：运行时同步的发布产物，本地开发或部署时使用

## 目录职责

| 目录 | 作用 |
|------|------|
| `vendor/hugo-ui/mui-ai-contract/` | 兜底的合约快照，包含组件合约、token 合约、Schema、元数据和 `provenance.json` 溯源信息 |
| `.cache/hugo-ui/mui-ai-contract/<version>/` | 由 `npm run contract:sync:hugo-ui` 或启动同步脚本填充，运行时优先从这里读取合约 |
| `fixtures/figma/mcp/` | 保存从 Figma MCP 捕获到的原始数据 |
| `fixtures/figma/` | 经过 [`normalize-figma-fixture.ts`](../scripts/normalize-figma-fixture.ts) 标准化后的设计样例数据，是 MCP 工具的直接输入 |
| `code-connect/manifest.json` | 设计节点 ID 到 `@hugo-ui/mui` 组件的映射表，同时指向对应的合约文件 |
| `code-connect/mock/` | 已映射组件的 Code Connect 模板示例 |
| `contracts/patterns/` | 页面级别的模式合约。当前示例使用 [`modal-form.pattern.json`](../contracts/patterns/modal-form.pattern.json) 来描述编辑资料弹窗的表单模式 |
| `mcp-server/` | MCP 服务的核心代码，包括 stdio/HTTP/HTTPS 三种入口、本地 CLI、合约适配器、上下文工具和校验器 |
| `generated/` | 生成的上下文数据包、React 代码样例以及校验报告 |

## 数据流转过程

下面以仓库内置的"编辑资料弹窗"为例，说明数据如何从设计捕获一路走到校验报告：

1. **原始捕获**：[`edit-profile-modal.mcp-context.json`](../fixtures/figma/mcp/edit-profile-modal.mcp-context.json) 保存了从 Figma MCP 返回的原始结果，包括精简的 XML 元数据、带 `CodeConnectSnippet` 标记的类 React 设计上下文、`get_code_connect_map` 的返回结果以及变量定义。

2. **数据标准化**：运行 `npm run figma:normalize`，[`normalize-figma-fixture.ts`](../scripts/normalize-figma-fixture.ts) 会把原始数据转换成 [`edit-profile-modal.fixture.json`](../fixtures/figma/edit-profile-modal.fixture.json)，保留节点 ID、组件 ID、组件属性、布局数据、Code Connect 代码片段、文本内容和组件元数据。

3. **组件映射**：[`manifest.json`](../code-connect/manifest.json) 定义了每个设计节点对应哪个 `@hugo-ui/mui` 组件，以及该组件的合约文件路径。

4. **合约解析**：[`contract-store.ts`](../mcp-server/src/contract-store.ts) 根据指定的版本选择器（`vendor`/`latest`/`installed`/具体版本号），从本地缓存或 vendor 兜底目录中加载对应的合约。

5. **合约适配**：[`hugo-ui-mui.ts`](../mcp-server/src/contract-adapters/hugo-ui-mui.ts) 把 hugo-ui 发布的合约格式转换成校验器内部使用的格式，同时保留原始合约数据以便溯源。

6. **模式合约补充**：[`modal-form.pattern.json`](../contracts/patterns/modal-form.pattern.json) 为弹窗表单这类页面模式提供额外的结构约束和代码生成指引。

7. **上下文打包**：[`tools.ts`](../mcp-server/src/tools.ts) 把标准化后的设计数据、映射关系、已解析的合约、token 策略、模式合约整合在一起，生成一份完整的上下文数据包。

8. **输出上下文包**：运行 `npm run context:pack` 会生成 [`edit-profile-modal.context-pack.json`](../generated/edit-profile-modal.context-pack.json)，其中记录了完整的解析链路、合约版本、合约来源，以及预期要使用的组件清单。

9. **代码校验**：[`validator.ts`](../mcp-server/src/validator.ts) 根据上下文包来校验生成的 React 代码，检查项包括导入路径、props 合法性、禁用 props、原始颜色值、以及组件覆盖情况。

## 合约版本选择

设计系统的发布流程决定何时发布新的 AI 合约包。当代码生成规则、支持的 props、token 使用策略、校验规则或 AI 使用指引发生变化时，就需要发布新版本的合约。

本仓库支持以下版本选择器：

| 选择器 | 含义 |
|--------|------|
| `vendor` | 使用随仓库提交的兜底快照 |
| `latest` | 使用本地缓存或 vendor 中最新的版本 |
| `installed` | 读取本地 `@hugo-ui/mui` 包的版本号，选择不高于该版本的最新合约 |
| 具体版本号（如 `1.0.5`） | 选择不高于指定版本的最新本地合约 |

运行 `npm run contract:sync:hugo-ui` 时会使用相同的版本解析逻辑从 GitHub Releases 下载合约，校验 checksum，解压到 `.cache/` 目录，并检查 `provenance.json` 溯源信息，确认无误后才会被运行时工具使用。

## MCP 运行时

`npm run mcp:server`、`npm run mcp:http` 和 `npm run mcp:https` 共用同一个服务工厂和工具注册逻辑，区别只在于传输协议和 TLS 终止的位置：

- **stdio**：用于本地 MCP 客户端调试
- **Streamable HTTP**：用于基于 HTTP 的客户端和网关
- **Node HTTPS**：用于需要由本进程直接处理 TLS 的部署环境

服务暴露一组上下文工具和校验工具（完整列表见 [README](../README.zh-CN.md#通过-stdio-运行-mcp-服务)）。

在内部环境部署时，建议把 HTTP/HTTPS 入口放在平台网关后面，由平台负责认证、授权、请求日志和密钥管理。设置 `MCP_AUTH_MODE=external` 可以在健康检查和日志中标记认证由上游处理。`MCP_ALLOWED_HOSTS` 和 `MCP_ALLOWED_ORIGINS` 用于限制 Host 请求头和浏览器来源。

> 💡 详细的配置选项、环境变量、证书设置请参阅主 [README](../README.zh-CN.md)。

## 校验规则

校验是生成代码被展示为可用结果前的最后一道关卡。校验器会检查：

- 组件是否从合约指定的包导入
- JSX 上使用的 props 是否都在组件合约中声明
- 是否使用了被禁用的 props
- 生成的代码是否覆盖了上下文包中预期要用到的所有组件
- 是否包含 `#FF0000`、`rgb(...)`、`hsl(...)` 这类硬编码的原始颜色值

校验失败会以结构化报告的形式返回，本地命令和 MCP 客户端可以直接展示这些报告。

## 接入真实设计流程的扩展点

当前基于 fixture 的路径可以很自然地映射到真实的内部工作流，需要替换或扩展的点包括：

1. 用内部 Figma MCP 服务或设计采集服务提供的设计数据源替代 fixture 读取器
2. 由设计系统或设计平台工作流来发布组件映射产物
3. 在安装、部署或进程启动阶段同步合约
4. 代码生成保持在调用方的 AI 应用中完成
5. 生成的代码先送入 `validate_generated_code` 校验，再进入评审或交付环节

## 合约适配器

[hugo-ui-mui.ts](file:///Users/xuhaoze/code-demo/figma-contract-mcp-demo/mcp-server/src/contract-adapters/hugo-ui-mui.ts) 负责把 hugo-ui 发布的合约格式转换为校验器内部使用的表示形式，同时始终保留原始合约数据和溯源信息。这样每一条校验结果都可以追溯到具体发布的合约版本。
