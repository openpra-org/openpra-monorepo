import { useState, type JSX } from "react";
import type {
  BayesianNetworkNode,
  HclCptGenerator,
  HclUncertaintySettings,
  WorkbookModelAddress,
} from "interfaces-mef-types/modeling";
import { HclCptGeneratorSchema } from "interfaces-mef-types/zod/modeling";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";

type GeneratorType = HclCptGenerator["type"];

function NumberField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => boolean;
}): JSX.Element {
  return (
    <label>
      <span>{label}</span>
      <input
        key={value}
        type="number"
        step="any"
        defaultValue={value}
        disabled={disabled}
        onBlur={(event) => {
          const input = event.target.value.trim();
          if (!input || !onChange(Number(input))) event.target.value = String(value);
        }}
      />
    </label>
  );
}

function StateSelect({
  label,
  value,
  states,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  states: { id: string; code: string }[];
  disabled: boolean;
  onChange: (id: string) => void;
}): JSX.Element {
  return (
    <label>
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {states.map((s) => (
          <option
            key={s.id}
            value={s.id}
          >
            {s.code}
          </option>
        ))}
      </select>
    </label>
  );
}

function GeneratorParameters({
  generator: g,
  node,
  parents,
  disabled,
  onChange,
  onError,
}: {
  generator: HclCptGenerator;
  node: BayesianNetworkNode;
  parents: BayesianNetworkNode[];
  disabled: boolean;
  onChange: (g: HclCptGenerator) => void;
  onError: (message: string) => void;
}): JSX.Element {
  const update = (candidate: HclCptGenerator): boolean => {
    const parsed = HclCptGeneratorSchema.safeParse(candidate);
    if (!parsed.success) {
      onError(parsed.error.issues[0]?.message ?? "Invalid seismic parameters");
      return false;
    }
    onChange(parsed.data);
    return true;
  };
  if (g.type === "seismic_fragility") {
    const parent = parents.find((p) => p.id === g.pgaParentId);
    return (
      <>
        <p>
          Use the same acceleration units for median capacity and PGA centers. One sampled capacity applies to every
          row.
        </p>
        <div className="hcleditor__uncertainty-parameters">
          <StateSelect
            label="PGA parent"
            value={g.pgaParentId}
            states={parents}
            disabled={disabled}
            onChange={(id) => {
              const selected = parents.find((p) => p.id === id)!;
              update({ ...g, pgaParentId: id, pgaCenters: selected.states.map((s) => ({ stateId: s.id, value: 0 })) });
            }}
          />
          <StateSelect
            label="Failure state"
            value={g.trueStateId}
            states={node.states}
            disabled={disabled}
            onChange={(id) => update({ ...g, trueStateId: id, falseStateId: node.states.find((s) => s.id !== id)!.id })}
          />
          <NumberField
            label="Median capacity (theta)"
            value={g.theta}
            disabled={disabled}
            onChange={(theta) => update({ ...g, theta })}
          />
          <NumberField
            label="Randomness (beta R)"
            value={g.betaR}
            disabled={disabled}
            onChange={(betaR) => update({ ...g, betaR })}
          />
          <NumberField
            label="Uncertainty (beta U)"
            value={g.betaU}
            disabled={disabled}
            onChange={(betaU) => update({ ...g, betaU })}
          />
          {g.pgaCenters.map((center, index) => (
            <NumberField
              key={center.stateId}
              label={`PGA center: ${parent?.states.find((s) => s.id === center.stateId)?.code ?? center.stateId}`}
              value={center.value}
              disabled={disabled}
              onChange={(value) =>
                update({ ...g, pgaCenters: g.pgaCenters.map((c, i) => (i === index ? { ...c, value } : c)) })
              }
            />
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <p>Use frequency and mission-time units that agree. Probabilities exceeding a total of one are rejected.</p>
      <div className="hcleditor__uncertainty-parameters">
        <StateSelect
          label="No-earthquake state"
          value={g.noneStateId}
          states={node.states}
          disabled={disabled}
          onChange={(id) =>
            update({
              ...g,
              noneStateId: id,
              bins: node.states
                .filter((s) => s.id !== id)
                .map(
                  (s) =>
                    g.bins.find((b) => b.stateId === s.id) ?? { stateId: s.id, medianFrequency: 0, errorFactor95: 2 },
                ),
            })
          }
        />
        <NumberField
          label="Mission time"
          value={g.missionTime}
          disabled={disabled}
          onChange={(missionTime) => update({ ...g, missionTime })}
        />
        <label>
          <span>Frequency conversion</span>
          <select
            value={g.frequencyToProbability}
            disabled={disabled}
            onChange={(event) => update({ ...g, frequencyToProbability: event.target.value as "poisson" | "linear" })}
          >
            <option value="poisson">Poisson</option>
            <option value="linear">Linear</option>
          </select>
        </label>
        {g.bins.map((bin, index) => (
          <fieldset key={bin.stateId}>
            <legend>{node.states.find((s) => s.id === bin.stateId)?.code ?? bin.stateId}</legend>
            <NumberField
              label="Median frequency"
              value={bin.medianFrequency}
              disabled={disabled}
              onChange={(medianFrequency) =>
                update({ ...g, bins: g.bins.map((b, i) => (i === index ? { ...b, medianFrequency } : b)) })
              }
            />
            <NumberField
              label="95% error factor"
              value={bin.errorFactor95}
              disabled={disabled}
              onChange={(errorFactor95) =>
                update({ ...g, bins: g.bins.map((b, i) => (i === index ? { ...b, errorFactor95 } : b)) })
              }
            />
          </fieldset>
        ))}
      </div>
    </>
  );
}

export function HclSeismicGeneratorControls({
  model,
  reference,
  settings,
  disabled,
  onChange,
  onError,
}: {
  model: BayesianNetworkModel;
  reference: WorkbookModelAddress;
  settings: HclUncertaintySettings;
  disabled: boolean;
  onChange: (settings: HclUncertaintySettings) => void;
  onError: (message: string) => void;
}): JSX.Element {
  const [type, setType] = useState<GeneratorType>("seismic_fragility");
  const [nodeId, setNodeId] = useState("");
  const generators = settings.cptGenerators ?? [];
  const parentsOf = (id: string): BayesianNetworkNode[] =>
    (model.conditionalProbabilityTables.find((t) => t.nodeId === id)?.parents ?? []).flatMap((p) =>
      model.nodes.filter((n) => n.id === p.nodeId),
    );
  const options = model.nodes.filter(
    (n) =>
      !generators.some((g) => g.bayesianNetworkNode.entityId === n.id) &&
      !settings.cptRowDistributions.some((r) => r.bayesianNetworkNode.entityId === n.id) &&
      (type === "seismic_fragility" ?
        n.states.length === 2 && parentsOf(n.id).length > 0
      : parentsOf(n.id).length === 0),
  );
  const selected = options.find((n) => n.id === nodeId) ?? options[0];
  return (
    <section className="hcleditor__uncertainty-section">
      <div className="hcleditor__uncertainty-section-head">
        <strong>Seismic CPT generators</strong>
      </div>
      <p>Set component and hazard parameters before running uncertainty.</p>
      {!disabled && (
        <div className="hcleditor__uncertainty-add">
          <label>
            <span>Generator</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as GeneratorType)}
            >
              <option value="seismic_fragility">Seismic fragility</option>
              <option value="seismic_pga_bins">PGA bins</option>
            </select>
          </label>
          <StateSelect
            label="Generator node"
            value={selected?.id ?? ""}
            states={options}
            disabled={options.length === 0}
            onChange={setNodeId}
          />
          <button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              const parent = parentsOf(selected.id)[0];
              const generator: HclCptGenerator =
                type === "seismic_fragility" ?
                  {
                    type,
                    pgaParentId: parent!.id,
                    theta: 1,
                    betaR: 1,
                    betaU: 0,
                    trueStateId: selected.states[1].id,
                    falseStateId: selected.states[0].id,
                    pgaCenters: parent!.states.map((s) => ({ stateId: s.id, value: 0 })),
                  }
                : {
                    type,
                    noneStateId: selected.states[0].id,
                    missionTime: 8760,
                    frequencyToProbability: "poisson",
                    bins: selected.states
                      .slice(1)
                      .map((s) => ({ stateId: s.id, medianFrequency: 0, errorFactor95: 2 })),
                  };
              onChange({
                ...settings,
                cptGenerators: [
                  ...generators,
                  {
                    bayesianNetworkNode: {
                      ...reference,
                      referenceType: "BAYESIAN_NETWORK_NODE",
                      entityId: selected.id,
                    },
                    generator,
                  },
                ],
              });
            }}
          >
            Add generator
          </button>
        </div>
      )}
      {generators.map((definition, index) => {
        const node = model.nodes.find((n) => n.id === definition.bayesianNetworkNode.entityId);
        return (
          <details
            key={definition.bayesianNetworkNode.entityId}
            className="hcleditor__uncertainty-item"
          >
            <summary>
              {node?.code ?? definition.bayesianNetworkNode.entityId} ·{" "}
              {definition.generator.type === "seismic_fragility" ? "Seismic fragility" : "PGA bins"}
            </summary>
            {node ?
              <GeneratorParameters
                generator={definition.generator}
                node={node}
                parents={parentsOf(node.id)}
                disabled={disabled}
                onError={onError}
                onChange={(generator) =>
                  onChange({
                    ...settings,
                    cptGenerators: generators.map((g, i) => (i === index ? { ...g, generator } : g)),
                  })
                }
              />
            : <p role="alert">The configured BN node is missing.</p>}
            {!disabled && (
              <button
                type="button"
                className="hcleditor__uncertainty-delete"
                onClick={() => onChange({ ...settings, cptGenerators: generators.filter((_, i) => i !== index) })}
              >
                Delete generator
              </button>
            )}
          </details>
        );
      })}
    </section>
  );
}
