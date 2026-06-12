# Architecture Notes

## Intent

This repository demonstrates the consumer side of a contract-first design-to-code workflow for AI tooling. The main point is not visual fidelity. The point is to make design and component context explicit, queryable, versioned, and validateable before generated React usage is trusted.

## Repository Relationship

`hugo-ui` owns the real design-system source and publishes a versioned `@hugo-ui/mui` AI contract artifact through GitHub Releases.

`figma-contract-mcp-demo` vendors one released artifact snapshot under `vendor/hugo-ui/mui-ai-contract/` and uses it as the contract source for MCP context and validation.

## Contract Directory Boundaries

`vendor/hugo-ui/mui-ai-contract/` is the only source for component contracts and token contracts in the main chain.

`contracts/` is reserved for local demo pattern contracts, currently `contracts/patterns/modal-form.pattern.json`. It must not contain shadow component contracts or token maps, because those would compete with the vendored `@hugo-ui/mui` artifact and make validation provenance ambiguous.

## Context Flow

1. `vendor/hugo-ui/mui-ai-contract/` contains the committed release artifact snapshot, including `manifest.json`, component contracts, tokens, metadata, schema files, and `provenance.json`.
2. `fixtures/figma/raw/edit-profile-modal.figma-file.mock.json` is a local Figma API-shaped snapshot mock with a `DOCUMENT` tree, a `CANVAS`, typed `componentProperties`, `componentId` references, text layers, component metadata, component set metadata, and style metadata.
3. `scripts/normalize-figma-fixture.ts` deterministically converts the raw snapshot mock into the smaller fixture shape consumed by the demo tools.
4. `fixtures/figma/edit-profile-modal.fixture.json` captures a single normalized local Figma-like frame while preserving source traceability back to the raw mock.
5. `code-connect/manifest.json` maps selected design node IDs to `@hugo-ui/mui` component names and vendor contract files.
6. `code-connect/mock/` contains documentation-only Code Connect template shape mocks for `Modal`, `Input`, and `Button`. They are not part of the executable chain and must not be published.
7. `mcp-server/src/contract-adapters/hugo-ui-mui.ts` adapts the real `hugo-ui` contract shape into the validator's internal format while preserving raw contract data.
8. `contracts/patterns/modal-form.pattern.json` describes page-level structure and generation rules for the local fixture.
9. `mcp-server/src/tools.ts` reads the normalized fixture, mapping, vendor snapshot, and pattern contract to build generation context.
10. `generated/edit-profile-modal.context-pack.json` records the resolved chain and expected component usage.
11. `mcp-server/src/validator.ts` validates generated React usage against imports, props, forbidden props, raw colors, and expected mapped component coverage. Coverage validation requires `expectedComponentUsage` from the context pack.
12. `scripts/audit-generated-output.ts` records a validation audit for a captured candidate, including candidate/context hashes and static-sample similarity.
13. `demo-app/` visualizes the same chain for humans.

## Generation Provenance

The validator proves contract conformance, not authorship. A candidate can pass validation whether it was generated live, copied from a file, or written by hand.

For demo provenance, use `npm run audit:generated` after a captured Codex MCP run. The deterministic audit report binds the candidate code to a specific context pack hash, includes the validator result, and records similarity against committed static samples. This makes the run easier to inspect without claiming cryptographic proof of model intent.

## Why The MCP Server Is Thin

The MCP server should only expose context and validation tools. It should not call an LLM, fetch remote design data, or mutate files during normal tool calls. This keeps the architecture understandable: generation can happen in an external AI tool, while this server supplies bounded context and checks the generated result.

## Contract Adapter Shape

The real `hugo-ui` contracts contain:

- `props[]`
- `props[].aiUsage`
- `props[].required`
- `forbiddenProps`
- `discouragedProps`
- `generationRules`
- `validationRules`
- `tokenPolicy`

The adapter converts these into the internal validator shape:

- `allowedProps`
- `requiredProps`
- `forbiddenProps`
- `discouragedProps`
- `conditionalProps`
- `policy`
- `rawContract`

The internal shape is an implementation detail. The context pack should retain enough raw contract and provenance data to trace validation decisions back to the published artifact.

## Limitations

This demo does not parse arbitrary Figma documents, publish Code Connect metadata, require a live `@hugo-ui/mui` npm install, or guarantee production-ready React. It uses a local Figma API-shaped raw mock, a deterministic normalization step, a local Code Connect-style manifest, and a vendored AI contract snapshot to show an architecture pattern.
