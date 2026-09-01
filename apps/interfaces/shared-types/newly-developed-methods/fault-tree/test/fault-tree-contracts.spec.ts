import {
  FaultTreeBasicEventCatalogueSchema,
  FaultTreeBasicEventReferenceSchema,
  FaultTreeBasicEventProbabilitySchema,
  FaultTreeGateSchema,
  FaultTreeGateInputSchema,
  FaultTreeHouseEventSchema,
  FaultTreeLeafNodeSchema,
  FaultTreeNodePositionSchema,
  FaultTreeTopGateReferenceSchema,
  FaultTreeControlledDataSourceReferenceSchema,
  FaultTreeTransferReferenceSchema,
  FaultTreeUndevelopedEventSchema,
} from "..";

const GATE_ID = "123e4567-e89b-42d3-a456-426614174100";
const LEAF_ID = "123e4567-e89b-42d3-a456-426614174101";
const BASIC_EVENT_ID = "123e4567-e89b-42d3-a456-426614174102";
const TARGET_MODEL_ID = "123e4567-e89b-42d3-a456-426614174103";
const TARGET_GATE_ID = "123e4567-e89b-42d3-a456-426614174104";
const INPUT_ID = "123e4567-e89b-42d3-a456-426614174105";
const OTHER_GATE_ID = "123e4567-e89b-42d3-a456-426614174106";
const PARAMETER_ID = "123e4567-e89b-42d3-a456-426614174108";
const OTHER_LEAF_ID = "123e4567-e89b-42d3-a456-426614174109";

const gateIdentity = {
  id: GATE_ID,
  code: "G-001",
  name: "Reactor trip failure",
  description: "Top event logic.",
  kind: "GATE" as const,
};

describe("fault-tree gate contracts", () => {
  it.each(["AND", "OR", "NOT"] as const)("accepts a %s gate", (gateType) => {
    expect(FaultTreeGateSchema.safeParse({ ...gateIdentity, gateType }).success).toBe(true);
  });

  it("accepts a positive-integer K-of-N gate", () => {
    expect(FaultTreeGateSchema.safeParse({ ...gateIdentity, gateType: "K_OF_N", k: 2 }).success).toBe(true);
  });

  it.each([0, -1, 1.5])("rejects K-of-N with K=%s", (k) => {
    expect(FaultTreeGateSchema.safeParse({ ...gateIdentity, gateType: "K_OF_N", k }).success).toBe(false);
  });

  it("rejects K on a non-voting gate", () => {
    expect(FaultTreeGateSchema.safeParse({ ...gateIdentity, gateType: "AND", k: 2 }).success).toBe(false);
  });

  it.each([
    { ...gateIdentity, id: "G-001", gateType: "OR" },
    { ...gateIdentity, code: "   ", gateType: "OR" },
    { ...gateIdentity, name: "   ", gateType: "OR" },
    { ...gateIdentity, kind: "BASIC_EVENT", gateType: "OR" },
    { ...gateIdentity, gateType: "XOR" },
  ])("rejects malformed gate %#", (gate) => {
    expect(FaultTreeGateSchema.safeParse(gate).success).toBe(false);
  });

  it("accepts only a stable gate UUID as the top-gate reference", () => {
    expect(FaultTreeTopGateReferenceSchema.safeParse({ gateId: GATE_ID }).success).toBe(true);
    expect(FaultTreeTopGateReferenceSchema.safeParse({ gateId: "G-001" }).success).toBe(false);
    expect(FaultTreeTopGateReferenceSchema.safeParse({ gateId: GATE_ID, gateName: "Renamed gate" }).success).toBe(false);
  });
});

