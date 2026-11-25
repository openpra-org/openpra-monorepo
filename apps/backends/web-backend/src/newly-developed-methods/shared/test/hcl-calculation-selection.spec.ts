import { WorkbookHclConfigurationSchema, WorkbookHclUncertaintyConfigurationSchema } from "interfaces-mef-types/zod/modeling";
import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { createBlankEsq } from "../../../esq-workbooks/blank-esq";
import { stripNulls } from "../../../pos-workbooks/mef-normalize";
import { adaptHclConfigurationSnapshot } from "../praxis-snapshot-adapters";
import { model } from "mongoose";
import { AnalysisRunRecordSchema } from "../analysis-run-record.schema";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const valid = { sampleCount: 10, seed: 42, sampler: "MC", basicEvents: [], cptRows: [], cptGenerators: [] };
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
  { ...valid, seed: -1 }, { ...valid, basicEvents: null },
  { ...valid, cptRows: [{ equivalentSampleSize: 100 }] },
  { ...valid, cptGenerators: [{ generator: { kind: "UNKNOWN", extra: null, negativeZero: -0 } }] },
  { ...valid, cptProbabilityClipEpsilon: 0 },
  { sampleCount: 10, seed: 42, basicEventDistributions: [], cptRowDistributions: [] },
];

it.each(invalidDrafts)("preserves an invalid draft and validates it only for uncertainty: %j", (uncertainty) => {
  const raw = { ...configuration, solverSettings: { ...configuration.solverSettings, uncertainty } };
  const before = structuredClone(raw);
  expect(WorkbookHclConfigurationSchema.parse(raw).solverSettings.uncertainty).toEqual(uncertainty);
  expect(WorkbookHclUncertaintyConfigurationSchema.safeParse(raw).success).toBe(false);
  const parsed = EventSequenceQuantificationSchema.parse(stripNulls({ ...createBlankEsq("Test", "Analyst"), hclConfigurations: [raw] }));
  const saved = parsed.hclConfigurations[0]!;
  const source = { workbookRevision: 1 };
  expect(saved.solverSettings.uncertainty).toEqual(uncertainty);
  expect(adaptHclConfigurationSnapshot(source, saved, "PROBABILITY")["solverSettings"]).not.toHaveProperty("uncertainty");
  expect(() => adaptHclConfigurationSnapshot(source, saved, "UNCERTAINTY")).toThrow("Invalid uncertainty settings");
  expect(raw).toEqual(before);
});

it("preserves nulls and signed zero inside saved drafts without changing other normalization", () => {
  const draft = { nested: [null, { zero: -0 }] };
  const input = { other: null, hclConfigurations: [{ solverSettings: { uncertainty: draft } }] };
  const result = stripNulls(input) as typeof input;
  expect(result).not.toHaveProperty("other");
  const saved = result.hclConfigurations[0]!.solverSettings.uncertainty;
  expect(saved).toEqual(draft);
  expect(Object.is((saved.nested[1] as { zero: number }).zero, -0)).toBe(true);
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
  expect(adaptHclConfigurationSnapshot({ workbookRevision: 1 }, parsed.hclConfigurations[0]!, "UNCERTAINTY")["solverSettings"]).toHaveProperty("uncertainty.sampleCount", 10);
});
