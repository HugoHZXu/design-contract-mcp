import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export function fromRepoRoot(relativePath: string): string {
  return path.resolve(repoRoot, relativePath);
}

