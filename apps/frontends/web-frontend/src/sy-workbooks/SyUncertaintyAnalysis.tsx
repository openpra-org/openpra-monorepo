import { useEffect, useMemo, useState, type JSX } from "react";
import type { FaultTreeAnalysisResult, FaultTreeAnalysisSettings, FaultTreeUncertaintyResult, FaultTreeWorkflow } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import type { UncertaintySamplingMethod } from "interfaces-shared-types/newly-developed-methods/shared";
import { ResultCsvButton } from "../newly-developed-methods/shared/resultPresentation";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
import { useAnalysisSourceGuard } from "../newly-developed-methods/shared/useAnalysisSourceGuard";
import { getSyFaultTreeResult, runSyFaultTree, validateSyFaultTree } from "./syWorkbookApi";
import { useSyWorkbook } from "./syWorkbookContext";
import { linkedMissionTimeTable } from "./syMissionTimes";
import { runReadiness } from "./syUncertainty";
import { isSystemLevelModel } from "./sySelectors";
import "./css/syFaultTreeAnalysis.css";
import "./css/syUncertainty.css";

interface AnalysisResult { modelId: string; label: string; distributionCount: number; result: FaultTreeAnalysisResult }

interface SampleBin { lower: number; upper: number; count: number }

const SAMPLING_LABELS: Record<UncertaintySamplingMethod, string> = {
  MONTE_CARLO: "Monte Carlo",
  LATIN_HYPERCUBE: "Latin hypercube",
};

const SAMPLING_METHODS: readonly UncertaintySamplingMethod[] = ["MONTE_CARLO", "LATIN_HYPERCUBE"];

const BIN_COUNT = 12;

const DEFAULT_SETTINGS: FaultTreeAnalysisSettings = {
  algorithm: "BDD",
  approximation: "EXACT",
  variableOrder: "DFS",
  reorderBudgetSeconds: 60,
  expandCcf: true,
  numTrials: 10_000,
  seed: 847,
  samplingMethod: "MONTE_CARLO",
  missionTimeHours: 8_760,
  earlyStop: false,
  convergenceDelta: 0.1,
  confidenceLevel: 0.95,
  burnInTrials: 0,
  varianceReduction: "NONE",
  importanceSamplingBiasFactor: 10,
  importanceSamplingMaxEvents: 32,
  importanceSamplingMinimumProbability: 1e-12,
  stratifyEvents: 4,
};

function probability(value: number): string {
  return Number.isFinite(value) ? value.toExponential(3).toUpperCase() : "—";
}

function isSamplingMethod(value: string): value is UncertaintySamplingMethod {
  return SAMPLING_METHODS.some((method) => method === value);
}

function sampleBins(samples: readonly number[]): SampleBin[] {
  const sorted = [...samples].sort((left, right) => left - right);
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];
  if (lowest === undefined || highest === undefined) return [];
  if (lowest === highest) return [{ lower: lowest, upper: highest, count: sorted.length }];
  const logarithmic = lowest > 0 && highest / lowest >= 100;
  const edge = (index: number): number => (logarithmic
    ? lowest * (highest / lowest) ** (index / BIN_COUNT)
    : lowest + ((highest - lowest) * index) / BIN_COUNT);
  return Array.from({ length: BIN_COUNT }, (_, index) => {
    const lower = edge(index);
    const upper = index === BIN_COUNT - 1 ? highest : edge(index + 1);
    const count = sorted.filter((value) => value >= lower && (index === BIN_COUNT - 1 ? value <= upper : value < upper)).length;
    return { lower, upper, count };
  });
}

