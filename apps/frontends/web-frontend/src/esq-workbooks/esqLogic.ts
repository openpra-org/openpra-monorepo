import {
  type EsqExclusion,
  type EsqFlag,
  type EsqFlagTarget,
  type EsqLogic,
  type EsqLoopBreak,
  type EsqModel,
  type EsqTreeRecord,
  type EventSequenceQuantification,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import {
  esqSequenceRunId,
  flagApplies,
  flagTargetKey,
  functionLinkOf,
  reachedModels,
  resolveLink,
  transferEdges,
  transferLoops,
  treesInScope,
} from "interfaces-mef-types/esq/esq-run-inputs";
import type { EsqEventTreeRunLogic, EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { modelViewOf, type EsqFindingSeverity } from "./esqModel";

type EsqLogicWindowKind = "esqFlag" | "esqLoop" | "esqExclusion";

interface EsqLogicFinding {
  severity: EsqFindingSeverity;
  check: string;
  item: string;
  detail: string;
  target?: { kind: EsqLogicWindowKind; id: string };
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
}

interface EsqLogicView {
  model: EsqModel;
  roots: EsqTreeRecord[];
  flags: EsqFlagView[];
  loops: EsqLoopView[];
  unusedBreaks: EsqLoopBreak[];
  exclusions: EsqExclusionView[];
  findings: EsqLogicFinding[];
}

interface EsqRunRow {
  key: string;
  code: string;
  sequenceId?: string;
  familyId?: string;
  endState?: string;
  probability: number;
  frequency: number;
}

const FINDING_RANK: Record<EsqFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const AS_SET: EsqEventTreeRunLogic = { flags: true, loopBreaks: "AS_SET", exclusions: true, expandCcf: true };

const MODEL_AS_SET: EsqEventTreeRunLogic = { ...AS_SET, recovery: true, dependency: true };

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function listText(items: readonly string[], shown = 3): string {
  if (items.length <= shown) return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  return `${items.slice(0, shown).join(", ")} and ${items.length - shown} more`;
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

function flagFindings(model: EsqModel, flags: readonly EsqFlagView[], roots: readonly EsqTreeRecord[]): EsqLogicFinding[] {
  const findings: EsqLogicFinding[] = [];
  for (const view of flags) {
    const flag = view.flag;
    const target = { kind: "esqFlag" as const, id: flag.id };
    const item = blank(flag.name) ? flag.id : flag.name;
    if (flag.target === undefined) findings.push({ severity: "error", check: "Target missing", item, detail: "Choose the house event, basic event or gate this flag sets.", target });
    else if (!view.found) findings.push({ severity: "error", check: "Target not imported", item, detail: `${view.target}. Choose another target or import the model again in Step 02.`, target });
    if (blank(flag.name)) findings.push({ severity: "warning", check: "Name missing", item, detail: "Give the flag a name.", target });
    if (blank(flag.basis)) findings.push({ severity: "warning", check: "Basis missing", item, detail: "Record why the flag is set this way.", target });
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
      target: { kind: "esqFlag", id: second.id },
    });
  }
  return findings;
}

function loopFindings(loops: readonly EsqLoopView[], unused: readonly EsqLoopBreak[]): EsqLogicFinding[] {
  const findings: EsqLogicFinding[] = [];
  for (const loop of loops) {
    const target = { kind: "esqLoop" as const, id: loop.key };
    const item = loop.codes.join(", ");
    if (loop.open && loop.reached) findings.push({ severity: "error", check: "Loop not broken", item, detail: `${listText(loop.codes)} transfer into each other. Break the loop at one transfer and record the state.`, target });
    if (loop.open && !loop.reached) findings.push({ severity: "note", check: "Loop not reached", item, detail: "No linked function reaches these fault trees, so the runs do not need a break.", target });
    for (const entry of loop.breaks) {
      if (blank(entry.basis)) findings.push({ severity: "warning", check: "Break basis missing", item, detail: "Record why the cut transfer is set this way.", target });
    }
  }
  if (unused.length > 0) findings.push({ severity: "note", check: "Breaks not used", item: `${unused.length} ${unused.length === 1 ? "break" : "breaks"}`, detail: "The imported fault trees no longer loop through these transfers. Remove the unused breaks in the Loops tab." });
  return findings;
}

function exclusionFindings(exclusions: readonly EsqExclusionView[]): EsqLogicFinding[] {
  const findings: EsqLogicFinding[] = [];
  for (const view of exclusions) {
    const exclusion = view.exclusion;
    const target = { kind: "esqExclusion" as const, id: exclusion.id };
    if (exclusion.eventIds.length < 2) findings.push({ severity: "error", check: "Too few events", item: exclusion.id, detail: "An exclusion needs two or more basic events.", target });
    if (view.missing.length > 0) findings.push({ severity: "error", check: "Event not imported", item: exclusion.id, detail: `${listText(view.missing)} ${view.missing.length === 1 ? "is" : "are"} not in the imported SY model.`, target });
    if (blank(exclusion.basis)) findings.push({ severity: "error", check: "Basis missing", item: exclusion.id, detail: "Record why these events cannot occur together.", target });
  }
  return findings;
}

function sortFindings(findings: readonly EsqLogicFinding[]): EsqLogicFinding[] {
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => FINDING_RANK[a.finding.severity] - FINDING_RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
}

function logicViewOf(esq: EventSequenceQuantification): EsqLogicView | undefined {
  const model = esq.model;
  if (model?.importedAt === undefined) return undefined;
  const trees = treesInScope(esq, model);
  const roots = trees.filter((tree) => !tree.transferEntry);
  const reached = new Set(linkedModelIds(esq, model, trees).flatMap((modelId) => reachedModels(model, modelId)));
  const logic = logicOf(esq);
  const flags = (logic.flags ?? []).map((flag): EsqFlagView => ({
    flag,
    target: flagTargetText(model, flag.target),
    found: flagTargetFound(model, flag.target),
    trees: roots.filter((tree) => flagApplies(flag, tree)),
  }));
  const { loops, unused } = loopViews(esq, model, reached);
  const codeOf = new Map(model.events.map((event) => [event.id, event.code]));
  const exclusions = (logic.exclusions ?? []).map((exclusion): EsqExclusionView => ({
    exclusion,
    codes: exclusion.eventIds.map((id) => codeOf.get(id) ?? id),
    missing: exclusion.eventIds.filter((id) => !codeOf.has(id)),
  }));
  return {
    model,
    roots,
    flags,
    loops,
    unusedBreaks: unused,
    exclusions,
    findings: sortFindings([...flagFindings(model, flags, roots), ...loopFindings(loops, unused), ...exclusionFindings(exclusions)]),
  };
}

function logicComplete(esq: EventSequenceQuantification): boolean {
  const view = logicViewOf(esq);
  return view !== undefined && view.roots.length > 0 && !view.findings.some((finding) => finding.severity === "error");
}

function withLogic(esq: EventSequenceQuantification, fn: (logic: EsqLogic) => EsqLogic): EventSequenceQuantification {
  return { ...esq, logic: fn(esq.logic ?? {}) };
}

function nextLogicId(prefix: string, taken: readonly string[]): string {
  let n = taken.length + 1;
  while (taken.some((id) => id.toLowerCase() === `${prefix}-${n}`.toLowerCase())) n += 1;
  return `${prefix}-${n}`;
}

function nextFlagId(esq: EventSequenceQuantification): string {
  return nextLogicId("FL", (logicOf(esq).flags ?? []).map((flag) => flag.id));
}

function nextExclusionId(esq: EventSequenceQuantification): string {
  return nextLogicId("EX", (logicOf(esq).exclusions ?? []).map((exclusion) => exclusion.id));
}

function withFlag(esq: EventSequenceQuantification, id: string, next: EsqFlag | undefined): EventSequenceQuantification {
  return withLogic(esq, (logic) => {
    const flags = logic.flags ?? [];
    const at = flags.findIndex((flag) => flag.id === id);
    if (next === undefined) return { ...logic, flags: flags.filter((flag) => flag.id !== id) };
    return { ...logic, flags: at < 0 ? [...flags, next] : flags.map((flag, index) => (index === at ? next : flag)) };
  });
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
  return withLogic(esq, (logic) => {
    const exclusions = logic.exclusions ?? [];
    const at = exclusions.findIndex((exclusion) => exclusion.id === id);
    if (next === undefined) return { ...logic, exclusions: exclusions.filter((exclusion) => exclusion.id !== id) };
    return { ...logic, exclusions: at < 0 ? [...exclusions, next] : exclusions.map((exclusion, index) => (index === at ? next : exclusion)) };
  });
}

function runLogicText(logic: EsqEventTreeRunLogic): string {
  const parts = [
    logic.flags ? "Flags as set" : "No flags",
    logic.loopBreaks === "AS_SET" ? "breaks as set" : `breaks ${logic.loopBreaks}`,
    logic.exclusions ? "exclusions as set" : "no exclusions",
    logic.expandCcf ? "common cause expanded" : "no common cause",
    logic.recovery === false ? "no recovery" : "recovery as set",
    logic.dependency === false ? "no HFE dependency" : "HFE dependency as set",
  ];
  return parts.join(" · ");
}

function runRows(esq: EventSequenceQuantification, result: EventTreeAnalysisResult): EsqRunRow[] {
  const model = esq.model;
  if (model === undefined) return [];
  const byRunId = new Map(model.sequences.map((sequence) => [esqSequenceRunId(sequence.treeId, sequence.id), sequence]));
  const familyOf = new Map((modelViewOf(esq)?.sequences ?? []).flatMap((view) => (view.familyId === undefined ? [] : [[view.record.id, view.familyId] as const])));
  return result.sequences.map((entry) => {
    const chain = entry.sequenceChain === undefined ? [entry.sequenceId] : entry.sequenceChain.map((link) => link.entityId);
    const records = chain.flatMap((id) => {
      const record = byRunId.get(id);
      return record === undefined ? [] : [record];
    });
    const final = records[records.length - 1];
    const row: EsqRunRow = {
      key: entry.sequenceId,
      code: records.length === 0 ? entry.sequenceId : records.map((record) => record.code).join(" to "),
      probability: entry.conditionalProbability,
      frequency: entry.annualFrequency,
    };
    if (final !== undefined) {
      row.sequenceId = final.id;
      const familyId = familyOf.get(final.id);
      if (familyId !== undefined) row.familyId = familyId;
      if (final.endState !== undefined) row.endState = final.endState;
    }
    return row;
  });
}

function familyTotals(rows: readonly EsqRunRow[]): { familyId: string; frequency: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.familyId === undefined) continue;
    totals.set(row.familyId, (totals.get(row.familyId) ?? 0) + row.frequency);
  }
  return [...totals.entries()].map(([familyId, frequency]) => ({ familyId, frequency })).sort((a, b) => b.frequency - a.frequency);
}

export {
  AS_SET,
  MODEL_AS_SET,
  logicViewOf,
  logicComplete,
  flagTargetText,
  nextFlagId,
  nextExclusionId,
  withFlag,
  withLoopBreak,
  withUnusedBreaksRemoved,
  withExclusion,
  runLogicText,
  runRows,
  familyTotals,
  type EsqLogicWindowKind,
  type EsqLogicFinding,
  type EsqLogicView,
  type EsqFlagView,
  type EsqLoopView,
  type EsqLoopEdgeView,
  type EsqExclusionView,
  type EsqRunRow,
};
