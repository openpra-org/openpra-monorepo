import {
  evidenceFailures,
  type BaseLaw,
  type ComponentModel,
  type DurationLaw,
  type DurationModel,
  type EvidenceTerm,
  type Law,
  type UncertainExpression,
  type UncertainUnit,
  type WeibullModel,
} from "interfaces-mef-types/core/uncertainty";

const UNIT_TEXT: Record<UncertainUnit, string> = {
  PROBABILITY: "probability",
  FRACTION: "fraction",
  FACTOR: "factor",
  PER_HOUR: "per hour",
  PER_YEAR: "per year",
  HOURS: "hours",
  MINUTES: "minutes",
  YEARS: "years",
  QUANTITY: "quantity",
};

const FAMILY_TEXT: Record<Law["family"], string> = {
  POINT: "Point",
  BETA: "Beta",
  GAMMA: "Gamma",
  LOGNORMAL: "Lognormal",
  NORMAL: "Normal",
  STUDENT_T: "Student t",
  LOGIT_NORMAL: "Logit-normal",
  UNIFORM: "Uniform",
  LOG_UNIFORM: "Log-uniform",
  TRIANGULAR: "Triangular",
  LOG_TRIANGULAR: "Log-triangular",
  WEIBULL: "Weibull",
  MAXIMUM_ENTROPY: "Maximum entropy",
  CONSTRAINED_NONINFORMATIVE: "Constrained noninformative",
  DISCRETE: "Discrete",
  TABULATED: "Tabulated",
  METALOG: "Metalog",
  SAMPLES: "Samples",
  TRUNCATED: "Truncated",
  MIXTURE: "Mixture",
  POSTERIOR: "Bayes posterior",
  POPULATION: "Population",
  EMPIRICAL_BAYES: "Empirical Bayes",
  DURATION: "Duration posterior",
  TREND: "Loglinear trend",
  PRODUCT: "Product",
};

const DURATION_MODEL_TEXT: Record<DurationModel, string> = {
  EXPONENTIAL: "Exponential",
  LOGNORMAL: "Lognormal",
  WEIBULL: "Weibull",
  GAMMA: "Gamma",
};

function numberText(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const size = Math.abs(value);
  if (size === 0) return "0";
  if (size >= 0.01 && size < 1e5) return String(Number(value.toPrecision(3)));
  return value.toExponential(2).replace("e+", "E").replace("e", "E");
}

function boundText(lower: number | null, upper: number | null): string {
  return `[${lower === null ? "−∞" : numberText(lower)}, ${upper === null ? "∞" : numberText(upper)}]`;
}

function cutText(law: Law, lower: number | null, upper: number | null): string {
  if (lower === null && upper === null) return lawText(law);
  if (lower === null && upper !== null) return `${lawText(law)} at most ${numberText(upper)}`;
  if (lower !== null && upper === null) return `${lawText(law)} at least ${numberText(lower)}`;
  return `${lawText(law)} cut to ${boundText(lower, upper)}`;
}

function countText(failures: number): string {
  return `${numberText(failures)} ${failures === 1 ? "failure" : "failures"}`;
}

function termText(term: EvidenceTerm): string {
  switch (term.likelihood) {
    case "BINOMIAL": return `${countText(term.failures)} in ${numberText(term.exposure)} demands`;
    case "POISSON": return `${countText(term.failures)} in ${numberText(term.exposure)}`;
    case "STANDBY_DEMAND": return `${countText(term.failures)} in ${numberText(term.exposure)} ${term.demand === "TEST" ? "tests" : "random demands"} every ${numberText(term.testInterval)} h`;
    case "UNCERTAIN_COUNT": return `about ${countText(evidenceFailures(term))} in ${numberText(term.exposure)}${term.count === "BINOMIAL" ? " demands" : ""} (${term.outcomes.length} possible counts)`;
  }
}

function durationText(law: DurationLaw): string {
  const records = `${law.times.length} completed${law.censored.length > 0 ? `, ${law.censored.length} still open` : ""}`;
  const output = law.output.kind === "EXCEEDANCE" ? `chance of lasting past ${numberText(law.output.time)} h` : "mean duration";
  return `${DURATION_MODEL_TEXT[law.model]} durations (${records}): ${output}`;
}

