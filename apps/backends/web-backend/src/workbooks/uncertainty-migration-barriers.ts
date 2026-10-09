import type { Law, UncertainLawField } from "interfaces-mef-types/core/uncertainty";
import {
  arrayField,
  field,
  isRecord,
  jsonOf,
  numberField,
  present,
  rawText,
  recordField,
  textField,
  withArray,
  withRecord,
  without,
  type JsonRecord,
} from "./uncertainty-migration-json";
import { figuresLaw, storedDistributionLaw, valueExpression, type ConversionScope } from "./uncertainty-migration-laws";

type SideResult = { kind: "SIDE"; side: JsonRecord } | { kind: "OMIT" } | { kind: "KEEP" };

const DIRECT_FIELDS: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map([
  ["NORMAL", new Map([["mean", "mean"], ["stdDev", "standardDeviation"]])],
  ["UNIFORM", new Map([["lower", "lower"], ["upper", "upper"]])],
  ["GAMMA", new Map([["shape", "shape"], ["rate", "rate"], ["failureRate", "rate"]])],
  ["WEIBULL", new Map([["scale", "scale"], ["shape", "shape"], ["location", "location"]])],
  ["BETA", new Map([["alpha", "alpha"], ["betaParam", "beta"]])],
  ["POINT", new Map([["value", "value"], ["mean", "value"], ["median", "value"]])],
]);

