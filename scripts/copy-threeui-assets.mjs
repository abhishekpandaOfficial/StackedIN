import { cp, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

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

const exactSylvaAssets = new Map([
  ["landing-pages/inner-green-3d.html", "69c3694bd63f44ef9f007ebe4dac57a83e4402e0cdf6b54dd10b96dd4f05e197"],
  ["landing-pages/inner-green-assets/three.min.js", "8a5f7249903b54d30f79f708699d2fed2d6a1d0741a4cd41377d1f01bb5a2271"],
  ["landing-pages/inner-green-assets/card-ecostove.jpg", "70ce084084902bc502f00c366405b661ecdff90dee95d363b36a6e146829e433"],
  ["landing-pages/inner-green-assets/card-ethos.jpg", "337627390f499b3ae272cec9e2f83c817694a82f42e1aa10a7b26a2c7d679dff"],
  ["landing-pages/inner-green-assets/lexend-latin.woff2", "1ec8f6ee2750554b4bc59ff0b507d316a82a7ba37e0e5bebc41d3bd9b9faad46"],
]);

for (const [relativePath, expected] of exactSylvaAssets) {
  const filePath = resolve(target, relativePath);
  if (!existsSync(filePath)) {
    console.error(`[threeui] required Sylva asset missing: ${relativePath}`);
    process.exit(1);
  }
  const bytes = await readFile(filePath);
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) {
    console.error(`[threeui] Sylva asset hash mismatch: ${relativePath}`);
    console.error(`[threeui] expected ${expected}`);
    console.error(`[threeui] received ${actual}`);
    process.exit(1);
  }
}

console.log(`[threeui] copied runtime assets from ${source} to ${target}`);
console.log(`[threeui] verified ${exactSylvaAssets.size} exact Sylva Living Green runtime assets`);
