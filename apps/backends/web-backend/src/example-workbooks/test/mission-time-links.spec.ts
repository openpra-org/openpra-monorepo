import { execute } from "praxis-node";
import type { UncertainExpression, UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import { SuccessCriteriaDevelopmentSchema } from "interfaces-mef-types/zod/sc/success-criteria-development";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { DataAnalysisSchema } from "interfaces-mef-types/zod/da/data-analysis";
import { UncertaintyResponseSchema, type UncertaintyRequest, type UncertaintyResponse } from "interfaces-shared-types/newly-developed-methods/shared";
import { SC_ANALYSIS } from "../seeds/sc-seed";
import { SC_ANALYSIS_HTGR } from "../seeds/sc-seed-htgr";
import { SY_ANALYSIS } from "../seeds/sy-seed";
import { SY_ANALYSIS_HTGR } from "../seeds/sy-seed-htgr";
import { DA_ANALYSIS } from "../seeds/da-seed";
import { DA_ANALYSIS_HTGR } from "../seeds/da-seed-htgr";

interface NativeAnswer {
  result?: Record<string, number | string | boolean | object | null>;
  error?: { message: string };
}

interface MissionEstimate {
  id: string;
  systemId: string | undefined;
  rate: UncertainExpression;
  missionTime: UncertainExpression;
}

interface Variant {
  name: string;
  sc: SuccessCriteriaDevelopment;
  sy: SystemsAnalysis;
  da: DataAnalysis;
  link: string;
  typed: string[];
}

const variants: Variant[] = [
  { name: "SFR", sc: SC_ANALYSIS, sy: SY_ANALYSIS, da: DA_ANALYSIS, link: "example-sc-sfr", typed: [] },
  { name: "HTGR", sc: SC_ANALYSIS_HTGR, sy: SY_ANALYSIS_HTGR, da: DA_ANALYSIS_HTGR, link: "example-sc-htgr", typed: ["DA-BE-238", "DA-BE-239"] },
];

function evaluate(request: UncertaintyRequest): UncertaintyResponse {
  const answer: NativeAnswer = JSON.parse(execute(JSON.stringify({ schemaVersion: "1.0.0", request: { schemaVersion: "1.0.0", methodType: "UNCERTAINTY", ...request }, modelSnapshots: [] })));
  if (answer.error !== undefined) throw new Error(answer.error.message);
  const result = { ...(answer.result ?? {}) };
  delete result["methodType"];
  return UncertaintyResponseSchema.parse(result);
}

function missionEstimates(variant: Variant): MissionEstimate[] {
  return variant.da.parameters.flatMap((parameter) => {
    const estimate = parameter.estimate;
    if (estimate?.node !== "MODEL" || estimate.model.form !== "MISSION") return [];
    return [{ id: parameter.uuid, systemId: parameter.systemReference, rate: estimate.model.rate, missionTime: estimate.model.missionTime }];
  });
}

function scTable(variant: Variant): UncertainParameter[] {
  return [...variant.sc.missionTimes, ...(variant.sc.componentMissionTimes ?? [])].map((record) => ({
    reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: variant.link, entityId: record.uuid },
    expression: record.missionTime,
  }));
}

describe("example mission times", () => {
  it.each(variants)("keeps every SC mission time in $name as a point in hours", ({ sc }) => {
    expect(SuccessCriteriaDevelopmentSchema.safeParse(sc).success).toBe(true);
    const records = [...sc.missionTimes, ...(sc.componentMissionTimes ?? [])];
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.missionTime.node).toBe("VALUE");
      if (record.missionTime.node !== "VALUE") continue;
      expect(record.missionTime.value.unit).toBe("HOURS");
      expect(record.missionTime.value.law.family).toBe("POINT");
    }
  });

  it.each(variants)("links every $name system to an SC sequence time", ({ sc, sy, link }) => {
    expect(SystemsAnalysisSchema.safeParse(sy).success).toBe(true);
    const sequences = new Set(sc.missionTimes.map((record) => record.uuid));
    for (const system of sy.systemDefinitions) {
      const missionTime = system.missionTime;
      expect(missionTime?.node).toBe("PARAMETER");
      if (missionTime?.node !== "PARAMETER") continue;
      expect(missionTime.reference.workbookId).toBe(link);
      expect(sequences.has(missionTime.reference.entityId)).toBe(true);
      expect((system.modelAssumptions ?? []).some((text) => text.includes(missionTime.reference.entityId))).toBe(true);
    }
  });

  it.each(variants)("links every $name DA mission estimate to its system time or its component time", (variant) => {
    expect(DataAnalysisSchema.safeParse(variant.da).success).toBe(true);
    const systemTimes = new Map(variant.sy.systemDefinitions.map((system) => [system.uuid, system.missionTime]));
    const components = new Set((variant.sc.componentMissionTimes ?? []).map((record) => record.uuid));
    const estimates = missionEstimates(variant);
    expect(estimates.length).toBeGreaterThan(0);
    for (const estimate of estimates) {
      if (variant.typed.includes(estimate.id)) {
        expect(estimate.missionTime.node).toBe("VALUE");
        continue;
      }
      expect(estimate.missionTime.node).toBe("PARAMETER");
      if (estimate.missionTime.node !== "PARAMETER") continue;
      expect(estimate.missionTime.reference.workbookId).toBe(variant.link);
      const systemTime = systemTimes.get(estimate.systemId ?? "");
      const entityId = estimate.missionTime.reference.entityId;
      const followsSystem = systemTime?.node === "PARAMETER" && systemTime.reference.entityId === entityId;
      expect(followsSystem || components.has(entityId)).toBe(true);
    }
    expect(variant.da.parameters.every((parameter) => parameter.estimate === undefined || parameter.missionTime === undefined)).toBe(true);
  });

  it.each(variants)("gives the same PRAXIS point for each $name link as for the SC value it names", (variant) => {
    const table = scTable(variant);
    const values = new Map(table.map((entry) => [entry.reference.entityId, entry.expression]));
    const linked = missionEstimates(variant).filter((estimate) => estimate.missionTime.node === "PARAMETER");
    const expressions = linked.flatMap((estimate) => {
      const entityId = estimate.missionTime.node === "PARAMETER" ? estimate.missionTime.reference.entityId : "";
      const value = values.get(entityId);
      if (value === undefined) throw new Error(`${estimate.id} links ${entityId}, which SC does not hold.`);
      const direct: UncertainExpression = { node: "MODEL", model: { form: "MISSION", rate: estimate.rate, missionTime: value } };
      const throughLink: UncertainExpression = { node: "MODEL", model: { form: "MISSION", rate: estimate.rate, missionTime: estimate.missionTime } };
      return [
        { id: `${estimate.id}:link`, expression: throughLink, unit: "PROBABILITY" as const, probabilities: [] },
        { id: `${estimate.id}:value`, expression: direct, unit: "PROBABILITY" as const, probabilities: [] },
      ];
    });
    const response = evaluate({ parameters: table, laws: [], expressions, operations: [] });
    const points = new Map(response.expressions.flatMap((summary) => ("point" in summary ? [[summary.id, summary.point] as const] : [])));
    expect(points.size).toBe(expressions.length);
    for (const estimate of linked) {
      const point = points.get(`${estimate.id}:link`);
      expect(point).toBeGreaterThan(0);
      expect(point).toBeLessThan(1);
      expect(point).toBe(points.get(`${estimate.id}:value`));
    }
  });
});