function SampleView({ label, uncertainty }: { label: string; uncertainty: FaultTreeUncertaintyResult }): JSX.Element {
  const [open, setOpen] = useState(false);
  const bins = useMemo(() => (open ? sampleBins(uncertainty.samples) : []), [open, uncertainty.samples]);
  const largest = Math.max(1, ...bins.map((bin) => bin.count));
  return (
    <div className="syunc-analysis__samples">
      <div className="syunc-analysis__samples-head">
        <button type="button" className="posnav__btn posnav__btn--sm" aria-expanded={open} onClick={() => setOpen((current) => !current)}>{open ? "Hide samples" : "Show samples"}</button>
        <ResultCsvButton filename={`${label} samples.csv`} records={() => [...uncertainty.samples].sort((left, right) => left - right).map((value, index) => ({ rank: index + 1, top_event_probability: value }))} />
      </div>
      {open && (
        <table className="sy-review-table syunc-analysis__bins" aria-label={`Samples for ${label}`}>
          <thead><tr><th scope="col">From</th><th scope="col">To</th><th scope="col">Samples</th></tr></thead>
          <tbody>
            {bins.map((bin) => (
              <tr key={`${bin.lower}:${bin.upper}`}>
                <td className="posmono">{probability(bin.lower)}</td>
                <td className="posmono">{probability(bin.upper)}</td>
                <td>
                  <div className="syunc-analysis__bin">
                    <span className="syunc-analysis__bin-count">{bin.count.toLocaleString()}</span>
                    <span className="syunc-analysis__bin-track"><span className="syunc-analysis__bin-fill" style={{ width: `${(bin.count / largest) * 100}%` }} /></span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SyUncertaintyAnalysis({ selectedModelId }: { selectedModelId?: string } = {}): JSX.Element {
  const { sy, controlledParameters, editable, runtime, links } = useSyWorkbook();
  const { sourceWarning } = useAnalysisSourceGuard("sy", runtime.workbookId);
  const saveBlockedReason = analysisSaveBlock(runtime);
  const modelOptions = useMemo(() => sy.systemLogicModels
    .filter((model) => model.topGate !== null && !isSystemLevelModel(model))
    .map((model) => {
      const readiness = runReadiness(sy, model, controlledParameters, linkedMissionTimeTable(links));
      return {
        id: model.uuid,
        label: `${sy.systemDefinitions.find(({ uuid }) => uuid === model.systemReference)?.abbreviation ?? model.systemReference} · ${model.code} · ${model.name}`,
        distributionCount: readiness.inputs.filter((input) => input.uncertain).length,
        state: readiness.state,
        message: readiness.message,
      };
    }), [sy, controlledParameters, links]);
  const [workflow, setWorkflow] = useState<FaultTreeWorkflow>("MANUAL");
  const [modelId, setModelId] = useState("");
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<FaultTreeAnalysisSettings>(DEFAULT_SETTINGS);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisResult[]>([]);

  const runnable = useMemo(() => modelOptions.filter(({ state }) => state === "READY"), [modelOptions]);
  useEffect(() => {
    if (!modelOptions.some(({ id }) => id === modelId)) setModelId(runnable[0]?.id ?? modelOptions[0]?.id ?? "");
    setBatchIds((current) => {
      const ids = new Set(runnable.map(({ id }) => id));
      const kept = current.filter((id) => ids.has(id));
      return kept.length > 0 ? kept : [...ids];
    });
  }, [modelOptions, runnable, modelId]);
  const activeModelId = selectedModelId ?? modelId;
  useEffect(() => { setResults([]); setError(null); }, [activeModelId]);
  const selectedModel = modelOptions.find(({ id }) => id === activeModelId);
  const selectedIds = workflow === "MANUAL"
    ? (runnable.some(({ id }) => id === activeModelId) ? [activeModelId] : [])
    : batchIds.filter((id) => runnable.some((model) => model.id === id));
  const stale = results.some(({ result }) => runtime.saveStatus !== "saved" || runtime.revision === null || result.owner.workbookRevision !== runtime.revision);
  const settingsValid = Number.isInteger(settings.numTrials) && settings.numTrials > 0 && settings.numTrials <= 1_000_000_000
    && Number.isInteger(settings.seed) && settings.seed >= 0
    && (!["SIFT", "GSIFT", "ILS"].includes(settings.variableOrder) || (Number.isFinite(settings.reorderBudgetSeconds) && settings.reorderBudgetSeconds > 0));

  function updateSettings(changes: Partial<FaultTreeAnalysisSettings>): void {
    setSettings((current) => ({ ...current, ...changes }));
  }

  function toggleBatch(id: string): void {
    setBatchIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function run(): Promise<void> {
    if (!editable || runtime.workbookId === null || runtime.revision === null || selectedIds.length === 0 || !settingsValid) return;
    setRunning(true);
    setError(null);
    setResults([]);
    const completed: AnalysisResult[] = [];
    const failures: string[] = [];
    for (const id of selectedIds) {
      const model = runnable.find((candidate) => candidate.id === id);
      if (model === undefined) continue;
      try {
        const validation = await validateSyFaultTree(runtime.workbookId, model.id, runtime.revision);
        if (!validation.validation.valid) throw new Error(validation.validation.issues[0]?.message ?? "The fault tree is not ready for analysis.");
        const execution = await runSyFaultTree(runtime.workbookId, model.id, runtime.revision, {
          calculationType: "UNCERTAINTY",
          workflow,
          settings,
        });
        if (execution.run.status !== "SUCCEEDED") throw new Error(execution.run.failure?.message ?? `The solver run ended with ${execution.run.status}.`);
        const result = await getSyFaultTreeResult(runtime.workbookId, model.id, execution.run.id);
        if (result.uncertainty === undefined) throw new Error("The solver returned no uncertainty summary.");
        completed.push({ modelId: model.id, label: model.label, distributionCount: model.distributionCount, result });
        setResults([...completed]);
      } catch (caught) {
        failures.push(`${model.label}: ${caught instanceof Error ? caught.message : "Uncertainty analysis failed."}`);
        if (workflow === "MANUAL") break;
      }
    }
    if (failures.length > 0) setError(failures.join(" "));
    setRunning(false);
  }

  return (
    <section className="syft-analysis syunc-analysis" aria-label="Uncertainty analysis">
      <div className="syft-analysis__heading"><h3>Uncertainty analysis</h3></div>
      <div className={`syft-analysis__composer syft-analysis__composer--${workflow.toLowerCase()}`} aria-label="Uncertainty analysis controls">
        <fieldset className="syft-analysis__workflow-picker">
          <legend>Workflow</legend>
          <div role="radiogroup" aria-label="Uncertainty workflow">
            {(["MANUAL", "BATCH"] as const).map((value) => (
              <label key={value} className={workflow === value ? "is-selected" : ""}>
                <input type="radio" name="syunc-workflow" value={value} checked={workflow === value} onChange={() => setWorkflow(value)} />
                <span>{value === "MANUAL" ? "Manual" : "Batch"}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="syft-analysis__run-composer">
          <div className="syft-analysis__setup-row">
            <span className="syft-analysis__selection-summary">{workflow === "BATCH" ? `${selectedIds.length} fault tree${selectedIds.length === 1 ? "" : "s"} selected` : "Analyze one fault tree"}</span>
            <button type="button" className="posnav__btn posnav__btn--sm" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>Advanced</button>
          </div>
          {workflow === "BATCH" ? (
            <fieldset className="syft-analysis__batch-models">
              <legend>Fault trees</legend>
              {modelOptions.map((model) => {
                const canRun = runnable.some(({ id }) => id === model.id);
                return <label key={model.id} className={canRun ? undefined : "syunc-analysis__unavailable"}><input type="checkbox" checked={batchIds.includes(model.id)} disabled={!canRun} onChange={() => toggleBatch(model.id)} /><span>{model.label}{!canRun && <small> · {model.state === "NO_INPUTS" ? "No uncertain values" : "Set every basic event value"}</small>}</span></label>;
              })}
            </fieldset>
          ) : selectedModelId === undefined && modelOptions.length > 0 ? (
            <label className="syunc-analysis__model"><span>Fault tree</span><select aria-label="Uncertainty fault tree" value={modelId} onChange={(event) => setModelId(event.target.value)}>
              {modelOptions.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
            </select></label>
          ) : null}
          <div className="syft-analysis__execution-row">
            <div className="syft-analysis__run-fields">
              <label className="syft-analysis__run-field"><span>Algorithm</span><select aria-label="Uncertainty algorithm" value="BDD" disabled><option value="BDD">BDD exact probability</option></select></label>
              <label className="syft-analysis__run-field"><span>Sampling</span><select aria-label="Uncertainty sampling method" value={settings.samplingMethod} onChange={(event) => { if (isSamplingMethod(event.target.value)) updateSettings({ samplingMethod: event.target.value }); }}>
                {SAMPLING_METHODS.map((method) => <option key={method} value={method}>{SAMPLING_LABELS[method]}</option>)}
              </select></label>
            </div>
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={running || !editable || saveBlockedReason !== null || sourceWarning !== null || selectedIds.length === 0 || !settingsValid} onClick={() => { void run(); }}>
              {running ? "Running…" : `Run uncertainty${workflow === "BATCH" ? " batch" : ""}`}
            </button>
          </div>
          {advancedOpen && <div className="syft-analysis__advanced-panel" role="region" aria-label="Advanced uncertainty settings">
            <div className="syft-analysis__advanced-head"><strong>Advanced</strong><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setAdvancedOpen(false)}>Close</button></div>
            <div className="syft-analysis__advanced">
              <>
                <label><span>Samples</span><input aria-label="Uncertainty samples" type="number" min="1" step="1" value={settings.numTrials} onChange={(event) => updateSettings({ numTrials: Number(event.target.value) })} /></label>
                <label><span>Seed</span><input aria-label="Uncertainty seed" type="number" min="0" step="1" value={settings.seed} onChange={(event) => updateSettings({ seed: Number(event.target.value) })} /></label>
              </>
              <label><span>Variable order</span><select aria-label="Uncertainty variable order" value={settings.variableOrder} onChange={(event) => updateSettings({ variableOrder: event.target.value as FaultTreeAnalysisSettings["variableOrder"] })}>
                <option value="DFS">DFS</option><option value="FORCE">FORCE</option><option value="SLOAN">Sloan</option><option value="DFS_SCRAM">DFS SCRAM</option><option value="DFS_PLAIN">DFS plain</option><option value="REVERSE">Reverse</option><option value="SIFT">Sift</option><option value="GSIFT">Group sift</option><option value="ILS">Iterated local search</option>
              </select></label>
              {["SIFT", "GSIFT", "ILS"].includes(settings.variableOrder) && <label><span>Reorder budget (seconds)</span><input aria-label="Uncertainty reorder budget" type="number" min="0.01" step="any" value={settings.reorderBudgetSeconds} onChange={(event) => updateSettings({ reorderBudgetSeconds: Number(event.target.value) })} /></label>}
            </div>
          </div>}
        </div>
      </div>
      {modelOptions.length === 0 && <p className="syft-analysis__notice" role="status">There are no detailed fault trees available for analysis.</p>}
      {workflow === "MANUAL" && selectedModel !== undefined && selectedIds.length === 0 && <p className="syft-analysis__notice" role="status">
        {selectedModel.message}
      </p>}
      {workflow === "BATCH" && runnable.length === 0 && <p className="syft-analysis__notice" role="status">Give a basic event an uncertain value, or link a DA estimate that has one.</p>}
      {saveBlockedReason !== null && <p className="syft-analysis__notice" role="status">{saveBlockedReason}</p>}
      {(error ?? sourceWarning) !== null && <p className="syft-analysis__error" role="alert">{error ?? sourceWarning}</p>}
      {stale && <p className="syft-analysis__notice" role="status">These results use an earlier workbook revision.</p>}
      {results.length > 0 && <section className="syunc-analysis__results" aria-label="Uncertainty results">
        <h3>{workflow === "BATCH" ? "Analysis results" : "Analysis result"}</h3>
        {results.map(({ label, distributionCount, result }) => <article key={result.runId} className="syunc-analysis__result">
          <div className="syunc-analysis__result-head"><strong>{label}</strong><span>{distributionCount} uncertain input{distributionCount === 1 ? "" : "s"}</span></div>
          {result.uncertainty !== undefined && <>
            <dl className="syunc-analysis__metrics">
              <div><dt>Point top event</dt><dd>{probability(result.topEventProbability)}</dd></div>
              <div><dt>Mean</dt><dd>{probability(result.uncertainty.mean)}</dd></div>
              <div><dt>Standard deviation</dt><dd>{probability(result.uncertainty.standardDeviation)}</dd></div>
              <div><dt>Standard error</dt><dd>{probability(result.uncertainty.standardError)}</dd></div>
            </dl>
            <div className="syunc-analysis__quantiles" aria-label="Probability quantiles">{result.uncertainty.quantiles.map((quantile) => <div key={quantile.probability}><span>{quantile.probability * 100}% quantile</span><strong>{probability(quantile.value)}</strong></div>)}</div>
            <span className="possubtle">{result.uncertainty.sampleCount.toLocaleString()} {SAMPLING_LABELS[result.uncertainty.samplingMethod]} samples · seed {result.uncertainty.seed}</span>
            <SampleView label={label} uncertainty={result.uncertainty} />
          </>}
        </article>)}
      </section>}
    </section>
  );
}

export { SyUncertaintyAnalysis };
