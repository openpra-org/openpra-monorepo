import { JSX, useId, useMemo, useRef, useState } from "react";
import type {
  EsTimingSource,
  EventSequenceAnalysis,
  FeasibilityState,
  OperatorActionWindow,
  PhenomenologicalDependencyModel,
  RepairCreditRecord,
  SequenceTiming,
  SequenceTimingCategory,
} from "interfaces-mef-types/es/event-sequence-analysis";
import type { UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import type { HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { readableId } from "../workbooks/workbookHandoff";
import { pointsOf } from "../newly-developed-methods/shared/uncertaintyPoints";
import { ChoiceEditor, DialogHead, DialogShell } from "./EsScope";
import { FEASIBILITY_CRITERIA } from "./esViewData";
import { useEsWorkbook } from "./esWorkbookContext";
import "./css/esTiming.css";

type TimingDialog = { kind: "timeline"; id: string } | { kind: "window"; id: string } | { kind: "condition"; id: string } | { kind: "repair"; id: string };

type TimingTab = "timelines" | "windows" | "phenomena" | "repair" | "checks";

interface TimingFinding {
  severity: "error" | "warning";
  check: string;
  item: string;
  detail: string;
  target: TimingDialog;
}

interface PagedRows {
  current: number;
  pages: number;
  total: number;
  start: number;
}

const PAGE = 10;

const TIMING_TABS: { id: TimingTab; label: string }[] = [
  { id: "timelines", label: "Timelines" },
  { id: "windows", label: "Operator windows" },
  { id: "phenomena", label: "Phenomena" },
  { id: "repair", label: "Repair credit" },
  { id: "checks", label: "Checks" },
];

const TIMING_KINDS: readonly SequenceTimingCategory[] = ["INITIATOR", "AUTOMATIC", "OPERATOR_CUE", "OPERATOR_ACTION", "DAMAGE_LIMIT", "MISSION_TIME"];

const CATEGORY_TEXT: Record<SequenceTimingCategory, string> = {
  INITIATOR: "Initiating event",
  AUTOMATIC: "Function demanded",
  OPERATOR_CUE: "Operator cue",
  OPERATOR_ACTION: "Operator action",
  DAMAGE_LIMIT: "Damage limit",
  MISSION_TIME: "Mission time",
};

const NO_PARAMETERS: ReadonlyMap<string, UncertainParameter> = new Map();

const FEASIBILITY_STATES: { id: FeasibilityState; label: string }[] = [
  { id: "OK", label: "Met" },
  { id: "MARGINAL", label: "Marginal" },
  { id: "NOT_MET", label: "Not met" },
];

const SOURCE_TEXT: Record<EsTimingSource, string> = { HRA: "HR", SC: "SC" };

const UNIT_MINUTES: { prefix: string; minutes: number }[] = [
  { prefix: "day", minutes: 1440 },
  { prefix: "hour", minutes: 60 },
  { prefix: "hr", minutes: 60 },
  { prefix: "h", minutes: 60 },
  { prefix: "min", minutes: 1 },
  { prefix: "sec", minutes: 1 / 60 },
  { prefix: "s", minutes: 1 / 60 },
];

function rounded(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function minutesText(minutes: number): string {
  if (minutes < 0) return `-${minutesText(-minutes)}`;
  return minutes < 60 ? `${rounded(minutes)} min` : `${rounded(minutes / 60)} h`;
}

function sourceText(sources: readonly EsTimingSource[] | undefined): string {
  return sources === undefined || sources.length === 0 ? "Typed" : sources.map((source) => SOURCE_TEXT[source]).join(" and ");
}

function listText(values: readonly string[] | undefined): string {
  return values === undefined || values.length === 0 ? "None" : values.join(", ");
}

function paged(total: number, page: number): PagedRows {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const current = Math.min(page, pages - 1);
  return { current, pages, total, start: current * PAGE };
}

function parseMinutes(text: string): number | undefined {
  const tokens = text.toLowerCase().split(" ").map((token) => token.trim()).filter((token) => token.length > 0);
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const value = Number((tokens[index] ?? "").split(",").join(""));
    if (!Number.isFinite(value)) continue;
    const unit = tokens[index + 1] ?? "";
    const match = UNIT_MINUTES.find((entry) => unit.startsWith(entry.prefix));
    if (match !== undefined) return value * match.minutes;
  }
  return undefined;
}

function withSource<T extends { importedFrom?: EsTimingSource[] }>(record: T, source: EsTimingSource): T {
  return { ...record, importedFrom: [...new Set([...(record.importedFrom ?? []), source])] };
}

function blankWindow(humanActionId: string, action: string): OperatorActionWindow {
  return { uuid: crypto.randomUUID(), humanActionId, action, windowStartMinutes: 0, windowEndMinutes: 0, requiredMinutes: 0, implementsSrs: [] };
}

function upsertWindow(list: readonly OperatorActionWindow[], humanActionId: string, action: string, source: EsTimingSource, fill: (current: OperatorActionWindow, added: boolean) => OperatorActionWindow): OperatorActionWindow[] {
  const index = list.findIndex((entry) => entry.humanActionId === humanActionId);
  const current = list[index];
  const next = withSource(fill(current ?? blankWindow(humanActionId, action), current === undefined), source);
  return current === undefined ? [...list, next] : list.map((entry, position) => (position === index ? next : entry));
}

function withHrWindows(es: EventSequenceAnalysis, hr: HumanReliabilityAnalysis): EventSequenceAnalysis {
  const recoveries = new Set((hr.recoveryActions ?? []).map((recovery) => recovery.hepQuantificationId));
  let list: OperatorActionWindow[] = es.operatorActionWindows ?? [];
  for (const hfe of hr.humanFailureEvents.filter((candidate) => candidate.hfeTiming === "POST_INITIATOR")) {
    const quantification = hr.hepQuantifications.find((candidate) => candidate.hfeId === hfe.uuid && !recoveries.has(candidate.uuid));
    const sequenceCues = (hfe.responseDetail?.cueTimingBySequence ?? []).flatMap((entry) => (entry.cueTimeMinutes === undefined ? [] : [entry.cueTimeMinutes]));
    const cueMinutes = quantification?.cueArrivalTimeMinutes ?? (sequenceCues.length === 0 ? undefined : Math.min(...sequenceCues));
    const cue = hfe.responseDetail?.cueDescription ?? "";
    list = upsertWindow(list, hfe.uuid, hfe.name, "HRA", (current) => {
      const start = cueMinutes ?? current.windowStartMinutes;
      const available = quantification?.timeAvailableMinutes;
      return {
        ...current,
        action: hfe.name,
        ...(cue.length > 0 ? { cue } : {}),
        ...(cueMinutes === undefined ? {} : { cueMinutes }),
        windowStartMinutes: start,
        windowEndMinutes: available === undefined ? Math.max(current.windowEndMinutes, start) : start + available,
        requiredMinutes: quantification?.timeRequiredMinutes ?? current.requiredMinutes,
        ...(hfe.applicableInitiatingEvents === undefined ? {} : { applicableInitiatingEvents: hfe.applicableInitiatingEvents }),
        applicablePlantOperatingStates: hfe.applicablePlantOperatingStates,
      };
    });
  }
  return { ...es, operatorActionWindows: list };
}

function withScWindows(es: EventSequenceAnalysis, sc: SuccessCriteriaDevelopment): EventSequenceAnalysis {
  let list: OperatorActionWindow[] = es.operatorActionWindows ?? [];
  for (const criterion of sc.humanActionSuccessCriteria ?? []) {
    const available = parseMinutes(criterion.timeAvailable);
    list = upsertWindow(list, criterion.humanActionId, criterion.description, "SC", (current) => ({
      ...current,
      ...(available === undefined ? {} : { windowEndMinutes: current.windowStartMinutes + available }),
    }));
  }
  return { ...es, operatorActionWindows: list };
}

function withScConditions(es: EventSequenceAnalysis, sc: SuccessCriteriaDevelopment): EventSequenceAnalysis {
  let list: PhenomenologicalDependencyModel[] = es.dependencyModels?.phenomenologicalDependencies ?? [];
  for (const barrier of sc.radionuclideBarrierCriteria) {
    barrier.challengeLoads.forEach((load, index) => {
      const uuid = `${barrier.uuid}-load-${String(index + 1)}`;
      const current = list.find((entry) => entry.uuid === uuid);
      const base: PhenomenologicalDependencyModel = current ?? { uuid, name: load.loadDescription, description: "", phenomenon: "", affectedSystems: [], implementsSrs: [] };
      const next = withSource({
        ...base,
        name: load.loadDescription,
        phenomenon: load.physicalAttributes.join(", "),
        deterministicAnalysisReferences: barrier.engineeringAnalysisReferences,
      }, "SC");
      list = current === undefined ? [...list, next] : list.map((entry) => (entry.uuid === uuid ? next : entry));
    });
  }
  return { ...es, dependencyModels: { ...es.dependencyModels, phenomenologicalDependencies: list } };
}

function commaList(text: string): string[] {
  return text.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
}

async function scMissionHours(es: EventSequenceAnalysis, sc: SuccessCriteriaDevelopment): Promise<Map<string, number>> {
  const sequenceIds = new Set(es.eventSequences.map((sequence) => sequence.uuid));
  const entries = sc.missionTimes
    .filter((entry) => sequenceIds.has(entry.eventSequenceReference))
    .map((entry) => ({ key: entry.uuid, expression: entry.missionTime, unit: "HOURS" as const }));
  return pointsOf(entries, NO_PARAMETERS);
}

function withScTimeLines(es: EventSequenceAnalysis, sc: SuccessCriteriaDevelopment, hours: ReadonlyMap<string, number>): EventSequenceAnalysis {
  const missionBySequence = new Map(sc.missionTimes.map((entry) => [entry.eventSequenceReference, entry]));
  const analyses = sc.thermalFluidAnalyses ?? [];
  return {
    ...es,
    eventSequences: es.eventSequences.map((sequence) => {
      const mission = missionBySequence.get(sequence.uuid);
      const point = mission === undefined ? undefined : hours.get(mission.uuid);
      if (mission === undefined || point === undefined) return sequence;
      const uuid = `sc-mission-${mission.uuid}`;
      const references = [...new Set([
        ...mission.analysisReferences,
        ...analyses.filter((analysis) => analysis.eventSequencesAnalyzed.includes(sequence.uuid)).map((analysis) => analysis.engineeringAnalysisId),
      ])];
      const entry: SequenceTiming = { uuid, event: "Mission time", timeAfterInitiator: point * 60, category: "MISSION_TIME", basis: mission.basis, deterministicAnalysisReferences: references, importedFrom: ["SC"] };
      const timing = sequence.timing ?? [];
      return { ...sequence, timing: timing.some((candidate) => candidate.uuid === uuid) ? timing.map((candidate) => (candidate.uuid === uuid ? entry : candidate)) : [...timing, entry] };
    }),
  };
}

function askedFunctions(es: EventSequenceAnalysis): Set<string> {
  const asked = new Set<string>();
  for (const tree of es.eventTrees ?? []) {
    for (const functionalEvent of Object.values(tree.functionalEvents)) {
      for (const value of [functionalEvent.systemReference, functionalEvent.label, functionalEvent.name]) {
        if (value !== undefined && value.length > 0) asked.add(value);
      }
    }
  }
  for (const safetyFunction of es.keySafetyFunctions) {
    for (const system of safetyFunction.supportingSystems) asked.add(system);
  }
  return asked;
}

function timingFindings(es: EventSequenceAnalysis): TimingFinding[] {
  const findings: TimingFinding[] = [];
  for (const item of es.operatorActionWindows ?? []) {
    const length = item.windowEndMinutes - item.windowStartMinutes;
    if (length <= 0) findings.push({ severity: "error", check: "Missing window", item: item.action, detail: "The window closes at or before it opens.", target: { kind: "window", id: item.uuid } });
    else if (length < item.requiredMinutes) findings.push({ severity: "error", check: "Negative window", item: item.action, detail: `The action needs ${minutesText(item.requiredMinutes)} but the window is ${minutesText(length)}.`, target: { kind: "window", id: item.uuid } });
  }
  const asked = askedFunctions(es);
  for (const condition of es.dependencyModels?.phenomenologicalDependencies ?? []) {
    if (condition.affectedSystems.length > 0 && !condition.affectedSystems.some((system) => asked.has(system))) {
      findings.push({ severity: "warning", check: "Challenges no function the trees ask about", item: condition.name, detail: `No functional event asks about ${listText(condition.affectedSystems)}.`, target: { kind: "condition", id: condition.uuid } });
    }
  }
  if (es.capabilityCategory === "CC-II") {
    for (const sequence of es.eventSequences) {
      const unsourced = (sequence.timing ?? []).filter((entry) => (entry.deterministicAnalysisReferences ?? []).length === 0 && (entry.importedFrom ?? []).length === 0 && (entry.basis ?? "").trim().length === 0);
      if (unsourced.length > 0) {
        findings.push({ severity: "warning", check: "Timing with no thermal-hydraulic source", item: sequence.name, detail: `${String(unsourced.length)} ${unsourced.length === 1 ? "milestone has" : "milestones have"} no analysis reference or basis (ES-A10).`, target: { kind: "timeline", id: sequence.uuid } });
      }
    }
  }
  const sequenceName = new Map(es.eventSequences.map((sequence) => [sequence.uuid, sequence.name]));
  for (const record of es.repairCreditRecords ?? []) {
    if (record.repairCredited && (record.timeMinutes === undefined || (record.access ?? "").trim().length === 0)) {
      findings.push({ severity: "error", check: "Repair credit without time and access", item: sequenceName.get(record.eventSequenceId) ?? (record.equipment !== undefined && record.equipment.length > 0 ? record.equipment : "Repair credit"), detail: "Record the time to repair and how the crew reaches the equipment (ES-C9).", target: { kind: "repair", id: record.uuid } });
    }
  }
  return findings;
}

function Pager({ rows, noun, plural, onPage, disabled = false }: { rows: PagedRows; noun: string; plural?: string; onPage: (page: number) => void; disabled?: boolean }): JSX.Element {
  const label = `${String(rows.total)} ${rows.total === 1 ? noun : plural ?? `${noun}s`}`;
  if (rows.pages <= 1) return <span className="possubtle">{label}</span>;
  return (
    <span className="es-pager">
      <span className="possubtle">{rows.start + 1} to {Math.min(rows.total, rows.start + PAGE)} of {label}</span>
      <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled || rows.current === 0} onClick={() => onPage(rows.current - 1)}>Previous</button>
      <button type="button" className="posnav__btn posnav__btn--sm" disabled={disabled || rows.current >= rows.pages - 1} onClick={() => onPage(rows.current + 1)}>Next</button>
    </span>
  );
}

function ActionName({ item }: { item: OperatorActionWindow }): JSX.Element {
  const code = readableId(item.humanActionId);
  return (
    <>
      <span className="postable__name">{item.action}</span>
      {code !== undefined && code !== item.action && <span className="postable__name-sub posmono">{code}</span>}
    </>
  );
}

function TabBar<T extends string>({ tabs, tab, label, findings, onTab }: { tabs: readonly { id: T; label: string }[]; tab: T; label: string; findings: number; onTab: (tab: T) => void }): JSX.Element {
  const tablist = useRef<HTMLDivElement>(null);
  return (
    <div
      className="es-tabs"
      role="tablist"
      aria-label={label}
      ref={tablist}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        const current = tabs.findIndex((item) => item.id === tab);
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        const target = tabs[next];
        if (target === undefined) return;
        onTab(target.id);
        tablist.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
      }}
    >
      {tabs.map((item) => (
        <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => onTab(item.id)}>
          {item.id === "checks" ? `Checks (${String(findings)})` : item.label}
        </button>
      ))}
    </div>
  );
}

