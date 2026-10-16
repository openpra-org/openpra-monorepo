import { JSX, useId, useMemo, useState } from "react";
import type {
  EsqActionFeasibility,
  EsqCombination,
  EsqExclusion,
  EsqFlag,
  EsqFlagTarget,
  EsqFlagTargetKind,
  EsqModel,
  EsqRecoveryRule,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { recoveryInputKey, repairFeasibility } from "interfaces-mef-types/esq/esq-post-inputs";
import { parameterLaw, parameterUnit } from "interfaces-mef-types/esq/esq-measure-inputs";
import { solveWorkOf } from "interfaces-mef-types/esq/esq-solve-inputs";
import type { EsqPostRunPurpose, EsqPostRunResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { ExpressionEditor } from "../newly-developed-methods/shared/uncertainEditor";
import { expressionText } from "../newly-developed-methods/shared/uncertainText";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
import { DialogHead, DialogShell } from "../es-workbooks/EsScope";
import { PAGE, Pager, TabBar, paged } from "../es-workbooks/EsTiming";
import {
  AreaField,
  CheckGroup,
  ChecksPanel,
  CUT_OFF_EXPONENTS,
  NumberField,
  TextField,
  decade,
  exponentOf,
  failedTrees,
  sciText,
  treeLabel,
  useInputPoints,
  useRunner,
  RunProgress,
  type Runner,
} from "./esqShared";
import { useEsqWorkbook } from "./esqWorkbookContext";
import { missionTimeSourcesOf, parameterTableOf } from "./esqModel";
import { FEASIBILITY_KEYS, FEASIBILITY_LABELS } from "./esqBarriers";
import {
  DEFAULT_RAISED_HEP,
  DEPENDENCE_LEVELS,
  JOINT_SOURCE_LABELS,
  LEVEL_LABELS,
  MODEL_AS_SET,
  logicViewOf,
  nextCombinationId,
  nextExclusionId,
  nextFlagId,
  nextRecoveryId,
  numberText,
  postRunProblem,
  recoveryRuleOf,
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
  type EsqLogicFinding,
  type EsqLogicView,
  type EsqRecoveryView,
} from "./esqLogic";
import { getEsqPostResult, runEsqPost } from "./esqWorkbookApi";
import "../es-workbooks/css/esSequences.css";

type LogicTab = "flags" | "loops" | "exclusions" | "recovery" | "dependence" | "checks";

type LogicDialog =
  | { kind: "flag"; id: string }
  | { kind: "loop"; id: string }
  | { kind: "exclusion"; id: string }
  | { kind: "recovery"; id: string }
  | { kind: "combination"; id: string }
  | { kind: "floor" };

const LOGIC_TABS: { id: LogicTab; label: string }[] = [
  { id: "flags", label: "Flags" },
  { id: "loops", label: "Loops" },
  { id: "exclusions", label: "Exclusions" },
  { id: "recovery", label: "Recovery" },
  { id: "dependence", label: "HFE dependence" },
  { id: "checks", label: "Checks" },
];

const KIND_LABELS: Record<EsqFlagTargetKind, string> = { HOUSE: "House event", EVENT: "Basic event", GATE: "Gate" };

const START_NON_RECOVERY: UncertainExpression = { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 0.1 } } };

const DEFAULT_PROBABILITY = 1e-3;

const NO_FEASIBILITY: EsqActionFeasibility = { procedure: false, training: false, cues: false, crew: false, time: false, access: false, equipment: false };

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function scopeText(groupIds: readonly string[], stateIds: readonly string[]): string {
  const parts = [groupIds.join(", "), stateIds.join(", ")].filter((part) => part.length > 0);
  return parts.length === 0 ? "Every tree" : parts.join(" in ");
}

function feasibilityOf(keys: readonly string[]): EsqActionFeasibility {
  return { procedure: keys.includes("procedure"), training: keys.includes("training"), cues: keys.includes("cues"), crew: keys.includes("crew"), time: keys.includes("time"), access: keys.includes("access"), equipment: keys.includes("equipment") };
}

function sameFeasibility(left: EsqActionFeasibility, right: EsqActionFeasibility): boolean {
  return FEASIBILITY_KEYS.every((key) => left[key] === right[key]);
}

function Flag({ children }: { children: string }): JSX.Element {
  return <span className="esq-dialog-flag">{children}</span>;
}

function Muted({ children }: { children: string }): JSX.Element {
  return <span className="posmuted">{children}</span>;
}

async function postRun(runner: Runner, model: EsqModel, workbookId: string, revision: number, purpose: EsqPostRunPurpose, cutOff: number, raisedHep?: number): Promise<EsqPostRunResult | undefined> {
  const response = await runEsqPost(workbookId, revision, MODEL_AS_SET, purpose, cutOff, raisedHep, runner.progress);
  if (response.run.status !== "SUCCEEDED") {
    await runner.failRun(workbookId, response.run, model);
    return undefined;
  }
  return getEsqPostResult(workbookId, response.run.id);
}

