import type { DaCcfEvidenceImportKind, DaCcfImportKind, DaSource, DaSourceEntry } from "interfaces-mef-types/da/data-analysis";
import type { CcfFactorModel } from "interfaces-mef-types/core/uncertainty";

type DaCcfModel = CcfFactorModel["model"];

interface DaCcfSizes {
  min: number;
  max: number | null;
}

interface DaCcfChoice {
  sourceId: string;
  kind: DaCcfImportKind;
  template: string;
  model: DaCcfModel;
  component: string;
  failureMode: string;
  table: string;
  sizes: number[] | DaCcfSizes;
  converts: boolean;
}

interface DaCcfCount {
  k: number;
  count: number;
  rowId: string;
}

interface DaCcfEvidenceChoice {
  sourceId: string;
  kind: DaCcfEvidenceImportKind;
  set: string;
  component: string;
  failureMode: string;
  table: string;
  size?: number;
  independent?: number;
  counts: DaCcfCount[];
}

interface DaCcfUnusableRow {
  sourceId: string;
  rowId: string;
  reason: string;
}

interface DaCcfSurvey {
  choices: DaCcfChoice[];
  evidence: DaCcfEvidenceChoice[];
  unusable: DaCcfUnusableRow[];
}

interface DaCcfRowSet {
  rows: DaSourceEntry[];
  values: number[];
  checks: DaSourceEntry[];
}

const EBR_II = "EBR-II-PRA";

const CCF_2020 = "CCF-2020";

const ICDE = "ICDE";

const CR_4550 = "NUREG-CR-4550";

const CR_6890 = "NUREG-CR-6890";

const WSRC = "WSRC-TR-93-262";

const CCF_2020_LETTERS: readonly string[] = ["BETA", "GAMMA", "DELTA", "EPSILON", "MU", "OMEGA", "SIGMA"];

const MODEL_LETTERS: readonly string[] = ["BETA", "GAMMA", "DELTA", "EPSILON"];

const KIND_MODEL: Record<DaCcfImportKind, DaCcfModel> = {
  ALPHA_DIRICHLET: "ALPHA_FACTOR",
  ALPHA_MLE: "ALPHA_FACTOR",
  ALPHA_SUMMARY: "ALPHA_FACTOR",
  ALPHA_POINTS: "ALPHA_FACTOR",
  MGL: "MGL",
  BETA: "BETA_FACTOR",
};

const REASONS = {
  incomplete: "The set for this group size is incomplete, so it cannot give every factor.",
  zeroMle: "Every alpha MLE of this set is 0 because no event was seen. The set cannot be scaled to add to 1.",
  earlier2015: "Only the all-fail alpha of the 2015 Update is printed, for comparison. It is not a full set.",
  original2020: "Only one alpha of the original 2020 report is printed, for comparison. It is not a full set.",
  priorUsed: "Only the all-fail alpha of the prior used in 2015 is printed. It is not a full set.",
  fleet: "A fleet count of events per year, not a factor or a count for one group.",
  unreadable: "Not a factor set or a count DA can read.",
  population: "A population size distribution, not counts of failed components.",
  noExactCount: "Counts events with at least two complete failures without the number failed.",
  descriptive: "A descriptive share of events (cause, coupling, detection and the like). It gives no factor and no count of failed components.",
  reclose: "A probability per transient of failing to reclose, not a factor.",
  ratio: "A ratio of a combination probability to the single failure probability, derived from Table 7.36. It is not a model parameter.",
  eventProbability: "A common cause event probability per demand, not a factor.",
  initiatorShare: "The share of an initiator frequency modeled as common cause, not a factor.",
  noEvent: "The table lists no common cause event for this group.",
} as const;

