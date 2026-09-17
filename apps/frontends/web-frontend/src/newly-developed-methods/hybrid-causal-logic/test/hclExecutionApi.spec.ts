import { postJson } from "../../../api/client";
import { runSyHclFaultTree, runSyHclFaultTreeBatch } from "../../../sy-workbooks/syWorkbookApi";
import { runEsqHclFaultTree, runEsqHclFaultTreeBatch, runEsqHclEventTree, runEsqHclEventTreeBatch } from "../../../esq-workbooks/esqWorkbookApi";
import type { HclCalculationType } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";

jest.mock("../../../api/client", () => ({ postJson: jest.fn() }));
const ft = { referenceType: "FAULT_TREE_TOP_EVENT", workbookId: "sy", modelId: "ft", entityId: "top" } as const;
const et = { workbookId: "es", modelId: "et" };
const dependency = { workbookId: "sy", modelId: "hcl" };
const cases: Array<[string, (mode: HclCalculationType) => Promise<unknown>, object]> = [
  ["SY FT", (mode) => runSyHclFaultTree("sy", "hcl", 2, ft, mode, "scenario"), { faultTreeTopGate: ft, evidenceScenarioId: "scenario" }],
  ["SY FT batch", (mode) => runSyHclFaultTreeBatch("sy", "hcl", 2, ft, mode, ["scenario"], true), { faultTreeTopGate: ft, evidenceScenarioIds: ["scenario"], integrateHazardGrid: true }],
  ["ESQ FT", (mode) => runEsqHclFaultTree("esq", "hcl", 2, ft, mode), { faultTreeTopGate: ft }],
  ["ESQ FT batch", (mode) => runEsqHclFaultTreeBatch("esq", "hcl", 2, ft, mode, ["scenario"], false), { faultTreeTopGate: ft, evidenceScenarioIds: ["scenario"] }],
  ["ESQ ET", (mode) => runEsqHclEventTree("esq", "hcl", 2, et, mode, dependency), { eventTree: et, dependencyConfiguration: dependency }],
  ["ESQ ET batch", (mode) => runEsqHclEventTreeBatch("esq", "hcl", 2, et, mode, ["scenario"], false, dependency), { eventTree: et, evidenceScenarioIds: ["scenario"], dependencyConfiguration: dependency }],
];

for (const mode of ["PROBABILITY", "UNCERTAINTY"] as const) {
  it.each(cases)(`%s transports ${mode} with the target and evidence`, async (_name, execute, target) => {
    jest.mocked(postJson).mockClear();
    await execute(mode);
    expect(postJson).toHaveBeenCalledTimes(1);
    expect(postJson).toHaveBeenCalledWith(expect.any(String), {
      schemaVersion: "1.0.0", modelId: "hcl", workbookRevision: 2, calculationType: mode, ...target,
    });
  });
}

const batchInput = { evidenceScenarios: [{ id: "uploaded", code: "UP", name: "Uploaded", enabled: true,
  evidence: { observations: [{ nodeId: "node", stateId: "state" }] } }] };
it.each([
  ["SY FT", () => runSyHclFaultTreeBatch("sy", "hcl", 2, ft, "PROBABILITY", ["uploaded"], false, batchInput)],
  ["ESQ FT", () => runEsqHclFaultTreeBatch("esq", "hcl", 2, ft, "PROBABILITY", ["uploaded"], false, batchInput)],
  ["ESQ ET", () => runEsqHclEventTreeBatch("esq", "hcl", 2, et, "PROBABILITY", ["uploaded"], false, dependency, batchInput)],
] as const)("%s sends temporary scenario contents", async (_name, execute) => {
  jest.mocked(postJson).mockClear();
  await execute();
  expect(postJson).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ batchInput, evidenceScenarioIds: ["uploaded"] }));
});
