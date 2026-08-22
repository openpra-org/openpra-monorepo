import {
  AnalysisReadyValidationOutcomeSchema,
  DraftValidationOutcomeSchema,
  ValidationIssueSchema,
} from "../../shared";
import type { EventTreeModel } from "..";
import {
  validateEventTreeEndStates,
  validateEventTreeAnalysisReady,
  validateEventTreeDraft,
  validateEventTreeFaultTreeLinksAndFrequency,
  validateEventTreeModel,
  validateEventTreeStartingNodeAndPaths,
  validateEventTreeSequenceIdentity,
  validateEventTreeTransfers,
} from "..";

const MODEL_ID = "123e4567-e89b-42d3-a456-426614174600";
const INITIATING_EVENT_MODEL_ID = "123e4567-e89b-42d3-a456-426614174601";
const INITIATING_EVENT_ID = "123e4567-e89b-42d3-a456-426614174602";
const FIRST_FUNCTIONAL_EVENT_ID = "123e4567-e89b-42d3-a456-426614174603";
const SECOND_FUNCTIONAL_EVENT_ID = "123e4567-e89b-42d3-a456-426614174604";
const END_STATE_ID = "123e4567-e89b-42d3-a456-426614174605";
const SUCCESS_SUCCESS_SEQUENCE_ID = "123e4567-e89b-42d3-a456-426614174606";
const SUCCESS_FAILURE_SEQUENCE_ID = "123e4567-e89b-42d3-a456-426614174607";
const FAILURE_SUCCESS_SEQUENCE_ID = "123e4567-e89b-42d3-a456-426614174608";
const FAILURE_FAILURE_SEQUENCE_ID = "123e4567-e89b-42d3-a456-426614174609";
const MISSING_INITIATING_EVENT_ID = "123e4567-e89b-42d3-a456-426614174610";
const OTHER_END_STATE_ID = "123e4567-e89b-42d3-a456-426614174611";
const MISSING_END_STATE_ID = "123e4567-e89b-42d3-a456-426614174612";
const FIRST_FAULT_TREE_MODEL_ID = "123e4567-e89b-42d3-a456-426614174613";
const FIRST_FAULT_TREE_TOP_GATE_ID = "123e4567-e89b-42d3-a456-426614174614";
const SECOND_FAULT_TREE_MODEL_ID = "123e4567-e89b-42d3-a456-426614174615";
const SECOND_FAULT_TREE_TOP_GATE_ID = "123e4567-e89b-42d3-a456-426614174616";
const TARGET_EVENT_TREE_ID = "123e4567-e89b-42d3-a456-426614174617";
const TARGET_SEQUENCE_ID = "123e4567-e89b-42d3-a456-426614174618";
const MISSING_TRANSFER_SEQUENCE_ID = "123e4567-e89b-42d3-a456-426614174619";
const owner = { workbookId: "es-workbook", workbookRevision: 1, modelId: MODEL_ID } as const;

