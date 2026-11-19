import { JSX, useEffect, useRef, useState, type ChangeEvent } from "react";
import type { EsqBayesianNetwork, EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import {
  DEFAULT_ANNUALIZATION_CONVENTION,
  type AnnualizedFrequencyInput,
  type EventFrequencyUnit,
  type HclHazardGridDefinition,
} from "interfaces-mef-types/modeling";
import {
  HclHazardSweepSpecSchema,
  type HclBatchInput,
  type HclEvidenceScenario,
  type HclHazardSweepSpec,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import {
  createEvidenceScenarioSamples,
  downloadText,
  exportHclEvidenceScenariosCsv,
  exportHclEvidenceScenariosJson,
  importHclEvidenceScenariosCsv,
  importHclEvidenceScenariosJson,
} from "../newly-developed-methods/hybrid-causal-logic/hclEvidenceScenarioInterchange";
import { PagedResults } from "../newly-developed-methods/shared/resultPresentation";
import { DialogHead, DialogShell } from "../es-workbooks/EsScope";
import { useEsqWorkbook } from "./esqWorkbookContext";
import { generateEsqHclScenarios } from "./esqWorkbookApi";
import "./css/esqDependencies.css";

type DependencyEvidence = "BASE" | "SCENARIOS" | "HAZARD";

type FileFormat = "JSON" | "CSV";

interface Observation {
  nodeId: string;
  stateId: string;
}

interface ScenarioRow {
  nodeId: string;
  code: string;
  name: string;
  states: readonly { id: string; code: string }[];
}

interface EvidenceSectionProps {
  configuration: EsqHclConfiguration;
  network: EsqBayesianNetwork;
  evidence: DependencyEvidence;
  batchInput: HclBatchInput | null;
  running: boolean;
  open: boolean;
  onBatchInput: (input: HclBatchInput | null) => void;
  onOpen: (open: boolean) => void;
}

const MAX_CODE = 64;

const MAX_NAME = 200;

const UNITS: readonly (readonly [EventFrequencyUnit, string])[] = [["PER_YEAR", "per year"], ["PER_DAY", "per day"], ["PER_HOUR", "per hour"], ["PER_MINUTE", "per minute"], ["PER_SECOND", "per second"]];

const WEIGHTS: readonly (readonly ["RAW" | "NORMALIZED", string])[] = [["RAW", "Raw"], ["NORMALIZED", "Normalized"]];

const START_SCALE: AnnualizedFrequencyInput = { value: 1, unit: "PER_YEAR", annualization: { ...DEFAULT_ANNUALIZATION_CONVENTION } };

function withoutGrid(configuration: EsqHclConfiguration): EsqHclConfiguration {
  const { hazardGrid: _saved, ...rest } = configuration;
  return rest;
}

function studyConfiguration(configuration: EsqHclConfiguration, batchInput: HclBatchInput | null): EsqHclConfiguration {
  return batchInput === null ? configuration : { ...withoutGrid(configuration), ...batchInput };
}

function cellKey(scenario: HclEvidenceScenario, nodeIds: readonly string[]): string | undefined {
  const states = nodeIds.map((nodeId) => scenario.evidence.observations.find((observation) => observation.nodeId === nodeId)?.stateId);
  return states.every((stateId): stateId is string => stateId !== undefined) ? states.join("|") : undefined;
}

function knownObservation(network: EsqBayesianNetwork, observation: Observation): boolean {
  return network.nodes.some((node) => node.id === observation.nodeId && node.states.some((state) => state.id === observation.stateId));
}

function dependencyEvidenceProblem(configuration: EsqHclConfiguration, evidence: DependencyEvidence, network: EsqBayesianNetwork): string | undefined {
  if (evidence === "BASE") return undefined;
  const enabled = (configuration.evidenceScenarios ?? []).filter((scenario) => scenario.enabled);
  if (enabled.length === 0) return "The dependency configuration has no enabled evidence scenario.";
  const stale = enabled.find((scenario) => scenario.evidence.observations.some((observation) => !knownObservation(network, observation)));
  if (stale !== undefined) return `Evidence scenario ${stale.code} sets a node or a state that is not in the network.`;
  if (evidence === "SCENARIOS") return undefined;
  const grid = configuration.hazardGrid;
  if (grid === undefined) return "The evidence scenarios have no hazard grid.";
  const cells = enabled.map((scenario) => cellKey(scenario, grid.hazardNodeIds));
  if (cells.some((cell) => cell === undefined)) return "Every evidence scenario must set each grid node.";
  if (new Set(cells).size !== cells.length) return "Two evidence scenarios set the same grid cell.";
  return undefined;
}

function storeProblem(configuration: EsqHclConfiguration): string | undefined {
  const scenarios = configuration.evidenceScenarios ?? [];
  if (scenarios.some((scenario) => scenario.code.trim().length === 0)) return "A scenario needs a code.";
  if (scenarios.some((scenario) => scenario.name.trim().length === 0)) return "A scenario needs a name.";
  const codes = new Set<string>();
  for (const scenario of scenarios) {
    const code = scenario.code.trim().toUpperCase();
    if (codes.has(code)) return `Another scenario already has the code ${scenario.code.trim()}.`;
    codes.add(code);
  }
  const grid = configuration.hazardGrid;
  if (grid === undefined) return undefined;
  const enabled = scenarios.filter((scenario) => scenario.enabled);
  if (enabled.length === 0) return "The hazard grid needs one scenario that is on.";
  const cells = new Map<string, string>();
  for (const scenario of enabled) {
    const cell = cellKey(scenario, grid.hazardNodeIds);
    if (cell === undefined) return `Scenario ${scenario.code} would not set every grid node.`;
    const other = cells.get(cell);
    if (other !== undefined) return `Scenarios ${other} and ${scenario.code} would share one grid cell.`;
    cells.set(cell, scenario.code);
  }
  return undefined;
}

function optionOf<T extends string>(options: readonly (readonly [T, string])[], value: string): T | undefined {
  return options.find(([option]) => option === value)?.[0];
}

function nodeCodeOf(network: EsqBayesianNetwork, nodeId: string): string {
  return network.nodes.find((node) => node.id === nodeId)?.code ?? "Missing node";
}

function observationText(network: EsqBayesianNetwork, observations: readonly Observation[]): string {
  return observations.map((observation) => {
    const node = network.nodes.find((candidate) => candidate.id === observation.nodeId);
    const state = node?.states.find((candidate) => candidate.id === observation.stateId);
    return `${node?.code ?? "Missing node"} ${state?.code ?? "missing state"}`;
  }).join(" · ");
}

function scaleText(scale: AnnualizedFrequencyInput): string {
  return `${String(Number(scale.value.toPrecision(6)))} ${UNITS.find(([unit]) => unit === scale.unit)?.[1] ?? ""}`.trim();
}

function readableScenarios(rows: readonly HclEvidenceScenario[], network: EsqBayesianNetwork, nodeIds: readonly string[]): HclEvidenceScenario[] {
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

function nextScenarioCode(scenarios: readonly HclEvidenceScenario[]): string {
  const codes = new Set(scenarios.map((scenario) => scenario.code.trim().toUpperCase()));
  let suffix = scenarios.length + 1;
  while (codes.has(`SCN-${String(suffix)}`)) suffix += 1;
  return `SCN-${String(suffix)}`;
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

function ScenarioGenerator({ network, onGenerate, onClose }: { network: EsqBayesianNetwork; onGenerate: (spec: HclHazardSweepSpec) => Promise<void>; onClose: () => void }): JSX.Element {
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

function ScenarioText({ label, value, limit, wide = false, disabled, onCommit }: {
  label: string;
  value: string;
  limit: number;
  wide?: boolean;
  disabled: boolean;
  onCommit: (next: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);

  function commit(): void {
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    if (next !== value) onCommit(next);
  }

  return (
    <input
      className={wide ? "esq-dep__input esq-dep__input--wide" : "esq-dep__input"}
      aria-label={label}
      maxLength={limit}
      value={draft ?? value}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

function ScenarioWindow({ scenario, network, editable, problem, onChange, onClose }: {
  scenario: HclEvidenceScenario;
  network: EsqBayesianNetwork;
  editable: boolean;
  problem: string | null;
  onChange: (next: HclEvidenceScenario) => void;
  onClose: () => void;
}): JSX.Element {
  const rows: ScenarioRow[] = [
    ...network.nodes.map((node) => ({ nodeId: node.id, code: node.code, name: node.name, states: node.states })),
    ...scenario.evidence.observations
      .filter((observation) => !network.nodes.some((node) => node.id === observation.nodeId))
      .map((observation) => ({ nodeId: observation.nodeId, code: "Missing node", name: "", states: [] })),
  ];

  function setObservation(nodeId: string, stateId: string): void {
    const kept = scenario.evidence.observations.filter((observation) => observation.nodeId !== nodeId);
    onChange({ ...scenario, evidence: { observations: stateId.length === 0 ? kept : [...kept, { nodeId, stateId }] } });
  }

  return (
    <DialogShell label="Evidence scenario" onClose={onClose} fit>
      <DialogHead cap="Evidence scenario" title={scenario.code} onClose={onClose} />
      <div className="modal__body esq-dialog-body">
        <div className="esq-dep__inline">
          <label className="esq-dep__field">
            <span>Code</span>
            <ScenarioText label="Scenario code" value={scenario.code} limit={MAX_CODE} disabled={!editable} onCommit={(code) => onChange({ ...scenario, code })} />
          </label>
          <label className="esq-dep__field">
            <span>Name</span>
            <ScenarioText label="Scenario name" value={scenario.name} limit={MAX_NAME} wide disabled={!editable} onCommit={(name) => onChange({ ...scenario, name })} />
          </label>
        </div>
        {problem !== null && <p className="es-scope-error" role="alert">{problem}</p>}
        <PagedResults items={rows} label="Scenario evidence" resetKey={scenario.id}>
          {(page) => (
            <table className="postable postable--mid es-records esq-results esq-dep__table" aria-label="Scenario evidence">
              <thead><tr><th scope="col">Node</th><th scope="col">State</th></tr></thead>
              <tbody>
                {page.map((node) => {
                  const observation = scenario.evidence.observations.find((candidate) => candidate.nodeId === node.nodeId);
                  const known = observation === undefined || node.states.some((state) => state.id === observation.stateId);
                  return (
                    <tr key={node.nodeId}>
                      <td>
                        <span className="postable__name">{node.code}</span>
                        {node.name.trim().length > 0 && node.name !== node.code && <span className="postable__name-sub">{node.name}</span>}
                      </td>
                      <td>
                        <select className="posfield__select" aria-label={`${node.code} state in ${scenario.code}`} value={observation?.stateId ?? ""} disabled={!editable} onChange={(event) => setObservation(node.nodeId, event.target.value)}>
                          <option value="">Base evidence</option>
                          {!known && observation !== undefined && <option value={observation.stateId} disabled>Missing state</option>}
                          {node.states.map((state) => <option key={state.id} value={state.id}>{state.code}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </PagedResults>
      </div>
    </DialogShell>
  );
}

function GridNumber({ label, value, accepts, onCommit }: {
  label: string;
  value: number;
  accepts: (next: number) => boolean;
  onCommit: (next: number) => void;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);

  function commit(): void {
    if (draft === null) return;
    const next = Number(draft);
    setDraft(null);
    if (draft.trim().length > 0 && Number.isFinite(next) && accepts(next) && next !== value) onCommit(next);
  }

  return (
    <input
      className="esq-dep__input"
      type="number"
      min={0}
      step="any"
      aria-label={label}
      value={draft ?? String(value)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

function GridRows({ network, configuration, grid, editable, onGrid }: {
  network: EsqBayesianNetwork;
  configuration: EsqHclConfiguration;
  grid: HclHazardGridDefinition | undefined;
  editable: boolean;
  onGrid: (grid: HclHazardGridDefinition | undefined) => void;
}): JSX.Element {
  const enabled = (configuration.evidenceScenarios ?? []).filter((scenario) => scenario.enabled);
  const inGrid: readonly string[] = grid?.hazardNodeIds ?? [];
  const candidates = network.nodes.filter((node) => inGrid.includes(node.id) || (enabled.length > 0 && enabled.every((scenario) => scenario.evidence.observations.some((observation) => observation.nodeId === node.id))));
  const missing = inGrid.filter((nodeId) => !network.nodes.some((node) => node.id === nodeId));
  const scale = grid?.annualFrequencyScale ?? START_SCALE;

  function withGrid(patch: Partial<HclHazardGridDefinition>): void {
    if (grid === undefined) return;
    onGrid({ ...grid, ...patch });
  }

  function toggleNode(nodeId: string, on: boolean): void {
    const current: readonly string[] = grid?.hazardNodeIds ?? [];
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
            {missing.map((nodeId) => (
              <label key={nodeId} className="esq-dep__check">
                <input type="checkbox" checked onChange={() => toggleNode(nodeId, false)} />
                <span>Missing node</span>
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
                <GridNumber label="Annual scale" value={scale.value} accepts={(value) => value >= 0} onCommit={(value) => withGrid({ annualFrequencyScale: { ...scale, value } })} />
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
              <GridNumber label="Hours per year" value={scale.annualization.hoursPerYear} accepts={(hoursPerYear) => hoursPerYear > 0} onCommit={(hoursPerYear) => withGrid({ annualFrequencyScale: { ...scale, annualization: { ...scale.annualization, hoursPerYear } } })} />
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

function EsqDependencyEvidence({ configuration, network, evidence, batchInput, running, open, onBatchInput, onOpen }: EvidenceSectionProps): JSX.Element {
  const { runtime, editable, mutateEsq } = useEsqWorkbook();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = studyConfiguration(configuration, batchInput);
  const scenarios = shown.evidenceScenarios ?? [];
  const enabled = scenarios.filter((scenario) => scenario.enabled);
  const temporary = batchInput !== null;
  const authoring = editable && !temporary && !running;
  const grid = shown.hazardGrid;
  const filename = network.code.trim().length > 0 ? network.code : "dependency-network";
  const base = configuration.baseEvidence.observations;
  const openScenario = temporary ? undefined : scenarios.find((scenario) => scenario.id === openId);
  const scenarioText = temporary ? `${String(scenarios.length)} temporary ${scenarios.length === 1 ? "row" : "rows"}`
    : enabled.length === scenarios.length ? `${String(scenarios.length)} saved`
    : `${String(enabled.length)} of ${String(scenarios.length)} turned on`;

  function save(next: EsqHclConfiguration): boolean {
    const problem = storeProblem(next);
    setError(problem ?? null);
    if (problem !== undefined) return false;
    mutateEsq((current) => ({ ...current, hclConfigurations: current.hclConfigurations.map((candidate) => (candidate.modelId === next.modelId ? next : candidate)) }));
    return true;
  }

  function saveScenarios(rows: readonly HclEvidenceScenario[]): boolean {
    return save({ ...configuration, evidenceScenarios: [...rows] });
  }

  function saveGrid(next: HclHazardGridDefinition | undefined): void {
    save(next === undefined ? withoutGrid(configuration) : { ...configuration, hazardGrid: next });
  }

  function keepTemporary(): void {
    if (batchInput === null) return;
    if (save({ ...withoutGrid(configuration), ...batchInput })) onBatchInput(null);
  }

  function addScenario(): void {
    const saved = configuration.evidenceScenarios ?? [];
    const created: HclEvidenceScenario = {
      id: crypto.randomUUID(),
      code: nextScenarioCode(saved),
      name: `Evidence scenario ${String(saved.length + 1)}`,
      enabled: configuration.hazardGrid === undefined,
      evidence: { observations: [] },
    };
    if (saveScenarios([...saved, created])) setOpenId(created.id);
  }

  function openWindow(id: string): void {
    setError(null);
    setOpenId(id);
  }

  function closeWindow(): void {
    setError(null);
    setOpenId(null);
  }

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
    const rows = createEvidenceScenarioSamples(network);
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
    const response = await generateEsqHclScenarios(workbookId, configuration.modelId, revision, spec);
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
    if (batchInput === null) {
      saveGrid(next);
      return;
    }
    const { hazardGrid: _old, ...rest } = batchInput;
    onBatchInput(next === undefined ? rest : { ...rest, hazardGrid: next });
  }

  return (
    <>
    <section className="esq-dep__section esq-dep__evidence" aria-label="Evidence scenarios">
      <div className="esq-dep__head">
        <div className="esq-dep__evidence-lead">
          <h4 className="esq-dep__title">
            <button type="button" className="posnav__btn posnav__btn--sm esq-dep__toggle" aria-expanded={open} onClick={() => onOpen(!open)}>
              <span>Evidence scenarios</span>
              <svg className="esq-dep__toggle-chevron" viewBox="0 0 12 8" aria-hidden="true"><path d="m1 1 5 5 5-5" /></svg>
            </button>
          </h4>
          {!open && <span className="esq-dep__evidence-summary">{scenarioText}</span>}
        </div>
        {open && (
          <div className="esq-dep__tools">
            {authoring && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addScenario}>Add scenario</button>}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={running} onClick={() => setGenerating(true)}>Generate</button>}
            <input ref={uploadRef} hidden type="file" accept=".json,.csv,application/json,text/csv" aria-label="Upload evidence scenarios" onChange={(event) => { void upload(event); }} />
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={running} onClick={() => uploadRef.current?.click()}>Upload</button>
            <FileMenu label="Sample" onPick={sample} />
            {scenarios.length > 0 && <FileMenu label="Export" onPick={exportRows} />}
            {temporary && editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={running} onClick={keepTemporary}>Save scenarios</button>}
            {temporary && <button type="button" className="posnav__btn posnav__btn--sm" disabled={running} onClick={() => onBatchInput(null)}>Use saved scenarios</button>}
          </div>
        )}
      </div>
      {open && (
        <table className="esq-dep__evidence-facts" aria-label="Evidence">
          <tbody>
            <tr><th scope="row">Base evidence</th><td>{base.length === 0 ? "None" : observationText(network, base)}</td></tr>
            {evidence === "HAZARD" && <GridRows network={network} configuration={shown} grid={grid} editable={editable && !running} onGrid={changeGrid} />}
          </tbody>
        </table>
      )}
      {open && error !== null && <p className="es-scope-error" role="alert">{error}</p>}
      {open && scenarios.length > 0 && (
        <PagedResults items={scenarios} label="Evidence scenarios" resetKey={`${configuration.modelId}:${temporary ? "temporary" : "saved"}`}>
          {(page) => (
            <table className="esq-dep__evidence-list" aria-label="Evidence scenarios">
              <thead>
                <tr>
                  {authoring && <th scope="col">On</th>}
                  <th scope="col">Scenario</th>
                  <th scope="col">Evidence</th>
                  {authoring && <th scope="col" className="es-records__act" aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {page.map((scenario) => {
                  const sub = [scenario.name !== scenario.code ? scenario.name : "", scenario.enabled || authoring ? "" : "Off"].filter((part) => part.length > 0).join(" · ");
                  return (
                    <tr key={scenario.id}>
                      {authoring && (
                        <td>
                          <input type="checkbox" aria-label={`Use ${scenario.code}`} checked={scenario.enabled} onChange={(event) => saveScenarios(scenarios.map((candidate) => (candidate.id === scenario.id ? { ...candidate, enabled: event.target.checked } : candidate)))} />
                        </td>
                      )}
                      <td>
                        {temporary
                          ? <span className="esq-dep__evidence-code">{scenario.code}</span>
                          : <button type="button" className="es-records__link" aria-label={`${editable ? "Edit" : "View"} ${scenario.code}`} onClick={() => openWindow(scenario.id)}>{scenario.code}</button>}
                        {sub.length > 0 && <span className="esq-dep__evidence-name">{sub}</span>}
                      </td>
                      <td>{scenario.evidence.observations.length === 0 ? "None" : observationText(network, scenario.evidence.observations)}</td>
                      {authoring && (
                        <td className="es-records__act">
                          <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Remove ${scenario.code}`} onClick={() => saveScenarios(scenarios.filter((candidate) => candidate.id !== scenario.id))}>Remove</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </PagedResults>
      )}
    </section>
    {generating && <ScenarioGenerator network={network} onGenerate={generate} onClose={() => setGenerating(false)} />}
    {openScenario !== undefined && (
      <ScenarioWindow
        key={openScenario.id}
        scenario={openScenario}
        network={network}
        editable={editable && !running}
        problem={error}
        onChange={(next) => { saveScenarios(scenarios.map((candidate) => (candidate.id === next.id ? next : candidate))); }}
        onClose={closeWindow}
      />
    )}
    </>
  );
}

export { EsqDependencyEvidence, dependencyEvidenceProblem, studyConfiguration, type DependencyEvidence };
