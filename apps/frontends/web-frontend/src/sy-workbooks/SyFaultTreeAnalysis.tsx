import { useState, type JSX } from "react";
import type {
  FaultTreeAlgorithm,
  FaultTreeAnalysisResult,
  FaultTreeAnalysisSettings,
  FaultTreeCalculationType,
  FaultTreeExecuteRequest,
  FaultTreeWorkflow,
} from "interfaces-shared-types/newly-developed-methods/fault-tree";
import { FaultTreeResults } from "../newly-developed-methods/fault-tree";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
import { useSyWorkbook } from "./syWorkbookContext";
import "./css/syFaultTreeAnalysis.css";

type FaultTreeRunConfiguration = Pick<FaultTreeExecuteRequest, "calculationType" | "workflow" | "settings">;

interface FaultTreeRunModelOption {
  id: string;
  label: string;
}

interface Props {
  exactResult: FaultTreeAnalysisResult | null;
  batchResults: FaultTreeAnalysisResult[];
  exactResultIsStale: boolean;
  exactRunError: string | null;
  exactRunning: boolean;
  sourceWarning: string | null;
  currentModelId: string;
  defaultMissionTimeHours?: number;
  models: FaultTreeRunModelOption[];
  basicEventCodes: Readonly<Record<string, string>>;
  onRun: (configuration: FaultTreeRunConfiguration, modelIds: string[]) => void;
}

