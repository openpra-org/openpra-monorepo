import { POS_ANALYSIS } from "./pos-seed";
import { POS_ANALYSIS_SFR } from "./pos-seed-sfr";
import { IE_ANALYSIS } from "./ie-seed";
import { IE_ANALYSIS_SFR } from "./ie-seed-sfr";
import { ES_ANALYSIS } from "./es-seed";
import { ES_ANALYSIS_HTGR } from "./es-seed-htgr";
import { SC_ANALYSIS } from "./sc-seed";
import { SC_ANALYSIS_HTGR } from "./sc-seed-htgr";
import { SY_ANALYSIS } from "./sy-seed";
import { SY_ANALYSIS_HTGR } from "./sy-seed-htgr";
import { HR_ANALYSIS } from "./hr-seed";
import { HR_ANALYSIS_HTGR } from "./hr-seed-htgr";
import { DA_ANALYSIS } from "./da-seed";
import { DA_ANALYSIS_HTGR } from "./da-seed-htgr";
import { ESQ_ANALYSIS } from "./esq-seed";
import { ESQ_ANALYSIS_HTGR } from "./esq-seed-htgr";
import { MS_ANALYSIS } from "./ms-seed";
import { MS_ANALYSIS_HTGR } from "./ms-seed-htgr";
import { RC_ANALYSIS } from "./rc-seed";
import { RC_ANALYSIS_HTGR } from "./rc-seed-htgr";
import { RI_ANALYSIS } from "./ri-seed";
import { RI_ANALYSIS_HTGR } from "./ri-seed-htgr";
import { SEISMIC_PRA_ANALYSIS } from "./seismic-pra-seed";
import { SEISMIC_PRA_ANALYSIS_HTGR } from "./seismic-pra-seed-htgr";
import { INTERNAL_FLOOD_PRA_ANALYSIS } from "./internal-flood-pra-seed";
import { INTERNAL_FLOOD_PRA_ANALYSIS_SFR } from "./internal-flood-pra-seed-sfr";
import { INTERNAL_FIRE_PRA_ANALYSIS } from "./internal-fire-pra-seed";
import { INTERNAL_FIRE_PRA_ANALYSIS_SFR } from "./internal-fire-pra-seed-sfr";
import { HAZARDS_SCREENING_ANALYSIS_HTGR } from "./hazards-screening-analysis-seed";
import { HAZARDS_SCREENING_ANALYSIS_SFR } from "./hazards-screening-analysis-seed-sfr";
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
const SY_GENERIC_2_SLUG = "sy-generic-2";
const HR_GENERIC_1_SLUG = "hr-generic-1";
const HR_GENERIC_2_SLUG = "hr-generic-2";
const DA_GENERIC_1_SLUG = "da-generic-1";
const DA_GENERIC_2_SLUG = "da-generic-2";
const ESQ_GENERIC_1_SLUG = "esq-generic-1";
const ESQ_GENERIC_2_SLUG = "esq-generic-2";
const MS_GENERIC_1_SLUG = "ms-generic-1";
const MS_GENERIC_2_SLUG = "ms-generic-2";
const RC_GENERIC_1_SLUG = "rc-generic-1";
const RC_GENERIC_2_SLUG = "rc-generic-2";
const RI_GENERIC_1_SLUG = "ri-generic-1";
const RI_GENERIC_2_SLUG = "ri-generic-2";
const SEISMIC_PRA_GENERIC_1_SLUG = "seismic-pra-generic-1";
const SEISMIC_PRA_GENERIC_2_SLUG = "seismic-pra-generic-2";
const INTERNAL_FLOOD_PRA_GENERIC_1_SLUG = "internal-flood-pra-generic-1";
const INTERNAL_FLOOD_PRA_GENERIC_2_SLUG = "internal-flood-pra-generic-2";
const INTERNAL_FIRE_PRA_GENERIC_1_SLUG = "internal-fire-pra-generic-1";
const INTERNAL_FIRE_PRA_GENERIC_2_SLUG = "internal-fire-pra-generic-2";
const HSA_GENERIC_1_SLUG = "hazards-screening-analysis-generic-1";
const HSA_GENERIC_2_SLUG = "hazards-screening-analysis-generic-2";
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