function TimeLinesPanel({ treeId, setTreeId, onOpen }: { treeId: string; setTreeId: (id: string) => void; onOpen: (id: string) => void }): JSX.Element {
  const { es, upstream, editable, mutateEs } = useEsWorkbook();
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();
  const trees = es.eventTrees ?? [];
  const tree = trees.find((candidate) => candidate.uuid === treeId) ?? trees[0];
  const sequences = es.eventSequences.filter((sequence) => tree !== undefined && sequence.eventTreeId === tree.uuid);
  const rows = paged(sequences.length, page);
  const actionLabel = editable ? "Edit" : "View";
  const sc = upstream?.sc;

  function importSc(): void {
    if (!editable || sc === undefined) return;
    setBusy(true);
    setError(null);
    scMissionHours(es, sc)
      .then((hours) => mutateEs((draft) => withScTimeLines(draft, sc, hours)))
      .catch((failure: Error) => setError(failure.message))
      .finally(() => setBusy(false));
  }

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters">
          {trees.length > 0 && (
            <div className="es-records__filter">
              <label className="posfield__label" htmlFor={`${fieldId}-tree`}>Event tree</label>
              <select id={`${fieldId}-tree`} className="posfield__select es-timing-tree-select" value={tree?.uuid ?? ""} onChange={(event) => { setTreeId(event.target.value); setPage(0); }}>
                {trees.map((candidate) => <option key={candidate.uuid} value={candidate.uuid}>{candidate.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="es-records__actions">
          <Pager rows={rows} noun="sequence" onPage={setPage} />
          {editable && sc !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={importSc}>Import from SC</button>}
        </div>
      </div>
      {error !== null && <p className="es-timing-error" role="alert">{error}</p>}
      {sequences.length > 0 && (
        <div className="es-timing-table">
          <table className="postable es-records" aria-label="Timelines">
            <thead>
              <tr>
                <th scope="col">Sequence</th>
                <th scope="col">Milestones</th>
                <th scope="col">First limit</th>
                <th scope="col">Mission time</th>
                <th scope="col">From</th>
                <th scope="col" className="es-records__act" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {sequences.slice(rows.start, rows.start + PAGE).map((sequence) => {
                const timing = sequence.timing ?? [];
                const limits = timing.filter((entry) => entry.category === "DAMAGE_LIMIT").map((entry) => entry.timeAfterInitiator);
                const mission = timing.find((entry) => entry.category === "MISSION_TIME");
                const sources = [...new Set(timing.flatMap((entry) => entry.importedFrom ?? []))];
                return (
                  <tr key={sequence.uuid}>
                    <td><span className="postable__name">{sequence.name}</span></td>
                    <td className="es-timing-num">{timing.length}</td>
                    <td className="es-timing-num">{limits.length === 0 ? "None" : minutesText(Math.min(...limits))}</td>
                    <td className="es-timing-num">{mission === undefined ? "None" : minutesText(mission.timeAfterInitiator)}</td>
                    <td>{timing.length === 0 ? "None" : sourceText(sources)}</td>
                    <td className="es-records__act"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} the timeline of ${sequence.name}`} onClick={() => onOpen(sequence.uuid)}>{actionLabel}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function WindowsPanel({ onOpen }: { onOpen: (id: string) => void }): JSX.Element {
  const { es, upstream, editable, mutateEs } = useEsWorkbook();
  const [page, setPage] = useState(0);
  const windows = es.operatorActionWindows ?? [];
  const rows = paged(windows.length, page);
  const actionLabel = editable ? "Edit" : "View";
  const hr = upstream?.hr;
  const sc = upstream?.sc;

  function addWindow(): void {
    if (!editable) return;
    const added = blankWindow("", "New operator action");
    setPage(Math.floor(windows.length / PAGE));
    mutateEs((draft) => ({ ...draft, operatorActionWindows: [...(draft.operatorActionWindows ?? []), added] }));
    onOpen(added.uuid);
  }

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters" />
        <div className="es-records__actions">
          <Pager rows={rows} noun="action" onPage={setPage} />
          {editable && hr !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateEs((draft) => withHrWindows(draft, hr))}>Import from HR</button>}
          {editable && sc !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateEs((draft) => withScWindows(draft, sc))}>Import from SC</button>}
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addWindow}>Add action</button>}
        </div>
      </div>
      {windows.length > 0 && (
        <div className="es-timing-table">
          <table className="postable es-records" aria-label="Operator windows">
            <thead>
              <tr>
                <th scope="col">Action</th>
                <th scope="col">Cue</th>
                <th scope="col">Window</th>
                <th scope="col">Required</th>
                <th scope="col">Margin</th>
                <th scope="col">From</th>
                <th scope="col" className="es-records__act" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {windows.slice(rows.start, rows.start + PAGE).map((item) => (
                <tr key={item.uuid}>
                  <td><ActionName item={item} /></td>
                  <td>{item.cue === undefined || item.cue.length === 0 ? "None" : item.cue}{item.cueMinutes !== undefined && <span className="postable__name-sub">at {minutesText(item.cueMinutes)}</span>}</td>
                  <td className="es-timing-num">{minutesText(item.windowStartMinutes)} to {minutesText(item.windowEndMinutes)}</td>
                  <td className="es-timing-num">{minutesText(item.requiredMinutes)}</td>
                  <td className="es-timing-num">{minutesText(item.windowEndMinutes - item.windowStartMinutes - item.requiredMinutes)}</td>
                  <td>{sourceText(item.importedFrom)}</td>
                  <td className="es-records__act"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${item.action}`} onClick={() => onOpen(item.uuid)}>{actionLabel}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function PhenomenaPanel({ onOpen }: { onOpen: (id: string) => void }): JSX.Element {
  const { es, upstream, editable, mutateEs } = useEsWorkbook();
  const [page, setPage] = useState(0);
  const conditions = es.dependencyModels?.phenomenologicalDependencies ?? [];
  const rows = paged(conditions.length, page);
  const actionLabel = editable ? "Edit" : "View";
  const sc = upstream?.sc;

  function addCondition(): void {
    if (!editable) return;
    const added: PhenomenologicalDependencyModel = { uuid: crypto.randomUUID(), name: "New phenomenological condition", description: "", phenomenon: "", affectedSystems: [], implementsSrs: [] };
    setPage(Math.floor(conditions.length / PAGE));
    mutateEs((draft) => ({ ...draft, dependencyModels: { ...draft.dependencyModels, phenomenologicalDependencies: [...(draft.dependencyModels?.phenomenologicalDependencies ?? []), added] } }));
    onOpen(added.uuid);
  }

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters" />
        <div className="es-records__actions">
          <Pager rows={rows} noun="condition" onPage={setPage} />
          {editable && sc !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateEs((draft) => withScConditions(draft, sc))}>Import from SC</button>}
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCondition}>Add condition</button>}
        </div>
      </div>
      {conditions.length > 0 && (
        <div className="es-timing-table">
          <table className="postable es-records" aria-label="Phenomena">
            <thead>
              <tr>
                <th scope="col">Condition</th>
                <th scope="col">Phenomenon</th>
                <th scope="col">Onset</th>
                <th scope="col">Affected systems</th>
                <th scope="col">From</th>
                <th scope="col" className="es-records__act" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {conditions.slice(rows.start, rows.start + PAGE).map((condition) => (
                <tr key={condition.uuid}>
                  <td><span className="postable__name">{condition.name}</span></td>
                  <td>{condition.phenomenon.length === 0 ? "None" : condition.phenomenon}</td>
                  <td>{condition.onsetTiming === undefined || condition.onsetTiming.length === 0 ? "None" : condition.onsetTiming}</td>
                  <td>{listText(condition.affectedSystems)}</td>
                  <td>{sourceText(condition.importedFrom)}</td>
                  <td className="es-records__act"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${condition.name}`} onClick={() => onOpen(condition.uuid)}>{actionLabel}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function RepairPanel({ onOpen }: { onOpen: (id: string) => void }): JSX.Element {
  const { es, editable, mutateEs } = useEsWorkbook();
  const [page, setPage] = useState(0);
  const records = es.repairCreditRecords ?? [];
  const rows = paged(records.length, page);
  const actionLabel = editable ? "Edit" : "View";
  const sequenceName = new Map(es.eventSequences.map((sequence) => [sequence.uuid, sequence.name]));

  function addRecord(): void {
    if (!editable) return;
    const added: RepairCreditRecord = { uuid: crypto.randomUUID(), eventSequenceId: "", repairCredited: true, justification: "", implementsSrs: [] };
    setPage(Math.floor(records.length / PAGE));
    mutateEs((draft) => ({ ...draft, repairCreditRecords: [...(draft.repairCreditRecords ?? []), added] }));
    onOpen(added.uuid);
  }

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters" />
        <div className="es-records__actions">
          <Pager rows={rows} noun="repair record" onPage={setPage} />
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addRecord}>Add repair credit</button>}
        </div>
      </div>
      {records.length > 0 && (
        <div className="es-timing-table">
          <table className="postable es-records" aria-label="Repair credit">
            <thead>
              <tr>
                <th scope="col">Sequence</th>
                <th scope="col">Equipment</th>
                <th scope="col">Credited</th>
                <th scope="col">Time</th>
                <th scope="col">Access</th>
                <th scope="col" className="es-records__act" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {records.slice(rows.start, rows.start + PAGE).map((record) => (
                <tr key={record.uuid}>
                  <td><span className="postable__name">{record.eventSequenceId.length === 0 ? "None" : sequenceName.get(record.eventSequenceId) ?? readableId(record.eventSequenceId) ?? "Unresolved sequence"}</span></td>
                  <td>{record.equipment === undefined || record.equipment.length === 0 ? "None" : record.equipment}</td>
                  <td>{record.repairCredited ? "Yes" : "No"}</td>
                  <td className="es-timing-num">{record.timeMinutes === undefined ? "None" : minutesText(record.timeMinutes)}</td>
                  <td>{record.access === undefined || record.access.length === 0 ? "None" : record.access}</td>
                  <td className="es-records__act"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} repair credit`} onClick={() => onOpen(record.uuid)}>{actionLabel}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ChecksPanel({ findings, onOpen }: { findings: readonly TimingFinding[]; onOpen: (dialog: TimingDialog) => void }): JSX.Element {
  const [page, setPage] = useState(0);
  const rows = paged(findings.length, page);
  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters" />
        <div className="es-records__actions"><Pager rows={rows} noun="finding" onPage={setPage} /></div>
      </div>
      {findings.length > 0 && (
      <div className="es-timing-table">
        <table className="postable es-records" aria-label="Checks">
          <thead><tr><th scope="col">Severity</th><th scope="col">Check</th><th scope="col">Item</th><th scope="col">Detail</th></tr></thead>
          <tbody>
            {findings.slice(rows.start, rows.start + PAGE).map((finding, index) => (
              <tr key={`${finding.check}:${finding.target.id}:${String(rows.start + index)}`}>
                <td className={`es-severity es-severity--${finding.severity}`}>{finding.severity === "error" ? "Error" : "Warning"}</td>
                <td>{finding.check}</td>
                <td><button type="button" className="es-records__link" onClick={() => onOpen(finding.target)}>{finding.item}</button></td>
                <td>{finding.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </>
  );
}

function TimeLineDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { es, editable, mutateEs } = useEsWorkbook();
  const sequence = es.eventSequences.find((candidate) => candidate.uuid === id);
  if (sequence === undefined) return null;
  const timing = [...(sequence.timing ?? [])].sort((left, right) => left.timeAfterInitiator - right.timeAfterInitiator);

  function setTiming(update: (list: SequenceTiming[]) => SequenceTiming[]): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, eventSequences: draft.eventSequences.map((candidate) => (candidate.uuid === id ? { ...candidate, timing: update(candidate.timing ?? []) } : candidate)) }));
  }
  function patchEntry(uuid: string, fields: Partial<SequenceTiming>): void {
    setTiming((list) => list.map((entry) => (entry.uuid === uuid ? { ...entry, ...fields } : entry)));
  }

  return (
    <DialogShell label="Timeline" onClose={onClose} fit>
      <DialogHead cap="Timeline · ES-A6, A10" title={sequence.name} onClose={onClose} />
      <div className="modal__body">
        {timing.length > 0 && (
          <div className="es-timeline-fields">
            <table className="postable es-records" aria-label="Milestones">
              <thead>
                <tr>
                  <th scope="col">Milestone</th>
                  <th scope="col">Time (min)</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Basis</th>
                  <th scope="col">Analysis references</th>
                  {editable && <th scope="col" className="es-records__act" aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {timing.map((entry) => (
                  <tr key={entry.uuid}>
                    <td>{editable ? <WorkbookInput className="posfield__input es-timing-fit es-timing-fit--milestone" aria-label="Milestone" size={Math.max(8, entry.event.length + 2)} value={entry.event} onChange={(event) => { if (event.target.value.trim().length > 0) patchEntry(entry.uuid, { event: event.target.value }); }} /> : entry.event}</td>
                    <td className="es-timing-num">{editable ? (
                      <WorkbookInput className="posfield__input posmono es-timing-time" aria-label="Time after the initiator in minutes" inputMode="decimal" value={String(entry.timeAfterInitiator)} onChange={(event) => {
                        const text = event.target.value.trim();
                        const value = Number(text);
                        if (text.length > 0 && Number.isFinite(value)) patchEntry(entry.uuid, { timeAfterInitiator: value });
                      }} />
                    ) : minutesText(entry.timeAfterInitiator)}</td>
                    <td>
                      <select className="posfield__select es-timing-fit" aria-label="Kind" value={entry.category ?? "AUTOMATIC"} disabled={!editable} onChange={(event) => {
                        const kind = TIMING_KINDS.find((candidate) => candidate === event.target.value);
                        if (kind !== undefined) patchEntry(entry.uuid, { category: kind });
                      }}>
                        {TIMING_KINDS.map((kind) => <option key={kind} value={kind}>{CATEGORY_TEXT[kind]}</option>)}
                      </select>
                    </td>
                    <td>{editable ? <WorkbookInput className="posfield__input es-timing-fit es-timing-fit--basis" aria-label="Basis" size={Math.max(8, (entry.basis ?? "").length + 2)} value={entry.basis ?? ""} onChange={(event) => patchEntry(entry.uuid, { basis: event.target.value })} /> : entry.basis === undefined || entry.basis.length === 0 ? "None" : entry.basis}</td>
                    <td>{editable ? <WorkbookInput className="posfield__input es-timing-fit es-timing-fit--references" aria-label="Analysis references" size={Math.max(8, (entry.deterministicAnalysisReferences ?? []).join(", ").length + 2)} value={(entry.deterministicAnalysisReferences ?? []).join(", ")} onChange={(event) => patchEntry(entry.uuid, { deterministicAnalysisReferences: commaList(event.target.value) })} /> : listText(entry.deterministicAnalysisReferences)}</td>
                    {editable && <td className="es-records__act"><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setTiming((list) => list.filter((candidate) => candidate.uuid !== entry.uuid))}>Remove</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {editable && (
          <div className="posrow es-dialog-actions">
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => setTiming((list) => [...list, { uuid: crypto.randomUUID(), event: "New milestone", timeAfterInitiator: 0, category: "AUTOMATIC" }])}>Add milestone</button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function RepairDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { es, editable, mutateEs } = useEsWorkbook();
  const record = (es.repairCreditRecords ?? []).find((candidate) => candidate.uuid === id);
  if (record === undefined) return null;
  const trees = es.eventTrees ?? [];
  const loose = es.eventSequences.filter((sequence) => !trees.some((tree) => tree.uuid === sequence.eventTreeId));
  const known = es.eventSequences.some((sequence) => sequence.uuid === record.eventSequenceId);

  function write(update: (current: RepairCreditRecord) => RepairCreditRecord): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, repairCreditRecords: (draft.repairCreditRecords ?? []).map((candidate) => (candidate.uuid === id ? update(candidate) : candidate)) }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({ ...draft, repairCreditRecords: (draft.repairCreditRecords ?? []).filter((candidate) => candidate.uuid !== id) }));
  }

  return (
    <DialogShell label="Repair credit" onClose={onClose}>
      <DialogHead cap="Repair credit · ES-C9" onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Sequence</label>
            <select className="posfield__select" aria-label="Sequence" value={record.eventSequenceId} disabled={!editable} onChange={(event) => { const value = event.target.value; write((current) => ({ ...current, eventSequenceId: value })); }}>
              <option value="">None</option>
              {trees.map((tree) => (
                <optgroup key={tree.uuid} label={tree.name}>
                  {es.eventSequences.filter((sequence) => sequence.eventTreeId === tree.uuid).map((sequence) => <option key={sequence.uuid} value={sequence.uuid}>{sequence.name}</option>)}
                </optgroup>
              ))}
              {loose.map((sequence) => <option key={sequence.uuid} value={sequence.uuid}>{sequence.name}</option>)}
              {record.eventSequenceId.length > 0 && !known && <option value={record.eventSequenceId}>{readableId(record.eventSequenceId) ?? "Unresolved sequence"}</option>}
            </select>
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Equipment</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Equipment" value={record.equipment ?? ""} onChange={(event) => { const value = event.target.value; write((current) => ({ ...current, equipment: value })); }} /> : <div>{record.equipment === undefined || record.equipment.length === 0 ? "None" : record.equipment}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Repair credited</label>
            <select className="posfield__select" aria-label="Repair credited" value={record.repairCredited ? "yes" : "no"} disabled={!editable} onChange={(event) => { const credited = event.target.value === "yes"; write((current) => ({ ...current, repairCredited: credited })); }}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <NumberField label="Time to repair (min)" value={record.timeMinutes} editable={editable} onCommit={(value) => write((current) => {
            const { timeMinutes: _time, ...rest } = current;
            return value === undefined ? rest : { ...rest, timeMinutes: value };
          })} />
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Access</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Access" value={record.access ?? ""} onChange={(event) => { const value = event.target.value; write((current) => ({ ...current, access: value })); }} /> : <div>{record.access === undefined || record.access.length === 0 ? "None" : record.access}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Conservative basis</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Conservative basis" value={record.conservativeRepairBasis ?? ""} onChange={(event) => { const value = event.target.value; write((current) => ({ ...current, conservativeRepairBasis: value })); }} /> : <div>{record.conservativeRepairBasis === undefined || record.conservativeRepairBasis.length === 0 ? "None" : record.conservativeRepairBasis}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Risk-significant review</label>
            <select className="posfield__select" aria-label="Risk-significant review" value={record.riskSignificantReviewPerformed === undefined ? "" : record.riskSignificantReviewPerformed ? "yes" : "no"} disabled={!editable} onChange={(event) => {
              const value = event.target.value;
              write((current) => {
                const { riskSignificantReviewPerformed: _review, ...rest } = current;
                return value.length === 0 ? rest : { ...rest, riskSignificantReviewPerformed: value === "yes" };
              });
            }}>
              <option value="">Not recorded</option>
              <option value="yes">Performed</option>
              <option value="no">Not performed</option>
            </select>
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Justification</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Justification" value={record.justification} onChange={(event) => { const value = event.target.value; write((current) => ({ ...current, justification: value })); }} /> : <div>{record.justification.length === 0 ? "None" : record.justification}</div>}
          </div>
        </div>
        {editable && <div className="posrow es-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove repair credit</button></div>}
      </div>
    </DialogShell>
  );
}

function NumberField({ label, value, editable, onCommit }: { label: string; value: number | undefined; editable: boolean; onCommit: (value: number | undefined) => void }): JSX.Element {
  return (
    <div className="posfield"><label className="posfield__label">{label}</label>
      {editable ? (
        <WorkbookInput
          className="posfield__input posmono"
          aria-label={label}
          inputMode="decimal"
          value={value === undefined ? "" : String(value)}
          onChange={(event) => {
            const text = event.target.value.trim();
            const parsed = Number(text);
            if (text.length === 0) onCommit(undefined);
            else if (Number.isFinite(parsed)) onCommit(parsed);
          }}
        />
      ) : <div className="posmono">{value === undefined ? "None" : String(value)}</div>}
    </div>
  );
}

function WindowDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { es, upstream, posLink, ieLink, editable, mutateEs } = useEsWorkbook();
  const item = (es.operatorActionWindows ?? []).find((candidate) => candidate.uuid === id);
  if (item === undefined) return null;
  const hfes = (upstream?.hr?.humanFailureEvents ?? []).filter((hfe) => hfe.hfeTiming === "POST_INITIATOR");
  const groupChoices = [...new Set([...es.scopeDefinition.initiatingEventIds, ...ieLink.groups.map((group) => group.id)])].map((groupId) => ({ id: groupId, label: ieLink.groups.find((group) => group.id === groupId)?.name ?? "" }));
  const stateChoices = [...new Set([...es.scopeDefinition.plantOperatingStateIds, ...posLink.states.map((state) => state.id)])].map((stateId) => ({ id: stateId, label: posLink.states.find((state) => state.id === stateId)?.name ?? "" }));
  const hfeKnown = hfes.some((hfe) => hfe.uuid === item.humanActionId);

  function patch(fields: Partial<OperatorActionWindow>): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, operatorActionWindows: (draft.operatorActionWindows ?? []).map((candidate) => (candidate.uuid === id ? { ...candidate, ...fields } : candidate)) }));
  }
  function patchOptional(field: "cueMinutes" | "hepPointEstimate", value: number | undefined): void {
    if (!editable) return;
    mutateEs((draft) => ({
      ...draft,
      operatorActionWindows: (draft.operatorActionWindows ?? []).map((candidate) => {
        if (candidate.uuid !== id) return candidate;
        if (field === "cueMinutes") {
          const { cueMinutes: _cue, ...rest } = candidate;
          return value === undefined ? rest : { ...rest, cueMinutes: value };
        }
        const { hepPointEstimate: _hep, ...rest } = candidate;
        return value === undefined ? rest : { ...rest, hepPointEstimate: value };
      }),
    }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({ ...draft, operatorActionWindows: (draft.operatorActionWindows ?? []).filter((candidate) => candidate.uuid !== id) }));
  }

  return (
    <DialogShell label="Operator-action window" onClose={onClose}>
      <DialogHead cap="Operator-action window · ES-A4" onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Action</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Action" value={item.action} onChange={(event) => { if (event.target.value.trim().length > 0) patch({ action: event.target.value }); }} /> : <div>{item.action}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Human failure event</label>
            {hfes.length > 0 ? (
              <select className="posfield__select" aria-label="Human failure event" value={item.humanActionId} disabled={!editable} onChange={(event) => patch({ humanActionId: event.target.value })}>
                <option value="">None</option>
                {hfes.map((hfe) => <option key={hfe.uuid} value={hfe.uuid}>{hfe.name}</option>)}
                {item.humanActionId.length > 0 && !hfeKnown && <option value={item.humanActionId}>{readableId(item.humanActionId) ?? "HR event not in the linked workbook"}</option>}
              </select>
            ) : editable
              ? <WorkbookInput className="posfield__input posmono" aria-label="Human failure event" value={readableId(item.humanActionId) ?? ""} onChange={(event) => patch({ humanActionId: event.target.value.trim() })} />
              : <div className="posmono">{readableId(item.humanActionId) ?? "None"}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Cue</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Cue" value={item.cue ?? ""} onChange={(event) => patch({ cue: event.target.value })} /> : <div>{item.cue === undefined || item.cue.length === 0 ? "None" : item.cue}</div>}
          </div>
          <NumberField label="Cue at (min)" value={item.cueMinutes} editable={editable} onCommit={(value) => patchOptional("cueMinutes", value)} />
          <NumberField label="HEP" value={item.hepPointEstimate} editable={editable} onCommit={(value) => patchOptional("hepPointEstimate", value)} />
          <NumberField label="Window opens (min)" value={item.windowStartMinutes} editable={editable} onCommit={(value) => { if (value !== undefined) patch({ windowStartMinutes: value }); }} />
          <NumberField label="Window closes (min)" value={item.windowEndMinutes} editable={editable} onCommit={(value) => { if (value !== undefined) patch({ windowEndMinutes: value }); }} />
          <NumberField label="Time required (min)" value={item.requiredMinutes} editable={editable} onCommit={(value) => { if (value !== undefined) patch({ requiredMinutes: value }); }} />
        </div>
        <div className="posfield-grid es-timing-feasibility" role="group" aria-label="Feasibility">
          {FEASIBILITY_CRITERIA.map((criterion) => (
            <div key={criterion.id} className="posfield"><label className="posfield__label">{criterion.label}</label>
              <select className="posfield__select" aria-label={criterion.label} value={item.feasibility?.[criterion.id] ?? "OK"} disabled={!editable} onChange={(event) => {
                const state = FEASIBILITY_STATES.find((entry) => entry.id === event.target.value);
                if (state !== undefined) patch({ feasibility: { ...item.feasibility, [criterion.id]: state.id } });
              }}>
                {FEASIBILITY_STATES.map((state) => <option key={state.id} value={state.id}>{state.label}</option>)}
              </select>
            </div>
          ))}
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Feasibility note</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Feasibility note" value={item.note ?? ""} onChange={(event) => patch({ note: event.target.value })} /> : <div>{item.note === undefined || item.note.length === 0 ? "None" : item.note}</div>}
          </div>
        </div>
        <ChoiceEditor label="Initiating event groups" choices={groupChoices} values={item.applicableInitiatingEvents ?? []} editable={editable} addLabel="Add an initiating event group ID" onChange={(applicableInitiatingEvents) => patch({ applicableInitiatingEvents })} />
        <ChoiceEditor label="Operating states" choices={stateChoices} values={item.applicablePlantOperatingStates ?? []} editable={editable} addLabel="Add an operating state ID" onChange={(applicablePlantOperatingStates) => patch({ applicablePlantOperatingStates })} />
        {editable && <div className="posrow es-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove action</button></div>}
      </div>
    </DialogShell>
  );
}

function ConditionDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { es, upstream, editable, mutateEs } = useEsWorkbook();
  const condition = (es.dependencyModels?.phenomenologicalDependencies ?? []).find((candidate) => candidate.uuid === id);
  if (condition === undefined) return null;
  const systems = (upstream?.sy?.systemDefinitions ?? []).map((system) => ({ id: system.abbreviation === undefined || system.abbreviation.length === 0 ? system.name : system.abbreviation, label: system.name }));
  const asChoices = (values: readonly string[] | undefined): { id: string; label: string }[] => (values ?? []).map((value) => ({ id: value, label: "" }));

  function patch(fields: Partial<PhenomenologicalDependencyModel>): void {
    if (!editable) return;
    mutateEs((draft) => ({
      ...draft,
      dependencyModels: { ...draft.dependencyModels, phenomenologicalDependencies: (draft.dependencyModels?.phenomenologicalDependencies ?? []).map((candidate) => (candidate.uuid === id ? { ...candidate, ...fields } : candidate)) },
    }));
  }
  function remove(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({
      ...draft,
      dependencyModels: { ...draft.dependencyModels, phenomenologicalDependencies: (draft.dependencyModels?.phenomenologicalDependencies ?? []).filter((candidate) => candidate.uuid !== id) },
    }));
  }

  return (
    <DialogShell label="Phenomenological condition" onClose={onClose}>
      <DialogHead cap="Phenomenological condition · ES-B3" onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Name" value={condition.name} onChange={(event) => { if (event.target.value.trim().length > 0) patch({ name: event.target.value }); }} /> : <div>{condition.name}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Description</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Description" value={condition.description} onChange={(event) => patch({ description: event.target.value })} /> : <div>{condition.description.length === 0 ? "None" : condition.description}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Phenomenon</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Phenomenon" value={condition.phenomenon} onChange={(event) => patch({ phenomenon: event.target.value })} /> : <div>{condition.phenomenon.length === 0 ? "None" : condition.phenomenon}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Onset</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Onset" value={condition.onsetTiming ?? ""} onChange={(event) => patch({ onsetTiming: event.target.value })} /> : <div>{condition.onsetTiming === undefined || condition.onsetTiming.length === 0 ? "None" : condition.onsetTiming}</div>}
          </div>
        </div>
        <ChoiceEditor label="Affected systems" choices={systems} values={condition.affectedSystems} editable={editable} addLabel="Add an affected system" mono={false} onChange={(affectedSystems) => patch({ affectedSystems })} />
        <ChoiceEditor label="Harsh conditions" choices={asChoices(condition.environmentalConditions)} values={condition.environmentalConditions ?? []} editable={editable} addLabel="Add a harsh condition" mono={false} onChange={(environmentalConditions) => patch({ environmentalConditions })} />
        <ChoiceEditor label="Analysis references" choices={asChoices(condition.deterministicAnalysisReferences)} values={condition.deterministicAnalysisReferences ?? []} editable={editable} addLabel="Add an analysis reference" mono={false} onChange={(deterministicAnalysisReferences) => patch({ deterministicAnalysisReferences })} />
        {editable && <div className="posrow es-dialog-actions"><button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove condition</button></div>}
      </div>
    </DialogShell>
  );
}

function EsTimingScreen({ treeId, setTreeId }: { treeId: string; setTreeId: (id: string) => void }): JSX.Element {
  const { es } = useEsWorkbook();
  const [tab, setTab] = useState<TimingTab>("timelines");
  const [dialog, setDialog] = useState<TimingDialog | null>(null);
  const findings = useMemo(() => timingFindings(es), [es]);
  const close = (): void => setDialog(null);
  return (
    <>
      <div className="poscard es-seq-card">
        <TabBar tabs={TIMING_TABS} tab={tab} label="Timing sections" findings={findings.length} onTab={setTab} />
        <div role="tabpanel" aria-label={TIMING_TABS.find((item) => item.id === tab)?.label} className="es-seq-card__panel">
          {tab === "timelines" && <TimeLinesPanel treeId={treeId} setTreeId={setTreeId} onOpen={(id) => setDialog({ kind: "timeline", id })} />}
          {tab === "windows" && <WindowsPanel onOpen={(id) => setDialog({ kind: "window", id })} />}
          {tab === "phenomena" && <PhenomenaPanel onOpen={(id) => setDialog({ kind: "condition", id })} />}
          {tab === "repair" && <RepairPanel onOpen={(id) => setDialog({ kind: "repair", id })} />}
          {tab === "checks" && <ChecksPanel findings={findings} onOpen={setDialog} />}
        </div>
      </div>
      {dialog?.kind === "timeline" && <TimeLineDialog id={dialog.id} onClose={close} />}
      {dialog?.kind === "window" && <WindowDialog id={dialog.id} onClose={close} />}
      {dialog?.kind === "condition" && <ConditionDialog id={dialog.id} onClose={close} />}
      {dialog?.kind === "repair" && <RepairDialog id={dialog.id} onClose={close} />}
    </>
  );
}

export { CATEGORY_TEXT, EsTimingScreen, PAGE, Pager, TabBar, minutesText, paged };
