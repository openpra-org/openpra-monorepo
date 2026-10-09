import { FrequencyUnit } from "interfaces-mef-types/core/events";
import type { GammaLaw, Law, UncertainExpression, UncertainUnit } from "interfaces-mef-types/core/uncertainty";
import type { FrequencyDataSource } from "interfaces-mef-types/ie/initiating-event-analysis";

type SourceExpression = { kind: "READY"; expression: UncertainExpression } | { kind: "MISSING"; problem: string };

type PriorResult = { kind: "READY"; prior: GammaLaw | null } | { kind: "MISSING"; problem: string };

const FREQUENCY_UNIT: UncertainUnit = "PER_YEAR";

const DEFAULT_FREQUENCY_BASIS = FrequencyUnit.PER_PLANT_YEAR;

const BASIS_TEXT: Record<FrequencyUnit, string> = {
  [FrequencyUnit.PER_PLANT_YEAR]: "per plant-year",
  [FrequencyUnit.PER_REACTOR_YEAR]: "per reactor-year",
  [FrequencyUnit.PER_CALENDAR_YEAR]: "per calendar year",
  [FrequencyUnit.PER_CRITICAL_YEAR]: "per critical year",
  [FrequencyUnit.PER_DEMAND]: "per demand",
};

const BASIS_CHOICES: readonly FrequencyUnit[] = [
  FrequencyUnit.PER_PLANT_YEAR,
  FrequencyUnit.PER_REACTOR_YEAR,
  FrequencyUnit.PER_CALENDAR_YEAR,
  FrequencyUnit.PER_CRITICAL_YEAR,
];

function basisText(basis: FrequencyUnit): string {
  return BASIS_TEXT[basis];
}

function frequencyText(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / Math.pow(10, exponent);
  const sign = exponent < 0 ? "-" : "+";
  return `${mantissa.toFixed(1)}E${sign}${String(Math.abs(exponent)).padStart(2, "0")}`;
}

function valueExpression(law: Law): UncertainExpression {
  return { node: "VALUE", value: { unit: FREQUENCY_UNIT, law } };
}

function operatingPrior(source: FrequencyDataSource): PriorResult {
  const mean = source.priorMean;
  const weight = source.priorWeightPseudoEvents;
  if (mean === undefined && weight === undefined) return { kind: "READY", prior: null };
  if (mean === undefined || weight === undefined) return { kind: "MISSING", problem: "Give both the prior mean and the prior weight, or neither." };
  if (mean <= 0 || weight <= 0) return { kind: "MISSING", problem: "The prior mean and the prior weight must be above zero." };
  return { kind: "READY", prior: { family: "GAMMA", shape: weight, rate: weight / mean } };
}

function operatingExpression(source: FrequencyDataSource): SourceExpression {
  const failures = source.eventCount;
  const exposure = source.exposureModuleYears;
  if (failures === undefined || exposure === undefined) return { kind: "MISSING", problem: "Enter the events observed and the exposure." };
  if (exposure <= 0) return { kind: "MISSING", problem: "The exposure must be above zero." };
  const prior = operatingPrior(source);
  if (prior.kind === "MISSING") return prior;
  return { kind: "READY", expression: valueExpression({ family: "POSTERIOR", prior: prior.prior, evidence: [{ likelihood: "POISSON", failures, exposure }] }) };
}

function ownExpression(source: FrequencyDataSource): SourceExpression {
  switch (source.basis) {
    case "OPERATING_DATA":
      return operatingExpression(source);
    case "FAULT_TREE":
      return source.faultTreeTop === undefined ? { kind: "MISSING", problem: "Type the top event frequency." } : { kind: "READY", expression: source.faultTreeTop };
    case "GENERIC_DATA":
    case "SIMILAR_PLANT_DATA":
    case "DESIGN_BASED":
      return source.estimate === undefined ? { kind: "MISSING", problem: "Type the estimate." } : { kind: "READY", expression: source.estimate };
  }
}

function moduleFactor(modules: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value: modules } } };
}

function sourceExpression(source: FrequencyDataSource, numberOfModules: number | undefined): SourceExpression {
  const own = ownExpression(source);
  if (own.kind === "MISSING" || !source.perModule) return own;
  if (numberOfModules === undefined) return { kind: "MISSING", problem: "Set the number of modules in Step 01 to scale a per-module rate." };
  return { kind: "READY", expression: { node: "OPERATION", operation: "MULTIPLY", operands: [own.expression, moduleFactor(numberOfModules)] } };
}

function primarySource(sources: readonly FrequencyDataSource[], primaryId: string | undefined): FrequencyDataSource | undefined {
  return sources.find((source) => source.uuid === primaryId) ?? sources[0];
}

export {
  BASIS_CHOICES,
  DEFAULT_FREQUENCY_BASIS,
  FREQUENCY_UNIT,
  basisText,
  frequencyText,
  primarySource,
  sourceExpression,
  valueExpression,
  type SourceExpression,
};
