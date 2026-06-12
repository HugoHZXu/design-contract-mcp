import fs from "node:fs/promises";
import path from "node:path";
import { fromRepoRoot } from "../mcp-server/src/paths";
import type { DesignFrame, DesignNode, FigmaLikeFixture } from "../mcp-server/src/types";

const pluginNamespace = "figma-contract-mcp-demo";
const defaultInputPath = "fixtures/figma/raw/edit-profile-modal.figma-file.mock.json";
const defaultOutputPath = "fixtures/figma/edit-profile-modal.fixture.json";
const defaultFrameId = "frame-edit-profile";

const [inputPath = defaultInputPath, outputPath = defaultOutputPath, frameId = defaultFrameId] =
  process.argv.slice(2);

const rawSnapshot = await readJson<RawFigmaFileSnapshot>(inputPath);
const frame = findNode(rawSnapshot.document, frameId);

if (!frame) {
  throw new Error(`Frame not found in raw Figma mock: ${frameId}`);
}

const fixture: FigmaLikeFixture = {
  schemaVersion: "figma-like-fixture/v2",
  source: "normalized-from-local-figma-api-shaped-fixture",
  file: {
    id: rawSnapshot.file.key,
    name: rawSnapshot.file.name
  },
  rawSource: {
    schemaVersion: rawSnapshot.schemaVersion,
    source: rawSnapshot.source,
    path: inputPath,
    capturedAt: rawSnapshot.capturedAt,
    documentRootId: rawSnapshot.document.id
  },
  frames: [normalizeFrame(frame, rawSnapshot)]
};

