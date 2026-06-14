import fs from "node:fs/promises";
import path from "node:path";
import {
  contractRelativePath,
  getContractStatus,
  resolveLocalContractSource,
  resolveMappedContractPath
} from "./contract-store";
import { fromRepoRoot } from "./paths";
import type {
  CodeConnectManifest,
  CodeConnectMapping,
  ComponentContract,
  DesignFrame,
  DesignNode,
  ExpectedComponentUsage,
  FigmaLikeFixture,
  PatternContract,
  TokenMapContract
} from "./types";
import {
  adaptHugoUIMuiContract,
  type HugoUIComponentContract
} from "./contract-adapters/hugo-ui-mui";
import { createLogger } from "./logger";
import { validateGeneratedCode } from "./validator";

const logger = createLogger("mcp-tools");

export async function getDesignContext(frameId: string) {
  const fixtures = await readDesignFixtures();

  for (const fixture of fixtures) {
    const frame = fixture.frames.find((candidate) => candidate.id === frameId);
    if (frame) {
      return {
        frameId,
        file: fixture.file,
        source: fixture.source,
        frame
      };
    }
  }

  throw new Error(`Design frame not found: ${frameId}`);
}

export async function getCodeConnectMap(nodeId: string) {
  const manifest = await readCodeConnectManifest();
  const mapping = manifest.mappings.find((candidate) => candidate.nodeId === nodeId);

  return {
    nodeId,
    componentPackage: manifest.componentPackage,
    mapping: mapping ?? null
  };
}

export async function getComponentContract(
  componentName: string,
  contractVersion?: string
) {
  const source = await resolveLocalContractSource(contractVersion);
  const manifest = await readHugoUiManifest(source.root);
  const manifestEntry = manifest.components.find(
    (component) => component.componentName === componentName
  );

  if (!manifestEntry) {
    throw new Error(`Component contract not found in hugo-ui snapshot: ${componentName}`);
  }

  return readAdaptedHugoUiContract(
    contractRelativePath(source, manifestEntry.contract),
    displayPath(contractRelativePath(source, manifestEntry.contract))
  );
}

export async function buildGenerationContext(
  frameId: string,
  contractVersion?: string
) {
  const contractSource = await resolveLocalContractSource(contractVersion);
  const designContext = await getDesignContext(frameId);
  const manifest = await readCodeConnectManifest();
  const tokenMap = await readJson<TokenMapContract>(
    contractRelativePath(contractSource, "tokens/token-map.contract.json")
  );
  const contractArtifact = {
    source: {
      selector: contractSource.selector,
      resolvedVersion: contractSource.version,
      kind: contractSource.kind,
      root: displayPath(contractSource.root)
    },
    manifest: await readHugoUiManifest(contractSource.root),
    provenance: await readJson<Record<string, unknown>>(
      contractRelativePath(contractSource, "provenance.json")
    )
  };
  const patterns = await readPatternContracts();
  const pattern = patterns.find((candidate) => candidate.frameIds.includes(frameId));
  const nodes = flattenDesignNodes(designContext.frame);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const mappings = manifest.mappings.filter((mapping) => nodeById.has(mapping.nodeId));
  const componentContracts = await readAllComponentContracts(contractVersion);
  const resolvedNodes = await Promise.all(
    mappings.map(async (mapping) => {
      const resolvedContractPath = resolveMappedContractPath(
        contractSource,
        mapping.contractPath
      );
      const displayContractPath = displayPath(resolvedContractPath);
      const contract = await readAdaptedHugoUiContract(
        resolvedContractPath,
        displayContractPath
      );
      return {
        node: nodeById.get(mapping.nodeId),
        mapping,
        resolvedContractPath: displayContractPath,
        contract: summarizeContract(contract)
      };
    })
  );
  const expectedComponentUsage: ExpectedComponentUsage[] = resolvedNodes.map(
    ({ node, mapping, resolvedContractPath }) => ({
      nodeId: mapping.nodeId,
      nodeName: node?.name ?? mapping.figmaNodeName,
      componentName: mapping.componentName,
      importName: mapping.importName,
      packageName: manifest.componentPackage,
      contractPath: resolvedContractPath,
      contractVersion: contractSource.version,
      contractSource: contractSource.kind
    })
  );

  return {
    frameId,
    design: designContext,
    codeConnect: {
      schemaVersion: manifest.schemaVersion,
      componentPackage: manifest.componentPackage,
      mappings
    },
    pattern: pattern ?? null,
    tokens: tokenMap,
    contractSource: {
      selector: contractSource.selector,
      resolvedVersion: contractSource.version,
      kind: contractSource.kind,
      root: displayPath(contractSource.root)
    },
    contractArtifact,
    componentContracts,
    expectedComponentUsage,
    resolvedNodes,
    generationChecklist: [
      "Use mapped components only.",
      "Use props from component contracts only.",
      "Use token references instead of raw colors.",
      "Run validate_generated_code on generated React."
    ]
  };
}

