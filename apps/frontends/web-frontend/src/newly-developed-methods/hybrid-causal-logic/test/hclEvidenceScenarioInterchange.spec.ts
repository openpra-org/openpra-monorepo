import type { HclEvidenceScenario } from "interfaces-mef-types/modeling";
import { addNode } from "../../bayesian-network/bayesianNetworkOperations";
import { TEST_ID, testBayesianNetworkModel } from "../../bayesian-network/test/bayesianNetworkTestModel";
import {
  createEvidenceScenarioSamples,
  downloadText,
  exportHclEvidenceScenariosCsv,
  exportHclEvidenceScenariosJson,
  importHclEvidenceScenariosCsv,
  importHclEvidenceScenariosJson,
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

  it("builds two sample scenarios over the first three nodes and none for a network without nodes", () => {
    const model = testBayesianNetworkModel();
    const samples = createEvidenceScenarioSamples(model);
    expect(samples).toEqual([
      {
        id: expect.any(String),
        code: "SAMPLE-01",
        name: "Sample evidence 1",
        enabled: true,
        evidence: { observations: [{ nodeId: TEST_ID.a, stateId: TEST_ID.aFalse }, { nodeId: TEST_ID.b, stateId: TEST_ID.bFalse }] },
      },
      {
        id: expect.any(String),
        code: "SAMPLE-02",
        name: "Sample evidence 2",
        enabled: true,
        evidence: { observations: [{ nodeId: TEST_ID.a, stateId: TEST_ID.aTrue }, { nodeId: TEST_ID.b, stateId: TEST_ID.bTrue }] },
      },
    ]);
    expect(samples[0]?.id).not.toBe(samples[1]?.id);
    expect(importHclEvidenceScenariosJson(exportHclEvidenceScenariosJson(samples, model), model).map((sample) => sample.evidence)).toEqual(samples.map((sample) => sample.evidence));
    const larger = addNode(addNode(model).model).model;
    expect(createEvidenceScenarioSamples(larger).map((sample) => sample.evidence.observations.map((observation) => observation.nodeId))).toEqual([
      larger.nodes.slice(0, 3).map((node) => node.id),
      larger.nodes.slice(0, 3).map((node) => node.id),
    ]);
    expect(createEvidenceScenarioSamples({ ...model, nodes: [] })).toEqual([]);
  });

  it("hands a text to the browser as a named file and releases it", () => {
    const blobs: Blob[] = [];
    const released: string[] = [];
    const links: { href: string; download: string }[] = [];
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: (blob: Blob) => { blobs.push(blob); return "blob:evidence"; } });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: (url: string) => { released.push(url); } });
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function record(this: HTMLAnchorElement) {
      links.push({ href: this.href, download: this.download });
    });
    downloadText("BN-TEST-evidence-sample.csv", "code,evidence\r\n", "text/csv");
    click.mockRestore();
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
    expect(links).toEqual([{ href: "blob:evidence", download: "BN-TEST-evidence-sample.csv" }]);
    expect(blobs.map((blob) => [blob.type, blob.size])).toEqual([["text/csv", 15]]);
    expect(released).toEqual(["blob:evidence"]);
  });

});
