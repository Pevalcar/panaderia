import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const distDir = join(process.cwd(), "dist");

function getHtmlFiles(dirPath) {
  const entries = readdirSync(dirPath);
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...getHtmlFiles(fullPath));
      continue;
    }

    if (entry.endsWith(".html")) {
      files.push(fullPath);
    }
  }

  return files;
}

function patchHtmlFile(filePath) {
  const source = readFileSync(filePath, "utf8");
  const patched = source.replace(
    /<script src="(\/_expo\/static\/js\/web\/entry-[^"]+\.js)" defer><\/script>/g,
    '<script type="module" src="$1"></script>',
  );

  if (patched !== source) {
    writeFileSync(filePath, patched, "utf8");
    return true;
  }

  return false;
}

if (!statSync(distDir, { throwIfNoEntry: false })) {
  console.error(
    "dist directory was not found. Run expo export before this script.",
  );
  process.exit(1);
}

const htmlFiles = getHtmlFiles(distDir);
let patchedCount = 0;

for (const htmlFile of htmlFiles) {
  if (patchHtmlFile(htmlFile)) {
    patchedCount += 1;
  }
}

console.log(`Patched module script tags in ${patchedCount} HTML files.`);
