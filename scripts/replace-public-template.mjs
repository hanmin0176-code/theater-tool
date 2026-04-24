import fs from "node:fs/promises";
import path from "node:path";

const [, , slotArg, sourceArg] = process.argv;

if (!slotArg || !sourceArg) {
  console.error("Usage: node scripts/replace-public-template.mjs <1|2|3> <source-json-path>");
  process.exit(1);
}

const slot = Number(slotArg);
if (![1, 2, 3].includes(slot)) {
  console.error("Template slot must be 1, 2, or 3.");
  process.exit(1);
}

const sourcePath = path.resolve(sourceArg);
const targetPath = path.resolve(`src/publicSampleTemplate${slot}.json`);

let parsed;
try {
  const raw = await fs.readFile(sourcePath, "utf8");
  parsed = JSON.parse(raw);
} catch (error) {
  console.error(`Failed to read or parse source JSON: ${sourcePath}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

await fs.writeFile(targetPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
console.log(`Replaced public sample template ${slot}:`);
console.log(`  source: ${sourcePath}`);
console.log(`  target: ${targetPath}`);
