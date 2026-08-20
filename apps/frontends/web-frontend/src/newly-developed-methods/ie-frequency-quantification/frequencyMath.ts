import { type FrequencyDataSource, type FrequencyDistributionFamily } from "interfaces-mef-types/ie/initiating-event-analysis";

export function distributionMean(family: FrequencyDistributionFamily, params: number[]): number | null {
  if (family === "POINT") {
    const v = params[0];
    return v !== undefined && v >= 0 ? v : null;
  }
  if (family === "GAMMA") {
    const a = params[0];
    const b = params[1];
    return a !== undefined && b !== undefined && a > 0 && b > 0 ? a / b : null;
  }
  if (family === "LOGNORMAL") {
    const median = params[0];
    const ef = params[1];
    if (median !== undefined && ef !== undefined && median > 0 && ef > 1) {
      const sigma = Math.log(ef) / 1.645;
      return median * Math.exp((sigma * sigma) / 2);
    }
    return null;
  }
  const alpha = params[0];
  const beta = params[1];
  return alpha !== undefined && beta !== undefined && alpha > 0 && beta > 0 ? alpha / (alpha + beta) : null;
}

export function sourceMean(s: FrequencyDataSource): number | null {
  if (s.basis === "OPERATING_DATA") {
    const events = s.eventCount ?? 0;
    const exposure = s.exposureModuleYears ?? 0;
    let alpha0 = 0.5;
    let beta0 = 0;
    if (s.priorMean !== undefined && s.priorMean > 0 && s.priorWeightPseudoEvents !== undefined && s.priorWeightPseudoEvents > 0) {
      alpha0 = s.priorWeightPseudoEvents;
      beta0 = s.priorWeightPseudoEvents / s.priorMean;
    }
    const denom = beta0 + exposure;
    if (denom <= 0) return null;
    return (alpha0 + events) / denom;
  }
  if (s.basis === "FAULT_TREE") {
    return s.faultTreeTopMean !== undefined && s.faultTreeTopMean >= 0 ? s.faultTreeTopMean : null;
  }
  return distributionMean(s.distributionFamily ?? "POINT", s.distributionParameters ?? []);
}

export function moduleAdjusted(mean: number | null, perModule: boolean, numberOfModules: number): number | null {
  if (mean === null) return null;
  return perModule ? mean * Math.max(1, numberOfModules) : mean;
}

export function rolledMean(sources: FrequencyDataSource[], primaryId: string | undefined, numberOfModules: number): number | null {
  const primary = sources.find((s) => s.uuid === primaryId) ?? sources[0];
  if (primary === undefined) return null;
  return moduleAdjusted(sourceMean(primary), primary.perModule, numberOfModules);
}

export function fmtFreq(v: number | null): string {
  if (v === null || !isFinite(v) || v <= 0) return "—";
  const exp = Math.floor(Math.log10(v));
  const mantissa = v / Math.pow(10, exp);
  const sign = exp < 0 ? "-" : "+";
  return `${mantissa.toFixed(1)}E${sign}${String(Math.abs(exp)).padStart(2, "0")}`;
}
