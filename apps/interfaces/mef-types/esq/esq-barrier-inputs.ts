import { DistributionType, type ParameterDistribution } from "../core/events";
import type {
  EsqBarrierWork,
  EsqCell,
  EsqCellSide,
  EsqLaw,
  EsqLawParameter,
  EsqModel,
  EsqParameterRecord,
  EsqUncertainParameter,
  EventSequenceQuantification,
} from "./event-sequence-quantification";
import { esqStableId } from "./esq-run-inputs";

const Z95 = 1.6448536269514722;

const LAW_PARAMETERS: Record<EsqLaw["type"], EsqLawParameter[]> = {
  [DistributionType.LOGNORMAL]: ["median", "errorFactor"],
  [DistributionType.NORMAL]: ["mean", "stdDev"],
  [DistributionType.UNIFORM]: ["lower", "upper"],
  [DistributionType.EXPONENTIAL]: ["failureRate"],
  [DistributionType.WEIBULL]: ["scale", "shape", "location"],
  [DistributionType.GAMMA]: ["shape", "rate"],
  [DistributionType.BETA]: ["alpha", "betaParam"],
  [DistributionType.POINT_ESTIMATE]: ["value"],
};

interface EsqResolvedSide {
  distribution: EsqLaw;
  uncertainParameters: EsqUncertainParameter[];
}

interface EsqResolvedCell {
  load: EsqResolvedSide;
  capacity: EsqResolvedSide;
}

type EsqSideResult = { side: EsqResolvedSide; problem?: undefined } | { side?: undefined; problem: string };

type EsqCellResult = { cell: EsqResolvedCell; problem?: undefined } | { cell?: undefined; problem: string };