function baseLawText(law: BaseLaw): string {
  switch (law.family) {
    case "POINT": return numberText(law.value);
    case "BETA": return law.lower === 0 && law.upper === 1
      ? `Beta (α ${numberText(law.alpha)}, β ${numberText(law.beta)})`
      : `Beta (α ${numberText(law.alpha)}, β ${numberText(law.beta)}) on ${boundText(law.lower, law.upper)}`;
    case "GAMMA": return `Gamma (shape ${numberText(law.shape)}, rate ${numberText(law.rate)})`;
    case "LOGNORMAL": return law.level === 0.95
      ? `Lognormal (mean ${numberText(law.mean)}, EF ${numberText(law.errorFactor)})`
      : `Lognormal (mean ${numberText(law.mean)}, EF ${numberText(law.errorFactor)} at ${numberText(law.level * 100)}%)`;
    case "NORMAL": return `Normal (mean ${numberText(law.mean)}, sd ${numberText(law.standardDeviation)})`;
    case "STUDENT_T": return `Student t (location ${numberText(law.location)}, scale ${numberText(law.scale)}, ν ${numberText(law.degreesOfFreedom)})`;
    case "LOGIT_NORMAL": return `Logit-normal (μ ${numberText(law.mu)}, σ ${numberText(law.sigma)})`;
    case "UNIFORM": return `Uniform ${boundText(law.lower, law.upper)}`;
    case "LOG_UNIFORM": return `Log-uniform ${boundText(law.lower, law.upper)}`;
    case "TRIANGULAR": return `Triangular (${numberText(law.lower)}, ${numberText(law.mode)}, ${numberText(law.upper)})`;
    case "LOG_TRIANGULAR": return `Log-triangular (${numberText(law.lower)}, ${numberText(law.mode)}, ${numberText(law.upper)})`;
    case "WEIBULL": return law.location === 0
      ? `Weibull (scale ${numberText(law.scale)}, shape ${numberText(law.shape)})`
      : `Weibull (scale ${numberText(law.scale)}, shape ${numberText(law.shape)}, from ${numberText(law.location)})`;
    case "MAXIMUM_ENTROPY": return `Maximum entropy (mean ${numberText(law.mean)} on ${boundText(law.lower, law.upper)})`;
    case "CONSTRAINED_NONINFORMATIVE": return `Constrained noninformative (mean ${numberText(law.mean)})`;
    case "DISCRETE": return `Discrete (${law.outcomes.length} ${law.outcomes.length === 1 ? "outcome" : "outcomes"})`;
    case "TABULATED": return `Tabulated (${law.points.length} points, ${law.scale === "LOG" ? "log" : "linear"})`;
    case "METALOG": return `Metalog (${law.points.length} terms on ${boundText(law.lower, law.upper)})`;
    case "SAMPLES": return law.smoothing.kind === "NONE"
      ? `Samples (${law.values.length})`
      : `Samples (${law.values.length}, kernel ${numberText(law.smoothing.bandwidth)})`;
  }
}

function lawText(law: Law): string {
  switch (law.family) {
    case "TRUNCATED": return cutText(law.law, law.lower, law.upper);
    case "MIXTURE": return `Mixture of ${law.components.length}`;
    case "POSTERIOR": {
      const evidence = law.evidence.map(termText).join("; ");
      return law.prior === null ? `Jeffreys posterior with ${evidence}` : `${lawText(law.prior)} updated with ${evidence}`;
    }
    case "POPULATION": return law.target === null
      ? `Population variability of ${law.evidence.length} sets`
      : `Set ${law.target + 1} of a population of ${law.evidence.length}`;
    case "EMPIRICAL_BAYES": return law.target === null
      ? `Empirical Bayes fit to ${law.evidence.length} members`
      : `Member ${law.target + 1} of an empirical Bayes fit to ${law.evidence.length}`;
    case "DURATION": return durationText(law);
    case "TREND": return `Loglinear trend over ${law.bins.length} bins at ${numberText(law.at)}`;
    case "PRODUCT": return law.factors.map((factor) => (factor.family === "PRODUCT" ? `(${lawText(factor)})` : lawText(factor))).join(" × ");
    default: return baseLawText(law);
  }
}

function familyText(family: Law["family"]): string {
  return FAMILY_TEXT[family];
}

function unitText(unit: UncertainUnit): string {
  return UNIT_TEXT[unit];
}

function modelText(model: ComponentModel, labelOf: (expression: UncertainExpression) => string): string {
  switch (model.form) {
    case "MISSION": return `Mission: rate ${labelOf(model.rate)} over ${labelOf(model.missionTime)}`;
    case "STANDBY": return `Standby: rate ${labelOf(model.rate)}, tested every ${labelOf(model.testInterval)}`;
    case "REPAIRABLE": return `Repairable: demand ${labelOf(model.demandFailure)}, rate ${labelOf(model.rate)}, repair ${labelOf(model.repairRate)}, time ${labelOf(model.time)}`;
    case "WEIBULL": return weibullText(model, labelOf);
    case "FRAGILITY": return `Fragility: median ${labelOf(model.median)}, randomness ${labelOf(model.randomness)}, demand ${labelOf(model.demand)}`;
  }
}

function weibullText(model: WeibullModel, labelOf: (expression: UncertainExpression) => string): string {
  return `Weibull: scale ${labelOf(model.scale)}, shape ${labelOf(model.shape)}, from ${labelOf(model.location)}, time ${labelOf(model.time)}`;
}

const OPERATION_TEXT = {
  ADD: " + ",
  SUBTRACT: " − ",
  MULTIPLY: " × ",
  DIVIDE: " ÷ ",
  POWER: " ^ ",
  MIN: ", ",
  MAX: ", ",
  EXP: "",
  LOG: "",
} as const;

function expressionText(expression: UncertainExpression, parameterLabel: (key: string) => string = (key) => key): string {
  const labelOf = (inner: UncertainExpression): string => expressionText(inner, parameterLabel);
  switch (expression.node) {
    case "VALUE": {
      const law = lawText(expression.value.law);
      return expression.value.law.family === "POINT" && expression.value.unit !== "PROBABILITY" && expression.value.unit !== "FACTOR"
        ? `${law} ${unitText(expression.value.unit)}`
        : law;
    }
    case "PARAMETER": return parameterLabel(`${expression.reference.workbookId}:${expression.reference.entityId}`);
    case "MODEL": return modelText(expression.model, labelOf);
    case "OPERATION": {
      const parts = expression.operands.map(labelOf);
      if (expression.operation === "EXP") return `exp(${parts.join("")})`;
      if (expression.operation === "LOG") return `ln(${parts.join("")})`;
      if (expression.operation === "MIN") return `min(${parts.join(OPERATION_TEXT.MIN)})`;
      if (expression.operation === "MAX") return `max(${parts.join(OPERATION_TEXT.MAX)})`;
      return `(${parts.join(OPERATION_TEXT[expression.operation])})`;
    }
  }
}

export { expressionText, familyText, lawText, numberText, termText, unitText };
