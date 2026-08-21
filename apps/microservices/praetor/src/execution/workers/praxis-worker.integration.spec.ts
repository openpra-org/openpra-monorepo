import { resolve } from "node:path";
import { threadId } from "node:worker_threads";

import { runPraxisWithWorker } from "./praxis-worker-runner";

const addonPath = resolve(__dirname, "../../../../../solvers/praxis-node/index.js");
const workerPath = resolve(__dirname, "praxis.worker.js");
const requestJson = JSON.stringify({
  schemaVersion: "1.0.0",
  request: {
    schemaVersion: "1.0.0",
    methodType: "FAULT_TREE",
    modelId: "00000000-0000-4000-8000-000000000002",
    revision: 3,
    requestedBy: "analyst",
  },
  modelSnapshots: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      projectId: "project-1",
      methodType: "FAULT_TREE",
      revision: 3,
      topGate: { gateId: "00000000-0000-4000-8000-000000000001" },
      gates: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          kind: "GATE",
          gateType: "AND",
          code: "TOP",
          name: "Top",
          description: "",
        },
      ],
      leafNodes: [
        { id: "ref-a", kind: "BASIC_EVENT_REFERENCE", basicEventId: "A" },
        { id: "ref-b", kind: "BASIC_EVENT_REFERENCE", basicEventId: "B" },
      ],
      gateInputs: [
        { id: "input-a", gateId: "00000000-0000-4000-8000-000000000001", childId: "ref-a", order: 0 },
        { id: "input-b", gateId: "00000000-0000-4000-8000-000000000001", childId: "ref-b", order: 1 },
      ],
    },
  ],
  resources: {
    faultTreeBasicEventCatalogue: {
      projectId: "project-1",
      basicEvents: [
        { id: "A", probability: { value: 0.1 } },
        { id: "B", probability: { value: 0.2 } },
      ],
    },
  },
});

describe("PRAXIS native worker integration", () => {
  it.each([
    ["validate", "FAULT_TREE"],
    ["execute", "FAULT_TREE"],
  ] as const)("runs %s through the native addon outside the calling thread", async (operation, expectedScope) => {
    const response = await runPraxisWithWorker({ operation, requestJson }, { addonPath, workerPath });
    const result = JSON.parse(response.resultJson) as Record<string, Record<string, unknown>>;

    expect(response.workerThreadId).toBeGreaterThan(0);
    expect(response.workerThreadId).not.toBe(threadId);
    expect(operation === "validate" ? result.result.scope : result.result.methodType).toBe(expectedScope);
    if (operation === "execute") {
      expect(result.result.topEventProbability).toBeCloseTo(0.02, 12);
      expect(result.result.minimalCutSetCount).toBe(1);
    }
  });
});
