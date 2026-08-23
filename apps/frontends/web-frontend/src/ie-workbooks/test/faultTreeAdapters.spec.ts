import { type MasterLogicDiagram } from "interfaces-mef-types/cross-cutting/methods/master-logic-diagram";
import { type HeatBalanceFaultTree } from "interfaces-mef-types/cross-cutting/methods/heat-balance-fault-tree";
import { hbftToFaultTree, mldToFaultTree } from "../faultTreeAdapters";

describe("IE canonical fault-tree adapters", () => {
  it("normalizes an MLD and retains initiator traceability in presentation metadata", () => {
    const mld: MasterLogicDiagram = {
      uuid: "MLD-1",
      name: "Master logic diagram",
      description: "Top-down search",
      methodKind: "MASTER_LOGIC_DIAGRAM",
      analyst: "Analyst",
      supportingDocuments: [],
      radioactiveSourceIds: [],
      plantOperatingStateIds: [],
      radionuclideBarrierIds: [],
      safetyFunctionIds: [],
      systemIds: [],
      identifiedInitiatorIds: ["IE-01"],
      nodes: [
        { id: "TOP", description: "Release", derivedInitiatorIds: [] },
        {
          id: "BRANCH",
          parentId: "TOP",
          description: "Barrier challenge",
          derivedInitiatorIds: [],
        },
        {
          id: "EVENT",
          parentId: "BRANCH",
          description: "Loss of support: detailed basis",
          derivedInitiatorIds: ["IE-01"],
        },
      ],
    };

    const snapshot = mldToFaultTree(mld);

    expect(snapshot.model.topGate).toEqual({ gateId: "TOP" });
    expect(snapshot.model.gates.map(({ id }) => id)).toEqual(["TOP", "BRANCH"]);
    expect(snapshot.model.gateInputs).toHaveLength(2);
    expect(snapshot.model.layout.direction).toBe("TOP_TO_BOTTOM");
    expect(snapshot.catalogue.basicEvents[0]).toMatchObject({
      code: "EVENT",
      name: "Loss of support",
      description: expect.stringContaining("Derived initiators: IE-01"),
    });
    expect(snapshot.catalogue.presentations?.[0]?.failureModeShort).toBe("IE-01");
  });

  it("normalizes HBFT causes and their probabilities beneath a shared top gate", () => {
    const tree: HeatBalanceFaultTree = {
      uuid: "HBFT-1",
      name: "HBFT-1: Loss of heat removal",
      methodKind: "HEAT_BALANCE_FAULT_TREE",
      analyst: "Analyst",
      supportingDocuments: [],
      plantOperatingStateIds: [],
      systemIds: [],
      interfaces: [],
      imbalances: [{
        id: "IM-1",
        description: "Removal below generation",
        threshold: 0,
        consequences: [],
      }],
      causes: [{ id: "CAUSE-1", description: "Pump trip", probability: 0.02 }],
      identifiedInitiatorIds: ["IE-02"],
    };

    const snapshot = hbftToFaultTree([tree]);

    expect(snapshot.model.topGate).toEqual({ gateId: "IE-HBFT-ROOT" });
    expect(snapshot.model.gates).toHaveLength(2);
    expect(snapshot.model.leafNodes).toHaveLength(1);
    expect(snapshot.model.layout.direction).toBe("TOP_TO_BOTTOM");
    expect(snapshot.catalogue.basicEvents[0]).toMatchObject({
      code: "CAUSE-1",
      name: "Pump trip",
      probability: { value: 0.02 },
    });
  });
});
