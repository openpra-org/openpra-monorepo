import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MEF_DIR = path.join(ROOT, "apps/docs-md/mef-elements");

const ELEMENTS = [
  { slug: "pos", file: "plant-operating-state-analysis", title: "Plant Operating States Analysis" },
  { slug: "ie", file: "initiating-event-analysis", title: "Initiating Event Analysis" },
  { slug: "es", file: "event-sequence-analysis", title: "Event Sequence Analysis" },
  { slug: "sc", file: "success-criteria-development", title: "Success Criteria" },
  { slug: "sy", file: "systems-analysis", title: "Systems Analysis" },
  { slug: "hr", file: "human-reliability-analysis", title: "Human Reliability Analysis" },
  { slug: "da", file: "data-analysis", title: "Data Analysis" },
  { slug: "esq", file: "event-sequence-quantification", title: "Event Sequence Quantification" },
  { slug: "ms", file: "mechanistic-source-term-analysis", title: "Mechanistic Source Term Analysis" },
  { slug: "rc", file: "radiological-consequence-analysis", title: "Radiological Consequence Analysis" },
  { slug: "ri", file: "risk-integration", title: "Risk Integration" },
];

const tsUrl = (el) => `/mef-elements/ts/${el.slug}/${el.file}/README.html`;
const zodUrl = (el) => `/mef-elements/zod/${el.slug}/${el.file}/README.html`;
const tsReadme = (el) => path.join(MEF_DIR, "ts", el.slug, el.file, "README.md");
const zodReadme = (el) => path.join(MEF_DIR, "zod", el.slug, el.file, "README.md");

const TOGGLE_MARK = "<!-- mef-view-toggle -->";

function injectToggle(file, active, el) {
  if (!fs.existsSync(file)) {
    console.warn(`[mef:elements] missing ${active} page for ${el.slug}: ${file}`);
    return false;
  }
  const body = fs.readFileSync(file, "utf-8");
  if (body.includes(TOGGLE_MARK)) return true;
  const ts = active === "ts" ? "**TypeScript**" : `[TypeScript](${tsUrl(el)})`;
  const zod = active === "zod" ? "**Zod**" : `[Zod](${zodUrl(el)})`;
  const header = `${TOGGLE_MARK}\n\n# ${el.title}\n\nView as: ${ts} · ${zod}\n\n***\n\n`;
  fs.writeFileSync(file, header + body);
  return true;
}

let injected = 0;
for (const el of ELEMENTS) {
  if (injectToggle(tsReadme(el), "ts", el)) injected += 1;
  if (injectToggle(zodReadme(el), "zod", el)) injected += 1;
}

const lines = [
  "# MEF Technical Elements",
  "",
  "Schema reference for the OpenPRA Model Exchange Format technical elements, generated from `apps/interfaces/mef-types`. Every element is available as TypeScript types and as its Zod validation mirror — use the toggle at the top of each page to switch between them.",
  "",
  "## Technical Elements",
  "",
];
for (const el of ELEMENTS) {
  lines.push(`- **${el.title}** — [TypeScript](${tsUrl(el)}) · [Zod](${zodUrl(el)})`);
}
lines.push("");
lines.push("## Core &amp; supporting types");
lines.push("");
lines.push(
  "Shared building blocks (core data model, cross-cutting methods, workflows) are browsable in the full module reference: [TypeScript modules](/mef-elements/ts/README.html) · [Zod modules](/mef-elements/zod/README.html).",
);
lines.push("");
fs.writeFileSync(path.join(MEF_DIR, "index.md"), lines.join("\n"));

console.log(`[mef:elements] wrote landing and injected ${injected} element toggles`);