const model: EventTreeModel = {
  modelId: MODEL_ID,
  code: "ET-ULOF",
  name: "Unprotected loss of flow",
  description: "Event tree used to test path validation.",
  initiatingEvent: {
    target: { modelId: INITIATING_EVENT_MODEL_ID, entityId: INITIATING_EVENT_ID },
  },
  initiatingEventFrequency: { value: 0.001 },
  functionalEvents: [
    {
      id: FIRST_FUNCTIONAL_EVENT_ID,
      code: "RT",
      name: "Reactor trip",
      description: "Reactor trip succeeds or fails.",
      order: 0,
    },
    {
      id: SECOND_FUNCTIONAL_EVENT_ID,
      code: "DHR",
      name: "Decay heat removal",
      description: "Decay heat removal succeeds or fails.",
      order: 1,
    },
  ],
  functionalEventFaultTreeLinks: [
    {
      functionalEventId: FIRST_FUNCTIONAL_EVENT_ID,
      faultTreeTopGate: { modelId: FIRST_FAULT_TREE_MODEL_ID, entityId: FIRST_FAULT_TREE_TOP_GATE_ID },
    },
    {
      functionalEventId: SECOND_FUNCTIONAL_EVENT_ID,
      faultTreeTopGate: { modelId: SECOND_FAULT_TREE_MODEL_ID, entityId: SECOND_FAULT_TREE_TOP_GATE_ID },
    },
  ],
  endStates: [
    {
      id: END_STATE_ID,
      code: "SAFE",
      name: "Safe state",
      description: "The sequence reaches a safe state.",
    },
  ],
  sequences: [
    {
      id: SUCCESS_SUCCESS_SEQUENCE_ID,
      code: "SS",
      name: "Success success",
      description: "Both functions succeed.",
      path: [
        { functionalEventId: FIRST_FUNCTIONAL_EVENT_ID, outcome: "SUCCESS" },
        { functionalEventId: SECOND_FUNCTIONAL_EVENT_ID, outcome: "SUCCESS" },
      ],
      result: { kind: "END_STATE", endStateId: END_STATE_ID },
    },
    {
      id: SUCCESS_FAILURE_SEQUENCE_ID,
      code: "SF",
      name: "Success failure",
      description: "The first function succeeds and the second fails.",
      path: [
        { functionalEventId: FIRST_FUNCTIONAL_EVENT_ID, outcome: "SUCCESS" },
        { functionalEventId: SECOND_FUNCTIONAL_EVENT_ID, outcome: "FAILURE" },
      ],
      result: { kind: "END_STATE", endStateId: END_STATE_ID },
    },
    {
      id: FAILURE_SUCCESS_SEQUENCE_ID,
      code: "FS",
      name: "Failure success",
      description: "The first function fails and the second succeeds.",
      path: [
        { functionalEventId: FIRST_FUNCTIONAL_EVENT_ID, outcome: "FAILURE" },
        { functionalEventId: SECOND_FUNCTIONAL_EVENT_ID, outcome: "SUCCESS" },
      ],
      result: { kind: "END_STATE", endStateId: END_STATE_ID },
    },
    {
      id: FAILURE_FAILURE_SEQUENCE_ID,
      code: "FF",
      name: "Failure failure",
      description: "Both functions fail.",
      path: [
        { functionalEventId: FIRST_FUNCTIONAL_EVENT_ID, outcome: "FAILURE" },
        { functionalEventId: SECOND_FUNCTIONAL_EVENT_ID, outcome: "FAILURE" },
      ],
      result: { kind: "END_STATE", endStateId: END_STATE_ID },
    },
  ],
  hclConfiguration: null,
  canvas: {
    metadata: {
      viewport: { x: 0, y: 0, zoom: 1 },
      mode: "MANUAL",
      direction: "LEFT_TO_RIGHT",
    },
    nodePositions: [],
  },
};

