import {
  EventTreeFunctionalEventSchema,
  EventTreeFunctionalEventFaultTreeLinkSchema,
  EventTreeInitiatingEventFrequencySchema,
  EventTreeInitiatingEventReferenceSchema,
  EventTreeEndStateSchema,
  EventTreeSequencePathStepSchema,
  EventTreeSequenceSchema,
  EventTreeBranchResultSchema,
  EventTreeCanvasLayoutSchema,
  EventTreeHclConfigurationReferenceSchema,
  EventTreeNodePositionSchema,
} from "..";

const INITIATING_EVENT_MODEL_ID = "123e4567-e89b-42d3-a456-426614174500";
const INITIATING_EVENT_ID = "123e4567-e89b-42d3-a456-426614174501";
const FUNCTIONAL_EVENT_ID = "123e4567-e89b-42d3-a456-426614174502";
const FREQUENCY_PARAMETER_ID = "123e4567-e89b-42d3-a456-426614174503";
const FAULT_TREE_MODEL_ID = "123e4567-e89b-42d3-a456-426614174504";
const FAULT_TREE_TOP_GATE_ID = "123e4567-e89b-42d3-a456-426614174505";
const END_STATE_ID = "123e4567-e89b-42d3-a456-426614174506";
const SEQUENCE_ID = "123e4567-e89b-42d3-a456-426614174507";
const TARGET_EVENT_TREE_ID = "123e4567-e89b-42d3-a456-426614174509";
const TARGET_SEQUENCE_ID = "123e4567-e89b-42d3-a456-426614174510";
const HCL_CONFIGURATION_ID = "123e4567-e89b-42d3-a456-426614174511";