const SY_EXAMPLES: PosExampleEntry[] = [
  { id: "htgr", label: "Generic HTGR", slug: SY_GENERIC_2_SLUG },
  { id: "sfr", label: "Generic SFR", slug: SY_GENERIC_1_SLUG },
];

const HR_EXAMPLES: PosExampleEntry[] = [
  { id: "htgr", label: "Generic HTGR", slug: HR_GENERIC_2_SLUG },
  { id: "sfr", label: "Generic SFR", slug: HR_GENERIC_1_SLUG },
];

const DA_EXAMPLES: PosExampleEntry[] = [
  { id: "htgr", label: "Generic HTGR", slug: DA_GENERIC_2_SLUG },
  { id: "sfr", label: "Generic SFR", slug: DA_GENERIC_1_SLUG },
];

const ESQ_EXAMPLES: PosExampleEntry[] = [
  { id: "htgr", label: "Generic HTGR", slug: ESQ_GENERIC_2_SLUG },
  { id: "sfr", label: "Generic SFR", slug: ESQ_GENERIC_1_SLUG },
];

const MS_EXAMPLES: PosExampleEntry[] = [
  { id: "htgr", label: "Generic HTGR", slug: MS_GENERIC_2_SLUG },
  { id: "sfr", label: "Generic SFR", slug: MS_GENERIC_1_SLUG },
];

const RC_EXAMPLES: PosExampleEntry[] = [
  { id: "htgr", label: "Generic HTGR", slug: RC_GENERIC_2_SLUG },
  { id: "sfr", label: "Generic SFR", slug: RC_GENERIC_1_SLUG },
];

const RI_EXAMPLES: PosExampleEntry[] = [
  { id: "htgr", label: "Generic HTGR", slug: RI_GENERIC_2_SLUG },
  { id: "sfr", label: "Generic SFR", slug: RI_GENERIC_1_SLUG },
];

const SEISMIC_PRA_EXAMPLES: PosExampleEntry[] = [
  { id: "htgr", label: "Generic HTGR", slug: SEISMIC_PRA_GENERIC_2_SLUG },
  { id: "sfr", label: "Generic SFR", slug: SEISMIC_PRA_GENERIC_1_SLUG },
];

const INTERNAL_FLOOD_PRA_EXAMPLES: PosExampleEntry[] = [
  { id: "htgr", label: "Generic HTGR", slug: INTERNAL_FLOOD_PRA_GENERIC_1_SLUG },
  { id: "sfr", label: "Generic SFR", slug: INTERNAL_FLOOD_PRA_GENERIC_2_SLUG },
];

const INTERNAL_FIRE_PRA_EXAMPLES: PosExampleEntry[] = [
  { id: "htgr", label: "Generic HTGR", slug: INTERNAL_FIRE_PRA_GENERIC_1_SLUG },
  { id: "sfr", label: "Generic SFR", slug: INTERNAL_FIRE_PRA_GENERIC_2_SLUG },
];

