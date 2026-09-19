import type { JSX } from "react";
import type { HclCptPrior } from "interfaces-mef-types/modeling";
import { HclCptPriorSchema } from "interfaces-mef-types/zod/modeling";

interface State { id: string; code: string }

export function createCptPrior(states: State[], family: HclCptPrior["family"] = "DIRICHLET"): HclCptPrior {
  if (family === "BETA" && states.length === 2) {
    return { family, alpha: 1, beta: 1, trueStateId: (states.find((s) => s.code.toLowerCase() === "true") ?? states[0]!).id };
  }
  return { family: "DIRICHLET", alpha: states.map(() => 1) };
}

export function HclCptPriorControls({ prior, states, disabled, onChange, onError }: {
  prior: HclCptPrior | undefined;
  states: State[];
  disabled: boolean;
  onChange: (prior: HclCptPrior) => void;
  onError: (message: string) => void;
}): JSX.Element {
  // Old ESS-only records must be explicitly reconfigured; never infer a new prior.
  if (prior === undefined) return <div role="alert">
    This CPT row needs an explicit prior. The former equivalent-sample-size setting is no longer supported.
    {!disabled && states.length > 0 && <button type="button" onClick={() => onChange(createCptPrior(states))}>Set explicit prior</button>}
  </div>;
  const parameters = prior.family === "BETA"
    ? [{ key: "alpha", label: "Alpha", value: prior.alpha }, { key: "beta", label: "Beta", value: prior.beta }]
    : prior.alpha.map((value, index) => ({ key: String(index), label: `Alpha for ${states[index]?.code ?? `state ${index + 1}`}`, value }));
  return <>
    <label><span>CPT prior</span><select aria-label="CPT prior" value={prior.family} disabled={disabled} onChange={(event) => onChange(createCptPrior(states, event.target.value as HclCptPrior["family"]))}>
      <option value="DIRICHLET">Dirichlet</option>
      {states.length === 2 && <option value="BETA">Beta</option>}
    </select></label>
    {prior.family === "BETA" && <label><span>Beta probability state</span><select aria-label="Beta probability state" title="Applies to all Beta priors on this BN node" value={prior.trueStateId} disabled={disabled} onChange={(event) => onChange({ ...prior, trueStateId: event.target.value })}>
      {states.map((state) => <option key={state.id} value={state.id}>{state.code}</option>)}
    </select></label>}
    {parameters.map(({ key, label, value }) => <label key={`${prior.family}:${key}:${value}`}>
      <span>{label}</span><input type="number" min="0" step="any" defaultValue={value} disabled={disabled} onBlur={(event) => {
        const number = event.target.value.trim() === "" ? Number.NaN : Number(event.target.value);
        const candidate = prior.family === "BETA" ? { ...prior, [key]: number } : { ...prior, alpha: prior.alpha.map((a, index) => index === Number(key) ? number : a) };
        const parsed = HclCptPriorSchema.safeParse(candidate);
        if (parsed.success) onChange(parsed.data);
        else { event.target.value = String(value); onError(parsed.error.issues[0]?.message ?? "Invalid CPT prior"); }
      }} />
    </label>)}
  </>;
}
