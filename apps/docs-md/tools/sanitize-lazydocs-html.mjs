import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];

if (!dir || !fs.existsSync(dir)) {
  console.log(`[sanitize-lazydocs] directory not found, nothing to do: ${dir}`);
  process.exit(0);
}

const stripCosmeticHtml = (text) =>
  text
    .split("<kbd>")
    .join("")
    .split("</kbd>")
    .join("")
    .split("<b>")
    .join("")
    .split("</b>")
    .join("");

let changed = 0;
for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith(".md")) continue;
  const file = path.join(dir, name);
  const before = fs.readFileSync(file, "utf-8");
  const after = stripCosmeticHtml(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed += 1;
  }
}

console.log(`[sanitize-lazydocs] stripped cosmetic HTML from ${changed} file(s) in ${dir}`);