const HSA_EXAMPLES: PosExampleEntry[] = [
  { id: "htgr", label: "Generic HTGR", slug: HSA_GENERIC_1_SLUG },
  { id: "sfr", label: "Generic SFR", slug: HSA_GENERIC_2_SLUG },
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
  { slug: SY_GENERIC_2_SLUG, kind: "SY", mef: SY_ANALYSIS_HTGR },
  { slug: HR_GENERIC_1_SLUG, kind: "HRA", mef: HR_ANALYSIS },
  { slug: HR_GENERIC_2_SLUG, kind: "HRA", mef: HR_ANALYSIS_HTGR },
  { slug: DA_GENERIC_1_SLUG, kind: "DA", mef: DA_ANALYSIS },
  { slug: DA_GENERIC_2_SLUG, kind: "DA", mef: DA_ANALYSIS_HTGR },
  { slug: ESQ_GENERIC_1_SLUG, kind: "ESQ", mef: ESQ_ANALYSIS },
  { slug: ESQ_GENERIC_2_SLUG, kind: "ESQ", mef: ESQ_ANALYSIS_HTGR },
  { slug: MS_GENERIC_1_SLUG, kind: "MS", mef: MS_ANALYSIS },
  { slug: MS_GENERIC_2_SLUG, kind: "MS", mef: MS_ANALYSIS_HTGR },
  { slug: RC_GENERIC_1_SLUG, kind: "RC", mef: RC_ANALYSIS },
  { slug: RC_GENERIC_2_SLUG, kind: "RC", mef: RC_ANALYSIS_HTGR },
  { slug: RI_GENERIC_1_SLUG, kind: "RI", mef: RI_ANALYSIS },
  { slug: RI_GENERIC_2_SLUG, kind: "RI", mef: RI_ANALYSIS_HTGR },
  { slug: SEISMIC_PRA_GENERIC_1_SLUG, kind: "S", mef: SEISMIC_PRA_ANALYSIS },
  { slug: SEISMIC_PRA_GENERIC_2_SLUG, kind: "S", mef: SEISMIC_PRA_ANALYSIS_HTGR },
  { slug: INTERNAL_FLOOD_PRA_GENERIC_1_SLUG, kind: "FL", mef: INTERNAL_FLOOD_PRA_ANALYSIS },
  { slug: INTERNAL_FLOOD_PRA_GENERIC_2_SLUG, kind: "FL", mef: INTERNAL_FLOOD_PRA_ANALYSIS_SFR },
  { slug: INTERNAL_FIRE_PRA_GENERIC_1_SLUG, kind: "F", mef: INTERNAL_FIRE_PRA_ANALYSIS },
  { slug: INTERNAL_FIRE_PRA_GENERIC_2_SLUG, kind: "F", mef: INTERNAL_FIRE_PRA_ANALYSIS_SFR },
  { slug: HSA_GENERIC_1_SLUG, kind: "HS", mef: HAZARDS_SCREENING_ANALYSIS_HTGR },
  { slug: HSA_GENERIC_2_SLUG, kind: "HS", mef: HAZARDS_SCREENING_ANALYSIS_SFR },
  { slug: CC_GENERIC_1_SLUG, kind: "CONFIGURATION_CONTROL", mef: CC_SNAPSHOT_INSTANCE },
  ...NM_INSTANCES.map((nm) => ({ slug: nmSlug(nm.uuid), kind: "NEWLY_DEVELOPED_METHOD" as const, mef: nm })),
];

function exampleWorkbookName(slug: string): string {
  const seed = SEEDS.find((s) => s.slug === slug);
  const name = seed === undefined ? undefined : (seed.mef as { name?: string }).name;
  if (name === undefined || name.length === 0) throw new Error(`No example workbook name for slug ${slug}`);
  return name;
}

export { SEEDS, exampleWorkbookName, POS_EXAMPLES, IE_EXAMPLES, ES_EXAMPLES, SC_EXAMPLES, SY_EXAMPLES, HR_EXAMPLES, DA_EXAMPLES, ESQ_EXAMPLES, MS_EXAMPLES, RC_EXAMPLES, RI_EXAMPLES, SEISMIC_PRA_EXAMPLES, INTERNAL_FLOOD_PRA_EXAMPLES, INTERNAL_FIRE_PRA_EXAMPLES, HSA_EXAMPLES, POS_GENERIC_1_SLUG, POS_GENERIC_2_SLUG, IE_GENERIC_1_SLUG, IE_GENERIC_2_SLUG, ES_GENERIC_1_SLUG, ES_GENERIC_2_SLUG, SC_GENERIC_1_SLUG, SC_GENERIC_2_SLUG, SY_GENERIC_1_SLUG, SY_GENERIC_2_SLUG, HR_GENERIC_1_SLUG, HR_GENERIC_2_SLUG, DA_GENERIC_1_SLUG, DA_GENERIC_2_SLUG, ESQ_GENERIC_1_SLUG, ESQ_GENERIC_2_SLUG, MS_GENERIC_1_SLUG, MS_GENERIC_2_SLUG, RC_GENERIC_1_SLUG, RC_GENERIC_2_SLUG, RI_GENERIC_1_SLUG, RI_GENERIC_2_SLUG, SEISMIC_PRA_GENERIC_1_SLUG, SEISMIC_PRA_GENERIC_2_SLUG, INTERNAL_FLOOD_PRA_GENERIC_1_SLUG, INTERNAL_FLOOD_PRA_GENERIC_2_SLUG, INTERNAL_FIRE_PRA_GENERIC_1_SLUG, INTERNAL_FIRE_PRA_GENERIC_2_SLUG, HSA_GENERIC_1_SLUG, HSA_GENERIC_2_SLUG, CC_GENERIC_1_SLUG, type SeedEntry, type PosExampleEntry };
