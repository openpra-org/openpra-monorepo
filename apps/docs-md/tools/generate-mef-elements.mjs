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
  {
    slug: "hazards-screening",
    file: "hazards-screening-analysis",
    title: "Hazards Screening Analysis",
  },
  { slug: "seismic", file: "seismic-pra", title: "Seismic PRA" },
  { slug: "internal-flood", file: "internal-flood-pra", title: "Internal Flood PRA" },
  { slug: "internal-fire", file: "internal-fire-pra", title: "Internal Fire PRA" },
  { slug: "high-winds", file: "high-winds-pra", title: "High Winds PRA" },
  { slug: "external-flood", file: "external-flood-pra", title: "External Flood PRA" },
  { slug: "other-hazards", file: "other-hazards-pra", title: "Other Hazards PRA" },
];

const tsUrl = (el) => `/mef-elements/ts/${el.slug}/${el.file}/README.html`;
const zodUrl = (el) => `/mef-elements/zod/${el.slug}/${el.file}/README.html`;
const tsReadme = (el) => path.join(MEF_DIR, "ts", el.slug, el.file, "README.md");
const zodReadme = (el) => path.join(MEF_DIR, "zod", el.slug, el.file, "README.md");

const TOGGLE_PATTERN =
  /^<!-- mef-view-toggle -->\r?\n\r?\n# .+?\r?\n\r?\nView as: .+?\r?\n\r?\n\*\*\*\r?\n\r?\n/;

function removeToggle(file) {
  if (!fs.existsSync(file)) {
    console.warn(`[mef:elements] missing generated page: ${file}`);
    return false;
  }
  const body = fs.readFileSync(file, "utf-8");
  const cleaned = body.replace(TOGGLE_PATTERN, "");
  if (cleaned !== body) fs.writeFileSync(file, cleaned);
  return true;
}

let processed = 0;
for (const el of ELEMENTS) {
  if (removeToggle(tsReadme(el))) processed += 1;
  if (removeToggle(zodReadme(el))) processed += 1;
}

const lines = [
  "# MEF Technical Elements",
  "",
  "Schema reference for the OpenPRA Model Exchange Format technical elements, generated from `apps/interfaces/mef-types`. Every element is available as TypeScript types and as its Zod validation mirror through the links below.",
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

console.log(`[mef:elements] wrote landing and processed ${processed} element pages without view toggles`);
