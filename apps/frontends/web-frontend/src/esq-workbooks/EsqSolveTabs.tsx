import { JSX, useCallback, useEffect, useId, useMemo, useState } from "react";
import type { EventSequenceAnalysis, EventTree } from "interfaces-mef-types/es/event-sequence-analysis";
import type { EsqFamilySolve, EsqModel, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { SystemLogicModel } from "interfaces-mef-types/sy/systems-analysis";
import { eventInputKey } from "interfaces-mef-types/esq/esq-measure-inputs";
import { esqSequenceRunId, esqTreeRunId, treesInScope } from "interfaces-mef-types/esq/esq-run-inputs";
import type { AnalysisRunMetadata } from "interfaces-shared-types/newly-developed-methods";
import {
  EventTreeAnalysisResultSchema,
  type EsqModelRunHcl,
  type EsqModelRunResult,
  type EsqModelRunSequence,
  type EventTreeAnalysisResult,
  type EventTreeCutOffBasis,
  type EventTreeCutSetQuantifier,
  type EventTreeCutSetSettings,
} from "interfaces-shared-types/newly-developed-methods/event-tree";
import { EventTreeEditor, type EventTreeRepresentation } from "../newly-developed-methods/event-tree";
import { FaultTreeEditor, type FaultTreeSelection } from "../newly-developed-methods/fault-tree";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
import { cancelAnalysisRun, runProgressText } from "../newly-developed-methods/shared/analysisRunWait";
import { expressionText } from "../newly-developed-methods/shared/uncertainText";
import { toFaultTreeEditorCatalogue, toFaultTreeEditorModel } from "../sy-workbooks/SySystemModels";
import { DialogHead, DialogShell } from "../es-workbooks/EsScope";
import { PAGE, Pager, TabBar, paged } from "../es-workbooks/EsTiming";
import { AreaField, ChecksPanel, NumberField, networkLabel, networkOptionsOf, sciText, treeLabel, useInputPoints, type EsqWindowContext, type NetworkOption } from "./esqShared";
import { useEsqWorkbook } from "./esqWorkbookContext";
import { missionTimeSourcesOf, parameterTableOf, typedTreesOf } from "./esqModel";
import { MODEL_AS_SET, runLogicText } from "./esqLogic";
import { END_STATE_LABELS } from "./esqViewData";
import { cutSetKey, cutSetRows, reviewOf, thresholdsOf, withCutSetReview, type EsqCutSetRow } from "./esqResults";
import {
  BASIS_LABELS,
  CALCULATION_LABELS,
  QUANTIFIER_LABELS,
  SOURCE_LABELS,
  cutOffsFrom,
  lastChange,
  pctText,
  runConvergenceOf,
  solveViewOf,
  summaryProblem,
  withFamilySolve,
  withRareEventReason,
  withRunOfRecord,
  type EsqConvergence,
  type EsqSolveFinding,
  type EsqSolveView,
  type EsqSolveWindowKind,
} from "./esqSolve";
import { getEsqModelRunResult, getEsqRunDetails, listEsqModelRuns, runEsqModel, type EsqModelRunEntry } from "./esqWorkbookApi";
import { EsqEventTreeHclWorkspace } from "./esqEventTreeHclWorkspace";
import "../es-workbooks/css/esSequences.css";
import "./css/esqSolveTabs.css";

type SolveTab = "runs" | "trees" | "families" | "sequences" | "cutsets" | "convergence" | "scenarios" | "dynamic" | "checks";

type RunChoice = "EXACT" | "CUT_SETS" | "HCL";

type SolveDialog =
  | { kind: "family"; id: string }
  | { kind: "run" }
  | { kind: "review"; key: string }
  | { kind: "sweep"; id: string }
  | { kind: "faultTree"; modelIds: string[]; eventIds: string[] };

interface ComposerSettings {
  choice: RunChoice;
  network: string;
  expandCcf: boolean;
  basis: EventTreeCutOffBasis;
  quantifier: EventTreeCutSetQuantifier;
  highest: number;
  lowest: number;
  keep: number;
  limitOrder?: number;
}

interface Composer {
  settings: ComposerSettings;
  set: (patch: Partial<ComposerSettings>) => void;
  clearLimit: () => void;
  networks: NetworkOption[];
  running: boolean;
  live: AnalysisRunMetadata | null;
  error: string | null;
  problem?: string;
  ready: boolean;
  run: () => void;
  stop: (runId: string) => void;
}

interface ShownRun {
  runs: EsqModelRunEntry[];
  shown?: EsqModelRunEntry;
  summary?: EsqModelRunResult;
  error?: string;
  listError?: string;
  show: (runId: string) => void;
  reload: () => void;
}

interface CutSetFilter {
  familyId: string;
  sequenceKey: string;
}

interface SequenceValue {
  conditionalProbability: number;
  annualFrequency: number;
}

interface TreeFailure {
  treeId: string;
  failure: string;
}

const SOLVE_TABS: { id: SolveTab; label: string; disabled?: boolean }[] = [
  { id: "runs", label: "Runs" },
  { id: "trees", label: "Trees" },
  { id: "families", label: "Families" },
  { id: "sequences", label: "Sequences" },
  { id: "cutsets", label: "Cut sets" },
  { id: "convergence", label: "Convergence" },
  { id: "scenarios", label: "Scenarios" },
  { id: "dynamic", label: "Dynamic", disabled: true },
  { id: "checks", label: "Checks" },
];

const SOLVE_WINDOW_KINDS: ReadonlySet<string> = new Set<EsqSolveWindowKind>(["esqSolveFamily", "esqSolveRun", "esqSolveCutSet"]);

const SOLVE_WINDOW_LABELS: Record<EsqSolveWindowKind, string> = { esqSolveFamily: "Family value", esqSolveRun: "Run of record", esqSolveCutSet: "Cut set review" };

const RUN_CHOICES: readonly (readonly [RunChoice, string])[] = [["EXACT", "Exact"], ["CUT_SETS", "Cut sets"], ["HCL", "HCL"]];

const BASIS_OPTIONS: readonly (readonly [EventTreeCutOffBasis, string])[] = [["FREQUENCY", "Frequency per year"], ["PROBABILITY", "Probability"]];

const QUANTIFIER_OPTIONS: readonly (readonly [EventTreeCutSetQuantifier, string])[] = [["MCUB", "Upper bound"], ["EXACT", "Exact"], ["RARE_EVENT", "Rare event"]];

const HIGHEST_EXPONENTS = [-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12];

const LOWEST_EXPONENTS = [-4, -5, -6, -7, -8, -9, -10, -11, -12, -13, -14, -15, -16, -17, -18, -19, -20];

const START_SETTINGS: ComposerSettings = { choice: "CUT_SETS", network: "", expandCcf: MODEL_AS_SET.expandCcf, basis: "FREQUENCY", quantifier: "MCUB", highest: -6, lowest: -14, keep: 100 };

const STATUS_TEXT: Record<string, string> = { QUEUED: "queued until it starts", RUNNING: "running", FAILED: "failed", CANCELLED: "cancelled" };

const LIST_POLL_MS = 3000;

const READ_ONLY_TREE = { mode: "READ_ONLY" as const, canEditBasicEvents: false, canEditLayout: false, canImport: false, canExport: true, canRunAnalysis: false };

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function Flag({ children }: { children: string }): JSX.Element {
  return <span className="esq-dialog-flag">{children}</span>;
}

function Muted({ children }: { children: string }): JSX.Element {
  return <span className="posmuted">{children}</span>;
}

function storedLink(id: string | undefined): string | undefined {
  return id === undefined || id.length === 0 || id.startsWith("example") ? undefined : id;
}

function decadeText(exponent: number): string {
  return `1E${exponent}`;
}

function difference(compared: number, base: number | undefined): string {
  if (base === undefined || base === 0) return "—";
  const change = (100 * (compared - base)) / base;
  if (change === 0) return "0%";
  return `${change > 0 ? "+" : ""}${Math.abs(change) < 0.01 ? change.toExponential(1).replace("e", "E") : change.toFixed(2)}%`;
}

function convergedText(convergence: EsqConvergence | undefined): string {
  if (convergence === undefined) return "—";
  return convergence.convergedAt === undefined ? "Not yet" : sciText(convergence.convergedAt);
}

function shareText(fraction: number): string {
  if (!Number.isFinite(fraction)) return "—";
  if (fraction === 0) return "0%";
  return `${String(Number((100 * fraction).toPrecision(3)))}%`;
}

function runLabel(run: EsqModelRunEntry): string {
  const when = new Date(run.requestedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  const base = `${when} · revision ${String(run.revision)}`;
  return run.status === "SUCCEEDED" ? base : `${base} · ${STATUS_TEXT[run.status] ?? run.status.toLowerCase()}`;
}

function sequenceKeyOf(sequence: EsqModelRunSequence): string {
  return `${sequence.treeId}:${sequence.sequenceIds.join(">")}`;
}

function sequenceText(model: EsqModel, ids: readonly string[]): string {
  return ids.map((id) => model.sequences.find((sequence) => sequence.id === id)?.code ?? id).join(" to ");
}

function familyText(view: EsqSolveView, familyId: string): string {
  const family = view.families.find((candidate) => candidate.id === familyId);
  return family === undefined || blank(family.name) ? familyId : `${familyId} · ${family.name}`;
}

function sourceTreeOf(esq: EventSequenceQuantification, es: EventSequenceAnalysis | undefined, treeId: string, typed: boolean): EventTree | undefined {
  return typed ? typedTreesOf(esq).find((candidate) => candidate.uuid === treeId) : es?.eventTrees?.find((candidate) => candidate.uuid === treeId);
}

function sequenceValuesOf(summary: EsqModelRunResult, treeId: string, source: EventTree): Map<string, SequenceValue> {
  const byRecord = new Map<string, SequenceValue>();
  for (const sequence of summary.sequences) {
    const first = sequence.sequenceIds[0];
    if (sequence.treeId !== treeId || first === undefined) continue;
    const known = byRecord.get(first);
    byRecord.set(first, {
      conditionalProbability: (known?.conditionalProbability ?? 0) + sequence.conditionalProbability,
      annualFrequency: (known?.annualFrequency ?? 0) + sequence.annualFrequency,
    });
  }
  const out = new Map<string, SequenceValue>();
  for (const [key, sequence] of Object.entries(source.sequences)) {
    const value = byRecord.get(sequence.eventSequenceId ?? "") ?? byRecord.get(key) ?? byRecord.get(sequence.uuid);
    if (value !== undefined) out.set(sequence.uuid, value);
  }
  return out;
}

function childEntryOf(result: EventTreeAnalysisResult | undefined, model: EsqModel, sequence: EsqModelRunSequence): EventTreeAnalysisResult["sequences"][number] | undefined {
  if (result === undefined) return undefined;
  const treeOf = new Map(model.sequences.map((record) => [record.id, record.treeId]));
  const chain = sequence.sequenceIds.map((id) => esqSequenceRunId(treeOf.get(id) ?? sequence.treeId, id));
  return result.sequences.find((entry) => {
    const ids = entry.sequenceChain === undefined ? [entry.sequenceId] : entry.sequenceChain.map((link) => link.entityId);
    return ids.length === chain.length && ids.every((id, index) => id === chain[index]);
  });
}

function sequenceCutSetRows(input: {
  entry: EventTreeAnalysisResult["sequences"][number] | undefined;
  familyId: string;
  treeId: string;
  total: number;
  familyRows: readonly EsqCutSetRow[];
  esq: EventSequenceQuantification;
  individualPercent: number;
  codeOf: (id: string) => string;
}): EsqCutSetRow[] {
  const significant = new Map(input.familyRows.map((row) => [row.key, row.significant]));
  const reviews = reviewOf(input.esq).cutSetReviews ?? [];
  let running = 0;
  return (input.entry?.cutSets?.items ?? []).map((item) => {
    const share = input.total > 0 ? item.annualFrequency / input.total : 0;
    running += share;
    const key = cutSetKey(input.familyId, input.treeId, item.basicEventIds);
    const row: EsqCutSetRow = {
      key,
      familyId: input.familyId,
      treeId: input.treeId,
      eventIds: [...item.basicEventIds],
      codes: item.basicEventIds.map(input.codeOf),
      annualFrequency: item.annualFrequency,
      share,
      cumulative: running,
      significant: significant.get(key) ?? 100 * share >= input.individualPercent,
    };
    const review = reviews.find((entry) => entry.key === key);
    if (review !== undefined) row.review = review;
    return row;
  });
}

function topsOf(model: EsqModel, eventIds: readonly string[]): string[] {
  return model.tops.filter((top) => top.eventIds.some((id) => eventIds.includes(id))).map((top) => top.modelId);
}

function selectionIn(logic: SystemLogicModel | undefined, eventIds: readonly string[]): FaultTreeSelection {
  if (logic === undefined) return null;
  const leaf = logic.leafNodes.find((node) => node.kind === "BASIC_EVENT_REFERENCE" && eventIds.includes(node.basicEventId));
  if (leaf !== undefined) return { kind: "LEAF", leafId: leaf.id };
  return logic.topGate === null ? null : { kind: "GATE", gateId: logic.topGate.gateId };
}

function valueTexts(esq: EventSequenceQuantification, points: ReadonlyMap<string, number>): Record<string, string> {
  const model = esq.model;
  if (model === undefined) return {};
  return Object.fromEntries(model.events.map((event) => {
    const point = points.get(eventInputKey(esq, model, event.id));
    const text = point !== undefined ? sciText(point)
      : event.expression !== undefined ? expressionText(event.expression)
      : event.value !== undefined ? sciText(event.value)
      : "No value yet";
    return [event.id, text];
  }));
}

function settingsText(summary: EsqModelRunResult, networks: readonly NetworkOption[]): string {
  const solved = summary.trees.filter((tree) => tree.status === "SUCCEEDED").length;
  const parts = [`Solved ${String(solved)} of ${String(summary.trees.length)} event trees`];
  const settings = summary.cutSets;
  const hcl = summary.hcl;
  if (hcl !== undefined) {
    const network = networks.find((option) => option.workbookId === hcl.workbookId && option.configuration.modelId === hcl.modelId);
    parts.push(`HCL on ${network === undefined ? hcl.modelId : networkLabel(network)} for ${String(hcl.treeIds.length)} event trees`);
  } else if (settings === null) {
    parts.push(CALCULATION_LABELS[summary.calculation]);
  } else {
    const first = settings.cutOffs[0];
    const last = settings.cutOffs[settings.cutOffs.length - 1];
    parts.push(`${CALCULATION_LABELS[summary.calculation]} · ${QUANTIFIER_LABELS[settings.quantifier].toLowerCase()}`);
    if (first !== undefined && last !== undefined) parts.push(`cutoffs ${sciText(first)} to ${sciText(last)}${settings.basis === "FREQUENCY" ? " per year" : ""}`);
  }
  parts.push(runLogicText(summary.logic));
  return parts.join(" · ");
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function quantifiesText(esq: EventSequenceQuantification, model: EsqModel, settings: ComposerSettings, network: NetworkOption | undefined): string {
  const roots = treesInScope(esq, model).filter((tree) => !tree.transferEntry);
  const initiators = new Set(roots.map((tree) => tree.initiatorId)).size;
  const states = new Set(roots.flatMap((tree) => (tree.stateId === undefined ? [] : [tree.stateId]))).size;
  const scope = `Quantifies ${plural(roots.length, "event tree", "event trees")} from ${plural(initiators, "initiator group", "initiator groups")}${states === 0 ? "" : ` in ${plural(states, "operating state", "operating states")}`} into sequence, family and end state frequencies per year.`;
  const quantity = settings.choice === "EXACT" ? "Exact probability of every sequence from its linked fault trees."
    : settings.choice === "HCL" ? `Exact probability, with the basic events bound in ${network === undefined ? "the network configuration" : networkLabel(network)} taken from its Bayesian network on the trees it covers.`
    : `Minimal cut sets swept from ${decadeText(settings.highest)} to ${decadeText(settings.lowest)}${settings.basis === "FREQUENCY" ? " per year" : ""}. ${QUANTIFIER_LABELS[settings.quantifier]} quantifier.`;
  return `${scope} ${quantity} ${runLogicText({ ...MODEL_AS_SET, expandCcf: settings.expandCcf })}.`;
}

function useShownRun(workbookId: string | null, recordId: string | undefined): ShownRun {
  const [listed, setListed] = useState<EsqModelRunEntry[]>([]);
  const [chosenId, setChosenId] = useState("");
  const [listError, setListError] = useState<string | undefined>(undefined);
  const [reloads, setReloads] = useState(0);
  const [loaded, setLoaded] = useState<{ runId: string; summary?: EsqModelRunResult; error?: string } | null>(null);
  const reload = useCallback(() => setReloads((count) => count + 1), []);

  useEffect(() => {
    if (workbookId === null) {
      setListed([]);
      return undefined;
    }
    let cancelled = false;
    listEsqModelRuns(workbookId)
      .then((runs) => {
        if (cancelled) return;
        setListed(runs);
        setListError(undefined);
      })
      .catch((caught: Error) => { if (!cancelled) setListError(caught.message); });
    return () => { cancelled = true; };
  }, [workbookId, reloads]);

  const active = listed.some((run) => run.status === "QUEUED" || run.status === "RUNNING");

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(reload, LIST_POLL_MS);
    return () => window.clearInterval(timer);
  }, [active, reload]);

  const shown = listed.find((run) => run.id === chosenId) ?? listed.find((run) => run.id === recordId) ?? listed[0];
  const shownId = shown?.status === "SUCCEEDED" ? shown.id : undefined;

  useEffect(() => {
    if (workbookId === null || shownId === undefined) return undefined;
    let cancelled = false;
    getEsqModelRunResult(workbookId, shownId)
      .then((summary) => { if (!cancelled) setLoaded({ runId: shownId, summary }); })
      .catch((caught: Error) => { if (!cancelled) setLoaded({ runId: shownId, error: caught.message }); });
    return () => { cancelled = true; };
  }, [workbookId, shownId]);

  const out: ShownRun = { runs: listed, show: setChosenId, reload };
  if (shown !== undefined) out.shown = shown;
  if (loaded !== null && loaded.runId === shownId) {
    if (loaded.summary !== undefined) out.summary = loaded.summary;
    if (loaded.error !== undefined) out.error = loaded.error;
  }
  if (listError !== undefined) out.listError = listError;
  return out;
}

function useComposer(shownRun: ShownRun, initialNetworkId: string | null, initialSourceWorkbookId: string | null): Composer {
  const { esq, upstream, runtime } = useEsqWorkbook();
  const networks = useMemo(() => networkOptionsOf(esq, upstream.es, upstream.sy), [esq, upstream.es, upstream.sy]);
  const [settings, setSettings] = useState<ComposerSettings>(START_SETTINGS);
  const [linked, setLinked] = useState(initialNetworkId === null);
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<AnalysisRunMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { show, reload } = shownRun;

  useEffect(() => {
    if (linked) return;
    const match = networks.find((option) => option.configuration.bayesianNetwork.modelId === initialNetworkId && (initialSourceWorkbookId === null || option.workbookId === initialSourceWorkbookId));
    if (match === undefined) return;
    setSettings((current) => ({ ...current, choice: "HCL", network: match.key, expandCcf: false }));
    setLinked(true);
  }, [initialNetworkId, initialSourceWorkbookId, linked, networks]);

  const network = networks.find((option) => option.key === settings.network) ?? networks[0];
  const problem = settings.choice === "HCL"
    ? network === undefined ? "The linked ES and SY workbooks hold no network configuration."
      : settings.expandCcf ? "An HCL run does not expand common cause. Set Common cause to Off."
      : undefined
    : settings.choice !== "CUT_SETS" ? undefined
    : settings.lowest >= settings.highest ? "The lowest cutoff must be below the highest."
    : !(settings.keep >= 1 && settings.keep <= 1000) ? "Keep between 1 and 1000 cut sets."
    : undefined;
  const ready = problem === undefined;

  function run(): void {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null || !ready || running) return;
    const hcl: EsqModelRunHcl | undefined = settings.choice === "HCL" && network !== undefined ? { workbookId: network.workbookId, modelId: network.configuration.modelId } : undefined;
    const cutSets: EventTreeCutSetSettings | undefined = settings.choice === "CUT_SETS"
      ? { basis: settings.basis, cutOffs: cutOffsFrom(settings.highest, settings.lowest), quantifier: settings.quantifier, keep: settings.keep, ...(settings.limitOrder === undefined ? {} : { limitOrder: settings.limitOrder }) }
      : undefined;
    setRunning(true);
    setLive(null);
    setError(null);
    let announced = false;
    runEsqModel(workbookId, revision, { ...MODEL_AS_SET, expandCcf: settings.expandCcf }, settings.choice === "CUT_SETS" ? "CUT_SETS" : "EXACT", cutSets, hcl, (progress) => {
      setLive(progress);
      if (announced) return;
      announced = true;
      show(progress.id);
      reload();
    })
      .then((response) => {
        show(response.run.id);
        reload();
      })
      .catch((caught: Error) => {
        setError(caught.message);
        reload();
      })
      .finally(() => {
        setRunning(false);
        setLive(null);
      });
  }

  function stop(runId: string): void {
    const workbookId = runtime.workbookId;
    if (workbookId === null) return;
    cancelAnalysisRun("esq", workbookId, runId)
      .then(() => reload())
      .catch((caught: Error) => setError(caught.message));
  }

  const out: Composer = {
    settings,
    set: (patch) => setSettings((current) => ({ ...current, ...patch })),
    clearLimit: () => setSettings((current) => {
      const { limitOrder: _old, ...rest } = current;
      return rest;
    }),
    networks,
    running,
    live,
    error,
    ready,
    run,
    stop,
  };
  if (problem !== undefined) out.problem = problem;
  return out;
}

