import {
  type EsqActionFeasibility,
  type EsqActionRecord,
  type EsqBarrierEntry,
  type EsqBarrierMode,
  type EsqBarrierModeKind,
  type EsqBarrierRecord,
  type EsqBarrierWork,
  type EsqCell,
  type EsqCellRun,
  type EsqCellSide,
  type EsqCellUse,
  type EsqCredit,
  type EsqCriterionRecord,
  type EsqMechanism,
  type EsqMechanismKind,
  type EsqModel,
  type EsqPhenomenaLogic,
  type EsqPhenomenonRecord,
  type EsqQualificationRecord,
  type EventSequenceQuantification,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import {
  barrierWorkOf,
  cellExpressionOfRecord,
  cellOf,
  cellRunStale,
  cellRunValue,
  resolveCell,
} from "interfaces-mef-types/esq/esq-barrier-inputs";
import { expressionText, lawText } from "../newly-developed-methods/shared/uncertainText";
import { modelViewOf, sameItem, type EsqFindingSeverity } from "./esqModel";
import { ESQ_EXTERNAL_HAZARD_GROUPS } from "./esqViewData";

type EsqBarrierTarget =
  | { kind: "cell"; id: string }
  | { kind: "credit"; id: string }
  | { kind: "qualification"; id: string }
  | { kind: "logic" };

interface EsqBarrierFinding {
  severity: EsqFindingSeverity;
  check: string;
  item: string;
  detail: string;
  target?: EsqBarrierTarget;
}

interface EsqBarrierView {
  id: string;
  name: string;
  record?: EsqBarrierRecord;
  entry?: EsqBarrierEntry;
  manual: boolean;
  sourceNames: string[];
  criterion?: EsqCriterionRecord;
  modes: EsqBarrierMode[];
  cells: EsqCell[];
}

interface EsqPhenomenonView {
  mechanism: EsqMechanism;
  record?: EsqPhenomenonRecord;
  name: string;
  fromEs: boolean;
  affected: string[];
}

interface EsqCellView {
  cell: EsqCell;
  barrier?: EsqBarrierView;
  mode?: EsqBarrierMode;
  phenomena: EsqPhenomenonView[];
  familyName?: string;
  runValue?: number;
  expression?: UncertainExpression;
  stale: boolean;
  problem?: string;
  usedBy: string[];
}

interface EsqCreditRow {
  key: string;
  kind: "EQUIPMENT" | "ACTION";
  name: string;
  credit?: EsqCredit;
  qualification?: EsqQualificationRecord;
  action?: EsqActionRecord;
}

interface EsqFamilyOption {
  id: string;
  name: string;
}

interface EsqBarriersView {
  model: EsqModel;
  barriers: EsqBarrierView[];
  phenomena: EsqPhenomenonView[];
  esPhenomena: EsqPhenomenonRecord[];
  cells: EsqCellView[];
  credits: EsqCreditRow[];
  criteria: EsqCriterionRecord[];
  impactRefs: string[];
  qualifications: EsqQualificationRecord[];
  actions: EsqActionRecord[];
  families: EsqFamilyOption[];
  sources: string[];
  systems: string[];
  hazards: string[];
  logic?: EsqPhenomenaLogic;
  findings: EsqBarrierFinding[];
}

const FINDING_RANK: Record<EsqFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const MODE_KIND_LABELS: Record<EsqBarrierModeKind, string> = { GROSS: "Gross", LOCALIZED: "Localized" };

const MECHANISM_KIND_LABELS: Record<EsqMechanismKind, string> = { PHENOMENON: "Phenomenon", DEGRADATION: "Degradation", HAZARD: "Hazard" };

const CELL_USE_LABELS: Record<EsqCellUse, string> = { SPLIT_FRACTION: "Split fraction", END_STATE_ATTRIBUTE: "End-state attribute" };

const FEASIBILITY_LABELS: Record<keyof EsqActionFeasibility, string> = {
  procedure: "Procedure",
  training: "Training",
  cues: "Cues",
  crew: "Crew",
  time: "Time",
  access: "Access",
  equipment: "Equipment",
};

const FEASIBILITY_KEYS: (keyof EsqActionFeasibility)[] = ["cues", "procedure", "training", "crew", "time", "access", "equipment"];

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function listText(items: readonly string[], shown = 3): string {
  if (items.length <= shown) return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  return `${items.slice(0, shown).join(", ")} and ${items.length - shown} more`;
}

function uniqueTexts(items: readonly string[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    if (item.trim().length > 0 && !out.some((seen) => sameItem(seen, item))) out.push(item);
  }
  return out;
}

function numberText(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  const magnitude = Math.abs(value);
  if (magnitude >= 1e-3 && magnitude < 1e6) return String(Number(value.toPrecision(4)));
  const [mantissa, exponent] = value.toExponential(3).split("e");
  return `${Number(mantissa)}E${Number(exponent)}`;
}

function sideSourceText(side: EsqCellSide | undefined, unit: string): string {
  if (side === undefined) return "Not set";
  const suffix = unit.trim().length > 0 ? ` ${unit.trim()}` : "";
  if (side.source === "FRAGILITY") return `Fragility, median ${numberText(side.fragility.median)}${suffix}, randomness ${numberText(side.fragility.betaR)}, uncertainty ${numberText(side.fragility.betaU)}`;
  if (side.source === "DA") return `DA · ${side.parameterId}`;
  const sampled = side.variable.fields.length;
  return `${lawText(side.variable.law)}${suffix.length > 0 ? ` in${suffix}` : ""}${sampled > 0 ? ` · ${sampled} uncertain` : ""}`;
}

function cellRecordText(cell: EsqCell, parameterLabel: (key: string) => string): string {
  if (cell.ofRecord === "RUN") {
    const value = cellRunValue(cell);
    return value === undefined ? "No run kept" : numberText(value);
  }
  if (cell.ofRecord === "TYPED" && cell.typed !== undefined) return expressionText(cell.typed.expression, parameterLabel);
  return "—";
}

function cellSamples(cell: EsqCell): boolean {
  return [cell.load, cell.capacity].some((side) => (side?.source === "TYPED" && side.variable.fields.length > 0) || (side?.source === "FRAGILITY" && side.fragility.betaU > 0));
}

function modeLabel(mode: EsqBarrierMode | undefined): string {
  if (mode === undefined) return "Missing mode";
  return blank(mode.name) ? `${MODE_KIND_LABELS[mode.kind]} mode` : mode.name;
}

function qualificationName(record: EsqQualificationRecord): string {
  return listText(record.components.length > 0 ? record.components : [record.systemId]);
}

function barrierViews(model: EsqModel, work: EsqBarrierWork): EsqBarrierView[] {
  const entries = work.barriers ?? [];
  const records = model.barriers ?? [];
  const criteria = model.criteria ?? [];
  const cells = work.cells ?? [];
  const build = (id: string, record: EsqBarrierRecord | undefined, entry: EsqBarrierEntry | undefined): EsqBarrierView => {
    const manual = entry?.manual;
    const view: EsqBarrierView = {
      id,
      name: (manual !== undefined && !blank(manual.name) ? manual.name : record?.name) ?? id,
      manual: manual !== undefined,
      sourceNames: manual !== undefined ? manual.sourceNames : record?.sourceNames ?? [],
      modes: entry?.modes ?? [],
      cells: cells.filter((cell) => cell.barrierId === id),
    };
    if (record !== undefined) view.record = record;
    if (entry !== undefined) view.entry = entry;
    const criterion = entry?.criterionId === undefined ? undefined : criteria.find((candidate) => candidate.id === entry.criterionId);
    if (criterion !== undefined) view.criterion = criterion;
    return view;
  };
  const imported = records.map((record) => build(record.id, record, entries.find((entry) => entry.barrierId === record.id)));
  const rest = entries.filter((entry) => !records.some((record) => record.id === entry.barrierId)).map((entry) => build(entry.barrierId, undefined, entry));
  return [...imported, ...rest];
}

function phenomenonViews(model: EsqModel, work: EsqBarrierWork): EsqPhenomenonView[] {
  const records = model.phenomena ?? [];
  return (work.mechanisms ?? []).map((mechanism) => {
    const record = mechanism.phenomenonId === undefined ? undefined : records.find((candidate) => candidate.id === mechanism.phenomenonId);
    const fromEs = mechanism.phenomenonId !== undefined;
    const view: EsqPhenomenonView = {
      mechanism,
      name: record?.name ?? (blank(mechanism.name) ? mechanism.phenomenonId ?? mechanism.id : mechanism.name),
      fromEs,
      affected: fromEs ? record?.affectedSystems ?? [] : mechanism.equipment ?? [],
    };
    if (record !== undefined) view.record = record;
    return view;
  });
}

function cellUses(esq: EventSequenceQuantification): Map<string, string[]> {
  const uses = new Map<string, string[]>();
  for (const link of esq.modelDecisions?.functionLinks ?? []) {
    const targets = [link.target, ...(link.rules ?? []).map((rule) => rule.target)];
    for (const target of targets) {
      if (target?.kind !== "SPLIT_FRACTION" || target.cellId === undefined) continue;
      const list = uses.get(target.cellId) ?? [];
      if (!list.includes(link.functionId)) list.push(link.functionId);
      uses.set(target.cellId, list);
    }
  }
  return uses;
}

function cellViews(esq: EventSequenceQuantification, cells: readonly EsqCell[], barriers: readonly EsqBarrierView[], phenomena: readonly EsqPhenomenonView[], families: readonly EsqFamilyOption[]): EsqCellView[] {
  const uses = cellUses(esq);
  return cells.map((cell) => {
    const barrier = barriers.find((candidate) => candidate.id === cell.barrierId);
    const mode = barrier?.modes.find((candidate) => candidate.id === cell.modeId);
    const view: EsqCellView = {
      cell,
      phenomena: cell.mechanismIds.flatMap((id) => phenomena.filter((candidate) => candidate.mechanism.id === id)),
      stale: cellRunStale(cell),
      usedBy: uses.get(cell.id) ?? [],
    };
    if (barrier !== undefined) view.barrier = barrier;
    if (mode !== undefined) view.mode = mode;
    const family = cell.familyId === undefined ? undefined : families.find((candidate) => candidate.id === cell.familyId);
    if (family !== undefined) view.familyName = family.name;
    const runValue = cell.ofRecord === "RUN" ? cellRunValue(cell) : undefined;
    if (runValue !== undefined) view.runValue = runValue;
    const expression = cellExpressionOfRecord(cell);
    if (expression !== undefined) view.expression = expression;
    if (cell.screening === undefined) {
      const resolved = resolveCell(cell, esq);
      if (resolved.problem !== undefined) view.problem = resolved.problem;
    }
    return view;
  });
}

function creditRows(model: EsqModel, credits: readonly EsqCredit[]): EsqCreditRow[] {
  const qualifications = model.qualifications ?? [];
  const actions = model.actions ?? [];
  const listed = qualifications.filter((record) => record.beyondQualification || credits.some((credit) => credit.qualificationId === record.id));
  const imported = listed.map((record): EsqCreditRow => {
    const credit = credits.find((candidate) => candidate.kind === "EQUIPMENT" && candidate.qualificationId === record.id);
    const row: EsqCreditRow = { key: `sy:${record.id}`, kind: "EQUIPMENT", name: credit === undefined || blank(credit.name) ? qualificationName(record) : credit.name, qualification: record };
    if (credit !== undefined) row.credit = credit;
    return row;
  });
  const rest = credits
    .filter((credit) => !(credit.kind === "EQUIPMENT" && credit.qualificationId !== undefined && listed.some((record) => record.id === credit.qualificationId)))
    .map((credit): EsqCreditRow => {
      const row: EsqCreditRow = { key: credit.id, kind: credit.kind, name: blank(credit.name) ? credit.id : credit.name, credit };
      const action = credit.actionId === undefined ? undefined : actions.find((record) => record.id === credit.actionId);
      if (action !== undefined) row.action = action;
      return row;
    });
  return [...imported, ...rest];
}

function hazardsInScope(esq: EventSequenceQuantification): string[] {
  return esq.modelIntegration.scopeCoverage.hazardGroups.filter((group) => ESQ_EXTERNAL_HAZARD_GROUPS.some((external) => sameItem(external, group)));
}

function cellTarget(cell: EsqCell | undefined): EsqBarrierTarget | undefined {
  return cell === undefined ? undefined : { kind: "cell", id: cell.id };
}

function withTarget(finding: Omit<EsqBarrierFinding, "target">, target: EsqBarrierTarget | undefined): EsqBarrierFinding {
  return target === undefined ? finding : { ...finding, target };
}

function barrierFindings(view: EsqBarriersView): EsqBarrierFinding[] {
  const findings: EsqBarrierFinding[] = [];
  for (const barrier of view.barriers) {
    const item = barrier.name;
    const target = cellTarget(barrier.cells[0]);
    if (!barrier.manual && barrier.record === undefined && barrier.entry !== undefined) findings.push(withTarget({ severity: "warning", check: "Barrier not in POS", item, detail: `${item} is no longer in the imported POS workbook. Its cells are kept.` }, target));
    if (barrier.manual && blank(barrier.entry?.manual?.source)) findings.push(withTarget({ severity: "warning", check: "Source not given", item, detail: "Say where this barrier comes from." }, target));
    if (barrier.manual && barrier.sourceNames.length === 0) findings.push(withTarget({ severity: "warning", check: "No source", item, detail: "Name the radioactive sources this barrier holds." }, target));
    if (barrier.cells.length === 0) {
      findings.push({ severity: "error", check: "No cell", item, detail: `Add the failure modes of ${item} and the phenomena that challenge them (ESQ-C10, C12).` });
      continue;
    }
    if (!barrier.modes.some((mode) => mode.kind === "GROSS")) findings.push(withTarget({ severity: "error", check: "No gross mode", item, detail: `Add the gross failure mode of ${item} (ESQ-C10).` }, target));
    if (!barrier.modes.some((mode) => mode.kind === "LOCALIZED")) findings.push(withTarget({ severity: "error", check: "No localized mode", item, detail: `Add the localized failure mode of ${item} (ESQ-C10).` }, target));
    for (const mode of barrier.modes) {
      const user = barrier.cells.find((cell) => cell.modeId === mode.id);
      const modeTarget = cellTarget(user) ?? target;
      if (blank(mode.name)) findings.push(withTarget({ severity: "error", check: "Mode not named", item, detail: `Name the ${MODE_KIND_LABELS[mode.kind].toLowerCase()} mode ${mode.id}.` }, modeTarget));
      if (blank(mode.location)) findings.push(withTarget({ severity: "warning", check: "No location", item, detail: `Give the location of ${modeLabel(mode)} (ESQ-F1).` }, modeTarget));
      if (user === undefined) findings.push(withTarget({ severity: "warning", check: "Mode not assessed", item, detail: `No cell covers ${modeLabel(mode)}. Add the phenomenon that challenges it, or screen it (ESQ-C12, C13).` }, target));
    }
  }
  const entries = view.barriers.flatMap((barrier) => (barrier.entry === undefined ? [] : [barrier.entry]));
  for (const criterion of view.criteria) {
    if (entries.some((entry) => entry.criterionId === criterion.id)) continue;
    const parameter = criterion.parameters[0];
    findings.push({ severity: "note", check: "SC criterion not used", item: criterion.id, detail: `SC sets ${parameter === undefined ? "a criterion" : `${parameter.parameter.toLowerCase()} ${parameter.criterion.toLowerCase()}`} for ${criterion.barrierRef}. Map it to a barrier in a cell.` });
  }
  for (const ref of view.impactRefs) {
    if (entries.some((entry) => (entry.impactRefs ?? []).some((candidate) => sameItem(candidate, ref)))) continue;
    const count = (view.model.impacts ?? []).filter((impact) => sameItem(impact.barrierRef, ref)).length;
    findings.push({ severity: "note", check: "IE barrier not mapped", item: ref, detail: `IE names ${ref} in ${count} barrier ${count === 1 ? "impact" : "impacts"}. Map it to a barrier in a cell.` });
  }
  for (const record of view.esPhenomena) {
    const used = view.cells.some((entry) => entry.phenomena.some((phenomenon) => phenomenon.mechanism.phenomenonId === record.id));
    if (!used) findings.push({ severity: "note", check: "ES phenomenon not used", item: record.name, detail: `ES names ${record.name}. Use it in a cell, or screen it there (ESQ-C12).` });
  }
  return findings;
}

function phenomenonFindings(view: EsqBarriersView): EsqBarrierFinding[] {
  const findings: EsqBarrierFinding[] = [];
  for (const phenomenon of view.phenomena) {
    const users = view.cells.filter((entry) => entry.phenomena.some((candidate) => candidate.mechanism.id === phenomenon.mechanism.id));
    const first = users[0];
    if (first === undefined) continue;
    const target = cellTarget(first.cell);
    const mechanism = phenomenon.mechanism;
    const item = phenomenon.name;
    const quantified = users.some((entry) => entry.cell.screening === undefined);
    if (!phenomenon.fromEs && blank(mechanism.name)) findings.push(withTarget({ severity: "error", check: "Phenomenon not named", item, detail: "Name the phenomenon or mechanism." }, target));
    if (phenomenon.fromEs && phenomenon.record === undefined) findings.push(withTarget({ severity: "warning", check: "ES phenomenon missing", item, detail: `ES no longer lists ${mechanism.phenomenonId ?? item}. Import again in Step 02 or choose another phenomenon.` }, target));
    if (mechanism.kind === "HAZARD" && blank(mechanism.hazardGroup) && users.every((entry) => entry.cell.hazardGroup === undefined)) findings.push(withTarget({ severity: "error", check: "No hazard group", item, detail: "Choose the external hazard group that causes this mechanism (ESQ-C11)." }, target));
    if (quantified && phenomenon.affected.length > 0 && blank(mechanism.dependency)) findings.push(withTarget({ severity: "error", check: "No dependency assessment", item, detail: `Assess how ${item} affects ${listText(phenomenon.affected)} (ESQ-C4).` }, target));
    if (quantified && !phenomenon.fromEs && blank(mechanism.basis)) findings.push(withTarget({ severity: "warning", check: "Basis missing", item, detail: "Record the analysis behind this phenomenon." }, target));
  }
  const logic = view.logic;
  const logicTarget: EsqBarrierTarget = { kind: "logic" };
  if (logic === undefined) {
    findings.push({ severity: "warning", check: "Model logic not recorded", item: "Phenomena logic", detail: "Record whether the phenomena logic is in the model, with scrubbing and beneficial failures (ESQ-C6).", target: logicTarget });
  } else {
    if (blank(logic.basis)) findings.push({ severity: "warning", check: "Basis missing", item: "Phenomena logic", detail: "Say where the phenomena logic sits in the model (ESQ-C6).", target: logicTarget });
    if (logic.scrubbing?.credited === true && blank(logic.scrubbing.basis)) findings.push({ severity: "error", check: "Scrubbing without a basis", item: "Phenomena logic", detail: "Scrubbing credit needs a technical justification (ESQ-C6).", target: logicTarget });
    if (logic.beneficial?.credited === true && blank(logic.beneficial.basis)) findings.push({ severity: "error", check: "Beneficial failure without a basis", item: "Phenomena logic", detail: "A beneficial failure needs a technical justification (ESQ-C6).", target: logicTarget });
  }
  return findings;
}

function cellFindings(view: EsqBarriersView, esq: EventSequenceQuantification): EsqBarrierFinding[] {
  const findings: EsqBarrierFinding[] = [];
  const cc = esq.capabilityCategory;
  const preOperational = esq.plantStage !== "OPERATIONAL";
  for (const entry of view.cells) {
    const cell = entry.cell;
    const target: EsqBarrierTarget = { kind: "cell", id: cell.id };
    const item = cell.id;
    if (entry.barrier === undefined) findings.push({ severity: "error", check: "Barrier missing", item, detail: blank(cell.barrierId) ? "Choose the barrier this cell fails." : `${item} points at a barrier that Step 03 no longer has.`, target });
    else if (entry.mode === undefined) findings.push({ severity: "error", check: "Mode missing", item, detail: blank(cell.modeId) ? "Choose or add the failure mode." : `${item} points at a failure mode that ${entry.barrier.name} no longer has.`, target });
    if (entry.phenomena.length === 0) findings.push({ severity: "warning", check: "No phenomenon", item, detail: "Choose the phenomenon behind the load (ESQ-C12).", target });
    if (cell.screening !== undefined) {
      if (blank(cell.screening.basis)) findings.push({ severity: "error", check: "Screening basis missing", item, detail: `Give the ${cell.screening.criterion} basis for screening ${item} (ESQ-C13).`, target });
      continue;
    }
    if (cell.hazardGroup === undefined) {
      if (cell.familyId === undefined) findings.push({ severity: "error", check: "No family", item, detail: "Choose the family this probability belongs to (ESQ-A3).", target });
      else if (!view.families.some((family) => family.id === cell.familyId)) findings.push({ severity: "error", check: "Family missing", item, detail: `${cell.familyId} is not among the Step 02 families.`, target });
    } else if (!view.hazards.some((hazard) => sameItem(hazard, cell.hazardGroup ?? ""))) {
      findings.push({ severity: "note", check: "Hazard out of scope", item, detail: `${cell.hazardGroup} is not in the Step 01 scope.`, target });
    }
    if (blank(cell.variable)) findings.push({ severity: "warning", check: "Variable not named", item, detail: "Name the variable the load and capacity compare, such as peak fuel temperature.", target });
    if (entry.problem !== undefined && (cell.load !== undefined || cell.capacity !== undefined)) findings.push({ severity: cell.ofRecord === "TYPED" ? "note" : "error", check: "Cannot run", item, detail: entry.problem, target });
    if ((cell.load !== undefined && blank(cell.load.basis)) || (cell.capacity !== undefined && blank(cell.capacity.basis))) findings.push({ severity: "warning", check: "Basis missing", item, detail: "Give the analysis behind the load and the capacity (ESQ-C5, C14).", target });
    if (entry.expression === undefined) findings.push({ severity: entry.usedBy.length > 0 ? "error" : "warning", check: "No value of record", item, detail: "Run the cell or type its probability (ESQ-A3).", target });
    if (cell.ofRecord === "RUN" && entry.stale) findings.push({ severity: "warning", check: "Run out of date", item, detail: "The load or capacity changed after the run of record. Run it again.", target });
    if (cell.ofRecord === "TYPED" && blank(cell.typed?.basis)) findings.push({ severity: "error", check: "Typed without a basis", item, detail: "Give the source of the typed probability.", target });
    if (cc === "CC-II" && cell.basis === "CONSERVATIVE") findings.push({ severity: "note", check: "Conservative at CC-II", item, detail: "CC-II needs realistic loads and capacities for risk-significant families (ESQ-A9, C5, C14).", target });
    if (cc === "CC-II" && cell.basis === "REALISTIC" && blank(cell.aging)) findings.push({ severity: "warning", check: "Aging not stated", item, detail: "State how in-service aging enters the capacity (ESQ-C14).", target });
    if (cell.use === "SPLIT_FRACTION" && entry.usedBy.length === 0) findings.push({ severity: "warning", check: "Not used", item, detail: "No Step 02 function takes this cell as its split fraction. Pick it in Step 02 or make it an end-state attribute.", target });
    if (preOperational && blank(cell.assumption?.calculation)) findings.push({ severity: "warning", check: "Assumption not recorded", item, detail: "Record the design calculation behind this cell as a pre-operational assumption (ESQ-C17).", target });
    if (cell.hazardGroup !== undefined && cc === "CC-II" && cell.capacity?.source !== "FRAGILITY") findings.push({ severity: "warning", check: "No fragility", item, detail: "CC-II calculates fragility curves for hazard capacity (ESQ-C15).", target });
  }
  for (const hazard of view.hazards) {
    if (view.cells.some((entry) => sameItem(entry.cell.hazardGroup ?? "", hazard))) continue;
    findings.push({ severity: "warning", check: "No hazard cell", item: hazard, detail: `${hazard} is in scope. Add a cell for each barrier failure it causes (ESQ-C11).` });
  }
  return findings;
}

function creditFindings(view: EsqBarriersView, cc: string | undefined): EsqBarrierFinding[] {
  const findings: EsqBarrierFinding[] = [];
  for (const row of view.credits) {
    const credit = row.credit;
    if (credit === undefined) {
      const record = row.qualification;
      if (record !== undefined) findings.push({ severity: "warning", check: "No credit decision", item: record.id, detail: `SY marks ${qualificationName(record)} beyond qualification${record.groupIds.length > 0 ? ` for ${listText(record.groupIds)}` : ""}. Record whether ESQ credits it (ESQ-C8, C9).`, target: { kind: "qualification", id: record.id } });
      continue;
    }
    const target: EsqBarrierTarget = { kind: "credit", id: credit.id };
    const item = row.name;
    if (blank(credit.name)) findings.push({ severity: "warning", check: "Not named", item, detail: "Name the equipment or action credited.", target });
    if (credit.kind === "EQUIPMENT") {
      if (credit.qualificationId !== undefined && row.qualification === undefined && !view.qualifications.some((record) => record.id === credit.qualificationId)) findings.push({ severity: "error", check: "Not in SY", item, detail: `${credit.qualificationId} is not in the imported SY workbook.`, target });
      if (credit.credited && credit.beyondQualification && cc === "CC-I") findings.push({ severity: "error", check: "Credit beyond qualification", item, detail: "CC-I takes no credit for equipment beyond its qualification limits (ESQ-C8).", target });
      if (credit.credited && credit.beyondQualification && cc !== "CC-I" && blank(credit.analysis)) findings.push({ severity: "error", check: "No survivability analysis", item, detail: "Credit beyond qualification needs an engineering analysis that shows the equipment survives (ESQ-C9).", target });
    } else {
      if (credit.actionId !== undefined && row.action === undefined) findings.push({ severity: "error", check: "Not in HR", item, detail: `${credit.actionId} is not in the imported HR workbook.`, target });
      if (credit.credited) {
        const missing = FEASIBILITY_KEYS.filter((key) => credit.feasibility?.[key] !== true).map((key) => FEASIBILITY_LABELS[key].toLowerCase());
        if (missing.length > 0) findings.push({ severity: "error", check: "Feasibility not shown", item, detail: `A credited action needs its feasibility shown before its HEP is used. Missing: ${listText(missing, 7)} (ESQ-C7, RG 1.247).`, target });
        if (blank(credit.analysis)) findings.push({ severity: "warning", check: "No feasibility record", item, detail: "Record the timing and conditions that make the action feasible (ESQ-C7).", target });
        if (cc !== "CC-I" && credit.treatment === "CONSERVATIVE" && row.action?.riskSignificant === true) findings.push({ severity: "warning", check: "Conservative at CC-II", item, detail: "A risk-significant post-release action needs a detailed treatment at CC-II (ESQ-C7).", target });
      }
      if (credit.beyondQualification && credit.credited && cc === "CC-I") findings.push({ severity: "error", check: "Credit beyond qualification", item, detail: "CC-I takes no credit for an action beyond its qualification limits (ESQ-C8).", target });
    }
    if (blank(credit.basis)) findings.push({ severity: "warning", check: "Basis missing", item, detail: "Record the basis of the credit decision.", target });
  }
  return findings;
}

function sortFindings(findings: readonly EsqBarrierFinding[]): EsqBarrierFinding[] {
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => FINDING_RANK[a.finding.severity] - FINDING_RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
}

function barriersViewOf(esq: EventSequenceQuantification): EsqBarriersView | undefined {
  const model = esq.model;
  if (model?.importedAt === undefined) return undefined;
  const work = barrierWorkOf(esq);
  const families = (modelViewOf(esq)?.families ?? []).map((family) => ({ id: family.id, name: family.name }));
  const barriers = barrierViews(model, work);
  const phenomena = phenomenonViews(model, work);
  const view: EsqBarriersView = {
    model,
    barriers,
    phenomena,
    esPhenomena: model.phenomena ?? [],
    cells: cellViews(esq, work.cells ?? [], barriers, phenomena, families),
    credits: creditRows(model, work.credits ?? []),
    criteria: model.criteria ?? [],
    impactRefs: uniqueTexts((model.impacts ?? []).map((impact) => impact.barrierRef)),
    qualifications: model.qualifications ?? [],
    actions: model.actions ?? [],
    families,
    sources: uniqueTexts([...esq.modelIntegration.scopeCoverage.radionuclideSources, ...(model.barriers ?? []).flatMap((barrier) => barrier.sourceNames)]),
    systems: uniqueTexts(model.tops.flatMap((top) => (top.systemName === undefined ? [] : [top.systemName]))),
    hazards: hazardsInScope(esq),
    findings: [],
  };
  if (work.phenomenaLogic !== undefined) view.logic = work.phenomenaLogic;
  view.findings = sortFindings([
    ...barrierFindings(view),
    ...phenomenonFindings(view),
    ...cellFindings(view, esq),
    ...creditFindings(view, esq.capabilityCategory),
  ]);
  return view;
}

function barriersComplete(esq: EventSequenceQuantification): boolean {
  const view = barriersViewOf(esq);
  return view !== undefined && view.barriers.length > 0 && !view.findings.some((finding) => finding.severity === "error");
}

function withWork(esq: EventSequenceQuantification, fn: (work: EsqBarrierWork) => EsqBarrierWork): EventSequenceQuantification {
  return { ...esq, barrierWork: fn(barrierWorkOf(esq)) };
}

function replaced<T>(list: readonly T[], match: (item: T) => boolean, next: T | undefined): T[] {
  const at = list.findIndex(match);
  if (next === undefined) return list.filter((item) => !match(item));
  return at < 0 ? [...list, next] : list.map((item, index) => (index === at ? next : item));
}

function withBarrierEntry(esq: EventSequenceQuantification, barrierId: string, next: EsqBarrierEntry | undefined): EventSequenceQuantification {
  return withWork(esq, (work) => ({ ...work, barriers: replaced(work.barriers ?? [], (entry) => entry.barrierId === barrierId, next) }));
}

function withMechanism(esq: EventSequenceQuantification, id: string, next: EsqMechanism | undefined): EventSequenceQuantification {
  return withWork(esq, (work) => ({ ...work, mechanisms: replaced(work.mechanisms ?? [], (mechanism) => mechanism.id === id, next) }));
}

function withCell(esq: EventSequenceQuantification, id: string, next: EsqCell | undefined): EventSequenceQuantification {
  return withWork(esq, (work) => ({ ...work, cells: replaced(work.cells ?? [], (cell) => cell.id === id, next) }));
}

function withCellRun(esq: EventSequenceQuantification, id: string, run: EsqCellRun): EventSequenceQuantification {
  return withWork(esq, (work) => ({ ...work, cells: (work.cells ?? []).map((cell) => (cell.id === id ? { ...cell, run, ofRecord: "RUN" as const } : cell)) }));
}

function withCredit(esq: EventSequenceQuantification, id: string, next: EsqCredit | undefined): EventSequenceQuantification {
  return withWork(esq, (work) => ({ ...work, credits: replaced(work.credits ?? [], (credit) => credit.id === id, next) }));
}

function withPhenomenaLogic(esq: EventSequenceQuantification, next: EsqPhenomenaLogic): EventSequenceQuantification {
  return withWork(esq, (work) => ({ ...work, phenomenaLogic: next }));
}

function nextId(prefix: string, taken: readonly string[]): string {
  let n = 1;
  while (taken.some((id) => id.toLowerCase() === `${prefix}-${n}`.toLowerCase())) n += 1;
  return `${prefix}-${n}`;
}

function nextBarrierId(esq: EventSequenceQuantification): string {
  return nextId("BR", [...(esq.model?.barriers ?? []).map((record) => record.id), ...(barrierWorkOf(esq).barriers ?? []).map((entry) => entry.barrierId)]);
}

function nextModeId(esq: EventSequenceQuantification): string {
  return nextId("FM", (barrierWorkOf(esq).barriers ?? []).flatMap((entry) => entry.modes.map((mode) => mode.id)));
}

function nextMechanismId(esq: EventSequenceQuantification): string {
  return nextId("PH", (barrierWorkOf(esq).mechanisms ?? []).map((mechanism) => mechanism.id));
}

function nextCellId(esq: EventSequenceQuantification): string {
  return nextId("BC", (barrierWorkOf(esq).cells ?? []).map((cell) => cell.id));
}

function nextCreditId(esq: EventSequenceQuantification): string {
  return nextId("CR", (barrierWorkOf(esq).credits ?? []).map((credit) => credit.id));
}

function entryOf(esq: EventSequenceQuantification, barrierId: string): EsqBarrierEntry {
  return (barrierWorkOf(esq).barriers ?? []).find((entry) => entry.barrierId === barrierId) ?? { barrierId, modes: [] };
}

function criterionVariable(esq: EventSequenceQuantification, barrierId: string): string {
  const criterionId = (barrierWorkOf(esq).barriers ?? []).find((entry) => entry.barrierId === barrierId)?.criterionId;
  const criterion = criterionId === undefined ? undefined : (esq.model?.criteria ?? []).find((candidate) => candidate.id === criterionId);
  return criterion?.parameters[0]?.parameter ?? "";
}

function newCell(esq: EventSequenceQuantification, barrierId?: string): EsqCell {
  const view = barriersViewOf(esq);
  const barrier = (barrierId === undefined ? undefined : view?.barriers.find((candidate) => candidate.id === barrierId))
    ?? view?.barriers.find((candidate) => candidate.cells.length === 0)
    ?? view?.barriers[0];
  const mode = barrier === undefined ? undefined : barrier.modes.find((candidate) => !barrier.cells.some((cell) => cell.modeId === candidate.id)) ?? barrier.modes[0];
  const criterion = barrier?.criterion;
  return {
    id: nextCellId(esq),
    barrierId: barrier?.id ?? "",
    modeId: mode?.id ?? "",
    mechanismIds: [],
    variable: criterion?.parameters[0]?.parameter ?? "",
    unit: "",
    basis: criterion?.method ?? (esq.capabilityCategory === "CC-I" ? "CONSERVATIVE" : "REALISTIC"),
    use: "SPLIT_FRACTION",
  };
}

function withCellBarrier(esq: EventSequenceQuantification, cellId: string, barrierId: string): EventSequenceQuantification {
  const cell = cellOf(esq, cellId);
  if (cell === undefined || cell.barrierId === barrierId) return esq;
  const modes = entryOf(esq, barrierId).modes;
  const variable = blank(cell.variable) ? criterionVariable(esq, barrierId) : cell.variable;
  return withCell(esq, cellId, { ...cell, barrierId, modeId: modes[0]?.id ?? "", mechanismIds: [], variable });
}

function withCellNewBarrier(esq: EventSequenceQuantification, cellId: string): EventSequenceQuantification {
  const cell = cellOf(esq, cellId);
  if (cell === undefined) return esq;
  const barrierId = nextBarrierId(esq);
  const added = withBarrierEntry(esq, barrierId, { barrierId, manual: { name: "", source: "", sourceNames: [] }, modes: [] });
  return withCell(added, cellId, { ...cell, barrierId, modeId: "", mechanismIds: [] });
}

function withCellNewMode(esq: EventSequenceQuantification, cellId: string): EventSequenceQuantification {
  const cell = cellOf(esq, cellId);
  if (cell === undefined || blank(cell.barrierId)) return esq;
  const entry = entryOf(esq, cell.barrierId);
  const kind: EsqBarrierModeKind = entry.modes.some((mode) => mode.kind === "GROSS") && !entry.modes.some((mode) => mode.kind === "LOCALIZED") ? "LOCALIZED" : "GROSS";
  const mode: EsqBarrierMode = { id: nextModeId(esq), name: "", kind, location: "" };
  const added = withBarrierEntry(esq, cell.barrierId, { ...entry, modes: [...entry.modes, mode] });
  return withCell(added, cellId, { ...cell, modeId: mode.id });
}

function withMode(esq: EventSequenceQuantification, barrierId: string, next: EsqBarrierMode): EventSequenceQuantification {
  const entry = entryOf(esq, barrierId);
  return withBarrierEntry(esq, barrierId, { ...entry, modes: entry.modes.map((mode) => (mode.id === next.id ? next : mode)) });
}

function withBarrierPatch(esq: EventSequenceQuantification, barrierId: string, patch: (entry: EsqBarrierEntry) => EsqBarrierEntry): EventSequenceQuantification {
  return withBarrierEntry(esq, barrierId, patch(entryOf(esq, barrierId)));
}

function withCellEsPhenomenon(esq: EventSequenceQuantification, cellId: string, phenomenonId: string): EventSequenceQuantification {
  const cell = cellOf(esq, cellId);
  if (cell === undefined) return esq;
  const known = (barrierWorkOf(esq).mechanisms ?? []).find((mechanism) => mechanism.barrierId === cell.barrierId && mechanism.phenomenonId === phenomenonId);
  if (known !== undefined) return withCell(esq, cellId, { ...cell, mechanismIds: [known.id] });
  const id = nextMechanismId(esq);
  const added = withMechanism(esq, id, { id, barrierId: cell.barrierId, phenomenonId, modeIds: [], kind: "PHENOMENON", name: "", familyIds: [], basis: "" });
  return withCell(added, cellId, { ...cell, mechanismIds: [id] });
}

function withCellNewPhenomenon(esq: EventSequenceQuantification, cellId: string): EventSequenceQuantification {
  const cell = cellOf(esq, cellId);
  if (cell === undefined) return esq;
  const id = nextMechanismId(esq);
  const kind: EsqMechanismKind = cell.hazardGroup === undefined ? "PHENOMENON" : "HAZARD";
  const mechanism: EsqMechanism = cell.hazardGroup === undefined
    ? { id, barrierId: cell.barrierId, modeIds: [], kind, name: "", familyIds: [], basis: "" }
    : { id, barrierId: cell.barrierId, modeIds: [], kind, name: "", hazardGroup: cell.hazardGroup, familyIds: [], basis: "" };
  return withCell(withMechanism(esq, id, mechanism), cellId, { ...cell, mechanismIds: [id] });
}

function withCellMechanism(esq: EventSequenceQuantification, cellId: string, mechanismId: string | undefined): EventSequenceQuantification {
  const cell = cellOf(esq, cellId);
  if (cell === undefined) return esq;
  return withCell(esq, cellId, { ...cell, mechanismIds: mechanismId === undefined ? [] : [mechanismId] });
}

function creditDraft(esq: EventSequenceQuantification, record: EsqQualificationRecord): EsqCredit {
  return {
    id: nextCreditId(esq),
    kind: "EQUIPMENT",
    qualificationId: record.id,
    name: qualificationName(record),
    familyIds: [],
    environment: record.condition,
    beyondQualification: record.beyondQualification,
    credited: false,
    analysis: "",
    basis: "",
  };
}

export {
  CELL_USE_LABELS,
  FEASIBILITY_KEYS,
  FEASIBILITY_LABELS,
  MECHANISM_KIND_LABELS,
  MODE_KIND_LABELS,
  barriersComplete,
  barriersViewOf,
  cellRecordText,
  cellSamples,
  creditDraft,
  modeLabel,
  newCell,
  nextCreditId,
  numberText,
  qualificationName,
  sideSourceText,
  withBarrierPatch,
  withCell,
  withCellBarrier,
  withCellEsPhenomenon,
  withCellMechanism,
  withCellNewBarrier,
  withCellNewMode,
  withCellNewPhenomenon,
  withCellRun,
  withCredit,
  withMechanism,
  withMode,
  withPhenomenaLogic,
  type EsqBarrierFinding,
  type EsqBarrierTarget,
  type EsqBarrierView,
  type EsqBarriersView,
  type EsqCellView,
  type EsqCreditRow,
  type EsqFamilyOption,
  type EsqPhenomenonView,
};
