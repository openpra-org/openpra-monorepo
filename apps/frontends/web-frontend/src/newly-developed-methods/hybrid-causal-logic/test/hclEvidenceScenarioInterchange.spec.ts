import type { HclEvidenceScenario } from "interfaces-mef-types/modeling";
import { TEST_ID, testBayesianNetworkModel } from "../../bayesian-network/test/bayesianNetworkTestModel";
import {
  exportHclEvidenceScenariosCsv,
  exportHclEvidenceScenariosJson,
  importHclEvidenceScenariosCsv,
  importHclEvidenceScenariosJson,
  mergeHclEvidenceScenarios,
} from "../hclEvidenceScenarioInterchange";

const scenario: HclEvidenceScenario = {
  id: "30000000-0000-4000-8000-000000000001",
  code: "HIGH-DEMAND",
  name: "High demand, flooded",
  enabled: true,
  evidence: {
    observations: [
      { nodeId: TEST_ID.a, stateId: TEST_ID.aTrue },
      { nodeId: TEST_ID.b, stateId: TEST_ID.bFalse },
    ],
  },
};

describe("HCL evidence-scenario interchange", () => {
  it("exports readable node and state codes and imports them back to stable model ids", () => {
    const model = testBayesianNetworkModel();
    const text = exportHclEvidenceScenariosJson([scenario], model);
    expect(JSON.parse(text)).toEqual({
      schemaVersion: "1.0.0",
      scenarios: [{
        code: "HIGH-DEMAND",
        name: "High demand, flooded",
        enabled: true,
        evidence: { A: "TRUE", B: "FALSE" },
      }],
    });
    expect(importHclEvidenceScenariosJson(text, model)).toEqual([
      expect.objectContaining({
        code: scenario.code,
        name: scenario.name,
        enabled: true,
        evidence: scenario.evidence,
      }),
    ]);
  });

  it("round-trips quoted CSV fields and accepts evidence_json as an import alias", () => {
    const model = testBayesianNetworkModel();
    const text = exportHclEvidenceScenariosCsv([scenario], model);
    expect(text).toContain('"High demand, flooded"');
    expect(importHclEvidenceScenariosCsv(text, model)[0]).toEqual(expect.objectContaining({
      code: scenario.code,
      name: scenario.name,
      evidence: scenario.evidence,
    }));
    expect(importHclEvidenceScenariosCsv(
      'code,name,enabled,evidence_json\r\nLOW,"Low, dry",yes,"{""A"":""FALSE""}"\r\n',
      model,
    )[0]).toEqual(expect.objectContaining({
      code: "LOW",
      evidence: { observations: [{ nodeId: TEST_ID.a, stateId: TEST_ID.aFalse }] },
    }));
  });

  it("rejects unknown model codes before a scenario can be saved", () => {
    const model = testBayesianNetworkModel();
    expect(() => importHclEvidenceScenariosJson(
      JSON.stringify({ scenarios: [{ code: "BAD", evidence: { MISSING: "TRUE" } }] }),
      model,
    )).toThrow("unknown node 'MISSING'");
    expect(() => importHclEvidenceScenariosJson(
      JSON.stringify({ scenarios: [{ code: "BAD", evidence: { A: "MISSING" } }] }),
      model,
    )).toThrow("unknown state 'MISSING'");
  });

  it("replaces matching scenario codes while preserving their stable ids", () => {
    const imported = { ...scenario, id: "30000000-0000-4000-8000-000000000002", name: "Updated" };
    expect(mergeHclEvidenceScenarios([scenario], [imported])).toEqual([
      { ...imported, id: scenario.id },
    ]);
  });
});
