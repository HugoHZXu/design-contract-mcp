# Design Contract MCP

[English](README.md) | [简体中文](README.zh-CN.md)

> 📋 **Note.** This is a Figma-to-Code MCP server that generates React code from Figma designs using a design system's AI contract.
> The MCP logic is largely complete. The repository currently uses local mock data shaped to match real Figma MCP output and Code Connect mappings, because we have not yet had the opportunity to wire it up against a live Figma environment for integration testing.

Design Contract MCP is a **contract-first Figma-to-Code MCP**. Once your component library is connected to Figma via Code Connect, this MCP can:

1. Fetch design data for a selected frame through the Figma MCP
2. Load the AI contract artifact generated from your component library
3. Map Figma components to their corresponding implementation components
4. Build a generation context pack with design data, component contracts, tokens, and pattern rules
5. Guide AI code generation using the contract, and validate the generated React code against it
6. Return structured generation context and validation reports

This repository implements the complete MCP logic end-to-end. The MCP has not yet been wired up against a live Figma MCP endpoint or real Code Connect data for integration testing, so the repository uses local fixtures that closely mirror the shape of real Figma MCP output and Code Connect mappings. This lets us validate the full contract resolution → context building → validation pipeline locally, with the goal of swapping in real Figma/Code Connect data sources later with minimal changes.

