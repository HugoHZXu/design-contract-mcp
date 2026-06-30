# From Mock Data To Production

[English](mvp-to-product.md) | [简体中文](mvp-to-product.zh-CN.md)

This document describes how to evolve this MCP from its current state (running against local mock fixtures that mirror real Figma MCP and Code Connect data shapes) into a production Figma-to-Code workflow connected to live Figma. The core pieces stay the same throughout: design context, component mapping, versioned AI contracts, generation context, code generation guidance, and validation feedback.

---

## 1. Design Ingestion

### Current State

The repository ships with a captured Figma MCP fixture under [fixtures/figma/mcp/](file:///Users/xuhaoze/code-demo/figma-contract-mcp-demo/fixtures/figma/mcp/). Running `npm run figma:normalize` uses [normalize-figma-fixture.ts](file:///Users/xuhaoze/code-demo/figma-contract-mcp-demo/scripts/normalize-figma-fixture.ts) to convert that capture into [edit-profile-modal.fixture.json](file:///Users/xuhaoze/code-demo/figma-contract-mcp-demo/fixtures/figma/edit-profile-modal.fixture.json), which is the normalized input shape consumed by the MCP tools.

### Product Path

In a real workflow, you'd provide that same normalized shape from an internal design source rather than static fixtures. Potential sources include:

- An internal Figma MCP service
- A controlled design-ingestion service
- Cached snapshots for selected frames or nodes
- Stable frame/node identifiers
- Freshness metadata for design snapshots (to tell users when a design was last updated)
- Clear, user-facing error messages when files, frames, or nodes are inaccessible

This way, MCP context tools can consume authorized design context without needing direct Figma workspace access themselves.

---

## 2. Component Mapping

### Current State

[code-connect/manifest.json](file:///Users/xuhaoze/code-demo/figma-contract-mcp-demo/code-connect/manifest.json) maps selected design node IDs to `@hugo-ui/mui` component names and contract file paths. The [code-connect/mock/](file:///Users/xuhaoze/code-demo/figma-contract-mcp-demo/code-connect/mock/) directory provides local Code Connect template examples for `Modal`, `Input`, and `Button`.

### Product Path

In production, the mapping source should be owned and maintained by the design-system or design-platform team. Depending on your team's setup, this could be official Code Connect, an internal component registry, or an auto-generated mapping artifact.

Useful capabilities to add:

- **Versioned mapping artifacts** published alongside the design system, so mappings stay in sync with component versions
- Validation that mapping entries only reference components that actually exist in the AI contract manifest
- Automatic detection of stale or missing mappings
- Support for multiple packages or component namespaces
- Deprecation flags and alias metadata to support component migrations

---

## 3. AI Contract Management

### Current State

The committed fallback lives at [vendor/hugo-ui/mui-ai-contract/](file:///Users/xuhaoze/code-demo/figma-contract-mcp-demo/vendor/hugo-ui/mui-ai-contract/). Runtime tools can also read contract artifacts that have been synced into `.cache/hugo-ui/mui-ai-contract/<version>/`.

The sync command (`npm run contract:sync:hugo-ui`) fetches GitHub Release artifacts, verifies checksums, unpacks them, and checks `provenance.json` for validity. Runtime MCP tools resolve contracts from local cache first, falling back to the vendor snapshot.

Supported version selectors:
- `vendor` — use the committed fallback snapshot
- `latest` — use the newest available version
- `installed` — match against the local `@hugo-ui/mui` package version
- Explicit semver (e.g. `1.0.2`)

### Product Path

In an internal product, the design-system release pipeline should publish **immutable** AI contract artifacts to a durable artifact store — S3, GCS, OSS, an internal package registry, or whichever approved artifact repository your organization uses.

The recommended synchronization model:

```text
Design system release
  → Publish immutable contract artifact + checksum
  → Update artifact index
Deployment pipeline or init step
  → Select supported contract versions
  → Download and verify artifacts
  → Unpack into local read-only cache
MCP runtime
  → Resolve contracts from local cache
```

Capabilities worth adding:

- An artifact index that tracks which versions are supported, latest, and deprecated
- Sync by explicit version, version range, or supported set
- Retention/cleanup rules for old local cache entries (prevent unbounded growth)
- Object-storage artifact sources in addition to GitHub Releases
- Deployment checks that required contract versions are present and ready
- Clear release criteria: publish a new AI contract whenever generated code shape, supported props, token policy, or validation rules change

---

## 4. MCP Deployment

### Current State

The repository supports three MCP entrypoints:

- `npm run mcp:server` — stdio for local debugging
- `npm run mcp:http` — Streamable HTTP
- `npm run mcp:https` — Node-managed TLS for environments that need it

HTTP and HTTPS share the same server factory, request handler, contract resolver, health check, host filtering, browser-origin filtering, and structured stderr logs. `MCP_AUTH_MODE=external` signals that authentication is handled by an upstream platform component.

### Product Path

For internal use, the server typically sits behind an enterprise gateway, internal platform, allowlisted cloud service, or private network boundary. That platform layer usually owns TLS termination, authentication, authorization, request logging, secret management, log retention, and policy integration.

Once you have a deployment target in mind, useful additions include:

- A Dockerfile and deployment example for that specific environment
- A startup or init step that handles contract synchronization automatically
- Readiness checks that confirm required contract versions are loaded before serving traffic
- Platform-specific log and metrics integration
- Explicit allowlists for hosts and browser origins
- Smoke tests against the deployed endpoint

---

## 5. Validation And User Feedback

### Current State

The validator checks generated React against the resolved component contracts and expected component usage from the context pack. It reports:

- Import package mismatches
- Props that aren't in the adapted contract
- Forbidden prop usage
- Missing mapped component coverage
- Raw color literals

Local validation commands and MCP validation responses expose the full chain: design → mapping → contract → code → validation result.

### Product Path

Building on the same contract-first foundation, a real internal product can layer in richer validation and review signals:

- TypeScript compilation and lint checks for generated code
- Accessibility (a11y) checks for supported patterns
- Visual regression checks for selected high-value workflows
- Centrally retained validation records when platform policy requires audit trails
- User-facing explanations that connect each validation failure back to the specific source contract, mapping, or pattern rule that triggered it
- Review queues for frames that lack mapping coverage or have stale mappings

---

## Implementation Sequence

Here's a practical, incremental path from the current mock-data setup to a production Figma-to-Code workflow:

1. **Keep the mock pipeline** — Retain the local fixtures as a reproducible test baseline for the MCP logic.
2. **Abstract the data source** — Add a design context provider interface alongside the fixture reader, so swapping in a real Figma MCP client requires minimal changes.
3. **Wire up real Code Connect mappings** — Replace the static manifest with real Code Connect mapping data published from the design system.
4. **Automate contract sync** — Move contract synchronization into setup, deployment, or process startup so it happens automatically.
5. **Deploy behind your platform** — Put the HTTP or HTTPS MCP entrypoint behind your internal platform/gateway.
6. **Add downstream checks** — Layer in TypeScript, accessibility, and visual checks at the point where generated React enters review.

Throughout all these stages, the core MCP workflow stays the same: resolve design context, map it to component contracts, build a generation context pack, guide code generation via the contract, and validate the result. Keeping this chain clear and explicit is what makes the whole system maintainable as it grows.
