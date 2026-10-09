import type { Law, UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { DirichletLawSchema } from "interfaces-mef-types/zod/core/uncertainty";
import { HclUncertaintySettingsSchema } from "interfaces-mef-types/zod/modeling/hybrid-causal-logic";
import {
  arrayField,
  field,
  isRecord,
  jsonOf,
  numberField,
  numberList,
  present,
  recordField,
  textField,
  withArray,
  withRecord,
  type Json,
  type JsonRecord,
} from "./uncertainty-migration-json";
import {
  UPPER_PERCENTILE,
  boundedLaw,
  lognormalFit,
  lognormalFromMedian,
  normalLaw,
  pointExpression,
  positiveLaw,
  valueExpression,
  type ConversionScope,
} from "./uncertainty-migration-laws";

type NodeStates = ReadonlyMap<string, readonly string[]>;

const OLD_SETTING_FIELDS: readonly string[] = ["basicEventSampler", "cptProbabilityClipEpsilon", "basicEventDistributions", "cptRowDistributions"];

const SAMPLERS: readonly string[] = ["MC", "LHS"];

function nodeKey(modelId: string, nodeId: string): string {
  return `${modelId}:${nodeId}`;
}

function networkStates(networks: Json[] | undefined): Map<string, readonly string[]> {
  const states = new Map<string, readonly string[]>();
  for (const network of networks ?? []) {
    if (!isRecord(network)) continue;
    const modelId = textField(network, "modelId");
    if (modelId === undefined) continue;
    for (const node of arrayField(network, "nodes") ?? []) {
      if (!isRecord(node)) continue;
      const nodeId = textField(node, "id");
      if (nodeId === undefined) continue;
      states.set(nodeKey(modelId, nodeId), (arrayField(node, "states") ?? []).flatMap((state) => {
        const id = isRecord(state) ? textField(state, "id") : undefined;
        return id === undefined ? [] : [id];
      }));
    }
  }
  return states;
}

function triangularLaw(lower: number, mode: number, upper: number, scope: ConversionScope, what: string): Law | undefined {
  if (lower === upper && mode === lower) return { family: "POINT", value: lower };
  if (lower < upper && lower <= mode && mode <= upper) return { family: "TRIANGULAR", lower, mode, upper };
  scope.report(`${what} is a triangular law whose bounds and mode are out of order.`);
  return undefined;
}

function logitNormalLaw(mu: number, sigma: number, scope: ConversionScope, what: string): Law | undefined {
  if (sigma > 0) return { family: "LOGIT_NORMAL", mu, sigma };
  scope.report(`${what} is a logit-normal law with sigma ${sigma}, which has no exact law in the contract.`);
  return undefined;
}

function basicEventLaw(distribution: JsonRecord, scope: ConversionScope, what: string): Law | undefined {
  const value = (key: string): number => numberField(distribution, key) ?? Number.NaN;
  switch (field(distribution, "family")) {
    case "BETA":
      return positiveLaw({ family: "BETA", alpha: value("alpha"), beta: value("beta"), lower: 0, upper: 1 }, [value("alpha"), value("beta")], scope, what);
    case "LOGNORMAL":
      return lognormalFromMedian(value("median"), value("errorFactor"), scope, what);
    case "UNIFORM":
      return boundedLaw(value("lower"), value("upper"), scope, what);
    case "NORMAL":
      return normalLaw(value("mean"), value("standardDeviation"), scope, what);
    case "LOGITNORMAL":
      return logitNormalLaw(value("mu"), value("sigma"), scope, what);
    case "GAMMA":
      return positiveLaw({ family: "GAMMA", shape: value("shape"), rate: 1 / value("scale") }, [value("shape"), value("scale")], scope, what);
    case "EXPONENTIAL":
      return positiveLaw({ family: "GAMMA", shape: 1, rate: value("rate") }, [value("rate")], scope, what);
    case "TRIANGULAR":
      return triangularLaw(value("lower"), value("mode"), value("upper"), scope, what);
    default:
      scope.report(`${what} has a ${String(field(distribution, "family"))} distribution, which has no exact law in the contract.`);
      return undefined;
  }
}

function convertBasicEvent(entry: JsonRecord, scope: ConversionScope, what: string): JsonRecord | undefined {
  const reference = recordField(entry, "faultTreeBasicEvent");
  const distribution = recordField(entry, "distribution");
  const where = `${what} basic event ${reference === undefined ? "?" : textField(reference, "entityId") ?? "?"}`;
  if (reference === undefined || distribution === undefined) {
    scope.report(`${where} holds no distribution.`);
    return undefined;
  }
  const law = basicEventLaw(distribution, scope, where);
  return law === undefined ? undefined : { faultTreeBasicEvent: reference, expression: jsonOf(valueExpression("PROBABILITY", law)) };
}

function betaConcentrations(prior: JsonRecord, states: readonly string[] | undefined, scope: ConversionScope, where: string): number[] | undefined {
  const alpha = numberField(prior, "alpha");
  const beta = numberField(prior, "beta");
  const trueState = textField(prior, "trueStateId");
  if (alpha === undefined || beta === undefined || !(alpha > 0) || !(beta > 0) || trueState === undefined) {
    scope.report(`${where} has a beta prior without positive alpha, beta and a true state.`);
    return undefined;
  }
  if (states === undefined) {
    scope.report(`${where} names a network node that the workbook does not hold, so its states cannot be read.`);
    return undefined;
  }
  if (states.length !== 2 || !states.includes(trueState)) {
    scope.report(`${where} has a beta prior, but its node does not have two states with the true state among them.`);
    return undefined;
  }
  return states.map((state) => (state === trueState ? alpha : beta));
}

function convertCptRow(entry: JsonRecord, nodes: NodeStates, scope: ConversionScope, what: string): JsonRecord | undefined {
  const node = recordField(entry, "bayesianNetworkNode");
  const rowId = textField(entry, "cptRowId");
  const prior = recordField(entry, "prior");
  const where = `${what} CPT row ${rowId ?? "?"}`;
  if (node === undefined || rowId === undefined || prior === undefined) {
    scope.report(`${where} holds no prior.`);
    return undefined;
  }
  const modelId = textField(node, "modelId");
  const nodeId = textField(node, "entityId");
  const states = modelId === undefined || nodeId === undefined ? undefined : nodes.get(nodeKey(modelId, nodeId));
  const family = field(prior, "family");
  let concentrations: number[] | undefined;
  if (family === "BETA") concentrations = betaConcentrations(prior, states, scope, where);
  else if (family === "DIRICHLET") {
    concentrations = numberList(field(prior, "alpha"));
    if (concentrations !== undefined && states !== undefined && concentrations.length !== states.length) {
      scope.report(`${where} has ${concentrations.length} Dirichlet concentrations for a node with ${states.length} states.`);
      return undefined;
    }
  } else scope.report(`${where} has a ${String(family)} prior, which has no exact law in the contract.`);
  if (concentrations === undefined) return undefined;
  const law = DirichletLawSchema.safeParse({ family: "DIRICHLET", concentrations });
  if (!law.success) {
    scope.report(`${where} has Dirichlet concentrations that do not form a law. ${law.error.issues[0]?.message ?? ""}`.trim());
    return undefined;
  }
  return { bayesianNetworkNode: node, cptRowId: rowId, row: jsonOf({ node: "VALUE", law: law.data }) };
}

function convertAll(values: Json[], convert: (entry: JsonRecord) => JsonRecord | undefined): JsonRecord[] | undefined {
  const converted: JsonRecord[] = [];
  let complete = true;
  for (const value of values) {
    const entry = isRecord(value) ? convert(value) : undefined;
    if (entry === undefined) complete = false;
    else converted.push(entry);
  }
  return complete ? converted : undefined;
}

function fragilityMedian(theta: number, uncertainty: number, scope: ConversionScope, where: string): UncertainExpression | undefined {
  if (!(theta > 0) || !(uncertainty >= 0)) {
    scope.report(`${where} needs a median capacity above zero and an uncertainty beta of zero or more.`);
    return undefined;
  }
  if (uncertainty === 0) return pointExpression("QUANTITY", theta);
  const z = scope.upperStandardQuantile(where);
  if (z === undefined) return undefined;
  const law = scope.law(lognormalFit(null, theta, [{ probability: UPPER_PERCENTILE, value: theta * Math.exp(z * uncertainty) }]), `the median capacity law of ${where}`);
  return law === undefined ? undefined : valueExpression("QUANTITY", law);
}

function fragilityGenerator(generator: JsonRecord, scope: ConversionScope, where: string): JsonRecord | undefined {
  const theta = numberField(generator, "theta");
  const randomness = numberField(generator, "betaR");
  const uncertainty = numberField(generator, "betaU");
  const centers = arrayField(generator, "pgaCenters") ?? [];
  const demands = centers.flatMap((center) => {
    const stateId = isRecord(center) ? textField(center, "stateId") : undefined;
    const demand = isRecord(center) ? numberField(center, "value") : undefined;
    return stateId === undefined || demand === undefined ? [] : [{ stateId, demand }];
  });
  if (theta === undefined || randomness === undefined || uncertainty === undefined || demands.length !== centers.length) {
    scope.report(`${where} is missing its median, betas or PGA centers.`);
    return undefined;
  }
  const median = fragilityMedian(theta, uncertainty, scope, where);
  if (median === undefined) return undefined;
  return {
    kind: "SEISMIC_FRAGILITY",
    pgaParentId: field(generator, "pgaParentId") ?? null,
    trueStateId: field(generator, "trueStateId") ?? null,
    falseStateId: field(generator, "falseStateId") ?? null,
    median: jsonOf(median),
    randomness: jsonOf(pointExpression("FACTOR", randomness)),
    demands,
  };
}

function binFrequency(bin: JsonRecord, scope: ConversionScope, where: string): UncertainExpression | undefined {
  const median = numberField(bin, "medianFrequency");
  const errorFactor = numberField(bin, "errorFactor95");
  if (median === undefined || errorFactor === undefined || median < 0) {
    scope.report(`${where} needs a median frequency of zero or more and an error factor.`);
    return undefined;
  }
  if (median === 0) return pointExpression("PER_YEAR", 0);
  const law = lognormalFromMedian(median, errorFactor, scope, where);
  return law === undefined ? undefined : valueExpression("PER_YEAR", law);
}

function pgaBinsGenerator(generator: JsonRecord, scope: ConversionScope, where: string): JsonRecord | undefined {
  const missionTime = numberField(generator, "missionTime");
  const conversion = field(generator, "frequencyToProbability");
  if (missionTime === undefined || (conversion !== "poisson" && conversion !== "linear")) {
    scope.report(`${where} is missing its mission time or its frequency conversion.`);
    return undefined;
  }
  const bins = convertAll(arrayField(generator, "bins") ?? [], (bin) => {
    const stateId = textField(bin, "stateId");
    const frequency = stateId === undefined ? undefined : binFrequency(bin, scope, `${where} bin ${stateId}`);
    if (stateId === undefined) scope.report(`${where} has a bin without a state.`);
    return stateId === undefined || frequency === undefined ? undefined : { stateId, frequency: jsonOf(frequency) };
  });
  if (bins === undefined) return undefined;
  return {
    kind: "SEISMIC_PGA_BINS",
    noneStateId: field(generator, "noneStateId") ?? null,
    missionTime: jsonOf(pointExpression("YEARS", missionTime)),
    conversion: conversion === "poisson" ? "POISSON" : "LINEAR",
    bins,
  };
}

function convertGenerator(entry: JsonRecord, scope: ConversionScope, what: string): JsonRecord | undefined {
  const node = recordField(entry, "bayesianNetworkNode");
  const generator = recordField(entry, "generator");
  const where = `${what} generator on node ${node === undefined ? "?" : textField(node, "entityId") ?? "?"}`;
  if (node === undefined || generator === undefined) {
    scope.report(`${where} holds no generator.`);
    return undefined;
  }
  if (present(generator, "kind")) return entry;
  const type = field(generator, "type");
  const converted = type === "seismic_fragility" ? fragilityGenerator(generator, scope, where) : type === "seismic_pga_bins" ? pgaBinsGenerator(generator, scope, where) : undefined;
  if (converted === undefined && type !== "seismic_fragility" && type !== "seismic_pga_bins") scope.report(`${where} has a ${String(type)} generator, which the contract does not know.`);
  return converted === undefined ? undefined : { bayesianNetworkNode: node, generator: converted };
}

function samplerOf(settings: JsonRecord, scope: ConversionScope, what: string): string | undefined {
  const sampler = field(settings, "sampler");
  const legacy = field(settings, "basicEventSampler");
  const chosen = sampler ?? legacy ?? "MC";
  if (sampler !== undefined && legacy !== undefined && sampler !== legacy) {
    scope.report(`${what} names two different samplers.`);
    return undefined;
  }
  if (typeof chosen !== "string" || !SAMPLERS.includes(chosen)) {
    scope.report(`${what} names the sampler ${String(chosen)}.`);
    return undefined;
  }
  return chosen;
}

function convertSettings(settings: JsonRecord, nodes: NodeStates, scope: ConversionScope, what: string): JsonRecord {
  if (HclUncertaintySettingsSchema.safeParse(settings).success) return settings;
  if (!OLD_SETTING_FIELDS.some((key) => present(settings, key)) && present(settings, "basicEvents")) return settings;
  const sampler = samplerOf(settings, scope, what);
  const basicEvents = convertAll(arrayField(settings, "basicEventDistributions") ?? [], (entry) => convertBasicEvent(entry, scope, what));
  const cptRows = convertAll(arrayField(settings, "cptRowDistributions") ?? [], (entry) => convertCptRow(entry, nodes, scope, what));
  const cptGenerators = convertAll(arrayField(settings, "cptGenerators") ?? [], (entry) => convertGenerator(entry, scope, what));
  if (sampler === undefined || basicEvents === undefined || cptRows === undefined || cptGenerators === undefined) return settings;
  return {
    sampleCount: field(settings, "sampleCount") ?? null,
    seed: field(settings, "seed") ?? null,
    sampler,
    basicEvents,
    cptRows,
    cptGenerators,
  };
}

function convertConfigurations(mef: JsonRecord, configurationsKey: string, networksKey: string, scope: ConversionScope, host: string): JsonRecord {
  const nodes = networkStates(arrayField(mef, networksKey));
  return withArray(mef, configurationsKey, (configuration) => withRecord(configuration, "solverSettings", (settings) => {
    const uncertainty = recordField(settings, "uncertainty");
    if (uncertainty === undefined) {
      if (present(settings, "uncertainty")) scope.report(`The uncertainty settings of ${host} HCL configuration ${textField(configuration, "modelId") ?? "?"} are not an object.`);
      return settings;
    }
    const converted = convertSettings(uncertainty, nodes, scope, `${host} HCL configuration ${textField(configuration, "modelId") ?? "?"}`);
    return converted === uncertainty ? settings : { ...settings, uncertainty: converted };
  }));
}

function hclSettingsIssue(mef: JsonRecord, configurationsKey: string): string | undefined {
  for (const configuration of arrayField(mef, configurationsKey) ?? []) {
    if (!isRecord(configuration)) continue;
    const settings = recordField(configuration, "solverSettings");
    const uncertainty = settings === undefined ? undefined : field(settings, "uncertainty");
    if (uncertainty === undefined) continue;
    const parsed = HclUncertaintySettingsSchema.safeParse(uncertainty);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return `HCL configuration ${textField(configuration, "modelId") ?? "?"} uncertainty settings do not parse. ${issue === undefined ? "" : `${issue.path.map(String).join(".")}: ${issue.message}`}`.trim();
    }
  }
  return undefined;
}

export { convertConfigurations, hclSettingsIssue };
