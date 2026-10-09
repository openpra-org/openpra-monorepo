import { EndState } from "interfaces-mef-types/core/events";
import type { EventTree } from "interfaces-mef-types/es/event-sequence-analysis";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import {
  applyEventTreeOperation,
  createEmptyEventTree,
  createEventTreePresentation,
  frequencyRateUnits,
  initiatingFrequencyUnit,
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
    initiatingEventFrequency: { expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 0.01 } } } },
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
    });
    expect(transferred.transfers?.[sequenceId]).toEqual({ targetEventTreeId: "ET-2" });
    expect(transferred.sequences[sequenceId]?.endState).toBeUndefined();
    expect(validateEventTree(transferred, ["ET-1"])).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ET_TRANSFER_MISSING", entityId: sequenceId }),
    ]));
    const target = { ...emptyTree(), uuid: "ET-2", transfers: {
      "target-sequence": { targetEventTreeId: transferred.uuid },
    } };
    expect(validateEventTree(transferred, [transferred, target])).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ET_TRANSFER_LOOP", entityId: sequenceId }),
    ]));
    expect(createEventTreePresentation(transferred, []).sequences.find((sequence) => sequence.id === sequenceId)?.transferTargetId).toBe("ET-2");
  });

  it("identifies empty imported branches and missing typed fault-tree links", () => {
    const invalid: EventTree = {
      ...emptyTree(),
      functionalEvents: { "FE-1": { uuid: "FE-1", name: "First", order: 0 } },
      sequences: {
        "SEQ-1": { uuid: "SEQ-1", name: "One", endState: EndState.SUCCESSFUL_MITIGATION,
          functionalEventStates: { "FE-1": "SUCCESS" } },
      },
      branches: {
        "B-1": {
          uuid: "B-1",
          name: "First",
          functionalEventId: "FE-1",
          paths: [],
        },
      },
      initialState: { branchId: "B-1" },
    };
    expect(validateEventTree(invalid, [invalid.uuid]).map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "ET_FT_LINK_REQUIRED",
      "ET_BRANCH_INCOMPLETE",
    ]));
  });

  it.each(["SUCCESS", "FAILURE"] as const)("preserves a single %s outcome through validation, presentation and editing", (outcome) => {
    const model: EventTree = {
      ...emptyTree(),
      functionalEvents: { "FE-1": { uuid: "FE-1", name: "First", order: 0, faultTreeTopEvent: reference } },
      sequences: { "SEQ-1": { uuid: "SEQ-1", name: "Only path", endState: EndState.SUCCESSFUL_MITIGATION } },
      branches: { "B-1": { uuid: "B-1", name: "First", functionalEventId: "FE-1",
        paths: [{ state: outcome, target: "SEQ-1", targetType: "SEQUENCE" }] } },
      initialState: { branchId: "B-1" },
    };
    expect(validateEventTree(model, [model])).toEqual([]);
    expect(createEventTreePresentation(model, []).sequences[0]?.path["FE-1"]).toBe(outcome);
    const expanded = applyEventTreeOperation(model, {
      kind: "ADD_FUNCTIONAL_EVENT",
      functionalEvent: { uuid: "FE-2", name: "Second", order: 1, faultTreeTopEvent: reference },
    });
    expect(Object.values(expanded.sequences)).toHaveLength(2);
    expect(Object.values(expanded.sequences).every((s) => s.functionalEventStates?.["FE-1"] === outcome)).toBe(true);
    expect(validateEventTree(expanded, [expanded])).toEqual([]);
    const duplicated = JSON.parse(JSON.stringify(model)) as EventTree;
    duplicated.branches["B-1"]!.paths.push({ ...duplicated.branches["B-1"]!.paths[0]! });
    expect(validateEventTree(duplicated, [duplicated])).toContainEqual(expect.objectContaining({ code: "ET_BRANCH_PATH_DUPLICATE" }));
    const mixed = JSON.parse(JSON.stringify(model)) as EventTree;
    mixed.branches["B-1"]!.paths.push({ state: "BYPASSED", target: "SEQ-1", targetType: "SEQUENCE" });
    expect(validateEventTree(mixed, [mixed])).toContainEqual(expect.objectContaining({ code: "ET_BRANCH_BYPASS_INVALID" }));
  });

  it("keeps bypassed functional events distinct from failures across presentation and structural edits", () => {
    const bypassed: EventTree = {
      ...emptyTree(),
      functionalEvents: {
        "FE-1": { uuid: "FE-1", name: "First", order: 0 },
      },
      sequences: {
        "SEQ-B": {
          uuid: "SEQ-B",
          name: "Bypassed path",
          endState: EndState.SUCCESSFUL_MITIGATION,
          functionalEventStates: { "FE-1": "BYPASSED" },
        },
      },
      branches: {
        "BRANCH-B": {
          uuid: "BRANCH-B",
          name: "First",
          functionalEventId: "FE-1",
          paths: [{ state: "BYPASSED", target: "SEQ-B", targetType: "SEQUENCE" }],
        },
      },
      initialState: { branchId: "BRANCH-B" },
    };

    expect(validateEventTree(bypassed, [bypassed])).toEqual([]);
    expect(createEventTreePresentation(bypassed, []).sequences[0]?.path["FE-1"]).toBe("BYPASSED");

    const expanded = applyEventTreeOperation(bypassed, {
      kind: "ADD_FUNCTIONAL_EVENT",
      functionalEvent: { uuid: "FE-2", name: "Second", order: 1, faultTreeTopEvent: reference },
    });
    expect(Object.values(expanded.sequences)).toHaveLength(2);
    expect(Object.values(expanded.sequences).every((sequence) => sequence.functionalEventStates?.["FE-1"] === "BYPASSED")).toBe(true);
    expect(new Set(Object.values(expanded.sequences).map((sequence) => sequence.functionalEventStates?.["FE-2"]))).toEqual(new Set(["SUCCESS", "FAILURE"]));

    const restored = applyEventTreeOperation(bypassed, {
      kind: "SET_FUNCTIONAL_EVENT_BYPASS",
      sequenceId: "SEQ-B",
      functionalEventId: "FE-1",
      bypassed: false,
    });
    expect(Object.values(restored.sequences)).toHaveLength(2);
    expect(new Set(Object.values(restored.sequences).map((sequence) => sequence.functionalEventStates?.["FE-1"]))).toEqual(new Set(["SUCCESS", "FAILURE"]));

    const rebypassed = applyEventTreeOperation(restored, {
      kind: "SET_FUNCTIONAL_EVENT_BYPASS",
      sequenceId: Object.values(restored.sequences).find((sequence) => sequence.functionalEventStates?.["FE-1"] === "SUCCESS")!.uuid,
      functionalEventId: "FE-1",
      bypassed: true,
    });
    expect(Object.values(rebypassed.sequences)).toHaveLength(1);
    expect(Object.values(rebypassed.sequences)[0]?.functionalEventStates?.["FE-1"]).toBe("BYPASSED");
  });

  it("inserts and reorders functional events without changing unaffected sequence identities", () => {
    const first = applyEventTreeOperation(emptyTree(), {
      kind: "ADD_FUNCTIONAL_EVENT",
      functionalEvent: { uuid: "FE-1", name: "First", order: 0, faultTreeTopEvent: reference },
    });
    const second = applyEventTreeOperation(first, {
      kind: "ADD_FUNCTIONAL_EVENT",
      functionalEvent: { uuid: "FE-2", name: "Second", order: 1, faultTreeTopEvent: reference },
    });
    const beforeIds = Object.keys(second.sequences).sort();
    const reordered = applyEventTreeOperation(second, {
      kind: "REORDER_FUNCTIONAL_EVENT",
      functionalEventId: "FE-2",
      targetIndex: 0,
    });

    expect(Object.values(reordered.functionalEvents).sort((left, right) => (left.order ?? 0) - (right.order ?? 0)).map((event) => event.uuid)).toEqual(["FE-2", "FE-1"]);
    expect(Object.keys(reordered.sequences).sort()).toEqual(beforeIds);
  });
});

