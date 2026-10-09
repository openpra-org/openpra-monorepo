import { useState, type JSX } from "react";
import type { UncertainExpression, UncertainUnit } from "interfaces-mef-types/core/uncertainty";
import type {
  BayesianNetworkNode,
  HclCptGenerator,
  HclCptGeneratorUncertainty,
  HclUncertaintySettings,
  WorkbookModelAddress,
} from "interfaces-mef-types/modeling";
import { HclCptGeneratorSchema } from "interfaces-mef-types/zod/modeling";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { ExpressionEditor } from "../shared/uncertainEditor";

type GeneratorKind = HclCptGenerator["kind"];

type FragilityGenerator = Extract<HclCptGenerator, { kind: "SEISMIC_FRAGILITY" }>;

type PgaBinsGenerator = Extract<HclCptGenerator, { kind: "SEISMIC_PGA_BINS" }>;

const GENERATOR_LABELS: Record<GeneratorKind, string> = {
  SEISMIC_FRAGILITY: "Seismic fragility",
  SEISMIC_PGA_BINS: "PGA bins",
};

function point(unit: UncertainUnit, value: number): UncertainExpression {
  return { node: "VALUE", value: { unit, law: { family: "POINT", value } } };
}

function isGeneratorKind(value: string): value is GeneratorKind {
  return value === "SEISMIC_FRAGILITY" || value === "SEISMIC_PGA_BINS";
}

