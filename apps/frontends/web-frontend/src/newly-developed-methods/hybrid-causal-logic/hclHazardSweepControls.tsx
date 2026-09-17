import { useEffect, useRef, useState, type JSX } from "react";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  HclHazardSweepSpecSchema,
  type HclEvidenceScenario,
  type HclHazardSweepSpec,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";

export function HclHazardSweepControls({
  model,
  disabled,
  onGenerate,
  onGenerated,
  onError,
}: {
  model: BayesianNetworkModel;
  disabled: boolean;
  onGenerate: (spec: HclHazardSweepSpec) => Promise<HclEvidenceScenario[]>;
  onGenerated: (rows: HclEvidenceScenario[], spec: HclHazardSweepSpec) => void;
  onError: (message: string | null) => void;
}): JSX.Element {
  const [states, setStates] = useState<Record<string, string[]>>({});
  const [exclusions, setExclusions] = useState<Record<string, string>[]>([]);
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const dimensions = model.nodes
    .filter((node) => states[node.id] !== undefined)
    .map((node) => ({
      id: node.code,
      bnNode: node.id,
      states: node.states.filter((state) => states[node.id].includes(state.id)).map((state) => state.id),
      stateLabels: Object.fromEntries(node.states.map((state) => [state.id, state.code])),
    }));
  const locked = disabled || busy;

  async function generate(): Promise<void> {
    const parsed = HclHazardSweepSpecSchema.safeParse({
      dimensions,
      excludedAssignments: exclusions.filter((ex) => Object.keys(ex).length > 0),
      ...(limit.trim() === "" ? {} : { maxScenarios: Number(limit) }),
    });
    if (!parsed.success) {
      onError(parsed.error.issues[0]?.message ?? "Invalid scenario settings.");
      return;
    }
    setBusy(true);
    onError(null);
    try {
      const rows = await onGenerate(parsed.data);
      if (!active.current) return;
      if (rows.length === 0) {
        onError("No scenarios remain after exclusions.");
        return;
      }
      onGenerated(rows, parsed.data);
    } catch (error) {
      if (active.current) onError(error instanceof Error ? error.message : "Could not generate scenarios.");
    } finally {
      if (active.current) setBusy(false);
    }
  }

  return (
    <details className="hcleditor__configuration-group">
      <summary>Generate scenario combinations</summary>
      <p>Choose nodes and states. Each combination becomes a temporary scenario, replacing the current batch rows.</p>
      <fieldset disabled={locked}>
        <legend>Nodes and states</legend>
        {model.nodes.map((node) => (
          <div key={node.id}>
            <label>
              <input
                type="checkbox"
                checked={states[node.id] !== undefined}
                onChange={(event) => {
                  if (event.target.checked) setStates({ ...states, [node.id]: node.states.map((s) => s.id) });
                  else {
                    const { [node.id]: _removed, ...next } = states;
                    setStates(next);
                    setExclusions(
                      exclusions.map((ex) => {
                        const { [node.code]: _state, ...rest } = ex;
                        return rest;
                      }),
                    );
                  }
                }}
              />
              {node.code}
            </label>
            {states[node.id] !== undefined && (
              <div className="hcleditor__hazard-dimensions">
                {node.states.map((state) => (
                  <label key={state.id}>
                    <input
                      type="checkbox"
                      aria-label={`${node.code}: ${state.code}`}
                      checked={states[node.id].includes(state.id)}
                      onChange={(event) => {
                        setStates({
                          ...states,
                          [node.id]:
                            event.target.checked ?
                              [...states[node.id], state.id]
                            : states[node.id].filter((id) => id !== state.id),
                        });
                        if (!event.target.checked) setExclusions(exclusions.filter((ex) => ex[node.code] !== state.id));
                      }}
                    />
                    {state.code}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </fieldset>
      <fieldset disabled={locked}>
        <legend>Excluded combinations</legend>
        <p>Each row excludes matching combinations. “Any” leaves that node unrestricted.</p>
        {exclusions.map((ex, index) => (
          <div
            key={index}
            className="hcleditor__hazard-dimensions"
          >
            {dimensions.map((dim) => (
              <label key={dim.id}>
                {dim.id}
                <select
                  aria-label={`Exclusion ${index + 1}: ${dim.id}`}
                  value={ex[dim.id] ?? ""}
                  onChange={(event) => {
                    const { [dim.id]: _old, ...rest } = ex;
                    const next = event.target.value === "" ? rest : { ...rest, [dim.id]: event.target.value };
                    setExclusions(exclusions.map((row, i) => (i === index ? next : row)));
                  }}
                >
                  <option value="">Any</option>
                  {dim.states.map((id) => (
                    <option
                      key={id}
                      value={id}
                    >
                      {dim.stateLabels[id]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button
              type="button"
              aria-label={`Remove exclusion ${index + 1}`}
              onClick={() => setExclusions(exclusions.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={dimensions.length === 0}
          onClick={() => setExclusions([...exclusions, {}])}
        >
          Add exclusion
        </button>
      </fieldset>
      <label>
        Scenario limit (optional)
        <input
          type="number"
          min="1"
          step="1"
          value={limit}
          disabled={locked}
          onChange={(event) => setLimit(event.target.value)}
        />
      </label>
      <p>
        The last selected node varies fastest. The limit applies after exclusions; blank generates all combinations.
      </p>
      <button
        type="button"
        disabled={locked || dimensions.length === 0}
        onClick={() => {
          void generate();
        }}
      >
        {busy ? "Generating…" : "Generate scenarios"}
      </button>
    </details>
  );
}
