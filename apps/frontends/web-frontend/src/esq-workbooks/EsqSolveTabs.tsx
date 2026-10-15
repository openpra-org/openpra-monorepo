import { Fragment, JSX, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { z } from "zod";
import type { EsqFamilySolve, EsqModel, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { esqSequenceRunId, esqTreeRunId, treesInScope } from "interfaces-mef-types/esq/esq-run-inputs";
import { esqModelRunId, solveInputsChange } from "interfaces-mef-types/esq/esq-solve-inputs";
import { esqEventReader } from "interfaces-mef-types/esq/esq-post-inputs";
import type { AnalysisRunMetadata } from "interfaces-shared-types/newly-developed-methods";
import {
  EventTreeAnalysisResultSchema,
  EventTreeCutOffBasisSchema,
  EventTreeCutSetQuantifierSchema,
  EventTreeSuccessTreatmentSchema,
  type EsqModelRunHcl,
  type EsqModelRunResult,
  type EsqModelRunSequence,
  type EsqModelRunTree,
  type EventTreeAnalysisResult,
  type EventTreeCutOffBasis,
  type EventTreeCutSetQuantifier,
  type EventTreeCutSetSettings,
  type EventTreeMonteCarloSettings,
  type EventTreeSuccessTreatment,
} from "interfaces-shared-types/newly-developed-methods/event-tree";
import { HclCalculationTypeSchema, type HclBatchInput, type HclCalculationType } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
import { cancelAnalysisRun } from "../newly-developed-methods/shared/analysisRunWait";
import { AnalysisJobs } from "../newly-developed-methods/shared/analysisJobs";
import { PagedResults } from "../newly-developed-methods/shared/resultPresentation";
import { jsonView, useWorkbookView } from "../workbooks/workbookViewMemory";
import { DialogHead, DialogShell } from "../es-workbooks/EsScope";
import { PAGE, Pager, TabBar, paged } from "../es-workbooks/EsTiming";
import { AreaField, ChecksPanel, NumberField, networkLabel, networkOptionsOf, sciText, treeLabel, type EsqWindowContext, type NetworkOption } from "./esqShared";
import { useEsqWorkbook } from "./esqWorkbookContext";
import { MODEL_AS_SET, runLogicText } from "./esqLogic";
import { END_STATE_LABELS } from "./esqViewData";
import { cutSetKey, cutSetRows, thresholdsOf, type EsqCutSetRow } from "./esqResults";
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
  summaryStale,
  withRunChange,
  treesCovered,
  withFamilySolve,
  withRareEventReason,
  withRunOfRecord,
  type EsqConvergence,
  type EsqSolveFinding,
  type EsqSolveView,
  type EsqSolveWindowKind,
} from "./esqSolve";
import { getEsqModelRunResult, getEsqRunDetails, getEsqRunWorkbook, listEsqModelRuns, runEsqModel, type EsqModelRunEntry } from "./esqWorkbookApi";
import { EsqDependencies, studyConfiguration, studyTree, type DependencyEvidence, type DependencyStudy, type DependencyStudyTree } from "./EsqDependencies";
import "../es-workbooks/css/esSequences.css";
import "../sy-workbooks/css/syFaultTreeAnalysis.css";
import "./css/esqSolveTabs.css";

type SolveTab = "runs" | "families" | "convergence" | "dynamic" | "checks";

type ResultOrder = "TREE" | "HIGH" | "LOW";

type ResultGroup = "NONE" | "FAMILY" | "RELEASE";

type RunChoice = "EXACT" | "CUT_SETS" | "HCL";

type RunWorkflow = "MANUAL" | "BATCH";

type ProbabilityAlgorithm = "BDD" | "MONTE_CARLO";

type CutSetDialog =
  | { kind: "sequenceCutSets"; sequenceKey: string }
  | { kind: "familyCutSets"; familyId: string; treeId: string | null };

type SolveDialog =
  | CutSetDialog
  | { kind: "family"; id: string }
  | { kind: "run" }
  | { kind: "sweep"; id: string };

interface ComposerSettings {
  choice: RunChoice;
  workflow: RunWorkflow;
  treeId: string;
  batchTreeIds: string[] | null;
  network: string;
  algorithm: ProbabilityAlgorithm;
  treatment: EventTreeSuccessTreatment;
  cutSetTreatment: EventTreeSuccessTreatment;
  expandCcf: boolean;
  basis: EventTreeCutOffBasis;
  quantifier: EventTreeCutSetQuantifier;
  highest: number;
  lowest: number;
  keep: number;
  limitOrder?: number;
  trials: number;
  seed: number;
  earlyStop: boolean;
  convergenceDelta: number;
  confidenceLevel: number;
  burnInTrials: number;
  dependencyResult: HclCalculationType;
  dependencyEvidence: DependencyEvidence;
}

interface TreeOption {
  id: string;
  label: string;
}

interface Composer {
  settings: ComposerSettings;
  set: (patch: Partial<ComposerSettings>) => void;
  clearLimit: () => void;
  networks: NetworkOption[];
  roots: TreeOption[];
  manualTreeId: string | undefined;
  treeIds: string[];
  toggleTree: (treeId: string) => void;
  running: boolean;
  live: AnalysisRunMetadata | null;
  error: string | null;
  problem?: string;
  ready: boolean;
  run: () => void;
  stop: (runId: string) => void;
  network: NetworkOption | undefined;
  batchInput: HclBatchInput | null;
  setBatchInput: (input: HclBatchInput | null) => void;
  study: DependencyStudy | null;
  studyTotal: number;
}

interface ShownRun {
  runs: EsqModelRunEntry[];
  shown?: EsqModelRunEntry;
  summary?: EsqModelRunResult;
  error?: string;
  listError?: string;
  problem?: string;
  blocked?: boolean;
  show: (runId: string) => void;
  reload: () => void;
}

interface TreeFailure {
  treeId: string;
  failure: string;
}

const SOLVE_TABS: { id: SolveTab; label: string; disabled?: boolean }[] = [
  { id: "runs", label: "Runs" },
  { id: "families", label: "Family values" },
  { id: "convergence", label: "Convergence" },
  { id: "dynamic", label: "Dynamic", disabled: true },
  { id: "checks", label: "Checks" },
];

const SOLVE_WINDOW_KINDS: ReadonlySet<string> = new Set<EsqSolveWindowKind>(["esqSolveFamily", "esqSolveRun"]);

const SOLVE_WINDOW_LABELS: Record<EsqSolveWindowKind, string> = { esqSolveFamily: "Family value", esqSolveRun: "Run of record" };

const RUN_CHOICES: readonly (readonly [RunChoice, string])[] = [["EXACT", "Probability"], ["CUT_SETS", "Cut sets"], ["HCL", "Dependencies"]];

const RUN_WORDS: Record<RunChoice, string> = { EXACT: "probability", CUT_SETS: "cut sets", HCL: "dependencies" };

const DEPENDENCY_RESULTS: readonly (readonly [HclCalculationType, string])[] = [["PROBABILITY", "Probability"], ["UNCERTAINTY", "Uncertainty"]];

const DEPENDENCY_EVIDENCE: readonly (readonly [DependencyEvidence, string])[] = [["BASE", "Base evidence"], ["SCENARIOS", "Evidence scenarios"], ["HAZARD", "Hazard convolution"]];

const WORKFLOWS: readonly (readonly [RunWorkflow, string])[] = [["MANUAL", "Manual"], ["BATCH", "Batch"]];

const ALGORITHM_OPTIONS: readonly (readonly [ProbabilityAlgorithm, string])[] = [["BDD", "Direct BDD"], ["MONTE_CARLO", "Direct Monte Carlo"]];

const CUT_SET_ALGORITHM = "BDD-to-ZBDD";

const TREATMENT_OPTIONS: readonly (readonly [EventTreeSuccessTreatment, string])[] = [["COMPLEMENT", "Complement"], ["DELETE_TERM", "Delete term"], ["UNITY", "Unity"]];

const BASIS_OPTIONS: readonly (readonly [EventTreeCutOffBasis, string])[] = [["FREQUENCY", "Frequency per year"], ["PROBABILITY", "Probability"]];

const QUANTIFIER_OPTIONS: readonly (readonly [EventTreeCutSetQuantifier, string])[] = [["MCUB", "Upper bound"], ["EXACT", "Exact"], ["RARE_EVENT", "Rare event"]];

const HIGHEST_EXPONENTS = [-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12];

const LOWEST_EXPONENTS = [-4, -5, -6, -7, -8, -9, -10, -11, -12, -13, -14, -15, -16, -17, -18, -19, -20];

const START_SETTINGS: ComposerSettings = {
  choice: "CUT_SETS",
  workflow: "BATCH",
  treeId: "",
  batchTreeIds: null,
  network: "",
  algorithm: "BDD",
  treatment: "COMPLEMENT",
  cutSetTreatment: "DELETE_TERM",
  expandCcf: MODEL_AS_SET.expandCcf,
  basis: "FREQUENCY",
  quantifier: "MCUB",
  highest: -6,
  lowest: -14,
  keep: 100,
  trials: 10_000,
  seed: 847,
  earlyStop: false,
  convergenceDelta: 0.1,
  confidenceLevel: 0.95,
  burnInTrials: 0,
  dependencyResult: "PROBABILITY",
  dependencyEvidence: "BASE",
};

const COMPOSER_VIEW = jsonView<ComposerSettings>(z.object({
  choice: z.enum(["EXACT", "CUT_SETS", "HCL"]),
  workflow: z.enum(["MANUAL", "BATCH"]),
  treeId: z.string(),
  batchTreeIds: z.array(z.string()).nullable(),
  network: z.string(),
  algorithm: z.enum(["BDD", "MONTE_CARLO"]).default(START_SETTINGS.algorithm),
  treatment: EventTreeSuccessTreatmentSchema.default(START_SETTINGS.treatment),
  cutSetTreatment: EventTreeSuccessTreatmentSchema.default(START_SETTINGS.cutSetTreatment),
  expandCcf: z.boolean(),
  basis: EventTreeCutOffBasisSchema,
  quantifier: EventTreeCutSetQuantifierSchema,
  highest: z.number(),
  lowest: z.number(),
  keep: z.number(),
  limitOrder: z.number().int().positive().optional(),
  trials: z.number().default(START_SETTINGS.trials),
  seed: z.number().default(START_SETTINGS.seed),
  earlyStop: z.boolean().default(START_SETTINGS.earlyStop),
  convergenceDelta: z.number().default(START_SETTINGS.convergenceDelta),
  confidenceLevel: z.number().default(START_SETTINGS.confidenceLevel),
  burnInTrials: z.number().default(START_SETTINGS.burnInTrials),
  dependencyResult: HclCalculationTypeSchema.default(START_SETTINGS.dependencyResult),
  dependencyEvidence: z.enum(["BASE", "SCENARIOS", "HAZARD"]).default(START_SETTINGS.dependencyEvidence),
}));

const SOLVE_TAB_VIEW = jsonView<SolveTab>(z.enum(["runs", "families", "convergence", "dynamic", "checks"]));

const RUN_TABS: ReadonlySet<SolveTab> = new Set<SolveTab>(["runs", "families", "convergence"]);

interface ResultSettings {
  treeId: string;
  order: ResultOrder;
  group: ResultGroup;
}

interface ResultRow {
  sequence: EsqModelRunSequence;
  position: number;
}

interface ResultGroupRow {
  key: string;
  label: string;
  frequency: number;
  position: number;
  rows: ResultRow[];
}

const RESULT_ORDERS: readonly (readonly [ResultOrder, string])[] = [["TREE", "Tree order"], ["HIGH", "Frequency high to low"], ["LOW", "Frequency low to high"]];

const RESULT_GROUPS: readonly (readonly [ResultGroup, string])[] = [["NONE", "None"], ["FAMILY", "Family"], ["RELEASE", "Release category"]];

const START_RESULTS: ResultSettings = { treeId: "", order: "TREE", group: "NONE" };

const RESULTS_VIEW = jsonView<ResultSettings>(z.object({
  treeId: z.string(),
  order: z.enum(["TREE", "HIGH", "LOW"]),
  group: z.enum(["NONE", "FAMILY", "RELEASE"]),
}));

const STATUS_TEXT: Record<string, string> = { QUEUED: "queued until it starts", RUNNING: "running", FAILED: "failed", CANCELLED: "cancelled" };

const LIST_POLL_MS = 3000;

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

function childEntryOf(result: EventTreeAnalysisResult | undefined, model: EsqModel, sequence: EsqModelRunSequence): EventTreeAnalysisResult["sequences"][number] | undefined {
  if (result === undefined) return undefined;
  const treeOf = new Map(model.sequences.map((record) => [record.id, record.treeId]));
  const chain = sequence.sequenceIds.map((id) => esqSequenceRunId(treeOf.get(id) ?? sequence.treeId, id));
  return result.sequences.find((entry) => {
    const ids = entry.sequenceChain === undefined ? [entry.sequenceId] : entry.sequenceChain.map((link) => link.entityId);
    return ids.length === chain.length && ids.every((id, index) => id === chain[index]);
  });
}

function scopedCutSetRows(input: {
  items: readonly { basicEventIds: string[]; annualFrequency: number }[];
  familyId: string;
  treeId: string;
  total: number;
  familyValue: number;
  familyRows: readonly EsqCutSetRow[];
  individualPercent: number;
  codeOf: (id: string) => string;
}): EsqCutSetRow[] {
  const significant = new Map(input.familyRows.map((row) => [row.key, row.significant]));
  let running = 0;
  return input.items.map((item) => {
    const share = input.total > 0 ? item.annualFrequency / input.total : 0;
    running += share;
    const key = cutSetKey(input.familyId, input.treeId, item.basicEventIds);
    return {
      key,
      familyId: input.familyId,
      treeId: input.treeId,
      eventIds: [...item.basicEventIds],
      codes: item.basicEventIds.map(input.codeOf),
      annualFrequency: item.annualFrequency,
      share,
      cumulative: running,
      significant: significant.get(key) ?? (input.familyValue > 0 && (100 * item.annualFrequency) / input.familyValue >= input.individualPercent),
    };
  });
}

function cutSetTreeOf(dialog: CutSetDialog | undefined, summary: EsqModelRunResult | undefined): string | undefined {
  if (dialog === undefined) return undefined;
  if (dialog.kind === "familyCutSets") return dialog.treeId ?? undefined;
  return summary?.sequences.find((sequence) => sequenceKeyOf(sequence) === dialog.sequenceKey)?.treeId;
}

function isCutSetDialog(dialog: SolveDialog): dialog is CutSetDialog {
  return dialog.kind === "sequenceCutSets" || dialog.kind === "familyCutSets";
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
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

function useComposer(model: EsqModel | undefined, shownRun: ShownRun, initialNetworkId: string | null, initialSourceWorkbookId: string | null): Composer {
  const { esq, upstream, runtime } = useEsqWorkbook();
  const networks = useMemo(() => networkOptionsOf(esq, upstream.es, upstream.sy), [esq, upstream.es, upstream.sy]);
  const roots = useMemo(() => (model === undefined ? [] : treesInScope(esq, model)
    .filter((tree) => !tree.transferEntry)
    .map((tree) => ({ id: tree.id, label: treeLabel(model, tree.id) }))), [esq, model]);
  const [settings, setSettings] = useWorkbookView<ComposerSettings>("solve.composer", START_SETTINGS, COMPOSER_VIEW);
  const [linked, setLinked] = useState(initialNetworkId === null);
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<AnalysisRunMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchInput, setBatchInput] = useState<HclBatchInput | null>(null);
  const [study, setStudy] = useState<DependencyStudy | null>(null);
  const [studyTotal, setStudyTotal] = useState(0);
  const { show, reload } = shownRun;

  useEffect(() => {
    if (linked) return;
    const match = networks.find((option) => option.configuration.bayesianNetwork.modelId === initialNetworkId && (initialSourceWorkbookId === null || option.workbookId === initialSourceWorkbookId));
    if (match === undefined) return;
    setSettings((current) => ({ ...current, choice: "HCL", network: match.key, expandCcf: false }));
    setLinked(true);
  }, [initialNetworkId, initialSourceWorkbookId, linked, networks, setSettings]);

  const network = networks.find((option) => option.key === settings.network) ?? networks[0];
  const networkKey = network?.key;
  useEffect(() => {
    setBatchInput(null);
  }, [networkKey]);
  const rootIds = roots.map((tree) => tree.id);
  const manualTreeId = roots.find((tree) => tree.id === settings.treeId)?.id ?? roots[0]?.id;
  const chosen = settings.batchTreeIds;
  const batchTreeIds = chosen === null ? rootIds : rootIds.filter((treeId) => chosen.includes(treeId));
  const treeIds = settings.workflow === "MANUAL" ? (manualTreeId === undefined ? [] : [manualTreeId]) : batchTreeIds;
  const everyTree = treeIds.length === rootIds.length;
  const monteCarloRun = settings.choice === "EXACT" && settings.algorithm === "MONTE_CARLO";
  const dependencyStudy = settings.choice === "HCL" && (settings.dependencyResult === "UNCERTAINTY" || settings.dependencyEvidence !== "BASE");
  const studied = network === undefined ? undefined : studyConfiguration(network.configuration, batchInput);
  const scenarioIds = (studied?.evidenceScenarios ?? []).filter((scenario) => scenario.enabled).map((scenario) => scenario.id);
  const problem = settings.choice === "HCL"
    ? network === undefined ? "The linked ES and SY workbooks hold no dependency configuration."
      : settings.dependencyResult === "UNCERTAINTY" && network.configuration.solverSettings.uncertainty === undefined ? "This dependency configuration has no uncertainty settings. Turn them on in the Dependencies step of its ES or SY workbook."
      : settings.dependencyEvidence === "HAZARD" && settings.dependencyResult === "UNCERTAINTY" ? "Hazard convolution gives a probability only. Pick Probability as the result."
      : settings.dependencyEvidence !== "BASE" && scenarioIds.length === 0 ? "This dependency configuration has no enabled evidence scenario. Upload or generate scenarios under the network."
      : settings.dependencyEvidence === "HAZARD" && studied?.hazardGrid === undefined ? "This dependency configuration has no hazard grid. Generate scenarios under the network to make one."
      : undefined
    : settings.choice === "CUT_SETS"
      ? settings.lowest >= settings.highest ? "The lowest cutoff must be below the highest."
        : !(settings.keep >= 1 && settings.keep <= 1000) ? "Keep between 1 and 1000 cut sets."
        : undefined
    : !monteCarloRun ? undefined
    : !(Number.isInteger(settings.trials) && settings.trials >= 1) ? "Run at least one trial."
    : !(Number.isInteger(settings.seed) && settings.seed >= 0) ? "The seed is a whole number of at least 0."
    : !settings.earlyStop ? undefined
    : !(Number.isFinite(settings.convergenceDelta) && settings.convergenceDelta > 0) ? "The relative error target must be above 0."
    : !(settings.confidenceLevel > 0 && settings.confidenceLevel < 1) ? "The confidence must be between 0 and 1."
    : !(Number.isInteger(settings.burnInTrials) && settings.burnInTrials >= 0) ? "The burn-in trials are a whole number of at least 0."
    : undefined;
  const ready = problem === undefined && treeIds.length > 0;

  function runStudy(): void {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null || network === undefined || !ready || running) return;
    const option = network;
    const result = settings.dependencyResult;
    const evidence = settings.dependencyEvidence;
    const trees = [...treeIds];
    const order = new Map(trees.map((treeId, index) => [treeId, index]));
    setRunning(true);
    setError(null);
    setStudy({ result, evidence, trees: [] });
    setStudyTotal(trees.length);
    Promise.all(trees.map((treeId) => studyTree({ workbookId, revision, option, treeId, result, evidence, scenarioIds: [...scenarioIds], batchInput })
      .catch((caught: Error): DependencyStudyTree => ({ treeId, runResult: null, batchRunResult: null, failure: caught.message }))
      .then((outcome) => {
        setStudy((current) => (current === null ? current : {
          ...current,
          trees: [...current.trees, outcome].sort((left, right) => (order.get(left.treeId) ?? 0) - (order.get(right.treeId) ?? 0)),
        }));
      })))
      .finally(() => {
        setRunning(false);
        setStudyTotal(0);
      });
  }

  function run(): void {
    if (dependencyStudy) {
      runStudy();
      return;
    }
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null || !ready || running) return;
    const hcl: EsqModelRunHcl | undefined = settings.choice === "HCL" && network !== undefined ? { workbookId: network.workbookId, modelId: network.configuration.modelId } : undefined;
    const cutSets: EventTreeCutSetSettings | undefined = settings.choice === "CUT_SETS"
      ? { basis: settings.basis, cutOffs: cutOffsFrom(settings.highest, settings.lowest), quantifier: settings.quantifier, keep: settings.keep, ...(settings.limitOrder === undefined ? {} : { limitOrder: settings.limitOrder }) }
      : undefined;
    const monteCarlo: EventTreeMonteCarloSettings | undefined = monteCarloRun
      ? {
        trials: settings.trials,
        seed: settings.seed,
        earlyStop: settings.earlyStop,
        convergenceDelta: settings.convergenceDelta,
        confidenceLevel: settings.confidenceLevel,
        burnInTrials: settings.burnInTrials,
      }
      : undefined;
    const successTreatment: EventTreeSuccessTreatment | undefined = settings.choice === "HCL" || monteCarloRun ? undefined
      : settings.choice === "CUT_SETS" ? settings.cutSetTreatment
      : settings.treatment;
    setRunning(true);
    setLive(null);
    setError(null);
    let announced = false;
    runEsqModel(workbookId, revision, { ...MODEL_AS_SET, expandCcf: settings.choice === "HCL" ? false : settings.expandCcf }, settings.choice === "CUT_SETS" ? "CUT_SETS" : "EXACT", cutSets, hcl, (progress) => {
      setLive(progress);
      if (announced) return;
      announced = true;
      show(progress.id);
      reload();
    }, everyTree ? undefined : treeIds, {
      ...(successTreatment === undefined ? {} : { successTreatment }),
      ...(monteCarlo === undefined ? {} : { monteCarlo }),
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
    roots,
    manualTreeId,
    treeIds,
    toggleTree: (treeId) => setSettings((current) => {
      const base = current.batchTreeIds ?? rootIds;
      return { ...current, batchTreeIds: base.includes(treeId) ? base.filter((id) => id !== treeId) : [...base, treeId] };
    }),
    running,
    live,
    error,
    ready,
    run,
    stop,
    network,
    batchInput,
    setBatchInput,
    study,
    studyTotal,
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

function useRunWorkbooks(workbookId: string | null, runIds: readonly (string | undefined)[]): ReadonlyMap<string, EventSequenceQuantification> {
  const [saved, setSaved] = useState<ReadonlyMap<string, EventSequenceQuantification>>(new Map());
  const requested = useRef(new Set<string>());
  const wanted = [...new Set(runIds.flatMap((runId) => (runId === undefined ? [] : [runId])))].sort().join(",");
  useEffect(() => {
    if (workbookId === null || wanted.length === 0) return;
    for (const runId of wanted.split(",")) {
      if (requested.current.has(runId)) continue;
      requested.current.add(runId);
      getEsqRunWorkbook(workbookId, runId)
        .then((mef) => setSaved((current) => new Map(current).set(runId, mef)))
        .catch(() => { requested.current.delete(runId); });
    }
  }, [workbookId, wanted]);
  return saved;
}

function optionOf<T extends string>(options: readonly (readonly [T, string])[], value: string): T | undefined {
  return options.find(([option]) => option === value)?.[0];
}

function RunHead({ view, shownRun, onRecord }: { view: EsqSolveView; shownRun: ShownRun; onRecord: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const id = useId();
  const { runs, shown, summary } = shownRun;
  const recordId = view.run?.runId;
  if (shown === undefined && view.run === undefined) return null;
  const recorded = summary !== undefined && recordId === summary.runId;
  const coverage = summary === undefined ? undefined : treesCovered(summary, esq);
  const partial = coverage !== undefined && coverage.covered < coverage.total;
  return (
    <div className="poscard__head es-seq-card__head">
      <div className="es-seq-card__picker">
        {shown !== undefined && <label className="posfield__label" htmlFor={id}>Run</label>}
        <div className="es-seq-card__pick-row">
          {shown !== undefined && (
            <select id={id} className="posfield__select" value={shown.id} onChange={(event) => shownRun.show(event.target.value)}>
              {runs.map((run) => <option key={run.id} value={run.id}>{`${runLabel(run)}${run.id === recordId ? " · of record" : ""}`}</option>)}
            </select>
          )}
          {view.run !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={onRecord}>Run of record</button>}
          {editable && summary !== undefined && (
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={recorded || shownRun.blocked === true || partial} title={shownRun.problem} onClick={() => mutateEsq((draft) => withRunOfRecord(draft, summary))}>{recorded ? "Values of record" : "Use as values of record"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function FailedTreeTable({ rows, model }: { rows: readonly TreeFailure[]; model: EsqModel }): JSX.Element | null {
  if (rows.length === 0) return null;
  return (
    <table className="postable postable--mid es-records esq-results" aria-label="Failed event trees">
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
  if (current !== undefined && (current.status === "QUEUED" || current.status === "RUNNING")) return null;
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

function ShownCaption({ shownRun, model }: { shownRun: ShownRun; model: EsqModel }): JSX.Element | null {
  return shownRun.summary === undefined ? <ShownRunState shownRun={shownRun} model={model} /> : null;
}

function RunsPanel({ view, shownRun, composer, onCutSets }: { view: EsqSolveView; shownRun: ShownRun; composer: Composer; onCutSets: (dialog: CutSetDialog) => void }): JSX.Element {
  const { editable, runtime } = useEsqWorkbook();
  const fieldId = useId();
  const { settings, set } = composer;
  const blocked = analysisSaveBlock(runtime);
  const batch = settings.workflow === "BATCH";
  const network = composer.network;
  const dependencies = settings.choice === "HCL";
  const shown = shownRun.shown;
  const activeId = composer.live !== null && (composer.live.status === "QUEUED" || composer.live.status === "RUNNING") ? composer.live.id
    : shown !== undefined && (shown.status === "QUEUED" || shown.status === "RUNNING") ? shown.id
    : undefined;

  function jobLabel(modelId: string): string | undefined {
    if (modelId === esqModelRunId()) return "Event trees";
    const configuration = composer.networks.find((option) => option.configuration.modelId === modelId);
    if (configuration !== undefined) return `Dependencies · ${networkLabel(configuration)}`;
    const tree = view.model.trees.find((candidate) => esqTreeRunId(candidate.id) === modelId);
    return tree === undefined ? undefined : treeLabel(view.model, tree.id);
  }

  return (
    <section className="syft-analysis" aria-label="Event tree quantification">
      <div className="syft-analysis__heading">
        <h3>Event tree quantification</h3>
        <AnalysisJobs host="esq" workbookId={runtime.workbookId} modelLabel={jobLabel} />
      </div>
      <div className={`syft-analysis__composer syft-analysis__composer--${settings.workflow.toLowerCase()} esq-composer`} aria-label="Event tree quantification controls">
        <div className="syft-analysis__run-composer">
          {batch ? (
            <>
              <fieldset className="syft-analysis__batch-models">
                <legend>Event trees</legend>
                {composer.roots.map((tree) => (
                  <label key={tree.id}>
                    <input type="checkbox" checked={composer.treeIds.includes(tree.id)} onChange={() => composer.toggleTree(tree.id)} />
                    <span>{tree.label}</span>
                  </label>
                ))}
              </fieldset>
              <span className="syft-analysis__selection-summary">{`${plural(composer.treeIds.length, "event tree", "event trees")} selected`}</span>
            </>
          ) : (
            <div className="syft-analysis__run-fields">
              <label className="syft-analysis__run-field">
                <span>Event tree</span>
                <select aria-label="Event tree" value={composer.manualTreeId ?? ""} disabled={composer.roots.length === 0} onChange={(event) => set({ treeId: event.target.value })}>
                  {composer.roots.map((tree) => <option key={tree.id} value={tree.id}>{tree.label}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>

        <fieldset className="syft-analysis__calculation-picker">
          <legend>Calculation</legend>
          <div role="radiogroup" aria-label="Event tree calculation">
            {RUN_CHOICES.map(([value, label]) => (
              <label key={value} className={settings.choice === value ? "is-selected" : ""}>
                <input type="radio" name={`${fieldId}-calculation`} value={value} checked={settings.choice === value} onChange={() => set({ choice: value })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="syft-analysis__workflow-picker">
          <legend>Workflow</legend>
          <div role="radiogroup" aria-label="Event tree workflow">
            {WORKFLOWS.map(([value, label]) => (
              <label key={value} className={settings.workflow === value ? "is-selected" : ""}>
                <input type="radio" name={`${fieldId}-workflow`} value={value} checked={settings.workflow === value} onChange={() => set({ workflow: value })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="syft-analysis__run-composer">
          <div className="syft-analysis__execution-row">
            <div className="syft-analysis__run-fields">
              {settings.choice === "EXACT" && (
                <label className="syft-analysis__run-field">
                  <span>Algorithm</span>
                  <select aria-label="Event tree algorithm" value={settings.algorithm} onChange={(event) => {
                    const algorithm = optionOf(ALGORITHM_OPTIONS, event.target.value);
                    if (algorithm !== undefined) set({ algorithm });
                  }}>
                    {ALGORITHM_OPTIONS.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
                  </select>
                </label>
              )}
              {settings.choice === "CUT_SETS" && (
                <label className="syft-analysis__run-field">
                  <span>Algorithm</span>
                  <select aria-label="Event tree algorithm" defaultValue={CUT_SET_ALGORITHM}>
                    <option value={CUT_SET_ALGORITHM}>{CUT_SET_ALGORITHM}</option>
                  </select>
                </label>
              )}
              {dependencies && (
                <label className="syft-analysis__run-field">
                  <span>Dependency configuration</span>
                  <select aria-label="Dependency configuration" value={network?.key ?? ""} disabled={composer.networks.length === 0} onChange={(event) => set({ network: event.target.value })}>
                    {composer.networks.map((option) => <option key={option.key} value={option.key}>{networkLabel(option)}</option>)}
                  </select>
                </label>
              )}
            </div>
            {editable && (
              <div className="esq-run-actions">
                {activeId !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => composer.stop(activeId)}>Stop</button>}
                <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={composer.running || blocked !== null || !composer.ready} onClick={composer.run}>
                  {composer.running ? "Running…" : `Run ${RUN_WORDS[settings.choice]}${batch ? " batch" : ""}`}
                </button>
              </div>
            )}
          </div>

          <div className="syft-analysis__advanced-panel" aria-label="Event tree quantification settings">
            <div className="syft-analysis__advanced">
              {settings.choice === "EXACT" && settings.algorithm === "BDD" && (
                <label>
                  <span>Success treatment</span>
                  <select aria-label="Success treatment" value={settings.treatment} onChange={(event) => {
                    const treatment = optionOf(TREATMENT_OPTIONS, event.target.value);
                    if (treatment !== undefined) set({ treatment });
                  }}>
                    {TREATMENT_OPTIONS.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
                  </select>
                </label>
              )}
              {settings.choice === "EXACT" && settings.algorithm === "MONTE_CARLO" && (
                <>
                  <label><span>Trials</span><input aria-label="Event tree trials" type="number" min={1} step={1} aria-invalid={!(Number.isInteger(settings.trials) && settings.trials >= 1)} value={settings.trials} onChange={(event) => set({ trials: Number(event.target.value) })} /></label>
                  <label><span>Seed</span><input aria-label="Event tree seed" type="number" min={0} step={1} aria-invalid={!(Number.isInteger(settings.seed) && settings.seed >= 0)} value={settings.seed} onChange={(event) => set({ seed: Number(event.target.value) })} /></label>
                  <label className="syft-analysis__check"><input type="checkbox" checked={settings.earlyStop} onChange={(event) => set({ earlyStop: event.target.checked })} /><span>Stop when converged</span></label>
                  {settings.earlyStop && (
                    <>
                      <label><span>Relative error target</span><input aria-label="Monte Carlo convergence delta" type="number" min="0.000001" step="any" value={settings.convergenceDelta} onChange={(event) => set({ convergenceDelta: Number(event.target.value) })} /></label>
                      <label><span>Confidence</span><input aria-label="Monte Carlo confidence" type="number" min="0.01" max="0.999999" step="any" value={settings.confidenceLevel} onChange={(event) => set({ confidenceLevel: Number(event.target.value) })} /></label>
                      <label><span>Burn-in trials</span><input aria-label="Monte Carlo burn-in trials" type="number" min={0} step={1} value={settings.burnInTrials} onChange={(event) => set({ burnInTrials: Number(event.target.value) })} /></label>
                    </>
                  )}
                </>
              )}
              {settings.choice === "CUT_SETS" && (
                <>
                  <label>
                    <span>Success treatment</span>
                    <select aria-label="Success treatment" value={settings.cutSetTreatment} onChange={(event) => {
                      const cutSetTreatment = optionOf(TREATMENT_OPTIONS, event.target.value);
                      if (cutSetTreatment !== undefined) set({ cutSetTreatment });
                    }}>
                      {TREATMENT_OPTIONS.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Probability method</span>
                    <select aria-label="Probability method" value={settings.quantifier} onChange={(event) => {
                      const quantifier = optionOf(QUANTIFIER_OPTIONS, event.target.value);
                      if (quantifier !== undefined) set({ quantifier });
                    }}>
                      {QUANTIFIER_OPTIONS.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Cutoff on</span>
                    <select aria-label="Cutoff on" value={settings.basis} onChange={(event) => {
                      const basis = optionOf(BASIS_OPTIONS, event.target.value);
                      if (basis !== undefined) set({ basis });
                    }}>
                      {BASIS_OPTIONS.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Highest cutoff</span>
                    <select aria-label="Highest cutoff" value={settings.highest} onChange={(event) => set({ highest: Number(event.target.value) })}>
                      {HIGHEST_EXPONENTS.map((exponent) => <option key={exponent} value={exponent}>{decadeText(exponent)}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Lowest cutoff</span>
                    <select aria-label="Lowest cutoff" value={settings.lowest} onChange={(event) => set({ lowest: Number(event.target.value) })}>
                      {LOWEST_EXPONENTS.map((exponent) => <option key={exponent} value={exponent}>{decadeText(exponent)}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Cut sets kept</span>
                    <input aria-label="Cut sets kept" type="number" min={1} max={1000} step={1} aria-invalid={!(settings.keep >= 1 && settings.keep <= 1000)} value={settings.keep} onChange={(event) => set({ keep: Math.round(Number(event.target.value)) })} />
                  </label>
                  <label>
                    <span>Maximum cut set order</span>
                    <input aria-label="Maximum cut set order" type="number" min={1} step={1} placeholder="No limit" value={settings.limitOrder ?? ""} onChange={(event) => {
                      const value = Math.round(Number(event.target.value));
                      if (event.target.value.trim().length === 0 || !(value >= 1)) composer.clearLimit();
                      else set({ limitOrder: value });
                    }} />
                  </label>
                </>
              )}
              {dependencies && (
                <>
                  <label>
                    <span>Result</span>
                    <select aria-label="Dependency result" value={settings.dependencyResult} onChange={(event) => {
                      const dependencyResult = optionOf(DEPENDENCY_RESULTS, event.target.value);
                      if (dependencyResult !== undefined) set({ dependencyResult });
                    }}>
                      {DEPENDENCY_RESULTS.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Evidence</span>
                    <select aria-label="Dependency evidence" value={settings.dependencyEvidence} onChange={(event) => {
                      const dependencyEvidence = optionOf(DEPENDENCY_EVIDENCE, event.target.value);
                      if (dependencyEvidence !== undefined) set({ dependencyEvidence });
                    }}>
                      {DEPENDENCY_EVIDENCE.map(([option, text]) => <option key={option} value={option} disabled={option === "HAZARD" && settings.dependencyResult === "UNCERTAINTY"}>{text}</option>)}
                    </select>
                  </label>
                </>
              )}
              {!dependencies && <label className="syft-analysis__check"><input type="checkbox" checked={settings.expandCcf} onChange={(event) => set({ expandCcf: event.target.checked })} /><span>Expand common-cause groups</span></label>}
            </div>
          </div>
        </div>
        {dependencies && network !== undefined && (
          <EsqDependencies
            option={network}
            evidence={settings.dependencyEvidence}
            result={settings.dependencyResult}
            batchInput={composer.batchInput}
            study={composer.study}
            running={composer.running}
            onBatchInput={composer.setBatchInput}
          />
        )}
      </div>
      {blocked !== null && <p className="syft-analysis__notice" role="status">{blocked}</p>}
      {composer.running && composer.live === null && composer.studyTotal === 0 && <p className="syft-analysis__notice" role="status">Building the event trees for PRAXIS</p>}
      {composer.problem !== undefined && <p className="syft-analysis__error" role="alert">{composer.problem}</p>}
      {composer.error !== null && <p className="syft-analysis__error" role="alert">{composer.error}</p>}
      <ModelRunsBody view={view} shownRun={shownRun} composer={composer} onCutSets={onCutSets} />
    </section>
  );
}

function ordered<T extends { position: number }>(items: readonly T[], order: ResultOrder, frequency: (item: T) => number): T[] {
  const rank = (left: T, right: T): number => (order === "HIGH" ? frequency(right) - frequency(left) : order === "LOW" ? frequency(left) - frequency(right) : 0);
  return [...items].sort((left, right) => rank(left, right) || left.position - right.position);
}

function rowsTotal(rows: readonly ResultRow[]): number {
  return rows.reduce((total, row) => total + row.sequence.annualFrequency, 0);
}

function familyValueIn(tree: EsqModelRunTree, familyId: string, rows: readonly ResultRow[]): number {
  return tree.families?.find((entry) => entry.familyId === familyId)?.annualFrequency ?? rowsTotal(rows);
}

function releaseCategoryOf(view: EsqSolveView, sequence: EsqModelRunSequence): string | undefined {
  if (sequence.familyId !== null) return view.families.find((candidate) => candidate.id === sequence.familyId)?.family.releaseCategoryId;
  const last = sequence.sequenceIds[sequence.sequenceIds.length - 1];
  return view.model.sequences.find((record) => record.id === last)?.releaseCategoryId;
}

function groupValue(tree: EsqModelRunTree, rows: readonly ResultRow[]): number {
  const byFamily = new Map<string, ResultRow[]>();
  let loose = 0;
  for (const row of rows) {
    const familyId = row.sequence.familyId;
    if (familyId === null) loose += row.sequence.annualFrequency;
    else byFamily.set(familyId, [...(byFamily.get(familyId) ?? []), row]);
  }
  return [...byFamily.entries()].reduce((total, [familyId, members]) => total + familyValueIn(tree, familyId, members), loose);
}

function groupsOf(rows: readonly ResultRow[], group: ResultGroup, view: EsqSolveView, tree: EsqModelRunTree): ResultGroupRow[] {
  const byKey = new Map<string, ResultRow[]>();
  for (const row of rows) {
    const key = group === "FAMILY" ? row.sequence.familyId ?? "" : releaseCategoryOf(view, row.sequence) ?? "";
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  return [...byKey.entries()].map(([key, members]) => ({
    key,
    label: group === "FAMILY" ? (key === "" ? "Not in a family" : familyText(view, key)) : (key === "" ? "No release category" : key),
    frequency: group === "FAMILY" && key !== "" ? familyValueIn(tree, key, members) : groupValue(tree, members),
    position: Math.min(...members.map((member) => member.position)),
    rows: members,
  }));
}

function SequenceTable({ rows, label, model, cutSetRun, onCutSets }: { rows: readonly ResultRow[]; label: string; model: EsqModel; cutSetRun: boolean; onCutSets: (dialog: CutSetDialog) => void }): JSX.Element {
  return (
    <table className="postable postable--mid es-records esq-results" aria-label={label}>
      <thead><tr><th scope="col">Sequence</th><th scope="col">End state</th><th scope="col">Frequency (/yr)</th></tr></thead>
      <tbody>
        {rows.map(({ sequence }) => {
          const key = sequenceKeyOf(sequence);
          const name = sequenceText(model, sequence.sequenceIds);
          return (
            <tr key={key}>
              <td>
                {cutSetRun && (sequence.cutSetCount ?? 0) > 0
                  ? <button type="button" className="es-records__link" aria-label={`Cut sets of ${name}`} onClick={() => onCutSets({ kind: "sequenceCutSets", sequenceKey: key })}>{name}</button>
                  : <span className="postable__name">{name}</span>}
              </td>
              <td>{sequence.endState === null ? <Muted>None</Muted> : END_STATE_LABELS[sequence.endState] ?? sequence.endState}</td>
              <td className="posmono">{sciText(sequence.annualFrequency)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TreeResults({ view, summary, onCutSets }: { view: EsqSolveView; summary: EsqModelRunResult; onCutSets: (dialog: CutSetDialog) => void }): JSX.Element | null {
  const fieldId = useId();
  const [settings, setSettings] = useWorkbookView<ResultSettings>("solve.results", START_RESULTS, RESULTS_VIEW);
  const [open, setOpen] = useState<readonly string[]>([]);
  const model = view.model;
  const trees = summary.trees.filter((candidate) => candidate.status === "SUCCEEDED");
  const tree = trees.find((candidate) => candidate.treeId === settings.treeId) ?? trees[0];
  if (tree === undefined) return null;
  const cutSetRun = summary.calculation === "CUT_SETS";
  const order = settings.order;
  const rows: ResultRow[] = summary.sequences.flatMap((sequence, position) => (sequence.treeId === tree.treeId ? [{ sequence, position }] : []));
  const groups = settings.group === "NONE" ? [] : ordered(groupsOf(rows, settings.group, view, tree), order, (entry) => entry.frequency);
  const groupNoun = settings.group === "FAMILY" ? "Family" : "Release category";
  const resetKey = `${summary.runId}:${tree.treeId}:${order}:${settings.group}`;

  function set(patch: Partial<ResultSettings>): void {
    setSettings((current) => ({ ...current, ...patch }));
    setOpen([]);
  }

  function toggle(key: string): void {
    setOpen((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
  }

  return (
    <div className="esq-tree-results">
      <div className="es-records__bar">
        <div className="es-records__filters">
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-tree`}>Event tree</label>
            <select id={`${fieldId}-tree`} className="posfield__select" value={tree.treeId} onChange={(event) => set({ treeId: event.target.value })}>
              {trees.map((candidate) => <option key={candidate.treeId} value={candidate.treeId}>{treeLabel(model, candidate.treeId)}</option>)}
            </select>
          </div>
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-order`}>Order</label>
            <select id={`${fieldId}-order`} className="posfield__select" value={order} onChange={(event) => {
              const next = optionOf(RESULT_ORDERS, event.target.value);
              if (next !== undefined) set({ order: next });
            }}>
              {RESULT_ORDERS.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
            </select>
          </div>
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-group`}>Group by</label>
            <select id={`${fieldId}-group`} className="posfield__select" value={settings.group} onChange={(event) => {
              const next = optionOf(RESULT_GROUPS, event.target.value);
              if (next !== undefined) set({ group: next });
            }}>
              {RESULT_GROUPS.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
            </select>
          </div>
        </div>
      </div>
      {settings.group === "NONE" && rows.length > 0 && (
        <PagedResults items={ordered(rows, order, (row) => row.sequence.annualFrequency)} label="Sequences of this event tree" resetKey={resetKey}>
          {(page) => <SequenceTable rows={page} label="Sequences of this event tree" model={model} cutSetRun={cutSetRun} onCutSets={onCutSets} />}
        </PagedResults>
      )}
      {groups.length > 0 && (
        <PagedResults items={groups} label={`${groupNoun} results of this event tree`} resetKey={resetKey}>
          {(page) => (
            <table className="postable postable--mid es-records esq-results" aria-label={`${groupNoun} results of this event tree`}>
              <thead><tr><th scope="col">{groupNoun}</th><th scope="col">Frequency (/yr)</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
              <tbody>
                {page.map((entry) => {
                  const expanded = open.includes(entry.key);
                  const familyCutSets = cutSetRun && settings.group === "FAMILY" && entry.key !== "" && entry.rows.some((row) => (row.sequence.cutSetCount ?? 0) > 0);
                  return (
                    <Fragment key={entry.key}>
                      <tr>
                        <td>
                          {familyCutSets
                            ? <button type="button" className="es-records__link" aria-label={`Cut sets of ${entry.label}`} onClick={() => onCutSets({ kind: "familyCutSets", familyId: entry.key, treeId: tree.treeId })}>{entry.label}</button>
                            : <span className="postable__name">{entry.label}</span>}
                        </td>
                        <td className="posmono">{sciText(entry.frequency)}</td>
                        <td className="es-records__act">
                          <button type="button" className="posnav__btn posnav__btn--sm" aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} the sequences of ${entry.label}`} onClick={() => toggle(entry.key)}>{expanded ? "Hide" : "Show"}</button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="esq-tree-results__members">
                          <td colSpan={3}>
                            <PagedResults items={ordered(entry.rows, order, (row) => row.sequence.annualFrequency)} label={`Sequences of ${entry.label}`} resetKey={resetKey}>
                              {(members) => <SequenceTable rows={members} label={`Sequences of ${entry.label}`} model={model} cutSetRun={cutSetRun} onCutSets={onCutSets} />}
                            </PagedResults>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </PagedResults>
      )}
    </div>
  );
}

function ModelRunsBody({ view, shownRun, composer, onCutSets }: { view: EsqSolveView; shownRun: ShownRun; composer: Composer; onCutSets: (dialog: CutSetDialog) => void }): JSX.Element {
  const summary = shownRun.summary;
  const problem = shownRun.problem;
  const recorded = summary !== undefined && view.run?.runId === summary.runId;
  return (
    <>
      <ShownRunState shownRun={shownRun} model={view.model} live={composer.live} />
      {summary !== undefined && (
        <div className="esq-solve-stack">
          {problem !== undefined && !recorded && <p className="es-scope-error" role="status">{problem}</p>}
          <FailedTrees summary={summary} model={view.model} />
          <TreeResults view={view} summary={summary} onCutSets={onCutSets} />
        </div>
      )}
    </>
  );
}

function FamiliesPanel({ view, shownRun, onOpen, onCutSets }: { view: EsqSolveView; shownRun: ShownRun; onOpen: (id: string) => void; onCutSets: (dialog: CutSetDialog) => void }): JSX.Element {
  const { editable } = useEsqWorkbook();
  const [page, setPage] = useState(0);
  const rows = paged(view.families.length, page);
  const shown = view.families.slice(rows.start, rows.start + PAGE);
  const runValues = new Map((shownRun.summary?.families ?? []).map((family) => [family.familyId, family.annualFrequency]));
  const withCutSets = new Set((shownRun.summary?.families ?? []).flatMap((family) => (family.cutSets.length > 0 ? [family.familyId] : [])));
  const actionLabel = editable ? "Edit" : "View";
  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters" />
        <div className="es-records__actions"><Pager rows={rows} noun="family" plural="families" onPage={setPage} /></div>
      </div>
      <ShownCaption shownRun={shownRun} model={view.model} />
      {view.families.length > 0 && (
        <table className="postable postable--mid es-records esq-results" aria-label="Family values">
          <thead><tr><th scope="col">Family</th><th scope="col">PRAXIS (/yr)</th><th scope="col">Typed or imported (/yr)</th><th scope="col">Difference</th><th scope="col">Of record (/yr)</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((family) => {
              const solve = family.solve;
              const run = runValues.get(family.id);
              const compared = solve?.typed !== undefined ? { value: solve.typed.annualFrequency, from: "Typed" } : solve?.imported !== undefined ? { value: solve.imported.annualFrequency, from: "Imported from ES" } : undefined;
              const name = blank(family.name) ? family.id : family.name;
              return (
                <tr key={family.id}>
                  <td>
                    {withCutSets.has(family.id)
                      ? <button type="button" className="es-records__link" aria-label={`Cut sets of ${family.id}`} onClick={() => onCutSets({ kind: "familyCutSets", familyId: family.id, treeId: null })}>{name}</button>
                      : <span className="postable__name">{name}</span>}
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

function CutSetsDialog({ dialog, view, summary, treeResult, onClose }: {
  dialog: CutSetDialog;
  view: EsqSolveView;
  summary: EsqModelRunResult | undefined;
  treeResult: EventTreeAnalysisResult | undefined;
  onClose: () => void;
}): JSX.Element | null {
  const { esq, upstream } = useEsqWorkbook();
  const reader = useMemo(() => esqEventReader(esq, summary?.eventCodes), [esq, summary]);
  const model = view.model;
  const sequence = dialog.kind === "sequenceCutSets" ? summary?.sequences.find((entry) => sequenceKeyOf(entry) === dialog.sequenceKey) : undefined;
  if (summary === undefined || (dialog.kind === "sequenceCutSets" && sequence === undefined)) return null;
  const familyId = dialog.kind === "familyCutSets" ? dialog.familyId : sequence?.familyId ?? null;
  const treeId = dialog.kind === "familyCutSets" ? dialog.treeId : sequence?.treeId ?? null;
  const family = familyId === null ? undefined : summary.families.find((entry) => entry.familyId === familyId);
  const familyValue = family?.annualFrequency ?? 0;
  const thresholds = thresholdsOf(esq, upstream.ri);
  const familyRows = family === undefined ? [] : cutSetRows(summary, family.familyId, familyValue, thresholds, reader.code);
  const treeFamily = sequence === undefined && treeId !== null ? treeResult?.families?.find((entry) => entry.familyId === familyId) : undefined;
  const lastSweep = treeFamily === undefined ? undefined : treeFamily.sweep[treeFamily.sweep.length - 1];
  const treeFamilyValue = summary.trees.find((tree) => tree.treeId === treeId)?.families?.find((entry) => entry.familyId === familyId)?.annualFrequency ?? lastSweep?.annualFrequency ?? 0;
  const items = sequence === undefined ? treeFamily?.items : childEntryOf(treeResult, model, sequence)?.cutSets?.items;
  const rows = treeId === null ? familyRows : scopedCutSetRows({
    items: items ?? [],
    familyId: familyId ?? "",
    treeId,
    total: sequence === undefined ? treeFamilyValue : sequence.annualFrequency,
    familyValue,
    familyRows,
    individualPercent: thresholds.individualPercent,
    codeOf: reader.code,
  });
  const familyTitle =familyId === null ? "" : familyText(view, familyId);
  const title = sequence !== undefined ? `${sequenceText(model, sequence.sequenceIds)} · ${treeLabel(model, sequence.treeId)}`
    : treeId === null ? familyTitle
    : `${familyTitle} · ${treeLabel(model, treeId)}`;
  const scopeKey = dialog.kind === "sequenceCutSets" ? dialog.sequenceKey : `${dialog.familyId}:${dialog.treeId ?? ""}`;

  return (
    <DialogShell label="Cut sets" onClose={onClose} fit>
      <DialogHead cap="Cut sets · ESQ-D1 · ESQ-D5" title={title} onClose={onClose} />
      <div className="modal__body esq-dialog-body">
        {rows.length > 0 && (
          <PagedResults items={rows} label="Cut sets" resetKey={`${summary.runId}:${scopeKey}`}>
            {(page) => (
              <table className="postable postable--mid es-records esq-results" aria-label="Cut sets">
                <thead><tr><th scope="col">Cut set</th><th scope="col">Frequency (/yr)</th><th scope="col">Share</th></tr></thead>
                <tbody>
                  {page.map((row) => {
                    const text = row.codes.length === 0 ? "Initiator alone" : row.codes.join(" · ");
                    const note = [row.significant ? "Significant" : "", treeId === null ? treeLabel(model, row.treeId) : ""].filter((part) => part.length > 0).join(" · ");
                    return (
                      <tr key={row.key}>
                        <td>
                          <span className="postable__name">{text}</span>
                          {note.length > 0 && <span className="postable__name-sub">{note}</span>}
                        </td>
                        <td className="posmono">{sciText(row.annualFrequency)}</td>
                        <td className="posmono">{shareText(row.share)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </PagedResults>
        )}
      </div>
    </DialogShell>
  );
}

function ConvergencePanel({ view, shownRun, onSweep }: { view: EsqSolveView; shownRun: ShownRun; onSweep: (id: string) => void }): JSX.Element {
  const [page, setPage] = useState(0);
  const summary = shownRun.summary;
  const swept = summary === undefined ? [] : runConvergenceOf(summary, view);
  const rows = paged(swept.length, page);
  const shown = swept.slice(rows.start, rows.start + PAGE);
  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters" />
        <div className="es-records__actions"><Pager rows={rows} noun="family" plural="families" onPage={setPage} /></div>
      </div>
      <ShownCaption shownRun={shownRun} model={view.model} />
      {swept.length > 0 && (
        <table className="postable postable--mid es-records esq-results" aria-label="Convergence by family">
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
  const calculation = run.hcl !== undefined ? `Dependencies · ${plural(run.hcl.treeIds.length, "event tree", "event trees")} on the dependency network`
    : run.monteCarlo !== undefined ? `Direct Monte Carlo · ${run.monteCarlo.trials.toLocaleString()} trials · seed ${String(run.monteCarlo.seed)}`
    : run.quantifier === undefined ? `${CALCULATION_LABELS[run.calculation]} · Direct BDD`
    : `${CALCULATION_LABELS[run.calculation]} · ${CUT_SET_ALGORITHM} · ${QUANTIFIER_LABELS[run.quantifier].toLowerCase()}`;
  const treatment = TREATMENT_OPTIONS.find(([option]) => option === run.successTreatment)?.[1];
  const facts: [string, string][] = [
    ["Status", view.stale ? view.change ?? "Older than its inputs" : "Current"],
    ["Workbook revision", String(run.revision)],
    ["Calculation", calculation],
    ["Success treatment", treatment ?? "None"],
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

function SweepDialog({ id, view, summary, onClose }: { id: string; view: EsqSolveView; summary: EsqModelRunResult | undefined; onClose: () => void }): JSX.Element | null {
  const family = summary === undefined ? undefined : runConvergenceOf(summary, view).find((candidate) => candidate.id === id);
  if (family === undefined) return null;
  const states = family.states.filter((state) => state.annualFrequency > 0);
  return (
    <DialogShell label="Cutoff sweep" onClose={onClose} fit>
      <DialogHead cap="Cutoff sweep · ESQ-B2 · ESQ-B3 · ESQ-N-4" title={familyText(view, id)} onClose={onClose} />
      <div className="modal__body esq-dialog-body">
        <table className="postable postable--mid es-records esq-results" aria-label={`${id} sweep`}>
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
          <table className="postable postable--mid es-records esq-results" aria-label={`${id} by operating state`}>
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

function SolveDialogs({ context, onClose }: { context: EsqWindowContext; onClose: () => void }): JSX.Element | null {
  const { esq, upstream } = useEsqWorkbook();
  const view = solveViewOf(esq, upstream.es);
  if (view === undefined) return null;
  switch (context.kind) {
    case "esqSolveFamily": return <FamilyDialog id={context.id} view={view} onClose={onClose} />;
    case "esqSolveRun": return <RunDialog view={view} onClose={onClose} />;
    default: return null;
  }
}

function EsqSolveTabs({ initialNetworkId = null, initialSourceWorkbookId = null }: { initialNetworkId?: string | null; initialSourceWorkbookId?: string | null }): JSX.Element {
  const { esq, upstream, runtime } = useEsqWorkbook();
  const baseView = useMemo(() => solveViewOf(esq, upstream.es), [esq, upstream.es]);
  const loadedRun = useShownRun(baseView === undefined ? null : runtime.workbookId, baseView?.run?.runId);
  const summary = loadedRun.summary;
  const shownStale = useMemo(() => summary !== undefined && summaryStale(summary, esq), [summary, esq]);
  const recordId = baseView?.stale === true ? baseView.run?.runId : undefined;
  const saved = useRunWorkbooks(runtime.workbookId, [recordId, shownStale ? summary?.runId : undefined]);
  const recordSaved = recordId === undefined ? undefined : saved.get(recordId);
  const shownSaved = shownStale && summary !== undefined ? saved.get(summary.runId) : undefined;
  const view = useMemo(() => (baseView === undefined || recordSaved === undefined ? baseView : withRunChange(baseView, esq, recordSaved)), [baseView, esq, recordSaved]);
  const shownChange = useMemo(() => (shownSaved === undefined ? undefined : solveInputsChange(shownSaved, esq)), [shownSaved, esq]);
  const shownProblem = summary === undefined ? undefined : summaryProblem(summary, shownChange);
  const shownRun: ShownRun = summary === undefined ? loadedRun : {
    ...loadedRun,
    blocked: shownStale || summary.trees.some((tree) => tree.status === "FAILED"),
    ...(shownProblem === undefined ? {} : { problem: shownProblem }),
  };
  const composer = useComposer(view?.model, shownRun, initialNetworkId, initialSourceWorkbookId);
  const [tab, setTab] = useWorkbookView<SolveTab>("solve.tab", "runs", SOLVE_TAB_VIEW);
  useEffect(() => {
    if (initialNetworkId !== null) setTab("runs");
  }, [initialNetworkId, setTab]);
  const [dialogs, setDialogs] = useState<readonly SolveDialog[]>([]);
  const dialog = dialogs.length === 0 ? undefined : dialogs[dialogs.length - 1];
  const cutSetTreeId = cutSetTreeOf(dialogs.find(isCutSetDialog), shownRun.summary);
  const treeResult = useTreeResult(runtime.workbookId, cutSetTreeId === undefined ? undefined : shownRun.summary?.trees.find((tree) => tree.treeId === cutSetTreeId)?.runId);

  function open(next: SolveDialog): void {
    setDialogs((current) => [...current, next]);
  }

  function close(): void {
    setDialogs((current) => current.slice(0, -1));
  }

  function opens(finding: EsqSolveFinding): boolean {
    const target = finding.target;
    if (target === undefined || view === undefined) return false;
    switch (target.kind) {
      case "esqSolveFamily": return view.families.some((family) => family.id === target.id);
      case "esqSolveRun": return view.run !== undefined;
    }
  }

  function openFinding(finding: EsqSolveFinding): void {
    const target = finding.target;
    if (target === undefined) return;
    switch (target.kind) {
      case "esqSolveFamily": open({ kind: "family", id: target.id }); return;
      case "esqSolveRun": open({ kind: "run" });
    }
  }

  function renderPanel(): JSX.Element | null {
    if (view === undefined) return null;
    switch (tab) {
      case "runs": return <RunsPanel view={view} shownRun={shownRun} composer={composer} onCutSets={open} />;
      case "families": return <FamiliesPanel view={view} shownRun={shownRun} onOpen={(id) => open({ kind: "family", id })} onCutSets={open} />;
      case "convergence": return <ConvergencePanel view={view} shownRun={shownRun} onSweep={(id) => open({ kind: "sweep", id })} />;
      case "dynamic": return null;
      case "checks": return <ChecksPanel findings={view.findings} opens={opens} onOpen={openFinding} />;
    }
  }

  function renderDialog(): JSX.Element | null {
    if (dialog === undefined || view === undefined) return null;
    switch (dialog.kind) {
      case "sequenceCutSets":
      case "familyCutSets": return <CutSetsDialog key={dialog.kind === "sequenceCutSets" ? dialog.sequenceKey : `${dialog.familyId}:${dialog.treeId ?? ""}`} dialog={dialog} view={view} summary={shownRun.summary} treeResult={treeResult} onClose={close} />;
      case "family": return <FamilyDialog key={dialog.id} id={dialog.id} view={view} onClose={close} />;
      case "run": return <RunDialog view={view} onClose={close} />;
      case "sweep": return <SweepDialog id={dialog.id} view={view} summary={shownRun.summary} onClose={close} />;
    }
  }

  return (
    <>
      <div className="poscard es-seq-card">
        {view !== undefined && RUN_TABS.has(tab) && <RunHead view={view} shownRun={shownRun} onRecord={() => open({ kind: "run" })} />}
        <TabBar tabs={SOLVE_TABS} tab={tab} label="Solve sections" findings={view?.findings.length ?? 0} onTab={setTab} />
        <div className="es-seq-card__panel">{renderPanel()}</div>
      </div>
      {renderDialog()}
    </>
  );
}

export { EsqSolveTabs, SolveDialogs, SOLVE_WINDOW_KINDS, SOLVE_WINDOW_LABELS };