function parsedNumber(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

function NumberField({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => boolean }): JSX.Element {
  return (
    <label>
      <span>{label}</span>
      <input
        key={value}
        type="text"
        inputMode="decimal"
        defaultValue={String(value)}
        disabled={disabled}
        onBlur={(event) => {
          const next = parsedNumber(event.target.value);
          if (next === undefined || !onChange(next)) event.target.value = String(value);
        }}
      />
    </label>
  );
}

function StateSelect({ label, value, states, disabled, onChange }: {
  label: string;
  value: string;
  states: readonly { id: string; code: string }[];
  disabled: boolean;
  onChange: (id: string) => void;
}): JSX.Element {
  return (
    <label>
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {states.map((state) => <option key={state.id} value={state.id}>{state.code}</option>)}
      </select>
    </label>
  );
}

function SlotField({ label, children }: { label: string; children: JSX.Element }): JSX.Element {
  return (
    <fieldset className="hcleditor__uncertainty-slot">
      <legend>{label}</legend>
      {children}
    </fieldset>
  );
}

function fragilityDraft(node: BayesianNetworkNode, parent: BayesianNetworkNode): FragilityGenerator | undefined {
  const failure = node.states[1];
  if (failure === undefined) return undefined;
  return {
    kind: "SEISMIC_FRAGILITY",
    pgaParentId: parent.id,
    trueStateId: failure.id,
    falseStateId: node.states[0].id,
    median: point("QUANTITY", 1),
    randomness: point("FACTOR", 1),
    demands: parent.states.map((state) => ({ stateId: state.id, demand: 0 })),
  };
}

function pgaBinsDraft(node: BayesianNetworkNode): PgaBinsGenerator {
  return {
    kind: "SEISMIC_PGA_BINS",
    noneStateId: node.states[0].id,
    missionTime: point("YEARS", 1),
    conversion: "POISSON",
    bins: node.states.slice(1).map((state) => ({ stateId: state.id, frequency: point("PER_YEAR", 0) })),
  };
}

function FragilityParameters({ generator, node, parents, disabled, update }: {
  generator: FragilityGenerator;
  node: BayesianNetworkNode;
  parents: readonly BayesianNetworkNode[];
  disabled: boolean;
  update: (generator: HclCptGenerator) => boolean;
}): JSX.Element {
  const parent = parents.find((candidate) => candidate.id === generator.pgaParentId);
  return (
    <div className="hcleditor__uncertainty-generator">
      <p>P = Φ(ln(demand / median) / randomness). Use one acceleration unit for the median and the demands. Give the median a lognormal law to carry the capacity uncertainty, β U. Every row shares one median draw.</p>
      <div className="hcleditor__uncertainty-parameters">
        <StateSelect label="PGA parent" value={generator.pgaParentId} states={parents} disabled={disabled} onChange={(id) => {
          const selected = parents.find((candidate) => candidate.id === id);
          if (selected !== undefined) update({ ...generator, pgaParentId: id, demands: selected.states.map((state) => ({ stateId: state.id, demand: 0 })) });
        }} />
        <StateSelect label="Failure state" value={generator.trueStateId} states={node.states} disabled={disabled} onChange={(id) => {
          const other = node.states.find((state) => state.id !== id);
          if (other !== undefined) update({ ...generator, trueStateId: id, falseStateId: other.id });
        }} />
      </div>
      <SlotField label="Median capacity">
        <ExpressionEditor expression={generator.median} unit="QUANTITY" disabled={disabled} onChange={(median) => update({ ...generator, median })} />
      </SlotField>
      <SlotField label="Randomness, β R">
        <ExpressionEditor expression={generator.randomness} unit="FACTOR" disabled={disabled} onChange={(randomness) => update({ ...generator, randomness })} />
      </SlotField>
      <div className="hcleditor__uncertainty-parameters" role="group" aria-label="Demand per PGA state">
        {generator.demands.map((entry, index) => (
          <NumberField
            key={entry.stateId}
            label={`Demand at ${parent?.states.find((state) => state.id === entry.stateId)?.code ?? entry.stateId}`}
            value={entry.demand}
            disabled={disabled}
            onChange={(demand) => update({ ...generator, demands: generator.demands.map((item, at) => (at === index ? { ...item, demand } : item)) })}
          />
        ))}
      </div>
    </div>
  );
}

function PgaBinsParameters({ generator, node, disabled, update }: {
  generator: PgaBinsGenerator;
  node: BayesianNetworkNode;
  disabled: boolean;
  update: (generator: HclCptGenerator) => boolean;
}): JSX.Element {
  return (
    <div className="hcleditor__uncertainty-generator">
      <p>Each bin turns its frequency into a probability over the mission time. The none state takes the rest. A total above one is an error.</p>
      <div className="hcleditor__uncertainty-parameters">
        <StateSelect label="No-earthquake state" value={generator.noneStateId} states={node.states} disabled={disabled} onChange={(id) => update({
          ...generator,
          noneStateId: id,
          bins: node.states.filter((state) => state.id !== id).map((state) => generator.bins.find((bin) => bin.stateId === state.id) ?? { stateId: state.id, frequency: point("PER_YEAR", 0) }),
        })} />
        <label>
          <span>Frequency conversion</span>
          <select value={generator.conversion} disabled={disabled} onChange={(event) => update({ ...generator, conversion: event.target.value === "LINEAR" ? "LINEAR" : "POISSON" })}>
            <option value="POISSON">Poisson, 1 − exp(−f t)</option>
            <option value="LINEAR">Linear, f t</option>
          </select>
        </label>
      </div>
      <SlotField label="Mission time">
        <ExpressionEditor expression={generator.missionTime} unit="YEARS" disabled={disabled} onChange={(missionTime) => update({ ...generator, missionTime })} />
      </SlotField>
      {generator.bins.map((bin, index) => (
        <SlotField key={bin.stateId} label={`Frequency of ${node.states.find((state) => state.id === bin.stateId)?.code ?? bin.stateId}`}>
          <ExpressionEditor expression={bin.frequency} unit="PER_YEAR" disabled={disabled} onChange={(frequency) => update({ ...generator, bins: generator.bins.map((item, at) => (at === index ? { ...item, frequency } : item)) })} />
        </SlotField>
      ))}
    </div>
  );
}

function HclSeismicGeneratorControls({ model, reference, settings, disabled, onChange, onError }: {
  model: BayesianNetworkModel;
  reference: WorkbookModelAddress;
  settings: HclUncertaintySettings;
  disabled: boolean;
  onChange: (settings: HclUncertaintySettings) => void;
  onError: (message: string | null) => void;
}): JSX.Element {
  const [kind, setKind] = useState<GeneratorKind>("SEISMIC_FRAGILITY");
  const [nodeId, setNodeId] = useState("");
  const generators = settings.cptGenerators;
  const parentsOf = (id: string): BayesianNetworkNode[] =>
    (model.conditionalProbabilityTables.find((table) => table.nodeId === id)?.parents ?? []).flatMap((parent) => model.nodes.filter((node) => node.id === parent.nodeId));
  const options = model.nodes.filter((node) =>
    !generators.some((definition) => definition.bayesianNetworkNode.entityId === node.id)
    && !settings.cptRows.some((row) => row.bayesianNetworkNode.entityId === node.id)
    && (kind === "SEISMIC_FRAGILITY" ? node.states.length === 2 && parentsOf(node.id).length > 0 : node.states.length >= 2 && parentsOf(node.id).length === 0));
  const selected = options.find((node) => node.id === nodeId) ?? options[0];

  function replace(index: number, generator: HclCptGenerator): boolean {
    const parsed = HclCptGeneratorSchema.safeParse(generator);
    if (!parsed.success) {
      onError(parsed.error.issues[0]?.message ?? "Check the seismic parameters.");
      return false;
    }
    onChange({ ...settings, cptGenerators: generators.map((definition, at) => (at === index ? { ...definition, generator: parsed.data } : definition)) });
    onError(null);
    return true;
  }

  function add(): void {
    if (selected === undefined) return;
    const parent = parentsOf(selected.id)[0];
    const generator = kind === "SEISMIC_FRAGILITY" ? (parent === undefined ? undefined : fragilityDraft(selected, parent)) : pgaBinsDraft(selected);
    if (generator === undefined) {
      onError("A fragility node needs two states and a PGA parent.");
      return;
    }
    const definition: HclCptGeneratorUncertainty = {
      bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: reference.workbookId, modelId: reference.modelId, entityId: selected.id },
      generator,
    };
    onChange({ ...settings, cptGenerators: [...generators, definition] });
    onError(null);
  }

  return (
    <section className="hcleditor__uncertainty-section" aria-label="Seismic CPT generators">
      <div className="hcleditor__uncertainty-section-head">
        <div><strong>Seismic CPT generators</strong><span>A generator builds every row of one node from its seismic parameters.</span></div>
      </div>
      {!disabled && (
        <div className="hcleditor__uncertainty-add hcleditor__uncertainty-add--event">
          <label>
            <span>Generator</span>
            <select value={kind} onChange={(event) => { if (isGeneratorKind(event.target.value)) setKind(event.target.value); }}>
              <option value="SEISMIC_FRAGILITY">{GENERATOR_LABELS.SEISMIC_FRAGILITY}</option>
              <option value="SEISMIC_PGA_BINS">{GENERATOR_LABELS.SEISMIC_PGA_BINS}</option>
            </select>
          </label>
          <StateSelect label="Generator node" value={selected?.id ?? ""} states={options} disabled={options.length === 0} onChange={setNodeId} />
          <button type="button" disabled={selected === undefined} onClick={add}>Add generator</button>
        </div>
      )}
      {generators.map((definition, index) => {
        const node = model.nodes.find((candidate) => candidate.id === definition.bayesianNetworkNode.entityId);
        const generator = definition.generator;
        return (
          <details key={definition.bayesianNetworkNode.entityId} className="hcleditor__uncertainty-item">
            <summary>{node?.code ?? definition.bayesianNetworkNode.entityId} · {GENERATOR_LABELS[generator.kind]}</summary>
            {node === undefined ? <p role="alert">The configured BN node is missing.</p>
              : generator.kind === "SEISMIC_FRAGILITY"
                ? <FragilityParameters generator={generator} node={node} parents={parentsOf(node.id)} disabled={disabled} update={(next) => replace(index, next)} />
                : <PgaBinsParameters generator={generator} node={node} disabled={disabled} update={(next) => replace(index, next)} />}
            {!disabled && (
              <button type="button" className="hcleditor__uncertainty-delete" onClick={() => onChange({ ...settings, cptGenerators: generators.filter((_, at) => at !== index) })}>
                Delete generator
              </button>
            )}
          </details>
        );
      })}
    </section>
  );
}

export { HclSeismicGeneratorControls };
