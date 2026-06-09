import { POS_ANALYSIS } from "./pos-seed";
import { IE_ANALYSIS } from "./ie-seed";
import { ES_ANALYSIS } from "./es-seed";
import { SC_ANALYSIS } from "./sc-seed";
import { CC_SNAPSHOT_INSTANCE, NM_INSTANCES } from "./cross-cutting-seed";
import type { ExampleWorkbookKind } from "../example-workbook.schema";

interface SeedEntry {
  slug: string;
  kind: ExampleWorkbookKind;
  mef: unknown;
}

const POS_GENERIC_1_SLUG = "pos-generic-1";
const IE_GENERIC_1_SLUG = "ie-generic-1";
const ES_GENERIC_1_SLUG = "es-generic-1";
const SC_GENERIC_1_SLUG = "sc-generic-1";
const CC_GENERIC_1_SLUG = "cc-2026-04-18";

function nmSlug(uuid: string): string {
  return uuid.toLowerCase();
}

const SEEDS: SeedEntry[] = [
  { slug: POS_GENERIC_1_SLUG, kind: "POS", mef: POS_ANALYSIS },
  { slug: IE_GENERIC_1_SLUG, kind: "IE", mef: IE_ANALYSIS },
  { slug: ES_GENERIC_1_SLUG, kind: "ES", mef: ES_ANALYSIS },
  { slug: SC_GENERIC_1_SLUG, kind: "SC", mef: SC_ANALYSIS },
  { slug: CC_GENERIC_1_SLUG, kind: "CONFIGURATION_CONTROL", mef: CC_SNAPSHOT_INSTANCE },
  ...NM_INSTANCES.map((nm) => ({ slug: nmSlug(nm.uuid), kind: "NEWLY_DEVELOPED_METHOD" as const, mef: nm })),
];

export { SEEDS, POS_GENERIC_1_SLUG, IE_GENERIC_1_SLUG, ES_GENERIC_1_SLUG, SC_GENERIC_1_SLUG, CC_GENERIC_1_SLUG, type SeedEntry };
