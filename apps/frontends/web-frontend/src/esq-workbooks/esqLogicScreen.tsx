import { Fragment, JSX, useEffect, useId, useMemo, useState } from "react";
import {
  type EsqExclusion,
  type EsqFlag,
  type EsqFlagTarget,
  type EsqFlagTargetKind,
  type EsqModel,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import { esqEndStateRunId } from "interfaces-mef-types/esq/esq-run-inputs";
import type { EsqEventTreeRunLogic, EsqRunLoopOption } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
import { useEsqWorkbook } from "./esqWorkbookContext";
import {
  DetailRow,
  DetailToggle,
  EsqProvenanceChip,
  EsqTabs,
  FieldList,
  FormFoot,
  FormRow,
  ModalHead,
  rowClass,
  sciText,
  useElementWidth,
} from "./esqShared";
import {
  AS_SET,
  familyTotals,
  logicViewOf,
  nextExclusionId,
  nextFlagId,
  runLogicText,
  runRows,
  withExclusion,
  withFlag,
  withLoopBreak,
  withUnusedBreaksRemoved,
  type EsqLogicFinding,
  type EsqLogicView,
  type EsqLogicWindowKind,
  type EsqRunRow,
} from "./esqLogic";
import { listEsqTreeRuns, runEsqEventTree, type EsqTreeRun } from "./esqWorkbookApi";
import { EsqBayesianNetworkWorkspace } from "./esqBayesianNetworkWorkspace";
import { END_STATE_LABELS } from "./esqViewData";
import type { EsqWindowContext } from "./esqModelScreen";

type LogicTab = "flags" | "loops" | "exclusions" | "networks" | "runs" | "checks";

const TAB_HEADS: Record<Exclude<LogicTab, "networks">, { title: string; sr: string; add?: string }> = {
  flags: { title: "Flags", sr: "ESQ-B9 · ESQ-C3", add: "Add flag" },
  loops: { title: "Support loops", sr: "ESQ-B5" },
  exclusions: { title: "Exclusions", sr: "ESQ-B7 · ESQ-B8", add: "Add exclusion" },
  runs: { title: "Runs", sr: "ESQ-B4 · ESQ-B6" },
  checks: { title: "Logic checks", sr: "ESQ-B5 · ESQ-B8 · ESQ-B9" },
};

const SEVERITY_TEXT: Record<EsqLogicFinding["severity"], string> = { error: "Error", warning: "Warning", note: "Note" };

const LOGIC_WINDOW_KINDS: ReadonlySet<string> = new Set<EsqLogicWindowKind>(["esqFlag", "esqLoop", "esqExclusion"]);

const LOGIC_WINDOW_LABELS: Record<EsqLogicWindowKind, string> = {
  esqFlag: "Flag",
  esqLoop: "Support loop",
  esqExclusion: "Exclusion",
};

const KIND_LABELS: Record<EsqFlagTargetKind, string> = { HOUSE: "House event", EVENT: "Basic event", GATE: "Gate" };

function listValue(items: readonly string[]): string {
  return items.length === 0 ? "—" : items.join(", ");
}

function textValue(text: string | undefined): string {
  return text === undefined || text.trim().length === 0 ? "—" : text.trim();
}

function stateText(state: boolean): string {
  return state ? "TRUE" : "FALSE";
}

function scopeText(groupIds: readonly string[], stateIds: readonly string[]): string {
  const parts = [groupIds.join(", "), stateIds.join(", ")].filter((part) => part.length > 0);
  return parts.length === 0 ? "Every tree" : parts.join(" in ");
}

function toggled(list: readonly string[], item: string, on: boolean): string[] {
  return on ? [...list.filter((entry) => entry !== item), item] : list.filter((entry) => entry !== item);
}

function changeText(value: number, base: number | undefined): string {
  if (base === undefined) return "—";
  if (base === 0) return value === 0 ? "0%" : "New";
  const change = (value - base) / base * 100;
  const rounded = Number(change.toPrecision(3));
  const text = rounded !== 0 && Math.abs(rounded) < 0.01 ? sciText(rounded) : String(rounded);
  return `${rounded > 0 ? "+" : ""}${text}%`;
}

function FlagsTable({ view, openWindow }: { view: EsqLogicView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  if (view.flags.length === 0) return <p className="posmuted">No flag yet. Add one to set a house event, basic event or gate for some initiators.</p>;
  return (
    <div className="esq-table-wrap" ref={wrapRef}>
      <table className="postable esq-rowtable" aria-label="Flags">
        <thead>
          <tr><th className="esq-rowtable__pick">Details</th><th>Flag</th><th>Sets</th><th>State</th><th>Applies to</th></tr>
        </thead>
        <tbody>
          {view.flags.map((entry) => {
            const flag = entry.flag;
            const open = flag.id === openId;
            return (
              <Fragment key={flag.id}>
                <tr className={rowClass(false, open)} onClick={() => { if (!open) setOpenId(flag.id); }}>
                  <td className="esq-rowtable__pick"><DetailToggle open={open} label={flag.id} onToggle={() => setOpenId(open ? "" : flag.id)} /></td>
                  <td className="esq-rowtable__text">
                    <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqFlag", id: flag.id }); }}>{flag.name.trim().length > 0 ? flag.name : flag.id}</button>
                  </td>
                  <td className="esq-rowtable__text">{entry.target}</td>
                  <td>{stateText(flag.state)}</td>
                  <td className="esq-rowtable__text">{scopeText(flag.groupIds, flag.stateIds)}</td>
                </tr>
                {open && (
                  <DetailRow span={5} width={wrapWidth - 18}>
                    <FieldList items={[
                      { label: "ID", value: flag.id },
                      { label: "Trees", value: entry.trees.length === 0 ? "None in scope" : listValue(entry.trees.map((tree) => tree.code)) },
                      { label: "Basis", value: textValue(flag.basis) },
                    ]} />
                  </DetailRow>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LoopsTable({ view, openWindow }: { view: EsqLogicView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  if (view.loops.length === 0) return <p className="posmuted">No support loop. The imported fault trees never transfer back into themselves.</p>;
  return (
    <div className="esq-table-wrap" ref={wrapRef}>
      <table className="postable esq-rowtable" aria-label="Support loops">
        <thead>
          <tr><th className="esq-rowtable__pick">Details</th><th>Loop</th><th>Cut at</th><th>State</th><th>Status</th></tr>
        </thead>
        <tbody>
          {view.loops.map((loop) => {
            const open = loop.key === openId;
            const states = [...new Set(loop.breaks.map((entry) => stateText(entry.state)))];
            return (
              <Fragment key={loop.key}>
                <tr className={rowClass(!loop.reached, open)} onClick={() => { if (!open) setOpenId(loop.key); }}>
                  <td className="esq-rowtable__pick"><DetailToggle open={open} label={loop.codes.join(", ")} onToggle={() => setOpenId(open ? "" : loop.key)} /></td>
                  <td className="esq-rowtable__text">
                    <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqLoop", id: loop.key }); }}>{loop.codes.join(", ")}</button>
                  </td>
                  <td className="esq-rowtable__text">{loop.breaks.length === 0 ? "Not cut" : listValue(loop.edges.flatMap((edge) => (edge.cut === undefined ? [] : [`${edge.fromCode} to ${edge.toCode}`])))}</td>
                  <td>{states.length === 0 ? "—" : states.join(", ")}</td>
                  <td className="esq-rowtable__text">{loop.open ? (loop.reached ? "Open" : "Not reached") : "Broken"}</td>
                </tr>
                {open && (
                  <DetailRow span={5} width={wrapWidth - 18}>
                    <FieldList items={[
                      { label: "Transfers", value: listValue(loop.edges.map((edge) => `${edge.fromCode} to ${edge.toCode}`)) },
                      { label: "Reached by a function", value: loop.reached ? "Yes" : "No" },
                      ...loop.breaks.map((entry) => ({
                        label: `Basis ${loop.edges.find((edge) => edge.cut === entry)?.fromCode ?? ""}`,
                        value: textValue(entry.basis),
                      })),
                    ]} />
                  </DetailRow>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExclusionsTable({ view, openWindow }: { view: EsqLogicView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  if (view.exclusions.length === 0) return <p className="posmuted">No exclusion yet. Add one for basic events that cannot occur together.</p>;
  return (
    <div className="esq-table-wrap" ref={wrapRef}>
      <table className="postable esq-rowtable" aria-label="Exclusions">
        <thead>
          <tr><th className="esq-rowtable__pick">Details</th><th>Exclusion</th><th>Events</th></tr>
        </thead>
        <tbody>
          {view.exclusions.map((entry) => {
            const exclusion = entry.exclusion;
            const open = exclusion.id === openId;
            return (
              <Fragment key={exclusion.id}>
                <tr className={rowClass(false, open)} onClick={() => { if (!open) setOpenId(exclusion.id); }}>
                  <td className="esq-rowtable__pick"><DetailToggle open={open} label={exclusion.id} onToggle={() => setOpenId(open ? "" : exclusion.id)} /></td>
                  <td className="esq-rowtable__text">
                    <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqExclusion", id: exclusion.id }); }}>{exclusion.id}</button>
                  </td>
                  <td className="esq-rowtable__text">{listValue(entry.codes)}</td>
                </tr>
                {open && (
                  <DetailRow span={3} width={wrapWidth - 18}>
                    <FieldList items={[
                      { label: "Basis", value: textValue(exclusion.basis) },
                      { label: "Not imported", value: listValue(entry.missing) },
                    ]} />
                  </DetailRow>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChecksTable({ findings, openWindow }: { findings: EsqLogicFinding[]; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  if (findings.length === 0) return <p className="posmuted">Every check passes.</p>;
  return (
    <div className="esq-table-wrap">
      <table className="postable esq-rowtable" aria-label="Logic checks">
        <thead><tr><th>Severity</th><th>Check</th><th>Item</th><th>Detail</th></tr></thead>
        <tbody>
          {findings.map((finding, index) => {
            const target = finding.target;
            return (
              <tr key={`${finding.check}:${finding.item}:${index}`}>
                <td className={`esq-severity esq-severity--${finding.severity}`}>{SEVERITY_TEXT[finding.severity]}</td>
                <td>{finding.check}</td>
                <td className="esq-rowtable__text">
                  {target === undefined ? finding.item : (
                    <button type="button" className="esq-rowtable__name" onClick={() => openWindow({ kind: target.kind, id: target.id })}>{finding.item}</button>
                  )}
                </td>
                <td className="esq-rowtable__wrap">{finding.detail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Picker<T extends string>({ legend, name, value, options, onChange }: { legend: string; name: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }): JSX.Element {
  return (
    <fieldset className="esq-run__picker">
      <legend>{legend}</legend>
      <div role="radiogroup" aria-label={legend}>
        {options.map(([option, label]) => (
          <label key={option} className={value === option ? "is-selected" : ""}>
            <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function runLabel(run: EsqTreeRun): string {
  const when = `${new Date(run.requestedAt).toLocaleString()} · revision ${run.revision}`;
  if (run.status !== "SUCCEEDED") return `${when} · ${run.status.toLowerCase()}`;
  return `${when} · ${run.logic === undefined ? "options not recorded" : runLogicText(run.logic)}`;
}

function endStateText(endState: string | undefined): string {
  return endState === undefined ? "—" : END_STATE_LABELS[endState] ?? endState;
}

function RunResults({ view, run, compare, wrapWidth }: { view: EsqLogicView; run: EsqTreeRun; compare: EsqTreeRun | undefined; wrapWidth: number }): JSX.Element {
  const { esq } = useEsqWorkbook();
  const [openKey, setOpenKey] = useState("");
  const result = run.result;
  const rows = useMemo(() => (result === undefined ? [] : runRows(esq, result)), [esq, result]);
  const baseRows = useMemo(() => (compare?.result === undefined ? [] : runRows(esq, compare.result)), [esq, compare]);
  if (result === undefined) return <p className="esq-run__error" role="alert">{run.failure ?? "This run returned no result."}</p>;
  const baseOf = new Map(baseRows.map((row) => [row.key, row]));
  const families = familyTotals(rows);
  const baseFamilies = new Map(familyTotals(baseRows).map((entry) => [entry.familyId, entry.frequency]));
  const endStates = [...new Set(view.model.sequences.flatMap((sequence) => (sequence.endState === undefined ? [] : [sequence.endState])))];
  const endStateOf = new Map(endStates.map((endState) => [esqEndStateRunId(endState), endState]));
  const totals = result.endStateAggregates.map((entry) => `${endStateText(endStateOf.get(entry.endStateId))} ${sciText(entry.annualFrequency)}`);
  const initiator = result.frequencySemantics?.annualizedInitiatingEventFrequency.value;
  const meta = [
    initiator === undefined ? "" : `Initiator ${sciText(initiator)} /yr.`,
    totals.length === 0 ? "" : `${totals.join(" · ")} /yr.`,
    compare === undefined ? "" : `Change against the run of ${new Date(compare.requestedAt).toLocaleString()}.`,
  ].filter((part) => part.length > 0);
  const compareOf = (row: EsqRunRow): number | undefined => (compare === undefined ? undefined : baseOf.get(row.key)?.frequency ?? 0);
  return (
    <>
      {meta.length > 0 && <p className="esq-meta">{meta.join(" ")}</p>}
      <table className="postable esq-rowtable" aria-label="Sequence frequencies">
        <thead>
          <tr><th className="esq-rowtable__pick">Details</th><th>Sequence</th><th>Family</th><th>Frequency (/yr)</th><th>Change</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const open = row.key === openKey;
            const base = compareOf(row);
            return (
              <Fragment key={row.key}>
                <tr className={rowClass(row.frequency === 0, open)} onClick={() => { if (!open) setOpenKey(row.key); }}>
                  <td className="esq-rowtable__pick"><DetailToggle open={open} label={row.code} onToggle={() => setOpenKey(open ? "" : row.key)} /></td>
                  <td className="esq-rowtable__text">{row.code}</td>
                  <td className="esq-rowtable__text">{row.familyId ?? "—"}</td>
                  <td className="esq-rowtable__num">{sciText(row.frequency)}</td>
                  <td className="esq-rowtable__num">{changeText(row.frequency, base)}</td>
                </tr>
                {open && (
                  <DetailRow span={5} width={wrapWidth - 18}>
                    <FieldList items={[
                      { label: "Conditional probability", value: sciText(row.probability) },
                      { label: "End state", value: endStateText(row.endState) },
                      { label: "Compared frequency", value: base === undefined ? "—" : sciText(base) },
                    ]} />
                  </DetailRow>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {families.length > 0 && (
        <table className="postable esq-rowtable esq-run__families" aria-label="Family frequencies">
          <thead><tr><th>Family</th><th>Frequency (/yr)</th><th>Change</th></tr></thead>
          <tbody>
            {families.map((entry) => (
              <tr key={entry.familyId}>
                <td className="esq-rowtable__text">{entry.familyId}</td>
                <td className="esq-rowtable__num">{sciText(entry.frequency)}</td>
                <td className="esq-rowtable__num">{changeText(entry.frequency, compare === undefined ? undefined : baseFamilies.get(entry.familyId) ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function RunsPanel({ view }: { view: EsqLogicView }): JSX.Element {
  const { editable, runtime } = useEsqWorkbook();
  const fieldId = useId();
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const [treeId, setTreeId] = useState(view.roots[0]?.id ?? "");
  const [logic, setLogic] = useState<EsqEventTreeRunLogic>(AS_SET);
  const [runs, setRuns] = useState<EsqTreeRun[]>([]);
  const [shownId, setShownId] = useState("");
  const [compareId, setCompareId] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const saveBlockedReason = analysisSaveBlock(runtime);
  const workbookId = runtime.workbookId;
  const tree = view.roots.find((candidate) => candidate.id === treeId);

  useEffect(() => {
    if (workbookId === null || treeId.length === 0) {
      setRuns([]);
      return;
    }
    let cancelled = false;
    listEsqTreeRuns(workbookId, treeId)
      .then((loaded) => {
        if (cancelled) return;
        setRuns(loaded);
        setShownId((current) => (loaded.some((run) => run.id === current) ? current : loaded.find((run) => run.status === "SUCCEEDED")?.id ?? loaded[0]?.id ?? ""));
        setCompareId((current) => (loaded.some((run) => run.id === current) ? current : ""));
      })
      .catch((caught: Error) => { if (!cancelled) setError(caught.message); });
    return () => { cancelled = true; };
  }, [workbookId, treeId, reload]);

  function run(): void {
    if (workbookId === null || runtime.revision === null || tree === undefined) return;
    setRunning(true);
    setError(null);
    runEsqEventTree(workbookId, tree.id, runtime.revision, logic)
      .then((response) => {
        if (response.run.status !== "SUCCEEDED") setError(response.run.failure?.message ?? "The run failed.");
        setShownId(response.run.id);
        setReload((n) => n + 1);
      })
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setRunning(false));
  }

  const shown = runs.find((candidate) => candidate.id === shownId);
  const compare = runs.find((candidate) => candidate.id === compareId && candidate.id !== shownId);
  const loopOptions: readonly (readonly [EsqRunLoopOption, string])[] = [["AS_SET", "As set"], ["TRUE", "All TRUE"], ["FALSE", "All FALSE"]];

  if (view.roots.length === 0) return <p className="posmuted">No event tree in scope. Check the coverage in Step 01.</p>;
  return (
    <div className="esq-run">
      <div className="esq-run__composer" aria-label="Event tree run controls">
        <div className="esq-run__row">
          <label className="esq-run__field" htmlFor={`${fieldId}-tree`}>
            <span>Event tree</span>
            <select id={`${fieldId}-tree`} value={treeId} onChange={(event) => { setTreeId(event.target.value); setShownId(""); setCompareId(""); setError(null); }}>
              {view.roots.map((root) => <option key={root.id} value={root.id}>{[root.code, root.stateId, root.initiatorId].filter((part) => part !== undefined).join(" · ")}</option>)}
            </select>
          </label>
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={running || !editable || saveBlockedReason !== null || tree === undefined} onClick={run}>
            {running ? "Running…" : "Run event tree"}
          </button>
        </div>
        <div className="esq-run__pickers">
          <Picker legend="Flags" name={`${fieldId}-flags`} value={logic.flags ? "on" : "off"} options={[["on", "As set"], ["off", "Off"]]} onChange={(value) => setLogic({ ...logic, flags: value === "on" })} />
          <Picker legend="Loop breaks" name={`${fieldId}-loops`} value={logic.loopBreaks} options={loopOptions} onChange={(loopBreaks) => setLogic({ ...logic, loopBreaks })} />
          <Picker legend="Exclusions" name={`${fieldId}-exclusions`} value={logic.exclusions ? "on" : "off"} options={[["on", "As set"], ["off", "Off"]]} onChange={(value) => setLogic({ ...logic, exclusions: value === "on" })} />
          <Picker legend="Common cause" name={`${fieldId}-ccf`} value={logic.expandCcf ? "on" : "off"} options={[["on", "Expanded"], ["off", "Off"]]} onChange={(value) => setLogic({ ...logic, expandCcf: value === "on" })} />
        </div>
      </div>
      {saveBlockedReason !== null && <p className="esq-run__notice" role="status">{saveBlockedReason}</p>}
      {error !== null && <p className="esq-run__error" role="alert">{error}</p>}
      {runs.length > 0 && (
        <div className="esq-bar">
          <label className="posfield__label" htmlFor={`${fieldId}-shown`}>Result</label>
          <select id={`${fieldId}-shown`} className="posfield__select" value={shownId} onChange={(event) => setShownId(event.target.value)}>
            {runs.map((candidate) => <option key={candidate.id} value={candidate.id}>{runLabel(candidate)}</option>)}
          </select>
          <label className="posfield__label" htmlFor={`${fieldId}-compare`}>Compare with</label>
          <select id={`${fieldId}-compare`} className="posfield__select" value={compareId} onChange={(event) => setCompareId(event.target.value)}>
            <option value="">None</option>
            {runs.filter((candidate) => candidate.id !== shownId && candidate.result !== undefined).map((candidate) => <option key={candidate.id} value={candidate.id}>{runLabel(candidate)}</option>)}
          </select>
        </div>
      )}
      <div className="esq-table-wrap" ref={wrapRef}>
        {shown === undefined ? (
          <p className="posmuted">{workbookId === null ? "Runs are kept with a saved workbook." : "No run of this tree yet."}</p>
        ) : (
          <RunResults view={view} run={shown} compare={compare} wrapWidth={wrapWidth} />
        )}
      </div>
    </div>
  );
}

function LogicScreen({ openWindow, initialNetworkId = null, initialSourceWorkbookId = null }: {
  openWindow: (ctx: EsqWindowContext) => void;
  initialNetworkId?: string | null;
  initialSourceWorkbookId?: string | null;
}): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const [tab, setTab] = useState<LogicTab>(initialNetworkId === null ? "flags" : "networks");
  const tabId = useId();
  const view = useMemo(() => logicViewOf(esq), [esq]);
  const count = (n: number): string => (view === undefined ? "" : ` (${n})`);
  const tabs: { id: LogicTab; label: string }[] = [
    { id: "flags", label: `Flags${count(view?.flags.length ?? 0)}` },
    { id: "loops", label: `Loops${count(view?.loops.length ?? 0)}` },
    { id: "exclusions", label: `Exclusions${count(view?.exclusions.length ?? 0)}` },
    { id: "networks", label: "Networks" },
    { id: "runs", label: "Runs" },
    { id: "checks", label: `Checks${count(view?.findings.length ?? 0)}` },
  ];

  function add(): void {
    if (!editable) return;
    if (tab === "flags") {
      const id = nextFlagId(esq);
      mutateEsq((draft) => withFlag(draft, id, { id, name: "", state: false, groupIds: [], stateIds: [], basis: "" }));
      openWindow({ kind: "esqFlag", id });
    } else if (tab === "exclusions") {
      const id = nextExclusionId(esq);
      mutateEsq((draft) => withExclusion(draft, id, { id, eventIds: [], basis: "" }));
      openWindow({ kind: "esqExclusion", id });
    }
  }

  if (tab === "networks") {
    return (
      <div className="esq-step">
        <EsqTabs label="Logic sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="esq-step__tabs" />
        <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0}>
          <EsqBayesianNetworkWorkspace initialNetworkId={initialNetworkId} initialSourceWorkbookId={initialSourceWorkbookId} />
        </div>
      </div>
    );
  }

  const head = TAB_HEADS[tab];
  return (
    <div className="esq-step">
      <EsqTabs label="Logic sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="esq-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0}>
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="ESQ" title={head.title} level={3} />
            <div className="esq-card-actions">
              <EsqProvenanceChip>{head.sr}</EsqProvenanceChip>
              {editable && tab === "loops" && view !== undefined && view.unusedBreaks.length > 0 && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateEsq((draft) => withUnusedBreaksRemoved(draft))}>Remove unused breaks</button>
              )}
              {editable && head.add !== undefined && view !== undefined && (
                <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>{head.add}</button>
              )}
            </div>
          </div>
          {view === undefined ? (
            <p className="posmuted">Nothing is imported yet. Import the model in Step 02.</p>
          ) : tab === "flags" ? (
            <FlagsTable view={view} openWindow={openWindow} />
          ) : tab === "loops" ? (
            <LoopsTable view={view} openWindow={openWindow} />
          ) : tab === "exclusions" ? (
            <ExclusionsTable view={view} openWindow={openWindow} />
          ) : tab === "runs" ? (
            <RunsPanel view={view} />
          ) : (
            <ChecksTable findings={view.findings} openWindow={openWindow} />
          )}
        </div>
      </div>
    </div>
  );
}

function ReasonRow({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label={label} htmlFor={id} top>
      <WorkbookTextarea id={id} className="posfield__textarea" rows={2} fitContent value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </FormRow>
  );
}

function targetOptions(model: EsqModel, kind: EsqFlagTargetKind, modelId: string | undefined): { value: string; label: string }[] {
  if (kind === "EVENT") return [...model.events].sort((a, b) => a.code.localeCompare(b.code)).map((event) => ({ value: event.id, label: event.name.length > 0 ? `${event.code} · ${event.name}` : event.code }));
  const top = model.tops.find((candidate) => candidate.modelId === modelId);
  const nodes = kind === "HOUSE" ? top?.houseEvents ?? [] : top?.gates ?? [];
  return nodes.map((node) => ({ value: node.id, label: node.name.length > 0 ? `${node.code} · ${node.name}` : node.code }));
}

function firstTarget(model: EsqModel, kind: EsqFlagTargetKind, modelId: string | undefined): EsqFlagTarget | undefined {
  const first = targetOptions(model, kind, modelId)[0];
  if (first === undefined) return undefined;
  return kind === "EVENT" ? { kind, id: first.value } : modelId === undefined ? undefined : { kind, id: first.value, modelId };
}

function FlagWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const view = logicViewOf(esq);
  const entry = view?.flags.find((candidate) => candidate.flag.id === id);
  const [kind, setKind] = useState<EsqFlagTargetKind>(entry?.flag.target?.kind ?? "HOUSE");
  const [modelId, setModelId] = useState<string | undefined>(entry?.flag.target?.modelId ?? view?.model.tops.find((top) => (top.houseEvents ?? []).length > 0)?.modelId ?? view?.model.tops[0]?.modelId);
  if (view === undefined || entry === undefined) return null;
  const flag = entry.flag;
  const model = view.model;
  const dis = !editable;
  const groups = [...new Set(view.roots.map((tree) => tree.initiatorId))].sort();
  const states = [...new Set(view.roots.flatMap((tree) => (tree.stateId === undefined ? [] : [tree.stateId])))].sort();
  const options = targetOptions(model, kind, modelId);

  function save(next: Partial<EsqFlag>): void {
    if (!editable) return;
    mutateEsq((draft) => withFlag(draft, id, { ...flag, ...next }));
  }

  function setTarget(next: EsqFlagTarget | undefined): void {
    if (!editable) return;
    const { target: _old, ...rest } = flag;
    mutateEsq((draft) => withFlag(draft, id, next === undefined ? rest : { ...rest, target: next }));
  }

  return (
    <>
      <ModalHead cap="Flag · ESQ · ESQ-B9" title={flag.name.trim().length > 0 ? `${id} · ${flag.name}` : id} onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="Name" htmlFor={`${fieldId}-name`}>
          <WorkbookInput id={`${fieldId}-name`} className="posfield__input" value={flag.name} disabled={dis} onChange={(event) => save({ name: event.target.value })} />
        </FormRow>
        <FormRow label="Sets" htmlFor={`${fieldId}-kind`}>
          <select id={`${fieldId}-kind`} className="posfield__select" value={kind} disabled={dis} onChange={(event) => {
            const next = event.target.value === "EVENT" ? "EVENT" : event.target.value === "GATE" ? "GATE" : "HOUSE";
            setKind(next);
            setTarget(firstTarget(model, next, modelId));
          }}>
            {(["HOUSE", "EVENT", "GATE"] as const).map((value) => <option key={value} value={value}>{KIND_LABELS[value]}</option>)}
          </select>
        </FormRow>
        {kind !== "EVENT" && (
          <FormRow label="Fault tree" htmlFor={`${fieldId}-tree`}>
            <select id={`${fieldId}-tree`} className="posfield__select" value={modelId ?? ""} disabled={dis} onChange={(event) => {
              setModelId(event.target.value);
              setTarget(firstTarget(model, kind, event.target.value));
            }}>
              {model.tops.map((top) => <option key={top.modelId} value={top.modelId}>{top.name.length > 0 ? `${top.code} · ${top.name}` : top.code}</option>)}
            </select>
          </FormRow>
        )}
        <FormRow label={KIND_LABELS[kind]} htmlFor={`${fieldId}-target`}>
          <select id={`${fieldId}-target`} className="posfield__select" value={flag.target?.kind === kind ? flag.target.id : ""} disabled={dis || options.length === 0} onChange={(event) => setTarget(kind === "EVENT" ? { kind, id: event.target.value } : modelId === undefined ? undefined : { kind, id: event.target.value, modelId })}>
            {(flag.target?.kind !== kind || options.length === 0) && <option value="">{options.length === 0 ? "None in this fault tree" : "Not set"}</option>}
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </FormRow>
        <FormRow label="State" htmlFor={`${fieldId}-state`}>
          <select id={`${fieldId}-state`} className="posfield__select" value={flag.state ? "TRUE" : "FALSE"} disabled={dis} onChange={(event) => save({ state: event.target.value === "TRUE" })}>
            <option value="TRUE">TRUE</option>
            <option value="FALSE">FALSE</option>
          </select>
        </FormRow>
        <FormRow label="Initiator groups" top>
          <div className="esq-form__checks">
            {groups.map((group) => (
              <label key={group} className="esq-form__check">
                <input type="checkbox" checked={flag.groupIds.includes(group)} disabled={dis} onChange={(event) => save({ groupIds: toggled(flag.groupIds, group, event.target.checked) })} />
                {group}
              </label>
            ))}
          </div>
        </FormRow>
        <FormRow label="Operating states" top>
          <div className="esq-form__checks">
            {states.map((state) => (
              <label key={state} className="esq-form__check">
                <input type="checkbox" checked={flag.stateIds.includes(state)} disabled={dis} onChange={(event) => save({ stateIds: toggled(flag.stateIds, state, event.target.checked) })} />
                {state}
              </label>
            ))}
          </div>
        </FormRow>
        <ReasonRow label="Basis" value={flag.basis} disabled={dis} onChange={(basis) => save({ basis })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withFlag(draft, id, undefined)); onClose(); }}>Remove flag</button>
        )}
      </FormFoot>
    </>
  );
}

function LoopWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const view = logicViewOf(esq);
  const loop = view?.loops.find((candidate) => candidate.key === id);
  if (view === undefined || loop === undefined) return null;
  const dis = !editable;
  const status = loop.open ? (loop.reached ? "Still a loop. Cut one more transfer." : "No linked function reaches this loop.") : "The loop is broken.";

  return (
    <>
      <ModalHead cap="Support loop · SY · ESQ-B5" title={loop.codes.join(", ")} onClose={onClose} />
      <div className="modal__body esq-form">
        <p className="esq-meta">{status}</p>
        {loop.edges.map((edge, index) => {
          const cut = edge.cut;
          return (
            <fieldset key={`${edge.fromModelId}:${edge.toModelId}`} className="esq-use">
              <legend className="esq-use__legend">{`${edge.fromCode} to ${edge.toCode}`}</legend>
              <FormRow label="Transfer" htmlFor={`${fieldId}-cut-${index}`}>
                <select id={`${fieldId}-cut-${index}`} className="posfield__select" value={cut === undefined ? "" : stateText(cut.state)} disabled={dis} onChange={(event) => {
                  const value = event.target.value;
                  mutateEsq((draft) => withLoopBreak(draft, edge.fromModelId, edge.toModelId, value.length === 0 ? undefined : { fromModelId: edge.fromModelId, toModelId: edge.toModelId, state: value === "TRUE", basis: cut?.basis ?? "" }));
                }}>
                  <option value="">Kept</option>
                  <option value="TRUE">Cut, set TRUE</option>
                  <option value="FALSE">Cut, set FALSE</option>
                </select>
              </FormRow>
              {cut !== undefined && (
                <ReasonRow label="Basis" value={cut.basis} disabled={dis} onChange={(basis) => mutateEsq((draft) => withLoopBreak(draft, edge.fromModelId, edge.toModelId, { ...cut, basis }))} />
              )}
            </fieldset>
          );
        })}
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

function ExclusionWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const view = logicViewOf(esq);
  const entry = view?.exclusions.find((candidate) => candidate.exclusion.id === id);
  if (view === undefined || entry === undefined) return null;
  const exclusion = entry.exclusion;
  const dis = !editable;
  const events = [...view.model.events].sort((a, b) => a.code.localeCompare(b.code));

  function save(next: Partial<EsqExclusion>): void {
    if (!editable) return;
    mutateEsq((draft) => withExclusion(draft, id, { ...exclusion, ...next }));
  }

  return (
    <>
      <ModalHead cap="Exclusion · SY · ESQ-B8" title={id} onClose={onClose} />
      <div className="modal__body esq-form">
        {exclusion.eventIds.map((eventId, index) => (
          <FormRow key={`${eventId}:${index}`} label={`Event ${index + 1}`} htmlFor={`${fieldId}-event-${index}`}>
            <select id={`${fieldId}-event-${index}`} className="posfield__select" value={eventId} disabled={dis} onChange={(event) => save({ eventIds: exclusion.eventIds.map((current, position) => (position === index ? event.target.value : current)) })}>
              {!events.some((candidate) => candidate.id === eventId) && <option value={eventId}>{`${eventId} · not imported`}</option>}
              {events.filter((candidate) => candidate.id === eventId || !exclusion.eventIds.includes(candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name.length > 0 ? `${candidate.code} · ${candidate.name}` : candidate.code}</option>)}
            </select>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => save({ eventIds: exclusion.eventIds.filter((_, position) => position !== index) })}>Remove</button>}
          </FormRow>
        ))}
        {editable && events.some((candidate) => !exclusion.eventIds.includes(candidate.id)) && (
          <button type="button" className="posnav__btn posnav__btn--sm esq-use__remove" onClick={() => {
            const next = events.find((candidate) => !exclusion.eventIds.includes(candidate.id));
            if (next !== undefined) save({ eventIds: [...exclusion.eventIds, next.id] });
          }}>Add event</button>
        )}
        <ReasonRow label="Basis" value={exclusion.basis} disabled={dis} onChange={(basis) => save({ basis })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withExclusion(draft, id, undefined)); onClose(); }}>Remove exclusion</button>
        )}
      </FormFoot>
    </>
  );
}

function LogicWindows({ context, onClose }: { context: EsqWindowContext; onClose: () => void }): JSX.Element | null {
  switch (context.kind) {
    case "esqFlag": return <FlagWindow key={context.id} id={context.id} onClose={onClose} />;
    case "esqLoop": return <LoopWindow id={context.id} onClose={onClose} />;
    case "esqExclusion": return <ExclusionWindow id={context.id} onClose={onClose} />;
    default: return null;
  }
}

export { LogicScreen, LogicWindows, LOGIC_WINDOW_KINDS, LOGIC_WINDOW_LABELS };
