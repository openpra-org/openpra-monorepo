import { POS_ANALYSIS } from "./pos-seed";
import { POS_ANALYSIS_SFR } from "./pos-seed-sfr";
import { IE_ANALYSIS } from "./ie-seed";
import { IE_ANALYSIS_SFR } from "./ie-seed-sfr";
import { ES_ANALYSIS } from "./es-seed";
import { ES_ANALYSIS_HTGR } from "./es-seed-htgr";
import { SC_ANALYSIS } from "./sc-seed";
import { SC_ANALYSIS_HTGR } from "./sc-seed-htgr";
import { SY_ANALYSIS } from "./sy-seed";
import { HR_ANALYSIS } from "./hr-seed";
import { DA_ANALYSIS } from "./da-seed";
import { ESQ_ANALYSIS } from "./esq-seed";
import { MS_ANALYSIS } from "./ms-seed";
import { RC_ANALYSIS } from "./rc-seed";
import { RI_ANALYSIS } from "./ri-seed";
import { CC_SNAPSHOT_INSTANCE, NM_INSTANCES } from "./cross-cutting-seed";
import type { ExampleWorkbookKind } from "../example-workbook.schema";

interface SeedEntry {
  slug: string;
  kind: ExampleWorkbookKind;
  mef: unknown;
}

const POS_GENERIC_1_SLUG = "pos-generic-1";
const POS_GENERIC_2_SLUG = "pos-generic-2";
const IE_GENERIC_1_SLUG = "ie-generic-1";
const IE_GENERIC_2_SLUG = "ie-generic-2";
const ES_GENERIC_1_SLUG = "es-generic-1";
const ES_GENERIC_2_SLUG = "es-generic-2";
const SC_GENERIC_1_SLUG = "sc-generic-1";
const SC_GENERIC_2_SLUG = "sc-generic-2";
const SY_GENERIC_1_SLUG = "sy-generic-1";
const HR_GENERIC_1_SLUG = "hr-generic-1";
const DA_GENERIC_1_SLUG = "da-generic-1";
const ESQ_GENERIC_1_SLUG = "esq-generic-1";
const MS_GENERIC_1_SLUG = "ms-generic-1";
const RC_GENERIC_1_SLUG = "rc-generic-1";
const RI_GENERIC_1_SLUG = "ri-generic-1";
const CC_GENERIC_1_SLUG = "cc-2026-04-18";

function nmSlug(uuid: string): string {
  return uuid.toLowerCase();
}

interface PosExampleEntry {
  id: string;
  label: string;
  slug: string;
}

const POS_EXAMPLES: PosExampleEntry[] = [
  { id: "htgr", label: "Generic HTGR", slug: POS_GENERIC_1_SLUG },
  { id: "sfr", label: "Generic SFR", slug: POS_GENERIC_2_SLUG },
];

const IE_EXAMPLES: PosExampleEntry[] = [
  { id: "htgr", label: "Generic HTGR", slug: IE_GENERIC_1_SLUG },
  { id: "sfr", label: "Generic SFR", slug: IE_GENERIC_2_SLUG },
];

const ES_EXAMPLES: PosExampleEntry[] = [
  { id: "htgr", label: "Generic HTGR", slug: ES_GENERIC_2_SLUG },
  { id: "sfr", label: "Generic SFR", slug: ES_GENERIC_1_SLUG },
];

const SC_EXAMPLES: PosExampleEntry[] = [
  { id: "htgr", label: "Generic HTGR", slug: SC_GENERIC_2_SLUG },
  { id: "sfr", label: "Generic SFR", slug: SC_GENERIC_1_SLUG },
];

const SEEDS: SeedEntry[] = [
  { slug: POS_GENERIC_1_SLUG, kind: "POS", mef: POS_ANALYSIS },
  { slug: POS_GENERIC_2_SLUG, kind: "POS", mef: POS_ANALYSIS_SFR },
  { slug: IE_GENERIC_1_SLUG, kind: "IE", mef: IE_ANALYSIS },
  { slug: IE_GENERIC_2_SLUG, kind: "IE", mef: IE_ANALYSIS_SFR },
  { slug: ES_GENERIC_1_SLUG, kind: "ES", mef: ES_ANALYSIS },
  { slug: ES_GENERIC_2_SLUG, kind: "ES", mef: ES_ANALYSIS_HTGR },
  { slug: SC_GENERIC_1_SLUG, kind: "SC", mef: SC_ANALYSIS },
  { slug: SC_GENERIC_2_SLUG, kind: "SC", mef: SC_ANALYSIS_HTGR },
  { slug: SY_GENERIC_1_SLUG, kind: "SY", mef: SY_ANALYSIS },
  { slug: HR_GENERIC_1_SLUG, kind: "HRA", mef: HR_ANALYSIS },
  { slug: DA_GENERIC_1_SLUG, kind: "DA", mef: DA_ANALYSIS },
  { slug: ESQ_GENERIC_1_SLUG, kind: "ESQ", mef: ESQ_ANALYSIS },
  { slug: MS_GENERIC_1_SLUG, kind: "MS", mef: MS_ANALYSIS },
  { slug: RC_GENERIC_1_SLUG, kind: "RC", mef: RC_ANALYSIS },
  { slug: RI_GENERIC_1_SLUG, kind: "RI", mef: RI_ANALYSIS },
  { slug: CC_GENERIC_1_SLUG, kind: "CONFIGURATION_CONTROL", mef: CC_SNAPSHOT_INSTANCE },
  ...NM_INSTANCES.map((nm) => ({ slug: nmSlug(nm.uuid), kind: "NEWLY_DEVELOPED_METHOD" as const, mef: nm })),
];

export { SEEDS, POS_EXAMPLES, IE_EXAMPLES, ES_EXAMPLES, SC_EXAMPLES, POS_GENERIC_1_SLUG, POS_GENERIC_2_SLUG, IE_GENERIC_1_SLUG, IE_GENERIC_2_SLUG, ES_GENERIC_1_SLUG, ES_GENERIC_2_SLUG, SC_GENERIC_1_SLUG, SC_GENERIC_2_SLUG, SY_GENERIC_1_SLUG, HR_GENERIC_1_SLUG, DA_GENERIC_1_SLUG, ESQ_GENERIC_1_SLUG, MS_GENERIC_1_SLUG, RC_GENERIC_1_SLUG, RI_GENERIC_1_SLUG, CC_GENERIC_1_SLUG, type SeedEntry, type PosExampleEntry };
