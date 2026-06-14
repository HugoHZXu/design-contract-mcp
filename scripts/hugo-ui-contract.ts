import {
  getContractStatus,
  listRemoteContractReleases,
  syncHugoUiContract,
  verifyVendorContract
} from "../mcp-server/src/contract-store";

const [command = "status", ...args] = process.argv.slice(2);

async function main() {
  switch (command) {
    case "list":
      printJson(
        await listRemoteContractReleases(getFlagValue(args, "--repo"))
      );
      return;

    case "status":
      printJson(await getContractStatus());
      return;

    case "sync":
      printJson(
        await syncHugoUiContract({
          repo: getFlagValue(args, "--repo"),
          selector:
            getFlagValue(args, "--version") ??
            getFlagValue(args, "--target-version") ??
            getFlagValue(args, "--selector"),
          tag: getFlagValue(args, "--tag"),
          fromFile: getFlagValue(args, "--from-file")
        })
      );
      return;

    case "verify-vendor":
    case "verify":
      printJson(await verifyVendorContract());
      return;

    default:
      throw new Error(
        `Unknown command "${command}". Use list, status, sync, or verify-vendor.`
      );
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

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