This project pairs with the [`hugo-ui`](https://github.com/HugoHZXu/hugo-ui) design system repository:

- **[`hugo-ui`](https://github.com/HugoHZXu/hugo-ui)** maintains the `@hugo-ui/mui` component library source and publishes versioned AI contract artifacts through GitHub Releases.
- **Design Contract MCP** (this repo) fetches design data, resolves component mappings, loads AI contracts, builds generation context, and validates generated React code.

## What It Does

Using the included Edit Profile Modal example (with local mock data standing in for live Figma data), you can walk through the complete pipeline:

1. **Normalize** Figma MCP-shaped tool output into a compact local design fixture (mock data is used for now).
2. **Resolve** node-to-component mappings from a Code Connect-style manifest.
3. **Load** component contracts and token policies from a verified `@hugo-ui/mui` AI contract artifact.
4. **Build** a context pack that combines design data, mapping metadata, contracts, tokens, pattern rules, and expected component usage.
5. **Validate** generated React against import packages, allowed props, forbidden props, mapped component coverage, and raw color literals.
6. **Return** structured generation context and validation reports that an AI coding agent or downstream application can consume.

## Architecture Overview

The target workflow connects to live Figma and Code Connect:

```text
Component library (hugo-ui)
  publishes AI contract via GitHub Release
        │
        ▼
AI contract artifact  ◄───── Code Connect maps Figma ↔ components
        │                        ▲
        ▼                        │
Design Contract MCP ──► fetches frame data via Figma MCP
        │              (mocked with local fixtures today)
        ▼
Generation context pack (design + mappings + contracts + tokens)
        │
        ▼
AI coding agent generates React
        │
        ▼
Validator checks imports, props, coverage, raw colors
        │
        ▼
Validated React code
```

Today, Figma MCP data and Code Connect mappings are mocked with local fixtures under `fixtures/figma/` and `code-connect/` so the entire MCP pipeline can run end-to-end without a live Figma connection. The AI contract itself is real — it uses an actual `@hugo-ui/mui` contract snapshot, either from the committed vendor fallback or a locally cached GitHub Release artifact.

For detailed architecture notes, see [docs/architecture.md](docs/architecture.md) ([简体中文](docs/architecture.zh-CN.md)).
For the path from this current state to a production deployment, see [docs/mvp-to-product.md](docs/mvp-to-product.md) ([简体中文](docs/mvp-to-product.zh-CN.md)).

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Run the demo

```bash
# Install dependencies
npm install

# Verify the vendored hugo-ui contract integrity
npm run contract:verify:hugo-ui

# Normalize the captured Figma data
npm run figma:normalize

# Build the generation context pack
npm run context:pack

# Validate the passing sample (should report success)
npm run validate

# Validate the failing sample (should report failures, demonstrating negative cases)
npm run validate:bad
```

After running these commands, check the `generated/` directory to see the context pack, sample code, and validation reports.

## Connecting to Live Figma

Currently, the repository uses local mock fixtures that mirror the shape of real Figma MCP output and Code Connect mappings, so you can run the complete pipeline without any Figma access. To connect to a live Figma workflow once Code Connect is set up for your component library:

1. Replace the fixture reader with a real Figma MCP client that fetches frame data from Figma.
2. Replace the static `code-connect/manifest.json` with the actual Code Connect mapping data published from your design system.
3. Sync the appropriate `@hugo-ui/mui` AI contract version (matching what's published with the component library).
4. The MCP server logic — context building, contract adaptation, validation — requires no changes.
5. An AI coding agent calls `build_generation_context` to get the full context, generates React using the contract guidance, then calls `validate_generated_code` to verify the output.

> 💡 The MCP server is designed around **context resolution and validation only**. It does not call LLMs or generate code itself — that responsibility stays with the AI coding client that calls this MCP.

## Managing hugo-ui Contract Versions

The committed vendor snapshot at `vendor/hugo-ui/mui-ai-contract/` is a reproducible fallback. Runtime tools can also read release artifacts unpacked into `.cache/hugo-ui/mui-ai-contract/<version>/`.

**Check the local contract store:**

```bash
npm run contract:status:hugo-ui
```

**List published `mui-ai-contract-v*` releases from `HugoHZXu/hugo-ui`:**

```bash
npm run contract:list:hugo-ui
```

**Sync a contract artifact to local cache.** The `installed` selector reads the local `@hugo-ui/mui` package version and picks the newest contract release whose version is ≤ that package version:

```bash
npm run contract:sync:hugo-ui -- --version installed
```

Other supported selectors:

```bash
npm run contract:sync:hugo-ui -- --version latest
npm run contract:sync:hugo-ui -- --version 1.0.2
npm run contract:sync:hugo-ui -- --tag mui-ai-contract-v1.0.2
```

The sync script downloads `hugo-ui-mui-ai-contract-v<version>.tgz`, verifies the matching `.tgz.sha256`, extracts the snapshot into `.cache/hugo-ui/mui-ai-contract/<version>/`, checks required files, and reads `provenance.json`.

The sync script verifies that the release tag, artifact filename, and `provenance.contractVersion` all agree. For example, tag `mui-ai-contract-v<version>` should contain `hugo-ui-mui-ai-contract-v<version>.tgz`, and the extracted provenance should report `contractVersion: "<version>"`; mismatches will cause the sync to fail.

For local release development, the script can also consume an already-downloaded artifact:

```bash
npm run contract:sync:hugo-ui -- \
  --from-file /path/to/hugo-ui-mui-ai-contract-v<version>.tgz
```

Set `HUGO_UI_CONTRACT_VERSION` to choose the default runtime contract source. Supported values are `vendor`, `latest`, `installed`, or a semver target such as `1.0.2`. Runtime resolution checks the committed vendor snapshot and local cache.

## Running the MCP Server

### stdio (local debugging)

```bash
npm run mcp:server
```

For manual local debugging, or when configuring a local MCP client, you can start the server process directly:

```bash
./node_modules/.bin/tsx mcp-server/src/server.ts
```

The stdio server exposes these tools:

- `get_design_context(frameId)`
- `get_code_connect_map(nodeId)`
- `get_component_contract(componentName, contractVersion?)`
- `build_generation_context(frameId, contractVersion?)`
- `validate_generated_code(code, expectedComponentUsage, contractVersion?)`
- `get_contract_status()`

### Streamable HTTP

```bash
npm run mcp:http
```

The HTTP entrypoint listens on `127.0.0.1:3000` by default and exposes:

- `POST /mcp` — MCP Streamable HTTP endpoint
- `GET /healthz` — health check

Key configuration variables:

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

For most internal deployments, terminate TLS and enforce authentication at the platform, load balancer, or reverse proxy, then forward to the Node process over HTTP. `MCP_AUTH_MODE=external` indicates authentication is handled upstream. `HUGO_UI_CONTRACT_SYNC=startup` performs one GitHub Release sync when the process starts; MCP requests then read from the local cache.

### Node HTTPS (direct TLS termination)

For environments where this process terminates TLS itself:

```bash
npm run mcp:https
```

Required certificate configuration:

```bash
MCP_HTTPS_KEY_FILE=/path/to/server.key
MCP_HTTPS_CERT_FILE=/path/to/server.crt
MCP_HTTPS_HOST=127.0.0.1
MCP_HTTPS_PORT=3443
```

Certificate material can come from raw environment variables, Base64-encoded variables, or file paths:

```bash
MCP_HTTPS_KEY="-----BEGIN PRIVATE KEY-----..."
MCP_HTTPS_CERT="-----BEGIN CERTIFICATE-----..."
MCP_HTTPS_KEY_BASE64=...
MCP_HTTPS_CERT_BASE64=...
MCP_HTTPS_KEY_FILE=/path/to/server.key
MCP_HTTPS_CERT_FILE=/path/to/server.crt
MCP_HTTPS_CA="-----BEGIN CERTIFICATE-----..."
MCP_HTTPS_CA_FILE=/path/to/ca.crt
MCP_HTTPS_CA_BASE64=...
MCP_HTTPS_PASSPHRASE=...
```

The HTTPS entrypoint shares the same handler, cache resolver, health check, logging, host validation, and auth modes as the HTTP entrypoint.

MCP logs are written to stderr as JSON lines. Supported `MCP_LOG_LEVEL` values are `debug`, `info`, `warn`, `error`, and `silent`.

## Local CLI Commands

You can also run the tools directly from the command line without starting an MCP server.

**Normalize the captured Figma MCP result:**

```bash
npm run figma:normalize
```

**Generate the context pack used by the validator:**

```bash
npm run context:pack
```

> 💡 `npm run context:pack` automatically runs `npm run figma:normalize` first, so the committed normalized fixture always stays derived from the capture fixture.

**Build generation context:**

```bash
npm run mcp:context
```

**Build context against a specific contract version:**

```bash
./node_modules/.bin/tsx mcp-server/src/local-cli.ts \
  build-generation-context frame-edit-profile \
  --contract-version latest
```

**Read design context:**

```bash
npm run mcp:design
```

**Validate the passing sample:**

```bash
npm run validate
```

**Validate the failing sample:**

```bash
npm run validate:bad
```

`npm run validate` asserts the sample is valid; `npm run validate:bad` asserts the invalid sample remains invalid. CI will fail if the negative sample accidentally starts passing, which protects against validator regressions.

## Validation Scope

The validator checks for the following:

- Whether mapped components are imported from their contract-specified packages
- Whether all JSX props are listed in the adapted component contract
- Forbidden prop usage
- Whether generated JSX covers all expected mapped components from the context pack
- Raw color literals such as `#FF0000`, `rgb(...)`, or `hsl(...)`

It adapts the real `hugo-ui` contract shape (`props[]`, `forbiddenProps`, `discouragedProps`, `generationRules`, `validationRules`, `tokenPolicy`) into the internal validator format. The context pack retains raw contract data for source traceability.

> 💡 TypeScript compilation, visual regression, accessibility checks, and production policy enforcement should be added in the downstream generation pipeline.

## Trace Walkthrough

Let's walk through the chain using the "first name" input field in the Edit Profile Modal example:

1. **Capture fixture** — [edit-profile-modal.mcp-context.json](file:///Users/xuhaoze/code-demo/figma-contract-mcp-demo/fixtures/figma/mcp/edit-profile-modal.mcp-context.json) stores the raw Figma MCP result.
2. **Normalized fixture** — `npm run figma:normalize` produces [edit-profile-modal.fixture.json](file:///Users/xuhaoze/code-demo/figma-contract-mcp-demo/fixtures/figma/edit-profile-modal.fixture.json), preserving node IDs, component IDs, typed properties, layout data, Code Connect snippets, and text values.
3. **Design node** — The normalized fixture contains `node-input-first-name`, an `Input/Text` instance with label and sample value text carried over from the Code Connect context.
4. **Mapping** — [manifest.json](file:///Users/xuhaoze/code-demo/figma-contract-mcp-demo/code-connect/manifest.json) maps `node-input-first-name` to `Input` from `@hugo-ui/mui` and points to the corresponding contract file.
5. **Contract** — The vendored `Input` contract defines the import package, prop list, AI usage policy, discouraged props, generation rules, validation rules, and token policy.
6. **Adapter** — [hugo-ui-mui.ts](file:///Users/xuhaoze/code-demo/figma-contract-mcp-demo/mcp-server/src/contract-adapters/hugo-ui-mui.ts) converts the real contract shape into the internal validator format while preserving raw contract and policy metadata.
7. **Context pack** — `npm run context:pack` writes [edit-profile-modal.context-pack.json](file:///Users/xuhaoze/code-demo/figma-contract-mcp-demo/generated/edit-profile-modal.context-pack.json), combining the fixture, mappings, contracts, token policy, pattern rules, provenance, and expected component usage.
8. **Generated JSX** — [edit-profile-modal.generated.tsx](file:///Users/xuhaoze/code-demo/figma-contract-mcp-demo/generated/edit-profile-modal.generated.tsx) imports `Button`, `Input`, and `Modal` from `@hugo-ui/mui`.
9. **Validation** — `npm run validate` checks the JSX against adapted contracts and expected usage. The passing sample covers `Modal ×1`, `Input ×2`, and `Button ×2`.

To see validation failures in action (bad imports, invalid props, raw colors, missing components), run:

```bash
npm run validate:bad
```

## Project Structure

```text
fixtures/figma/mcp/                     Captured Figma MCP-shaped tool-result fixtures
fixtures/figma/                         Normalized Figma-like JSON data
code-connect/manifest.json              Contract-enriched node-to-component mapping
code-connect/mock/                      Code Connect template shape mocks
.cache/hugo-ui/mui-ai-contract/         Runtime cache for synced contract artifacts (gitignored)
vendor/hugo-ui/mui-ai-contract/         Vendored @hugo-ui/mui AI contract fallback snapshot
contracts/patterns/                     Page-level pattern contracts
mcp-server/                             MCP server core (stdio/HTTP/HTTPS entries, adapter, CLI, validator)
generated/                              Static samples, context pack, and validation reports
docs/                                   Architecture and product direction notes
scripts/normalize-figma-fixture.ts      Figma MCP capture → normalized fixture converter
scripts/hugo-ui-contract.ts             Contract listing, sync, status, and verification CLI
scripts/sync-hugo-ui-contract.mjs       Legacy sync script kept for reference
```

## License

MIT. See [LICENSE](LICENSE).