export async function validateGeneratedCodeTool(
  code: string,
  expectedComponentUsage?: ExpectedComponentUsage[],
  contractVersion?: string
) {
  const contracts = await readAllComponentContracts(
    contractVersion ?? inferContractVersion(expectedComponentUsage)
  );
  const report = validateGeneratedCode(code, contracts, { expectedComponentUsage });
  logger.info("Validation summary.", {
    valid: report.valid,
    violationCount: report.violations.length,
    expectedUsageCount: expectedComponentUsage?.length ?? 0,
    contractVersion:
      contractVersion ?? inferContractVersion(expectedComponentUsage) ?? "default",
    checks: Object.fromEntries(
      report.checks.map((check) => [check.id, check.status])
    )
  });

  return report;
}

export async function validateGeneratedFile(
  relativePath: string,
  expectedComponentUsage?: ExpectedComponentUsage[],
  contractVersion?: string
) {
  const code = await fs.readFile(fromRepoRoot(relativePath), "utf8");
  return validateGeneratedCodeTool(code, expectedComponentUsage, contractVersion);
}

export async function readContextPack(relativePath: string): Promise<{
  componentContracts?: ComponentContract[];
  expectedComponentUsage?: ExpectedComponentUsage[];
}> {
  return readJson(relativePath);
}

export async function getHugoUiContractStatus() {
  return getContractStatus();
}

export async function readAllComponentContracts(
  contractVersion?: string
): Promise<ComponentContract[]> {
  const source = await resolveLocalContractSource(contractVersion);
  const manifest = await readHugoUiManifest(source.root);

  return Promise.all(
    manifest.components.map((component) =>
      readAdaptedHugoUiContract(
        contractRelativePath(source, component.contract),
        displayPath(contractRelativePath(source, component.contract))
      )
    )
  );
}

async function readDesignFixtures(): Promise<FigmaLikeFixture[]> {
  const directory = fromRepoRoot("fixtures/figma");
  const entries = await fs.readdir(directory);
  const fixtureFiles = entries.filter((entry) => entry.endsWith(".json"));

  return Promise.all(
    fixtureFiles.map((fileName) =>
      readJson<FigmaLikeFixture>(path.join("fixtures/figma", fileName))
    )
  );
}

async function readPatternContracts(): Promise<PatternContract[]> {
  const directory = fromRepoRoot("contracts/patterns");
  const entries = await fs.readdir(directory);
  const patternFiles = entries.filter((entry) => entry.endsWith(".pattern.json"));

  return Promise.all(
    patternFiles.map((fileName) =>
      readJson<PatternContract>(path.join("contracts/patterns", fileName))
    )
  );
}

async function readCodeConnectManifest(): Promise<CodeConnectManifest> {
  return readJson<CodeConnectManifest>("code-connect/manifest.json");
}

type HugoUiManifest = {
  schemaVersion: string;
  packageName: string;
  packageVersion: string;
  sourcePackagePath: string;
  components: Array<{
    componentName: string;
    importName: string;
    contract: string;
    metadata?: string;
  }>;
  tokenContract: string;
  [key: string]: unknown;
};

async function readHugoUiManifest(root: string): Promise<HugoUiManifest> {
  return readJson<HugoUiManifest>(path.join(root, "manifest.json"));
}

async function readAdaptedHugoUiContract(
  relativePath: string,
  sourceContractPath = relativePath
): Promise<ComponentContract> {
  const sourceContract = await readJson<HugoUIComponentContract>(relativePath);
  return adaptHugoUIMuiContract(sourceContract, sourceContractPath);
}

async function readJson<T>(relativePath: string): Promise<T> {
  const filePath = path.isAbsolute(relativePath)
    ? relativePath
    : fromRepoRoot(relativePath);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function inferContractVersion(
  expectedComponentUsage?: ExpectedComponentUsage[]
): string | undefined {
  const versions = new Set(
    (expectedComponentUsage ?? [])
      .map((usage) => usage.contractVersion)
      .filter((version): version is string => Boolean(version))
  );

  return versions.size === 1 ? [...versions][0] : undefined;
}

function displayPath(filePath: string): string {
  const relativePath = path.relative(fromRepoRoot("."), filePath);
  return relativePath.startsWith("..") || path.isAbsolute(relativePath)
    ? filePath
    : relativePath;
}

function flattenDesignNodes(frame: DesignFrame): DesignNode[] {
  const result: DesignNode[] = [];

  function visit(node: DesignNode) {
    result.push(node);
    node.children?.forEach(visit);
  }

  visit(frame);
  return result;
}

function summarizeContract(contract: ComponentContract) {
  return {
    componentName: contract.componentName,
    packageName: contract.packageName,
    importName: contract.importName,
    requiredProps: contract.requiredProps,
    allowedProps: Object.keys(contract.allowedProps),
    forbiddenProps: contract.forbiddenProps,
    discouragedProps: contract.discouragedProps ?? [],
    conditionalProps: contract.conditionalProps ?? [],
    sourceContractPath: contract.policy?.sourceContractPath,
    designMappings: contract.designMappings ?? {}
  };
}