function finiteNumber(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveNumber(value: number): boolean {
  return finiteNumber(value) && value > 0;
}

function lawProblem(law: EsqLaw, label: string): string | undefined {
  switch (law.type) {
    case DistributionType.POINT_ESTIMATE:
      return finiteNumber(law.value) ? undefined : `${label} needs a value.`;
    case DistributionType.NORMAL:
      if (!finiteNumber(law.mean)) return `${label} needs a mean.`;
      return finiteNumber(law.stdDev) && law.stdDev >= 0 ? undefined : `${label} needs a standard deviation of zero or more.`;
    case DistributionType.LOGNORMAL:
      if (!positiveNumber(law.median)) return `${label} needs a median above zero.`;
      return finiteNumber(law.errorFactor) && law.errorFactor >= 1 ? undefined : `${label} needs an error factor of at least 1.`;
    case DistributionType.UNIFORM:
      if (!finiteNumber(law.lower) || !finiteNumber(law.upper)) return `${label} needs a lower and an upper bound.`;
      return law.upper >= law.lower ? undefined : `${label} has its upper bound below the lower bound.`;
    case DistributionType.EXPONENTIAL:
      return positiveNumber(law.failureRate) ? undefined : `${label} needs a rate above zero.`;
    case DistributionType.WEIBULL:
      if (!positiveNumber(law.scale) || !positiveNumber(law.shape)) return `${label} needs a scale and a shape above zero.`;
      return finiteNumber(law.location) ? undefined : `${label} needs a location.`;
    case DistributionType.GAMMA:
      return positiveNumber(law.shape) && positiveNumber(law.rate) ? undefined : `${label} needs a shape and a rate above zero.`;
    case DistributionType.BETA:
      return positiveNumber(law.alpha) && positiveNumber(law.betaParam) ? undefined : `${label} needs alpha and beta above zero.`;
  }
}

function asLaw(distribution: ParameterDistribution): EsqLaw | undefined {
  switch (distribution.type) {
    case DistributionType.LOGNORMAL:
    case DistributionType.NORMAL:
    case DistributionType.UNIFORM:
    case DistributionType.EXPONENTIAL:
    case DistributionType.WEIBULL:
    case DistributionType.GAMMA:
    case DistributionType.BETA:
    case DistributionType.POINT_ESTIMATE:
      return distribution;
    default:
      return undefined;
  }
}

function lawParameters(law: EsqLaw): EsqLawParameter[] {
  return LAW_PARAMETERS[law.type];
}

function uncertainProblems(law: EsqLaw, uncertain: readonly EsqUncertainParameter[], label: string): string | undefined {
  const allowed = lawParameters(law);
  const seen: EsqLawParameter[] = [];
  for (const entry of uncertain) {
    if (!allowed.includes(entry.parameter)) return `${label} has no parameter ${entry.parameter} to sample.`;
    if (seen.includes(entry.parameter)) return `${label} samples ${entry.parameter} twice.`;
    seen.push(entry.parameter);
    const problem = lawProblem(entry.distribution, `The uncertainty on the ${label.toLowerCase()} ${entry.parameter}`);
    if (problem !== undefined) return problem;
  }
  return undefined;
}

function resolveSide(side: EsqCellSide, parameters: readonly EsqParameterRecord[], label: string): EsqSideResult {
  const fragility = side.fragility;
  if (fragility !== undefined) {
    if (!positiveNumber(fragility.median)) return { problem: `The ${label.toLowerCase()} fragility needs a median above zero.` };
    if (!finiteNumber(fragility.betaR) || fragility.betaR < 0 || !finiteNumber(fragility.betaU) || fragility.betaU < 0) {
      return { problem: `The ${label.toLowerCase()} fragility needs randomness and uncertainty betas of zero or more.` };
    }
    const distribution: EsqLaw = { type: DistributionType.LOGNORMAL, median: fragility.median, errorFactor: Math.exp(Z95 * fragility.betaR) };
    const uncertainParameters: EsqUncertainParameter[] = fragility.betaU > 0
      ? [{ parameter: "median", distribution: { type: DistributionType.LOGNORMAL, median: fragility.median, errorFactor: Math.exp(Z95 * fragility.betaU) } }]
      : [];
    return { side: { distribution, uncertainParameters } };
  }
  let distribution: EsqLaw | undefined;
  if (side.parameterId !== undefined) {
    const parameter = parameters.find((entry) => entry.id === side.parameterId);
    if (parameter === undefined) return { problem: `${label} takes ${side.parameterId}, which the imported DA workbook does not hold.` };
    const law = parameter.distribution === undefined ? undefined : asLaw(parameter.distribution);
    if (law === undefined) return { problem: `${label} takes ${parameter.id}, which has no distribution PRAXIS can integrate.` };
    distribution = law;
  } else {
    distribution = side.distribution;
  }
  if (distribution === undefined) return { problem: `${label} has no distribution.` };
  const problem = lawProblem(distribution, label);
  if (problem !== undefined) return { problem };
  const uncertain = side.uncertain ?? [];
  const uncertainProblem = uncertainProblems(distribution, uncertain, label);
  if (uncertainProblem !== undefined) return { problem: uncertainProblem };
  return { side: { distribution, uncertainParameters: uncertain } };
}

function lawKey(law: EsqLaw): string {
  return JSON.stringify({ type: law.type, values: lawParameters(law).map((parameter) => lawValue(law, parameter)) });
}

function lawValue(law: EsqLaw, parameter: EsqLawParameter): number | undefined {
  switch (law.type) {
    case DistributionType.POINT_ESTIMATE: return parameter === "value" ? law.value : undefined;
    case DistributionType.NORMAL: return parameter === "mean" ? law.mean : parameter === "stdDev" ? law.stdDev : undefined;
    case DistributionType.LOGNORMAL: return parameter === "median" ? law.median : parameter === "errorFactor" ? law.errorFactor : undefined;
    case DistributionType.UNIFORM: return parameter === "lower" ? law.lower : parameter === "upper" ? law.upper : undefined;
    case DistributionType.EXPONENTIAL: return parameter === "failureRate" ? law.failureRate : undefined;
    case DistributionType.WEIBULL: return parameter === "scale" ? law.scale : parameter === "shape" ? law.shape : parameter === "location" ? law.location : undefined;
    case DistributionType.GAMMA: return parameter === "shape" ? law.shape : parameter === "rate" ? law.rate : undefined;
    case DistributionType.BETA: return parameter === "alpha" ? law.alpha : parameter === "betaParam" ? law.betaParam : undefined;
  }
}

function correlationProblem(sides: readonly EsqResolvedSide[]): string | undefined {
  const byKey = new Map<string, string>();
  for (const side of sides) {
    for (const entry of side.uncertainParameters) {
      const key = entry.correlationKey;
      if (key === undefined || key.length === 0) continue;
      const law = lawKey(entry.distribution);
      const seen = byKey.get(key);
      if (seen !== undefined && seen !== law) return `Correlation key ${key} joins parameters with different distributions.`;
      byKey.set(key, law);
    }
  }
  return undefined;
}

function resolveCell(cell: EsqCell, model: EsqModel | undefined): EsqCellResult {
  const parameters = model?.parameters ?? [];
  const load = resolveSide(cell.load, parameters, "Load");
  if (load.problem !== undefined) return { problem: load.problem };
  const capacity = resolveSide(cell.capacity, parameters, "Capacity");
  if (capacity.problem !== undefined) return { problem: capacity.problem };
  const problem = correlationProblem([load.side, capacity.side]);
  if (problem !== undefined) return { problem };
  return { cell: { load: load.side, capacity: capacity.side } };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, child]) => child !== undefined).sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries.map(([key, child]) => [key, canonical(child)]));
}

function cellInputsKey(cell: EsqCell): string {
  return JSON.stringify(canonical({ load: cell.load, capacity: cell.capacity, unit: cell.unit }));
}

function cellRunValue(cell: EsqCell): number | undefined {
  const run = cell.run;
  if (run === undefined) return undefined;
  return run.mean ?? run.point;
}

function cellValueOfRecord(cell: EsqCell): number | undefined {
  if (cell.ofRecord === "TYPED") return cell.typed?.value;
  if (cell.ofRecord === "RUN") return cellRunValue(cell);
  return undefined;
}

function cellRunStale(cell: EsqCell): boolean {
  return cell.run !== undefined && cell.run.inputs !== cellInputsKey(cell);
}

function esqCellRunId(cellId: string): string {
  return esqStableId(`cell:${cellId}`);
}

function barrierWorkOf(esq: EventSequenceQuantification): EsqBarrierWork {
  return esq.barrierWork ?? {};
}

function cellOf(esq: EventSequenceQuantification, cellId: string): EsqCell | undefined {
  return barrierWorkOf(esq).cells?.find((cell) => cell.id === cellId);
}

export {
  LAW_PARAMETERS,
  asLaw,
  barrierWorkOf,
  canonical,
  cellInputsKey,
  cellOf,
  cellRunStale,
  cellRunValue,
  cellValueOfRecord,
  esqCellRunId,
  lawParameters,
  lawProblem,
  lawValue,
  resolveCell,
  resolveSide,
  type EsqCellResult,
  type EsqResolvedCell,
  type EsqResolvedSide,
  type EsqSideResult,
};