function correlationCounts(mef: JsonRecord): Map<string, number> {
  const counts = new Map<string, number>();
  const work = recordField(mef, "barrierWork");
  for (const cell of arrayField(work ?? {}, "cells") ?? []) {
    if (!isRecord(cell)) continue;
    for (const key of ["load", "capacity"]) {
      const side = recordField(cell, key);
      for (const entry of arrayField(side ?? {}, "uncertain") ?? []) {
        const correlation = isRecord(entry) ? textField(entry, "correlationKey") : undefined;
        if (correlation !== undefined) counts.set(correlation, (counts.get(correlation) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function directField(law: Law, parameter: string): string | undefined {
  return DIRECT_FIELDS.get(law.family)?.get(parameter);
}

function uncertainWhat(entry: JsonRecord, where: string): string {
  return `the ${textField(entry, "parameter") ?? "?"} uncertainty of ${where}`;
}

function uncertainField(entry: JsonRecord, epistemic: Law, aleatory: Law, oldType: string, oldMedian: number | undefined, scope: ConversionScope, where: string): UncertainLawField | undefined {
  const parameter = textField(entry, "parameter") ?? "?";
  const what = uncertainWhat(entry, where);
  const direct = directField(aleatory, parameter);
  if (direct !== undefined) return { field: direct, value: valueExpression("QUANTITY", epistemic) };
  if (aleatory.family === "LOGNORMAL" && parameter === "median" && oldMedian !== undefined && oldMedian > 0) {
    const scaled = scope.law({ kind: "SCALE", law: epistemic, factor: aleatory.mean / oldMedian }, `the mean law of ${what}`);
    return scaled === undefined ? undefined : { field: "mean", value: valueExpression("QUANTITY", scaled) };
  }
  scope.report(`${what} varies ${parameter} of a ${oldType} law, which the contract law keeps fixed, so it cannot be converted exactly.`);
  return undefined;
}

function sharedKeyIssue(entry: JsonRecord, shared: ReadonlyMap<string, number>, scope: ConversionScope, where: string): boolean {
  const correlation = textField(entry, "correlationKey");
  if (correlation === undefined || (shared.get(correlation) ?? 0) < 2) return false;
  scope.report(`${uncertainWhat(entry, where)} shares the correlation key ${correlation}. A shared draw needs a parameter, so it cannot be converted.`);
  return true;
}

function typedSide(side: JsonRecord, basis: string, shared: ReadonlyMap<string, number>, scope: ConversionScope, where: string): SideResult {
  const distribution = recordField(side, "distribution");
  const oldType = distribution === undefined ? "?" : String(field(distribution, "type"));
  const entries = (arrayField(side, "uncertain") ?? []).flatMap((entry) => (isRecord(entry) ? [entry] : []));
  const blocked = entries.map((entry) => sharedKeyIssue(entry, shared, scope, where)).includes(true);
  const epistemics = entries.map((entry) => storedDistributionLaw(field(entry, "distribution"), undefined, scope, uncertainWhat(entry, where)));
  const aleatory = storedDistributionLaw(distribution ?? null, undefined, scope, where);
  if (blocked || aleatory === undefined || distribution === undefined) return { kind: "KEEP" };
  const parameters = entries.map((entry) => textField(entry, "parameter"));
  if (aleatory.family === "LOGNORMAL" && parameters.includes("median") && parameters.includes("errorFactor")) {
    scope.report(`${where} varies both the median and the error factor of its lognormal law, which cannot be converted exactly.`);
    return { kind: "KEEP" };
  }
  const fields = entries.flatMap((entry, index) => {
    const epistemic = epistemics[index];
    const converted = epistemic === undefined ? undefined : uncertainField(entry, epistemic, aleatory, oldType, numberField(distribution, "median"), scope, where);
    return converted === undefined ? [] : [converted];
  });
  if (fields.length < entries.length) return { kind: "KEEP" };
  return { kind: "SIDE", side: { source: "TYPED", variable: jsonOf({ law: aleatory, fields }), basis } };
}

function convertSide(side: JsonRecord, shared: ReadonlyMap<string, number>, scope: ConversionScope, where: string): SideResult {
  const basis = rawText(side, "basis") ?? "";
  const uncertain = arrayField(side, "uncertain") ?? [];
  const fragility = recordField(side, "fragility");
  if (fragility !== undefined) {
    const median = numberField(fragility, "median");
    const betaR = numberField(fragility, "betaR");
    const betaU = numberField(fragility, "betaU");
    if (median === undefined || betaR === undefined || betaU === undefined) {
      scope.report(`${where} has a fragility without its median and betas.`);
      return { kind: "KEEP" };
    }
    return { kind: "SIDE", side: { source: "FRAGILITY", fragility: { median, betaR, betaU }, basis } };
  }
  const parameterId = textField(side, "parameterId");
  if (parameterId !== undefined) {
    if (uncertain.length > 0) {
      scope.report(`${where} varies the law of DA parameter ${parameterId}, which a DA side cannot hold.`);
      return { kind: "KEEP" };
    }
    return { kind: "SIDE", side: { source: "DA", parameterId, basis } };
  }
  if (present(side, "distribution")) return typedSide(side, basis, shared, scope, where);
  if (basis.trim().length === 0 && uncertain.length === 0) return { kind: "OMIT" };
  scope.report(`${where} has a basis but no value, and the contract cannot hold a side without one.`);
  return { kind: "KEEP" };
}

function convertTyped(typed: JsonRecord, scope: ConversionScope, where: string): JsonRecord | undefined {
  if (present(typed, "expression")) return typed;
  const value = numberField(typed, "value");
  const law = figuresLaw(value, undefined, numberField(typed, "errorFactor"), scope, `the typed value of ${where}`);
  if (law === undefined) return undefined;
  if (law.family === "POINT" && law.value > 1) {
    scope.report(`the typed value of ${where} is above 1, so it is not a probability.`);
    return undefined;
  }
  return { expression: jsonOf(valueExpression("PROBABILITY", law)), basis: rawText(typed, "basis") ?? "" };
}

function convertCell(cell: JsonRecord, shared: ReadonlyMap<string, number>, scope: ConversionScope): JsonRecord {
  const where = `ESQ barrier cell ${textField(cell, "id") ?? "?"}`;
  let next = cell;
  for (const key of ["load", "capacity"]) {
    const side = recordField(next, key);
    if (side === undefined || present(side, "source")) continue;
    const result = convertSide(side, shared, scope, `the ${key} of ${where}`);
    if (result.kind === "OMIT") next = without(next, [key]);
    else if (result.kind === "SIDE" && result.side !== side) next = { ...next, [key]: result.side };
  }
  return withRecord(next, "typed", (typed) => convertTyped(typed, scope, where) ?? typed);
}

function convertBarrierWork(mef: JsonRecord, scope: ConversionScope): JsonRecord {
  const shared = correlationCounts(mef);
  return withRecord(mef, "barrierWork", (work) => withArray(work, "cells", (cell) => convertCell(cell, shared, scope)));
}

export { convertBarrierWork };