describe("initiating-event frequency", () => {
  const frequencyFindings = (expression: UncertainExpression | undefined): string[] => validateEventTree(
    { ...emptyTree(), initiatingEventFrequency: expression === undefined ? undefined : { expression } },
    [],
  ).map((finding) => finding.code).filter((code) => code.startsWith("ET_FREQUENCY"));

  it("builds a per-year point expression when a tree is created from a number", () => {
    expect(createEmptyEventTree("IE-1", undefined, 2e-3).initiatingEventFrequency).toEqual({
      expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 2e-3 } } },
      annualization: { basis: "PLANT_YEAR", hoursPerYear: 8_760 },
    });
    expect(createEmptyEventTree("IE-1").initiatingEventFrequency).toBeUndefined();
  });

  it("accepts typed, uncertain and linked frequencies and carries them to the presentation", () => {
    const perHour: UncertainExpression = { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "LOGNORMAL", mean: 2e-5, errorFactor: 3, level: 0.95 } } };
    const linked: UncertainExpression = { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-workbook", entityId: "IE-FREQ-1" } };
    expect(frequencyFindings(perHour)).toEqual([]);
    expect(frequencyFindings(linked)).toEqual([]);
    expect(initiatingFrequencyUnit(perHour)).toBe("PER_HOUR");
    expect(initiatingFrequencyUnit(linked)).toBe("PER_YEAR");
    const table = new Map([["da-workbook:IE-FREQ-1", { reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-workbook", entityId: "IE-FREQ-1" }, expression: perHour }]] as const);
    expect(initiatingFrequencyUnit(linked, table)).toBe("PER_HOUR");
    expect(frequencyRateUnits({ node: "OPERATION", operation: "MULTIPLY", operands: [linked, { node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value: 2 } } }] }, table)).toEqual(["PER_HOUR"]);
    expect(frequencyRateUnits({ node: "OPERATION", operation: "ADD", operands: [linked, { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 1e-3 } } }] }, table)).toEqual(["PER_HOUR", "PER_YEAR"]);
    const model: EventTree = { ...emptyTree(), initiatingEventFrequency: { expression: perHour, annualization: { basis: "CRITICAL_YEAR", hoursPerYear: 7_000 } } };
    expect(createEventTreePresentation(model, []).initiatingEventFrequency).toEqual(model.initiatingEventFrequency);
  });

  it("names a missing, malformed, wrong-unit or negative frequency", () => {
    expect(frequencyFindings(undefined)).toEqual(["ET_FREQUENCY_REQUIRED"]);
    expect(frequencyFindings({ node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: Number.NaN } } })).toEqual(["ET_FREQUENCY_INVALID"]);
    expect(frequencyFindings({ node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 0.01 } } })).toEqual(["ET_FREQUENCY_UNIT"]);
    expect(frequencyFindings({ node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: -0.01 } } })).toEqual(["ET_FREQUENCY_NEGATIVE"]);
    expect(frequencyFindings({ node: "VALUE", value: { unit: "PER_YEAR", law: { family: "NORMAL", mean: 0.01, standardDeviation: 0.01 } } })).toEqual(["ET_FREQUENCY_NEGATIVE"]);
  });
});
