# Hugo UI AI Component Contracts

This directory contains machine-readable component contracts for AI agents, MCP tools, and
validators that need to generate or check Hugo UI usage.

An AI component contract describes how a public component should be imported and used. It includes
the public import name, source evidence, props, examples, design mappings, token policy,
accessibility rules, generation rules, validation rules, and review status.

These contracts are not Figma Code Connect, do not publish anything to Figma, and do not replace
the React component source. The source package remains the implementation source of truth.

## Current Scope

The first phase covers `@hugo-ui/mui` only:

- `Button`
- `Input`
- `Modal`

`@hugo-ui/shadcn` is intentionally not covered in this phase.

## Generate And Validate

From the repository root, run:

```bash
./scripts/codex-node.sh pnpm run contract:generate:mui
./scripts/codex-node.sh pnpm run contract:validate:mui
```

To regenerate and validate in one step:

```bash
./scripts/codex-node.sh pnpm run contract:check:mui
```

`contract:generate:mui` writes contract artifacts only when stable contract content changes. Volatile
provenance fields such as `generatedAt` and `sourceCommit` are preserved when they are the only
differences, so repeated generation does not dirty the workspace.

`contract:check:mui` is a read-only drift check. It regenerates the expected artifacts in memory,
compares them with the checked-in files while ignoring volatile provenance fields, and then runs the
validator.

To package the generated MUI contract as a downstream-consumable artifact:

```bash
./scripts/codex-node.sh pnpm run contract:pack:mui
```

The pack command writes ignored local files under `dist/ai-contract/`:

```text
hugo-ui-mui-ai-contract-v<contractVersion>.tgz
hugo-ui-mui-ai-contract-v<contractVersion>.tgz.sha256
```

The tarball expands to:

```text
manifest.json
schema/
components/
tokens/
metadata/
provenance.json
README.md
```

The generator reads the real `@hugo-ui/mui` package manifest, public exports, component props,
Storybook stories, tests, and theme token files. The manual metadata files in
`ai-contract/packages/mui/metadata/components/` provide AI-specific guidance that TypeScript cannot
reliably infer.

## GitHub Release Artifact

`.github/workflows/mui-ai-contract.yml` generates, validates, drift-checks, typechecks, packs, and
uploads the MUI AI contract as a CI artifact.

When a tag matching `mui-ai-contract-v*` is pushed, the workflow publishes the packed `.tgz` and
`.tgz.sha256` files as GitHub Release assets. The tag suffix becomes the contract artifact version:
`mui-ai-contract-v0.1.0` publishes `hugo-ui-mui-ai-contract-v0.1.0.tgz`, and the workflow checks
that `provenance.json` uses the same `contractVersion`. This does not publish an npm package.

## Downstream Consumption

A downstream Figma/MCP demo should copy or sync these generated files:

- `ai-contract/packages/mui/manifest.json`
- `ai-contract/packages/mui/components/*.contract.json`
- `ai-contract/packages/mui/tokens/token-map.contract.json`

The downstream sync should record:

- source repository
- source commit
- package version
- sync time
- contract artifact version

The MUI manifest is the entry point for consumers:

```text
ai-contract/packages/mui/manifest.json
```