describe("fault-tree leaf contracts", () => {
  const localIdentity = {
    id: LEAF_ID,
    code: "L-001",
    name: "Leaf event",
    description: "A local FT leaf.",
  };

  it("accepts a stable project-catalogue basic-event reference", () => {
    const reference = { id: LEAF_ID, kind: "BASIC_EVENT_REFERENCE", basicEventId: BASIC_EVENT_ID };
    expect(FaultTreeBasicEventReferenceSchema.safeParse(reference).success).toBe(true);
    expect(FaultTreeLeafNodeSchema.safeParse(reference).success).toBe(true);
    expect(FaultTreeBasicEventReferenceSchema.safeParse({ ...reference, basicEventId: "BE-PUMP-A" }).success).toBe(false);
    expect(FaultTreeBasicEventReferenceSchema.safeParse({ ...reference, name: "Pump A fails" }).success).toBe(false);
  });

  it.each([true, false])("accepts a house event fixed to %s", (state) => {
    const houseEvent = { ...localIdentity, kind: "HOUSE_EVENT", state };
    expect(FaultTreeHouseEventSchema.safeParse(houseEvent).success).toBe(true);
    expect(FaultTreeLeafNodeSchema.safeParse(houseEvent).success).toBe(true);
  });

  it("accepts an undeveloped event", () => {
    const undevelopedEvent = { ...localIdentity, kind: "UNDEVELOPED_EVENT" };
    expect(FaultTreeUndevelopedEventSchema.safeParse(undevelopedEvent).success).toBe(true);
    expect(FaultTreeLeafNodeSchema.safeParse(undevelopedEvent).success).toBe(true);
  });

  it("accepts a UUID-only cross-model transfer target", () => {
    const transfer = {
      ...localIdentity,
      kind: "TRANSFER_REFERENCE",
      target: { modelId: TARGET_MODEL_ID, entityId: TARGET_GATE_ID },
    };
    expect(FaultTreeTransferReferenceSchema.safeParse(transfer).success).toBe(true);
    expect(FaultTreeLeafNodeSchema.safeParse(transfer).success).toBe(true);
    expect(
      FaultTreeTransferReferenceSchema.safeParse({
        ...transfer,
        target: { ...transfer.target, gateCode: "G-REMOTE" },
      }).success,
    ).toBe(false);
  });

  it.each([
    { ...localIdentity, kind: "HOUSE_EVENT", state: "TRUE" },
    { ...localIdentity, kind: "UNDEVELOPED_EVENT", probability: 0.1 },
    { ...localIdentity, kind: "TRANSFER_REFERENCE", target: { modelId: "FT-REMOTE", entityId: TARGET_GATE_ID } },
  ])("rejects malformed leaf %#", (leaf) => {
    expect(FaultTreeLeafNodeSchema.safeParse(leaf).success).toBe(false);
  });
});

describe("fault-tree relationship and position contracts", () => {
  it("allows one stable child to be referenced by more than one gate", () => {
    const firstInput = { id: INPUT_ID, gateId: GATE_ID, childId: BASIC_EVENT_ID, order: 0 };
    const secondInput = {
      id: "123e4567-e89b-42d3-a456-426614174107",
      gateId: OTHER_GATE_ID,
      childId: BASIC_EVENT_ID,
      order: 1,
    };
    expect(FaultTreeGateInputSchema.safeParse(firstInput).success).toBe(true);
    expect(FaultTreeGateInputSchema.safeParse(secondInput).success).toBe(true);
  });

  it.each([
    { id: INPUT_ID, gateId: "G-001", childId: BASIC_EVENT_ID, order: 0 },
    { id: INPUT_ID, gateId: GATE_ID, childId: "BE-001", order: 0 },
    { id: INPUT_ID, gateId: GATE_ID, childId: BASIC_EVENT_ID, order: -1 },
    { id: INPUT_ID, gateId: GATE_ID, childId: BASIC_EVENT_ID, order: 1.5 },
    { id: INPUT_ID, gateId: GATE_ID, childId: BASIC_EVENT_ID, order: 0, childCode: "BE-001" },
  ])("rejects malformed gate input %#", (input) => {
    expect(FaultTreeGateInputSchema.safeParse(input).success).toBe(false);
  });

  it("records a finite canvas position by stable node UUID", () => {
    expect(FaultTreeNodePositionSchema.safeParse({ nodeId: LEAF_ID, position: { x: 120, y: -45 } }).success).toBe(true);
    expect(FaultTreeNodePositionSchema.safeParse({ nodeId: "L-001", position: { x: 120, y: -45 } }).success).toBe(false);
    expect(FaultTreeNodePositionSchema.safeParse({ nodeId: LEAF_ID, position: { x: Number.NaN, y: -45 } }).success).toBe(false);
  });
});