const DEFAULT_SETTINGS: FaultTreeAnalysisSettings = {
  algorithm: "BDD",
  approximation: "EXACT",
  variableOrder: "DFS",
  reorderBudgetSeconds: 60,
  expandCcf: false,
  numTrials: 10_000,
  seed: 847,
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

const ALGORITHM_LABELS: Record<FaultTreeAlgorithm, string> = {
  BDD: "BDD exact probability",
  ZBDD: "ZBDD cut sets",
  ZBDD_DIRECT: "Direct ZBDD",
  ZBDD_DELTERM: "ZBDD deletion-term",
  MOCUS: "MOCUS",
  MOCUS_PI: "MOCUS prime implicants",
  MONTE_CARLO: "Monte Carlo",
};

const CUT_SET_ALGORITHMS: FaultTreeAlgorithm[] = ["ZBDD", "ZBDD_DIRECT", "ZBDD_DELTERM", "MOCUS", "MOCUS_PI"];

function algorithmsFor(calculationType: FaultTreeCalculationType): FaultTreeAlgorithm[] {
  if (calculationType === "CUT_SETS" || calculationType === "PROBABILITY_AND_CUT_SETS") return CUT_SET_ALGORITHMS;
  if (calculationType === "IMPORTANCE" || calculationType === "UNCERTAINTY" || calculationType === "SIL") return ["BDD"];
  return ["BDD", "ZBDD", "ZBDD_DIRECT", "ZBDD_DELTERM", "MOCUS", "MOCUS_PI", "MONTE_CARLO"];
}

function defaultAlgorithm(calculationType: FaultTreeCalculationType): FaultTreeAlgorithm {
  return calculationType === "CUT_SETS" || calculationType === "PROBABILITY_AND_CUT_SETS" ? "ZBDD" : "BDD";
}

function calculationLabel(calculationType: FaultTreeCalculationType): string {
  return ({
    PROBABILITY: "probability",
    CUT_SETS: "cut sets",
    PROBABILITY_AND_CUT_SETS: "probability and cut sets",
    IMPORTANCE: "importance",
    UNCERTAINTY: "uncertainty",
    SIL: "SIL",
  } satisfies Record<FaultTreeCalculationType, string>)[calculationType];
}

export function SyFaultTreeAnalysis({
  exactResult,
  batchResults,
  exactResultIsStale,
  exactRunError,
  exactRunning,
  sourceWarning,
  currentModelId,
  defaultMissionTimeHours,
  models,
  basicEventCodes,
  onRun,
}: Props): JSX.Element {
  const { editable, runtime } = useSyWorkbook();
  const saveBlockedReason = analysisSaveBlock(runtime);
  const [calculationType, setCalculationType] = useState<FaultTreeCalculationType>("PROBABILITY");
  const [workflow, setWorkflow] = useState<FaultTreeWorkflow>("MANUAL");
  const [settings, setSettings] = useState<FaultTreeAnalysisSettings>(() => ({
    ...DEFAULT_SETTINGS,
    missionTimeHours: defaultMissionTimeHours ?? DEFAULT_SETTINGS.missionTimeHours,
  }));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [batchModelIds, setBatchModelIds] = useState<string[]>([currentModelId]);
  const algorithms = algorithmsFor(calculationType);
  const usesCutSetApproximation = CUT_SET_ALGORITHMS.includes(settings.algorithm);
  const usesOrdering = !["MOCUS", "MOCUS_PI", "MONTE_CARLO"].includes(settings.algorithm);
  const usesLimits = ["PROBABILITY", "CUT_SETS", "PROBABILITY_AND_CUT_SETS"].includes(calculationType)
    && settings.algorithm !== "MONTE_CARLO";
  const usesTrials = calculationType === "UNCERTAINTY" || settings.algorithm === "MONTE_CARLO";
  const selectedModelIds = workflow === "MANUAL" ? [currentModelId] : batchModelIds;
  const settingsValid =
    (!usesOrdering || !["SIFT", "GSIFT", "ILS"].includes(settings.variableOrder)
      || (Number.isFinite(settings.reorderBudgetSeconds) && settings.reorderBudgetSeconds > 0))
    && (!usesTrials || (Number.isInteger(settings.numTrials) && settings.numTrials > 0
      && Number.isInteger(settings.seed) && settings.seed >= 0))
    && (calculationType !== "SIL" || (Number.isFinite(settings.missionTimeHours) && settings.missionTimeHours > 0))
    && (!usesLimits || settings.limitOrder === undefined || (Number.isInteger(settings.limitOrder) && settings.limitOrder > 0))
    && (!usesLimits || settings.cutOff === undefined || (Number.isFinite(settings.cutOff) && settings.cutOff >= 0 && settings.cutOff <= 1))
    && (settings.algorithm !== "MONTE_CARLO" || !settings.earlyStop
      || (Number.isFinite(settings.convergenceDelta) && settings.convergenceDelta > 0
        && Number.isFinite(settings.confidenceLevel) && settings.confidenceLevel > 0 && settings.confidenceLevel < 1
        && Number.isInteger(settings.burnInTrials) && settings.burnInTrials >= 0))
    && (settings.algorithm !== "MONTE_CARLO" || settings.varianceReduction !== "IMPORTANCE_SAMPLING"
      || (Number.isFinite(settings.importanceSamplingBiasFactor) && settings.importanceSamplingBiasFactor > 0
        && Number.isInteger(settings.importanceSamplingMaxEvents) && settings.importanceSamplingMaxEvents >= 0
        && Number.isFinite(settings.importanceSamplingMinimumProbability) && settings.importanceSamplingMinimumProbability > 0 && settings.importanceSamplingMinimumProbability < 0.5))
    && (settings.algorithm !== "MONTE_CARLO" || settings.varianceReduction !== "STRATIFIED_SAMPLING"
      || (Number.isInteger(settings.stratifyEvents) && settings.stratifyEvents > 0));

  function updateSettings(changes: Partial<FaultTreeAnalysisSettings>): void {
    setSettings((current) => ({ ...current, ...changes }));
  }

  function changeCalculation(value: FaultTreeCalculationType): void {
    const algorithm = defaultAlgorithm(value);
    setCalculationType(value);
    setSettings((current) => ({ ...current, algorithm, approximation: "EXACT" }));
  }

  function changeAlgorithm(algorithm: FaultTreeAlgorithm): void {
    updateSettings({
      algorithm,
      approximation: ["ZBDD_DIRECT", "ZBDD_DELTERM", "MOCUS", "MOCUS_PI"].includes(algorithm) ? "MCUB" : "EXACT",
    });
  }

  function toggleBatchModel(modelId: string): void {
    setBatchModelIds((current) =>
      current.includes(modelId) ? current.filter((id) => id !== modelId) : [...current, modelId],
    );
  }

  return (
    <section className="syft-analysis" aria-label="Fault-tree quantification">
      <div className="syft-analysis__heading"><h3>Fault-tree quantification</h3></div>
      <div className={`syft-analysis__composer syft-analysis__composer--${workflow.toLowerCase()}`} aria-label="Fault-tree quantification controls">
        <fieldset className="syft-analysis__calculation-picker">
          <legend>Calculation</legend>
          <div role="radiogroup" aria-label="Fault-tree calculation">
            {([
              ["PROBABILITY", "Probability"],
              ["CUT_SETS", "Cut sets"],
              ["PROBABILITY_AND_CUT_SETS", "Probability + cut sets"],
              ["IMPORTANCE", "Importance"],
              ["SIL", "SIL"],
            ] as const).map(([value, label]) => (
              <label key={value} className={calculationType === value ? "is-selected" : ""}>
                <input type="radio" name="fault-tree-calculation" value={value} checked={calculationType === value} onChange={() => changeCalculation(value)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="syft-analysis__workflow-picker">
          <legend>Workflow</legend>
          <div role="radiogroup" aria-label="Fault-tree workflow">
            {(["MANUAL", "BATCH"] as const).map((value) => (
              <label key={value} className={workflow === value ? "is-selected" : ""}>
                <input type="radio" name="fault-tree-workflow" value={value} checked={workflow === value} onChange={() => setWorkflow(value)} />
                <span>{value === "MANUAL" ? "Manual" : "Batch"}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="syft-analysis__run-composer">
          <div className="syft-analysis__setup-row">
            <span className="syft-analysis__selection-summary">
              {workflow === "BATCH" ? `${selectedModelIds.length} fault tree${selectedModelIds.length === 1 ? "" : "s"} selected` : "Current fault tree"}
            </span>
            <button type="button" className="posnav__btn posnav__btn--sm" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>Advanced</button>
          </div>

          {workflow === "BATCH" && (
            <fieldset className="syft-analysis__batch-models">
              <legend>Fault trees</legend>
              {models.map((model) => (
                <label key={model.id}>
                  <input type="checkbox" checked={batchModelIds.includes(model.id)} onChange={() => toggleBatchModel(model.id)} />
                  <span>{model.label}</span>
                </label>
              ))}
            </fieldset>
          )}

        <div className="syft-analysis__execution-row">
          <div className="syft-analysis__run-fields">
            <label className="syft-analysis__run-field">
              <span>Algorithm</span>
              <select aria-label="Fault-tree algorithm" value={settings.algorithm} onChange={(event) => changeAlgorithm(event.target.value as FaultTreeAlgorithm)}>
                {algorithms.map((algorithm) => <option key={algorithm} value={algorithm}>{ALGORITHM_LABELS[algorithm]}</option>)}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="posnav__btn posnav__btn--sm posnav__btn--primary"
            disabled={exactRunning || !editable || saveBlockedReason !== null || selectedModelIds.length === 0 || !settingsValid}
            onClick={() => onRun({ calculationType, workflow, settings }, selectedModelIds)}
          >
            {exactRunning ? "Running…" : `Run ${calculationLabel(calculationType)}${workflow === "BATCH" ? " batch" : ""}`}
          </button>
        </div>

        {advancedOpen && (
          <div className="syft-analysis__advanced-panel" aria-label="Advanced fault-tree settings">
            <div className="syft-analysis__advanced-head">
              <strong>Advanced</strong>
              <button type="button" className="posnav__btn posnav__btn--sm" aria-label="Close advanced fault-tree settings" onClick={() => setAdvancedOpen(false)}>Close</button>
            </div>
            <div className="syft-analysis__advanced">
            {usesCutSetApproximation && (
              <label>
                <span>Probability method</span>
                <select aria-label="Fault-tree probability method" value={settings.approximation} onChange={(event) => updateSettings({ approximation: event.target.value as FaultTreeAnalysisSettings["approximation"] })}>
                  {settings.algorithm === "ZBDD" && <option value="EXACT">Exact</option>}
                  <option value="RARE_EVENT">Rare event</option>
                  <option value="MCUB">Minimal cut upper bound</option>
                </select>
              </label>
            )}
            {usesLimits && (
              <>
                <label><span>Maximum cut-set order</span><input aria-label="Maximum cut-set order" type="number" min="1" value={settings.limitOrder ?? ""} placeholder="No limit" onChange={(event) => updateSettings({ limitOrder: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
                <label><span>Cut-off probability</span><input aria-label="Cut-off probability" type="number" min="0" max="1" step="any" value={settings.cutOff ?? ""} placeholder="No cut-off" onChange={(event) => updateSettings({ cutOff: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
              </>
            )}
            {usesOrdering && (
              <>
                <label>
                  <span>Variable order</span>
                  <select aria-label="Fault-tree variable order" value={settings.variableOrder} onChange={(event) => updateSettings({ variableOrder: event.target.value as FaultTreeAnalysisSettings["variableOrder"] })}>
                    <option value="DFS">DFS</option><option value="FORCE">FORCE</option><option value="SLOAN">Sloan</option>
                    <option value="DFS_SCRAM">DFS SCRAM</option><option value="DFS_PLAIN">DFS plain</option><option value="REVERSE">Reverse</option>
                    <option value="SIFT">Sift</option><option value="GSIFT">Group sift</option><option value="ILS">Iterated local search</option>
                  </select>
                </label>
                {["SIFT", "GSIFT", "ILS"].includes(settings.variableOrder) && (
                  <label><span>Reorder budget (seconds)</span><input aria-label="Reorder budget seconds" type="number" min="0.01" step="any" value={settings.reorderBudgetSeconds} onChange={(event) => updateSettings({ reorderBudgetSeconds: Number(event.target.value) })} /></label>
                )}
              </>
            )}
            {usesTrials && (
              <>
                <label><span>Trials</span><input aria-label="Fault-tree trials" type="number" min="1" step="1" value={settings.numTrials} onChange={(event) => updateSettings({ numTrials: Number(event.target.value) })} /></label>
                <label><span>Seed</span><input aria-label="Fault-tree seed" type="number" min="0" step="1" value={settings.seed} onChange={(event) => updateSettings({ seed: Number(event.target.value) })} /></label>
              </>
            )}
            {settings.algorithm === "MONTE_CARLO" && (
              <>
                <label className="syft-analysis__check"><input type="checkbox" checked={settings.earlyStop} onChange={(event) => updateSettings({ earlyStop: event.target.checked, ...(event.target.checked ? { varianceReduction: "NONE" } : {}) })} /><span>Stop when converged</span></label>
                <label>
                  <span>Variance reduction</span>
                  <select aria-label="Monte Carlo variance reduction" value={settings.varianceReduction} onChange={(event) => {
                    const varianceReduction = event.target.value as FaultTreeAnalysisSettings["varianceReduction"];
                    updateSettings({ varianceReduction, ...(varianceReduction === "NONE" ? {} : { earlyStop: false }) });
                  }}>
                    <option value="NONE">None</option>
                    <option value="IMPORTANCE_SAMPLING">Importance sampling</option>
                    <option value="STRATIFIED_SAMPLING">Stratified sampling</option>
                  </select>
                </label>
                {settings.earlyStop && (
                  <>
                    <label><span>Relative error target</span><input aria-label="Monte Carlo convergence delta" type="number" min="0.000001" step="any" value={settings.convergenceDelta} onChange={(event) => updateSettings({ convergenceDelta: Number(event.target.value) })} /></label>
                    <label><span>Confidence</span><input aria-label="Monte Carlo confidence" type="number" min="0.01" max="0.999999" step="any" value={settings.confidenceLevel} onChange={(event) => updateSettings({ confidenceLevel: Number(event.target.value) })} /></label>
                    <label><span>Burn-in trials</span><input aria-label="Monte Carlo burn-in trials" type="number" min="0" step="1" value={settings.burnInTrials} onChange={(event) => updateSettings({ burnInTrials: Number(event.target.value) })} /></label>
                  </>
                )}
                {settings.varianceReduction === "IMPORTANCE_SAMPLING" && (
                  <>
                    <label><span>Bias factor</span><input aria-label="Importance sampling bias factor" type="number" min="0.000001" step="any" value={settings.importanceSamplingBiasFactor} onChange={(event) => updateSettings({ importanceSamplingBiasFactor: Number(event.target.value) })} /></label>
                    <label><span>Maximum biased events</span><input aria-label="Importance sampling maximum events" type="number" min="0" step="1" value={settings.importanceSamplingMaxEvents} onChange={(event) => updateSettings({ importanceSamplingMaxEvents: Number(event.target.value) })} /></label>
                    <label><span>Minimum sampling probability</span><input aria-label="Importance sampling minimum probability" type="number" min="0" max="0.499999" step="any" value={settings.importanceSamplingMinimumProbability} onChange={(event) => updateSettings({ importanceSamplingMinimumProbability: Number(event.target.value) })} /></label>
                  </>
                )}
                {settings.varianceReduction === "STRATIFIED_SAMPLING" && (
                  <label><span>Stratified events</span><input aria-label="Stratified sampling events" type="number" min="1" step="1" value={settings.stratifyEvents} onChange={(event) => updateSettings({ stratifyEvents: Number(event.target.value) })} /></label>
                )}
              </>
            )}
            {calculationType === "SIL" && (
              <label><span>Mission time (hours)</span><input aria-label="Mission time hours" type="number" min="0.01" step="any" value={settings.missionTimeHours} onChange={(event) => updateSettings({ missionTimeHours: Number(event.target.value) })} /></label>
            )}
            <label className="syft-analysis__check"><input type="checkbox" checked={settings.expandCcf} onChange={(event) => updateSettings({ expandCcf: event.target.checked })} /><span>Expand common-cause groups</span></label>
            </div>
          </div>
        )}

        </div>
      </div>
      {saveBlockedReason !== null && <p className="syft-analysis__notice" role="status">{saveBlockedReason}</p>}
      {(exactRunError ?? sourceWarning) !== null && <p className="syft-analysis__error" role="alert">{exactRunError ?? sourceWarning}</p>}
      {workflow === "MANUAL" ? (
        <FaultTreeResults analysisResult={exactResult} resultIsStale={exactResultIsStale} basicEventCodes={basicEventCodes} />
      ) : batchResults.length > 0 ? (
        <section className="syft-analysis__batch-results" aria-label="Fault-tree batch results">
          <h3>Batch results</h3>
          {batchResults.map((result) => (
            <div key={result.runId} className="syft-analysis__batch-result">
              <strong>{models.find((model) => model.id === result.owner.modelId)?.label ?? result.owner.modelId}</strong>
              <FaultTreeResults analysisResult={result} resultIsStale={false} basicEventCodes={basicEventCodes} />
            </div>
          ))}
        </section>
      ) : null}
    </section>
  );
}

export type { FaultTreeRunConfiguration, FaultTreeRunModelOption };
