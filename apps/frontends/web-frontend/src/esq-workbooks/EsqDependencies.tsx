import { JSX, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  DEFAULT_ANNUALIZATION_CONVENTION,
  type AnnualizedFrequencyInput,
  type EventFrequencyUnit,
  type HclHazardGridDefinition,
  type WorkbookBayesianNetwork,
  type WorkbookHclConfiguration,
} from "interfaces-mef-types/modeling";
import { validateBayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  HclHazardSweepSpecSchema,
  type HclBatchInput,
  type HclCalculationType,
  type HclEvidenceScenario,
  type HclHazardSweepSpec,
  type HclRunSampling,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { BayesianNetworkEditor } from "../newly-developed-methods/bayesian-network";
import type { HclEditorBatchRunResult, HclEditorRunResult } from "../newly-developed-methods/hybrid-causal-logic";
import { createEvidenceBatchSamples, downloadText } from "../newly-developed-methods/hybrid-causal-logic/hclBindingEditor";
import {
  exportHclEvidenceScenariosCsv,
  exportHclEvidenceScenariosJson,
  importHclEvidenceScenariosCsv,
  importHclEvidenceScenariosJson,
} from "../newly-developed-methods/hybrid-causal-logic/hclEvidenceScenarioInterchange";
import { PagedResults } from "../newly-developed-methods/shared/resultPresentation";
import { DialogHead, DialogShell } from "../es-workbooks/EsScope";
import type { NetworkOption } from "./esqShared";
import { useEsqWorkbook } from "./esqWorkbookContext";
import { generateEsqHclScenarios, getEsqHclEventTreeResult, runEsqHclEventTree, runEsqHclEventTreeBatch } from "./esqWorkbookApi";
import { exampleLinkLabel } from "./esqViewData";
import "./css/esqDependencies.css";

type DependencyEvidence = "BASE" | "SCENARIOS" | "HAZARD";

type FileFormat = "JSON" | "CSV";

interface DependencyStudyTree {
  treeId: string;
  runResult: HclEditorRunResult | null;
  batchRunResult: HclEditorBatchRunResult | null;
  failure: string | null;
}

interface DependencyStudy {
  result: HclCalculationType;
  evidence: DependencyEvidence;
  trees: DependencyStudyTree[];
}

interface DependencyStudyInput {
  workbookId: string;
  revision: number;
  option: NetworkOption;
  treeId: string;
  result: HclCalculationType;
  evidence: DependencyEvidence;
  scenarioIds: string[];
  batchInput: HclBatchInput | null;
  sampling?: HclRunSampling;
}

interface DependencyPanelProps {
  option: NetworkOption;
  evidence: DependencyEvidence;
  batchInput: HclBatchInput | null;
  running: boolean;
  onBatchInput: (input: HclBatchInput | null) => void;
}

interface EvidenceSectionProps extends DependencyPanelProps {
  network: WorkbookBayesianNetwork;
  workbookName: string;
}

interface Observation {
  nodeId: string;
  stateId: string;
}

const NO_REASON = "The run did not finish and gave no reason.";

const MAX_CODE = 64;

const MAX_NAME = 200;

const UNITS: readonly (readonly [EventFrequencyUnit, string])[] = [["PER_YEAR", "per year"], ["PER_DAY", "per day"], ["PER_HOUR", "per hour"], ["PER_MINUTE", "per minute"], ["PER_SECOND", "per second"]];

const WEIGHTS: readonly (readonly ["RAW" | "NORMALIZED", string])[] = [["RAW", "Raw"], ["NORMALIZED", "Normalized"]];

const START_SCALE: AnnualizedFrequencyInput = { value: 1, unit: "PER_YEAR", annualization: { ...DEFAULT_ANNUALIZATION_CONVENTION } };

function withoutGrid(configuration: WorkbookHclConfiguration): WorkbookHclConfiguration {
  const { hazardGrid: _saved, ...rest } = configuration;
  return rest;
}

function studyConfiguration(configuration: WorkbookHclConfiguration, batchInput: HclBatchInput | null): WorkbookHclConfiguration {
  return batchInput === null ? configuration : { ...withoutGrid(configuration), ...batchInput };
}

function cellKey(scenario: HclEvidenceScenario, nodeIds: readonly string[]): string | undefined {
  const states = nodeIds.map((nodeId) => scenario.evidence.observations.find((observation) => observation.nodeId === nodeId)?.stateId);
  return states.every((stateId): stateId is string => stateId !== undefined) ? states.join("|") : undefined;
}

function dependencyEvidenceProblem(configuration: WorkbookHclConfiguration, evidence: DependencyEvidence): string | undefined {
  if (evidence === "BASE") return undefined;
  const enabled = (configuration.evidenceScenarios ?? []).filter((scenario) => scenario.enabled);
  if (enabled.length === 0) return "The dependency configuration has no enabled evidence scenario.";
  if (evidence === "SCENARIOS") return undefined;
  const grid = configuration.hazardGrid;
  if (grid === undefined) return "The evidence scenarios have no hazard grid.";
  const cells = enabled.map((scenario) => cellKey(scenario, grid.hazardNodeIds));
  if (cells.some((cell) => cell === undefined)) return "Every evidence scenario must set each grid node.";
  if (new Set(cells).size !== cells.length) return "Two evidence scenarios set the same grid cell.";
  return undefined;
}

function optionOf<T extends string>(options: readonly (readonly [T, string])[], value: string): T | undefined {
  return options.find(([option]) => option === value)?.[0];
}

function nodeCodeOf(network: WorkbookBayesianNetwork, nodeId: string): string {
  return network.nodes.find((node) => node.id === nodeId)?.code ?? "Missing node";
}

function observationText(network: WorkbookBayesianNetwork, observations: readonly Observation[]): string {
  return observations.map((observation) => {
    const node = network.nodes.find((candidate) => candidate.id === observation.nodeId);
    const state = node?.states.find((candidate) => candidate.id === observation.stateId);
    return `${node?.code ?? "Missing node"} ${state?.code ?? "missing state"}`;
  }).join(" · ");
}

function scaleText(scale: AnnualizedFrequencyInput): string {
  return `${String(Number(scale.value.toPrecision(6)))} ${UNITS.find(([unit]) => unit === scale.unit)?.[1] ?? ""}`.trim();
}

function readableScenarios(rows: readonly HclEvidenceScenario[], network: WorkbookBayesianNetwork, nodeIds: readonly string[]): HclEvidenceScenario[] {
  const parts = rows.map((row) => nodeIds.flatMap((nodeId) => {
    const stateId = row.evidence.observations.find((observation) => observation.nodeId === nodeId)?.stateId;
    const state = network.nodes.find((node) => node.id === nodeId)?.states.find((candidate) => candidate.id === stateId);
    return state === undefined ? [] : [state];
  }));
  const codes = parts.map((states) => states.map((state) => state.code).join("-"));
  const unique = new Set(codes.map((code) => code.toUpperCase())).size === codes.length;
  return rows.map((row, index) => {
    const states = parts[index] ?? [];
    const code = codes[index] ?? "";
    const name = states.map((state) => (state.name.trim().length > 0 ? state.name : state.code)).join(" · ");
    return {
      ...row,
      ...(unique && states.length === nodeIds.length && code.length > 0 && code.length <= MAX_CODE ? { code } : {}),
      ...(states.length === nodeIds.length && name.length > 0 && name.length <= MAX_NAME ? { name } : {}),
    };
  });
}

async function studyTree(input: DependencyStudyInput): Promise<DependencyStudyTree> {
  const configurationId = input.option.configuration.modelId;
  const dependencyConfiguration = { workbookId: input.option.workbookId, modelId: configurationId };
  const eventTree = { workbookId: input.workbookId, modelId: input.treeId };
  if (input.evidence === "BASE") {
    const execution = await runEsqHclEventTree(input.workbookId, configurationId, input.revision, eventTree, input.result, dependencyConfiguration, input.sampling);
    if (execution.run.status !== "SUCCEEDED") return { treeId: input.treeId, runResult: null, batchRunResult: null, failure: execution.run.failure?.message ?? NO_REASON };
    const result = await getEsqHclEventTreeResult(input.workbookId, configurationId, execution.run.id);
    return { treeId: input.treeId, runResult: { kind: "EVENT_TREE", result }, batchRunResult: null, failure: null };
  }
  const execution = await runEsqHclEventTreeBatch(
    input.workbookId,
    configurationId,
    input.revision,
    eventTree,
    input.result,
    input.scenarioIds,
    input.evidence === "HAZARD",
    dependencyConfiguration,
    input.batchInput ?? undefined,
    input.sampling,
  );
  const scenarios = await Promise.all(execution.runs.map(async (row) => ({
    scenarioId: row.scenarioId,
    scenarioCode: row.scenarioCode,
    scenarioName: row.scenarioName,
    status: row.run.status,
    failure: row.run.failure?.message ?? null,
    result: row.run.status === "SUCCEEDED" ? { kind: "EVENT_TREE" as const, result: await getEsqHclEventTreeResult(input.workbookId, configurationId, row.run.id) } : null,
  })));
  const batchRunResult: HclEditorBatchRunResult = {
    kind: "EVENT_TREE",
    scenarios,
    ...(execution.hazardConvolution === undefined ? {} : { hazardConvolution: execution.hazardConvolution }),
    ...(execution.compilationReuse === undefined ? {} : { compilationReuse: execution.compilationReuse }),
  };
  return { treeId: input.treeId, runResult: null, batchRunResult, failure: null };
}

function FileMenu({ label, onPick }: { label: string; onPick: (format: FileFormat) => void }): JSX.Element {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function close(event: PointerEvent): void {
      const current = menu.current;
      if (current?.open === true && event.target instanceof Node && !current.contains(event.target)) current.open = false;
    }
    function escape(event: KeyboardEvent): void {
      if (event.key === "Escape" && menu.current !== null) menu.current.open = false;
    }
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", escape);
    };
  }, []);

  function pick(format: FileFormat): void {
    if (menu.current !== null) menu.current.open = false;
    onPick(format);
  }

  return (
    <details ref={menu} className="esq-dep__menu">
      <summary className="posnav__btn posnav__btn--sm" role="button">{label}</summary>
      <div className="esq-dep__popover" role="menu" aria-label={label}>
        <button type="button" role="menuitem" onClick={() => pick("JSON")}>JSON</button>
        <button type="button" role="menuitem" onClick={() => pick("CSV")}>CSV</button>
      </div>
    </details>
  );
}

