import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fromRepoRoot } from "../mcp-server/src/paths";
import type { ComponentContract, ExpectedComponentUsage } from "../mcp-server/src/types";
import { validateGeneratedCode } from "../mcp-server/src/validator";

const defaultCandidatePath = "generated/edit-profile-modal.mcp-run.generated.jsx";
const defaultContextPackPath = "generated/edit-profile-modal.context-pack.json";
const defaultReferencePaths = [
  "generated/edit-profile-modal.generated.tsx",
  "generated/edit-profile-modal.invalid.generated.tsx"
];
const defaultOutputPath = "generated/edit-profile-modal.audit-report.json";
const defaultSimilarityThreshold = 0.98;

const options = parseArgs(process.argv.slice(2));
const candidatePath = options.candidatePath ?? defaultCandidatePath;
const contextPackPath = options.contextPackPath ?? defaultContextPackPath;
const referencePaths = options.referencePaths.length
  ? options.referencePaths
  : defaultReferencePaths;
const outputPath = options.outputPath ?? defaultOutputPath;
const similarityThreshold =
  options.similarityThreshold ?? defaultSimilarityThreshold;

const [candidateCode, contextPack] = await Promise.all([
  readText(candidatePath),
  readJson<ContextPack>(contextPackPath)
]);
const validationReport = validateGeneratedCode(
  candidateCode,
  contextPack.componentContracts,
  {
    expectedComponentUsage: contextPack.expectedComponentUsage
  }
);
const candidateTokens = tokenize(candidateCode);
const referenceAudits = await Promise.all(
  referencePaths.map(async (referencePath) => {
    const code = await readText(referencePath);
    const similarity = sequenceSimilarity(candidateTokens, tokenize(code));

    return {
      path: referencePath,
      sha256: sha256(code),
      bytes: Buffer.byteLength(code, "utf8"),
      similarity,
      exactNormalizedMatch: normalizeForExactMatch(candidateCode) === normalizeForExactMatch(code)
    };
  })
);
const maxReferenceSimilarity = Math.max(
  0,
  ...referenceAudits.map((reference) => reference.similarity)
);
const distinctFromStaticSamples = maxReferenceSimilarity < similarityThreshold;
const report = {
  schemaVersion: "generation-audit/v1",
  source: options.source ?? "captured Codex MCP run candidate",
  candidate: {
    path: candidatePath,
    sha256: sha256(candidateCode),
    bytes: Buffer.byteLength(candidateCode, "utf8"),
    lineCount: candidateCode.split(/\r?\n/).length
  },
  context: {
    path: contextPackPath,
    sha256: sha256(JSON.stringify(contextPack)),
    frameId: contextPack.frameId,
    componentPackage: contextPack.codeConnect.componentPackage,
    expectedComponentUsage: contextPack.expectedComponentUsage.map((usage) => ({
      nodeId: usage.nodeId,
      componentName: usage.componentName,
      importName: usage.importName,
      packageName: usage.packageName
    }))
  },
  validation: validationReport,
  staticReferences: referenceAudits,
  checks: [
    {
      id: "contract-validation",
      status: validationReport.valid ? "pass" : "fail",
      message: validationReport.valid
        ? "Candidate passes validator with expected component usage from the context pack."
        : "Candidate does not pass validator."
    },
    {
      id: "context-binding",
      status: "pass",
      message: "Audit records the context pack hash used for validation."
    },
    {
      id: "distinct-from-static-samples",
      status: distinctFromStaticSamples ? "pass" : "fail",
      message: distinctFromStaticSamples
        ? `Candidate similarity to static samples is below ${similarityThreshold}.`
        : `Candidate similarity to at least one static sample is ${maxReferenceSimilarity.toFixed(3)}.`
    }
  ],
  limitations: [
    "This report is an audit trail, not a cryptographic proof of model intent.",
    "It proves the candidate code was validated against a specific context pack and records similarity against known static samples.",
    "For stronger provenance, capture the MCP tool-call transcript from the Codex session alongside this report."
  ]
};

await fs.mkdir(path.dirname(fromRepoRoot(outputPath)), { recursive: true });
await fs.writeFile(fromRepoRoot(outputPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (options.expectValid && !validationReport.valid) {
  throw new Error("Expected candidate validation to pass, but it failed.");
}

if (options.expectDistinct && !distinctFromStaticSamples) {
  throw new Error("Expected candidate to differ from static samples, but similarity was too high.");
}

console.log(`Wrote ${outputPath}`);

type ContextPack = {
  frameId: string;
  codeConnect: {
    componentPackage: string;
  };
  componentContracts: ComponentContract[];
  expectedComponentUsage: ExpectedComponentUsage[];
};

type Options = {
  candidatePath?: string;
  contextPackPath?: string;
  referencePaths: string[];
  outputPath?: string;
  source?: string;
  similarityThreshold?: number;
  expectValid: boolean;
  expectDistinct: boolean;
};

function parseArgs(args: string[]): Options {
  const options: Options = {
    referencePaths: [],
    expectValid: false,
    expectDistinct: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "--context-pack":
        options.contextPackPath = requiredValue(args, (index += 1), arg);
        break;
      case "--reference":
        options.referencePaths.push(requiredValue(args, (index += 1), arg));
        break;
      case "--output":
        options.outputPath = requiredValue(args, (index += 1), arg);
        break;
      case "--source":
        options.source = requiredValue(args, (index += 1), arg);
        break;
      case "--similarity-threshold":
        options.similarityThreshold = Number(requiredValue(args, (index += 1), arg));
        break;
      case "--expect-valid":
        options.expectValid = true;
        break;
      case "--expect-distinct":
        options.expectDistinct = true;
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        if (options.candidatePath) {
          throw new Error(`Unexpected positional argument: ${arg}`);
        }
        options.candidatePath = arg;
        break;
    }
  }

  if (
    options.similarityThreshold !== undefined &&
    (!Number.isFinite(options.similarityThreshold) ||
      options.similarityThreshold <= 0 ||
      options.similarityThreshold > 1)
  ) {
    throw new Error("--similarity-threshold must be a number between 0 and 1.");
  }

  return options;
}

function requiredValue(args: string[], index: number, flagName: string): string {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flagName}.`);
  }
  return value;
}

async function readText(relativePath: string): Promise<string> {
  return fs.readFile(fromRepoRoot(relativePath), "utf8");
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readText(relativePath)) as T;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function tokenize(code: string): string[] {
  const withoutComments = code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|\s)\/\/.*$/gm, " ");

  return (
    withoutComments.match(
      /[A-Za-z_$][A-Za-z0-9_$]*|\d+(?:\.\d+)?|["'][^"']*["']|[{}()[\]<>/=.,;:?]|\?\?/g
    ) ?? []
  );
}

function normalizeForExactMatch(code: string): string {
  return tokenize(code).join(" ");
}

function sequenceSimilarity(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) {
    return 1;
  }

  const previous = new Array(right.length + 1).fill(0);
  const current = new Array(right.length + 1).fill(0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] =
        left[leftIndex - 1] === right[rightIndex - 1]
          ? previous[rightIndex - 1] + 1
          : Math.max(previous[rightIndex], current[rightIndex - 1]);
    }

    previous.splice(0, previous.length, ...current);
    current.fill(0);
  }

  return previous[right.length] / Math.max(left.length, right.length);
}
