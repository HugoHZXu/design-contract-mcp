# AGENTS.md

## Project Identity

This repository is an architecture demo for a contract-first design-to-code workflow.

It is not a complete Figma-to-code product, not a production code generator, and not a general-purpose design renderer. The goal is to show how an AI tool can consume a published design-system AI contract artifact, combine it with captured design data and mapping metadata, build generation context, and validate generated React.

## Non-Negotiable Boundaries

- Do not claim this project supports arbitrary Figma files.
- Do not connect to the real Figma API unless a future task explicitly asks for an isolated experiment.
- Do not publish or integrate with official Figma Code Connect.
- Treat Code Connect-style files in this repo as local mock mapping metadata only.
- Do not connect to real business APIs.
- Do not turn the demo UI into a large marketing landing page.
- Do not put LLM calls inside the MCP server.
- Do not bypass the validator for generated React usage.
- Do not use local `../hugo-ui` paths, symlinks, or git submodules as the main integration path.
- Do not add fake `hugo-ui` contracts for components that are not present in the vendored artifact.

## Architecture Rules

- All design input must come from JSON fixtures under `fixtures/figma/`.
- Main-chain component knowledge must come from `vendor/hugo-ui/mui-ai-contract/`.
- The committed vendor snapshot must be verifiable with `npm run contract:verify:hugo-ui`.
- Design-to-component resolution must go through `code-connect/manifest.json`.
- Token usage for the main chain must be based on `vendor/hugo-ui/mui-ai-contract/tokens/`.
- Page-level generation assumptions must be represented as pattern contracts under `contracts/patterns/`.
- The MCP server must stay thin: it reads local JSON, resolves context, and validates generated code.
- The MCP server must adapt `hugo-ui` contracts through `mcp-server/src/contract-adapters/hugo-ui-mui.ts` instead of changing the vendored contract shape in place.
- Generated examples belong in `generated/`; they are samples, not authoritative source code.
- `generated/edit-profile-modal.context-pack.json` is the generated context pack for the demo chain.
- The demo UI should show the chain from design node to mapping to contract to generated code to validation report.

## Code Connect Policy

This repository uses a Code Connect-style manifest to demonstrate component mapping.

It must remain a local mock. Do not add scripts or documentation that imply:

- real Code Connect publishing,
- Figma organization membership requirements,
- remote component linking,
- support for live Figma files,
- or official Code Connect compatibility guarantees.

## MCP Server Policy

The MCP server exposes local context tools:

- `get_design_context(frameId)`
- `get_code_connect_map(nodeId)`
- `get_component_contract(componentName)`
- `build_generation_context(frameId)`
- `validate_generated_code(code, expectedComponentUsage)`

The server must not:

- call an LLM,
- mutate source files,
- fetch remote design data,
- infer hidden component APIs not present in contracts,
- or silently accept invalid generated code.

## Validator Policy

Generated React code must be checked with the validator before it is presented as usable.

The validator should stay intentionally simple for this demo. It checks:

- imports from the expected component package,
- allowed component props,
- forbidden component props,
- mapped component coverage against expected usage from the context pack,
- and raw color literals in generated code.

If generated code fails validation, the demo should show a fail report rather than hiding the issue.

## Vendor Snapshot Policy

The official refresh path is a GitHub Release artifact from the `hugo-ui` repository:

```bash
npm run contract:sync:hugo-ui -- \
  --repo <owner>/hugo-ui \
  --tag mui-ai-contract-v<version>
```

The sync script may support local `--from-file` for development convenience, but README and public setup instructions must present GitHub Releases as the formal source.

The vendor snapshot must include `provenance.json`, and provenance must identify:

- `sourcePackage`: `@hugo-ui/mui`
- `sourcePackagePath`: `packages/mui`
- `artifactFormat`: `hugo-ui-mui-ai-contract/v1`

## Documentation Policy

Documentation and AI-agent infrastructure content must be written in English.

README content must explain the architecture and limitations clearly. It must not overstate the project's capabilities, production readiness, or integration status with Figma or Code Connect.

## Demo UI Policy

The demo UI should be functional and focused. The first screen should be the architecture demo itself:

- left column: design tree,
- middle column: resolved mapping and component contract,
- right column: generated code and validation report.

Avoid marketing-style hero sections, broad product claims, or visual treatments that distract from the chain being demonstrated.

## Future Agent Checklist

Before changing behavior, verify:

1. The fixture still resolves through the Code Connect-style manifest.
2. Component names in generated samples match contract names.
3. `npm run contract:verify:hugo-ui` passes.
4. New generated props are present in the vendored contract before generated code uses them.
5. `npm run context:pack` regenerates the context pack successfully.
6. Raw color literals are rejected unless the validator rule is intentionally changed.
7. README limitations remain accurate after the change.