describe("fault-tree probability contracts", () => {
  it.each([0, 0.125, 1])("accepts probability %s", (value) => {
    expect(FaultTreeBasicEventProbabilitySchema.safeParse({ value }).success).toBe(true);
  });

  it.each([-0.001, 1.001, Number.NaN, Number.POSITIVE_INFINITY])("rejects probability %s", (value) => {
    expect(FaultTreeBasicEventProbabilitySchema.safeParse({ value }).success).toBe(false);
  });

  it("accepts an optional workbook-parameter controlled data source", () => {
    const controlledDataSource = {
      referenceType: "WORKBOOK_PARAMETER",
      workbookId: "da-workbook-1",
      entityId: PARAMETER_ID,
    };
    expect(FaultTreeControlledDataSourceReferenceSchema.safeParse(controlledDataSource).success).toBe(true);
    expect(FaultTreeBasicEventProbabilitySchema.safeParse({ value: 0.02, controlledDataSource }).success).toBe(true);
  });

  it("accepts an explicit failure rate, mission time, and conversion model", () => {
    expect(FaultTreeBasicEventProbabilitySchema.safeParse({
      value: 4.798848184297884e-4,
      quantificationBasis: {
        kind: "FAILURE_RATE",
        failureRate: { value: 2e-5, unit: "HOUR" },
        missionTime: { value: 24, unit: "HOUR" },
        conversion: "EXPONENTIAL",
      },
    }).success).toBe(true);
  });

  it.each([
    { kind: "FAILURE_RATE", failureRate: { value: -1, unit: "HOUR" }, missionTime: { value: 24, unit: "HOUR" }, conversion: "EXPONENTIAL" },
    { kind: "FAILURE_RATE", failureRate: { value: 1, unit: "WEEK" }, missionTime: { value: 24, unit: "HOUR" }, conversion: "EXPONENTIAL" },
    { kind: "FAILURE_RATE", failureRate: { value: 1, unit: "HOUR" }, missionTime: { value: 0, unit: "HOUR" }, conversion: "EXPONENTIAL" },
    { kind: "FAILURE_RATE", failureRate: { value: 1, unit: "HOUR" }, missionTime: { value: 24, unit: "HOUR" }, conversion: "POISSON" },
  ])("rejects malformed rate semantics %#", (quantificationBasis) => {
    expect(FaultTreeBasicEventProbabilitySchema.safeParse({ value: 0.1, quantificationBasis }).success).toBe(false);
  });

  it("accepts an HRA event with an explicit HEP quantification", () => {
    expect(FaultTreeControlledDataSourceReferenceSchema.safeParse({
      referenceType: "HUMAN_FAILURE_EVENT",
      workbookId: "hr-workbook-1",
      entityId: "HR-POST-005",
      quantificationId: "HEPQ-HR-POST-005",
    }).success).toBe(true);
  });

  it.each([
    { referenceType: "WORKBOOK_PARAMETER", workbookId: "", entityId: PARAMETER_ID },
    { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-workbook-1", entityId: "" },
    { referenceType: "BASIC_EVENT", workbookId: "da-workbook-1", entityId: PARAMETER_ID },
    { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-workbook-1", entityId: PARAMETER_ID, parameterName: "Pump failure" },
    { referenceType: "HUMAN_FAILURE_EVENT", workbookId: "hr-workbook-1", entityId: "HR-POST-005", quantificationId: "" },
  ])("rejects malformed controlled source %#", (controlledDataSource) => {
    expect(FaultTreeControlledDataSourceReferenceSchema.safeParse(controlledDataSource).success).toBe(false);
  });
});

describe("workbook basic-event catalogue contracts", () => {
  const catalogue = {
    workbookId: "sy-workbook",
    basicEvents: [
      {
        id: BASIC_EVENT_ID,
        code: "BE-PUMP-A",
        name: "Pump A fails",
        description: "Shared pump failure event.",
        probability: { value: 0.02 },
      },
    ],
  };

  it("accepts an empty workbook catalogue", () => {
    expect(FaultTreeBasicEventCatalogueSchema.safeParse({ ...catalogue, basicEvents: [] }).success).toBe(true);
  });

  it("keeps one basic-event definition behind references from multiple fault trees", () => {
    expect(FaultTreeBasicEventCatalogueSchema.safeParse(catalogue).success).toBe(true);

    const firstTreeReference = {
      id: LEAF_ID,
      kind: "BASIC_EVENT_REFERENCE",
      basicEventId: catalogue.basicEvents[0].id,
    };
    const secondTreeReference = {
      id: OTHER_LEAF_ID,
      kind: "BASIC_EVENT_REFERENCE",
      basicEventId: catalogue.basicEvents[0].id,
    };

    expect(FaultTreeBasicEventReferenceSchema.safeParse(firstTreeReference).success).toBe(true);
    expect(FaultTreeBasicEventReferenceSchema.safeParse(secondTreeReference).success).toBe(true);
    expect(firstTreeReference.id).not.toBe(secondTreeReference.id);
    expect(firstTreeReference.basicEventId).toBe(secondTreeReference.basicEventId);
  });

  it.each([
    { ...catalogue, workbookId: "   " },
    { ...catalogue, projectId: "project-mhtgr" },
    { ...catalogue, revision: 1 },
    { ...catalogue, basicEvents: [{ ...catalogue.basicEvents[0], id: "BE-PUMP-A" }] },
    { ...catalogue, basicEvents: [{ ...catalogue.basicEvents[0], probability: { value: 1.01 } }] },
    { ...catalogue, faultTreeId: TARGET_MODEL_ID },
  ])("rejects malformed workbook catalogue %#", (candidate) => {
    expect(FaultTreeBasicEventCatalogueSchema.safeParse(candidate).success).toBe(false);
  });
});
