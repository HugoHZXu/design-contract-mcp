# Hugo UI AI Component Contracts

> 📦 **This is a vendored snapshot** of the `@hugo-ui/mui` AI contract artifact, consumed by the Design Contract MCP demo.
> Contract generation, validation, and packaging commands listed below are run in the [`hugo-ui`](https://github.com/HugoHZXu/hugo-ui) repository, not in this demo repository.

This directory contains machine-readable component contracts for AI agents, MCP tools, and validators that need to generate or check Hugo UI component usage.

An AI component contract describes how a public component should be imported and used. It includes the public import name, source evidence, props, examples, design mappings, token policy, accessibility rules, generation rules, validation rules, and review status.

These contracts are not Figma Code Connect, do not publish anything to Figma, and do not replace the React component source. The source package (`@hugo-ui/mui`) remains the implementation source of truth.

## Current Scope

This snapshot covers `@hugo-ui/mui` with three components:

- `Button`
- `Input`
- `Modal`

`@hugo-ui/shadcn` is intentionally not covered in this phase.

---

## Contract Generation and Packaging (in hugo-ui repo)

The following commands are run in the [`hugo-ui`](https://github.com/HugoHZXu/hugo-ui) repository to produce the contract artifacts you see here. They are documented for reference.

From the hugo-ui repository root:

```bash
./scripts/codex-node.sh pnpm run contract:generate:mui
./scripts/codex-node.sh pnpm run contract:validate:mui
```

To regenerate and validate in one step:

```bash
./scripts/codex-node.sh pnpm run contract:check:mui
```

`contract:generate:mui` writes contract artifacts only when stable contract content changes. Volatile provenance fields such as `generatedAt` and `sourceCommit` are preserved when they are the only differences, so repeated generation does not dirty the workspace.

`contract:check:mui` is a read-only drift check. It regenerates the expected artifacts in memory, compares them with the checked-in files while ignoring volatile provenance fields, and then runs the validator.

To package the generated MUI contract as a downstream-consumable artifact:

```bash
./scripts/codex-node.sh pnpm run contract:pack:mui
```

The pack command writes local files under `dist/ai-contract/` (gitignored):

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

The generator reads the real `@hugo-ui/mui` package manifest, public exports, component props, Storybook stories, tests, and theme token files. Manual metadata files under `ai-contract/packages/mui/metadata/components/` provide AI-specific guidance that TypeScript cannot reliably infer.

---

## GitHub Release Artifact

In the hugo-ui repository, `.github/workflows/mui-ai-contract.yml` generates, validates, drift-checks, typechecks, packs, and uploads the MUI AI contract as a CI artifact.

When a tag matching `mui-ai-contract-v*` is pushed, the workflow publishes the packed `.tgz` and `.tgz.sha256` files as GitHub Release assets. The tag suffix becomes the contract artifact version: `mui-ai-contract-v0.1.0` publishes `hugo-ui-mui-ai-contract-v0.1.0.tgz`, and the workflow checks that `provenance.json` uses the same `contractVersion`. This does not publish an npm package.

## Downstream Consumption (this demo)

A downstream consumer (such as this Design Contract MCP demo) syncs or copies these published files:

- `manifest.json`
- `components/*.contract.json`
- `tokens/token-map.contract.json`

The downstream sync records provenance information:

- source repository
- source commit
- package version
- sync time
- contract artifact version

The MUI manifest ([manifest.json](manifest.json)) is the entry point for consumers — it lists all available components and points to their individual contract files.

---

## Verifying This Vendored Snapshot

From the root of this demo repository, you can verify the integrity of this vendored snapshot:

```bash
npm run contract:verify:hugo-ui
```

To sync a different contract version from GitHub Releases into the local cache, see the main [README](../../README.md#managing-hugo-ui-contract-versions).
