import {
  HclExecuteRequestSchema, HclEventTreeExecuteRequestSchema,
  HclFaultTreeBatchExecuteRequestSchema, HclEventTreeBatchExecuteRequestSchema,
} from "..";
const id = "10000000-0000-4000-8000-000000000001";
const common = { schemaVersion: "1.0.0", modelId: id, workbookRevision: 1 };
const ft = { faultTreeTopGate: { referenceType: "FAULT_TREE_TOP_EVENT", workbookId: "sy", modelId: id, entityId: id } };
const et = { eventTree: { workbookId: "es", modelId: id } };
const cases = [
  ["FT", HclExecuteRequestSchema, ft],
  ["ET", HclEventTreeExecuteRequestSchema, et],
  ["FT batch", HclFaultTreeBatchExecuteRequestSchema, { ...ft, evidenceScenarioIds: [id] }],
  ["ET batch", HclEventTreeBatchExecuteRequestSchema, { ...et, evidenceScenarioIds: [id] }],
] as const;

it.each(cases)("%s defaults to probability and accepts explicit uncertainty", (_name, schema, target) => {
  const request = { ...common, ...target };
  expect(schema.parse(request).calculationType).toBe("PROBABILITY");
  for (const calculationType of ["PROBABILITY", "UNCERTAINTY"]) {
    expect(schema.parse({ ...request, calculationType }).calculationType).toBe(calculationType);
  }
  for (const calculationType of ["CUT_SETS", "IMPORTANCE", "BN_QUERY", null]) {
    expect(schema.safeParse({ ...request, calculationType }).success).toBe(false);
  }
});
