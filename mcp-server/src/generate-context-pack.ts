import fs from "node:fs/promises";
import path from "node:path";
import { fromRepoRoot } from "./paths";
import { buildGenerationContext } from "./tools";

const [frameId = "frame-edit-profile", outputPath = "generated/edit-profile-modal.context-pack.json"] =
  process.argv.slice(2);

const contextPack = await buildGenerationContext(frameId);
const absoluteOutputPath = fromRepoRoot(outputPath);

await fs.mkdir(path.dirname(absoluteOutputPath), { recursive: true });
await fs.writeFile(
  absoluteOutputPath,
  `${JSON.stringify(contextPack, null, 2)}\n`,
  "utf8"
);

console.log(`Wrote ${outputPath}`);