describe("Event-tree initiating and functional-event contracts", () => {
  const initiatingEvent = {
    target: {
      modelId: INITIATING_EVENT_MODEL_ID,
      entityId: INITIATING_EVENT_ID,
    },
  };
  const functionalEvent = {
    id: FUNCTIONAL_EVENT_ID,
    code: "FE-RT",
    name: "Reactor trip",
    description: "Whether the reactor trip function succeeds.",
    order: 0,
  };

  it("accepts a UUID-only initiating-event reference", () => {
    expect(EventTreeInitiatingEventReferenceSchema.safeParse(initiatingEvent).success).toBe(true);
  });

  it.each([0, 0.001, 2.5])("accepts non-negative initiating-event frequency %s", (value) => {
    expect(EventTreeInitiatingEventFrequencySchema.safeParse({ value }).success).toBe(true);
  });

  it("accepts an optional controlled frequency source", () => {
    expect(
      EventTreeInitiatingEventFrequencySchema.safeParse({
        value: 0.001,
        controlledDataSource: { workbookId: "ie-workbook-1", parameterId: FREQUENCY_PARAMETER_ID },
      }).success,
    ).toBe(true);
  });

  it.each([
    { value: -0.001 },
    { value: Number.NaN },
    { value: Number.POSITIVE_INFINITY },
    { value: 0.001, controlledDataSource: { workbookId: "", parameterId: FREQUENCY_PARAMETER_ID } },
    { value: 0.001, controlledDataSource: { workbookId: "ie-workbook-1", parameterId: "IE-FREQUENCY" } },
    { value: 0.001, unit: "per-year" },
  ])("rejects malformed initiating-event frequency %#", (candidate) => {
    expect(EventTreeInitiatingEventFrequencySchema.safeParse(candidate).success).toBe(false);
  });

  it("accepts non-negative integer functional-event order", () => {
    expect(EventTreeFunctionalEventSchema.safeParse(functionalEvent).success).toBe(true);
    expect(EventTreeFunctionalEventSchema.safeParse({ ...functionalEvent, order: 3 }).success).toBe(true);
  });

  it("links a functional event to an FT top gate using stable UUIDs", () => {
    expect(
      EventTreeFunctionalEventFaultTreeLinkSchema.safeParse({
        functionalEventId: FUNCTIONAL_EVENT_ID,
        faultTreeTopGate: { modelId: FAULT_TREE_MODEL_ID, entityId: FAULT_TREE_TOP_GATE_ID },
      }).success,
    ).toBe(true);
  });

  it.each([
    {
      functionalEventId: "FE-RT",
      faultTreeTopGate: { modelId: FAULT_TREE_MODEL_ID, entityId: FAULT_TREE_TOP_GATE_ID },
    },
    {
      functionalEventId: FUNCTIONAL_EVENT_ID,
      faultTreeTopGate: { modelId: "FT-RT", entityId: FAULT_TREE_TOP_GATE_ID },
    },
    {
      functionalEventId: FUNCTIONAL_EVENT_ID,
      faultTreeTopGate: { modelId: FAULT_TREE_MODEL_ID, entityId: "G-TOP" },
    },
    {
      functionalEventId: FUNCTIONAL_EVENT_ID,
      faultTreeTopGate: {
        modelId: FAULT_TREE_MODEL_ID,
        entityId: FAULT_TREE_TOP_GATE_ID,
        gateName: "Reactor trip failure",
      },
    },
  ])("rejects malformed functional-event FT link %#", (candidate) => {
    expect(EventTreeFunctionalEventFaultTreeLinkSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { target: { modelId: "IE-MODEL", entityId: INITIATING_EVENT_ID } },
    { target: { modelId: INITIATING_EVENT_MODEL_ID, entityId: "IE-LOSS-OF-POWER" } },
    { ...initiatingEvent, initiatingEventCode: "IE-LOSS-OF-POWER" },
  ])("rejects malformed initiating-event reference %#", (candidate) => {
    expect(EventTreeInitiatingEventReferenceSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { ...functionalEvent, id: "FE-RT" },
    { ...functionalEvent, code: "" },
    { ...functionalEvent, order: -1 },
    { ...functionalEvent, order: 1.5 },
    { ...functionalEvent, branchProbability: 0.5 },
  ])("rejects malformed functional event %#", (candidate) => {
    expect(EventTreeFunctionalEventSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("Event-tree sequence path and end-state contracts", () => {
  const endState = {
    id: END_STATE_ID,
    code: "RC-2",
    name: "Reactor cooling challenge",
    description: "Sequence reaches reactor cooling challenge end state.",
  };
  const sequence = {
    id: SEQUENCE_ID,
    code: "EHP-3",
    name: "Trip succeeds; cooling fails",
    description: "Representative event-tree sequence.",
    path: [
      { functionalEventId: FUNCTIONAL_EVENT_ID, outcome: "SUCCESS" },
      { functionalEventId: "123e4567-e89b-42d3-a456-426614174508", outcome: "FAILURE" },
    ],
    result: { kind: "END_STATE", endStateId: END_STATE_ID },
  };

  it.each(["SUCCESS", "FAILURE", "BYPASSED"])("accepts the %s branch outcome", (outcome) => {
    expect(EventTreeSequencePathStepSchema.safeParse({ functionalEventId: FUNCTIONAL_EVENT_ID, outcome }).success).toBe(
      true,
    );
  });

  it("accepts a stable end state and traceable sequence identifier", () => {
    expect(EventTreeEndStateSchema.safeParse(endState).success).toBe(true);
    expect(EventTreeSequenceSchema.safeParse(sequence).success).toBe(true);
  });

  it("allows an empty draft path for validation to report later", () => {
    expect(EventTreeSequenceSchema.safeParse({ ...sequence, path: [] }).success).toBe(true);
  });

  it.each([
    { functionalEventId: "FE-RT", outcome: "SUCCESS" },
    { functionalEventId: FUNCTIONAL_EVENT_ID, outcome: "UNKNOWN" },
    { functionalEventId: FUNCTIONAL_EVENT_ID, outcome: "SUCCESS", probability: 0.9 },
  ])("rejects malformed sequence path step %#", (candidate) => {
    expect(EventTreeSequencePathStepSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { ...sequence, id: "EHP-3" },
    { ...sequence, code: "" },
    { ...sequence, result: { kind: "END_STATE", endStateId: "RC-2" } },
    { ...sequence, path: [{ functionalEventId: FUNCTIONAL_EVENT_ID, outcome: "SUCCESS", label: "Pass" }] },
    { ...sequence, annualFrequency: 0.001 },
  ])("rejects malformed sequence %#", (candidate) => {
    expect(EventTreeSequenceSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("Event-tree branch-result and position contracts", () => {
  it("accepts an end-state branch result", () => {
    expect(EventTreeBranchResultSchema.safeParse({ kind: "END_STATE", endStateId: END_STATE_ID }).success).toBe(true);
  });

  it("accepts a UUID-only transfer branch result", () => {
    expect(
      EventTreeBranchResultSchema.safeParse({
        kind: "TRANSFER",
        target: { modelId: TARGET_EVENT_TREE_ID, entityId: TARGET_SEQUENCE_ID },
      }).success,
    ).toBe(true);
  });

  it("records finite canvas coordinates by stable node UUID", () => {
    expect(EventTreeNodePositionSchema.safeParse({ nodeId: SEQUENCE_ID, position: { x: 240, y: -80 } }).success).toBe(
      true,
    );
  });

  it("accepts a UUID-only HCL configuration reference", () => {
    expect(
      EventTreeHclConfigurationReferenceSchema.safeParse({ configuration: { modelId: HCL_CONFIGURATION_ID } }).success,
    ).toBe(true);
  });

  it("accepts shared layout metadata with ET node positions", () => {
    expect(
      EventTreeCanvasLayoutSchema.safeParse({
        metadata: {
          viewport: { x: 0, y: 0, zoom: 1 },
          mode: "MANUAL",
          direction: "LEFT_TO_RIGHT",
        },
        nodePositions: [{ nodeId: SEQUENCE_ID, position: { x: 240, y: -80 } }],
      }).success,
    ).toBe(true);
  });

  it.each([
    { configuration: { modelId: "HCL-1" } },
    { configuration: { modelId: HCL_CONFIGURATION_ID, name: "HCL configuration" } },
    { configurationId: HCL_CONFIGURATION_ID },
  ])("rejects malformed HCL configuration reference %#", (candidate) => {
    expect(EventTreeHclConfigurationReferenceSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    {
      metadata: { viewport: { x: 0, y: 0, zoom: 0 }, mode: "MANUAL", direction: "LEFT_TO_RIGHT" },
      nodePositions: [],
    },
    {
      metadata: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "FREEHAND", direction: "LEFT_TO_RIGHT" },
      nodePositions: [],
    },
    {
      metadata: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "MANUAL", direction: "LEFT_TO_RIGHT" },
      nodePositions: [],
      gridSize: 20,
    },
  ])("rejects malformed ET canvas layout %#", (candidate) => {
    expect(EventTreeCanvasLayoutSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { kind: "END_STATE", endStateId: "RC-2" },
    { kind: "END_STATE", endStateId: END_STATE_ID, endStateName: "Cooling challenge" },
    { kind: "TRANSFER", target: { modelId: "ET-2", entityId: TARGET_SEQUENCE_ID } },
    { kind: "TRANSFER", target: { modelId: TARGET_EVENT_TREE_ID, entityId: "SEQ-1" } },
    { kind: "CONTINUE", target: { modelId: TARGET_EVENT_TREE_ID, entityId: TARGET_SEQUENCE_ID } },
  ])("rejects malformed branch result %#", (candidate) => {
    expect(EventTreeBranchResultSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { nodeId: "SEQ-1", position: { x: 0, y: 0 } },
    { nodeId: SEQUENCE_ID, position: { x: Number.NaN, y: 0 } },
    { nodeId: SEQUENCE_ID, position: { x: 0, y: 0 }, label: "Sequence" },
  ])("rejects malformed ET node position %#", (candidate) => {
    expect(EventTreeNodePositionSchema.safeParse(candidate).success).toBe(false);
  });
});
