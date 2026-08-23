import { EndState } from "interfaces-mef-types/core/events";
import type { EventTree } from "interfaces-mef-types/es/event-sequence-analysis";
import {
  applyEventTreeOperation,
  createEventTreePresentation,
  validateEventTree,
} from "../eventTreeOperations";

const reference = {
  workbookId: "sy-workbook",
  modelId: "fault-tree",
  entityId: "top-gate",
  referenceType: "FAULT_TREE_TOP_EVENT" as const,
};

function emptyTree(): EventTree {
  return {
    uuid: "ET-1",
    name: "Test event tree",
    initiatingEventId: "IE-1",
    initiatingEventFrequency: { value: 0.01 },
    functionalEvents: {},
    sequences: {},
    branches: {},
    initialState: { branchId: "" },
    implementsSrs: [],
  };
}

describe("canonical event-tree operations", () => {
  it("generates complete success and failure paths as ordered functional events are added", () => {
    const first = applyEventTreeOperation(emptyTree(), {
      kind: "ADD_FUNCTIONAL_EVENT",
      functionalEvent: { uuid: "FE-1", name: "First", order: 0, faultTreeTopEvent: reference },
    });
    expect(Object.values(first.sequences)).toHaveLength(2);
    expect(Object.values(first.sequences).map((sequence) => sequence.functionalEventStates)).toEqual([
      { "FE-1": "SUCCESS" },
      { "FE-1": "FAILURE" },
    ]);
    expect(Object.keys(first.sequences).every((id) => /^[0-9a-f-]{36}$/i.test(id))).toBe(true);
    expect(applyEventTreeOperation(emptyTree(), {
      kind: "ADD_FUNCTIONAL_EVENT",
      functionalEvent: { uuid: "FE-1", name: "First", order: 0, faultTreeTopEvent: reference },
    })).toEqual(first);

    const second = applyEventTreeOperation(first, {
      kind: "ADD_FUNCTIONAL_EVENT",
      functionalEvent: { uuid: "FE-2", name: "Second", order: 1, faultTreeTopEvent: reference },
    });
    expect(Object.values(second.sequences)).toHaveLength(4);
    expect(Object.values(second.branches)).toHaveLength(3);
    expect(validateEventTree(second, [second.uuid])).toEqual([]);
  });

  it("preserves matching sequence identities and results when topology is regenerated", () => {
    const first = applyEventTreeOperation(emptyTree(), {
      kind: "ADD_FUNCTIONAL_EVENT",
      functionalEvent: { uuid: "FE-1", name: "First", order: 0, faultTreeTopEvent: reference },
    });
    const failed = Object.values(first.sequences).find((sequence) => sequence.functionalEventStates?.["FE-1"] === "FAILURE")!;
    const withRelease = applyEventTreeOperation(first, {
      kind: "SET_SEQUENCE_END_STATE",
      sequenceId: failed.uuid,
      endState: "RADIONUCLIDE_RELEASE",
    });
    const regenerated = applyEventTreeOperation(withRelease, {
      kind: "ADD_FUNCTIONAL_EVENT",
      functionalEvent: { uuid: "FE-2", name: "Second", order: 1, faultTreeTopEvent: reference },
    });
    const preserved = Object.values(regenerated.sequences).filter((sequence) =>
      sequence.functionalEventStates?.["FE-1"] === "FAILURE" &&
      sequence.endState === EndState.RADIONUCLIDE_RELEASE,
    );
    expect(preserved).toHaveLength(2);
  });

  it("stores a transfer on its terminal sequence and reports missing targets", () => {
    const tree = applyEventTreeOperation(emptyTree(), {
      kind: "ADD_FUNCTIONAL_EVENT",
      functionalEvent: { uuid: "FE-1", name: "First", order: 0, faultTreeTopEvent: reference },
    });
    const sequenceId = Object.keys(tree.sequences)[0]!;
    const transferred = applyEventTreeOperation(tree, {
      kind: "SET_SEQUENCE_TRANSFER",
      sequenceId,
      targetEventTreeId: "ET-2",
      targetSequenceId: "ET-2-SEQ-1",
    });
    expect(transferred.transfers?.[sequenceId]).toEqual({ targetEventTreeId: "ET-2", targetSequenceId: "ET-2-SEQ-1" });
    expect(transferred.sequences[sequenceId]?.endState).toBeUndefined();
    expect(validateEventTree(transferred, ["ET-1"])).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ET_TRANSFER_MISSING", entityId: sequenceId }),
    ]));
    const target = { ...emptyTree(), uuid: "ET-2", transfers: {
      "target-sequence": { targetEventTreeId: transferred.uuid },
    } };
    expect(validateEventTree(transferred, [transferred, target])).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ET_TRANSFER_SEQUENCE_MISSING", entityId: sequenceId }),
      expect.objectContaining({ code: "ET_TRANSFER_LOOP", entityId: sequenceId }),
    ]));
    expect(createEventTreePresentation(transferred, []).sequences.find((sequence) => sequence.id === sequenceId)?.transferTargetId).toBe("ET-2");
  });

  it("identifies incomplete imported branches and missing typed fault-tree links", () => {
    const invalid: EventTree = {
      ...emptyTree(),
      functionalEvents: { "FE-1": { uuid: "FE-1", name: "First", order: 0 } },
      sequences: {
        "SEQ-1": { uuid: "SEQ-1", name: "One", endState: EndState.SUCCESSFUL_MITIGATION },
      },
      branches: {
        "B-1": {
          uuid: "B-1",
          name: "First",
          functionalEventId: "FE-1",
          paths: [{ state: "SUCCESS", target: "SEQ-1", targetType: "SEQUENCE" }],
        },
      },
      initialState: { branchId: "B-1" },
    };
    expect(validateEventTree(invalid, [invalid.uuid]).map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "ET_FT_LINK_REQUIRED",
      "ET_BRANCH_INCOMPLETE",
    ]));
  });
});