function useTreeResult(workbookId: string | null, runId: string | undefined): EventTreeAnalysisResult | undefined {
  const [state, setState] = useState<{ runId: string; result?: EventTreeAnalysisResult } | null>(null);
  useEffect(() => {
    if (workbookId === null || runId === undefined) return undefined;
    let cancelled = false;
    getEsqRunDetails(workbookId, runId)
      .then((details) => {
        if (cancelled) return;
        const parsed = EventTreeAnalysisResultSchema.safeParse(details.result);
        setState(parsed.success ? { runId, result: parsed.data } : { runId });
      })
      .catch(() => { if (!cancelled) setState({ runId }); });
    return () => { cancelled = true; };
  }, [workbookId, runId]);
  return state !== null && state.runId === runId ? state.result : undefined;
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }): JSX.Element {
  const id = useId();
  return (
    <div className="es-records__filter">
      <label className="posfield__label" htmlFor={id}>{label}</label>
      <select id={id} className="posfield__select" value={value} onChange={(event) => {
        const next = options.find(([option]) => option === event.target.value);
        if (next !== undefined) onChange(next[0]);
      }}>
        {options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
      </select>
    </div>
  );
}

function RunFilter({ shownRun, recordId }: { shownRun: ShownRun; recordId: string | undefined }): JSX.Element | null {
  const id = useId();
  const { runs, shown } = shownRun;
  if (runs.length === 0 || shown === undefined) return null;
  return (
    <div className="es-records__filter esq-solve-run">
      <label className="posfield__label" htmlFor={id}>Run</label>
      <select id={id} className="posfield__select" value={shown.id} onChange={(event) => shownRun.show(event.target.value)}>
        {runs.map((run) => <option key={run.id} value={run.id}>{`${runLabel(run)}${run.id === recordId ? " · of record" : ""}`}</option>)}
      </select>
    </div>
  );
}

function FailedTreeTable({ rows, model }: { rows: readonly TreeFailure[]; model: EsqModel }): JSX.Element | null {
  if (rows.length === 0) return null;
  return (
    <table className="postable postable--mid es-records" aria-label="Failed event trees">
      <thead><tr><th scope="col">Event tree</th><th scope="col">Why it failed</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.treeId}>
            <td>{treeLabel(model, row.treeId)}</td>
            <td>{row.failure}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FailedTrees({ summary, model }: { summary: EsqModelRunResult; model: EsqModel }): JSX.Element | null {
  const rows = summary.trees.flatMap((tree) => (tree.status === "FAILED" ? [{ treeId: tree.treeId, failure: tree.failure ?? "No reason given" }] : []));
  return <FailedTreeTable rows={rows} model={model} />;
}

function useTreeFailures(workbookId: string | null, runId: string | undefined, model: EsqModel): { rows: TreeFailure[]; error?: string } {
  const [state, setState] = useState<{ runId: string; members: AnalysisRunMetadata[]; error?: string } | null>(null);
  useEffect(() => {
    if (workbookId === null || runId === undefined) return undefined;
    let cancelled = false;
    getEsqRunDetails(workbookId, runId)
      .then((details) => { if (!cancelled) setState({ runId, members: (details.members ?? []).map((member) => member.run) }); })
      .catch((caught: Error) => { if (!cancelled) setState({ runId, members: [], error: caught.message }); });
    return () => { cancelled = true; };
  }, [workbookId, runId]);
  if (state === null || state.runId !== runId) return { rows: [] };
  const treeOf = new Map(model.trees.map((tree) => [esqTreeRunId(tree.id), tree.id]));
  const rows = state.members.flatMap((member) => (member.status === "FAILED"
    ? [{ treeId: treeOf.get(member.owner.modelId) ?? member.owner.modelId, failure: member.failure?.message ?? "No reason given" }]
    : []));
  return state.error === undefined ? { rows } : { rows, error: state.error };
}

function ShownRunState({ shownRun, model, live = null }: { shownRun: ShownRun; model: EsqModel; live?: AnalysisRunMetadata | null }): JSX.Element | null {
  const { runtime } = useEsqWorkbook();
  const { shown, error, listError } = shownRun;
  const failures = useTreeFailures(runtime.workbookId, shown?.status === "FAILED" ? shown.id : undefined, model);
  if (listError !== undefined && shown === undefined) return <p className="es-scope-error" role="alert">{listError}</p>;
  const current = live !== null && live.id === shown?.id ? live : shown;
  const progress = current === undefined ? "" : runProgressText(current);
  if (progress.length > 0) return <p className="possubtle esq-solve-settings" role="status">{progress}</p>;
  if (shown?.status === "FAILED") {
    return (
      <div className="esq-solve-stack">
        <p className="es-scope-error" role="alert">{shown.failure ?? "The run did not finish and gave no reason."}</p>
        <FailedTreeTable rows={failures.rows} model={model} />
        {failures.error !== undefined && <p className="es-scope-error" role="alert">{`The failed event trees could not be listed. ${failures.error}`}</p>}
      </div>
    );
  }
  if (error !== undefined) return <p className="es-scope-error" role="alert">{error}</p>;
  return null;
}

function ShownCaption({ shownRun, model, networks }: { shownRun: ShownRun; model: EsqModel; networks: readonly NetworkOption[] }): JSX.Element | null {
  const summary = shownRun.summary;
  if (summary === undefined) return <ShownRunState shownRun={shownRun} model={model} />;
  return <p className="possubtle esq-solve-settings">{settingsText(summary, networks)}</p>;
}

function RunsPanel({ view, shownRun, composer, onRecord }: { view: EsqSolveView; shownRun: ShownRun; composer: Composer; onRecord: () => void }): JSX.Element {
  const { editable, runtime } = useEsqWorkbook();
  const fieldId = useId();
  const { settings, set } = composer;
  const blocked = analysisSaveBlock(runtime);
  const shown = shownRun.shown;
  const activeId = composer.live !== null && (composer.live.status === "QUEUED" || composer.live.status === "RUNNING") ? composer.live.id
    : shown !== undefined && (shown.status === "QUEUED" || shown.status === "RUNNING") ? shown.id
    : undefined;

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters">
          <Choice label="Calculation" value={settings.choice} options={RUN_CHOICES} onChange={(choice) => set({ choice })} />
          {settings.choice === "HCL" && (
            <div className="es-records__filter esq-solve-run">
              <label className="posfield__label" htmlFor={`${fieldId}-network`}>Network configuration</label>
              <select id={`${fieldId}-network`} className="posfield__select" value={composer.networks.some((option) => option.key === settings.network) ? settings.network : composer.networks[0]?.key ?? ""} disabled={composer.networks.length === 0} onChange={(event) => set({ network: event.target.value })}>
                {composer.networks.map((option) => <option key={option.key} value={option.key}>{networkLabel(option)}</option>)}
              </select>
            </div>
          )}
          <Choice label="Common cause" value={settings.expandCcf ? "on" : "off"} options={[["on", "Expanded"], ["off", "Off"]]} onChange={(value) => set({ expandCcf: value === "on" })} />
          {settings.choice === "CUT_SETS" && (
            <>
              <Choice label="Cutoff on" value={settings.basis} options={BASIS_OPTIONS} onChange={(basis) => set({ basis })} />
              <Choice label="Quantifier" value={settings.quantifier} options={QUANTIFIER_OPTIONS} onChange={(quantifier) => set({ quantifier })} />
              <div className="es-records__filter">
                <label className="posfield__label" htmlFor={`${fieldId}-highest`}>Highest cutoff</label>
                <select id={`${fieldId}-highest`} className="posfield__select" value={settings.highest} onChange={(event) => set({ highest: Number(event.target.value) })}>
                  {HIGHEST_EXPONENTS.map((exponent) => <option key={exponent} value={exponent}>{decadeText(exponent)}</option>)}
                </select>
              </div>
              <div className="es-records__filter">
                <label className="posfield__label" htmlFor={`${fieldId}-lowest`}>Lowest cutoff</label>
                <select id={`${fieldId}-lowest`} className="posfield__select" value={settings.lowest} onChange={(event) => set({ lowest: Number(event.target.value) })}>
                  {LOWEST_EXPONENTS.map((exponent) => <option key={exponent} value={exponent}>{decadeText(exponent)}</option>)}
                </select>
              </div>
              <div className="es-records__filter">
                <label className="posfield__label" htmlFor={`${fieldId}-keep`}>Cut sets kept</label>
                <input id={`${fieldId}-keep`} type="number" min={1} max={1000} step={1} className="posfield__input posmono esq-dialog-number" aria-invalid={!(settings.keep >= 1 && settings.keep <= 1000)} value={settings.keep} onChange={(event) => set({ keep: Math.round(Number(event.target.value)) })} />
              </div>
              <div className="es-records__filter">
                <label className="posfield__label" htmlFor={`${fieldId}-order`}>Order limit</label>
                <input id={`${fieldId}-order`} type="number" min={1} step={1} className="posfield__input posmono esq-dialog-number" value={settings.limitOrder ?? ""} onChange={(event) => {
                  const value = Math.round(Number(event.target.value));
                  if (event.target.value.trim().length === 0 || !(value >= 1)) composer.clearLimit();
                  else set({ limitOrder: value });
                }} />
              </div>
            </>
          )}
        </div>
        <div className="es-records__actions">
          {editable && activeId !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => composer.stop(activeId)}>Stop</button>}
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={composer.running || blocked !== null || !composer.ready} title={blocked ?? undefined} onClick={composer.run}>{composer.running ? "Running" : "Run"}</button>}
        </div>
      </div>
      <ModelRunsBody view={view} shownRun={shownRun} composer={composer} onRecord={onRecord} />
    </>
  );
}

