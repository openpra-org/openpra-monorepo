import { useEffect, useMemo, useState, type JSX } from "react";
import type {
  FaultTreeAlgorithm,
  FaultTreeAnalysisResult,
  FaultTreeAnalysisSettings,
  FaultTreeCalculationType,
  FaultTreeWorkflow,
} from "interfaces-shared-types/newly-developed-methods/fault-tree";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
import { useAnalysisSourceGuard } from "../newly-developed-methods/shared/useAnalysisSourceGuard";
import { PagedResults } from "../newly-developed-methods/shared/resultPresentation";
import { ccfGroupsForModel } from "./syCcf";
import { isSystemLevelModel } from "./sySelectors";
import { getSyFaultTreeResult, runSyFaultTree, validateSyFaultTree } from "./syWorkbookApi";
import { useSyWorkbook } from "./syWorkbookContext";
import "./css/syFaultTreeAnalysis.css";
import "./css/syCcfAnalysis.css";

interface CcfComparisonResult {
  modelId: string;
  modelLabel: string;
  groupIds: string[];
  withoutCcf: FaultTreeAnalysisResult;
  withCcf: FaultTreeAnalysisResult;
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

const ALGORITHM_LABELS: Partial<Record<FaultTreeAlgorithm, string>> = {
  BDD: "BDD exact probability",
  ZBDD: "ZBDD cut sets",
  ZBDD_DIRECT: "Direct ZBDD",
  ZBDD_DELTERM: "ZBDD deletion-term",
  MOCUS: "MOCUS",
  MOCUS_PI: "MOCUS prime implicants",
};

const CUT_SET_ALGORITHMS: FaultTreeAlgorithm[] = ["ZBDD", "ZBDD_DIRECT", "ZBDD_DELTERM", "MOCUS", "MOCUS_PI"];

function probability(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toExponential(3).toUpperCase();
}

function percent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function resultError(status: string, message?: string): Error {
  if (status === "FAILED") return new Error(message ?? "PRAXIS common cause quantification failed.");
  return new Error(`PRAXIS common cause quantification did not complete (status: ${status}).`);
}

export function SyCcfAnalysis(): JSX.Element {
  const { sy, editable, runtime } = useSyWorkbook();
  const { sourceWarning } = useAnalysisSourceGuard("sy", runtime.workbookId);
  const saveBlockedReason = analysisSaveBlock(runtime);
  const basicEventCodes = useMemo(() => Object.fromEntries(
    sy.systemBasicEvents.map((event) => [event.uuid, event.code ?? event.uuid]),
  ), [sy.systemBasicEvents]);
  const modelOptions = useMemo(() => sy.systemLogicModels.flatMap((model) => {
    if (model.topGate === null || isSystemLevelModel(model)) return [];
    const groups = ccfGroupsForModel(sy, model);
    if (groups.length === 0) return [];
    const system = sy.systemDefinitions.find(({ uuid }) => uuid === model.systemReference);
    return [{
      id: model.uuid,
      label: `${model.code} · ${model.name}`,
      systemLabel: system?.abbreviation ?? system?.name ?? model.systemReference,
      groups,
    }];
  }), [sy]);
  const [calculationType, setCalculationType] = useState<FaultTreeCalculationType>("PROBABILITY");
  const [workflow, setWorkflow] = useState<FaultTreeWorkflow>("MANUAL");
  const [modelId, setModelId] = useState(modelOptions[0]?.id ?? "");
  const [batchModelIds, setBatchModelIds] = useState<string[]>(modelOptions.map(({ id }) => id));
  const [settings, setSettings] = useState<FaultTreeAnalysisSettings>(DEFAULT_SETTINGS);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CcfComparisonResult[]>([]);

  useEffect(() => {
    if (!modelOptions.some(({ id }) => id === modelId)) setModelId(modelOptions[0]?.id ?? "");
    setBatchModelIds((current) => {
      const available = new Set(modelOptions.map(({ id }) => id));
      const retained = current.filter((id) => available.has(id));
      return retained.length > 0 ? retained : [...available];
    });
  }, [modelId, modelOptions]);

  const cutSets = calculationType === "PROBABILITY_AND_CUT_SETS";
  const algorithms: FaultTreeAlgorithm[] = cutSets
    ? CUT_SET_ALGORITHMS
    : ["BDD", "ZBDD"];
  const usesCutSetApproximation = CUT_SET_ALGORITHMS.includes(settings.algorithm);
  const usesOrdering = !["MOCUS", "MOCUS_PI"].includes(settings.algorithm);
  const selectedModelIds = workflow === "MANUAL" ? (modelId === "" ? [] : [modelId]) : batchModelIds;
  const stale = results.some(({ withCcf }) =>
    runtime.saveStatus !== "saved" || runtime.revision === null || withCcf.owner.workbookRevision !== runtime.revision,
  );
  const settingsValid =
    (settings.limitOrder === undefined || (Number.isInteger(settings.limitOrder) && settings.limitOrder > 0))
    && (settings.cutOff === undefined || (Number.isFinite(settings.cutOff) && settings.cutOff >= 0 && settings.cutOff <= 1))
    && (!usesOrdering || !["SIFT", "GSIFT", "ILS"].includes(settings.variableOrder)
      || (Number.isFinite(settings.reorderBudgetSeconds) && settings.reorderBudgetSeconds > 0));

  function updateSettings(changes: Partial<FaultTreeAnalysisSettings>): void {
    setSettings((current) => ({ ...current, ...changes }));
  }

  function changeCalculation(value: FaultTreeCalculationType): void {
    setCalculationType(value);
    updateSettings({ algorithm: value === "PROBABILITY" ? "BDD" : "ZBDD", approximation: "EXACT" });
  }

  function changeAlgorithm(algorithm: FaultTreeAlgorithm): void {
    updateSettings({
      algorithm,
      approximation: ["ZBDD_DIRECT", "ZBDD_DELTERM", "MOCUS", "MOCUS_PI"].includes(algorithm) ? "MCUB" : "EXACT",
    });
  }

  function toggleBatchModel(id: string): void {
    setBatchModelIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function eventLabel(eventId: string): string {
    const basicEventCode = basicEventCodes[eventId];
    if (basicEventCode !== undefined) return basicEventCode;
    const group = sy.commonCauseFailureGroups.find(({ uuid }) => eventId.startsWith(`${uuid}-`));
    if (group === undefined) return eventId;
    return `${group.name || group.uuid} · ${eventId.slice(group.uuid.length + 1).replace(/-/g, " ")}`;
  }

  async function execute(model: typeof modelOptions[number], expandCcf: boolean): Promise<FaultTreeAnalysisResult> {
    if (runtime.workbookId === null || runtime.revision === null) throw new Error("Save the workbook before running PRAXIS.");
    const execution = await runSyFaultTree(runtime.workbookId, model.id, runtime.revision, {
      calculationType,
      workflow,
      settings: { ...settings, expandCcf },
    });
    if (execution.run.status !== "SUCCEEDED") throw resultError(execution.run.status, execution.run.failure?.message);
    return getSyFaultTreeResult(runtime.workbookId, model.id, execution.run.id);
  }

  async function runComparison(): Promise<void> {
    if (!editable || runtime.workbookId === null || runtime.revision === null || selectedModelIds.length === 0) return;
    setRunning(true);
    setError(null);
    setResults([]);
    const completed: CcfComparisonResult[] = [];
    const failures: string[] = [];
    for (const selectedId of selectedModelIds) {
      const model = modelOptions.find(({ id }) => id === selectedId);
      if (model === undefined) continue;
      try {
        const validated = await validateSyFaultTree(runtime.workbookId, model.id, runtime.revision);
        if (!validated.validation.valid) throw new Error(validated.validation.issues[0]?.message ?? "The fault tree is not ready for analysis.");
        const withoutCcf = await execute(model, false);
        const withCcf = await execute(model, true);
        completed.push({
          modelId: model.id,
          modelLabel: `${model.systemLabel} · ${model.label}`,
          groupIds: model.groups.map(({ uuid }) => uuid),
          withoutCcf,
          withCcf,
        });
        setResults([...completed]);
      } catch (caught) {
        failures.push(`${model.label}: ${caught instanceof Error ? caught.message : "PRAXIS common cause quantification failed."}`);
        if (workflow === "MANUAL") break;
      }
    }
    if (failures.length > 0) setError(failures.join(" "));
    setRunning(false);
  }

  return (
    <section className="syft-analysis syccf-analysis" aria-label="Common cause quantification">
      <div className="syft-analysis__heading"><h3>PRAXIS common cause verification</h3></div>
      <div className={`syft-analysis__composer syft-analysis__composer--${workflow.toLowerCase()}`} aria-label="Common cause quantification controls">
        <fieldset className="syft-analysis__calculation-picker">
          <legend>Calculation</legend>
          <div role="radiogroup" aria-label="Common cause calculation">
            {([
              ["PROBABILITY", "Probability impact"],
              ["PROBABILITY_AND_CUT_SETS", "Probability + cut sets"],
            ] as const).map(([value, label]) => (
              <label key={value} className={calculationType === value ? "is-selected" : ""}>
                <input type="radio" name="ccf-calculation" value={value} checked={calculationType === value} onChange={() => changeCalculation(value)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="syft-analysis__workflow-picker">
          <legend>Workflow</legend>
          <div role="radiogroup" aria-label="Common cause workflow">
            {(["MANUAL", "BATCH"] as const).map((value) => (
              <label key={value} className={workflow === value ? "is-selected" : ""}>
                <input type="radio" name="ccf-workflow" value={value} checked={workflow === value} onChange={() => setWorkflow(value)} />
                <span>{value === "MANUAL" ? "Manual" : "Batch"}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="syft-analysis__run-composer">
          <div className="syft-analysis__setup-row">
            <span className="syft-analysis__selection-summary">
              {workflow === "BATCH" ? `${selectedModelIds.length} fault tree${selectedModelIds.length === 1 ? "" : "s"} selected` : "Compare one fault tree"}
            </span>
            <button type="button" className="posnav__btn posnav__btn--sm" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>Advanced</button>
          </div>

          {workflow === "BATCH" ? (
            <fieldset className="syft-analysis__batch-models">
              <legend>Fault trees with ready groups</legend>
              {modelOptions.map((model) => (
                <label key={model.id}>
                  <input type="checkbox" checked={batchModelIds.includes(model.id)} onChange={() => toggleBatchModel(model.id)} />
                  <span>{model.systemLabel} · {model.label} · {model.groups.length} group{model.groups.length === 1 ? "" : "s"}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <label className="syccf-analysis__model">
              <span>Fault tree</span>
              <select aria-label="Common cause fault tree" value={modelId} onChange={(event) => setModelId(event.target.value)}>
                {modelOptions.map((model) => <option key={model.id} value={model.id}>{model.systemLabel} · {model.label} · {model.groups.length} group{model.groups.length === 1 ? "" : "s"}</option>)}
              </select>
            </label>
          )}

          <div className="syft-analysis__execution-row">
            <div className="syft-analysis__run-fields">
              <label className="syft-analysis__run-field">
                <span>Algorithm</span>
                <select aria-label="Common cause algorithm" value={settings.algorithm} onChange={(event) => changeAlgorithm(event.target.value as FaultTreeAlgorithm)}>
                  {algorithms.map((algorithm) => <option key={algorithm} value={algorithm}>{ALGORITHM_LABELS[algorithm]}</option>)}
                </select>
              </label>
            </div>
            <button
              type="button"
              className="posnav__btn posnav__btn--sm posnav__btn--primary"
              disabled={running || !editable || saveBlockedReason !== null || sourceWarning !== null || selectedModelIds.length === 0 || !settingsValid}
              onClick={() => { void runComparison(); }}
            >
              {running ? "Running…" : `Run CCF comparison${workflow === "BATCH" ? " batch" : ""}`}
            </button>
          </div>

          {advancedOpen && (
            <div className="syft-analysis__advanced-panel" role="region" aria-label="Advanced common cause settings">
              <div className="syft-analysis__advanced-head">
                <strong>Advanced</strong>
                <button type="button" className="posnav__btn posnav__btn--sm" aria-label="Close advanced common cause settings" onClick={() => setAdvancedOpen(false)}>Close</button>
              </div>
              <div className="syft-analysis__advanced">
                {usesCutSetApproximation && (
                  <label>
                    <span>Probability method</span>
                    <select aria-label="Common cause probability method" value={settings.approximation} onChange={(event) => updateSettings({ approximation: event.target.value as FaultTreeAnalysisSettings["approximation"] })}>
                      {settings.algorithm === "ZBDD" && <option value="EXACT">Exact</option>}
                      <option value="RARE_EVENT">Rare event</option>
                      <option value="MCUB">Minimal cut upper bound</option>
                    </select>
                  </label>
                )}
                <label><span>Maximum cut set order</span><input aria-label="Common cause maximum cut set order" type="number" min="1" value={settings.limitOrder ?? ""} placeholder="No limit" onChange={(event) => updateSettings({ limitOrder: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
                <label><span>Cut off probability</span><input aria-label="Common cause cut off probability" type="number" min="0" max="1" step="any" value={settings.cutOff ?? ""} placeholder="No cut off" onChange={(event) => updateSettings({ cutOff: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
                {usesOrdering && (
                  <label>
                    <span>Variable order</span>
                    <select aria-label="Common cause variable order" value={settings.variableOrder} onChange={(event) => updateSettings({ variableOrder: event.target.value as FaultTreeAnalysisSettings["variableOrder"] })}>
                      <option value="DFS">DFS</option><option value="FORCE">FORCE</option><option value="SLOAN">Sloan</option>
                      <option value="DFS_SCRAM">DFS SCRAM</option><option value="DFS_PLAIN">DFS plain</option><option value="REVERSE">Reverse</option>
                      <option value="SIFT">Sift</option><option value="GSIFT">Group sift</option><option value="ILS">Iterated local search</option>
                    </select>
                  </label>
                )}
                {usesOrdering && ["SIFT", "GSIFT", "ILS"].includes(settings.variableOrder) && (
                  <label><span>Reorder budget (seconds)</span><input aria-label="Common cause reorder budget seconds" type="number" min="0.01" step="any" value={settings.reorderBudgetSeconds} onChange={(event) => updateSettings({ reorderBudgetSeconds: Number(event.target.value) })} /></label>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {modelOptions.length === 0 && <p className="syft-analysis__notice" role="status">Complete a group with two component basic events before running PRAXIS.</p>}
      {saveBlockedReason !== null && <p className="syft-analysis__notice" role="status">{saveBlockedReason}</p>}
      {(error ?? sourceWarning) !== null && <p className="syft-analysis__error" role="alert">{error ?? sourceWarning}</p>}
      {stale && <p className="syft-analysis__notice" role="status">These results use an earlier workbook revision.</p>}

      {results.length > 0 && (
        <section className="syccf-analysis__results" aria-label="Common cause comparison results">
          <h3>{workflow === "BATCH" ? "Comparison results" : "Comparison result"}</h3>
          {results.map((result) => {
            const baseline = result.withoutCcf.topEventProbability;
            const expanded = result.withCcf.topEventProbability;
            const difference = expanded - baseline;
            const relative = baseline === 0 ? Number.NaN : (difference / baseline) * 100;
            return (
              <article key={`${result.withoutCcf.runId}:${result.withCcf.runId}`} className="syccf-analysis__result">
                <div className="syccf-analysis__result-head">
                  <div><span>{result.modelLabel}</span><strong>{result.groupIds.length} group{result.groupIds.length === 1 ? "" : "s"} expanded</strong></div>
                  <span>{result.withCcf.probabilityMethod ?? settings.approximation}</span>
                </div>
                <dl className="syccf-analysis__metrics">
                  <div><dt>Without CCF</dt><dd>{probability(baseline)}</dd></div>
                  <div><dt>With CCF</dt><dd>{probability(expanded)}</dd></div>
                  <div><dt>Absolute change</dt><dd>{difference >= 0 ? "+" : ""}{probability(difference)}</dd></div>
                  <div><dt>Relative change</dt><dd>{percent(relative)}</dd></div>
                  {cutSets && <div><dt>Cut sets</dt><dd>{result.withoutCcf.cutSets?.count ?? 0} → {result.withCcf.cutSets?.count ?? 0}</dd></div>}
                </dl>
                <div className="syccf-analysis__groups">{result.groupIds.map((id) => <span key={id}>{id}</span>)}</div>
                {cutSets && result.withCcf.cutSets !== undefined && (
                  <section className="syccf-analysis__cut-sets" aria-label={`${result.modelLabel} expanded cut sets`}>
                    <div className="syccf-analysis__cut-sets-head">
                      <h4>{result.withCcf.cutSets.primeImplicants ? "Expanded prime implicants" : "Expanded minimal cut sets"}</h4>
                      <span>{result.withCcf.cutSets.count.toLocaleString()} total</span>
                    </div>
                    <PagedResults
                      items={result.withCcf.cutSets.items}
                      label={`${result.modelLabel} expanded cut sets`}
                      resetKey={`${result.withCcf.runId}:${result.withCcf.cutSets.count}`}
                    >
                      {(items) => (
                        <div className="postable-wrap">
                          <table className="postable syccf-analysis__cut-set-table">
                            <thead><tr><th>Order</th><th>Events</th><th>Probability</th></tr></thead>
                            <tbody>{items.map((set, index) => (
                              <tr key={`${index}:${set.literals.map((literal) => `${literal.negated ? "~" : ""}${literal.basicEventId}`).join("|")}`}>
                                <td>{set.order}</td>
                                <td className="posmono">{set.literals.map((literal) => `${literal.negated ? "¬" : ""}${eventLabel(literal.basicEventId)}`).join(" · ")}</td>
                                <td className="posmono">{probability(set.probability)}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      )}
                    </PagedResults>
                  </section>
                )}
              </article>
            );
          })}
        </section>
      )}
    </section>
  );
}

export type { CcfComparisonResult };
