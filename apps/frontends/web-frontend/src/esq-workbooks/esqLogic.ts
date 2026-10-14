import type {
  EsqCombination,
  EsqCombinationFinding,
  EsqDeletionFinding,
  EsqDependenceLevel,
  EsqDependencyRecord,
  EsqExclusion,
  EsqFlag,
  EsqFlagTarget,
  EsqJointSource,
  EsqLogic,
  EsqLoopBreak,
  EsqModel,
  EsqPostWork,
  EsqRecoveryRule,
  EsqTreeRecord,
  EventSequenceQuantification,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import {
  flagApplies,
  flagTargetKey,
  functionLinkOf,
  reachedModels,
  resolveLink,
  transferEdges,
  transferLoops,
  treesInScope,
} from "interfaces-mef-types/esq/esq-run-inputs";
import {
  combinationKey,
  combinationMembers,
  floorValueOf,
  hfeEventIds,
  postWorkOf,
  resolvedCombinations,
  resolvedRecoveries,
  therpJoint,
  type EsqCombinationMember,
  type EsqPoints,
  type EsqResolvedCombination,
  type EsqResolvedRecovery,
} from "interfaces-mef-types/esq/esq-post-inputs";
import { solveInputsKey } from "interfaces-mef-types/esq/esq-solve-inputs";
import type { EsqEventTreeRunLogic, EsqPostRunResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { EsqFindingSeverity } from "./esqModel";
import { FEASIBILITY_LABELS } from "./esqBarriers";

type EsqLogicTargetKind = "flag" | "loop" | "exclusion" | "recovery" | "combination" | "floor";

interface EsqLogicFinding {
  severity: EsqFindingSeverity;
  check: string;
  item: string;
  detail: string;
  target?: { kind: EsqLogicTargetKind; id: string };
}

interface EsqFlagView {
  flag: EsqFlag;
  target: string;
  found: boolean;
  trees: EsqTreeRecord[];
}

interface EsqLoopEdgeView {
  fromModelId: string;
  toModelId: string;
  fromCode: string;
  toCode: string;
  cut?: EsqLoopBreak;
}

interface EsqLoopView {
  key: string;
  modelIds: string[];
  codes: string[];
  edges: EsqLoopEdgeView[];
  breaks: EsqLoopBreak[];
  open: boolean;
  reached: boolean;
}

interface EsqExclusionView {
  exclusion: EsqExclusion;
  codes: string[];
  missing: string[];
  checkable: boolean;
  finding?: EsqDeletionFinding;
}

interface EsqRecoveryView {
  recovery: EsqResolvedRecovery;
  codes: string[];
  hfeName?: string;
  sequenceCode?: string;
  active: boolean;
  assessed: boolean;
}

interface EsqCombinationView {
  key: string;
  eventIds: string[];
  codes: string[];
  entry?: EsqResolvedCombination;
  finding?: EsqCombinationFinding;
}

interface EsqEventOption {
  id: string;
  label: string;
}

interface EsqLogicView {
  model: EsqModel;
  work: EsqPostWork;
  roots: EsqTreeRecord[];
  groups: string[];
  states: string[];
  flags: EsqFlagView[];
  loops: EsqLoopView[];
  unusedBreaks: EsqLoopBreak[];
  exclusions: EsqExclusionView[];
  recoveries: EsqRecoveryView[];
  combinations: EsqCombinationView[];
  hfeIds: string[];
  members: EsqEventOption[];
  events: EsqEventOption[];
  hrFloor?: number;
  floor?: number;
  searchStale: boolean;
  deletionsStale: boolean;
  findings: EsqLogicFinding[];
}

const AS_SET: EsqEventTreeRunLogic = { flags: true, loopBreaks: "AS_SET", exclusions: true, expandCcf: true };

const MODEL_AS_SET: EsqEventTreeRunLogic = { ...AS_SET, recovery: true, dependency: true };

const DEFAULT_RAISED_HEP = 0.8;

const FINDING_RANK: Record<EsqFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const DEPENDENCE_LEVELS: readonly EsqDependenceLevel[] = ["ZERO", "LOW", "MODERATE", "HIGH", "COMPLETE"];

const LEVEL_LABELS: Record<EsqDependenceLevel, string> = { ZERO: "Zero", LOW: "Low", MODERATE: "Moderate", HIGH: "High", COMPLETE: "Complete" };

const JOINT_SOURCE_LABELS: Record<EsqJointSource, string> = { HRA: "HR assessment", THERP: "THERP level", TYPED: "Typed" };

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function listText(items: readonly string[], shown = 3): string {
  if (items.length <= shown) return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  return `${items.slice(0, shown).join(", ")} and ${items.length - shown} more`;
}

function numberText(value: number): string {
  if (!Number.isFinite(value) || value === 0) return String(value);
  const [mantissa, exponent] = value.toExponential(2).split("e");
  const power = Number(exponent);
  const digits = String(Number(mantissa));
  return power === 0 ? digits : `${digits}E${power}`;
}

function nextId(prefix: string, taken: readonly string[]): string {
  let n = taken.length + 1;
  while (taken.some((id) => id.toLowerCase() === `${prefix}-${n}`.toLowerCase())) n += 1;
  return `${prefix}-${n}`;
}

function sameAtTwoFigures(left: number, right: number): boolean {
  return Number(left.toPrecision(2)) === Number(right.toPrecision(2));
}

function logicOf(esq: EventSequenceQuantification): EsqLogic {
  return esq.logic ?? {};
}

function topCode(model: EsqModel, modelId: string): string {
  return model.tops.find((top) => top.modelId === modelId)?.code ?? modelId;
}

function flagTargetText(model: EsqModel, target: EsqFlagTarget | undefined): string {
  if (target === undefined) return "Not set";
  if (target.kind === "EVENT") {
    const event = model.events.find((candidate) => candidate.id === target.id);
    return event === undefined ? "Missing event" : `Event ${event.code}`;
  }
  const top = model.tops.find((candidate) => candidate.modelId === target.modelId);
  if (top === undefined) return "Missing fault tree";
  const node = target.kind === "HOUSE" ? top.houseEvents?.find((house) => house.id === target.id) : top.gates?.find((gate) => gate.id === target.id);
  if (node === undefined) return `Missing in ${top.code}`;
  return `${target.kind === "HOUSE" ? "House event" : "Gate"} ${node.code} in ${top.code}`;
}

function flagTargetFound(model: EsqModel, target: EsqFlagTarget | undefined): boolean {
  if (target === undefined) return false;
  if (target.kind === "EVENT") return model.events.some((event) => event.id === target.id);
  const top = model.tops.find((candidate) => candidate.modelId === target.modelId);
  if (top === undefined) return false;
  return target.kind === "HOUSE" ? (top.houseEvents ?? []).some((house) => house.id === target.id) : (top.gates ?? []).some((gate) => gate.id === target.id);
}

function linkedModelIds(esq: EventSequenceQuantification, model: EsqModel, trees: readonly EsqTreeRecord[]): string[] {
  const ids: string[] = [];
  for (const tree of trees) {
    for (const functionId of tree.functionIds) {
      const record = model.functions.find((entry) => entry.id === functionId);
      if (record === undefined) continue;
      const target = resolveLink(record, functionLinkOf(esq, functionId), tree).target;
      if (target?.kind === "FAULT_TREE" && !ids.includes(target.top.modelId)) ids.push(target.top.modelId);
    }
  }
  return ids;
}

function loopViews(esq: EventSequenceQuantification, model: EsqModel, reached: ReadonlySet<string>): { loops: EsqLoopView[]; unused: EsqLoopBreak[] } {
  const breaks = logicOf(esq).loopBreaks ?? [];
  const remaining = transferLoops(model, breaks);
  const loops = transferLoops(model, []).map((loop): EsqLoopView => {
    const inLoop = breaks.filter((entry) => loop.edges.some((edge) => edge.fromModelId === entry.fromModelId && edge.toModelId === entry.toModelId));
    return {
      key: loop.key,
      modelIds: loop.modelIds,
      codes: loop.modelIds.map((modelId) => topCode(model, modelId)),
      edges: loop.edges.map((edge) => {
        const cut = inLoop.find((entry) => entry.fromModelId === edge.fromModelId && entry.toModelId === edge.toModelId);
        const view: EsqLoopEdgeView = { ...edge, fromCode: topCode(model, edge.fromModelId), toCode: topCode(model, edge.toModelId) };
        if (cut !== undefined) view.cut = cut;
        return view;
      }),
      breaks: inLoop,
      open: remaining.some((rest) => rest.modelIds.some((modelId) => loop.modelIds.includes(modelId))),
      reached: loop.modelIds.some((modelId) => reached.has(modelId)),
    };
  });
  const edges = transferEdges(model);
  const unused = breaks.filter((entry) => !edges.some((edge) => edge.fromModelId === entry.fromModelId && edge.toModelId === entry.toModelId)
    || !loops.some((loop) => loop.breaks.includes(entry)));
  return { loops, unused };
}

function eventCodes(model: EsqModel, recoveries: readonly EsqResolvedRecovery[]): Map<string, string> {
  const codes = new Map(model.events.map((event) => [event.id, event.code]));
  for (const recovery of recoveries) codes.set(recovery.eventId, `NR-${recovery.id}`);
  return codes;
}

function byNominal(left: EsqCombinationView, right: EsqCombinationView): number {
  const a = left.finding?.nominalFrequency;
  const b = right.finding?.nominalFrequency;
  if (a === undefined || b === undefined) return a === undefined ? (b === undefined ? 0 : 1) : -1;
  return b - a;
}

function combinationViews(esq: EventSequenceQuantification, work: EsqPostWork, codes: ReadonlyMap<string, string>, points: EsqPoints | undefined): EsqCombinationView[] {
  const findings = work.search?.findings ?? [];
  const entries = resolvedCombinations(esq, points).map((entry): EsqCombinationView => {
    const key = combinationKey(entry.combination.eventIds);
    const view: EsqCombinationView = { key: entry.combination.id, eventIds: [...entry.combination.eventIds], codes: entry.members.map((member) => member.code), entry };
    const finding = findings.find((candidate) => combinationKey(candidate.eventIds) === key);
    if (finding !== undefined) view.finding = finding;
    return view;
  });
  const covered = new Set(entries.map((view) => combinationKey(view.eventIds)));
  const open = findings
    .filter((finding) => !covered.has(combinationKey(finding.eventIds)))
    .map((finding): EsqCombinationView => ({ key: `finding:${combinationKey(finding.eventIds)}`, eventIds: [...finding.eventIds], codes: finding.eventIds.map((id) => codes.get(id) ?? id), finding }));
  return [...entries, ...open].sort(byNominal);
}

function flagFindings(model: EsqModel, flags: readonly EsqFlagView[], roots: readonly EsqTreeRecord[]): EsqLogicFinding[] {
  const findings: EsqLogicFinding[] = [];
  for (const view of flags) {
    const flag = view.flag;
    const target = { kind: "flag" as const, id: flag.id };
    const item = blank(flag.name) ? flag.id : flag.name;
    if (flag.target === undefined) findings.push({ severity: "error", check: "Target missing", item, detail: "Choose the house event, basic event or gate this flag sets.", target });
    else if (!view.found) findings.push({ severity: "error", check: "Target not imported", item, detail: `${view.target}. Choose another target or import the model again in Step 02.`, target });
    if (blank(flag.name)) findings.push({ severity: "warning", check: "Name missing", item, detail: "Give the flag a name.", target });
    if (blank(flag.basis)) findings.push({ severity: "warning", check: "Basis missing", item, detail: "Record why the flag is set this way (ESQ-B9).", target });
    if (flag.target !== undefined && view.trees.length === 0) findings.push({ severity: "warning", check: "Applies to no tree", item, detail: "No event tree in scope matches its initiator groups and states.", target });
  }
  const conflicts = new Map<string, { first: EsqFlag; second: EsqFlag; trees: string[] }>();
  for (const tree of roots) {
    const byKey = new Map<string, EsqFlag>();
    for (const view of flags) {
      const key = flagTargetKey(view.flag);
      if (key === undefined || !view.trees.includes(tree)) continue;
      const other = byKey.get(key);
      if (other === undefined) {
        byKey.set(key, view.flag);
        continue;
      }
      if (other.state === view.flag.state) continue;
      const pair = `${other.id}|${view.flag.id}`;
      const entry = conflicts.get(pair) ?? { first: other, second: view.flag, trees: [] };
      entry.trees.push(tree.code);
      conflicts.set(pair, entry);
    }
  }
  for (const { first, second, trees } of conflicts.values()) {
    findings.push({
      severity: "error",
      check: "Flags conflict",
      item: `${first.id} and ${second.id}`,
      detail: `${first.id} sets ${flagTargetText(model, first.target)} ${first.state ? "TRUE" : "FALSE"} and ${second.id} sets it ${second.state ? "TRUE" : "FALSE"} in ${listText(trees)}.`,
      target: { kind: "flag", id: second.id },
    });
  }
  return findings;
}

function loopFindings(loops: readonly EsqLoopView[], unused: readonly EsqLoopBreak[]): EsqLogicFinding[] {
  const findings: EsqLogicFinding[] = [];
  for (const loop of loops) {
    const target = { kind: "loop" as const, id: loop.key };
    const item = loop.codes.join(", ");
    if (loop.open && loop.reached) findings.push({ severity: "error", check: "Loop not broken", item, detail: `${listText(loop.codes)} transfer into each other. Break the loop at one transfer and record the state (ESQ-B5).`, target });
    if (loop.open && !loop.reached) findings.push({ severity: "note", check: "Loop not reached", item, detail: "No linked function reaches these fault trees, so the runs do not need a break.", target });
    for (const entry of loop.breaks) {
      if (blank(entry.basis)) findings.push({ severity: "warning", check: "Break basis missing", item, detail: "Record why the cut transfer is set this way.", target });
    }
  }
  if (unused.length > 0) findings.push({ severity: "note", check: "Breaks not used", item: `${unused.length} ${unused.length === 1 ? "break" : "breaks"}`, detail: "The imported fault trees no longer loop through these transfers. Remove the unused breaks in the Loops tab." });
  return findings;
}

function exclusionFindings(view: Omit<EsqLogicView, "findings">): EsqLogicFinding[] {
  const findings: EsqLogicFinding[] = [];
  const deletions = view.work.deletions;
  for (const entry of view.exclusions) {
    const exclusion = entry.exclusion;
    const target = { kind: "exclusion" as const, id: exclusion.id };
    if (exclusion.eventIds.length < 2) findings.push({ severity: "error", check: "Too few events", item: exclusion.id, detail: "An exclusion needs two or more basic events.", target });
    if (entry.missing.length > 0) findings.push({ severity: "error", check: "Event not imported", item: exclusion.id, detail: `${listText(entry.missing)} ${entry.missing.length === 1 ? "is" : "are"} not in the imported SY model.`, target });
    if (blank(exclusion.basis)) findings.push({ severity: "error", check: "Basis missing", item: exclusion.id, detail: `Record why ${listText(entry.codes)} cannot occur together (ESQ-B8, ESQ-F1).`, target });
  }
  const checkable = view.exclusions.filter((entry) => entry.checkable);
  if (checkable.length > 0 && deletions === undefined) findings.push({ severity: "error", check: "Deletions not checked", item: "Exclusions", detail: "Check the deletions to list the cut sets each exclusion removes (ESQ-B7)." });
  if (deletions !== undefined && view.deletionsStale) findings.push({ severity: "warning", check: "Deletion check older than its inputs", item: "Exclusions", detail: "The model, logic or values changed after the check. Check the deletions again." });
  if (deletions !== undefined && !view.deletionsStale) {
    for (const entry of checkable) {
      if (entry.finding === undefined) findings.push({ severity: "note", check: "Exclusion removes nothing", item: entry.exclusion.id, detail: `No cut set above ${numberText(deletions.cutOff)} per year holds ${listText(entry.codes)}.`, target: { kind: "exclusion", id: entry.exclusion.id } });
    }
  }
  return findings;
}

function recoveryFindings(view: Omit<EsqLogicView, "findings">): EsqLogicFinding[] {
  const findings: EsqLogicFinding[] = [];
  for (const entry of view.recoveries) {
    const recovery = entry.recovery;
    const item = recovery.id;
    const target = { kind: "recovery" as const, id: recovery.id };
    const noun = recovery.repair ? "repair" : "recovery";
    const rule = recovery.rule;
    const record = recovery.repairRecord;
    if (record !== undefined && entry.sequenceCode === undefined) findings.push({ severity: "warning", check: "Sequence not imported", item, detail: `ES credits repair in ${record.sequenceId}, which the Step 02 model does not hold. Import the model again in Step 02.`, target });
    if (recovery.source === "TYPED" && blank(rule?.typed?.source)) findings.push({ severity: "error", check: "Typed value without a source", item, detail: "Name the document or analysis the non-recovery probability comes from.", target });
    if (recovery.source === "DA" && !view.model.parameters.some((parameter) => parameter.id === recovery.parameterId)) findings.push({ severity: "error", check: "DA parameter not imported", item, detail: `${recovery.parameterId ?? "The parameter"} is not in the linked DA workbook. Pick another or import the model again in Step 02.`, target });
    if (!recovery.credited) continue;
    if (recovery.missing.length > 0) findings.push({ severity: "error", check: recovery.repair ? "Repair not feasible" : "Recovery not feasible", item, detail: `A credited ${noun} needs its feasibility shown. Not shown: ${listText(recovery.missing.map((key) => FEASIBILITY_LABELS[key].toLowerCase()), 5)} (ESQ-A7).`, target });
    if (recovery.expression === undefined) findings.push({ severity: "error", check: "No non-recovery value", item, detail: recovery.repair ? "Take the non-repair probability from DA or type it with its source." : "Take the HEP from HR or DA, or type it with its source.", target });
    if (recovery.eventIds.length === 0) findings.push({ severity: "error", check: recovery.repair ? "Repairs no event" : "Recovers no event", item, detail: `Choose the basic events this ${noun} restores.`, target });
    if (entry.active && !entry.assessed && !recovery.repair) {
      const hrId = recovery.record?.dependencyId;
      findings.push({ severity: "error", check: "Recovery outside the dependency assessment", item, detail: `Assess NR-${recovery.id} together with the events it recovers (ESQ-C2).${hrId === undefined ? "" : ` HR assessed it in ${hrId}.`}`, target });
    }
    if (blank(rule?.basis)) findings.push({ severity: "warning", check: "Credit without a basis", item, detail: `Record why the ${noun} is credited in these sequences.`, target });
  }
  return findings;
}

function inHrOrder(members: readonly EsqCombinationMember[], record: EsqDependencyRecord | undefined): EsqCombinationMember[] {
  const position = (member: EsqCombinationMember): number => (record === undefined || member.hfeId === undefined || !record.hfeIds.includes(member.hfeId) ? Number.POSITIVE_INFINITY : record.hfeIds.indexOf(member.hfeId));
  return [...members].sort((a, b) => position(a) - position(b) || (b.probability ?? 0) - (a.probability ?? 0));
}

function hrLevelFinding(entry: EsqResolvedCombination, id: string): EsqLogicFinding | undefined {
  const hr = entry.hr;
  if (entry.source !== "HRA" || hr === undefined || hr.level === "ZERO") return undefined;
  const expected = therpJoint(inHrOrder(entry.members, hr), hr.level);
  if (expected === undefined) return undefined;
  const floored = entry.floorApplies && entry.floor !== undefined ? Math.max(expected, entry.floor) : expected;
  if (sameAtTwoFigures(expected, hr.jointHep) || sameAtTwoFigures(floored, hr.jointHep)) return undefined;
  return { severity: "warning", check: "HR joint HEP disagrees with its level", item: id, detail: `HR gives ${numberText(hr.jointHep)} at ${LEVEL_LABELS[hr.level].toLowerCase()} dependence. THERP at that level gives ${numberText(floored)}.`, target: { kind: "combination", id } };
}

function combinationFindings(view: Omit<EsqLogicView, "findings">): EsqLogicFinding[] {
  const findings: EsqLogicFinding[] = [];
  const search = view.work.search;
  const humanCount = view.hfeIds.length + view.recoveries.filter((entry) => entry.active && !entry.recovery.repair).length;
  if (search === undefined && humanCount >= 2) findings.push({ severity: "error", check: "HFE combinations not searched", item: "HFE dependence", detail: "Search the cut sets with every HEP raised to find those that hold several human failure events (ESQ-C1, ESQ-N-8)." });
  if (search !== undefined && view.searchStale) findings.push({ severity: "warning", check: "Search older than its inputs", item: "HFE dependence", detail: "Recovery, values or logic changed after the search. Search again." });
  for (const row of view.combinations) {
    const entry = row.entry;
    if (entry === undefined) {
      findings.push({ severity: "error", check: "Combination not assessed", item: listText(row.codes, 4), detail: `${row.finding?.cutSetCount ?? 0} cut sets hold these events together. Assess their joint HEP (ESQ-C2).` });
      continue;
    }
    const id = entry.combination.id;
    const target = { kind: "combination" as const, id };
    if (new Set(entry.combination.eventIds).size < 2) {
      findings.push({ severity: "error", check: "Fewer than two events", item: id, detail: "A combination needs two or more human failure events.", target });
      continue;
    }
    if (entry.problem !== undefined) findings.push({ severity: "error", check: "Joint HEP not usable", item: id, detail: entry.problem, target });
    else if (entry.joint === undefined && !(entry.source === "THERP" && entry.members.some((member) => member.probability === undefined))) findings.push({ severity: "error", check: "No joint HEP of record", item: id, detail: "Link HR's assessment, set a dependence level, or type the joint HEP.", target });
    if (entry.source === "TYPED" && blank(entry.combination.typed?.source)) findings.push({ severity: "error", check: "Typed joint HEP without a source", item: id, detail: "Name the analysis the joint HEP comes from.", target });
    const contradiction = hrLevelFinding(entry, id);
    if (contradiction !== undefined) findings.push(contradiction);
    if (entry.source !== undefined && entry.source !== "HRA" && blank(entry.combination.basis)) {
      findings.push(entry.level === "ZERO" && entry.source === "THERP"
        ? { severity: "warning", check: "Independence without a basis", item: id, detail: "Record why these failures are judged independent.", target }
        : { severity: "warning", check: "Joint HEP without a basis", item: id, detail: "Record the dependence factors behind it, such as crew, timing, location and cues.", target });
    }
    if (!blank(entry.combination.floorWaiver)) findings.push({ severity: "note", check: "Floor waived", item: id, detail: entry.combination.floorWaiver?.trim() ?? "", target });
    if (search !== undefined && !view.searchStale && row.finding === undefined) findings.push({ severity: "note", check: "Not found in the search", item: id, detail: "No cut set in the search holds these events together. The joint HEP still applies wherever they meet.", target });
  }
  const typed = view.work.floor;
  const floorTarget = { kind: "floor" as const, id: "floor" };
  if (typed !== undefined && blank(typed.source)) findings.push({ severity: "error", check: "Typed floor without a source", item: "Joint HEP floor", detail: "Name the analysis the floor comes from.", target: floorTarget });
  if (typed !== undefined && view.hrFloor !== undefined && typed.value < view.hrFloor) findings.push({ severity: "error", check: "Floor below HR's floor", item: "Joint HEP floor", detail: `HR sets ${numberText(view.hrFloor)}. A joint HEP never goes below it, so type a floor at or above it or take HR's floor.`, target: floorTarget });
  if (view.floor === undefined && view.combinations.some((row) => row.entry !== undefined)) findings.push({ severity: "warning", check: "No joint HEP floor", item: "Joint HEP floor", detail: "HR gives no floor. Type one with its source.", target: floorTarget });
  return findings;
}

function eventOption(model: EsqModel, eventId: string, codes: ReadonlyMap<string, string>): EsqEventOption {
  const name = model.events.find((event) => event.id === eventId)?.name ?? "";
  const code = codes.get(eventId) ?? eventId;
  return { id: eventId, label: blank(name) ? code : `${code} · ${name}` };
}

function logicViewOf(esq: EventSequenceQuantification, points?: EsqPoints): EsqLogicView | undefined {
  const model = esq.model;
  if (model?.importedAt === undefined) return undefined;
  const work = postWorkOf(esq);
  const logic = logicOf(esq);
  const trees = treesInScope(esq, model);
  const roots = trees.filter((tree) => !tree.transferEntry);
  const reached = new Set(linkedModelIds(esq, model, trees).flatMap((modelId) => reachedModels(model, modelId)));
  const recoveries = resolvedRecoveries(esq);
  const codes = eventCodes(model, recoveries);
  const codesOf = (ids: readonly string[]): string[] => ids.map((id) => codes.get(id) ?? id);
  const flags = (logic.flags ?? []).map((flag): EsqFlagView => ({
    flag,
    target: flagTargetText(model, flag.target),
    found: flagTargetFound(model, flag.target),
    trees: roots.filter((tree) => flagApplies(flag, tree)),
  }));
  const { loops, unused } = loopViews(esq, model, reached);
  const deletions = work.deletions;
  const known = new Set(model.events.map((event) => event.id));
  const exclusions = (logic.exclusions ?? []).map((exclusion): EsqExclusionView => {
    const view: EsqExclusionView = { exclusion, codes: codesOf(exclusion.eventIds), missing: exclusion.eventIds.filter((id) => !known.has(id)), checkable: new Set(exclusion.eventIds).size >= 2 };
    const finding = deletions?.findings.find((entry) => entry.exclusionId === exclusion.id);
    if (finding !== undefined) view.finding = finding;
    return view;
  });
  const combinations = combinationViews(esq, work, codes, points);
  const assessed = combinations.flatMap((row) => (row.entry?.joint === undefined ? [] : [row.entry.combination.eventIds]));
  const hfeIds = hfeEventIds(esq, model);
  const recoveryViews = recoveries.map((recovery): EsqRecoveryView => {
    const view: EsqRecoveryView = {
      recovery,
      codes: codesOf(recovery.eventIds),
      active: recovery.credited && recovery.missing.length === 0 && recovery.expression !== undefined && recovery.eventIds.length > 0,
      assessed: assessed.some((eventIds) => eventIds.includes(recovery.eventId)),
    };
    const hfeId = recovery.record?.hfeId;
    const hfeName = hfeId === undefined ? undefined : model.humanEvents.find((entry) => entry.id === hfeId)?.name;
    if (hfeName !== undefined) view.hfeName = hfeName;
    const sequenceId = recovery.repairRecord?.sequenceId;
    const sequenceCode = sequenceId === undefined ? undefined : model.sequences.find((entry) => entry.id === sequenceId)?.code;
    if (sequenceCode !== undefined) view.sequenceCode = sequenceCode;
    return view;
  });
  const members: EsqEventOption[] = [
    ...hfeIds.map((id) => eventOption(model, id, codes)).sort((a, b) => a.label.localeCompare(b.label)),
    ...recoveries.filter((recovery) => !recovery.repair).map((recovery) => ({ id: recovery.eventId, label: `NR-${recovery.id}${blank(recovery.name) ? "" : ` · ${recovery.name} fails`}` })),
  ];
  const events = [...model.events].sort((a, b) => a.code.localeCompare(b.code)).map((event) => eventOption(model, event.id, codes));
  const searchKey = solveInputsKey(esq, { combinations: false });
  const base: Omit<EsqLogicView, "findings"> = {
    model,
    work,
    roots,
    groups: [...new Set(roots.map((tree) => tree.initiatorId))].sort(),
    states: [...new Set(roots.flatMap((tree) => (tree.stateId === undefined ? [] : [tree.stateId])))].sort(),
    flags,
    loops,
    unusedBreaks: unused,
    exclusions,
    recoveries: recoveryViews,
    combinations,
    hfeIds,
    members,
    events,
    searchStale: work.search !== undefined && work.search.inputs !== searchKey,
    deletionsStale: deletions !== undefined && deletions.inputs !== searchKey,
  };
  const hrFloor = model.jointFloor?.value;
  const floor = floorValueOf(esq);
  const full = { ...base, ...(hrFloor === undefined ? {} : { hrFloor }), ...(floor === undefined ? {} : { floor }) };
  const findings = [...flagFindings(model, flags, roots), ...loopFindings(loops, unused), ...exclusionFindings(full), ...recoveryFindings(full), ...combinationFindings(full)];
  return {
    ...full,
    findings: findings
      .map((finding, index) => ({ finding, index }))
      .sort((a, b) => FINDING_RANK[a.finding.severity] - FINDING_RANK[b.finding.severity] || a.index - b.index)
      .map(({ finding }) => finding),
  };
}

function logicComplete(esq: EventSequenceQuantification): boolean {
  const view = logicViewOf(esq);
  return view !== undefined && view.roots.length > 0 && !view.findings.some((finding) => finding.severity === "error");
}

function withLogic(esq: EventSequenceQuantification, fn: (logic: EsqLogic) => EsqLogic): EventSequenceQuantification {
  return { ...esq, logic: fn(esq.logic ?? {}) };
}

function withPostWork(esq: EventSequenceQuantification, fn: (work: EsqPostWork) => EsqPostWork): EventSequenceQuantification {
  return { ...esq, postWork: fn(postWorkOf(esq)) };
}

function replaced<T extends { id: string }>(list: readonly T[], id: string, next: T | undefined): T[] {
  if (next === undefined) return list.filter((item) => item.id !== id);
  return list.some((item) => item.id === id) ? list.map((item) => (item.id === id ? next : item)) : [...list, next];
}

function nextFlagId(esq: EventSequenceQuantification): string {
  return nextId("FL", (logicOf(esq).flags ?? []).map((flag) => flag.id));
}

function nextExclusionId(esq: EventSequenceQuantification): string {
  return nextId("EX", (logicOf(esq).exclusions ?? []).map((exclusion) => exclusion.id));
}

function withFlag(esq: EventSequenceQuantification, id: string, next: EsqFlag | undefined): EventSequenceQuantification {
  return withLogic(esq, (logic) => ({ ...logic, flags: replaced(logic.flags ?? [], id, next) }));
}

function withLoopBreak(esq: EventSequenceQuantification, fromModelId: string, toModelId: string, next: EsqLoopBreak | undefined): EventSequenceQuantification {
  return withLogic(esq, (logic) => {
    const breaks = logic.loopBreaks ?? [];
    const at = breaks.findIndex((entry) => entry.fromModelId === fromModelId && entry.toModelId === toModelId);
    if (next === undefined) return { ...logic, loopBreaks: breaks.filter((_, index) => index !== at) };
    return { ...logic, loopBreaks: at < 0 ? [...breaks, next] : breaks.map((entry, index) => (index === at ? next : entry)) };
  });
}

function withUnusedBreaksRemoved(esq: EventSequenceQuantification): EventSequenceQuantification {
  const unused = logicViewOf(esq)?.unusedBreaks ?? [];
  return withLogic(esq, (logic) => ({ ...logic, loopBreaks: (logic.loopBreaks ?? []).filter((entry) => !unused.includes(entry)) }));
}

function withExclusion(esq: EventSequenceQuantification, id: string, next: EsqExclusion | undefined): EventSequenceQuantification {
  return withLogic(esq, (logic) => ({ ...logic, exclusions: replaced(logic.exclusions ?? [], id, next) }));
}

function recoveryRuleOf(esq: EventSequenceQuantification, id: string): EsqRecoveryRule {
  const rule = postWorkOf(esq).recoveries?.find((entry) => entry.id === id);
  if (rule !== undefined) return rule;
  const resolved = resolvedRecoveries(esq).find((entry) => entry.id === id);
  return { id, groupIds: resolved?.groupIds ?? [], stateIds: resolved?.stateIds ?? [], credited: resolved?.credited ?? false, basis: "" };
}

function withRecoveryRule(esq: EventSequenceQuantification, id: string, rule: EsqRecoveryRule | undefined): EventSequenceQuantification {
  return withPostWork(esq, (work) => ({ ...work, recoveries: replaced(work.recoveries ?? [], id, rule) }));
}

function nextRecoveryId(esq: EventSequenceQuantification): string {
  const model = esq.model;
  return nextId("MR", [...(postWorkOf(esq).recoveries ?? []).map((rule) => rule.id), ...(model?.recoveries ?? []).map((record) => record.id), ...(model?.repairs ?? []).map((record) => record.id)]);
}

function withCombination(esq: EventSequenceQuantification, id: string, combination: EsqCombination | undefined): EventSequenceQuantification {
  return withPostWork(esq, (work) => ({ ...work, combinations: replaced(work.combinations ?? [], id, combination) }));
}

function nextCombinationId(esq: EventSequenceQuantification): string {
  return nextId("HC", (postWorkOf(esq).combinations ?? []).map((combination) => combination.id));
}

function defaultOrder(esq: EventSequenceQuantification, eventIds: readonly string[]): string[] {
  const members = combinationMembers(esq, eventIds);
  const hfeIds = members.flatMap((member) => (member.hfeId === undefined ? [] : [member.hfeId]));
  const record = hfeIds.length < 2 ? undefined : (esq.model?.dependencies ?? []).find((candidate) => hfeIds.every((hfeId) => candidate.hfeIds.includes(hfeId)));
  return inHrOrder(members, record).map((member) => member.eventId);
}

function withCombinationsFor(esq: EventSequenceQuantification, sets: readonly (readonly string[])[]): EventSequenceQuantification {
  return withPostWork(esq, (work) => {
    const existing = work.combinations ?? [];
    const covered = new Set(existing.map((entry) => combinationKey(entry.eventIds)));
    const taken = existing.map((entry) => entry.id);
    const added: EsqCombination[] = [];
    for (const eventIds of sets) {
      const key = combinationKey(eventIds);
      if (covered.has(key)) continue;
      covered.add(key);
      const id = nextId("HC", taken);
      taken.push(id);
      added.push({ id, eventIds: defaultOrder(esq, eventIds), groupIds: [], stateIds: [], basis: "" });
    }
    return { ...work, combinations: [...existing, ...added] };
  });
}

function withFloor(esq: EventSequenceQuantification, floor: { value: number; source: string } | undefined): EventSequenceQuantification {
  return withPostWork(esq, (work) => {
    const { floor: _old, ...rest } = work;
    return floor === undefined ? rest : { ...rest, floor };
  });
}

function withSearch(esq: EventSequenceQuantification, summary: EsqPostRunResult): EventSequenceQuantification {
  return withPostWork(esq, (work) => ({
    ...work,
    search: {
      runId: summary.runId,
      revision: summary.owner.workbookRevision,
      at: summary.completedAt,
      inputs: summary.inputs,
      raisedHep: summary.raisedHep ?? DEFAULT_RAISED_HEP,
      cutOff: summary.cutOff,
      findings: summary.combinations.map((finding) => ({ eventIds: [...finding.eventIds], treeIds: [...finding.treeIds], cutSetCount: finding.cutSetCount, nominalFrequency: finding.nominalFrequency })),
    },
  }));
}

function withDeletions(esq: EventSequenceQuantification, summary: EsqPostRunResult): EventSequenceQuantification {
  return withPostWork(esq, (work) => ({
    ...work,
    deletions: {
      runId: summary.runId,
      revision: summary.owner.workbookRevision,
      at: summary.completedAt,
      inputs: summary.inputs,
      cutOff: summary.cutOff,
      findings: summary.deletions.map((finding) => ({ exclusionId: finding.exclusionId, treeIds: [...finding.treeIds], cutSetCount: finding.cutSetCount, nominalFrequency: finding.nominalFrequency })),
    },
  }));
}

function postRunProblem(summary: EsqPostRunResult, esq: EventSequenceQuantification): string | undefined {
  const failed = summary.trees.filter((tree) => tree.status === "FAILED").length;
  if (failed > 0) return `${failed} of ${summary.trees.length} event trees failed. Fix them and run again.`;
  if (summary.inputs !== solveInputsKey(esq, { combinations: false })) return "The model, logic or values changed during the run. Run again.";
  return undefined;
}

function rulesLeftOut(logic: EsqEventTreeRunLogic): string[] {
  return [
    logic.flags ? "" : "flags",
    logic.loopBreaks === "AS_SET" ? "" : "the loop breaks",
    logic.exclusions ? "" : "exclusions",
    logic.recovery === false ? "recovery" : "",
    logic.dependency === false ? "HFE dependence" : "",
  ].filter((part) => part.length > 0);
}

function runLogicText(logic: EsqEventTreeRunLogic): string {
  const off = rulesLeftOut(logic);
  return [off.length === 0 ? "Step 04 rules" : `Without ${listText(off, 5)}`, logic.expandCcf ? "common cause expanded" : "no common cause"].join(" · ");
}

export {
  AS_SET,
  DEFAULT_RAISED_HEP,
  DEPENDENCE_LEVELS,
  JOINT_SOURCE_LABELS,
  LEVEL_LABELS,
  MODEL_AS_SET,
  flagTargetText,
  logicComplete,
  logicViewOf,
  nextCombinationId,
  nextExclusionId,
  nextFlagId,
  nextRecoveryId,
  numberText,
  postRunProblem,
  recoveryRuleOf,
  rulesLeftOut,
  runLogicText,
  withCombination,
  withCombinationsFor,
  withDeletions,
  withExclusion,
  withFlag,
  withFloor,
  withLoopBreak,
  withRecoveryRule,
  withSearch,
  withUnusedBreaksRemoved,
  type EsqCombinationView,
  type EsqEventOption,
  type EsqExclusionView,
  type EsqFlagView,
  type EsqLogicFinding,
  type EsqLogicTargetKind,
  type EsqLogicView,
  type EsqLoopEdgeView,
  type EsqLoopView,
  type EsqRecoveryView,
};