function ScenarioGenerator({ network, onGenerate, onClose }: { network: WorkbookBayesianNetwork; onGenerate: (spec: HclHazardSweepSpec) => Promise<void>; onClose: () => void }): JSX.Element {
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [states, setStates] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [exclusions, setExclusions] = useState<readonly Readonly<Record<string, string>>[]>([]);
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dimensions = picked.flatMap((nodeId) => {
    const node = network.nodes.find((candidate) => candidate.id === nodeId);
    if (node === undefined) return [];
    const chosen = states[nodeId] ?? [];
    return [{
      id: node.code,
      bnNode: node.id,
      states: node.states.filter((state) => chosen.includes(state.id)).map((state) => state.id),
      stateLabels: Object.fromEntries(node.states.map((state) => [state.id, state.code])),
    }];
  });
  const combinations = dimensions.length === 0 ? 0 : dimensions.reduce((product, dimension) => product * dimension.states.length, 1);
  const limitValue = Number(limit);
  const limitInvalid = limit.trim().length > 0 && !(Number.isInteger(limitValue) && limitValue >= 1);

  function toggleNode(nodeId: string, on: boolean): void {
    const node = network.nodes.find((candidate) => candidate.id === nodeId);
    if (node === undefined) return;
    if (on) {
      setPicked((current) => [...current, nodeId]);
      setStates((current) => ({ ...current, [nodeId]: node.states.map((state) => state.id) }));
      return;
    }
    setPicked((current) => current.filter((id) => id !== nodeId));
    setStates(({ [nodeId]: _dropped, ...rest }) => rest);
    setExclusions((current) => current.map(({ [node.code]: _dropped, ...rest }) => rest));
  }

  function toggleState(nodeId: string, stateId: string, on: boolean): void {
    const node = network.nodes.find((candidate) => candidate.id === nodeId);
    setStates((current) => {
      const chosen = current[nodeId] ?? [];
      return { ...current, [nodeId]: on ? [...chosen, stateId] : chosen.filter((id) => id !== stateId) };
    });
    if (!on && node !== undefined) setExclusions((current) => current.filter((row) => row[node.code] !== stateId));
  }

  function setExclusion(index: number, dimensionId: string, stateId: string): void {
    setExclusions((current) => current.map((row, position) => {
      if (position !== index) return row;
      const { [dimensionId]: _old, ...rest } = row;
      return stateId.length === 0 ? rest : { ...rest, [dimensionId]: stateId };
    }));
  }

  async function generate(): Promise<void> {
    const empty = dimensions.find((dimension) => dimension.states.length === 0);
    if (empty !== undefined) {
      setError(`Pick at least one state of ${empty.id}.`);
      return;
    }
    if (limitInvalid) {
      setError("The scenario limit is a whole number of at least 1.");
      return;
    }
    const parsed = HclHazardSweepSpecSchema.safeParse({
      dimensions,
      excludedAssignments: exclusions.filter((row) => Object.keys(row).length > 0),
      ...(limit.trim().length === 0 ? {} : { maxScenarios: limitValue }),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "The scenario settings are not valid.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onGenerate(parsed.data);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The scenarios could not be generated.");
      setBusy(false);
    }
  }

  return (
    <DialogShell label="Generate evidence scenarios" onClose={onClose} fit>
      <DialogHead cap="Generate evidence scenarios" title={network.name.trim().length > 0 ? `${network.code} · ${network.name}` : network.code} onClose={onClose} />
      <div className="modal__body esq-dialog-body">
        <div className="esq-dialog-section">
          <span className="esq-dialog-head">Grid nodes</span>
          <table className="postable postable--mid es-records esq-results esq-dep__table" aria-label="Grid nodes">
            <thead><tr><th scope="col">Node</th><th scope="col">States</th></tr></thead>
            <tbody>
              {network.nodes.map((node) => {
                const on = picked.includes(node.id);
                const chosen = states[node.id] ?? [];
                return (
                  <tr key={node.id}>
                    <td>
                      <label className="esq-dep__check">
                        <input type="checkbox" checked={on} disabled={busy} onChange={(event) => toggleNode(node.id, event.target.checked)} />
                        <span>{node.code}</span>
                      </label>
                      {node.name.trim().length > 0 && node.name !== node.code && <span className="postable__name-sub">{node.name}</span>}
                    </td>
                    <td>
                      {on && (
                        <div className="esq-dep__checks">
                          {node.states.map((state) => (
                            <label key={state.id} className="esq-dep__check">
                              <input type="checkbox" aria-label={`${node.code} ${state.code}`} checked={chosen.includes(state.id)} disabled={busy} onChange={(event) => toggleState(node.id, state.id, event.target.checked)} />
                              <span>{state.code}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {dimensions.length > 0 && (
          <div className="esq-dialog-section">
            <span className="esq-dialog-head">Excluded combinations</span>
            {exclusions.map((row, index) => (
              <div key={index} className="esq-dep__exclusion">
                {dimensions.map((dimension) => (
                  <label key={dimension.id} className="esq-dep__field">
                    <span>{dimension.id}</span>
                    <select className="posfield__select" aria-label={`Exclusion ${String(index + 1)} ${dimension.id}`} value={row[dimension.id] ?? ""} disabled={busy} onChange={(event) => setExclusion(index, dimension.id, event.target.value)}>
                      <option value="">Any</option>
                      {dimension.states.map((stateId) => <option key={stateId} value={stateId}>{dimension.stateLabels[stateId] ?? stateId}</option>)}
                    </select>
                  </label>
                ))}
                <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} aria-label={`Remove exclusion ${String(index + 1)}`} onClick={() => setExclusions((current) => current.filter((_, position) => position !== index))}>Remove</button>
              </div>
            ))}
            <div className="esq-dep__inline">
              <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={() => setExclusions((current) => [...current, {}])}>Add exclusion</button>
            </div>
          </div>
        )}
        <div className="esq-dialog-section">
          <span className="esq-dialog-head">Scenario limit</span>
          <input className="esq-dep__input" type="number" min={1} step={1} placeholder="No limit" aria-label="Scenario limit" aria-invalid={limitInvalid} value={limit} disabled={busy} onChange={(event) => setLimit(event.target.value)} />
        </div>
        {error !== null && <p className="es-scope-error" role="alert">{error}</p>}
      </div>
      <div className="modal__foot esq-dep__foot">
        <span className="esq-dep__count">{combinations === 0 ? "" : `${combinations.toLocaleString()} ${combinations === 1 ? "combination" : "combinations"} before exclusions`}</span>
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={onClose}>Cancel</button>
        <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={busy || dimensions.length === 0} onClick={() => { void generate(); }}>{busy ? "Generating…" : "Generate"}</button>
      </div>
    </DialogShell>
  );
}

function GridRows({ network, configuration, grid, editable, onGrid }: {
  network: WorkbookBayesianNetwork;
  configuration: WorkbookHclConfiguration;
  grid: HclHazardGridDefinition | undefined;
  editable: boolean;
  onGrid: (grid: HclHazardGridDefinition | undefined) => void;
}): JSX.Element {
  const enabled = (configuration.evidenceScenarios ?? []).filter((scenario) => scenario.enabled);
  const candidates = network.nodes.filter((node) => enabled.length > 0 && enabled.every((scenario) => scenario.evidence.observations.some((observation) => observation.nodeId === node.id)));
  const scale = grid?.annualFrequencyScale ?? START_SCALE;

  function withGrid(patch: Partial<HclHazardGridDefinition>): void {
    if (grid === undefined) return;
    onGrid({ ...grid, ...patch });
  }

  function toggleNode(nodeId: string, on: boolean): void {
    const current = grid?.hazardNodeIds ?? [];
    const [first, ...rest] = network.nodes.map((node) => node.id).filter((id) => (id === nodeId ? on : current.includes(id)));
    if (first === undefined) {
      onGrid(undefined);
      return;
    }
    onGrid({
      name: grid?.name ?? `${configuration.code} hazard grid`,
      annualFrequencyScale: scale,
      normalizeWeights: grid?.normalizeWeights ?? false,
      hazardNodeIds: [first, ...rest],
    });
  }

  if (!editable) {
    return (
      <>
        <tr><th scope="row">Hazard grid</th><td>{grid?.name ?? "None"}</td></tr>
        {grid !== undefined && (
          <>
            <tr><th scope="row">Grid nodes</th><td>{grid.hazardNodeIds.map((nodeId) => nodeCodeOf(network, nodeId)).join(" and ")}</td></tr>
            <tr><th scope="row">Annual scale</th><td>{scaleText(grid.annualFrequencyScale)}</td></tr>
            <tr><th scope="row">Hours per year</th><td>{String(grid.annualFrequencyScale.annualization.hoursPerYear)}</td></tr>
            <tr><th scope="row">Weights</th><td>{grid.normalizeWeights ? "Normalized" : "Raw"}</td></tr>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <tr>
        <th scope="row">Grid nodes</th>
        <td>
          <div className="esq-dep__checks">
            {candidates.map((node) => (
              <label key={node.id} className="esq-dep__check">
                <input type="checkbox" checked={grid?.hazardNodeIds.includes(node.id) === true} onChange={(event) => toggleNode(node.id, event.target.checked)} />
                <span>{node.code}</span>
              </label>
            ))}
          </div>
        </td>
      </tr>
      {grid !== undefined && (
        <>
          <tr>
            <th scope="row">Annual scale</th>
            <td>
              <div className="esq-dep__inline">
                <input className="esq-dep__input" type="number" min={0} step="any" aria-label="Annual scale" value={scale.value} onChange={(event) => {
                  const value = Number(event.target.value);
                  if (event.target.value.trim().length > 0 && Number.isFinite(value) && value >= 0) withGrid({ annualFrequencyScale: { ...scale, value } });
                }} />
                <select className="posfield__select" aria-label="Annual scale unit" value={scale.unit} onChange={(event) => {
                  const unit = optionOf(UNITS, event.target.value);
                  if (unit !== undefined) withGrid({ annualFrequencyScale: { ...scale, unit } });
                }}>
                  {UNITS.map(([unit, text]) => <option key={unit} value={unit}>{text}</option>)}
                </select>
              </div>
            </td>
          </tr>
          <tr>
            <th scope="row">Hours per year</th>
            <td>
              <input className="esq-dep__input" type="number" min={0} step="any" aria-label="Hours per year" value={scale.annualization.hoursPerYear} onChange={(event) => {
                const hoursPerYear = Number(event.target.value);
                if (Number.isFinite(hoursPerYear) && hoursPerYear > 0) withGrid({ annualFrequencyScale: { ...scale, annualization: { ...scale.annualization, hoursPerYear } } });
              }} />
            </td>
          </tr>
          <tr>
            <th scope="row">Weights</th>
            <td>
              <select className="posfield__select" aria-label="Weights" value={grid.normalizeWeights ? "NORMALIZED" : "RAW"} onChange={(event) => withGrid({ normalizeWeights: event.target.value === "NORMALIZED" })}>
                {WEIGHTS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </td>
          </tr>
        </>
      )}
    </>
  );
}

function EvidenceSection({ option, network, workbookName, evidence, batchInput, running, onBatchInput }: EvidenceSectionProps): JSX.Element {
  const { runtime, editable } = useEsqWorkbook();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const configuration = option.configuration;
  const shown = studyConfiguration(configuration, batchInput);
  const scenarios = shown.evidenceScenarios ?? [];
  const enabled = scenarios.filter((scenario) => scenario.enabled);
  const temporary = batchInput !== null;
  const grid = shown.hazardGrid;
  const filename = network.code.trim().length > 0 ? network.code : "dependency-network";
  const base = configuration.baseEvidence.observations;
  const scenarioText = temporary ? `${String(scenarios.length)} temporary ${scenarios.length === 1 ? "row" : "rows"}`
    : enabled.length === scenarios.length ? `${String(scenarios.length)} saved in ${workbookName}`
    : `${String(enabled.length)} of ${String(scenarios.length)} turned on, saved in ${workbookName}`;

  async function upload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    try {
      const text = await file.text();
      const rows = file.name.toLowerCase().endsWith(".csv") ? importHclEvidenceScenariosCsv(text, network) : importHclEvidenceScenariosJson(text, network);
      onBatchInput({ evidenceScenarios: rows, ...(grid === undefined ? {} : { hazardGrid: grid }) });
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The evidence scenarios could not be read.");
    }
  }

  function sample(format: FileFormat): void {
    const rows = createEvidenceBatchSamples(network);
    if (rows.length === 0) {
      setError("The network has no node with a state.");
      return;
    }
    const name = `${filename}-evidence-sample.${format.toLowerCase()}`;
    if (format === "JSON") downloadText(name, exportHclEvidenceScenariosJson(rows, network), "application/json");
    else downloadText(name, exportHclEvidenceScenariosCsv(rows, network), "text/csv");
    setError(null);
  }

  function exportRows(format: FileFormat): void {
    const name = `${filename}-evidence-scenarios.${format.toLowerCase()}`;
    if (format === "JSON") downloadText(name, exportHclEvidenceScenariosJson(scenarios, network), "application/json");
    else downloadText(name, exportHclEvidenceScenariosCsv(scenarios, network), "text/csv");
  }

  async function generate(spec: HclHazardSweepSpec): Promise<void> {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null) throw new Error("Save the workbook first.");
    const response = await generateEsqHclScenarios(workbookId, configuration.modelId, revision, spec, { workbookId: option.workbookId, modelId: configuration.modelId });
    if (response.scenarios.length === 0) throw new Error("No scenario remains after the exclusions.");
    const nodeIds = spec.dimensions.map((dimension) => dimension.bnNode);
    const [first, ...rest] = nodeIds;
    if (first === undefined) return;
    onBatchInput({
      evidenceScenarios: readableScenarios(response.scenarios, network, nodeIds),
      hazardGrid: {
        name: grid?.name ?? `${configuration.code} hazard grid`,
        annualFrequencyScale: grid?.annualFrequencyScale ?? START_SCALE,
        normalizeWeights: grid?.normalizeWeights ?? false,
        hazardNodeIds: [first, ...rest],
      },
    });
    setError(null);
  }

  function changeGrid(next: HclHazardGridDefinition | undefined): void {
    if (batchInput === null) return;
    const { hazardGrid: _old, ...rest } = batchInput;
    onBatchInput(next === undefined ? rest : { ...rest, hazardGrid: next });
  }

  return (
    <section className="esq-dep__section" aria-label="Evidence scenarios">
      <div className="esq-dep__head">
        <h4 className="esq-dep__title">Evidence scenarios</h4>
        <div className="esq-dep__tools">
          {editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={running} onClick={() => setGenerating(true)}>Generate</button>}
          <input ref={uploadRef} hidden type="file" accept=".json,.csv,application/json,text/csv" aria-label="Upload evidence scenarios" onChange={(event) => { void upload(event); }} />
          <button type="button" className="posnav__btn posnav__btn--sm" disabled={running} onClick={() => uploadRef.current?.click()}>Upload</button>
          <FileMenu label="Sample" onPick={sample} />
          {scenarios.length > 0 && <FileMenu label="Export" onPick={exportRows} />}
          {temporary && <button type="button" className="posnav__btn posnav__btn--sm" disabled={running} onClick={() => onBatchInput(null)}>Use saved scenarios</button>}
        </div>
      </div>
      <table className="postable postable--mid es-records esq-results esq-dep__table esq-dep__facts" aria-label="Evidence">
        <tbody>
          <tr><th scope="row">Base evidence</th><td>{base.length === 0 ? "None" : observationText(network, base)}</td></tr>
          <tr><th scope="row">Scenarios</th><td>{scenarioText}</td></tr>
          {evidence === "HAZARD" && <GridRows network={network} configuration={shown} grid={grid} editable={temporary && !running} onGrid={changeGrid} />}
        </tbody>
      </table>
      {scenarios.length > 0 && (
        <PagedResults items={scenarios} label="Evidence scenarios" resetKey={`${option.key}:${temporary ? "temporary" : "saved"}:${String(scenarios.length)}`}>
          {(page) => (
            <table className="postable postable--mid es-records esq-results esq-dep__table" aria-label="Evidence scenarios">
              <thead><tr><th scope="col">Scenario</th><th scope="col">Evidence</th></tr></thead>
              <tbody>
                {page.map((scenario) => {
                  const sub = [scenario.name !== scenario.code ? scenario.name : "", scenario.enabled ? "" : "Off"].filter((part) => part.length > 0).join(" · ");
                  return (
                    <tr key={scenario.id}>
                      <td>
                        <span className="postable__name">{scenario.code}</span>
                        {sub.length > 0 && <span className="postable__name-sub">{sub}</span>}
                      </td>
                      <td>{scenario.evidence.observations.length === 0 ? "None" : observationText(network, scenario.evidence.observations)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </PagedResults>
      )}
      {error !== null && <p className="es-scope-error" role="alert">{error}</p>}
      {generating && <ScenarioGenerator network={network} onGenerate={generate} onClose={() => setGenerating(false)} />}
    </section>
  );
}

function DependencyPanel({ network, ...props }: DependencyPanelProps & { network: WorkbookBayesianNetwork }): JSX.Element {
  const { upstream, runtime } = useEsqWorkbook();
  const { option } = props;
  const configuration = option.configuration;
  const validation = useMemo(() => validateBayesianNetworkModel(network, {
    evidence: configuration.baseEvidence,
    hclBindings: configuration.bindings,
    workbookId: option.workbookId,
  }), [network, configuration, option.workbookId]);
  const workbookName = upstream.options.SY.find((workbook) => workbook.id === option.workbookId)?.name ?? exampleLinkLabel(option.workbookId) ?? "the linked SY workbook";
  const sourceHref = `/sy-workbooks/${encodeURIComponent(option.workbookId)}?step=deps&network=${encodeURIComponent(network.modelId)}&esqWorkbook=${encodeURIComponent(runtime.workbookId ?? "")}`;

  return (
    <div className="esq-dep" role="region" aria-label="Dependencies">
      <BayesianNetworkEditor
        model={network}
        editable={false}
        readOnlyNotice={{ message: `This network belongs to ${workbookName}. Edit it in that workbook's Dependencies step.`, sourceHref, sourceLabel: `Open ${workbookName}` }}
        showAnalysis={false}
        showQueryAnalysis={false}
        hclScope="EVENT_TREE"
        analysisHost="esq"
        evidence={configuration.baseEvidence}
        queryNodeId={network.nodes[0]?.id ?? null}
        validation={validation}
        analysisResult={null}
        running={false}
        runError={null}
        workbookId={option.workbookId}
        hclConfigurations={[configuration]}
        faultTreeOptions={[]}
        eventTreeOptions={[]}
        hclRunning={false}
        hclRunError={null}
        hclRunResult={null}
        hclBatchRunResult={null}
        onModelChange={() => undefined}
        onEvidenceChange={() => undefined}
        onQueryNodeChange={() => undefined}
        onHclConfigurationsChange={() => undefined}
        onRunHclFaultTree={() => undefined}
        onRunHclEventTree={() => undefined}
        onRunHclFaultTreeBatch={() => undefined}
        onRunHclEventTreeBatch={() => undefined}
        onRun={() => undefined}
      />
      {props.evidence !== "BASE" && <EvidenceSection {...props} network={network} workbookName={workbookName} />}
    </div>
  );
}

function dependencyNetworkOf(option: NetworkOption, networks: readonly WorkbookBayesianNetwork[]): WorkbookBayesianNetwork | undefined {
  const reference = option.configuration.bayesianNetwork;
  return reference.workbookId === option.workbookId ? networks.find((candidate) => candidate.modelId === reference.modelId) : undefined;
}

function EsqDependencies(props: DependencyPanelProps): JSX.Element | null {
  const { upstream } = useEsqWorkbook();
  const network = dependencyNetworkOf(props.option, upstream.sy?.dependencyBayesianNetworks ?? []);
  if (network === undefined) return null;
  return <DependencyPanel {...props} network={network} />;
}

export {
  EsqDependencies,
  dependencyEvidenceProblem,
  dependencyNetworkOf,
  studyConfiguration,
  studyTree,
  type DependencyEvidence,
  type DependencyStudy,
  type DependencyStudyTree,
};