function ModelRunsBody({ view, shownRun, composer, onRecord }: { view: EsqSolveView; shownRun: ShownRun; composer: Composer; onRecord: () => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const summary = shownRun.summary;
  const recordId = view.run?.runId;
  const problem = summary === undefined ? undefined : summaryProblem(summary, esq);
  const recorded = summary !== undefined && recordId === summary.runId;
  const cutSetRun = summary?.calculation === "CUT_SETS";
  const swept = summary === undefined ? [] : runConvergenceOf(summary, view);
  const network = composer.networks.find((option) => option.key === composer.settings.network) ?? composer.networks[0];
  return (
    <>
      <p className="possubtle esq-solve-settings">{quantifiesText(esq, view.model, composer.settings, network)}</p>
      {composer.running && composer.live === null && <p className="possubtle esq-solve-settings" role="status">Building the event trees for PRAXIS</p>}
      {composer.problem !== undefined && <p className="es-scope-error" role="alert">{composer.problem}</p>}
      {composer.error !== null && <p className="es-scope-error" role="alert">{composer.error}</p>}
      <div className="es-records__bar">
        <div className="es-records__filters"><RunFilter shownRun={shownRun} recordId={recordId} /></div>
        <div className="es-records__actions">
          {view.run !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={onRecord}>Run of record</button>}
          {editable && summary !== undefined && (
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={recorded || problem !== undefined} title={problem} onClick={() => mutateEsq((draft) => withRunOfRecord(draft, summary))}>{recorded ? "Values of record" : "Use as values of record"}</button>
          )}
        </div>
      </div>
      <ShownRunState shownRun={shownRun} model={view.model} live={composer.live} />
      {summary !== undefined && (
        <div className="esq-solve-stack">
          <p className="possubtle esq-solve-settings">{settingsText(summary, composer.networks)}</p>
          {problem !== undefined && !recorded && <p className="es-scope-error" role="status">{problem}</p>}
          <FailedTrees summary={summary} model={view.model} />
          {summary.families.length > 0 && (
            <table className="postable postable--mid es-records" aria-label="Family frequencies of this run">
              <thead><tr><th scope="col">Family</th><th scope="col">Frequency (/yr)</th><th scope="col">Sequences</th>{cutSetRun && <><th scope="col">Cut sets</th><th scope="col">Converged at</th></>}</tr></thead>
              <tbody>
                {summary.families.map((family) => (
                  <tr key={family.familyId}>
                    <td>{familyText(view, family.familyId)}</td>
                    <td className="posmono">{sciText(family.annualFrequency)}</td>
                    <td className="posmono">{family.sequenceCount}</td>
                    {cutSetRun && <><td className="posmono">{family.cutSetCount ?? "—"}</td><td className="posmono">{convergedText(swept.find((entry) => entry.id === family.familyId)?.convergence)}</td></>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {summary.endStates.length > 0 && (
            <table className="postable postable--mid es-records" aria-label="End state frequencies of this run">
              <thead><tr><th scope="col">End state</th><th scope="col">Frequency (/yr)</th></tr></thead>
              <tbody>
                {summary.endStates.map((entry) => (
                  <tr key={entry.endState}>
                    <td>{END_STATE_LABELS[entry.endState] ?? entry.endState}</td>
                    <td className="posmono">{sciText(entry.annualFrequency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}

function TreesPanel({ view, shownRun, networks, onFaultTree }: { view: EsqSolveView; shownRun: ShownRun; networks: readonly NetworkOption[]; onFaultTree: (modelIds: string[]) => void }): JSX.Element {
  const { esq, upstream, runtime } = useEsqWorkbook();
  const fieldId = useId();
  const [treeId, setTreeId] = useState("");
  const [representation, setRepresentation] = useState<EventTreeRepresentation>("event-tree");
  const [selection, setSelection] = useState<string | null>(null);
  const model = view.model;
  const tree = model.trees.find((candidate) => candidate.id === treeId) ?? model.trees[0];
  const typed = tree?.typed === true;
  const source = tree === undefined ? undefined : sourceTreeOf(esq, upstream.es, tree.id, typed);
  const summary = shownRun.summary;
  const values = useMemo(() => (summary === undefined || tree === undefined || source === undefined ? undefined : sequenceValuesOf(summary, tree.id, source)), [source, summary, tree]);
  const initiators = model.initiators.map((initiator) => ({ id: initiator.id, name: initiator.name }));
  const states = model.states.map((state) => ({ id: state.id, name: state.name }));
  const transfers = model.trees.filter((candidate) => candidate.id !== tree?.id).map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    sequenceIds: model.sequences.filter((sequence) => sequence.treeId === candidate.id).map((sequence) => sequence.id),
  }));
  const endStates = typed ? [] : (upstream.es?.endStateDefinitions ?? []).map((definition) => ({ id: definition.id, code: definition.code, name: definition.name, release: definition.kind === "RELEASE" }));

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters">
          <RunFilter shownRun={shownRun} recordId={view.run?.runId} />
          {model.trees.length > 0 && (
            <div className="es-records__filter">
              <label className="posfield__label" htmlFor={`${fieldId}-tree`}>Event tree</label>
              <select id={`${fieldId}-tree`} className="posfield__select" value={tree?.id ?? ""} onChange={(event) => setTreeId(event.target.value)}>
                {model.trees.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name === candidate.code ? candidate.code : `${candidate.code} · ${candidate.name}`}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
      <ShownCaption shownRun={shownRun} model={model} networks={networks} />
      {tree !== undefined && source !== undefined && (
        <EventTreeEditor
          key={tree.id}
          model={source}
          eventSequences={typed ? [] : upstream.es?.eventSequences ?? []}
          availableInitiatingEvents={initiators}
          availableOperatingStates={states}
          editFrequency={false}
          availableTransfers={transfers}
          representation={representation}
          capabilities={{ author: false, quantification: false, linkSelection: false }}
          selection={selection}
          validation={[]}
          saveState={runtime.saveStatus}
          {...(values === undefined ? {} : { sequenceValues: values })}
          onOperation={() => undefined}
          onRepresentationChange={setRepresentation}
          onSelectionChange={setSelection}
          faultTreeName={(reference) => {
            const top = model.tops.find((candidate) => candidate.modelId === reference.modelId);
            return top === undefined ? undefined : `${top.code} · ${top.name}`;
          }}
          {...(endStates.length === 0 ? {} : { endStateOptions: endStates })}
          onOpenReference={(reference) => {
            if ("targetEventTreeId" in reference) setTreeId(reference.targetEventTreeId);
            else onFaultTree([reference.modelId]);
          }}
        />
      )}
    </>
  );
}

function FamiliesPanel({ view, onOpen }: { view: EsqSolveView; onOpen: (id: string) => void }): JSX.Element {
  const { editable } = useEsqWorkbook();
  const [page, setPage] = useState(0);
  const rows = paged(view.families.length, page);
  const shown = view.families.slice(rows.start, rows.start + PAGE);
  const actionLabel = editable ? "Edit" : "View";
  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters" />
        <div className="es-records__actions"><Pager rows={rows} noun="family" plural="families" onPage={setPage} /></div>
      </div>
      {view.families.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Family values">
          <thead><tr><th scope="col">Family</th><th scope="col">PRAXIS (/yr)</th><th scope="col">Typed or imported (/yr)</th><th scope="col">Difference</th><th scope="col">Of record (/yr)</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((family) => {
              const solve = family.solve;
              const run = solve?.run?.annualFrequency;
              const compared = solve?.typed !== undefined ? { value: solve.typed.annualFrequency, from: "Typed" } : solve?.imported !== undefined ? { value: solve.imported.annualFrequency, from: "Imported from ES" } : undefined;
              return (
                <tr key={family.id}>
                  <td>
                    <span className="postable__name">{blank(family.name) ? family.id : family.name}</span>
                    {!blank(family.name) && <span className="postable__name-sub">{family.id}</span>}
                  </td>
                  <td className="posmono">{run === undefined ? <Muted>None</Muted> : sciText(run)}</td>
                  <td className="posmono">
                    {compared === undefined ? <Muted>None</Muted> : sciText(compared.value)}
                    {compared !== undefined && <span className="postable__name-sub">{compared.from}</span>}
                  </td>
                  <td className="posmono">{compared === undefined ? <Muted>None</Muted> : difference(compared.value, run)}</td>
                  <td className="posmono">
                    {family.value === undefined ? (family.needsValue ? <Flag>Not chosen</Flag> : <Muted>None</Muted>) : sciText(family.value)}
                    {family.source !== undefined && <span className="postable__name-sub">{SOURCE_LABELS[family.source]}</span>}
                  </td>
                  <td className="es-records__act">
                    <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${family.id}`} onClick={() => onOpen(family.id)}>{actionLabel}</button>
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

function SequencesPanel({ view, shownRun, networks, onCutSets }: { view: EsqSolveView; shownRun: ShownRun; networks: readonly NetworkOption[]; onCutSets: (filter: CutSetFilter) => void }): JSX.Element {
  const fieldId = useId();
  const [family, setFamily] = useState("");
  const [state, setState] = useState("");
  const [page, setPage] = useState(0);
  const summary = shownRun.summary;
  const model = view.model;
  const stateOf = new Map(model.trees.map((tree) => [tree.id, tree.stateId]));
  const all = summary?.sequences ?? [];
  const families = [...new Set(all.flatMap((sequence) => (sequence.familyId === null ? [] : [sequence.familyId])))].sort();
  const states = [...new Set(all.flatMap((sequence) => {
    const stateId = stateOf.get(sequence.treeId);
    return stateId === undefined ? [] : [stateId];
  }))].sort();
  const filtered = all
    .filter((sequence) => (family === "" || sequence.familyId === family) && (state === "" || stateOf.get(sequence.treeId) === state))
    .sort((a, b) => b.annualFrequency - a.annualFrequency);
  const rows = paged(filtered.length, page);
  const shown = filtered.slice(rows.start, rows.start + PAGE);
  const cutSetRun = summary?.calculation === "CUT_SETS";

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters">
          <RunFilter shownRun={shownRun} recordId={view.run?.runId} />
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-family`}>Family</label>
            <select id={`${fieldId}-family`} className="posfield__select" value={family} onChange={(event) => { setFamily(event.target.value); setPage(0); }}>
              <option value="">All families</option>
              {families.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-state`}>Operating state</label>
            <select id={`${fieldId}-state`} className="posfield__select" value={state} onChange={(event) => { setState(event.target.value); setPage(0); }}>
              <option value="">All states</option>
              {states.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
        </div>
        <div className="es-records__actions"><Pager rows={rows} noun="sequence" onPage={setPage} /></div>
      </div>
      <ShownCaption shownRun={shownRun} model={model} networks={networks} />
      {filtered.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Sequence frequencies">
          <thead><tr><th scope="col">Sequence</th><th scope="col">Family</th><th scope="col">Given the initiator</th><th scope="col">Frequency (/yr)</th>{cutSetRun && <th scope="col" className="es-records__act" aria-label="Actions" />}</tr></thead>
          <tbody>
            {shown.map((sequence) => {
              const key = sequenceKeyOf(sequence);
              const familyId = sequence.familyId;
              return (
                <tr key={key}>
                  <td>
                    <span className="postable__name">{sequenceText(model, sequence.sequenceIds)}</span>
                    <span className="postable__name-sub">{treeLabel(model, sequence.treeId)}</span>
                  </td>
                  <td>{familyId ?? <Muted>None</Muted>}</td>
                  <td className="posmono">{sciText(sequence.conditionalProbability)}</td>
                  <td className="posmono">{sciText(sequence.annualFrequency)}</td>
                  {cutSetRun && (
                    <td className="es-records__act">
                      {familyId !== null && (sequence.cutSetCount ?? 0) > 0 && <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Cut sets of ${sequenceText(model, sequence.sequenceIds)}`} onClick={() => onCutSets({ familyId, sequenceKey: key })}>Cut sets</button>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

function CutSetsPanel({ view, shownRun, networks, filter, onFilter, onReview, onFaultTree }: {
  view: EsqSolveView;
  shownRun: ShownRun;
  networks: readonly NetworkOption[];
  filter: CutSetFilter;
  onFilter: (filter: CutSetFilter) => void;
  onReview: (key: string) => void;
  onFaultTree: (modelIds: string[], eventIds: string[]) => void;
}): JSX.Element {
  const { esq, editable, upstream, runtime, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const [page, setPage] = useState(0);
  const summary = shownRun.summary;
  const model = view.model;
  const cutSetRun = summary?.calculation === "CUT_SETS";
  const families = summary === undefined || !cutSetRun ? [] : summary.families.filter((family) => family.cutSets.length > 0);
  const family = families.find((candidate) => candidate.familyId === filter.familyId) ?? families[0];
  const sequences = summary === undefined || family === undefined ? [] : summary.sequences
    .filter((sequence) => sequence.familyId === family.familyId && (sequence.cutSetCount ?? 0) > 0)
    .sort((a, b) => b.annualFrequency - a.annualFrequency);
  const chosen = sequences.find((sequence) => sequenceKeyOf(sequence) === filter.sequenceKey);
  const childRunId = chosen === undefined ? undefined : summary?.trees.find((tree) => tree.treeId === chosen.treeId)?.runId;
  const treeResult = useTreeResult(runtime.workbookId, childRunId);
  const thresholds = thresholdsOf(esq, upstream.ri);
  const codes = new Map(model.events.map((event) => [event.id, event.code]));
  const codeOf = (id: string): string => summary?.eventCodes[id] ?? codes.get(id) ?? id;
  const familyRows = summary === undefined || family === undefined ? [] : cutSetRows(summary, family.familyId, family.annualFrequency, reviewOf(esq), thresholds, codeOf);
  const rows = chosen === undefined || family === undefined ? familyRows : sequenceCutSetRows({
    entry: childEntryOf(treeResult, model, chosen),
    familyId: family.familyId,
    treeId: chosen.treeId,
    total: family.annualFrequency,
    familyRows,
    esq,
    individualPercent: thresholds.individualPercent,
    codeOf,
  });
  const paging = paged(rows.length, page);
  const shown = rows.slice(paging.start, paging.start + PAGE);

  function review(row: EsqCutSetRow): void {
    if (row.review === undefined) {
      if (!editable) return;
      mutateEsq((draft) => withCutSetReview(draft, row, {}));
    }
    onReview(row.key);
  }

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters">
          <RunFilter shownRun={shownRun} recordId={view.run?.runId} />
          {family !== undefined && (
            <div className="es-records__filter">
              <label className="posfield__label" htmlFor={`${fieldId}-family`}>Family</label>
              <select id={`${fieldId}-family`} className="posfield__select" value={family.familyId} onChange={(event) => { onFilter({ familyId: event.target.value, sequenceKey: "" }); setPage(0); }}>
                {families.map((candidate) => <option key={candidate.familyId} value={candidate.familyId}>{familyText(view, candidate.familyId)}</option>)}
              </select>
            </div>
          )}
          {family !== undefined && sequences.length > 0 && (
            <div className="es-records__filter">
              <label className="posfield__label" htmlFor={`${fieldId}-sequence`}>Sequence</label>
              <select id={`${fieldId}-sequence`} className="posfield__select" value={chosen === undefined ? "" : sequenceKeyOf(chosen)} onChange={(event) => { onFilter({ familyId: family.familyId, sequenceKey: event.target.value }); setPage(0); }}>
                <option value="">All sequences</option>
                {sequences.map((sequence) => <option key={sequenceKeyOf(sequence)} value={sequenceKeyOf(sequence)}>{`${sequenceText(model, sequence.sequenceIds)} · ${treeLabel(model, sequence.treeId)}`}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="es-records__actions"><Pager rows={paging} noun="cut set" onPage={setPage} /></div>
      </div>
      <ShownCaption shownRun={shownRun} model={model} networks={networks} />
      {rows.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Cut sets">
          <thead><tr><th scope="col">Cut set</th><th scope="col">Frequency (/yr)</th><th scope="col">Share</th><th scope="col">Review</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((row) => {
              const verdict = row.review?.verdict;
              const tops = topsOf(model, row.eventIds);
              const text = row.codes.length === 0 ? "Initiator alone" : row.codes.join(" · ");
              return (
                <tr key={row.key}>
                  <td>
                    <span className="postable__name">{text}</span>
                    <span className="postable__name-sub">{`${row.significant ? "Significant · " : ""}${treeLabel(model, row.treeId)}`}</span>
                  </td>
                  <td className="posmono">{sciText(row.annualFrequency)}</td>
                  <td className="posmono">{shareText(row.share)}</td>
                  <td>{verdict === "CORRECT" ? "Correct" : verdict === "ISSUE" ? <Flag>Issue</Flag> : <Muted>Not reviewed</Muted>}</td>
                  <td className="es-records__act">
                    {(editable || row.review !== undefined) && <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Review ${text}`} onClick={() => review(row)}>{row.review === undefined ? "Review" : editable ? "Edit" : "View"}</button>}
                    {tops.length > 0 && <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Fault trees of ${text}`} onClick={() => onFaultTree(tops, row.eventIds)}>Fault trees</button>}
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

function ConvergencePanel({ view, shownRun, networks, onSweep }: { view: EsqSolveView; shownRun: ShownRun; networks: readonly NetworkOption[]; onSweep: (id: string) => void }): JSX.Element {
  const [page, setPage] = useState(0);
  const summary = shownRun.summary;
  const swept = summary === undefined ? [] : runConvergenceOf(summary, view);
  const rows = paged(swept.length, page);
  const shown = swept.slice(rows.start, rows.start + PAGE);
  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters"><RunFilter shownRun={shownRun} recordId={view.run?.runId} /></div>
        <div className="es-records__actions"><Pager rows={rows} noun="family" plural="families" onPage={setPage} /></div>
      </div>
      <ShownCaption shownRun={shownRun} model={view.model} networks={networks} />
      {swept.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Convergence by family">
          <thead><tr><th scope="col">Family</th><th scope="col">Converged at</th><th scope="col">Last change</th><th scope="col">States converged</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((family) => {
              const states = family.states.filter((state) => state.annualFrequency > 0);
              const done = states.filter((state) => state.convergence.convergedAt !== undefined).length;
              return (
                <tr key={family.id}>
                  <td>{familyText(view, family.id)}</td>
                  <td className="posmono">{family.convergence.convergedAt === undefined ? <Flag>Not yet</Flag> : sciText(family.convergence.convergedAt)}</td>
                  <td className="posmono">{pctText(lastChange(family.convergence))}</td>
                  <td className="posmono">{states.length === 0 ? <Muted>None</Muted> : `${String(done)} of ${String(states.length)}`}</td>
                  <td className="es-records__act">
                    <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Sweep of ${family.id}`} onClick={() => onSweep(family.id)}>Sweep</button>
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

function FamilyDialog({ id, view, onClose }: { id: string; view: EsqSolveView; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const family = view.families.find((candidate) => candidate.id === id);
  if (family === undefined) return null;
  const solve: EsqFamilySolve = family.solve ?? { familyId: id };
  const esWorkbookId = esq.linkedWorkbooks?.ES;
  const esFrequency = family.esFrequency;
  const typed = solve.typed;
  const reasonNeeded = (solve.ofRecord === "TYPED" || solve.ofRecord === "IMPORTED") && solve.run !== undefined;

  function save(next: EsqFamilySolve): void {
    if (!editable) return;
    mutateEsq((draft) => withFamilySolve(draft, id, next));
  }

  function withoutRecord(entry: EsqFamilySolve, source: EsqFamilySolve["ofRecord"]): EsqFamilySolve {
    if (entry.ofRecord !== source) return entry;
    const { ofRecord: _old, ...rest } = entry;
    return rest;
  }

  function setTyped(value: number | undefined): void {
    if (value === undefined) {
      const { typed: _old, ...rest } = withoutRecord(solve, "TYPED");
      save(rest);
      return;
    }
    if (value >= 0) save({ ...solve, typed: { annualFrequency: value, source: typed?.source ?? "" } });
  }

  return (
    <DialogShell label="Family value" onClose={onClose} fit>
      <DialogHead cap="Family value · ESQ-A4 · ESQ-B1" title={blank(family.name) ? id : `${id} · ${family.name}`} onClose={onClose} />
      <div className="modal__body esq-dialog-body">
        <div className="esq-dialog-section">
          <span className="esq-dialog-head">Value of record</span>
          <div className="posfield-grid esq-dialog-fields">
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label" htmlFor={`${fieldId}-record`}>Value of record</label>
              <select id={`${fieldId}-record`} className="posfield__select" value={solve.ofRecord ?? ""} disabled={!editable} onChange={(event) => {
                const value = event.target.value;
                const { ofRecord: _old, ...rest } = solve;
                save(value === "RUN" || value === "TYPED" || value === "IMPORTED" ? { ...rest, ofRecord: value } : rest);
              }}>
                <option value="">Not chosen</option>
                {solve.run !== undefined && <option value="RUN">{`PRAXIS run · ${sciText(solve.run.annualFrequency)}`}</option>}
                {typed !== undefined && <option value="TYPED">{`Typed · ${sciText(typed.annualFrequency)}`}</option>}
                {solve.imported !== undefined && <option value="IMPORTED">{`Imported from ES · ${sciText(solve.imported.annualFrequency)}`}</option>}
              </select>
            </div>
            <AreaField label="Reason" value={solve.reason ?? ""} editable={editable} required={reasonNeeded} onChange={(reason) => {
              const { reason: _old, ...rest } = solve;
              save(blank(reason) ? rest : { ...rest, reason });
            }} />
          </div>
        </div>
        <div className="esq-dialog-section">
          <span className="esq-dialog-head">Typed value</span>
          <div className="posfield-grid esq-dialog-fields">
            <NumberField label="Typed frequency (/yr)" value={typed?.annualFrequency} editable={editable} onChange={setTyped} />
            {typed !== undefined && <AreaField label="Source of the typed value" value={typed.source} editable={editable} required onChange={(source) => save({ ...solve, typed: { ...typed, source } })} />}
          </div>
        </div>
        {editable && (esFrequency !== undefined || solve.imported !== undefined) && (
          <div className="esq-dialog-section">
            <span className="esq-dialog-head">Imported value</span>
            <div className="posrow es-dialog-actions">
              {esFrequency !== undefined && esWorkbookId !== undefined && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => save({ ...solve, imported: { annualFrequency: esFrequency, element: "ES", workbookId: esWorkbookId, at: new Date().toISOString() } })}>{`${solve.imported === undefined ? "Import" : "Import again"} from ES · ${sciText(esFrequency)}`}</button>
              )}
              {solve.imported !== undefined && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => {
                  const { imported: _old, ...rest } = withoutRecord(solve, "IMPORTED");
                  save(rest);
                }}>Remove imported value</button>
              )}
            </div>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function RunDialog({ view, onClose }: { view: EsqSolveView; onClose: () => void }): JSX.Element | null {
  const { editable, mutateEsq } = useEsqWorkbook();
  const run = view.run;
  if (run === undefined) return null;
  const cutOffs = run.cutOffs ?? [];
  const first = cutOffs[0];
  const last = cutOffs[cutOffs.length - 1];
  const facts: [string, string][] = [
    ["Status", view.stale ? "Older than its inputs" : "Current"],
    ["Workbook revision", String(run.revision)],
    ["Calculation", run.hcl !== undefined ? `HCL · ${String(run.hcl.treeIds.length)} event trees on the network` : run.quantifier === undefined ? CALCULATION_LABELS[run.calculation] : `${CALCULATION_LABELS[run.calculation]} · ${QUANTIFIER_LABELS[run.quantifier].toLowerCase()}`],
    ["Cutoffs", first === undefined || last === undefined ? "None" : `${sciText(first)} to ${sciText(last)}${run.basis === undefined ? "" : ` · ${BASIS_LABELS[run.basis].toLowerCase()}`}`],
    ["Order limit", run.limitOrder === undefined ? "None" : String(run.limitOrder)],
    ["Logic", runLogicText(run.logic)],
    ["Largest sequence probability", run.peakProbability === undefined ? "None" : sciText(run.peakProbability)],
  ];
  return (
    <DialogShell label="Run of record" onClose={onClose}>
      <DialogHead cap="Run of record · ESQ-B3 · ESQ-B4 · ESQ-N-5" title={`Run of ${new Date(run.at).toLocaleString()}`} onClose={onClose} />
      <div className="modal__body esq-dialog-body">
        <table className="postable postable--mid es-records esq-dialog-table" aria-label="Run of record">
          <tbody>
            {facts.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {run.quantifier === "RARE_EVENT" && (
          <div className="posfield-grid esq-dialog-fields">
            <AreaField label="Rare event reason" value={view.work.rareEventReason ?? ""} editable={editable} required={(run.peakProbability ?? 0) > 0.1} onChange={(reason) => mutateEsq((draft) => withRareEventReason(draft, reason))} />
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function ReviewDialog({ reviewKey, onClose, onFaultTree }: { reviewKey: string; onClose: () => void; onFaultTree?: (modelIds: string[], eventIds: string[]) => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const review = reviewOf(esq).cutSetReviews?.find((entry) => entry.key === reviewKey);
  const model = esq.model;
  if (review === undefined || model === undefined) return null;
  const codes = new Map(model.events.map((event) => [event.id, event.code]));
  const labels = review.eventIds.map((eventId) => codes.get(eventId) ?? eventId);
  const row: EsqCutSetRow = { key: review.key, familyId: review.familyId, treeId: review.treeId, eventIds: review.eventIds, codes: labels, annualFrequency: review.annualFrequency, share: 0, cumulative: 0, significant: review.significant };
  const tops = topsOf(model, review.eventIds);

  function save(change: { verdict?: "CORRECT" | "ISSUE"; note?: string }): void {
    if (!editable) return;
    mutateEsq((draft) => withCutSetReview(draft, row, change));
  }

  return (
    <DialogShell label="Cut set review" onClose={onClose}>
      <DialogHead cap={review.significant ? "Cut set review · significant · ESQ-D1" : "Cut set review · non-significant · ESQ-D5"} title={`${review.familyId} · ${labels.length === 0 ? "Initiator alone" : labels.join(" · ")}`} onClose={onClose} />
      <div className="modal__body esq-dialog-body">
        <div className="posfield-grid esq-dialog-fields">
          <div className="posfield">
            <label className="posfield__label" htmlFor={`${fieldId}-verdict`}>Logic</label>
            <select id={`${fieldId}-verdict`} className="posfield__select" value={review.verdict ?? ""} disabled={!editable} onChange={(event) => {
              const value = event.target.value;
              save(value === "CORRECT" || value === "ISSUE" ? { verdict: value } : { verdict: undefined });
            }}>
              <option value="">Not reviewed</option>
              <option value="CORRECT">{review.significant ? "Correct" : "Correct and physically meaningful"}</option>
              <option value="ISSUE">Wrong, needs a fix</option>
            </select>
          </div>
          <AreaField label="Note" value={review.note} editable={editable} required={review.verdict === "ISSUE"} onChange={(note) => save({ note })} />
        </div>
        {((onFaultTree !== undefined && tops.length > 0) || editable) && (
          <div className="posrow es-dialog-actions">
            {onFaultTree !== undefined && tops.length > 0 && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onFaultTree(tops, review.eventIds)}>Fault trees</button>}
            {editable && (
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => {
                mutateEsq((draft) => ({ ...draft, review: { ...reviewOf(draft), cutSetReviews: (reviewOf(draft).cutSetReviews ?? []).filter((entry) => entry.key !== reviewKey) } }));
                onClose();
              }}>Remove review</button>
            )}
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function SweepDialog({ id, view, summary, onClose }: { id: string; view: EsqSolveView; summary: EsqModelRunResult | undefined; onClose: () => void }): JSX.Element | null {
  const family = summary === undefined ? undefined : runConvergenceOf(summary, view).find((candidate) => candidate.id === id);
  if (family === undefined) return null;
  const states = family.states.filter((state) => state.annualFrequency > 0);
  return (
    <DialogShell label="Cutoff sweep" onClose={onClose} fit>
      <DialogHead cap="Cutoff sweep · ESQ-B2 · ESQ-B3 · ESQ-N-4" title={familyText(view, id)} onClose={onClose} />
      <div className="modal__body esq-dialog-body">
        <table className="postable postable--mid es-records" aria-label={`${id} sweep`}>
          <thead><tr><th scope="col">Cutoff</th><th scope="col">Cut sets</th><th scope="col">Frequency (/yr)</th><th scope="col">Change</th></tr></thead>
          <tbody>
            {family.sweep.map((point, index) => (
              <tr key={point.cutOff}>
                <td className="posmono">{point.cutOff === family.convergence.convergedAt ? `${sciText(point.cutOff)} · converged` : sciText(point.cutOff)}</td>
                <td className="posmono">{point.count}</td>
                <td className="posmono">{sciText(point.annualFrequency)}</td>
                <td className="posmono">{pctText(family.convergence.changes[index])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {states.length > 0 && (
          <table className="postable postable--mid es-records" aria-label={`${id} by operating state`}>
            <thead><tr><th scope="col">Operating state</th><th scope="col">Frequency (/yr)</th><th scope="col">Converged at</th><th scope="col">Last change</th></tr></thead>
            <tbody>
              {states.map((state) => (
                <tr key={state.stateId}>
                  <td>{state.name === state.stateId ? state.stateId : `${state.stateId} · ${state.name}`}</td>
                  <td className="posmono">{sciText(state.annualFrequency)}</td>
                  <td className="posmono">{convergedText(state.convergence)}</td>
                  <td className="posmono">{pctText(lastChange(state.convergence))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DialogShell>
  );
}

function FaultTreeDialog({ modelIds, eventIds, onClose }: { modelIds: readonly string[]; eventIds: readonly string[]; onClose: () => void }): JSX.Element {
  const { esq, upstream } = useEsqWorkbook();
  const fieldId = useId();
  const sy = upstream.sy;
  const logicModels = useMemo(() => (sy?.systemLogicModels ?? []).filter((model) => model.topGate !== null), [sy]);
  const [modelId, setModelId] = useState(() => modelIds[0] ?? logicModels[0]?.uuid ?? "");
  const [selection, setSelection] = useState<FaultTreeSelection>(() => selectionIn(logicModels.find((model) => model.uuid === modelId), eventIds));
  const table = useMemo(() => parameterTableOf(esq, missionTimeSourcesOf(esq, upstream)), [esq, upstream]);
  const points = useInputPoints(esq, table);
  const catalogue = useMemo(() => toFaultTreeEditorCatalogue(sy?.systemBasicEvents ?? []), [sy]);
  const values = useMemo(() => valueTexts(esq, points), [esq, points]);
  const logic = logicModels.find((model) => model.uuid === modelId);
  const choices = modelIds.length === 0 ? logicModels : logicModels.filter((model) => modelIds.includes(model.uuid) || model.uuid === modelId);
  const transferTargets = logicModels.flatMap((candidate) => (candidate.topGate === null || candidate.uuid === modelId
    ? []
    : [{ target: { modelId: candidate.uuid, entityId: candidate.topGate.gateId }, code: candidate.code, name: candidate.name, description: candidate.description }]));

  function choose(id: string): void {
    setModelId(id);
    setSelection(selectionIn(logicModels.find((model) => model.uuid === id), eventIds));
  }

  return (
    <DialogShell label="Fault trees" onClose={onClose} fit>
      <DialogHead cap="Fault tree · SY" title={logic === undefined ? "Fault tree" : `${logic.code} · ${logic.name}`} onClose={onClose} />
      <div className="modal__body">
        {choices.length > 1 && (
          <div className="es-records__bar">
            <div className="es-records__filters">
              <div className="es-records__filter">
                <label className="posfield__label" htmlFor={`${fieldId}-model`}>Fault tree</label>
                <select id={`${fieldId}-model`} className="posfield__select" value={modelId} onChange={(event) => choose(event.target.value)}>
                  {choices.map((model) => <option key={model.uuid} value={model.uuid}>{`${model.code} · ${model.name}`}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
        {logic !== undefined && (
          <div className="esq-solve-ft">
            <FaultTreeEditor
              key={logic.uuid}
              model={toFaultTreeEditorModel(logic)}
              catalogue={catalogue}
              readOnlyBasicEventValues={values}
              capabilities={READ_ONLY_TREE}
              selection={selection}
              validation={[]}
              saveState="saved"
              analysisResult={null}
              showResults={false}
              showHeaderStatus={false}
              resultIsStale={false}
              transferTargets={transferTargets}
              onOperation={() => undefined}
              onSelectionChange={setSelection}
              onOpenReference={(request) => { if (request.kind === "TRANSFER") choose(request.target.modelId); }}
              onRun={() => undefined}
            />
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function SolveDialogs({ context, onClose }: { context: EsqWindowContext; onClose: () => void }): JSX.Element | null {
  const { esq, upstream } = useEsqWorkbook();
  const view = solveViewOf(esq, upstream.es);
  if (view === undefined) return null;
  switch (context.kind) {
    case "esqSolveFamily": return <FamilyDialog id={context.id} view={view} onClose={onClose} />;
    case "esqSolveRun": return <RunDialog view={view} onClose={onClose} />;
    case "esqSolveCutSet": return <ReviewDialog reviewKey={context.id} onClose={onClose} />;
    default: return null;
  }
}

function EsqSolveTabs({ initialNetworkId = null, initialSourceWorkbookId = null }: { initialNetworkId?: string | null; initialSourceWorkbookId?: string | null }): JSX.Element {
  const { esq, upstream, runtime } = useEsqWorkbook();
  const view = useMemo(() => solveViewOf(esq, upstream.es), [esq, upstream.es]);
  const shownRun = useShownRun(view === undefined ? null : runtime.workbookId, view?.run?.runId);
  const composer = useComposer(shownRun, initialNetworkId, initialSourceWorkbookId);
  const [tab, setTab] = useState<SolveTab>("runs");
  const [dialog, setDialog] = useState<SolveDialog | null>(null);
  const [cutSetFilter, setCutSetFilter] = useState<CutSetFilter>({ familyId: "", sequenceKey: "" });

  function opens(finding: EsqSolveFinding): boolean {
    const target = finding.target;
    if (target === undefined || view === undefined) return false;
    switch (target.kind) {
      case "esqSolveFamily": return view.families.some((family) => family.id === target.id);
      case "esqSolveRun": return view.run !== undefined;
      case "esqSolveCutSet": return view.reviews.some((review) => review.key === target.id);
    }
  }

  function openFinding(finding: EsqSolveFinding): void {
    const target = finding.target;
    if (target === undefined) return;
    switch (target.kind) {
      case "esqSolveFamily": setDialog({ kind: "family", id: target.id }); return;
      case "esqSolveRun": setDialog({ kind: "run" }); return;
      case "esqSolveCutSet": setDialog({ kind: "review", key: target.id });
    }
  }

  function openFaultTree(modelIds: string[], eventIds: string[] = []): void {
    setDialog({ kind: "faultTree", modelIds, eventIds });
  }

  function renderPanel(): JSX.Element | null {
    if (view === undefined) return null;
    switch (tab) {
      case "runs": return <RunsPanel view={view} shownRun={shownRun} composer={composer} onRecord={() => setDialog({ kind: "run" })} />;
      case "trees": return <TreesPanel view={view} shownRun={shownRun} networks={composer.networks} onFaultTree={openFaultTree} />;
      case "families": return <FamiliesPanel view={view} onOpen={(id) => setDialog({ kind: "family", id })} />;
      case "sequences": return <SequencesPanel view={view} shownRun={shownRun} networks={composer.networks} onCutSets={(filter) => { setCutSetFilter(filter); setTab("cutsets"); }} />;
      case "cutsets": return <CutSetsPanel view={view} shownRun={shownRun} networks={composer.networks} filter={cutSetFilter} onFilter={setCutSetFilter} onReview={(key) => setDialog({ kind: "review", key })} onFaultTree={openFaultTree} />;
      case "convergence": return <ConvergencePanel view={view} shownRun={shownRun} networks={composer.networks} onSweep={(id) => setDialog({ kind: "sweep", id })} />;
      case "scenarios": return <EsqEventTreeHclWorkspace mode="RUNS" initialNetworkId={initialNetworkId} initialSourceWorkbookId={initialSourceWorkbookId} />;
      case "dynamic": return null;
      case "checks": return <ChecksPanel findings={view.findings} opens={opens} onOpen={openFinding} />;
    }
  }

  function renderDialog(): JSX.Element | null {
    if (dialog === null || view === undefined) return null;
    const close = (): void => setDialog(null);
    switch (dialog.kind) {
      case "family": return <FamilyDialog key={dialog.id} id={dialog.id} view={view} onClose={close} />;
      case "run": return <RunDialog view={view} onClose={close} />;
      case "review": return <ReviewDialog key={dialog.key} reviewKey={dialog.key} onClose={close} onFaultTree={openFaultTree} />;
      case "sweep": return <SweepDialog id={dialog.id} view={view} summary={shownRun.summary} onClose={close} />;
      case "faultTree": return <FaultTreeDialog key={dialog.modelIds.join(",")} modelIds={dialog.modelIds} eventIds={dialog.eventIds} onClose={close} />;
    }
  }

  return (
    <>
      <div className="poscard es-seq-card">
        <TabBar tabs={SOLVE_TABS} tab={tab} label="Solve sections" findings={view?.findings.length ?? 0} onTab={setTab} />
        <div className="es-seq-card__panel">{renderPanel()}</div>
      </div>
      {renderDialog()}
    </>
  );
}

export { EsqSolveTabs, SolveDialogs, SOLVE_WINDOW_KINDS, SOLVE_WINDOW_LABELS };
