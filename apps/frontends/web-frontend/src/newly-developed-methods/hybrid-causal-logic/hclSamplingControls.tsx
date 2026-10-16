import type { JSX } from "react";
import type { HclSampler, HclUncertaintySettings } from "interfaces-mef-types/modeling";
import {
  HclCptClipEpsilonSchema,
  HclUncertaintySampleCountSchema,
  HclUncertaintySeedSchema,
} from "interfaces-mef-types/zod/modeling";
import "./css/hclSamplingControls.css";

type OptionalSetting = "seed" | "cptSampler" | "correlation" | "clipProbabilities" | "cptClipEpsilon" | "zeroProbabilityContexts";

const DEFAULT_SEED = 42;

function withSetting<K extends OptionalSetting>(
  settings: HclUncertaintySettings,
  key: K,
  value: HclUncertaintySettings[K] | undefined,
): HclUncertaintySettings {
  const next = { ...settings };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

function samplerOf(value: string): HclSampler {
  return value === "MC" ? "MC" : "LHS";
}

function HclSamplingControls({ settings, editable, onChange, onError, onDisable }: {
  settings: HclUncertaintySettings;
  editable: boolean;
  onChange: (settings: HclUncertaintySettings) => void;
  onError: (message: string | null) => void;
  onDisable: () => void;
}): JSX.Element {
  return (
    <>
      <section className="hcleditor__uncertainty-section" aria-label="Sampling settings">
        <div className="hcleditor__uncertainty-section-head">
          <div><strong>Sampling</strong><span>PRAXIS draws every uncertain input with the selected method.</span></div>
        </div>
        <div className="hclsampling__controls">
          <label>
            <span>Sampling method</span>
            <select aria-label="Sampling method" value={settings.sampler} disabled={!editable} onChange={(event) => onChange({ ...settings, sampler: samplerOf(event.target.value) })}>
              <option value="MC">Monte Carlo (MC)</option>
              <option value="LHS">Latin hypercube (LHS)</option>
            </select>
          </label>
          <label>
            <span>BN sampling method</span>
            <select aria-label="BN sampling method" value={settings.cptSampler ?? "SAME"} disabled={!editable} onChange={(event) => onChange(withSetting(settings, "cptSampler", event.target.value === "SAME" ? undefined : samplerOf(event.target.value)))}>
              <option value="SAME">Same as inputs</option>
              <option value="MC">Monte Carlo (MC)</option>
              <option value="LHS">Latin hypercube (LHS)</option>
            </select>
          </label>
          <label>
            <span>Samples</span>
            <input
              key={`samples:${String(settings.sampleCount)}`}
              type="number"
              min="2"
              step="1"
              defaultValue={settings.sampleCount}
              disabled={!editable}
              onBlur={(event) => {
                const parsed = HclUncertaintySampleCountSchema.safeParse(event.target.valueAsNumber);
                if (parsed.success) {
                  onChange({ ...settings, sampleCount: parsed.data });
                  onError(null);
                } else onError("Uncertainty samples must be a whole number of at least 2.");
              }}
            />
          </label>
          <label>
            <span>Seed</span>
            <select aria-label="Seed source" value={settings.seed === undefined ? "RUN" : "FIXED"} disabled={!editable} onChange={(event) => onChange(withSetting(settings, "seed", event.target.value === "FIXED" ? DEFAULT_SEED : undefined))}>
              <option value="FIXED">Fixed</option>
              <option value="RUN">New each run</option>
            </select>
          </label>
          {settings.seed !== undefined && (
            <label>
              <span>Seed value</span>
              <input
                key={`seed:${String(settings.seed)}`}
                type="number"
                min="0"
                max={Number.MAX_SAFE_INTEGER}
                step="1"
                defaultValue={settings.seed}
                disabled={!editable}
                onBlur={(event) => {
                  const parsed = HclUncertaintySeedSchema.safeParse(event.target.valueAsNumber);
                  if (parsed.success) {
                    onChange({ ...settings, seed: parsed.data });
                    onError(null);
                  } else onError(`Uncertainty seed must be a whole number from 0 to ${String(Number.MAX_SAFE_INTEGER)}.`);
                }}
              />
            </label>
          )}
          {editable && <button type="button" className="posnav__btn posnav__btn--sm hcleditor__uncertainty-disable" onClick={onDisable}>Disable</button>}
        </div>
      </section>
      <section className="hcleditor__uncertainty-section" aria-label="Draw rules">
        <div className="hcleditor__uncertainty-section-head">
          <div><strong>Draws</strong><span>How PRAXIS shares parameter draws and treats values outside their range.</span></div>
        </div>
        <div className="hclsampling__controls">
          <label>
            <span>Parameter draws</span>
            <select aria-label="Parameter draws" value={settings.correlation ?? "SHARED"} disabled={!editable} onChange={(event) => onChange(withSetting(settings, "correlation", event.target.value === "INDEPENDENT" ? "INDEPENDENT" : undefined))}>
              <option value="SHARED">Shared across uses</option>
              <option value="INDEPENDENT">Independent per use</option>
            </select>
          </label>
          <label>
            <span>Out-of-range probabilities</span>
            <select aria-label="Out-of-range probabilities" value={settings.clipProbabilities === true ? "CLIP" : "FAIL"} disabled={!editable} onChange={(event) => onChange(withSetting(settings, "clipProbabilities", event.target.value === "CLIP" ? true : undefined))}>
              <option value="FAIL">Fail the run</option>
              <option value="CLIP">Clip to 0 and 1</option>
            </select>
          </label>
          <label>
            <span>Zero-probability contexts</span>
            <select aria-label="Zero-probability contexts" value={settings.zeroProbabilityContexts ?? "ZERO"} disabled={!editable} onChange={(event) => onChange(withSetting(settings, "zeroProbabilityContexts", event.target.value === "FAIL" ? "FAIL" : undefined))}>
              <option value="ZERO">Count as 0</option>
              <option value="FAIL">Fail the run</option>
            </select>
          </label>
          <label>
            <span>CPT floor</span>
            <input
              key={`floor:${String(settings.cptClipEpsilon ?? 0)}`}
              aria-label="CPT floor"
              type="number"
              min="0"
              max="0.5"
              step="any"
              defaultValue={settings.cptClipEpsilon ?? 0}
              disabled={!editable}
              onBlur={(event) => {
                const parsed = HclCptClipEpsilonSchema.safeParse(event.target.valueAsNumber);
                if (parsed.success) {
                  onChange(withSetting(settings, "cptClipEpsilon", parsed.data === 0 ? undefined : parsed.data));
                  onError(null);
                } else onError("The CPT floor must be at least 0 and below 0.5.");
              }}
            />
          </label>
        </div>
      </section>
    </>
  );
}

export { HclSamplingControls };
