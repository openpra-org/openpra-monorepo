import type { JSX } from "react";
import type { HclBasicEventProbabilityDistribution, HclSampler } from "interfaces-mef-types/modeling";
import { hclProbabilityDistributionSchemaForSampler } from "interfaces-mef-types/zod/modeling";

type Family = HclBasicEventProbabilityDistribution["family"];

const DISTRIBUTIONS: Record<Family, { label: string; initial: HclBasicEventProbabilityDistribution }> = {
  BETA: { label: "Beta", initial: { family: "BETA", alpha: 2, beta: 18 } },
  LOGNORMAL: { label: "Lognormal", initial: { family: "LOGNORMAL", median: 0.01, errorFactor: 3 } },
  UNIFORM: { label: "Uniform", initial: { family: "UNIFORM", lower: 0, upper: 0.1 } },
  NORMAL: { label: "Normal", initial: { family: "NORMAL", mean: 0.1, standardDeviation: 0.02 } },
  LOGITNORMAL: { label: "Logit-normal", initial: { family: "LOGITNORMAL", mu: -2, sigma: 0.5 } },
  GAMMA: { label: "Gamma", initial: { family: "GAMMA", shape: 2, scale: 0.05 } },
  EXPONENTIAL: { label: "Exponential", initial: { family: "EXPONENTIAL", rate: 10 } },
  TRIANGULAR: { label: "Triangular", initial: { family: "TRIANGULAR", lower: 0, mode: 0.1, upper: 0.2 } },
};

export function createBasicEventDistribution(family: Family): HclBasicEventProbabilityDistribution {
  return { ...DISTRIBUTIONS[family].initial };
}

export function probabilityDistributionLabel(distribution: HclBasicEventProbabilityDistribution): string {
  return DISTRIBUTIONS[distribution.family].label;
}

export function HclDistributionOptions(): JSX.Element {
  return <>{Object.entries(DISTRIBUTIONS).map(([family, { label }]) => <option key={family} value={family}>{label}</option>)}</>;
}

interface Parameter {
  key: string;
  label: string;
  value: number;
  min?: number;
}

function parameters(distribution: HclBasicEventProbabilityDistribution): Parameter[] {
  switch (distribution.family) {
    case "BETA": return [
      { key: "alpha", label: "Alpha", value: distribution.alpha, min: 0 },
      { key: "beta", label: "Beta", value: distribution.beta, min: 0 },
    ];
    case "LOGNORMAL": return [
      { key: "median", label: "Median", value: distribution.median, min: 0 },
      { key: "errorFactor", label: "Error factor", value: distribution.errorFactor, min: 1 },
    ];
    case "UNIFORM": return [
      { key: "lower", label: "Lower", value: distribution.lower },
      { key: "upper", label: "Upper", value: distribution.upper },
    ];
    case "NORMAL": return [
      { key: "mean", label: "Mean", value: distribution.mean },
      { key: "standardDeviation", label: "Standard deviation", value: distribution.standardDeviation, min: 0 },
    ];
    case "LOGITNORMAL": return [
      { key: "mu", label: "Logit mean", value: distribution.mu },
      { key: "sigma", label: "Logit standard deviation", value: distribution.sigma, min: 0 },
    ];
    case "GAMMA": return [
      { key: "shape", label: "Shape", value: distribution.shape, min: 0 },
      { key: "scale", label: "Scale", value: distribution.scale, min: 0 },
    ];
    case "EXPONENTIAL": return [{ key: "rate", label: "Rate", value: distribution.rate, min: 0 }];
    case "TRIANGULAR": return [
      { key: "lower", label: "Lower", value: distribution.lower },
      { key: "mode", label: "Mode", value: distribution.mode },
      { key: "upper", label: "Upper", value: distribution.upper },
    ];
  }
}

export function HclDistributionParameters({ distribution, sampler, disabled, onChange, onError }: {
  distribution: HclBasicEventProbabilityDistribution;
  sampler: HclSampler;
  disabled: boolean;
  onChange: (value: HclBasicEventProbabilityDistribution) => void;
  onError: (message: string) => void;
}): JSX.Element {
  return <>{parameters(distribution).map(({ key, label, value, min }) => (
    <label key={`${distribution.family}:${key}:${String(value)}`}>
      <span>{label}</span>
      <input type="number" min={min} step="any" defaultValue={value} disabled={disabled} onBlur={(event) => {
        const number = event.target.value.trim() === "" ? Number.NaN : Number(event.target.value);
        const parsed = hclProbabilityDistributionSchemaForSampler(sampler).safeParse({ ...distribution, [key]: number });
        if (parsed.success) onChange(parsed.data);
        else {
          event.target.value = String(value);
          onError(`Invalid ${label.toLowerCase()}: ${parsed.error.issues[0]?.message ?? "check the distribution parameters"}`);
        }
      }} />
    </label>
  ))}</>;
}
