import { WorkbookFaultTreeSchema } from "interfaces-mef-types/zod/modeling/workbook-models";
import { stripNulls } from "../mef-normalize";

describe("stripNulls", () => {
  it("keeps a cleared fault-tree top gate and drops other nulls", () => {
    expect(stripNulls({ systemLogicModels: [{ code: "FT-1", topGate: null, description: null }] }))
      .toEqual({ systemLogicModels: [{ code: "FT-1", topGate: null }] });
  });

  it("lets a workbook fault tree without a top gate pass its schema", () => {
    const tree = {
      modelId: "7f0c3f2e-4b8a-4c1d-9e6f-2a5b8c9d0e1f",
      code: "FT-1",
      name: "Fault tree",
      description: "",
      topGate: null,
      gates: [{
        id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
        code: "G-1",
        name: "Gate",
        description: "",
        kind: "GATE",
        gateType: "OR",
      }],
      leafNodes: [],
      gateInputs: [],
      nodePositions: [],
      layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
    };
    expect(WorkbookFaultTreeSchema.parse(stripNulls(tree))).toEqual(tree);
  });
});
