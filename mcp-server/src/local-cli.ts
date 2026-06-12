import {
  buildGenerationContext,
  getCodeConnectMap,
  getComponentContract,
  getDesignContext,
  readContextPack,
  validateGeneratedCodeTool,
  validateGeneratedFile
} from "./tools";
import type { ValidationReport } from "./types";

const [command, ...args] = process.argv.slice(2);

async function main() {
  switch (command) {
    case "get-design-context":
    case "get_design_context":
      printJson(await getDesignContext(requiredArg(args[0], "frameId")));
      return;

    case "get-code-connect-map":
    case "get_code_connect_map":
      printJson(await getCodeConnectMap(requiredArg(args[0], "nodeId")));
      return;

    case "get-component-contract":
    case "get_component_contract":
      printJson(await getComponentContract(requiredArg(args[0], "componentName")));
      return;

    case "build-generation-context":
    case "build_generation_context":
      printJson(await buildGenerationContext(requiredArg(args[0], "frameId")));
      return;

    case "validate-file":
      assertValidationExpectation(
        await printValidationReport(
          await validateGeneratedFile(
            requiredArg(args[0], "relativePath"),
            await readExpectedComponentUsage(args)
          )
        ),
        args
      );
      return;

    case "validate-generated-code":
    case "validate_generated_code":
      assertValidationExpectation(
        await printValidationReport(
          await validateGeneratedCodeTool(
            getPositionalArgs(args).join(" "),
            await readExpectedComponentUsage(args)
          )
        ),
        args
      );
      return;

    default:
      throw new Error(
        `Unknown command "${command ?? ""}". Use get-design-context, get-code-connect-map, get-component-contract, build-generation-context, validate-file, or validate-generated-code.`
      );
  }
}

function requiredArg(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required argument: ${name}`);
  }
  return value;
}

async function readExpectedComponentUsage(args: string[]) {
  const contextPackPath =
    getFlagValue(args, "--context-pack") ?? getFlagValue(args, "--context");

  if (!contextPackPath) {
    return undefined;
  }

  const contextPack = await readContextPack(contextPackPath);
  return contextPack.expectedComponentUsage;
}

async function printValidationReport(
  report: ValidationReport
): Promise<ValidationReport> {
  printJson(report);
  return report;
}

function assertValidationExpectation(report: ValidationReport, args: string[]) {
  const expectValid = hasFlag(args, "--expect-valid");
  const expectInvalid = hasFlag(args, "--expect-invalid");

  if (expectValid && expectInvalid) {
    throw new Error("Use only one of --expect-valid or --expect-invalid.");
  }

  if (expectValid && !report.valid) {
    throw new Error("Expected validation to pass, but it failed.");
  }

  if (expectInvalid && report.valid) {
    throw new Error("Expected validation to fail, but it passed.");
  }
}

function getFlagValue(args: string[], flagName: string): string | undefined {
  const separateFlagIndex = args.indexOf(flagName);
  if (separateFlagIndex >= 0) {
    return args[separateFlagIndex + 1];
  }

  const inlinePrefix = `${flagName}=`;
  return args
    .find((arg) => arg.startsWith(inlinePrefix))
    ?.slice(inlinePrefix.length);
}

function hasFlag(args: string[], flagName: string): boolean {
  return args.includes(flagName);
}

function getPositionalArgs(args: string[]): string[] {
  const positionalArgs: string[] = [];
  const valueFlags = new Set(["--context-pack", "--context"]);
  const booleanFlags = new Set(["--expect-valid", "--expect-invalid"]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (booleanFlags.has(arg)) {
      continue;
    }

    if (valueFlags.has(arg)) {
      index += 1;
      continue;
    }

    if ([...valueFlags].some((flagName) => arg.startsWith(`${flagName}=`))) {
      continue;
    }

    positionalArgs.push(arg);
  }

  return positionalArgs;
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
