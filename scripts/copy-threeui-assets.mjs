import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const source = resolve(root, "node_modules/@designcodeio/threeui/lib-dist/assets");
const target = resolve(root, "public");

if (!existsSync(source)) {
  console.error(`[threeui] assets not found at ${source}`);
  console.error("[threeui] run npm install before building.");
  process.exit(1);
}

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });

console.log(`[threeui] copied runtime assets from ${source} to ${target}`);
