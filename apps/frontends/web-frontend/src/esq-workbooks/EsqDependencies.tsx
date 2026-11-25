import { JSX, useId, useMemo, useState } from "react";
import { z } from "zod";
import { stringifyJson } from "interfaces-shared-types/json";
import type { EsqModel } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EsqBayesianNetwork, EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import { treesInScope } from "interfaces-mef-types/esq/esq-run-inputs";
import type { FaultTreeTopEventReference, HclParameterDraws, HclSampler, HclZeroProbabilityContexts } from "interfaces-mef-types/modeling";
import { HclCptClipEpsilonSchema, HclUncertaintySampleCountSchema, HclUncertaintySeedSchema, HclUncertaintySettingsSchema } from "interfaces-mef-types/zod/modeling";
import type { AnalysisRunMetadata } from "interfaces-shared-types/newly-developed-methods";
import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import {
  HclCalculationTypeSchema,
  type HclBatchExecuteResult,
  type HclBatchInput,
  type HclCalculationType,
  type HclDependencyCutSetScore,
  type HclFaultTreeCutSetSettings,
  type HclQuantificationResult,
  type HclRunSampling,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import type { HclEditorBatchRunResult, HclEditorRunResult, HclEditorScenarioRunResult, HclFaultTreeOption } from "../newly-developed-methods/hybrid-causal-logic";
import { AnalysisJobs } from "../newly-developed-methods/shared/analysisJobs";
import { cancelAnalysisRun } from "../newly-developed-methods/shared/analysisRunWait";
import { analysisSaveBlock, analysisSaveNotice } from "../newly-developed-methods/shared/useAnalysisScope";
import { FLAG_VIEW, jsonView, useWorkbookView } from "../workbooks/workbookViewMemory";
import { WORKFLOWS, countOf, decadeText, esqJobLabel, optionOf, treeLabel, type RunWorkflow } from "./esqShared";
import { MODEL_AS_SET } from "./esqLogic";
import { useEsqWorkbook } from "./esqWorkbookContext";
import {
  getEsqHclEventTreeResult,
  getEsqHclFaultTreeResult,
  runEsqHclEventTree,
  runEsqHclEventTreeBatch,
  runEsqHclFaultTree,
  runEsqHclFaultTreeBatch,
  runEsqModel,
} from "./esqWorkbookApi";
import { EsqDependencyEvidence, dependencyEvidenceProblem, studyConfiguration, type DependencyEvidence } from "./EsqDependencyEvidence";
import { EsqDependencyNetwork, configurationOf, useDependencyFaultTrees } from "./EsqDependencyNetwork";
import { EsqDependencyResults, EsqFaultTreeDependencyResults } from "./EsqDependencyResults";
import "../sy-workbooks/css/syFaultTreeAnalysis.css";
import "./css/esqSolveTabs.css";
import "./css/esqDependencies.css";

type DependencyTarget = "EVENT_TREE" | "FAULT_TREE";

type DependencyCutSetChoice = "NONE" | HclDependencyCutSetScore;

interface DependencyStudyTree {
  treeId: string;
  runResult: HclEditorRunResult | null;
  batchRunResult: HclEditorBatchRunResult | null;
  failure: string | null;
}

interface DependencyStudy {
  target: DependencyTarget;
  result: HclCalculationType;
  evidence: DependencyEvidence;
  cutSets: DependencyCutSetChoice;
  inputs: string;
  trees: DependencyStudyTree[];
}

interface DependencyModelRuns {
  shownId?: string;
  shownActive: boolean;
  shownConfigurationId?: string;
  show: (runId: string) => void;
  reload: () => void;
  render: (live: AnalysisRunMetadata | null) => JSX.Element;
}

interface DependencySession {
  configurationId: string;
  running: boolean;
  live: AnalysisRunMetadata | null;
  modelRunId: string | null;
  error: string | null;
  batchInput: HclBatchInput | null;
  study: DependencyStudy | null;
  studyTotal: number;
}

type DependencySessionChange = (update: (current: DependencySession) => DependencySession) => void;

interface DependencyComposerSettings {
  target: DependencyTarget;
  workflow: RunWorkflow;
  treeId: string;
  batchTreeIds: string[] | null;
  faultTreeId: string;
  batchFaultTreeIds: string[] | null;
  result: HclCalculationType;
  evidence: DependencyEvidence;
  cutSets: DependencyCutSetChoice;
  keep: number;
  limitOrder: number | null;
  cutOff: number | null;
  causes: number | null;
  importance: boolean;
  importanceEvents: number;
}

interface DependencySampling {
  sampler: HclSampler;
  cptSampler: HclSampler | "SAME";
  sampleCount: number;
  seed: number | null;
  correlation: HclParameterDraws;
  clipProbabilities: boolean;
  zeroProbabilityContexts: HclZeroProbabilityContexts;
  cptClipEpsilon: number;
}

interface TargetOption {
  id: string;
  label: string;
}

interface RunSettings {
  workbookId: string;
  revision: number;
  configurationId: string;
  result: HclCalculationType;
  evidence: DependencyEvidence;
  scenarioIds: string[];
  batchInput: HclBatchInput | null;
  sampling?: HclRunSampling;
  limits?: HclFaultTreeCutSetSettings;
  score?: HclDependencyCutSetScore;
  importance?: boolean | number;
}

const NO_REASON = "The run did not finish and gave no reason.";

const IDLE_DEPENDENCY_SESSION: DependencySession = { configurationId: "", running: false, live: null, modelRunId: null, error: null, batchInput: null, study: null, studyTotal: 0 };

const KEEP_LIMIT = 1000;

const LISTED_EVENTS_LIMIT = 100;

const START_SAMPLES = 1_000;

const START_SEED = 42;

const START_SAMPLER: HclSampler = "LHS";

const TARGETS: readonly (readonly [DependencyTarget, string])[] = [["EVENT_TREE", "Event trees"], ["FAULT_TREE", "Fault trees"]];

const RESULTS: readonly (readonly [HclCalculationType, string])[] = [["PROBABILITY", "Probability"], ["UNCERTAINTY", "Uncertainty"]];

const EVIDENCE: readonly (readonly [DependencyEvidence, string])[] = [["BASE", "Base evidence"], ["SCENARIOS", "Evidence scenarios"], ["HAZARD", "Hazard convolution"]];

const CUT_SETS: readonly (readonly [DependencyCutSetChoice, string])[] = [["NONE", "Off"], ["FAILED_EVENTS", "Failed events"], ["FAILED_EVENTS_AND_SEQUENCE", "Failed events and success branches"]];

const SAMPLERS: readonly (readonly [HclSampler, string])[] = [["MC", "Monte Carlo (MC)"], ["LHS", "Latin hypercube (LHS)"]];

const BN_SAMPLERS: readonly (readonly [HclSampler | "SAME", string])[] = [["SAME", "Same as inputs"], ...SAMPLERS];

const PARAMETER_DRAWS: readonly (readonly [HclParameterDraws, string])[] = [["SHARED", "Shared across uses"], ["INDEPENDENT", "Independent per use"]];

const OUT_OF_RANGE: readonly (readonly ["FAIL" | "CLIP", string])[] = [["FAIL", "Fail the run"], ["CLIP", "Clip to 0 and 1"]];

const ZERO_CONTEXTS: readonly (readonly [HclZeroProbabilityContexts, string])[] = [["ZERO", "Count as 0"], ["FAIL", "Fail the run"]];

const SEED_SOURCES: readonly (readonly ["FIXED" | "RUN", string])[] = [["FIXED", "Fixed"], ["RUN", "New each run"]];

const CUT_OFF_EXPONENTS = Array.from({ length: 20 }, (_, index) => -(index + 1));

const START_SETTINGS: DependencyComposerSettings = {
  target: "EVENT_TREE",
  workflow: "MANUAL",
  treeId: "",
  batchTreeIds: null,
  faultTreeId: "",
  batchFaultTreeIds: null,
  result: "PROBABILITY",
  evidence: "BASE",
  cutSets: "NONE",
  keep: 100,
  limitOrder: null,
  cutOff: null,
  causes: null,
  importance: false,
  importanceEvents: 10,
};

const SETTINGS_VIEW = jsonView<DependencyComposerSettings>(z.object({
  target: z.enum(["EVENT_TREE", "FAULT_TREE"]),
  workflow: z.enum(["MANUAL", "BATCH"]),
  treeId: z.string(),
  batchTreeIds: z.array(z.string()).nullable(),
  faultTreeId: z.string(),
  batchFaultTreeIds: z.array(z.string()).nullable(),
  result: HclCalculationTypeSchema,
  evidence: z.enum(["BASE", "SCENARIOS", "HAZARD"]),
  cutSets: z.enum(["NONE", "FAILED_EVENTS", "FAILED_EVENTS_AND_SEQUENCE"]),
  keep: z.number(),
  limitOrder: z.number().int().positive().nullable(),
  cutOff: z.number().int().negative().nullable(),
  causes: z.number().int().min(1).max(LISTED_EVENTS_LIMIT).nullable(),
  importance: z.boolean(),
  importanceEvents: z.number().int().min(1).max(LISTED_EVENTS_LIMIT),
}));

const SAMPLING_VIEW = jsonView<DependencySampling>(z.object({
  sampler: z.enum(["MC", "LHS"]),
  cptSampler: z.enum(["SAME", "MC", "LHS"]),
  sampleCount: z.number(),
  seed: z.number().nullable(),
  correlation: z.enum(["SHARED", "INDEPENDENT"]),
  clipProbabilities: z.boolean(),
  zeroProbabilityContexts: z.enum(["ZERO", "FAIL"]),
  cptClipEpsilon: z.number(),
}));

const NETWORK_VIEW = jsonView<string>(z.string());

function storedSampling(configuration: EsqHclConfiguration | undefined): DependencySampling {
  const parsed = HclUncertaintySettingsSchema.safeParse(configuration?.solverSettings.uncertainty);
  const stored = parsed.success ? parsed.data : undefined;
  return {
    sampler: stored?.sampler ?? START_SAMPLER,
    cptSampler: stored?.cptSampler ?? "SAME",
    sampleCount: stored?.sampleCount ?? START_SAMPLES,
    seed: stored === undefined ? START_SEED : stored.seed ?? null,
    correlation: stored?.correlation ?? "SHARED",
    clipProbabilities: stored?.clipProbabilities ?? false,
    zeroProbabilityContexts: stored?.zeroProbabilityContexts ?? "ZERO",
    cptClipEpsilon: stored?.cptClipEpsilon ?? 0,
  };
}

function runSampling(sampling: DependencySampling): HclRunSampling {
  return {
    sampleCount: sampling.sampleCount,
    sampler: sampling.sampler,
    ...(sampling.seed === null ? {} : { seed: sampling.seed }),
    ...(sampling.cptSampler === "SAME" ? {} : { cptSampler: sampling.cptSampler }),
    ...(sampling.correlation === "SHARED" ? {} : { correlation: sampling.correlation }),
    ...(sampling.clipProbabilities ? { clipProbabilities: true } : {}),
    ...(sampling.cptClipEpsilon === 0 ? {} : { cptClipEpsilon: sampling.cptClipEpsilon }),
    ...(sampling.zeroProbabilityContexts === "ZERO" ? {} : { zeroProbabilityContexts: sampling.zeroProbabilityContexts }),
  };
}

function samplingProblem(sampling: DependencySampling, configuration: EsqHclConfiguration, seedDraft: string | null): string | undefined {
  const stored = configuration.solverSettings.uncertainty;
  if (stored !== undefined && !HclUncertaintySettingsSchema.safeParse(stored).success) return "The uncertainty laws of this dependency configuration need review.";
  if (!HclUncertaintySampleCountSchema.safeParse(sampling.sampleCount).success) return "Uncertainty samples must be a whole number of at least 2.";
  if (sampling.seed !== null && (seedDraft !== null || !HclUncertaintySeedSchema.safeParse(sampling.seed).success)) return `The seed must be a whole number from 0 to ${String(Number.MAX_SAFE_INTEGER)}.`;
  if (!HclCptClipEpsilonSchema.safeParse(sampling.cptClipEpsilon).success) return "The CPT floor must be at least 0 and below 0.5.";
  return undefined;
}

function chosenIds(options: readonly TargetOption[], manualId: string, batchIds: readonly string[] | null, workflow: RunWorkflow): string[] {
  const ids = options.map((option) => option.id);
  if (workflow === "BATCH") return batchIds === null ? ids : ids.filter((id) => batchIds.includes(id));
  const manual = ids.includes(manualId) ? manualId : ids[0];
  return manual === undefined ? [] : [manual];
}

async function batchScenarios<Result>(execution: HclBatchExecuteResult, read: (runId: string) => Promise<Result>, wrap: (result: Result) => HclEditorRunResult): Promise<HclEditorScenarioRunResult[]> {
  return Promise.all(execution.runs.map(async (row) => ({
    scenarioId: row.scenarioId,
    scenarioCode: row.scenarioCode,
    scenarioName: row.scenarioName,
    status: row.run.status,
    failure: row.run.failure?.message ?? null,
    result: row.run.status === "SUCCEEDED" ? wrap(await read(row.run.id)) : null,
  })));
}

function batchResult(kind: DependencyTarget, execution: HclBatchExecuteResult, scenarios: HclEditorScenarioRunResult[]): HclEditorBatchRunResult {
  return {
    kind,
    scenarios,
    ...(execution.hazardConvolution === undefined ? {} : { hazardConvolution: execution.hazardConvolution }),
  };
}

async function studyEventTree(settings: RunSettings, treeId: string): Promise<DependencyStudyTree> {
  const { workbookId, revision, configurationId } = settings;
  const eventTree = { workbookId, modelId: treeId };
  const cutSets = settings.limits === undefined || settings.score === undefined ? undefined : { score: settings.score, ...settings.limits };
  const read = (runId: string): Promise<EventTreeAnalysisResult> => getEsqHclEventTreeResult(workbookId, configurationId, runId);
  const wrap = (result: EventTreeAnalysisResult): HclEditorRunResult => ({ kind: "EVENT_TREE", result });
  if (settings.evidence === "BASE") {
    const execution = await runEsqHclEventTree(workbookId, configurationId, revision, eventTree, settings.result, settings.sampling, cutSets, settings.importance);
    if (execution.run.status !== "SUCCEEDED") return { treeId, runResult: null, batchRunResult: null, failure: execution.run.failure?.message ?? NO_REASON };
    return { treeId, runResult: wrap(await read(execution.run.id)), batchRunResult: null, failure: null };
  }
  const execution = await runEsqHclEventTreeBatch(workbookId, configurationId, revision, eventTree, settings.result, settings.scenarioIds, settings.evidence === "HAZARD", settings.batchInput ?? undefined, settings.sampling, cutSets, settings.importance);
  return { treeId, runResult: null, batchRunResult: batchResult("EVENT_TREE", execution, await batchScenarios(execution, read, wrap)), failure: null };
}

async function studyFaultTree(settings: RunSettings, faultTree: HclFaultTreeOption, topGateId: string): Promise<DependencyStudyTree> {
  const { workbookId, revision, configurationId } = settings;
  const treeId = faultTree.modelId;
  const top: FaultTreeTopEventReference = { referenceType: "FAULT_TREE_TOP_EVENT", workbookId: faultTree.workbookId, modelId: faultTree.modelId, entityId: topGateId };
  const read = (runId: string): Promise<HclQuantificationResult> => getEsqHclFaultTreeResult(workbookId, configurationId, runId);
  const wrap = (result: HclQuantificationResult): HclEditorRunResult => ({ kind: "FAULT_TREE", result });
  if (settings.evidence === "BASE") {
    const execution = await runEsqHclFaultTree(workbookId, configurationId, revision, top, settings.result, settings.sampling, settings.limits, settings.importance);
    if (execution.run.status !== "SUCCEEDED") return { treeId, runResult: null, batchRunResult: null, failure: execution.run.failure?.message ?? NO_REASON };
    return { treeId, runResult: wrap(await read(execution.run.id)), batchRunResult: null, failure: null };
  }
  const execution = await runEsqHclFaultTreeBatch(workbookId, configurationId, revision, top, settings.result, settings.scenarioIds, settings.evidence === "HAZARD", settings.batchInput ?? undefined, settings.sampling, settings.limits, settings.importance);
  return { treeId, runResult: null, batchRunResult: batchResult("FAULT_TREE", execution, await batchScenarios(execution, read, wrap)), failure: null };
}

function ComposerNumber({ label, value, min, max, step, invalid = false, onTyped }: {
  label: string;
  value: number;
  min: number;
  max?: number;
  step: number | "any";
  invalid?: boolean;
  onTyped: (typed: string) => void;
}): JSX.Element {
  const [cleared, setCleared] = useState(false);
  return (
    <input
      aria-label={label}
      type="number"
      min={min}
      max={max}
      step={step}
      aria-invalid={invalid}
      value={cleared ? "" : value}
      onChange={(event) => {
        const typed = event.target.value;
        setCleared(typed.trim().length === 0);
        if (typed.trim().length > 0) onTyped(typed);
      }}
      onBlur={() => setCleared(false)}
    />
  );
}

function SamplingFields({ sampling, seedDraft, onChange, onSeedDraft }: {
  sampling: DependencySampling;
  seedDraft: string | null;
  onChange: (patch: Partial<DependencySampling>) => void;
  onSeedDraft: (draft: string | null) => void;
}): JSX.Element {
  return (
    <>
      <label>
        <span>Sampling method</span>
        <select aria-label="Dependency sampling method" value={sampling.sampler} onChange={(event) => {
          const sampler = optionOf(SAMPLERS, event.target.value);
          if (sampler !== undefined) onChange({ sampler });
        }}>
          {SAMPLERS.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
        </select>
      </label>
      <label>
        <span>BN sampling method</span>
        <select aria-label="Dependency BN sampling method" value={sampling.cptSampler} onChange={(event) => {
          const cptSampler = optionOf(BN_SAMPLERS, event.target.value);
          if (cptSampler !== undefined) onChange({ cptSampler });
        }}>
          {BN_SAMPLERS.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
        </select>
      </label>
      <label>
        <span>Samples</span>
        <ComposerNumber label="Dependency samples" value={sampling.sampleCount} min={2} step={1} invalid={!HclUncertaintySampleCountSchema.safeParse(sampling.sampleCount).success} onTyped={(typed) => onChange({ sampleCount: Number(typed) })} />
      </label>
      <label>
        <span>Seed</span>
        <select aria-label="Dependency seed source" value={sampling.seed === null ? "RUN" : "FIXED"} onChange={(event) => {
          onSeedDraft(null);
          onChange({ seed: event.target.value === "FIXED" ? START_SEED : null });
        }}>
          {SEED_SOURCES.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
        </select>
      </label>
      {sampling.seed !== null && (
        <label>
          <span>Seed value</span>
          <input aria-label="Dependency seed" type="number" min={0} step={1} aria-invalid={seedDraft !== null || !HclUncertaintySeedSchema.safeParse(sampling.seed).success} value={seedDraft ?? sampling.seed} onChange={(event) => {
            const typed = event.target.value;
            const seed = HclUncertaintySeedSchema.safeParse(typed.trim().length === 0 ? Number.NaN : Number(typed));
            if (!seed.success) {
              onSeedDraft(typed);
              return;
            }
            onSeedDraft(null);
            onChange({ seed: seed.data });
          }} />
        </label>
      )}
      <label>
        <span>Parameter draws</span>
        <select aria-label="Dependency parameter draws" value={sampling.correlation} onChange={(event) => {
          const correlation = optionOf(PARAMETER_DRAWS, event.target.value);
          if (correlation !== undefined) onChange({ correlation });
        }}>
          {PARAMETER_DRAWS.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
        </select>
      </label>
      <label>
        <span>Out-of-range probabilities</span>
        <select aria-label="Dependency out-of-range probabilities" value={sampling.clipProbabilities ? "CLIP" : "FAIL"} onChange={(event) => onChange({ clipProbabilities: event.target.value === "CLIP" })}>
          {OUT_OF_RANGE.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
        </select>
      </label>
      <label>
        <span>Zero-probability contexts</span>
        <select aria-label="Dependency zero-probability contexts" value={sampling.zeroProbabilityContexts} onChange={(event) => {
          const zeroProbabilityContexts = optionOf(ZERO_CONTEXTS, event.target.value);
          if (zeroProbabilityContexts !== undefined) onChange({ zeroProbabilityContexts });
        }}>
          {ZERO_CONTEXTS.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
        </select>
      </label>
      <label>
        <span>CPT floor</span>
        <ComposerNumber label="Dependency CPT floor" value={sampling.cptClipEpsilon} min={0} max={0.5} step="any" invalid={!HclCptClipEpsilonSchema.safeParse(sampling.cptClipEpsilon).success} onTyped={(typed) => onChange({ cptClipEpsilon: Number(typed) })} />
      </label>
    </>
  );
}

function DependencyRuns({ model, network, configuration, faultTrees, modelRuns, session, onSession }: {
  model: EsqModel;
  network: EsqBayesianNetwork;
  configuration: EsqHclConfiguration;
  faultTrees: readonly HclFaultTreeOption[];
  modelRuns: DependencyModelRuns;
  session: DependencySession;
  onSession: DependencySessionChange;
}): JSX.Element {
  const { esq, editable, runtime } = useEsqWorkbook();
  const fieldId = useId();
  const [settings, setSettings] = useWorkbookView<DependencyComposerSettings>("solve.dependency.composer", START_SETTINGS, SETTINGS_VIEW);
  const samplingStart = useMemo(() => storedSampling(configuration), [configuration]);
  const [sampling, setSampling] = useWorkbookView<DependencySampling>(`solve.dependency.${configuration.modelId}`, samplingStart, SAMPLING_VIEW);
  const [evidenceOpen, setEvidenceOpen] = useWorkbookView<boolean>(`solve.dependency.${configuration.modelId}.evidence`, true, FLAG_VIEW);
  const [seedDraft, setSeedDraft] = useState<string | null>(null);
  const configurationId = configuration.modelId;
  const own = session.configurationId === configurationId;
  const running = session.running;
  const live = own ? session.live : null;
  const error = own ? session.error : null;
  const batchInput = own ? session.batchInput : null;
  const study = own ? session.study : null;
  const studyTotal = own ? session.studyTotal : 0;
  const inputs = useMemo(() => stringifyJson([network, configuration, batchInput]) ?? "", [network, configuration, batchInput]);

  const eventTrees = useMemo<TargetOption[]>(() => treesInScope(esq, model)
    .filter((tree) => !tree.transferEntry)
    .map((tree) => ({ id: tree.id, label: treeLabel(model, tree.id) })), [esq, model]);
  const declared = useMemo(() => new Set(configuration.faultTrees.map((reference) => `${reference.workbookId}:${reference.modelId}`)), [configuration.faultTrees]);
  const topTrees = faultTrees.filter((option) => option.topGateId !== null && declared.has(`${option.workbookId}:${option.modelId}`));
  const faultTreeOptions: TargetOption[] = topTrees.map((option) => ({ id: option.modelId, label: `${option.modelCode} · ${option.modelName}` }));
  const onFaultTrees = settings.target === "FAULT_TREE";
  const options = onFaultTrees ? faultTreeOptions : eventTrees;
  const targetIds = onFaultTrees
    ? chosenIds(faultTreeOptions, settings.faultTreeId, settings.batchFaultTreeIds, settings.workflow)
    : chosenIds(eventTrees, settings.treeId, settings.batchTreeIds, settings.workflow);
  const batch = settings.workflow === "BATCH";
  const uncertainty = settings.result === "UNCERTAINTY";
  const sampledGrid = uncertainty && settings.evidence === "HAZARD";
  const cutSetChoice: DependencyCutSetChoice = uncertainty ? "NONE" : onFaultTrees && settings.cutSets !== "NONE" ? "FAILED_EVENTS" : settings.cutSets;
  const importance = settings.importance && !sampledGrid;
  const studyMode = onFaultTrees || uncertainty || settings.evidence !== "BASE" || cutSetChoice !== "NONE" || importance;
  const studied = studyConfiguration(configuration, batchInput);
  const scenarioIds = (studied.evidenceScenarios ?? []).filter((scenario) => scenario.enabled).map((scenario) => scenario.id);
  const keepValid = settings.keep >= 1 && settings.keep <= KEEP_LIMIT;
  const problem = (uncertainty ? samplingProblem(sampling, configuration, seedDraft) : undefined)
    ?? (cutSetChoice !== "NONE" && !keepValid ? `Keep between 1 and ${String(KEEP_LIMIT)} cut sets.` : undefined)
    ?? dependencyEvidenceProblem(studied, settings.evidence, network);
  const blocked = analysisSaveBlock(runtime);
  const saveNotice = analysisSaveNotice(runtime);
  const ready = problem === undefined && targetIds.length > 0;
  const shownStudy = studyMode && study !== null && study.inputs === inputs && study.target === settings.target && study.result === settings.result && study.evidence === settings.evidence && study.cutSets === cutSetChoice ? study : null;
  const startedHere = own && session.modelRunId !== null && modelRuns.shownId === session.modelRunId;
  const showsModelRun = !studyMode && (startedHere || modelRuns.shownConfigurationId === configurationId);
  const activeId = live !== null && (live.status === "QUEUED" || live.status === "RUNNING") ? live.id : startedHere && modelRuns.shownActive ? modelRuns.shownId : undefined;
  const noun: readonly [string, string] = onFaultTrees ? ["fault tree", "fault trees"] : ["event tree", "event trees"];

  function set(patch: Partial<DependencyComposerSettings>): void {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function hold(update: Partial<DependencySession>): void {
    onSession((current) => (current.configurationId === configurationId ? { ...current, ...update } : { ...IDLE_DEPENDENCY_SESSION, configurationId, running: current.running, ...update }));
  }

  function settle(update: (current: DependencySession) => DependencySession): void {
    onSession((current) => (current.configurationId === configurationId ? update(current) : current));
  }

  function finish(): void {
    onSession((current) => (current.configurationId === configurationId ? { ...current, running: false, live: null, studyTotal: 0 } : { ...current, running: false }));
  }

  function toggle(id: string): void {
    const all = options.map((option) => option.id);
    setSettings((current) => {
      const base = (onFaultTrees ? current.batchFaultTreeIds : current.batchTreeIds) ?? all;
      const next = base.includes(id) ? base.filter((entry) => entry !== id) : [...base, id];
      return onFaultTrees ? { ...current, batchFaultTreeIds: next } : { ...current, batchTreeIds: next };
    });
  }

  function runStudy(workbookId: string, revision: number): void {
    const target = settings.target;
    const limits: HclFaultTreeCutSetSettings | undefined = cutSetChoice === "NONE" ? undefined : {
      keep: settings.keep,
      ...(settings.limitOrder === null ? {} : { limitOrder: settings.limitOrder }),
      ...(settings.cutOff === null ? {} : { cutOff: Number(`1e${settings.cutOff}`) }),
      ...(settings.causes === null ? {} : { causes: settings.causes }),
    };
    const run: RunSettings = {
      workbookId,
      revision,
      configurationId,
      result: settings.result,
      evidence: settings.evidence,
      scenarioIds: [...scenarioIds],
      batchInput,
      ...(uncertainty ? { sampling: runSampling(sampling) } : {}),
      ...(limits === undefined ? {} : { limits }),
      ...(cutSetChoice === "NONE" ? {} : { score: cutSetChoice }),
      ...(importance ? { importance: uncertainty ? settings.importanceEvents : true } : {}),
    };
    const ids = [...targetIds];
    const order = new Map(ids.map((id, index) => [id, index]));
    let closesEvidence = settings.evidence !== "BASE";
    hold({ running: true, live: null, error: null, studyTotal: ids.length, study: { target, result: settings.result, evidence: settings.evidence, cutSets: cutSetChoice, inputs, trees: [] } });
    Promise.all(ids.map((id) => {
      const faultTree = topTrees.find((option) => option.modelId === id);
      const started = target === "EVENT_TREE" ? studyEventTree(run, id)
        : faultTree === undefined || faultTree.topGateId === null ? Promise.resolve<DependencyStudyTree>({ treeId: id, runResult: null, batchRunResult: null, failure: "The fault tree has no top event." })
        : studyFaultTree(run, faultTree, faultTree.topGateId);
      return started
        .catch((caught: Error): DependencyStudyTree => ({ treeId: id, runResult: null, batchRunResult: null, failure: caught.message }))
        .then((outcome) => {
          settle((current) => (current.study === null || current.study.inputs !== inputs ? current : {
            ...current,
            study: { ...current.study, trees: [...current.study.trees, outcome].sort((left, right) => (order.get(left.treeId) ?? 0) - (order.get(right.treeId) ?? 0)) },
          }));
          if (!closesEvidence) return;
          closesEvidence = false;
          setEvidenceOpen(false);
        });
    })).finally(finish);
  }

  function runModel(workbookId: string, revision: number): void {
    const everyTree = targetIds.length === eventTrees.length;
    hold({ running: true, live: null, error: null, modelRunId: null });
    let announced = false;
    runEsqModel(workbookId, revision, { ...MODEL_AS_SET, expandCcf: false }, "EXACT", undefined, { workbookId, modelId: configurationId }, (progress) => {
      settle((current) => ({ ...current, live: progress, modelRunId: progress.id }));
      if (announced) return;
      announced = true;
      modelRuns.show(progress.id);
      modelRuns.reload();
    }, everyTree ? undefined : targetIds)
      .then((response) => {
        settle((current) => ({ ...current, modelRunId: response.run.id }));
        modelRuns.show(response.run.id);
        modelRuns.reload();
      })
      .catch((caught: Error) => {
        settle((current) => ({ ...current, error: caught.message }));
        modelRuns.reload();
      })
      .finally(finish);
  }

  function run(): void {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null || !ready || running) return;
    if (studyMode) runStudy(workbookId, revision);
    else runModel(workbookId, revision);
  }

  function stop(runId: string): void {
    const workbookId = runtime.workbookId;
    if (workbookId === null) return;
    cancelAnalysisRun("esq", workbookId, runId)
      .then(() => modelRuns.reload())
      .catch((caught: Error) => settle((current) => ({ ...current, error: caught.message })));
  }

  function pill(selected: boolean): string {
    return selected ? "is-selected" : "";
  }

  return (
    <>
      <div className={`syft-analysis__composer syft-analysis__composer--${settings.workflow.toLowerCase()} esq-composer`} aria-label="Dependency quantification controls">
        <fieldset className="syft-analysis__calculation-picker">
          <legend>Quantify</legend>
          <div role="radiogroup" aria-label="Dependency target">
            {TARGETS.map(([value, label]) => (
              <label key={value} className={pill(settings.target === value)}>
                <input type="radio" name={`${fieldId}-target`} value={value} checked={settings.target === value} onChange={() => set({ target: value })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="syft-analysis__workflow-picker">
          <legend>Workflow</legend>
          <div role="radiogroup" aria-label="Dependency workflow">
            {WORKFLOWS.map(([value, label]) => (
              <label key={value} className={pill(settings.workflow === value)}>
                <input type="radio" name={`${fieldId}-workflow`} value={value} checked={settings.workflow === value} onChange={() => set({ workflow: value })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="syft-analysis__calculation-picker">
          <legend>Result</legend>
          <div role="radiogroup" aria-label="Dependency result">
            {RESULTS.map(([value, label]) => (
              <label key={value} className={pill(settings.result === value)}>
                <input type="radio" name={`${fieldId}-result`} value={value} checked={settings.result === value} onChange={() => set({ result: value })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="syft-analysis__workflow-picker">
          <legend>Evidence</legend>
          <div role="radiogroup" aria-label="Dependency evidence">
            {EVIDENCE.map(([value, label]) => (
              <label key={value} className={pill(settings.evidence === value)}>
                <input type="radio" name={`${fieldId}-evidence`} value={value} checked={settings.evidence === value} onChange={() => set({ evidence: value })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="syft-analysis__run-composer">
          {batch && (
            <>
              <div className="syft-analysis__setup-row">
                <span className="syft-analysis__selection-summary">{`${countOf(targetIds.length, noun[0], noun[1])} selected`}</span>
              </div>
              <fieldset className="syft-analysis__batch-models">
                <legend>{onFaultTrees ? "Fault trees" : "Event trees"}</legend>
                {options.map((option) => (
                  <label key={option.id}>
                    <input type="checkbox" checked={targetIds.includes(option.id)} onChange={() => toggle(option.id)} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>
            </>
          )}

          <div className="syft-analysis__execution-row">
            <div className="syft-analysis__run-fields">
              {!batch && (
                <label className="syft-analysis__run-field">
                  <span>{onFaultTrees ? "Fault tree" : "Event tree"}</span>
                  <select aria-label={onFaultTrees ? "Fault tree" : "Event tree"} value={targetIds[0] ?? ""} disabled={options.length === 0} onChange={(event) => set(onFaultTrees ? { faultTreeId: event.target.value } : { treeId: event.target.value })}>
                    {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
              )}
            </div>
            {editable && (
              <div className="esq-run-actions">
                {activeId !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => stop(activeId)}>Stop</button>}
                <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={running || blocked !== null || !ready} onClick={run}>
                  {running ? "Running…" : `Run dependencies${batch ? " batch" : ""}`}
                </button>
              </div>
            )}
          </div>

          <div className="syft-analysis__advanced-panel" aria-label="Dependency quantification settings">
            <div className="syft-analysis__advanced">
              {!sampledGrid && (
                <>
                  <label>
                    <span>Importance</span>
                    <select aria-label="Importance under dependencies" value={settings.importance ? "ON" : "OFF"} onChange={(event) => set({ importance: event.target.value === "ON" })}>
                      <option value="OFF">Off</option>
                      <option value="ON">On</option>
                    </select>
                  </label>
                  {uncertainty && settings.importance && (
                    <label>
                      <span>Events sampled for importance</span>
                      <ComposerNumber label="Events sampled for importance" value={settings.importanceEvents} min={1} max={LISTED_EVENTS_LIMIT} step={1} onTyped={(typed) => {
                        const value = Math.round(Number(typed));
                        if (value >= 1) set({ importanceEvents: Math.min(value, LISTED_EVENTS_LIMIT) });
                      }} />
                    </label>
                  )}
                </>
              )}
              {!uncertainty && (
                <>
                  <label>
                    <span>Ranked cut sets</span>
                    <select aria-label="Ranked cut sets" value={cutSetChoice} onChange={(event) => {
                      const cutSets = optionOf(CUT_SETS, event.target.value);
                      if (cutSets !== undefined) set({ cutSets });
                    }}>
                      {CUT_SETS.filter(([option]) => !onFaultTrees || option !== "FAILED_EVENTS_AND_SEQUENCE").map(([option, text]) => <option key={option} value={option}>{text}</option>)}
                    </select>
                  </label>
                  {cutSetChoice !== "NONE" && (
                    <>
                      <label>
                        <span>Cut sets kept</span>
                        <ComposerNumber label="Cut sets kept" value={settings.keep} min={1} max={KEEP_LIMIT} step={1} invalid={!keepValid} onTyped={(typed) => set({ keep: Math.round(Number(typed)) })} />
                      </label>
                      <label>
                        <span>Maximum cut set order</span>
                        <input aria-label="Maximum cut set order" type="number" min={1} step={1} placeholder="No limit" value={settings.limitOrder ?? ""} onChange={(event) => {
                          const value = Math.round(Number(event.target.value));
                          set({ limitOrder: event.target.value.trim().length === 0 || !(value >= 1) ? null : value });
                        }} />
                      </label>
                      <label>
                        <span>Cut set cutoff</span>
                        <select aria-label="Cut set cutoff" value={settings.cutOff ?? ""} onChange={(event) => set({ cutOff: event.target.value === "" ? null : Number(event.target.value) })}>
                          <option value="">None</option>
                          {CUT_OFF_EXPONENTS.map((exponent) => <option key={exponent} value={exponent}>{decadeText(exponent)}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Causes per cut set</span>
                        <input aria-label="Causes per cut set" type="number" min={1} max={LISTED_EVENTS_LIMIT} step={1} placeholder="Off" value={settings.causes ?? ""} onChange={(event) => {
                          const value = Math.round(Number(event.target.value));
                          set({ causes: event.target.value.trim().length === 0 || !(value >= 1) ? null : Math.min(value, LISTED_EVENTS_LIMIT) });
                        }} />
                      </label>
                    </>
                  )}
                </>
              )}
              {uncertainty && <SamplingFields sampling={sampling} seedDraft={seedDraft} onChange={(patch) => setSampling((current) => ({ ...current, ...patch }))} onSeedDraft={setSeedDraft} />}
            </div>
          </div>
        </div>
      </div>
      {saveNotice !== null && <p className="syft-analysis__notice" role="status">{saveNotice}</p>}
      {running && live === null && studyTotal === 0 && <p className="syft-analysis__notice" role="status">Building the event trees for PRAXIS</p>}
      {problem !== undefined && <p className="syft-analysis__error" role="alert">{problem}</p>}
      {error !== null && <p className="syft-analysis__error" role="alert">{error}</p>}
      {settings.evidence !== "BASE" && (
        <EsqDependencyEvidence configuration={configuration} network={network} evidence={settings.evidence} batchInput={batchInput} running={running} open={evidenceOpen} onBatchInput={(next) => hold({ batchInput: next })} onOpen={setEvidenceOpen} />
      )}
      {showsModelRun && <div className="esq-dep__run">{modelRuns.render(live)}</div>}
      {shownStudy !== null && !onFaultTrees && <EsqDependencyResults study={shownStudy} model={model} />}
      {shownStudy !== null && onFaultTrees && <EsqFaultTreeDependencyResults study={shownStudy} faultTrees={faultTrees} network={network} />}
    </>
  );
}

function EsqDependencies({ model, modelRuns, session, onSession }: {
  model: EsqModel;
  modelRuns: DependencyModelRuns;
  session: DependencySession;
  onSession: DependencySessionChange;
}): JSX.Element {
  const { esq, runtime } = useEsqWorkbook();
  const [networkId, setNetworkId] = useWorkbookView<string>("solve.dependency.network", "", NETWORK_VIEW);
  const network = esq.bayesianNetworks.find((candidate) => candidate.modelId === networkId) ?? esq.bayesianNetworks[0];
  const configuration = network === undefined ? undefined : configurationOf(esq.hclConfigurations, network.modelId);
  const faultTrees = useDependencyFaultTrees();
  const jobLabel = useMemo(() => esqJobLabel(esq, model), [esq, model]);

  return (
    <section className="syft-analysis esq-dep-tab" aria-label="Dependencies">
      <div className="syft-analysis__heading">
        <h3>Dependencies</h3>
        <AnalysisJobs host="esq" workbookId={runtime.workbookId} modelLabel={jobLabel} />
      </div>
      <EsqDependencyNetwork network={network} faultTreeOptions={faultTrees} onNetwork={setNetworkId} />
      {network !== undefined && configuration !== undefined && (
        <DependencyRuns key={configuration.modelId} model={model} network={network} configuration={configuration} faultTrees={faultTrees} modelRuns={modelRuns} session={session} onSession={onSession} />
      )}
    </section>
  );
}

export {
  EsqDependencies,
  IDLE_DEPENDENCY_SESSION,
  type DependencyCutSetChoice,
  type DependencyModelRuns,
  type DependencySession,
  type DependencyStudy,
  type DependencyStudyTree,
  type DependencyTarget,
};