function numberOf(text: string): number | undefined {
  if (text.trim().length === 0) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

function integerAfter(text: string, prefix: string): number | undefined {
  if (!text.startsWith(prefix)) return undefined;
  const value = numberOf(text.slice(prefix.length));
  return value !== undefined && Number.isInteger(value) ? value : undefined;
}

function baseFailureMode(text: string): string {
  const cut = text.indexOf(", CCCG");
  return cut === -1 ? text : text.slice(0, cut);
}

function pointValue(entry: DaSourceEntry | undefined): number | undefined {
  const law = entry?.law;
  return law?.family === "POINT" ? law.value : undefined;
}

function factorMean(entry: DaSourceEntry | undefined): number | undefined {
  const law = entry?.law;
  if (law?.family === "POINT") return law.value;
  if (law?.family !== "BETA" || !(law.alpha > 0 && law.beta > 0)) return undefined;
  return law.lower + ((law.upper - law.lower) * law.alpha) / (law.alpha + law.beta);
}

function betaShape(entry: DaSourceEntry | undefined): { alpha: number; beta: number } | undefined {
  const law = entry?.law;
  if (law === undefined || law.family !== "BETA") return undefined;
  return law.lower === 0 && law.upper === 1 && law.alpha > 0 && law.beta > 0 ? { alpha: law.alpha, beta: law.beta } : undefined;
}

interface AlphaId {
  template: string;
  size: number;
  order: number;
  suffix: "" | "MLE" | "SUM";
}

function alphaId(id: string): AlphaId | undefined {
  const parts = id.split("-");
  const last = parts[parts.length - 1] ?? "";
  const suffix = last === "MLE" || last === "SUM" ? last : "";
  const core = suffix === "" ? parts : parts.slice(0, -1);
  if (core.length < 3) return undefined;
  const order = integerAfter(core[core.length - 1] ?? "", "A");
  const size = integerAfter(core[core.length - 2] ?? "", "C");
  if (order === undefined || size === undefined || size < 2 || order < 1 || order > size) return undefined;
  return { template: core.slice(0, -2).join("-"), size, order, suffix };
}

function cccgId(id: string): { template: string; size: number; order: number } | undefined {
  const parts = id.split("-");
  if (parts.length < 3) return undefined;
  const order = integerAfter(parts[parts.length - 1] ?? "", "A");
  const size = integerAfter(parts[parts.length - 2] ?? "", "CCCG");
  if (order === undefined || size === undefined || size < 2 || order < 1 || order > size) return undefined;
  return { template: parts.slice(0, -2).join("-"), size, order };
}

function mglId(id: string): { template: string; size: number; letter: string } | undefined {
  const parts = id.split("-");
  const at = parts.indexOf("MGL");
  if (at < 2) return undefined;
  const size = integerAfter(parts[at - 1] ?? "", "C");
  if (size === undefined || size < 2) return undefined;
  return { template: parts.slice(0, at - 1).join("-"), size, letter: parts.slice(at + 1).join("-") };
}

function alphaRowIds(kind: DaCcfImportKind, template: string, size: number): string[] {
  return Array.from({ length: size }, (_, index) => {
    const order = index + 1;
    if (kind === "ALPHA_POINTS") return `${template}-CCCG${size}-A${order}`;
    if (kind === "ALPHA_MLE") return `${template}-C${size}-A${order}-MLE`;
    if (kind === "ALPHA_SUMMARY") return `${template}-C${size}-A${order}-SUM`;
    return `${template}-C${size}-A${order}`;
  });
}

function ccf2020MglIds(template: string, size: number): string[] {
  return CCF_2020_LETTERS.slice(0, size - 1).map((letter) => `${template}-C${size}-MGL-${letter}`);
}

function ebrIndependentCount(method: string | undefined): number | undefined {
  const text = method ?? "";
  const marker = "Independent events: ";
  const at = text.indexOf(marker);
  if (at === -1) return undefined;
  const rest = text.slice(at + marker.length);
  const end = rest.indexOf(". ");
  const list = (end === -1 ? rest : rest.slice(0, end)).trim();
  const trimmed = list.endsWith(".") ? list.slice(0, -1) : list;
  const items = trimmed.split(", ").map((item) => item.trim()).filter((item) => item.length > 0);
  if (items.length < 2 || items.some((item) => item.includes(" ") || item.includes("etc") || item.includes("applicable"))) return undefined;
  return items.length;
}

function betaSizes(entry: DaSourceEntry): DaCcfSizes | undefined {
  const id = entry.id;
  const parts = id.split("-");
  const last = parts[parts.length - 1] ?? "";
  if (id.startsWith("N4550-T6-2-1-")) {
    if (last.endsWith("PLUS")) {
      const min = numberOf(last.slice(0, -4));
      return min === undefined ? undefined : { min, max: null };
    }
    const size = numberOf(last === "B" ? parts[parts.length - 2] ?? "" : last);
    return size === undefined ? undefined : { min: size, max: size };
  }
  if (id.startsWith("AG7-BETA-")) return { min: 2, max: null };
  if (id.startsWith("EB-T7-36-BETAN-N")) {
    const size = integerAfter(last, "N");
    if (size === undefined) return undefined;
    return entry.component.includes("or more") ? { min: size, max: null } : { min: size, max: size };
  }
  if (id === "EA-S6214-BETA-LT4") return { min: 2, max: 3 };
  if (id === "EA-S6214-BETA-4TO5") return { min: 4, max: 5 };
  if (id === "EA-S6214-BETA-GE6") return { min: 6, max: null };
  if (id.startsWith("EB-T7-38-")) {
    const count = ebrIndependentCount(entry.method);
    return count === undefined ? { min: 2, max: null } : { min: count, max: count };
  }
  return undefined;
}

function sizesFit(sizes: number[] | DaCcfSizes, size: number): boolean {
  if (Array.isArray(sizes)) return sizes.includes(size);
  return size >= sizes.min && (sizes.max === null || size <= sizes.max);
}

function sizesText(sizes: number[] | DaCcfSizes): string {
  if (Array.isArray(sizes)) return `groups of ${sizes.join(", ")}`;
  if (sizes.max === null) return `groups of ${sizes.min} or more`;
  return sizes.min === sizes.max ? `groups of ${sizes.min}` : `groups of ${sizes.min} to ${sizes.max}`;
}

function impactVector(method: string | undefined): { size: number; independent: number; counts: number[] } | undefined {
  const text = method ?? "";
  const marker = "Impact vector for CCCG ";
  const at = text.indexOf(marker);
  if (at === -1) return undefined;
  const rest = text.slice(at + marker.length);
  const colon = rest.indexOf(":");
  const size = colon === -1 ? undefined : numberOf(rest.slice(0, colon));
  if (size === undefined || !Number.isInteger(size) || size < 2) return undefined;
  const body = rest.slice(colon + 1).trim();
  const items = (body.endsWith(".") ? body.slice(0, -1) : body).split(", ");
  let independent: number | undefined;
  const counts: number[] = [];
  for (const item of items) {
    const space = item.lastIndexOf(" ");
    const label = item.slice(0, space).trim();
    const value = numberOf(item.slice(space + 1));
    if (value === undefined || space === -1) return undefined;
    if (label === "Adj. Ind") independent = value;
    else if (label === `N${counts.length + 1}`) counts.push(value);
    else return undefined;
  }
  if (independent === undefined || counts.length !== size) return undefined;
  return { size, independent, counts };
}

function surveyCcf2020(source: DaSource, entries: readonly DaSourceEntry[], survey: DaCcfSurvey): void {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const alphaSets = new Map<string, { kind: DaCcfImportKind; template: string; size: number; first: DaSourceEntry; rows: DaSourceEntry[] }>();
  const mglSets = new Map<string, { template: string; size: number; first: DaSourceEntry; rows: DaSourceEntry[] }>();
  const vectors = new Map<string, DaCcfEvidenceChoice>();
  for (const entry of entries) {
    const id = entry.id;
    if (entry.quantity === "PER_YEAR") {
      survey.unusable.push({ sourceId: source.id, rowId: id, reason: REASONS.fleet });
      continue;
    }
    if (id.endsWith("-2015")) {
      survey.unusable.push({ sourceId: source.id, rowId: id, reason: id.startsWith("CCF-PRIOR-USED") ? REASONS.priorUsed : REASONS.earlier2015 });
      continue;
    }
    if (id.startsWith("CCF-PRIOR-USED")) {
      survey.unusable.push({ sourceId: source.id, rowId: id, reason: REASONS.priorUsed });
      continue;
    }
    if (id.endsWith("-ORIG2020")) {
      survey.unusable.push({ sourceId: source.id, rowId: id, reason: REASONS.original2020 });
      continue;
    }
    const mgl = mglId(id);
    if (mgl !== undefined) {
      const key = `${mgl.template}|${mgl.size}`;
      const set = mglSets.get(key) ?? { template: mgl.template, size: mgl.size, first: entry, rows: [] };
      set.rows.push(entry);
      mglSets.set(key, set);
      continue;
    }
    const alpha = alphaId(id);
    const kind: DaCcfImportKind | undefined = alpha === undefined ? undefined : alpha.suffix === "MLE" ? "ALPHA_MLE" : alpha.suffix === "SUM" ? "ALPHA_SUMMARY" : betaShape(entry) !== undefined ? "ALPHA_DIRICHLET" : undefined;
    if (alpha === undefined || kind === undefined) {
      survey.unusable.push({ sourceId: source.id, rowId: id, reason: REASONS.unreadable });
      continue;
    }
    const key = `${kind}|${alpha.template}|${alpha.size}`;
    const set = alphaSets.get(key) ?? { kind, template: alpha.template, size: alpha.size, first: entry, rows: [] };
    set.rows.push(entry);
    alphaSets.set(key, set);
    const vector = alpha.order === 1 ? impactVector(entry.method) : undefined;
    const vectorKey = `${alpha.template}|${alpha.size}`;
    if (vector !== undefined && vector.size === alpha.size && !vectors.has(vectorKey)) {
      vectors.set(vectorKey, {
        sourceId: source.id,
        kind: "IMPACT_VECTOR",
        set: `${alpha.template}-C${alpha.size}`,
        component: entry.component,
        failureMode: baseFailureMode(entry.failureMode),
        table: entry.table ?? "",
        size: alpha.size,
        independent: vector.independent,
        counts: vector.counts.map((count, index) => ({ k: index + 1, count, rowId: id })),
      });
    }
  }
  const sizes = new Map<string, { first: DaSourceEntry; kind: DaCcfImportKind; template: string; sizes: number[] }>();
  for (const set of alphaSets.values()) {
    const ids = alphaRowIds(set.kind, set.template, set.size);
    const complete = ids.every((rowId) => byId.has(rowId)) && set.rows.length === set.size;
    const values = ids.map((rowId) => pointValue(byId.get(rowId)) ?? 0);
    const zero = set.kind !== "ALPHA_DIRICHLET" && values.every((value) => value === 0);
    if (!complete || zero) {
      for (const row of set.rows) survey.unusable.push({ sourceId: source.id, rowId: row.id, reason: zero ? REASONS.zeroMle : REASONS.incomplete });
      continue;
    }
    const key = `${set.kind}|${set.template}`;
    const found = sizes.get(key) ?? { first: set.first, kind: set.kind, template: set.template, sizes: [] };
    found.sizes.push(set.size);
    sizes.set(key, found);
  }
  for (const found of sizes.values()) {
    survey.choices.push({ sourceId: source.id, kind: found.kind, template: found.template, model: "ALPHA_FACTOR", component: found.first.component, failureMode: baseFailureMode(found.first.failureMode), table: found.first.table ?? "", sizes: found.sizes.sort((a, b) => a - b), converts: false });
  }
  const mglSizes = new Map<string, { first: DaSourceEntry; sizes: number[] }>();
  for (const set of mglSets.values()) {
    const ids = ccf2020MglIds(set.template, set.size);
    const complete = ids.every((rowId) => byId.has(rowId)) && set.rows.every((row) => ids.includes(row.id) || row.id === `${set.template}-C${set.size}-MGL-ONE-MINUS-BETA`);
    if (!complete) {
      for (const row of set.rows) survey.unusable.push({ sourceId: source.id, rowId: row.id, reason: REASONS.incomplete });
      continue;
    }
    const found = mglSizes.get(set.template) ?? { first: set.first, sizes: [] };
    found.sizes.push(set.size);
    mglSizes.set(set.template, found);
  }
  for (const [template, found] of mglSizes) {
    survey.choices.push({ sourceId: source.id, kind: "MGL", template, model: "MGL", component: found.first.component, failureMode: baseFailureMode(found.first.failureMode), table: found.first.table ?? "", sizes: found.sizes.sort((a, b) => a - b), converts: false });
  }
  survey.evidence.push(...vectors.values());
}

function surveyIcde(source: DaSource, entries: readonly DaSourceEntry[], survey: DaCcfSurvey): void {
  const sets = new Map<string, DaCcfEvidenceChoice>();
  for (const entry of entries) {
    const parts = entry.id.split("-");
    const last = parts[parts.length - 1] ?? "";
    const table = entry.table ?? "";
    const complete = entry.id.startsWith("ICRD-T14-") ? integerAfter(last, "C") : undefined;
    const affected = entry.id.startsWith("ICRD-T13-") ? integerAfter(last, "AF") : undefined;
    const k = complete ?? affected;
    const count = entry.failures;
    if (k !== undefined && count !== undefined && count >= 0) {
      const set = parts.slice(0, -1).join("-");
      const found = sets.get(set) ?? { sourceId: source.id, kind: "MULTIPLICITY", set, component: entry.component, failureMode: complete !== undefined ? "Events by the number of completely failed components" : "Events by the number of affected components", table, counts: [] };
      found.counts.push({ k, count, rowId: entry.id });
      sets.set(set, found);
      continue;
    }
    const reason = table.toLowerCase().includes("population") ? REASONS.population : entry.id.startsWith("ILM-T62-") ? REASONS.noExactCount : REASONS.descriptive;
    survey.unusable.push({ sourceId: source.id, rowId: entry.id, reason });
  }
  survey.evidence.push(...[...sets.values()].map((set) => ({ ...set, counts: [...set.counts].sort((a, b) => a.k - b.k) })));
}

function surveyCr6890(source: DaSource, entries: readonly DaSourceEntry[], survey: DaCcfSurvey): void {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const sets = new Map<string, { first: DaSourceEntry; sizes: Set<number>; rows: DaSourceEntry[] }>();
  for (const entry of entries) {
    const parsed = entry.id.includes("-CCCG") ? cccgId(entry.id) : undefined;
    if (parsed === undefined) continue;
    const found = sets.get(parsed.template) ?? { first: entry, sizes: new Set<number>(), rows: [] };
    found.sizes.add(parsed.size);
    found.rows.push(entry);
    sets.set(parsed.template, found);
  }
  for (const [template, found] of sets) {
    const complete = [...found.sizes].filter((size) => alphaRowIds("ALPHA_POINTS", template, size).every((rowId) => pointValue(byId.get(rowId)) !== undefined));
    for (const row of found.rows) {
      const parsed = cccgId(row.id);
      if (parsed !== undefined && !complete.includes(parsed.size)) survey.unusable.push({ sourceId: source.id, rowId: row.id, reason: REASONS.incomplete });
    }
    if (complete.length > 0) survey.choices.push({ sourceId: source.id, kind: "ALPHA_POINTS", template, model: "ALPHA_FACTOR", component: found.first.component, failureMode: baseFailureMode(found.first.failureMode), table: found.first.table ?? "", sizes: complete.sort((a, b) => a - b), converts: false });
  }
}

function betaChoice(source: DaSource, entry: DaSourceEntry, survey: DaCcfSurvey, converts: boolean): void {
  const sizes = betaSizes(entry);
  if (sizes === undefined || entry.law === undefined) {
    survey.unusable.push({ sourceId: source.id, rowId: entry.id, reason: REASONS.unreadable });
    return;
  }
  survey.choices.push({ sourceId: source.id, kind: "BETA", template: entry.id, model: "BETA_FACTOR", component: entry.component, failureMode: entry.failureMode, table: entry.table ?? "", sizes, converts });
}

function singleMgl(source: DaSource, entry: DaSourceEntry, survey: DaCcfSurvey): void {
  survey.choices.push({ sourceId: source.id, kind: "MGL", template: entry.id, model: "MGL", component: entry.component, failureMode: entry.failureMode, table: entry.table ?? "", sizes: { min: 2, max: null }, converts: false });
}

function surveyCr4550(source: DaSource, entries: readonly DaSourceEntry[], survey: DaCcfSurvey): void {
  for (const entry of entries) {
    if (entry.id.startsWith("N4550-S6-MGL-")) {
      singleMgl(source, entry, survey);
      continue;
    }
    if (!entry.id.startsWith("N4550-T6-2-1-")) continue;
    if (entry.id.includes("-FTRC-")) {
      survey.unusable.push({ sourceId: source.id, rowId: entry.id, reason: REASONS.reclose });
      continue;
    }
    betaChoice(source, entry, survey, false);
  }
}

function surveyWsrc(source: DaSource, entries: readonly DaSourceEntry[], survey: DaCcfSurvey): void {
  for (const entry of entries) if (entry.id.startsWith("AG7-BETA-")) betaChoice(source, entry, survey, false);
}

function surveyEbr(source: DaSource, entries: readonly DaSourceEntry[], survey: DaCcfSurvey): void {
  const models = new Map<string, { first: DaSourceEntry; letters: Set<string> }>();
  for (const entry of entries) {
    const id = entry.id;
    if (id.startsWith("EB-T7-37-")) {
      survey.unusable.push({ sourceId: source.id, rowId: id, reason: REASONS.ratio });
      continue;
    }
    if (id.startsWith("EA-T58-") && id.endsWith("-CCFRAC")) {
      survey.unusable.push({ sourceId: source.id, rowId: id, reason: REASONS.initiatorShare });
      continue;
    }
    if (id.startsWith("EA-S6216-") && id.endsWith("-CCF")) {
      survey.unusable.push({ sourceId: source.id, rowId: id, reason: REASONS.eventProbability });
      continue;
    }
    if (id.startsWith("EB-T7-36-MGL")) {
      const parts = id.split("-");
      const letter = parts[parts.length - 1] ?? "";
      const template = parts.slice(0, -1).join("-");
      const found = models.get(template) ?? { first: entry, letters: new Set<string>() };
      found.letters.add(letter);
      models.set(template, found);
      continue;
    }
    if (id.startsWith("EB-T7-38-") && id.endsWith("-NONE")) {
      survey.unusable.push({ sourceId: source.id, rowId: id, reason: REASONS.noEvent });
      continue;
    }
    if (id.startsWith("EB-T7-36-BETAN-") || id.startsWith("EA-S6214-BETA-") || id.startsWith("EB-T7-38-")) betaChoice(source, entry, survey, true);
  }
  for (const [template, found] of models) {
    if (!MODEL_LETTERS.every((letter) => found.letters.has(letter))) {
      for (const letter of found.letters) survey.unusable.push({ sourceId: source.id, rowId: `${template}-${letter}`, reason: REASONS.incomplete });
      continue;
    }
    survey.choices.push({ sourceId: source.id, kind: "MGL", template, model: "MGL", component: found.first.component, failureMode: "Generic MGL model", table: found.first.table ?? "", sizes: { min: 2, max: null }, converts: false });
  }
}

function surveyGeneric(source: DaSource, entries: readonly DaSourceEntry[], survey: DaCcfSurvey): void {
  const sets = new Map<string, { first: DaSourceEntry; orders: Map<number, Set<number>> }>();
  for (const entry of entries) {
    const parsed = alphaId(entry.id);
    if (parsed === undefined || parsed.suffix !== "" || betaShape(entry) === undefined) continue;
    const found = sets.get(parsed.template) ?? { first: entry, orders: new Map<number, Set<number>>() };
    const orders = found.orders.get(parsed.size) ?? new Set<number>();
    orders.add(parsed.order);
    found.orders.set(parsed.size, orders);
    sets.set(parsed.template, found);
  }
  for (const [template, found] of sets) {
    const sizes = [...found.orders.entries()].filter(([size, seen]) => seen.size === size).map(([size]) => size).sort((a, b) => a - b);
    if (sizes.length > 0) survey.choices.push({ sourceId: source.id, kind: "ALPHA_DIRICHLET", template, model: "ALPHA_FACTOR", component: found.first.component, failureMode: baseFailureMode(found.first.failureMode), table: found.first.table ?? "", sizes, converts: false });
  }
}

function ccfSurvey(source: DaSource, entries: readonly DaSourceEntry[]): DaCcfSurvey {
  const survey: DaCcfSurvey = { choices: [], evidence: [], unusable: [] };
  switch (source.catalogId) {
    case CCF_2020: surveyCcf2020(source, entries, survey); break;
    case ICDE: surveyIcde(source, entries, survey); break;
    case CR_6890: surveyCr6890(source, entries, survey); break;
    case CR_4550: surveyCr4550(source, entries, survey); break;
    case WSRC: surveyWsrc(source, entries, survey); break;
    case EBR_II: surveyEbr(source, entries, survey); break;
    default: surveyGeneric(source, entries, survey);
  }
  return survey;
}

function convertsBeta(source: DaSource | undefined): boolean {
  return source?.catalogId === EBR_II;
}

function readSet(kind: DaCcfImportKind, template: string, size: number, entries: readonly DaSourceEntry[]): DaCcfRowSet | string {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  if (kind === "BETA") {
    const row = byId.get(template);
    if (row === undefined) return `${template} is not stored in the workbook. Pick the beta factor again to store it.`;
    const sizes = betaSizes(row);
    if (sizes !== undefined && !sizesFit(sizes, size)) return `${template} is a beta factor for ${sizesText(sizes)}, not for a group of ${size}.`;
    return { rows: [row], values: [], checks: [] };
  }
  if (kind === "MGL") {
    if (byId.has(`${template}-C${size}-MGL-BETA`)) {
      const ids = ccf2020MglIds(template, size);
      const rows = ids.map((id) => byId.get(id));
      const missing = ids.find((id, index) => factorMean(rows[index]) === undefined);
      if (missing !== undefined) return `${missing} is not stored in the workbook. Pick the MGL set again to store it.`;
      const check = byId.get(`${template}-C${size}-MGL-ONE-MINUS-BETA`);
      return { rows: rows.flatMap((row) => (row === undefined ? [] : [row])), values: rows.map((row) => factorMean(row) ?? 0), checks: check === undefined ? [] : [check] };
    }
    if (byId.has(`${template}-BETA`)) {
      const ids = MODEL_LETTERS.slice(0, size - 1).map((letter) => `${template}-${letter}`);
      const rows = ids.map((id) => byId.get(id));
      const missing = ids.find((id, index) => pointValue(rows[index]) === undefined);
      if (missing !== undefined) return `${missing} is not stored in the workbook. Pick the MGL set again to store it.`;
      return { rows: rows.flatMap((row) => (row === undefined ? [] : [row])), values: rows.map((row) => pointValue(row) ?? 0), checks: [] };
    }
    const single = byId.get(template);
    const value = pointValue(single);
    if (single === undefined || value === undefined) return `${template} has no MGL set stored for a group of ${size}. Pick the set again to store it.`;
    return { rows: [single], values: [value], checks: [] };
  }
  const ids = alphaRowIds(kind, template, size);
  const rows = ids.map((id) => byId.get(id));
  const missing = ids.find((id, index) => rows[index] === undefined);
  if (missing !== undefined) return `${template} has no alpha factors stored for a group of ${size}. Pick the set again to store them.`;
  const present = rows.flatMap((row) => (row === undefined ? [] : [row]));
  if (kind === "ALPHA_DIRICHLET") {
    const values: number[] = [];
    for (const row of present) {
      const shape = betaShape(row);
      if (shape === undefined) return `${row.id} has no beta law to rebuild the factors from.`;
      values.push(shape.alpha);
    }
    return { rows: present, values, checks: [] };
  }
  const values: number[] = [];
  for (const row of present) {
    const value = pointValue(row);
    if (value === undefined || !(value >= 0 && value <= 1)) return `${row.id} gives no alpha factor between 0 and 1.`;
    values.push(value);
  }
  return { rows: present, values, checks: [] };
}

function rowIdsFor(kind: DaCcfImportKind, template: string, size: number, entries: readonly DaSourceEntry[]): string[] {
  const set = readSet(kind, template, size, entries);
  if (typeof set === "string") return [];
  return [...set.rows, ...set.checks].map((row) => row.id);
}

function evidenceChoiceRows(choice: DaCcfEvidenceChoice): string[] {
  return [...new Set(choice.counts.map((count) => count.rowId))];
}

export {
  KIND_MODEL,
  ccfSurvey,
  convertsBeta,
  evidenceChoiceRows,
  readSet,
  rowIdsFor,
  sizesFit,
  sizesText,
  type DaCcfChoice,
  type DaCcfCount,
  type DaCcfEvidenceChoice,
  type DaCcfModel,
  type DaCcfRowSet,
  type DaCcfSizes,
  type DaCcfSurvey,
  type DaCcfUnusableRow,
};
