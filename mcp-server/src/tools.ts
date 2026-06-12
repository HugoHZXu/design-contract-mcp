import fs from "node:fs/promises";
import path from "node:path";
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
import { validateGeneratedCode } from "./validator";

const hugoUiContractRoot = "vendor/hugo-ui/mui-ai-contract";
const hugoUiManifestPath = `${hugoUiContractRoot}/manifest.json`;
const hugoUiTokenMapPath = `${hugoUiContractRoot}/tokens/token-map.contract.json`;
const hugoUiProvenancePath = `${hugoUiContractRoot}/provenance.json`;

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

export async function getComponentContract(componentName: string) {
  const manifest = await readHugoUiManifest();
  const manifestEntry = manifest.components.find(
    (component) => component.componentName === componentName
  );

  if (!manifestEntry) {
    throw new Error(`Component contract not found in hugo-ui snapshot: ${componentName}`);
  }

  return readAdaptedHugoUiContract(
    `${hugoUiContractRoot}/${manifestEntry.contract}`
  );
}

export async function buildGenerationContext(frameId: string) {
  const designContext = await getDesignContext(frameId);
  const manifest = await readCodeConnectManifest();
  const tokenMap = await readJson<TokenMapContract>(
    hugoUiTokenMapPath
  );
  const contractArtifact = {
    manifest: await readHugoUiManifest(),
    provenance: await readJson<Record<string, unknown>>(hugoUiProvenancePath)
  };
  const patterns = await readPatternContracts();
  const pattern = patterns.find((candidate) => candidate.frameIds.includes(frameId));
  const nodes = flattenDesignNodes(designContext.frame);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const mappings = manifest.mappings.filter((mapping) => nodeById.has(mapping.nodeId));
  const componentContracts = await readAllComponentContracts();
  const resolvedNodes = await Promise.all(
    mappings.map(async (mapping) => {
      const contract = await readAdaptedHugoUiContract(mapping.contractPath);
      return {
        node: nodeById.get(mapping.nodeId),
        mapping,
        contract: summarizeContract(contract)
      };
    })
  );
  const expectedComponentUsage: ExpectedComponentUsage[] = resolvedNodes.map(
    ({ node, mapping }) => ({
      nodeId: mapping.nodeId,
      nodeName: node?.name ?? mapping.figmaNodeName,
      componentName: mapping.componentName,
      importName: mapping.importName,
      packageName: manifest.componentPackage,
      contractPath: mapping.contractPath
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
  expectedComponentUsage?: ExpectedComponentUsage[]
) {
  const contracts = await readAllComponentContracts();
  return validateGeneratedCode(code, contracts, { expectedComponentUsage });
}

export async function validateGeneratedFile(
  relativePath: string,
  expectedComponentUsage?: ExpectedComponentUsage[]
) {
  const code = await fs.readFile(fromRepoRoot(relativePath), "utf8");
  return validateGeneratedCodeTool(code, expectedComponentUsage);
}

export async function readContextPack(relativePath: string): Promise<{
  componentContracts?: ComponentContract[];
  expectedComponentUsage?: ExpectedComponentUsage[];
}> {
  return readJson(relativePath);
}

export async function readAllComponentContracts(): Promise<ComponentContract[]> {
  const manifest = await readHugoUiManifest();

  return Promise.all(
    manifest.components.map((component) =>
      readAdaptedHugoUiContract(`${hugoUiContractRoot}/${component.contract}`)
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

async function readHugoUiManifest(): Promise<HugoUiManifest> {
  return readJson<HugoUiManifest>(hugoUiManifestPath);
}

async function readAdaptedHugoUiContract(
  relativePath: string
): Promise<ComponentContract> {
  const sourceContract = await readJson<HugoUIComponentContract>(relativePath);
  return adaptHugoUIMuiContract(sourceContract, relativePath);
}

async function readJson<T>(relativePath: string): Promise<T> {
  const filePath = fromRepoRoot(relativePath);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
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
