import { WorkbookHclConfigurationSchema, WorkbookHclUncertaintyConfigurationSchema } from "interfaces-mef-types/zod/modeling";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { createBlankSy } from "../../../sy-workbooks/blank-sy";
import { createBlankEsq } from "../../../esq-workbooks/blank-esq";
import { stripNulls } from "../../../pos-workbooks/mef-normalize";
import { adaptSyHclSnapshot, adaptEsqHclSnapshot } from "../praxis-snapshot-adapters";
import { model } from "mongoose";
import { AnalysisRunRecordSchema } from "../analysis-run-record.schema";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const valid = { sampleCount: 10, seed: 42, sampler: "MC", basicEventDistributions: [], cptRowDistributions: [] };
const configuration = {
  modelId: id(1), code: "HCL", name: "HCL", description: "",
  bayesianNetwork: { workbookId: "bn", modelId: id(2) },
  faultTrees: [{ workbookId: "sy", modelId: id(3) }], bindings: [],
  baseEvidence: { observations: [] }, evidenceScenarios: [],
  solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
};
const invalidDrafts: unknown[] = [
  null, false, 7, "old settings", [], {},
  { ...valid, sampler: "INVALID" }, { ...valid, sampleCount: 0 },
  { ...valid, seed: -1 }, { ...valid, basicEventDistributions: null },
  { ...valid, cptRowDistributions: [{ equivalentSampleSize: 100 }] },
  { ...valid, cptGenerators: [{ generator: { type: "UNKNOWN", extra: null, negativeZero: -0 } }] },
];

it.each(invalidDrafts)("preserves an invalid draft and validates it only for uncertainty: %j", (uncertainty) => {
  const raw = { ...configuration, solverSettings: { ...configuration.solverSettings, uncertainty } };
  const before = structuredClone(raw);
  expect(WorkbookHclConfigurationSchema.parse(raw).solverSettings.uncertainty).toEqual(uncertainty);
  expect(WorkbookHclUncertaintyConfigurationSchema.safeParse(raw).success).toBe(false);
  for (const host of ["sy", "esq"] as const) {
    const collection = host === "sy" ? "dependencyHclConfigurations" : "hclConfigurations";
    const mef = host === "sy" ? createBlankSy("Test", "Analyst") : createBlankEsq("Test", "Analyst");
    const input = { ...mef, [collection]: [raw] };
    const normalized = stripNulls(input);
    const parsed = host === "sy" ? SystemsAnalysisSchema.parse(normalized) : EventSequenceQuantificationSchema.parse(normalized);
    const adapter = host === "sy" ? adaptSyHclSnapshot : adaptEsqHclSnapshot;
    const source = { workbookId: host, workbookRevision: 1, mef: parsed };
    expect((parsed as unknown as Record<string, typeof raw[]>)[collection]![0]!.solverSettings.uncertainty).toEqual(uncertainty);
    // The branch-specific parsed type is already checked above.
    const adapt = adapter as (snapshot: typeof source, modelId: string, type?: "PROBABILITY" | "UNCERTAINTY") => Record<string, unknown>;
    expect(adapt(source, id(1)).solverSettings).not.toHaveProperty("uncertainty");
    expect(adapt(source, id(1), "PROBABILITY").solverSettings).not.toHaveProperty("uncertainty");
    expect(() => adapt(source, id(1), "UNCERTAINTY")).toThrow("Invalid uncertainty settings");
  }
  expect(raw).toEqual(before);
});

it("preserves nulls and signed zero inside saved drafts without changing other normalization", () => {
  const draft = { nested: [null, { zero: -0 }] };
  for (const collection of ["dependencyHclConfigurations", "hclConfigurations"]) {
    const input = { other: null, [collection]: [{ solverSettings: { uncertainty: draft } }] };
    const result = stripNulls(input) as typeof input;
    expect(result).not.toHaveProperty("other");
    const saved = (result[collection] as Array<{ solverSettings: { uncertainty: typeof draft } }>)[0]!.solverSettings.uncertainty;
    expect(saved).toEqual(draft);
    expect(Object.is((saved.nested[1] as { zero: number }).zero, -0)).toBe(true);
  }
});

it("keeps empty uncertainty objects when serializing run history for storage", () => {
  const Record = model("HclDraftSnapshotTest", AnalysisRunRecordSchema);
  const mef = { hclConfigurations: [{ ...configuration, solverSettings: { ...configuration.solverSettings, uncertainty: {} } }] };
  const record = new Record({ workbookSnapshots: [{ hostType: "ESQ", identity: { workbookId: "esq", workbookRevision: 1 }, mef }] });
  expect(record.toObject().workbookSnapshots[0]!.mef).toEqual(mef);
});

it("still rejects invalid point settings and validates only the selected uncertainty configuration", () => {
  const raw = { ...configuration, solverSettings: { ...configuration.solverSettings, uncertainty: valid } };
  expect(WorkbookHclUncertaintyConfigurationSchema.safeParse(raw).success).toBe(true);
  expect(WorkbookHclConfigurationSchema.safeParse({ ...raw, solverSettings: { ...raw.solverSettings, variableOrder: [id(4), id(4)] } }).success).toBe(false);
  expect(WorkbookHclConfigurationSchema.safeParse({ ...raw, bayesianNetwork: { workbookId: "bn", modelId: "bad-id" } }).success).toBe(false);
  const mef = { ...createBlankEsq("Test", "Analyst"), hclConfigurations: [raw, { ...raw, modelId: id(5), code: "OTHER", solverSettings: { ...raw.solverSettings, uncertainty: null } }] };
  const parsed = EventSequenceQuantificationSchema.parse(stripNulls(mef));
  expect(adaptEsqHclSnapshot({ workbookId: "esq", workbookRevision: 1, mef: parsed }, id(1), "UNCERTAINTY").solverSettings).toHaveProperty("uncertainty.sampleCount", 10);
});