describe("event-tree starting-node and path validation", () => {
  const initiatingEventContext = {
    availableInitiatingEvents: [{ modelId: INITIATING_EVENT_MODEL_ID, entityId: INITIATING_EVENT_ID }],
  };

  it("accepts a resolved initiating event and every complete binary path", () => {
    expect(validateEventTreeStartingNodeAndPaths(model, initiatingEventContext)).toEqual([]);
    expect(validateEventTreeModel(model)).toEqual([]);
    expect(validateEventTreeModel(model, initiatingEventContext)).toEqual([]);
  });

  it("requires an initiating event", () => {
    expect(validateEventTreeStartingNodeAndPaths({ ...model, initiatingEvent: null })).toEqual([
      expect.objectContaining({
        code: "ET_INITIATING_EVENT_REQUIRED",
        entityId: MODEL_ID,
        fieldPath: ["initiatingEvent"],
      }),
    ]);
  });

  it("reports dangling and ambiguous initiating-event references when a catalogue is supplied", () => {
    const missingModel = {
      ...model,
      initiatingEvent: {
        target: { modelId: INITIATING_EVENT_MODEL_ID, entityId: MISSING_INITIATING_EVENT_ID },
      },
    };
    expect(validateEventTreeStartingNodeAndPaths(missingModel, initiatingEventContext)).toEqual([
      expect.objectContaining({
        code: "ET_INITIATING_EVENT_NOT_FOUND",
        entityId: MISSING_INITIATING_EVENT_ID,
        fieldPath: ["initiatingEvent", "target"],
      }),
    ]);

    expect(
      validateEventTreeStartingNodeAndPaths(model, {
        availableInitiatingEvents: [
          initiatingEventContext.availableInitiatingEvents[0],
          initiatingEventContext.availableInitiatingEvents[0],
        ],
      }),
    ).toEqual([expect.objectContaining({ code: "ET_INITIATING_EVENT_AMBIGUOUS" })]);
  });

  it("requires at least one functional event", () => {
    expect(
      validateEventTreeStartingNodeAndPaths({ ...model, functionalEvents: [], sequences: [] }),
    ).toEqual([
      expect.objectContaining({
        code: "ET_FUNCTIONAL_EVENT_REQUIRED",
        entityId: MODEL_ID,
        fieldPath: ["functionalEvents"],
      }),
    ]);
  });

  it("requires unique contiguous functional-event ordering", () => {
    expect(
      validateEventTreeStartingNodeAndPaths({
        ...model,
        functionalEvents: [model.functionalEvents[0], { ...model.functionalEvents[1], order: 0 }],
      }),
    ).toEqual([expect.objectContaining({ code: "ET_FUNCTIONAL_EVENT_ORDER_INVALID" })]);
  });

  it("requires every sequence to follow every ordered functional event", () => {
    const firstSequence = model.sequences[0];
    const issues = validateEventTreeStartingNodeAndPaths({
      ...model,
      sequences: [{ ...firstSequence, path: [firstSequence.path[0]] }, ...model.sequences.slice(1)],
    });
    expect(issues.map((issue) => issue.code)).toEqual([
      "ET_SEQUENCE_PATH_INCOMPLETE",
      "ET_BRANCH_COVERAGE_INCOMPLETE",
    ]);
  });

  it("rejects duplicate paths", () => {
    const issues = validateEventTreeStartingNodeAndPaths({
      ...model,
      sequences: [model.sequences[0], { ...model.sequences[1], path: model.sequences[0].path }, ...model.sequences.slice(2)],
    });
    expect(issues.map((issue) => issue.code)).toEqual([
      "ET_SEQUENCE_PATH_DUPLICATE",
      "ET_BRANCH_COVERAGE_INCOMPLETE",
    ]);
  });

  it("reports missing success/failure branch coverage", () => {
    expect(validateEventTreeStartingNodeAndPaths({ ...model, sequences: model.sequences.slice(0, 3) })).toEqual([
      expect.objectContaining({
        code: "ET_BRANCH_COVERAGE_INCOMPLETE",
        entityId: MODEL_ID,
        fieldPath: ["sequences"],
      }),
    ]);
  });

  it("emits schema-valid, addressable findings", () => {
    const issues = validateEventTreeStartingNodeAndPaths({ ...model, initiatingEvent: null, sequences: [] });
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("event-tree end-state validation", () => {
  const otherEndState: EventTreeModel["endStates"][number] = {
    id: OTHER_END_STATE_ID,
    code: "RELEASE",
    name: "Release state",
    description: "The sequence reaches a release state.",
  };

  it("accepts end states reached by one or more sequences", () => {
    expect(validateEventTreeEndStates(model)).toEqual([]);
  });

  it("reports a dangling sequence end-state reference", () => {
    expect(
      validateEventTreeEndStates({
        ...model,
        sequences: [
          {
            ...model.sequences[0],
            result: { kind: "END_STATE", endStateId: MISSING_END_STATE_ID },
          },
          ...model.sequences.slice(1),
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "ET_END_STATE_NOT_FOUND",
        entityId: MISSING_END_STATE_ID,
        fieldPath: ["sequences", 0, "result", "endStateId"],
      }),
    ]);
  });

  it("reports an end-state reference that resolves ambiguously", () => {
    const issues = validateEventTreeEndStates({
      ...model,
      endStates: [model.endStates[0], model.endStates[0]],
      sequences: [model.sequences[0]],
    });
    expect(issues.map((issue) => issue.code)).toEqual([
      "ET_END_STATE_AMBIGUOUS",
      "ET_END_STATE_UNREACHABLE",
      "ET_END_STATE_UNREACHABLE",
    ]);
  });

  it("reports every declared end state that no sequence reaches", () => {
    expect(validateEventTreeEndStates({ ...model, endStates: [...model.endStates, otherEndState] })).toEqual([
      expect.objectContaining({
        code: "ET_END_STATE_UNREACHABLE",
        entityId: OTHER_END_STATE_ID,
        fieldPath: ["endStates", 1],
      }),
    ]);
  });

  it("does not treat transfer results as local end-state reachability", () => {
    expect(
      validateEventTreeEndStates({
        ...model,
        sequences: model.sequences.map((sequence) => ({
          ...sequence,
          result: {
            kind: "TRANSFER",
            target: { modelId: MODEL_ID, entityId: SUCCESS_SUCCESS_SEQUENCE_ID },
          },
        })),
      }),
    ).toEqual([expect.objectContaining({ code: "ET_END_STATE_UNREACHABLE" })]);
  });

  it("includes end-state reachability findings in aggregate validation", () => {
    expect(validateEventTreeModel({ ...model, endStates: [...model.endStates, otherEndState] })).toEqual([
      expect.objectContaining({ code: "ET_END_STATE_UNREACHABLE" }),
    ]);
  });

  it("emits schema-valid, addressable end-state findings", () => {
    const issues = validateEventTreeEndStates({ ...model, endStates: [...model.endStates, otherEndState] });
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("event-tree FT-link and initiating-frequency validation", () => {
  const faultTreeContext = {
    availableFaultTreeTopGates: model.functionalEventFaultTreeLinks.map((link) => link.faultTreeTopGate),
  };

  it("accepts one resolved FT top-gate link per functional event and a non-negative frequency", () => {
    expect(validateEventTreeFaultTreeLinksAndFrequency(model, faultTreeContext)).toEqual([]);
    expect(
      validateEventTreeFaultTreeLinksAndFrequency({
        ...model,
        initiatingEventFrequency: { value: 0 },
      }),
    ).toEqual([]);
  });

  it("requires an initiating-event frequency", () => {
    expect(
      validateEventTreeFaultTreeLinksAndFrequency({ ...model, initiatingEventFrequency: null }),
    ).toEqual([
      expect.objectContaining({
        code: "ET_INITIATING_EVENT_FREQUENCY_REQUIRED",
        entityId: MODEL_ID,
        fieldPath: ["initiatingEventFrequency"],
      }),
    ]);
  });

  it.each([-0.001, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid initiating-event frequency %s",
    (value) => {
      expect(
        validateEventTreeFaultTreeLinksAndFrequency({
          ...model,
          initiatingEventFrequency: { value },
        }),
      ).toEqual([
        expect.objectContaining({
          code: "ET_INITIATING_EVENT_FREQUENCY_INVALID",
          fieldPath: ["initiatingEventFrequency", "value"],
        }),
      ]);
    },
  );

  it("requires exactly one FT link per functional event", () => {
    expect(
      validateEventTreeFaultTreeLinksAndFrequency({
        ...model,
        functionalEventFaultTreeLinks: [model.functionalEventFaultTreeLinks[1]],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "ET_FT_LINK_REQUIRED",
        entityId: FIRST_FUNCTIONAL_EVENT_ID,
        fieldPath: ["functionalEvents", 0],
      }),
    ]);

    expect(
      validateEventTreeFaultTreeLinksAndFrequency({
        ...model,
        functionalEventFaultTreeLinks: [
          ...model.functionalEventFaultTreeLinks,
          model.functionalEventFaultTreeLinks[0],
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "ET_FT_LINK_DUPLICATE",
        entityId: FIRST_FUNCTIONAL_EVENT_ID,
        fieldPath: ["functionalEventFaultTreeLinks", 2, "functionalEventId"],
      }),
    ]);
  });

  it("reports dangling and ambiguous functional-event references", () => {
    expect(
      validateEventTreeFaultTreeLinksAndFrequency({
        ...model,
        functionalEventFaultTreeLinks: [
          { ...model.functionalEventFaultTreeLinks[0], functionalEventId: MISSING_INITIATING_EVENT_ID },
          model.functionalEventFaultTreeLinks[1],
        ],
      }).map((issue) => issue.code),
    ).toEqual(["ET_FT_LINK_FUNCTIONAL_EVENT_NOT_FOUND", "ET_FT_LINK_REQUIRED"]);

    expect(
      validateEventTreeFaultTreeLinksAndFrequency({
        ...model,
        functionalEvents: [model.functionalEvents[0], model.functionalEvents[0], model.functionalEvents[1]],
      }),
    ).toEqual([expect.objectContaining({ code: "ET_FT_LINK_FUNCTIONAL_EVENT_AMBIGUOUS" })]);
  });

  it("reports dangling and ambiguous FT top-gate targets when a catalogue is supplied", () => {
    expect(
      validateEventTreeFaultTreeLinksAndFrequency(model, {
        availableFaultTreeTopGates: [model.functionalEventFaultTreeLinks[1].faultTreeTopGate],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "ET_FT_TOP_GATE_NOT_FOUND",
        entityId: FIRST_FAULT_TREE_TOP_GATE_ID,
        fieldPath: ["functionalEventFaultTreeLinks", 0, "faultTreeTopGate"],
      }),
    ]);

    expect(
      validateEventTreeFaultTreeLinksAndFrequency(model, {
        availableFaultTreeTopGates: [
          ...faultTreeContext.availableFaultTreeTopGates,
          faultTreeContext.availableFaultTreeTopGates[0],
        ],
      }),
    ).toEqual([expect.objectContaining({ code: "ET_FT_TOP_GATE_AMBIGUOUS" })]);
  });

  it("includes FT-link and frequency findings in aggregate validation", () => {
    expect(validateEventTreeModel({ ...model, initiatingEventFrequency: null })).toEqual([
      expect.objectContaining({ code: "ET_INITIATING_EVENT_FREQUENCY_REQUIRED" }),
    ]);
  });

  it("emits schema-valid, addressable FT-link and frequency findings", () => {
    const issues = validateEventTreeFaultTreeLinksAndFrequency(
      { ...model, initiatingEventFrequency: null },
      { availableFaultTreeTopGates: [] },
    );
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("event-tree transfer validation", () => {
  const targetSequence: EventTreeModel["sequences"][number] = {
    ...model.sequences[0],
    id: TARGET_SEQUENCE_ID,
    code: "TARGET",
    name: "Target sequence",
  };
  const targetModel: EventTreeModel = {
    ...model,
    modelId: TARGET_EVENT_TREE_ID,
    code: "ET-TARGET",
    name: "Target event tree",
    sequences: [targetSequence],
  };
  const transferFirstSequence = (
    sourceModel: EventTreeModel,
    targetModelId = TARGET_EVENT_TREE_ID,
    targetSequenceId = TARGET_SEQUENCE_ID,
  ): EventTreeModel => ({
    ...sourceModel,
    sequences: [
      {
        ...sourceModel.sequences[0],
        result: {
          kind: "TRANSFER",
          target: { modelId: targetModelId, entityId: targetSequenceId },
        },
      },
      ...sourceModel.sequences.slice(1),
    ],
  });

  it("accepts a transfer that resolves to one sequence in another event tree", () => {
    expect(
      validateEventTreeTransfers(transferFirstSequence(model), { eventTreeModels: [targetModel] }),
    ).toEqual([]);
  });

  it("accepts an internal transfer to a terminal sequence", () => {
    expect(
      validateEventTreeTransfers(
        transferFirstSequence(model, MODEL_ID, SUCCESS_FAILURE_SEQUENCE_ID),
      ),
    ).toEqual([]);
  });

  it("reports a missing or ambiguous target event-tree model", () => {
    expect(validateEventTreeTransfers(transferFirstSequence(model))).toEqual([
      expect.objectContaining({
        code: "ET_TRANSFER_MODEL_NOT_FOUND",
        entityId: SUCCESS_SUCCESS_SEQUENCE_ID,
        fieldPath: ["sequences", 0, "result", "target"],
      }),
    ]);

    expect(
      validateEventTreeTransfers(transferFirstSequence(model), {
        eventTreeModels: [targetModel, targetModel],
      }),
    ).toEqual([expect.objectContaining({ code: "ET_TRANSFER_MODEL_AMBIGUOUS" })]);
  });

  it("reports a missing or ambiguous target sequence", () => {
    expect(
      validateEventTreeTransfers(transferFirstSequence(model, TARGET_EVENT_TREE_ID, MISSING_TRANSFER_SEQUENCE_ID), {
        eventTreeModels: [targetModel],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "ET_TRANSFER_SEQUENCE_NOT_FOUND",
        entityId: SUCCESS_SUCCESS_SEQUENCE_ID,
        fieldPath: ["sequences", 0, "result", "target", "entityId"],
      }),
    ]);

    expect(
      validateEventTreeTransfers(transferFirstSequence(model), {
        eventTreeModels: [{ ...targetModel, sequences: [targetSequence, targetSequence] }],
      }),
    ).toEqual([expect.objectContaining({ code: "ET_TRANSFER_SEQUENCE_AMBIGUOUS" })]);
  });

  it("rejects a transfer sequence that targets itself", () => {
    expect(
      validateEventTreeTransfers(
        transferFirstSequence(model, MODEL_ID, SUCCESS_SUCCESS_SEQUENCE_ID),
      ),
    ).toEqual([
      expect.objectContaining({
        code: "ET_TRANSFER_LOOP",
        entityId: SUCCESS_SUCCESS_SEQUENCE_ID,
        fieldPath: ["sequences", 0, "result", "target"],
      }),
    ]);
  });

  it("reports every transfer in a cross-event-tree loop", () => {
    const sourceModel = transferFirstSequence(model);
    const loopingTargetModel = transferFirstSequence(
      targetModel,
      MODEL_ID,
      SUCCESS_SUCCESS_SEQUENCE_ID,
    );
    const issues = validateEventTreeTransfers(sourceModel, { eventTreeModels: [loopingTargetModel] });
    expect(issues.map((issue) => issue.code)).toEqual(["ET_TRANSFER_LOOP", "ET_TRANSFER_LOOP"]);
    expect(issues.map((issue) => issue.entityId)).toEqual([
      SUCCESS_SUCCESS_SEQUENCE_ID,
      TARGET_SEQUENCE_ID,
    ]);
  });

  it("allows multiple sequences to transfer to one terminal target", () => {
    const sourceModel = transferFirstSequence(model);
    const sharedTargetModel: EventTreeModel = {
      ...sourceModel,
      sequences: [
        sourceModel.sequences[0],
        {
          ...sourceModel.sequences[1],
          result: sourceModel.sequences[0].result,
        },
        ...sourceModel.sequences.slice(2),
      ],
    };
    expect(validateEventTreeTransfers(sharedTargetModel, { eventTreeModels: [targetModel] })).toEqual([]);
  });

  it("includes transfer findings in aggregate validation", () => {
    expect(validateEventTreeModel(transferFirstSequence(model))).toEqual([
      expect.objectContaining({ code: "ET_TRANSFER_MODEL_NOT_FOUND" }),
    ]);
  });

  it("emits schema-valid, addressable transfer findings", () => {
    const issues = validateEventTreeTransfers(transferFirstSequence(model));
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("event-tree sequence identity validation", () => {
  it("accepts unique stable sequence ids and analyst-facing codes", () => {
    expect(validateEventTreeSequenceIdentity(model)).toEqual([]);
  });

  it("reports a duplicate sequence id against the later sequence", () => {
    expect(
      validateEventTreeSequenceIdentity({
        ...model,
        sequences: [model.sequences[0], { ...model.sequences[1], id: SUCCESS_SUCCESS_SEQUENCE_ID }, ...model.sequences.slice(2)],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "ET_DUPLICATE_SEQUENCE_ID",
        entityId: SUCCESS_SUCCESS_SEQUENCE_ID,
        fieldPath: ["sequences", 1, "id"],
      }),
    ]);
  });

  it("treats trimmed sequence codes as case-insensitively unique", () => {
    expect(
      validateEventTreeSequenceIdentity({
        ...model,
        sequences: [model.sequences[0], { ...model.sequences[1], code: " ss " }, ...model.sequences.slice(2)],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "ET_DUPLICATE_SEQUENCE_CODE",
        entityId: SUCCESS_FAILURE_SEQUENCE_ID,
        fieldPath: ["sequences", 1, "code"],
      }),
    ]);
  });

  it("includes duplicate sequence identities in aggregate validation", () => {
    expect(
      validateEventTreeModel({
        ...model,
        sequences: [model.sequences[0], { ...model.sequences[1], id: SUCCESS_SUCCESS_SEQUENCE_ID }, ...model.sequences.slice(2)],
      }),
    ).toEqual([expect.objectContaining({ code: "ET_DUPLICATE_SEQUENCE_ID" })]);
  });

  it("emits schema-valid, addressable sequence identity findings", () => {
    const issues = validateEventTreeSequenceIdentity({
      ...model,
      sequences: [model.sequences[0], { ...model.sequences[1], id: SUCCESS_SUCCESS_SEQUENCE_ID, code: "ss" }],
    });
    expect(issues.map((issue) => issue.code)).toEqual([
      "ET_DUPLICATE_SEQUENCE_ID",
      "ET_DUPLICATE_SEQUENCE_CODE",
    ]);
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("event-tree validation policy integration", () => {
  const validatedAt = "2026-08-20T18:30:00.000Z";
  const incompleteModel: EventTreeModel = { ...model, initiatingEvent: null };

  it("reports an incomplete ET draft without preventing it from being saved", () => {
    const outcome = validateEventTreeDraft(incompleteModel, owner, validatedAt);
    expect(outcome.saveAllowed).toBe(true);
    expect(outcome.validation.valid).toBe(false);
    expect(outcome.validation.issues.map((issue) => issue.code)).toEqual(["ET_INITIATING_EVENT_REQUIRED"]);
    expect(DraftValidationOutcomeSchema.safeParse(outcome).success).toBe(true);
  });

  it("blocks analysis-ready quantification for the same incomplete ET", () => {
    const outcome = validateEventTreeAnalysisReady(incompleteModel, owner, validatedAt);
    expect(outcome.quantificationAllowed).toBe(false);
    expect(outcome.validation.valid).toBe(false);
    expect(outcome.validation.issues.map((issue) => issue.code)).toEqual(["ET_INITIATING_EVENT_REQUIRED"]);
    expect(AnalysisReadyValidationOutcomeSchema.safeParse(outcome).success).toBe(true);
  });

  it("allows analysis-ready quantification for a complete valid ET", () => {
    const outcome = validateEventTreeAnalysisReady(model, owner, validatedAt);
    expect(outcome.quantificationAllowed).toBe(true);
    expect(outcome.validation.valid).toBe(true);
    expect(outcome.validation.issues).toEqual([]);
  });

  it("applies reference catalogues to policy decisions", () => {
    const outcome = validateEventTreeAnalysisReady(model, owner, validatedAt, {
      availableInitiatingEvents: [],
      availableFaultTreeTopGates: [],
    });
    expect(outcome.quantificationAllowed).toBe(false);
    expect(outcome.validation.issues.map((issue) => issue.code)).toEqual([
      "ET_INITIATING_EVENT_NOT_FOUND",
      "ET_FT_TOP_GATE_NOT_FOUND",
      "ET_FT_TOP_GATE_NOT_FOUND",
    ]);
  });
});
