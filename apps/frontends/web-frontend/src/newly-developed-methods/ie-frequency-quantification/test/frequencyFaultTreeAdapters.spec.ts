import { type FrequencyFaultTreeNode } from "interfaces-mef-types/ie/initiating-event-analysis";
import { FrequencyFaultTreeNodeSchema } from "interfaces-mef-types/zod/ie/initiating-event-analysis";
import {
  editorToFrequencyFaultTree,
  frequencyFaultTreeToEditor,
} from "../ieFrequencyQuantificationEditor";

describe("IE frequency canonical fault-tree conversion", () => {
  it("round-trips every legacy node type, gate type, K value, order, and detail", () => {
    const nodes: FrequencyFaultTreeNode[] = [
      {
        id: "TOP",
        label: "Top event",
        nodeType: "GATE",
        gate: "ATLEAST",
        k: 2,
        detail: "Voting basis",
      },
      {
        id: "AND-1",
        parentId: "TOP",
        label: "Support failures",
        nodeType: "GATE",
        gate: "AND",
      },
      {
        id: "BE-1",
        parentId: "AND-1",
        label: "Pump fails",
        nodeType: "BASIC",
        detail: "Pump failure detail",
      },
      { id: "HE-1", parentId: "TOP", label: "Outage", nodeType: "HOUSE" },
      {
        id: "TR-1",
        parentId: "TOP",
        label: "Transferred logic",
        nodeType: "TRANSFER",
        detail: "Legacy transfer detail",
      },
      {
        id: "UE-1",
        parentId: "TOP",
        label: "Unresolved cause",
        nodeType: "UNDEVELOPED",
      },
    ];

    const snapshot = frequencyFaultTreeToEditor("DS-1", "Frequency source", nodes);
    const roundTripped = editorToFrequencyFaultTree(
      snapshot.model,
      snapshot.catalogue,
      nodes,
    );

    expect(roundTripped).toEqual(nodes);
    expect(snapshot.model.gates[0]).toMatchObject({ gateType: "K_OF_N", k: 2 });
    expect(snapshot.model.leafNodes.map(({ kind }) => kind)).toEqual([
      "BASIC_EVENT_REFERENCE",
      "HOUSE_EVENT",
      "TRANSFER_REFERENCE",
      "UNDEVELOPED_EVENT",
    ]);
  });

  it("serializes canonical basic-event edits back into the IE fault-tree field", () => {
    const nodes: FrequencyFaultTreeNode[] = [
      { id: "TOP", label: "Top", nodeType: "GATE", gate: "OR" },
      { id: "BE-1", parentId: "TOP", label: "Old name", nodeType: "BASIC" },
    ];
    const snapshot = frequencyFaultTreeToEditor("DS-1", "Source", nodes);
    const event = snapshot.catalogue.basicEvents[0];
    const editedCatalogue = {
      ...snapshot.catalogue,
      basicEvents: [{
        ...event,
        name: "New name",
        description: "New detail",
        probability: { value: 0.125 },
      }],
    };

    expect(
      editorToFrequencyFaultTree(snapshot.model, editedCatalogue, nodes)[1],
    ).toEqual({
      id: "BE-1",
      parentId: "TOP",
      label: "New name",
      nodeType: "BASIC",
      detail: "New detail",
      probability: 0.125,
    });
  });

  it("round-trips probability, house state, transfer targets, and every DAG input", () => {
    const nodes: FrequencyFaultTreeNode[] = [
      {
        id: "TOP",
        label: "Top event",
        code: "TOP-EVENT",
        nodeType: "GATE",
        gate: "OR",
        isTopGate: true,
      },
      {
        id: "SECOND",
        parentId: "TOP",
        parentLinks: [{ inputId: "INPUT-SECOND", gateId: "TOP", order: 0 }],
        label: "Second parent",
        nodeType: "GATE",
        gate: "AND",
      },
      {
        id: "BE-REF",
        parentId: "TOP",
        parentLinks: [
          { inputId: "INPUT-BE-TOP", gateId: "TOP", order: 1 },
          { inputId: "INPUT-BE-SECOND", gateId: "SECOND", order: 0 },
        ],
        label: "Shared pump failure",
        nodeType: "BASIC",
        basicEventId: "SHARED-BASIC-EVENT",
        basicEventCode: "PUMP-FAIL",
        probability: 0.004,
      },
      {
        id: "HOUSE",
        parentId: "TOP",
        parentLinks: [{ inputId: "INPUT-HOUSE", gateId: "TOP", order: 2 }],
        label: "Maintenance alignment",
        nodeType: "HOUSE",
        houseState: true,
      },
      {
        id: "TRANSFER",
        parentId: "TOP",
        parentLinks: [{ inputId: "INPUT-TRANSFER", gateId: "TOP", order: 3 }],
        label: "Transferred train logic",
        nodeType: "TRANSFER",
        transferTarget: { modelId: "TARGET-MODEL", entityId: "TARGET-GATE" },
      },
    ];

    const snapshot = frequencyFaultTreeToEditor("DS-1", "Frequency source", nodes);
    expect(snapshot.model.gateInputs.filter(({ childId }) => childId === "BE-REF")).toEqual([
      { id: "INPUT-BE-TOP", gateId: "TOP", childId: "BE-REF", order: 1 },
      { id: "INPUT-BE-SECOND", gateId: "SECOND", childId: "BE-REF", order: 0 },
    ]);
    expect(snapshot.catalogue.basicEvents).toContainEqual(expect.objectContaining({
      id: "SHARED-BASIC-EVENT",
      code: "PUMP-FAIL",
      probability: { value: 0.004 },
    }));
    expect(snapshot.model.leafNodes).toContainEqual(expect.objectContaining({
      id: "HOUSE",
      kind: "HOUSE_EVENT",
      state: true,
    }));
    expect(snapshot.model.leafNodes).toContainEqual(expect.objectContaining({
      id: "TRANSFER",
      kind: "TRANSFER_REFERENCE",
      target: { modelId: "TARGET-MODEL", entityId: "TARGET-GATE" },
    }));

    expect(editorToFrequencyFaultTree(snapshot.model, snapshot.catalogue, nodes)).toEqual(nodes);
    expect(nodes.every((node) => FrequencyFaultTreeNodeSchema.safeParse(node).success)).toBe(true);
  });

  it("persists a newly shared child under multiple parent gates", () => {
    const nodes: FrequencyFaultTreeNode[] = [
      { id: "TOP", label: "Top", nodeType: "GATE", gate: "OR" },
      { id: "ALT", label: "Alternate parent", nodeType: "GATE", gate: "AND" },
      { id: "BE-1", parentId: "TOP", label: "Shared event", nodeType: "BASIC" },
    ];
    const snapshot = frequencyFaultTreeToEditor("DS-1", "Source", nodes);
    const editedModel = {
      ...snapshot.model,
      gateInputs: [
        ...snapshot.model.gateInputs,
        { id: "SECOND-INBOUND-LINK", gateId: "ALT", childId: "BE-1", order: 0 },
      ],
    };

    const persisted = editorToFrequencyFaultTree(editedModel, snapshot.catalogue, nodes);
    expect(persisted.find(({ id }) => id === "BE-1")).toMatchObject({
      parentId: "TOP",
      parentLinks: [
        { inputId: "IE-FQ-IN:2", gateId: "TOP", order: 0 },
        { inputId: "SECOND-INBOUND-LINK", gateId: "ALT", order: 0 },
      ],
    });

    const restored = frequencyFaultTreeToEditor("DS-1", "Source", persisted);
    expect(restored.model.gateInputs.filter(({ childId }) => childId === "BE-1")).toEqual(
      editedModel.gateInputs.filter(({ childId }) => childId === "BE-1"),
    );
  });

  it("persists a newly-created catalogue event without inventing a leaf reference", () => {
    const nodes: FrequencyFaultTreeNode[] = [
      { id: "TOP", label: "Top", nodeType: "GATE", gate: "OR" },
    ];
    const snapshot = frequencyFaultTreeToEditor("DS-1", "Source", nodes);
    const next = editorToFrequencyFaultTree(
      snapshot.model,
      {
        basicEvents: [{
          id: "NEW-BE",
          code: "BE-1",
          name: "New event",
          description: "Awaiting a parent",
          probability: { value: 0 },
        }],
      },
      nodes,
    );

    expect(next[1]).toEqual({
      id: "NEW-BE",
      label: "New event",
      nodeType: "BASIC",
      catalogueOnly: true,
      basicEventId: "NEW-BE",
      basicEventCode: "BE-1",
      detail: "Awaiting a parent",
    });

    const restored = frequencyFaultTreeToEditor("DS-1", "Source", next);
    expect(restored.catalogue.basicEvents).toHaveLength(1);
    expect(restored.model.leafNodes).toHaveLength(0);
  });

  it("rejects out-of-range stored basic-event probabilities", () => {
    expect(FrequencyFaultTreeNodeSchema.safeParse({
      id: "BE-1",
      label: "Invalid event",
      nodeType: "BASIC",
      probability: 1.1,
    }).success).toBe(false);
  });
});
