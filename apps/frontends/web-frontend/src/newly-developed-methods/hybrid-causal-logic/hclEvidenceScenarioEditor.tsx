import { type ChangeEvent, type JSX, useEffect, useRef, useState } from "react";
import type { EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import type { HclEvidenceScenario } from "interfaces-mef-types/modeling";
import { DEFAULT_ANNUALIZATION_CONVENTION } from "interfaces-mef-types/modeling";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  exportHclEvidenceScenariosCsv,
  exportHclEvidenceScenariosJson,
  importHclEvidenceScenariosCsv,
  importHclEvidenceScenariosJson,
  mergeHclEvidenceScenarios,
} from "./hclEvidenceScenarioInterchange";

interface HclEvidenceScenarioEditorProps {
  model: BayesianNetworkModel;
  configuration: EsqHclConfiguration;
  editable: boolean;
  onChange: (configuration: EsqHclConfiguration) => void;
  onError: (message: string | null) => void;
}

function download(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function nextScenarioCode(scenarios: readonly HclEvidenceScenario[]): string {
  const codes = new Set(scenarios.map((scenario) => scenario.code.trim().toUpperCase()));
  let suffix = scenarios.length + 1;
  while (codes.has(`SCN-${String(suffix)}`)) suffix += 1;
  return `SCN-${String(suffix)}`;
}

function hazardCellKey(scenario: HclEvidenceScenario, nodeIds: readonly string[]): string | null {
  const states = nodeIds.map((nodeId) =>
    scenario.evidence.observations.find((observation) => observation.nodeId === nodeId)?.stateId,
  );
  return states.some((stateId) => stateId === undefined) ? null : states.join("|");
}

function hasUniqueHazardCells(scenarios: readonly HclEvidenceScenario[], nodeIds: readonly string[]): boolean {
  if (scenarios.length === 0 || nodeIds.length === 0) return false;
  const keys = scenarios.map((scenario) => hazardCellKey(scenario, nodeIds));
  return keys.every((key) => key !== null) && new Set(keys).size === scenarios.length;
}

function selectHazardDimensions(
  scenarios: readonly HclEvidenceScenario[],
  candidateNodeIds: readonly string[],
): string[] {
  if (scenarios.length === 0 || candidateNodeIds.length === 0) return [];
  const selected: string[] = [];
  const remaining = [...candidateNodeIds];
  let distinctCells = 1;

  while (selected.length === 0 || distinctCells < scenarios.length) {
    let bestIndex = -1;
    let bestDistinctCells = distinctCells;
    remaining.forEach((nodeId, index) => {
      const keys = scenarios.map((scenario) => hazardCellKey(scenario, [...selected, nodeId]));
      const count = new Set(keys.filter((key): key is string => key !== null)).size;
      if (count > bestDistinctCells || (selected.length === 0 && bestIndex === -1)) {
        bestIndex = index;
        bestDistinctCells = count;
      }
    });
    if (bestIndex === -1 || (bestDistinctCells <= distinctCells && scenarios.length > 1)) return [];
    selected.push(...remaining.splice(bestIndex, 1));
    distinctCells = bestDistinctCells;
  }

  for (let index = selected.length - 1; index >= 0; index -= 1) {
    if (selected.length === 1) break;
    const withoutNode = selected.filter((_, selectedIndex) => selectedIndex !== index);
    if (hasUniqueHazardCells(scenarios, withoutNode)) selected.splice(index, 1);
  }
  return selected;
}

function HclEvidenceScenarioEditor({
  model,
  configuration,
  editable,
  onChange,
  onError,
}: HclEvidenceScenarioEditorProps): JSX.Element {
  const scenarios = configuration.evidenceScenarios ?? [];
  const [selectedId, setSelectedId] = useState(scenarios[0]?.id ?? "");
  const importRef = useRef<HTMLInputElement>(null);
  const selected = scenarios.find((scenario) => scenario.id === selectedId);
  const enabledScenarios = scenarios.filter((scenario) => scenario.enabled);
  const completeHazardNodes = model.nodes.filter((node) =>
    enabledScenarios.length > 0
    && enabledScenarios.every((scenario) =>
      scenario.evidence.observations.some((observation) => observation.nodeId === node.id),
    ),
  );
  const suggestedHazardNodeIds = selectHazardDimensions(
    enabledScenarios,
    completeHazardNodes.map((node) => node.id),
  );
  const hazardSetupReady = suggestedHazardNodeIds.length > 0;
  const configuredHazardGridValid = configuration.hazardGrid !== undefined
    && hasUniqueHazardCells(enabledScenarios, configuration.hazardGrid.hazardNodeIds);
  const bestCoveredHazardNode = model.nodes
    .map((node) => ({
      node,
      coverage: enabledScenarios.filter((scenario) =>
        scenario.evidence.observations.some((observation) => observation.nodeId === node.id),
      ).length,
    }))
    .sort((left, right) => right.coverage - left.coverage)[0];
  const hazardReadinessMessage = (() => {
    if (enabledScenarios.length === 0) {
      return "Add or enable at least one evidence scenario before enabling convolution.";
    }
    if (hazardSetupReady) {
      const nodeCodes = suggestedHazardNodeIds.map((nodeId) =>
        model.nodes.find((node) => node.id === nodeId)?.code ?? nodeId,
      );
      return `${nodeCodes.join(" + ")} uniquely identifies ${String(enabledScenarios.length)} enabled grid cells.`;
    }
    if (completeHazardNodes.length > 0) {
      return "The enabled scenarios contain duplicate evidence cells. Change their evidence or disable duplicate rows before enabling convolution.";
    }
    if (bestCoveredHazardNode === undefined || bestCoveredHazardNode.coverage === 0) {
      return "No enabled scenario assigns a BN node. Assign the same hazard node in every enabled scenario.";
    }
    const missingScenarioCodes = enabledScenarios
      .filter((scenario) => !scenario.evidence.observations.some((observation) => observation.nodeId === bestCoveredHazardNode.node.id))
      .map((scenario) => scenario.code);
    const shownCodes = missingScenarioCodes.slice(0, 3).join(", ");
    const remainingCount = missingScenarioCodes.length - 3;
    const missingLabel = remainingCount > 0 ? `${shownCodes}, and ${String(remainingCount)} more` : shownCodes;
    return `${bestCoveredHazardNode.node.code} is assigned in ${String(bestCoveredHazardNode.coverage)} of ${String(enabledScenarios.length)} enabled scenarios. Assign it in ${missingLabel} or disable ${missingScenarioCodes.length === 1 ? "that row" : "those rows"}.`;
  })();
  const [hazardEnableBlocked, setHazardEnableBlocked] = useState(false);

  useEffect(() => {
    if (scenarios.some((scenario) => scenario.id === selectedId)) return;
    setSelectedId(scenarios[0]?.id ?? "");
  }, [scenarios, selectedId]);

  function replaceScenarios(next: HclEvidenceScenario[]): void {
    onChange({ ...configuration, evidenceScenarios: next });
  }

  function replaceScenario(next: HclEvidenceScenario): void {
    replaceScenarios(scenarios.map((scenario) => scenario.id === next.id ? next : scenario));
    onError(null);
  }

  function addScenario(): void {
    const code = nextScenarioCode(scenarios);
    const created: HclEvidenceScenario = {
      id: crypto.randomUUID(),
      code,
      name: `Evidence scenario ${String(scenarios.length + 1)}`,
      enabled: true,
      evidence: { observations: [] },
    };
    replaceScenarios([...scenarios, created]);
    setSelectedId(created.id);
    onError(null);
  }

  async function importScenarios(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    try {
      const text = await file.text();
      const imported = file.name.toLowerCase().endsWith(".csv")
        ? importHclEvidenceScenariosCsv(text, model)
        : importHclEvidenceScenariosJson(text, model);
      const merged = mergeHclEvidenceScenarios(scenarios, imported);
      replaceScenarios(merged);
      const firstImportedCode = imported[0]?.code.trim().toUpperCase();
      setSelectedId(merged.find((scenario) => scenario.code.trim().toUpperCase() === firstImportedCode)?.id ?? selectedId);
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not import evidence scenarios.");
    }
  }

  function exportJson(): void {
    try {
      download(`${configuration.code}-evidence-scenarios.json`, exportHclEvidenceScenariosJson(scenarios, model), "application/json");
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not export evidence scenarios.");
    }
  }

  function exportCsv(): void {
    try {
      download(`${configuration.code}-evidence-scenarios.csv`, exportHclEvidenceScenariosCsv(scenarios, model), "text/csv");
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not export evidence scenarios.");
    }
  }

  function setObservation(nodeId: string, stateId: string): void {
    if (selected === undefined) return;
    const observations = selected.evidence.observations.filter((observation) => observation.nodeId !== nodeId);
    if (stateId !== "") observations.push({ nodeId, stateId });
    replaceScenario({ ...selected, evidence: { observations } });
  }

  function enableHazardGrid(): void {
    if (!hazardSetupReady) {
      setHazardEnableBlocked(true);
      onError(hazardReadinessMessage);
      return;
    }
    setHazardEnableBlocked(false);
    onChange({
      ...configuration,
      hazardGrid: {
        name: `${configuration.code} hazard grid`,
        hazardNodeIds: suggestedHazardNodeIds as [string, ...string[]],
        annualFrequencyScale: {
          value: 1,
          unit: "PER_YEAR",
          annualization: DEFAULT_ANNUALIZATION_CONVENTION,
        },
        normalizeWeights: false,
      },
    });
    onError(null);
  }

  function repairHazardGridDimensions(): void {
    if (configuration.hazardGrid === undefined || !hazardSetupReady) return;
    onChange({
      ...configuration,
      hazardGrid: {
        ...configuration.hazardGrid,
        hazardNodeIds: suggestedHazardNodeIds as [string, ...string[]],
      },
    });
    setHazardEnableBlocked(false);
    onError(null);
  }

  function disableHazardGrid(): void {
    const { hazardGrid: _removed, ...remaining } = configuration;
    setHazardEnableBlocked(false);
    onChange(remaining as EsqHclConfiguration);
    onError(null);
  }

  return (
    <div className="hcleditor__scenarios" role="tabpanel" aria-label="HCL evidence scenarios">
      <div className="hcleditor__scenario-toolbar">
        {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addScenario}>Add scenario</button>}
        {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => importRef.current?.click()}>Import JSON/CSV</button>}
        <button type="button" className="posnav__btn posnav__btn--sm" disabled={scenarios.length === 0} onClick={exportJson}>Export JSON</button>
        <button type="button" className="posnav__btn posnav__btn--sm" disabled={scenarios.length === 0} onClick={exportCsv}>Export CSV</button>
        <input ref={importRef} hidden type="file" accept=".json,.csv,application/json,text/csv" onChange={(event) => { void importScenarios(event); }} />
      </div>
      <p className="hcleditor__scenario-help">Each scenario overrides the common evidence only for the nodes listed below.</p>
      <section className="hcleditor__hazard-grid" aria-label="Hazard convolution settings">
        <div className="hcleditor__hazard-grid-heading">
          <div><strong>Hazard convolution</strong><span>Weight grid cells by their exact BN probability and annual occurrence frequency.</span></div>
          {editable && (configuration.hazardGrid === undefined
            ? <button type="button" className="posnav__btn posnav__btn--sm" aria-expanded={false} aria-controls="hcl-hazard-grid-fields" onClick={enableHazardGrid}>Enable</button>
            : <button type="button" className="posnav__btn posnav__btn--sm" onClick={disableHazardGrid}>Disable</button>)}
        </div>
        {configuration.hazardGrid === undefined && (
          <p
            className={`hcleditor__hazard-grid-status${hazardSetupReady ? " is-ready" : " is-blocked"}${hazardEnableBlocked ? " is-emphasized" : ""}`}
            role={hazardEnableBlocked ? "alert" : "status"}
          >
            <strong>{hazardSetupReady ? "Ready to enable" : "Setup required"}</strong>
            <span>{hazardReadinessMessage}</span>
          </p>
        )}
        {configuration.hazardGrid !== undefined && !configuredHazardGridValid && (
          <div className="hcleditor__hazard-grid-status is-blocked is-emphasized" role="alert">
            <strong>Grid dimensions need repair</strong>
            <span>{hazardSetupReady
              ? `Use ${suggestedHazardNodeIds.map((nodeId) => model.nodes.find((node) => node.id === nodeId)?.code ?? nodeId).join(" + ")} to distinguish all ${String(enabledScenarios.length)} enabled cells.`
              : "The enabled scenarios contain duplicate evidence cells."}</span>
            {editable && hazardSetupReady && <button type="button" className="posnav__btn posnav__btn--sm" onClick={repairHazardGridDimensions}>Repair dimensions</button>}
          </div>
        )}
        {configuration.hazardGrid !== undefined && (
          <div id="hcl-hazard-grid-fields" className="hcleditor__hazard-grid-fields">
            <label><span>Name</span><input value={configuration.hazardGrid.name} disabled={!editable} onChange={(event) => onChange({ ...configuration, hazardGrid: { ...configuration.hazardGrid!, name: event.target.value } })} /></label>
            <label><span>Annual scale</span><input type="number" min="0" step="any" value={configuration.hazardGrid.annualFrequencyScale.value} disabled={!editable} onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value) && value >= 0) onChange({ ...configuration, hazardGrid: { ...configuration.hazardGrid!, annualFrequencyScale: { ...configuration.hazardGrid!.annualFrequencyScale, value } } });
            }} /></label>
            <label><span>Unit</span><select value={configuration.hazardGrid.annualFrequencyScale.unit} disabled={!editable} onChange={(event) => onChange({ ...configuration, hazardGrid: { ...configuration.hazardGrid!, annualFrequencyScale: { ...configuration.hazardGrid!.annualFrequencyScale, unit: event.target.value as typeof configuration.hazardGrid.annualFrequencyScale.unit } } })}>
              <option value="PER_YEAR">per year</option><option value="PER_HOUR">per hour</option><option value="PER_DAY">per day</option><option value="PER_MINUTE">per minute</option><option value="PER_SECOND">per second</option>
            </select></label>
            <label><span>Year basis</span><select value={configuration.hazardGrid.annualFrequencyScale.annualization.basis} disabled={!editable} onChange={(event) => onChange({ ...configuration, hazardGrid: { ...configuration.hazardGrid!, annualFrequencyScale: { ...configuration.hazardGrid!.annualFrequencyScale, annualization: { ...configuration.hazardGrid!.annualFrequencyScale.annualization, basis: event.target.value as typeof configuration.hazardGrid.annualFrequencyScale.annualization.basis } } } })}>
              <option value="PLANT_YEAR">Plant year</option><option value="CALENDAR_YEAR">Calendar year</option><option value="REACTOR_YEAR">Reactor year</option><option value="CRITICAL_YEAR">Critical year</option>
            </select></label>
            <label><span>Hours/year</span><input type="number" min="0.000001" step="any" value={configuration.hazardGrid.annualFrequencyScale.annualization.hoursPerYear} disabled={!editable} onChange={(event) => {
              const hoursPerYear = Number(event.target.value);
              if (Number.isFinite(hoursPerYear) && hoursPerYear > 0) onChange({ ...configuration, hazardGrid: { ...configuration.hazardGrid!, annualFrequencyScale: { ...configuration.hazardGrid!.annualFrequencyScale, annualization: { ...configuration.hazardGrid!.annualFrequencyScale.annualization, hoursPerYear } } } });
            }} /></label>
            <label className="hcleditor__hazard-normalize"><input type="checkbox" checked={configuration.hazardGrid.normalizeWeights} disabled={!editable} onChange={(event) => onChange({ ...configuration, hazardGrid: { ...configuration.hazardGrid!, normalizeWeights: event.target.checked } })} /><span>Normalize selected grid mass</span></label>
            <fieldset><legend>Hazard dimensions</legend>{model.nodes.map((node) => {
              const selectedNode = configuration.hazardGrid!.hazardNodeIds.includes(node.id);
              const complete = completeHazardNodes.some((candidate) => candidate.id === node.id);
              const next = selectedNode
                ? configuration.hazardGrid!.hazardNodeIds.filter((nodeId) => nodeId !== node.id)
                : [...configuration.hazardGrid!.hazardNodeIds, node.id];
              const preservesUniqueCells = hasUniqueHazardCells(enabledScenarios, next);
              const dimensionTitle = !complete
                ? "Every enabled scenario must assign this node"
                : !preservesUniqueCells
                  ? "This change would leave duplicate grid cells"
                  : undefined;
              return <label key={node.id} title={dimensionTitle}><input type="checkbox" checked={selectedNode} disabled={!editable || !complete || !preservesUniqueCells} onChange={(event) => {
                const nextSelection = event.target.checked
                  ? [...configuration.hazardGrid!.hazardNodeIds, node.id]
                  : configuration.hazardGrid!.hazardNodeIds.filter((nodeId) => nodeId !== node.id);
                if (hasUniqueHazardCells(enabledScenarios, nextSelection)) onChange({ ...configuration, hazardGrid: { ...configuration.hazardGrid!, hazardNodeIds: nextSelection as [string, ...string[]] } });
              }} /><span>{node.code}</span></label>;
            })}</fieldset>
          </div>
        )}
      </section>
      {scenarios.length === 0 ? (
        <p className="bneditor__empty">No evidence scenarios yet.</p>
      ) : (
        <div className="hcleditor__scenario-workspace">
          <div className="hcleditor__scenario-list" aria-label="Evidence scenario list">
            {scenarios.map((scenario) => (
              <div key={scenario.id} className={`hcleditor__scenario-row${scenario.id === selectedId ? " is-selected" : ""}`}>
                <input aria-label={`Enable ${scenario.code}`} type="checkbox" checked={scenario.enabled} disabled={!editable} onChange={(event) => replaceScenario({ ...scenario, enabled: event.target.checked })} />
                <button type="button" onClick={() => setSelectedId(scenario.id)}>
                  <strong>{scenario.code}</strong>
                  <span>{scenario.name} · {String(scenario.evidence.observations.length)} overrides</span>
                </button>
                {editable && <button type="button" className="hcleditor__scenario-delete" aria-label={`Delete scenario ${scenario.code}`} onClick={() => replaceScenarios(scenarios.filter((candidate) => candidate.id !== scenario.id))}>Delete</button>}
              </div>
            ))}
          </div>
          {selected !== undefined && (
            <div className="hcleditor__scenario-detail" aria-label={`Edit scenario ${selected.code}`}>
              <div className="hcleditor__scenario-identity">
                <label><span>Code</span><input required maxLength={64} value={selected.code} disabled={!editable} onChange={(event) => replaceScenario({ ...selected, code: event.target.value })} /></label>
                <label><span>Name</span><input required maxLength={200} value={selected.name} disabled={!editable} onChange={(event) => replaceScenario({ ...selected, name: event.target.value })} /></label>
              </div>
              <div className="hcleditor__scenario-evidence">
                {model.nodes.map((node) => {
                  const observation = selected.evidence.observations.find((candidate) => candidate.nodeId === node.id);
                  return (
                    <label key={node.id}>
                      <span>{node.code}</span>
                      <select aria-label={`${node.code} evidence for ${selected.code}`} value={observation?.stateId ?? ""} disabled={!editable} onChange={(event) => setObservation(node.id, event.target.value)}>
                        <option value="">Use common evidence</option>
                        {node.states.map((state) => <option key={state.id} value={state.id}>{state.code}</option>)}
                      </select>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { HclEvidenceScenarioEditor };