const absoluteOutputPath = fromRepoRoot(outputPath);
await fs.mkdir(path.dirname(absoluteOutputPath), { recursive: true });
await fs.writeFile(absoluteOutputPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");

console.log(`Normalized ${inputPath} -> ${outputPath}`);

type RawFigmaFileSnapshot = {
  schemaVersion: string;
  source: string;
  capturedAt?: string;
  file: {
    key: string;
    name: string;
    [key: string]: unknown;
  };
  document: RawFigmaNode;
  components?: Record<string, RawFigmaComponentMetadata>;
  componentSets?: Record<string, RawFigmaComponentSetMetadata>;
  styles?: Record<string, unknown>;
};

type RawFigmaNode = {
  id: string;
  name: string;
  type: string;
  description?: string;
  componentId?: string;
  componentProperties?: Record<string, RawComponentProperty>;
  children?: RawFigmaNode[];
  absoluteBoundingBox?: FigmaRectangle;
  absoluteRenderBounds?: FigmaRectangle | null;
  layoutMode?: "HORIZONTAL" | "VERTICAL" | "NONE";
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  boundVariables?: Record<string, FigmaVariableAlias>;
  characters?: string;
  style?: Record<string, unknown>;
  overrides?: Array<Record<string, unknown>>;
  sharedPluginData?: Record<string, Record<string, string>>;
  [key: string]: unknown;
};

type RawComponentProperty = {
  type: string;
  value: string | boolean | number;
  preferredValues?: unknown[];
  boundVariables?: Record<string, unknown>;
};

type RawFigmaComponentMetadata = {
  key: string;
  name: string;
  description?: string;
  componentSetId?: string;
  remote?: boolean;
  [key: string]: unknown;
};

type RawFigmaComponentSetMetadata = {
  key: string;
  name: string;
  description?: string;
  [key: string]: unknown;
};

type FigmaRectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FigmaVariableAlias = {
  type: "VARIABLE_ALIAS";
  id: string;
};

async function readJson<T>(relativePath: string): Promise<T> {
  const raw = await fs.readFile(fromRepoRoot(relativePath), "utf8");
  return JSON.parse(raw) as T;
}

function findNode(node: RawFigmaNode, nodeId: string): RawFigmaNode | null {
  if (node.id === nodeId) {
    return node;
  }

  for (const child of node.children ?? []) {
    const found = findNode(child, nodeId);
    if (found) {
      return found;
    }
  }

  return null;
}

function normalizeFrame(node: RawFigmaNode, snapshot: RawFigmaFileSnapshot): DesignFrame {
  return normalizeNode(node, snapshot) as DesignFrame;
}

function normalizeNode(node: RawFigmaNode, snapshot: RawFigmaFileSnapshot): DesignNode {
  const componentMetadata =
    node.componentId === undefined ? undefined : snapshot.components?.[node.componentId];
  const componentSetMetadata =
    componentMetadata?.componentSetId === undefined
      ? undefined
      : snapshot.componentSets?.[componentMetadata.componentSetId];
  const normalized: DesignNode = {
    id: node.id,
    name: node.name,
    type: node.type
  };
  const layout = normalizeLayout(node);
  const text = collectDirectText(node);
  const children = (node.children ?? [])
    .filter((child) => child.type !== "TEXT")
    .map((child) => normalizeNode(child, snapshot));

  if (node.description) {
    normalized.description = node.description;
  }

  if (node.componentId) {
    normalized.componentId = node.componentId;
  }

  if (componentMetadata) {
    normalized.componentSet = componentMetadata.name;
    normalized.componentMetadata = {
      key: componentMetadata.key,
      name: componentMetadata.name,
      componentSetId: componentMetadata.componentSetId,
      componentSetName: componentSetMetadata?.name,
      remote: componentMetadata.remote ?? false
    };
  }

  if (node.componentProperties) {
    normalized.componentProperties = node.componentProperties;
  }

  if (Object.keys(text).length > 0) {
    normalized.text = text;
  }

  if (layout) {
    normalized.layout = layout;
  }

  if (node.absoluteBoundingBox) {
    normalized.absoluteBoundingBox = node.absoluteBoundingBox;
  }

  if (node.absoluteRenderBounds !== undefined) {
    normalized.absoluteRenderBounds = node.absoluteRenderBounds;
  }

  if (node.overrides?.length) {
    normalized.overrides = node.overrides;
  }

  if (children.length > 0) {
    normalized.children = children;
  }

  return normalized;
}

function collectDirectText(node: RawFigmaNode): Record<string, string> {
  const text: Record<string, string> = {};

  for (const child of node.children ?? []) {
    if (child.type !== "TEXT" || typeof child.characters !== "string") {
      continue;
    }

    const key = child.sharedPluginData?.[pluginNamespace]?.textKey;
    if (key) {
      text[key] = child.characters;
    }
  }

  return text;
}

function normalizeLayout(node: RawFigmaNode): Record<string, unknown> | undefined {
  const layout: Record<string, unknown> = {};

  if (node.absoluteBoundingBox) {
    layout.width = node.absoluteBoundingBox.width;
    layout.height = node.absoluteBoundingBox.height;
  }

  if (node.layoutMode && node.layoutMode !== "NONE") {
    layout.mode = node.layoutMode.toLowerCase();
  }

  const align = normalizeAlignment(node.primaryAxisAlignItems);
  if (align) {
    layout.align = align;
  }

  if (typeof node.itemSpacing === "number") {
    layout.itemSpacing = node.itemSpacing;
  }

  const gapToken = node.boundVariables?.itemSpacing?.id;
  if (gapToken) {
    layout.gapToken = gapToken;
  }

  const padding = normalizePadding(node);
  if (padding) {
    layout.padding = padding;
  }

  if (node.primaryAxisSizingMode) {
    layout.primaryAxisSizingMode = node.primaryAxisSizingMode;
  }

  if (node.counterAxisSizingMode) {
    layout.counterAxisSizingMode = node.counterAxisSizingMode;
  }

  if (Object.keys(node.boundVariables ?? {}).length > 0) {
    layout.boundVariables = node.boundVariables;
  }

  return Object.keys(layout).length > 0 ? layout : undefined;
}

function normalizePadding(node: RawFigmaNode): Record<string, number> | undefined {
  const padding = {
    left: node.paddingLeft,
    right: node.paddingRight,
    top: node.paddingTop,
    bottom: node.paddingBottom
  };
  const definedPadding = Object.fromEntries(
    Object.entries(padding).filter(([, value]) => typeof value === "number")
  );

  return Object.keys(definedPadding).length > 0
    ? (definedPadding as Record<string, number>)
    : undefined;
}

function normalizeAlignment(value: string | undefined): string | undefined {
  switch (value) {
    case "MIN":
      return "start";
    case "CENTER":
      return "center";
    case "MAX":
      return "end";
    case "SPACE_BETWEEN":
      return "space-between";
    default:
      return undefined;
  }
}