function RunError({ runner, model }: { runner: Runner; model: EsqModel }): JSX.Element | null {
  if (runner.error === null) return <RunProgress runner={runner} />;
  return (
    <>
      <p className="es-scope-error" role="alert">{runner.error}</p>
      {runner.failed.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Failed event trees">
          <thead><tr><th scope="col">Event tree</th><th scope="col">Why it failed</th></tr></thead>
          <tbody>
            {runner.failed.map((tree) => (
              <tr key={tree.treeId}>
                <td>{treeLabel(model, tree.treeId)}</td>
                <td>{tree.failure ?? "Not given"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function CutOffFilter({ value, onChange }: { value: number; onChange: (value: number) => void }): JSX.Element {
  const id = useId();
  return (
    <div className="es-records__filter">
      <label className="posfield__label" htmlFor={id}>Cutoff (/yr)</label>
      <select id={id} className="posfield__select" value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {CUT_OFF_EXPONENTS.map((exponent) => <option key={exponent} value={exponent}>{`1E${exponent}`}</option>)}
      </select>
    </div>
  );
}

function EventListField({ label, eventIds, options, editable, onChange }: { label: string; eventIds: readonly string[]; options: readonly EsqEventOption[]; editable: boolean; onChange: (eventIds: string[]) => void }): JSX.Element {
  const remaining = options.filter((option) => !eventIds.includes(option.id));
  return (
    <div className="posfield posfield-grid--span2" role="group" aria-label={label}>
      <span className="posfield__label">{label}</span>
      <div className="esq-dialog-list">
        {eventIds.map((eventId, index) => (
          <div key={`${eventId}:${String(index)}`} className="esq-dialog-row">
            <select className="posfield__select" aria-label={`${label} ${String(index + 1)}`} value={eventId} disabled={!editable} onChange={(event) => onChange(eventIds.map((current, position) => (position === index ? event.target.value : current)))}>
              {!options.some((option) => option.id === eventId) && <option value={eventId}>{`${eventId} · not imported`}</option>}
              {options.filter((option) => option.id === eventId || !eventIds.includes(option.id)).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onChange(eventIds.filter((_, position) => position !== index))}>Remove</button>}
          </div>
        ))}
        {editable && remaining.length > 0 && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => {
            const next = remaining[0];
            if (next !== undefined) onChange([...eventIds, next.id]);
          }}>Add event</button>
        )}
      </div>
    </div>
  );
}

function ScopeFields({ view, groupIds, stateIds, editable, onChange }: { view: EsqLogicView; groupIds: readonly string[]; stateIds: readonly string[]; editable: boolean; onChange: (groupIds: string[], stateIds: string[]) => void }): JSX.Element {
  return (
    <>
      <CheckGroup label="Initiator groups" options={view.groups.map((group) => ({ id: group, label: group }))} values={groupIds} editable={editable} onChange={(next) => onChange(next, [...stateIds])} />
      <CheckGroup label="Operating states" options={view.states.map((state) => ({ id: state, label: state }))} values={stateIds} editable={editable} onChange={(next) => onChange([...groupIds], next)} />
    </>
  );
}

function FlagsPanel({ view, onOpen }: { view: EsqLogicView; onOpen: (id: string) => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const [page, setPage] = useState(0);
  const rows = paged(view.flags.length, page);
  const shown = view.flags.slice(rows.start, rows.start + PAGE);
  const actionLabel = editable ? "Edit" : "View";

  function add(): void {
    if (!editable) return;
    const id = nextFlagId(esq);
    mutateEsq((draft) => withFlag(draft, id, { id, name: "", state: false, groupIds: [], stateIds: [], basis: "" }));
    setPage(Math.floor(view.flags.length / PAGE));
    onOpen(id);
  }

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters" />
        <div className="es-records__actions">
          <Pager rows={rows} noun="flag" onPage={setPage} />
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>Add flag</button>}
        </div>
      </div>
      {view.flags.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Flags">
          <thead><tr><th scope="col">Flag</th><th scope="col">Sets</th><th scope="col">State</th><th scope="col">Applies to</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((entry) => {
              const flag = entry.flag;
              return (
                <tr key={flag.id}>
                  <td>
                    {blank(flag.name) ? <Flag>Not named</Flag> : <span className="postable__name">{flag.name}</span>}
                    <span className="postable__name-sub">{flag.id}</span>
                  </td>
                  <td>{entry.found ? entry.target : <Flag>{entry.target}</Flag>}</td>
                  <td>{flag.state ? "TRUE" : "FALSE"}</td>
                  <td>{scopeText(flag.groupIds, flag.stateIds)}</td>
                  <td className="es-records__act">
                    <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${flag.id}`} onClick={() => onOpen(flag.id)}>{actionLabel}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

function targetOptions(model: EsqModel, kind: EsqFlagTargetKind, modelId: string | undefined): EsqEventOption[] {
  if (kind === "EVENT") return [...model.events].sort((a, b) => a.code.localeCompare(b.code)).map((event) => ({ id: event.id, label: event.name.length > 0 ? `${event.code} · ${event.name}` : event.code }));
  const top = model.tops.find((candidate) => candidate.modelId === modelId);
  const nodes = kind === "HOUSE" ? top?.houseEvents ?? [] : top?.gates ?? [];
  return nodes.map((node) => ({ id: node.id, label: node.name.length > 0 ? `${node.code} · ${node.name}` : node.code }));
}

function firstTarget(model: EsqModel, kind: EsqFlagTargetKind, modelId: string | undefined): EsqFlagTarget | undefined {
  const first = targetOptions(model, kind, modelId)[0];
  if (first === undefined) return undefined;
  if (kind === "EVENT") return { kind, id: first.id };
  return modelId === undefined ? undefined : { kind, id: first.id, modelId };
}

function FlagDialog({ id, view, onClose }: { id: string; view: EsqLogicView; onClose: () => void }): JSX.Element | null {
  const { editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const entry = view.flags.find((candidate) => candidate.flag.id === id);
  const model = view.model;
  const [kind, setKind] = useState<EsqFlagTargetKind>(entry?.flag.target?.kind ?? "HOUSE");
  const [modelId, setModelId] = useState<string | undefined>(entry?.flag.target?.modelId ?? model.tops.find((top) => (top.houseEvents ?? []).length > 0)?.modelId ?? model.tops[0]?.modelId);
  if (entry === undefined) return null;
  const flag = entry.flag;
  const options = targetOptions(model, kind, modelId);

  function save(next: EsqFlag): void {
    if (!editable) return;
    mutateEsq((draft) => withFlag(draft, id, next));
  }

  function setTarget(next: EsqFlagTarget | undefined): void {
    const updated: EsqFlag = { ...flag };
    if (next === undefined) delete updated.target;
    else updated.target = next;
    save(updated);
  }

  return (
    <DialogShell label="Flag" onClose={onClose}>
      <DialogHead cap="Flag · ESQ-B9" title={blank(flag.name) ? id : `${id} · ${flag.name}`} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid esq-dialog-fields">
          <TextField label="Name" value={flag.name} editable={editable} wide onChange={(name) => save({ ...flag, name })} />
          <div className="posfield">
            <label className="posfield__label" htmlFor={`${fieldId}-kind`}>Sets</label>
            <select id={`${fieldId}-kind`} className="posfield__select" value={kind} disabled={!editable} onChange={(event) => {
              const next: EsqFlagTargetKind = event.target.value === "EVENT" ? "EVENT" : event.target.value === "GATE" ? "GATE" : "HOUSE";
              setKind(next);
              setTarget(firstTarget(model, next, modelId));
            }}>
              {(["HOUSE", "EVENT", "GATE"] as const).map((value) => <option key={value} value={value}>{KIND_LABELS[value]}</option>)}
            </select>
          </div>
          {kind !== "EVENT" && (
            <div className="posfield">
              <label className="posfield__label" htmlFor={`${fieldId}-tree`}>Fault tree</label>
              <select id={`${fieldId}-tree`} className="posfield__select" value={modelId ?? ""} disabled={!editable} onChange={(event) => {
                setModelId(event.target.value);
                setTarget(firstTarget(model, kind, event.target.value));
              }}>
                {model.tops.map((top) => <option key={top.modelId} value={top.modelId}>{top.name.length > 0 ? `${top.code} · ${top.name}` : top.code}</option>)}
              </select>
            </div>
          )}
          <div className="posfield posfield-grid--span2">
            <label className="posfield__label" htmlFor={`${fieldId}-target`}>{KIND_LABELS[kind]}</label>
            <select id={`${fieldId}-target`} className="posfield__select" value={flag.target?.kind === kind ? flag.target.id : ""} disabled={!editable || options.length === 0} onChange={(event) => setTarget(kind === "EVENT" ? { kind, id: event.target.value } : modelId === undefined ? undefined : { kind, id: event.target.value, modelId })}>
              {(flag.target?.kind !== kind || options.length === 0) && <option value="">{options.length === 0 ? "None in this fault tree" : "Not set"}</option>}
              {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </div>
          <div className="posfield">
            <label className="posfield__label" htmlFor={`${fieldId}-state`}>State</label>
            <select id={`${fieldId}-state`} className="posfield__select" value={flag.state ? "TRUE" : "FALSE"} disabled={!editable} onChange={(event) => save({ ...flag, state: event.target.value === "TRUE" })}>
              <option value="TRUE">TRUE</option>
              <option value="FALSE">FALSE</option>
            </select>
          </div>
          <ScopeFields view={view} groupIds={flag.groupIds} stateIds={flag.stateIds} editable={editable} onChange={(groupIds, stateIds) => save({ ...flag, groupIds, stateIds })} />
          <AreaField label="Basis" value={flag.basis} editable={editable} required onChange={(basis) => save({ ...flag, basis })} />
        </div>
        {editable && (
          <div className="posrow es-dialog-actions">
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withFlag(draft, id, undefined)); onClose(); }}>Delete flag</button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function LoopsPanel({ view, onOpen }: { view: EsqLogicView; onOpen: (key: string) => void }): JSX.Element {
  const { editable, mutateEsq } = useEsqWorkbook();
  const [page, setPage] = useState(0);
  const rows = paged(view.loops.length, page);
  const shown = view.loops.slice(rows.start, rows.start + PAGE);
  const actionLabel = editable ? "Edit" : "View";
  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters" />
        <div className="es-records__actions">
          <Pager rows={rows} noun="loop" onPage={setPage} />
          {editable && view.unusedBreaks.length > 0 && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateEsq((draft) => withUnusedBreaksRemoved(draft))}>Remove unused breaks</button>}
        </div>
      </div>
      {view.loops.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Loops">
          <thead><tr><th scope="col">Loop</th><th scope="col">Cut at</th><th scope="col">State</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((loop) => {
              const cuts = loop.edges.flatMap((edge) => (edge.cut === undefined ? [] : [`${edge.fromCode} to ${edge.toCode}`]));
              const states = [...new Set(loop.breaks.map((entry) => (entry.state ? "TRUE" : "FALSE")))];
              const label = loop.codes.join(", ");
              return (
                <tr key={loop.key}>
                  <td><span className="postable__name">{label}</span></td>
                  <td>{cuts.length > 0 ? cuts.join(", ") : loop.reached ? <Flag>Not cut</Flag> : <Muted>Not reached</Muted>}</td>
                  <td>{states.length === 0 ? <Muted>None</Muted> : states.join(", ")}</td>
                  <td className="es-records__act">
                    <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${label}`} onClick={() => onOpen(loop.key)}>{actionLabel}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

function LoopDialog({ id, view, onClose }: { id: string; view: EsqLogicView; onClose: () => void }): JSX.Element | null {
  const { editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const loop = view.loops.find((candidate) => candidate.key === id);
  if (loop === undefined) return null;
  return (
    <DialogShell label="Loop" onClose={onClose}>
      <DialogHead cap="Loop · ESQ-B5" title={loop.codes.join(", ")} onClose={onClose} />
      <div className="modal__body">
        {loop.edges.map((edge, index) => {
          const cut = edge.cut;
          return (
            <div key={`${edge.fromModelId}:${edge.toModelId}`} className="esq-dialog-section">
              <span className="esq-dialog-head">{`${edge.fromCode} to ${edge.toCode}`}</span>
              <div className="posfield-grid esq-dialog-fields">
                <div className="posfield">
                  <label className="posfield__label" htmlFor={`${fieldId}-cut-${String(index)}`}>Transfer</label>
                  <select id={`${fieldId}-cut-${String(index)}`} className="posfield__select" value={cut === undefined ? "" : cut.state ? "TRUE" : "FALSE"} disabled={!editable} onChange={(event) => {
                    const value = event.target.value;
                    if (!editable) return;
                    mutateEsq((draft) => withLoopBreak(draft, edge.fromModelId, edge.toModelId, value.length === 0 ? undefined : { fromModelId: edge.fromModelId, toModelId: edge.toModelId, state: value === "TRUE", basis: cut?.basis ?? "" }));
                  }}>
                    <option value="">Kept</option>
                    <option value="TRUE">Cut, set TRUE</option>
                    <option value="FALSE">Cut, set FALSE</option>
                  </select>
                </div>
                {cut !== undefined && (
                  <AreaField label="Basis" value={cut.basis} editable={editable} required onChange={(basis) => { if (editable) mutateEsq((draft) => withLoopBreak(draft, edge.fromModelId, edge.toModelId, { ...cut, basis })); }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </DialogShell>
  );
}

function ExclusionsPanel({ view, onOpen }: { view: EsqLogicView; onOpen: (id: string) => void }): JSX.Element {
  const { esq, editable, runtime, mutateEsq } = useEsqWorkbook();
  const [exponent, setExponent] = useState(() => exponentOf(solveWorkOf(esq).run));
  const [page, setPage] = useState(0);
  const runner = useRunner();
  const blocked = analysisSaveBlock(runtime);
  const deletions = view.work.deletions;
  const checkable = view.exclusions.some((entry) => entry.checkable);
  const rows = paged(view.exclusions.length, page);
  const shown = view.exclusions.slice(rows.start, rows.start + PAGE);
  const actionLabel = editable ? "Edit" : "View";

  function add(): void {
    if (!editable) return;
    const id = nextExclusionId(esq);
    mutateEsq((draft) => withExclusion(draft, id, { id, eventIds: [], basis: "" }));
    setPage(Math.floor(view.exclusions.length / PAGE));
    onOpen(id);
  }

  function check(): void {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null) return;
    runner.start(async () => {
      const summary = await postRun(runner, view.model, workbookId, revision, "DELETIONS", decade(exponent));
      if (summary === undefined) return;
      const problem = postRunProblem(summary, esq);
      if (problem !== undefined) {
        runner.fail(problem, failedTrees(summary));
        return;
      }
      mutateEsq((draft) => withDeletions(draft, summary));
    });
  }

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters">
          <CutOffFilter value={exponent} onChange={setExponent} />
        </div>
        <div className="es-records__actions">
          <Pager rows={rows} noun="exclusion" onPage={setPage} />
          {editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={runner.running || blocked !== null || !checkable} title={blocked ?? undefined} onClick={check}>{runner.running ? "Checking" : "Check deletions"}</button>}
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>Add exclusion</button>}
        </div>
      </div>
      <RunError runner={runner} model={view.model} />
      {view.exclusions.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Exclusions">
          <thead><tr><th scope="col">Exclusion</th><th scope="col">Events</th><th scope="col">Cut sets</th><th scope="col">Frequency (/yr)</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((entry) => {
              const exclusion = entry.exclusion;
              const finding = entry.finding;
              return (
                <tr key={exclusion.id}>
                  <td><span className="postable__name">{exclusion.id}</span></td>
                  <td>{entry.codes.length === 0 ? <Flag>Not set</Flag> : entry.codes.join(", ")}</td>
                  <td className="posmono">{deletions === undefined || !entry.checkable ? <Muted>Not checked</Muted> : String(finding?.cutSetCount ?? 0)}</td>
                  <td className="posmono">{finding === undefined ? <Muted>None</Muted> : sciText(finding.nominalFrequency)}</td>
                  <td className="es-records__act">
                    <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${exclusion.id}`} onClick={() => onOpen(exclusion.id)}>{actionLabel}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

function ExclusionDialog({ id, view, onClose }: { id: string; view: EsqLogicView; onClose: () => void }): JSX.Element | null {
  const { editable, mutateEsq } = useEsqWorkbook();
  const entry = view.exclusions.find((candidate) => candidate.exclusion.id === id);
  if (entry === undefined) return null;
  const exclusion = entry.exclusion;

  function save(next: EsqExclusion): void {
    if (!editable) return;
    mutateEsq((draft) => withExclusion(draft, id, next));
  }

  return (
    <DialogShell label="Exclusion" onClose={onClose}>
      <DialogHead cap="Exclusion · ESQ-B7 · B8" title={id} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid esq-dialog-fields">
          <EventListField label="Events that cannot occur together" eventIds={exclusion.eventIds} options={view.events} editable={editable} onChange={(eventIds) => save({ ...exclusion, eventIds })} />
          <AreaField label="Basis" value={exclusion.basis} editable={editable} required onChange={(basis) => save({ ...exclusion, basis })} />
        </div>
        {editable && (
          <div className="posrow es-dialog-actions">
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withExclusion(draft, id, undefined)); onClose(); }}>Delete exclusion</button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function recoveryOrigin(entry: EsqRecoveryView): string {
  const recovery = entry.recovery;
  if (recovery.record !== undefined) return `Imported from HR · ${recovery.record.id}`;
  if (recovery.repairRecord !== undefined) return `Imported from ES · ${entry.sequenceCode ?? recovery.repairRecord.sequenceId}`;
  return recovery.repair ? "Typed repair" : "Typed recovery action";
}

function creditCell(entry: EsqRecoveryView): JSX.Element {
  const recovery = entry.recovery;
  if (!recovery.credited) return <>No</>;
  if (recovery.missing.length > 0) return <Flag>Not feasible</Flag>;
  if (recovery.expression === undefined) return <Flag>No value</Flag>;
  if (recovery.eventIds.length === 0) return <Flag>No event</Flag>;
  return <>Yes</>;
}

function RecoveryPanel({ view, points, onOpen }: { view: EsqLogicView; points: ReadonlyMap<string, number>; onOpen: (id: string) => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const [page, setPage] = useState(0);
  const rows = paged(view.recoveries.length, page);
  const shown = view.recoveries.slice(rows.start, rows.start + PAGE);
  const actionLabel = editable ? "Edit" : "View";

  function add(repair: boolean): void {
    if (!editable) return;
    const id = nextRecoveryId(esq);
    const manual = repair ? { name: "", repair: true } : { name: "" };
    mutateEsq((draft) => withRecoveryRule(draft, id, { id, manual, eventIds: [], groupIds: [], stateIds: [], credited: false, basis: "" }));
    setPage(Math.floor(view.recoveries.length / PAGE));
    onOpen(id);
  }

  function valueCell(entry: EsqRecoveryView): JSX.Element {
    const recovery = entry.recovery;
    if (recovery.expression === undefined) return recovery.credited ? <Flag>Not set</Flag> : <Muted>None</Muted>;
    const point = points.get(recoveryInputKey(recovery));
    if (point !== undefined) return <>{sciText(point)}</>;
    return <>{recovery.source === "DA" ? recovery.parameterId ?? "DA" : expressionText(recovery.expression)}</>;
  }

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters" />
        <div className="es-records__actions">
          <Pager rows={rows} noun="recovery" plural="recoveries" onPage={setPage} />
          {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => add(true)}>Add repair</button>}
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => add(false)}>Add recovery action</button>}
        </div>
      </div>
      {view.recoveries.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Recovery">
          <thead><tr><th scope="col">Recovery</th><th scope="col">Restores</th><th scope="col">Non-recovery</th><th scope="col">Credited</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((entry) => {
              const recovery = entry.recovery;
              return (
                <tr key={recovery.id}>
                  <td>
                    {blank(recovery.name) ? <Flag>Not named</Flag> : <span className="postable__name">{recovery.name}</span>}
                    <span className="postable__name-sub">{recoveryOrigin(entry)}</span>
                  </td>
                  <td>{entry.codes.length > 0 ? entry.codes.join(", ") : recovery.credited ? <Flag>Not set</Flag> : <Muted>None</Muted>}</td>
                  <td className="posmono">{valueCell(entry)}</td>
                  <td>{creditCell(entry)}</td>
                  <td className="es-records__act">
                    <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${recovery.id}`} onClick={() => onOpen(recovery.id)}>{actionLabel}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

function RecoveryDialog({ id, view, onClose }: { id: string; view: EsqLogicView; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const entry = view.recoveries.find((candidate) => candidate.recovery.id === id);
  if (entry === undefined) return null;
  const recovery = entry.recovery;
  const record = recovery.record;
  const repairRecord = recovery.repairRecord;
  const rule = recoveryRuleOf(esq, id);
  const feasibility = recovery.feasibility ?? NO_FEASIBILITY;
  const imported = record?.feasibility ?? (repairRecord === undefined ? undefined : repairFeasibility(repairRecord));
  const parameters = view.model.parameters.filter((parameter) => parameterUnit(parameter) === "PROBABILITY" && parameterLaw(parameter) !== undefined);
  const options = recovery.repair ? view.events.filter((option) => !view.hfeIds.includes(option.id)) : view.members.filter((option) => view.hfeIds.includes(option.id));
  const noun = recovery.repair ? "repair" : "recovery";

  function save(next: EsqRecoveryRule): void {
    if (!editable) return;
    mutateEsq((draft) => withRecoveryRule(draft, id, next));
  }

  function without(key: "eventIds" | "feasibility"): EsqRecoveryRule {
    const next: EsqRecoveryRule = { ...rule };
    delete next[key];
    return next;
  }

  function setRecord(value: string): void {
    const next: EsqRecoveryRule = { ...rule };
    if (value === "HRA") next.ofRecord = "HRA";
    else if (value === "DA") {
      next.ofRecord = "DA";
      const first = parameters[0];
      if (next.parameterId === undefined && first !== undefined) next.parameterId = first.id;
    } else if (value === "TYPED") {
      next.ofRecord = "TYPED";
      if (next.typed === undefined) next.typed = { expression: START_NON_RECOVERY, source: "" };
    } else delete next.ofRecord;
    save(next);
  }

  return (
    <DialogShell label="Recovery" onClose={onClose} fit>
      <DialogHead cap={recovery.repair ? "Repair · ESQ-A7" : "Recovery · ESQ-A7 · C2"} title={blank(recovery.name) ? id : `${id} · ${recovery.name}`} onClose={onClose} />
      <div className="modal__body esq-dialog-body">
        <div className="esq-dialog-section">
          <span className="esq-dialog-head">{recovery.repair ? "Repair" : "Recovery"}</span>
          <div className="posfield-grid esq-dialog-fields">
            {rule.manual !== undefined && <TextField label="Name" value={rule.manual.name} editable={editable} wide onChange={(name) => { if (rule.manual !== undefined) save({ ...rule, manual: { ...rule.manual, name } }); }} />}
            <div className="posfield">
              <label className="posfield__label" htmlFor={`${fieldId}-credit`}>Credit</label>
              <select id={`${fieldId}-credit`} className="posfield__select" value={recovery.credited ? "yes" : "no"} disabled={!editable} onChange={(event) => save({ ...rule, credited: event.target.value === "yes" })}>
                <option value="no">Not credited</option>
                <option value="yes">Credited</option>
              </select>
            </div>
            <EventListField label={recovery.repair ? "Events it repairs" : "Events it recovers"} eventIds={recovery.eventIds} options={options} editable={editable} onChange={(eventIds) => save({ ...rule, eventIds })} />
            <ScopeFields view={view} groupIds={recovery.groupIds} stateIds={recovery.stateIds} editable={editable} onChange={(groupIds, stateIds) => save({ ...rule, groupIds, stateIds })} />
          </div>
          {editable && record !== undefined && rule.eventIds !== undefined && (
            <div className="posrow es-dialog-actions">
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => save(without("eventIds"))}>{`Use the events bound to ${record.hfeId}`}</button>
            </div>
          )}
        </div>
        <div className="esq-dialog-section">
          <span className="esq-dialog-head">Value</span>
          <div className="posfield-grid esq-dialog-fields">
            <div className="posfield">
              <label className="posfield__label" htmlFor={`${fieldId}-record`}>{recovery.repair ? "Non-repair probability" : "Non-recovery HEP"}</label>
              <select id={`${fieldId}-record`} className="posfield__select" value={recovery.source ?? ""} disabled={!editable} onChange={(event) => setRecord(event.target.value)}>
                {recovery.source === undefined && <option value="">Not set</option>}
                {record?.hep !== undefined && <option value="HRA">{`Imported from HR · ${expressionText(record.hep)}`}</option>}
                {(parameters.length > 0 || recovery.source === "DA") && <option value="DA">Imported from DA</option>}
                <option value="TYPED">Typed</option>
              </select>
            </div>
            {recovery.source === "DA" && (
              <div className="posfield">
                <label className="posfield__label" htmlFor={`${fieldId}-parameter`}>DA parameter</label>
                <select id={`${fieldId}-parameter`} className="posfield__select" value={rule.parameterId ?? ""} disabled={!editable} onChange={(event) => save({ ...rule, parameterId: event.target.value })}>
                  {rule.parameterId === undefined && <option value="">Not set</option>}
                  {rule.parameterId !== undefined && !parameters.some((parameter) => parameter.id === rule.parameterId) && <option value={rule.parameterId}>{`${rule.parameterId} · not imported`}</option>}
                  {parameters.map((parameter) => <option key={parameter.id} value={parameter.id}>{`${parameter.id} · ${parameter.name}`}</option>)}
                </select>
              </div>
            )}
            {recovery.source === "TYPED" && rule.typed !== undefined && (
              <>
                <div className="posfield posfield-grid--span2">
                  <span className="posfield__label">{`Typed ${recovery.repair ? "non-repair probability" : "non-recovery HEP"}`}</span>
                  <ExpressionEditor expression={rule.typed.expression} unit="PROBABILITY" disabled={!editable} onChange={(expression) => { if (rule.typed !== undefined) save({ ...rule, typed: { ...rule.typed, expression } }); }} />
                </div>
                <AreaField label="Source of the typed value" value={rule.typed.source} editable={editable} required onChange={(source) => { if (rule.typed !== undefined) save({ ...rule, typed: { ...rule.typed, source } }); }} />
              </>
            )}
          </div>
        </div>
        <div className="esq-dialog-section">
          <span className="esq-dialog-head">Feasibility</span>
          <div className="posfield-grid esq-dialog-fields">
            <CheckGroup label="Feasibility shown" options={FEASIBILITY_KEYS.map((key) => ({ id: key, label: FEASIBILITY_LABELS[key] }))} values={FEASIBILITY_KEYS.filter((key) => feasibility[key])} editable={editable} onChange={(keys) => save({ ...rule, feasibility: feasibilityOf(keys) })} />
            <AreaField label="Basis" value={rule.basis} editable={editable} required={recovery.credited} onChange={(basis) => save({ ...rule, basis })} />
          </div>
          {editable && imported !== undefined && rule.feasibility !== undefined && !sameFeasibility(rule.feasibility, imported) && (
            <div className="posrow es-dialog-actions">
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => save(without("feasibility"))}>{record !== undefined ? "Use HR feasibility" : "Use the ES record"}</button>
            </div>
          )}
        </div>
        {editable && rule.manual !== undefined && (
          <div className="posrow es-dialog-actions">
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withRecoveryRule(draft, id, undefined)); onClose(); }}>{`Delete ${noun}`}</button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function DependencePanel({ view, onOpen, onFloor }: { view: EsqLogicView; onOpen: (id: string) => void; onFloor: () => void }): JSX.Element {
  const { esq, editable, runtime, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const [exponent, setExponent] = useState(() => exponentOf(solveWorkOf(esq).run));
  const [raised, setRaised] = useState(DEFAULT_RAISED_HEP);
  const [page, setPage] = useState(0);
  const runner = useRunner();
  const blocked = analysisSaveBlock(runtime);
  const unassessed = view.combinations.filter((row) => row.entry === undefined);
  const raisedValid = raised > 0 && raised <= 1;
  const rows = paged(view.combinations.length, page);
  const shown = view.combinations.slice(rows.start, rows.start + PAGE);
  const actionLabel = editable ? "Edit" : "View";

  function search(): void {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null || !raisedValid) return;
    runner.start(async () => {
      const summary = await postRun(runner, view.model, workbookId, revision, "COMBINATIONS", decade(exponent), raised);
      if (summary === undefined) return;
      const problem = postRunProblem(summary, esq);
      if (problem !== undefined) {
        runner.fail(problem, failedTrees(summary));
        return;
      }
      mutateEsq((draft) => withSearch(draft, summary));
    });
  }

  function add(): void {
    if (!editable) return;
    const id = nextCombinationId(esq);
    mutateEsq((draft) => withCombination(draft, id, { id, eventIds: [], groupIds: [], stateIds: [], basis: "" }));
    setPage(Math.floor(view.combinations.length / PAGE));
    onOpen(id);
  }

  function assess(row: EsqCombinationView): void {
    if (!editable) return;
    const id = nextCombinationId(esq);
    mutateEsq((draft) => withCombinationsFor(draft, [row.eventIds]));
    onOpen(id);
  }

  function action(row: EsqCombinationView): JSX.Element | null {
    const entry = row.entry;
    if (entry !== undefined) return <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${entry.combination.id}`} onClick={() => onOpen(entry.combination.id)}>{actionLabel}</button>;
    return editable ? <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Assess ${row.codes.join(" · ")}`} onClick={() => assess(row)}>Assess</button> : null;
  }

  function jointCell(row: EsqCombinationView): JSX.Element {
    const entry = row.entry;
    if (entry === undefined) return <Muted>None</Muted>;
    return entry.joint === undefined ? <Flag>Not set</Flag> : <>{sciText(entry.joint)}</>;
  }

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters">
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-raised`}>Raised HEP</label>
            <input id={`${fieldId}-raised`} type="number" min={0} max={1} step={0.1} className="posfield__input posmono esq-dialog-number" aria-invalid={!raisedValid} value={raised} onChange={(event) => setRaised(Number(event.target.value))} />
            {!raisedValid && <span className="esq-dialog-error" role="alert">Above 0, at most 1</span>}
          </div>
          <CutOffFilter value={exponent} onChange={setExponent} />
        </div>
        <div className="es-records__actions">
          <Pager rows={rows} noun="combination" onPage={setPage} />
          {editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={runner.running || blocked !== null || !raisedValid} title={blocked ?? undefined} onClick={search}>{runner.running ? "Searching" : "Search"}</button>}
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onFloor}>Joint HEP floor</button>
          {editable && unassessed.length > 0 && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateEsq((draft) => withCombinationsFor(draft, unassessed.map((row) => row.eventIds)))}>{`Assess all ${String(unassessed.length)}`}</button>}
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>Add combination</button>}
        </div>
      </div>
      <RunError runner={runner} model={view.model} />
      {view.combinations.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="HFE combinations">
          <thead><tr><th scope="col">Combination</th><th scope="col">Joint HEP</th><th scope="col">From</th><th scope="col">Nominal (/yr)</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((row) => {
              const entry = row.entry;
              return (
                <tr key={row.key}>
                  <td>
                    {row.codes.length === 0 ? <Flag>No events</Flag> : <span className="postable__name">{row.codes.join(" · ")}</span>}
                    {entry === undefined ? <Flag>Not assessed</Flag> : <span className="postable__name-sub">{entry.combination.id}</span>}
                  </td>
                  <td className="posmono">{jointCell(row)}</td>
                  <td>{entry === undefined ? <Muted>None</Muted> : entry.source === undefined ? <Flag>Not set</Flag> : JOINT_SOURCE_LABELS[entry.source]}</td>
                  <td className="posmono">{row.finding === undefined ? <Muted>None</Muted> : sciText(row.finding.nominalFrequency)}</td>
                  <td className="es-records__act">{action(row)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

function CombinationDialog({ id, view, onClose }: { id: string; view: EsqLogicView; onClose: () => void }): JSX.Element | null {
  const { editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const entry = view.combinations.find((candidate) => candidate.entry?.combination.id === id)?.entry;
  if (entry === undefined) return null;
  const combination = entry.combination;
  const dependencies = view.model.dependencies ?? [];
  const inherited = entry.hr?.level ?? entry.suggested?.level;

  function save(next: EsqCombination): void {
    if (!editable) return;
    mutateEsq((draft) => withCombination(draft, id, next));
  }

  function without(key: "dependencyId" | "level" | "ofRecord" | "floorWaiver"): EsqCombination {
    const next: EsqCombination = { ...combination };
    delete next[key];
    return next;
  }

  function setRecord(value: string): void {
    if (value === "HRA" || value === "THERP") save({ ...combination, ofRecord: value });
    else if (value === "TYPED") save({ ...combination, ofRecord: "TYPED", typed: combination.typed ?? { joint: entry?.joint ?? entry?.therp ?? entry?.independent ?? DEFAULT_PROBABILITY, source: "" } });
    else save(without("ofRecord"));
  }

  const typed = combination.typed;

  return (
    <DialogShell label="HFE combination" onClose={onClose} fit>
      <DialogHead cap="HFE combination · ESQ-C1 · C2" title={entry.members.length === 0 ? id : `${id} · ${entry.members.map((member) => member.code).join(" · ")}`} onClose={onClose} />
      <div className="modal__body esq-dialog-body">
        <div className="esq-dialog-section">
          <span className="esq-dialog-head">Events</span>
          <div className="posfield-grid esq-dialog-fields">
            <EventListField label="Human failure events" eventIds={combination.eventIds} options={view.members} editable={editable} onChange={(eventIds) => save({ ...combination, eventIds })} />
            <ScopeFields view={view} groupIds={combination.groupIds} stateIds={combination.stateIds} editable={editable} onChange={(groupIds, stateIds) => save({ ...combination, groupIds, stateIds })} />
          </div>
        </div>
        <div className="esq-dialog-section">
          <span className="esq-dialog-head">Joint HEP</span>
          <div className="posfield-grid esq-dialog-fields">
            <div className="posfield">
              <label className="posfield__label" htmlFor={`${fieldId}-hr`}>HR assessment</label>
              <select id={`${fieldId}-hr`} className="posfield__select" value={combination.dependencyId ?? ""} disabled={!editable} onChange={(event) => save(event.target.value.length === 0 ? without("dependencyId") : { ...combination, dependencyId: event.target.value })}>
                <option value="">{entry.hr !== undefined && combination.dependencyId === undefined ? `Matched · ${entry.hr.id}` : "None"}</option>
                {dependencies.map((record) => <option key={record.id} value={record.id}>{`Imported from HR · ${record.id} · ${LEVEL_LABELS[record.level]} · ${numberText(record.jointHep)}`}</option>)}
              </select>
            </div>
            <div className="posfield">
              <label className="posfield__label" htmlFor={`${fieldId}-level`}>Dependence level</label>
              <select id={`${fieldId}-level`} className="posfield__select" value={combination.level ?? ""} disabled={!editable} onChange={(event) => {
                const level = DEPENDENCE_LEVELS.find((candidate) => candidate === event.target.value);
                save(level === undefined ? without("level") : { ...combination, level });
              }}>
                <option value="">{inherited === undefined ? "Not set" : `From HR · ${LEVEL_LABELS[inherited]}`}</option>
                {DEPENDENCE_LEVELS.map((level) => <option key={level} value={level}>{LEVEL_LABELS[level]}</option>)}
              </select>
            </div>
            <div className="posfield">
              <label className="posfield__label" htmlFor={`${fieldId}-record`}>Value of record</label>
              <select id={`${fieldId}-record`} className="posfield__select" value={entry.source ?? ""} disabled={!editable} onChange={(event) => setRecord(event.target.value)}>
                {entry.source === undefined && <option value="">Not set</option>}
                {entry.hr !== undefined && <option value="HRA">{`HR assessment · ${numberText(entry.hr.jointHep)}`}</option>}
                {entry.therp !== undefined && entry.level !== undefined && <option value="THERP">{`THERP at ${LEVEL_LABELS[entry.level].toLowerCase()} · ${numberText(entry.therp)}`}</option>}
                <option value="TYPED">Typed</option>
              </select>
            </div>
            {entry.source === "TYPED" && typed !== undefined && (
              <>
                <NumberField label="Typed joint HEP" value={typed.joint} editable={editable} onChange={(joint) => { if (joint !== undefined && joint > 0 && joint <= 1) save({ ...combination, typed: { ...typed, joint } }); }} />
                <AreaField label="Source of the typed value" value={typed.source} editable={editable} required onChange={(source) => save({ ...combination, typed: { ...typed, source } })} />
              </>
            )}
            <AreaField label="Floor waiver" value={combination.floorWaiver ?? ""} editable={editable} onChange={(text) => save(blank(text) ? without("floorWaiver") : { ...combination, floorWaiver: text })} />
            <AreaField label="Basis" value={combination.basis} editable={editable} required={entry.source !== undefined && entry.source !== "HRA"} onChange={(basis) => save({ ...combination, basis })} />
          </div>
        </div>
        {editable && (
          <div className="posrow es-dialog-actions">
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withCombination(draft, id, undefined)); onClose(); }}>Delete combination</button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function FloorDialog({ view, onClose }: { view: EsqLogicView; onClose: () => void }): JSX.Element {
  const { editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const typed = view.work.floor;
  const record = view.model.jointFloor;

  function save(next: { value: number; source: string } | undefined): void {
    if (!editable) return;
    mutateEsq((draft) => withFloor(draft, next));
  }

  return (
    <DialogShell label="Joint HEP floor" onClose={onClose}>
      <DialogHead cap="Joint HEP floor · ESQ-C2" title="Joint HEP floor" onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid esq-dialog-fields">
          <div className="posfield">
            <label className="posfield__label" htmlFor={`${fieldId}-record`}>Floor of record</label>
            <select id={`${fieldId}-record`} className="posfield__select" value={typed === undefined ? (record === undefined ? "" : "HRA") : "TYPED"} disabled={!editable} onChange={(event) => save(event.target.value === "TYPED" ? { value: record?.value ?? DEFAULT_PROBABILITY, source: "" } : undefined)}>
              {record === undefined && typed === undefined && <option value="">Not set</option>}
              {record !== undefined && <option value="HRA">{`Imported from HR · ${numberText(record.value)}`}</option>}
              <option value="TYPED">Typed</option>
            </select>
          </div>
          {typed !== undefined && (
            <>
              <NumberField label="Typed floor" value={typed.value} editable={editable} onChange={(value) => { if (value !== undefined && value > 0 && value <= 1) save({ ...typed, value }); }} />
              <AreaField label="Source of the typed value" value={typed.source} editable={editable} required onChange={(source) => save({ ...typed, source })} />
            </>
          )}
        </div>
      </div>
    </DialogShell>
  );
}

function EsqLogicTabs(): JSX.Element {
  const { esq, upstream } = useEsqWorkbook();
  const table = useMemo(() => parameterTableOf(esq, missionTimeSourcesOf(esq, upstream)), [esq, upstream]);
  const points = useInputPoints(esq, table);
  const view = logicViewOf(esq, points);
  const [tab, setTab] = useState<LogicTab>("flags");
  const [dialog, setDialog] = useState<LogicDialog | null>(null);

  function opens(finding: EsqLogicFinding): boolean {
    const target = finding.target;
    if (target === undefined || view === undefined) return false;
    switch (target.kind) {
      case "flag": return view.flags.some((entry) => entry.flag.id === target.id);
      case "loop": return view.loops.some((loop) => loop.key === target.id);
      case "exclusion": return view.exclusions.some((entry) => entry.exclusion.id === target.id);
      case "recovery": return view.recoveries.some((entry) => entry.recovery.id === target.id);
      case "combination": return view.combinations.some((row) => row.entry?.combination.id === target.id);
      case "floor": return true;
    }
  }

  function openFinding(finding: EsqLogicFinding): void {
    const target = finding.target;
    if (target === undefined) return;
    setDialog(target.kind === "floor" ? { kind: "floor" } : { kind: target.kind, id: target.id });
  }

  function renderPanel(): JSX.Element | null {
    if (view === undefined) return null;
    switch (tab) {
      case "flags": return <FlagsPanel view={view} onOpen={(id) => setDialog({ kind: "flag", id })} />;
      case "loops": return <LoopsPanel view={view} onOpen={(id) => setDialog({ kind: "loop", id })} />;
      case "exclusions": return <ExclusionsPanel view={view} onOpen={(id) => setDialog({ kind: "exclusion", id })} />;
      case "recovery": return <RecoveryPanel view={view} points={points} onOpen={(id) => setDialog({ kind: "recovery", id })} />;
      case "dependence": return <DependencePanel view={view} onOpen={(id) => setDialog({ kind: "combination", id })} onFloor={() => setDialog({ kind: "floor" })} />;
      case "checks": return <ChecksPanel findings={view.findings} opens={opens} onOpen={openFinding} />;
    }
  }

  function renderDialog(): JSX.Element | null {
    if (dialog === null || view === undefined) return null;
    const close = (): void => setDialog(null);
    switch (dialog.kind) {
      case "flag": return <FlagDialog key={dialog.id} id={dialog.id} view={view} onClose={close} />;
      case "loop": return <LoopDialog id={dialog.id} view={view} onClose={close} />;
      case "exclusion": return <ExclusionDialog id={dialog.id} view={view} onClose={close} />;
      case "recovery": return <RecoveryDialog id={dialog.id} view={view} onClose={close} />;
      case "combination": return <CombinationDialog id={dialog.id} view={view} onClose={close} />;
      case "floor": return <FloorDialog view={view} onClose={close} />;
    }
  }

  return (
    <>
      <div className="poscard es-seq-card">
        <TabBar tabs={LOGIC_TABS} tab={tab} label="Logic rule sections" findings={view?.findings.length ?? 0} onTab={setTab} />
        <div className="es-seq-card__panel">{renderPanel()}</div>
      </div>
      {renderDialog()}
    </>
  );
}

export { EsqLogicTabs };
