import {
  BayesianNetworkDefinitionSchema,
  EventTreeDefinitionSchema,
  FaultTreeDefinitionSchema,
  HclConfigurationDefinitionSchema,
  WorkbookEntityAddressSchema,
  WorkbookModelAddressSchema,
  WorkbookModelEntityAddressSchema,
  WorkbookModelSnapshotIdentitySchema,
} from "interfaces-mef-types/zod/modeling";
import {
  BayesianNetworkModelSchema,
  EventTreeModelSchema,
  FaultTreeModelSchema,
  HclConfigurationModelSchema,
} from "../..";

const MODEL_ID = "123e4567-e89b-42d3-a456-426614174000";
const BN_ID = "123e4567-e89b-42d3-a456-426614174001";
const WORKBOOK_ID = "workbook-1";
const ENTITY_ID = "123e4567-e89b-42d3-a456-426614174002";

const layout = {
  viewport: { x: 0, y: 0, zoom: 1 },
  mode: "AUTOMATIC" as const,
  direction: "TOP_TO_BOTTOM" as const,
};

const faultTreeDefinition = {
  topGate: null,
  gates: [],
  leafNodes: [],
  gateInputs: [],
  nodePositions: [],
  layout,
};

const bayesianNetworkDefinition = {
  nodes: [],
  edges: [],
  conditionalProbabilityTables: [],
  nodePositions: [],
  layout,
};

const eventTreeDefinition = {
  initiatingEvent: null,
  initiatingEventFrequency: null,
  functionalEvents: [],
  functionalEventFaultTreeLinks: [],
  endStates: [],
  sequences: [],
  hclConfiguration: null,
  canvas: { metadata: layout, nodePositions: [] },
};

const hclDefinition = {
  bayesianNetwork: { workbookId: WORKBOOK_ID, modelId: BN_ID },
  faultTrees: [],
  bindings: [],
  baseEvidence: { observations: [] },
  solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
};

describe("workbook-owned model identity", () => {
  const address = {
    workbookId: WORKBOOK_ID,
    modelId: MODEL_ID,
  };

  it("requires workbook scope and a workbook-local model UUID", () => {
    expect(WorkbookModelAddressSchema.safeParse(address).success).toBe(true);
    expect(WorkbookModelAddressSchema.safeParse({ modelId: MODEL_ID }).success).toBe(false);
  });

  it("keeps revisions out of durable addresses and in snapshot identities", () => {
    expect(WorkbookModelAddressSchema.safeParse({ ...address, workbookRevision: 3 }).success).toBe(false);
    expect(WorkbookModelSnapshotIdentitySchema.safeParse({ ...address, workbookRevision: 3 }).success).toBe(true);
    expect(WorkbookModelSnapshotIdentitySchema.safeParse({ ...address, workbookRevision: 0 }).success).toBe(false);
    expect(WorkbookModelSnapshotIdentitySchema.safeParse({ ...address, revision: 3 }).success).toBe(false);
  });

  it("rejects standalone project-model identity fields", () => {
    expect(WorkbookModelAddressSchema.safeParse({ ...address, id: MODEL_ID }).success).toBe(false);
    expect(WorkbookModelAddressSchema.safeParse({ ...address, projectId: "project-1" }).success).toBe(false);
  });

  it("scopes the same local model UUID independently in different workbooks", () => {
    expect(WorkbookModelAddressSchema.safeParse(address).success).toBe(true);
    expect(WorkbookModelAddressSchema.safeParse({ ...address, workbookId: "workbook-2" }).success).toBe(true);
  });

  it("separates workbook-level catalogue entities from model entities", () => {
    const workbookEntityAddress = { workbookId: WORKBOOK_ID, entityId: ENTITY_ID };
    const modelEntityAddress = { ...address, entityId: ENTITY_ID };
    expect(WorkbookEntityAddressSchema.safeParse(workbookEntityAddress).success).toBe(true);
    expect(WorkbookEntityAddressSchema.safeParse(modelEntityAddress).success).toBe(false);
    expect(WorkbookModelEntityAddressSchema.safeParse(modelEntityAddress).success).toBe(true);
    expect(WorkbookModelEntityAddressSchema.safeParse(workbookEntityAddress).success).toBe(false);
    expect(WorkbookModelEntityAddressSchema.safeParse({ ...modelEntityAddress, entityId: "BE-PUMP-A" }).success).toBe(
      false,
    );
  });
});

function modelIdentity(modelId = MODEL_ID) {
  return {
    modelId,
    code: "MODEL-1",
    name: "Workbook-owned model",
    description: "Canonical workbook MEF wrapper",
  };
}

describe("workbook-embeddable method definitions", () => {
  it.each([
    ["fault tree", FaultTreeDefinitionSchema, faultTreeDefinition],
    ["Bayesian network", BayesianNetworkDefinitionSchema, bayesianNetworkDefinition],
    ["event tree", EventTreeDefinitionSchema, eventTreeDefinition],
    ["HCL", HclConfigurationDefinitionSchema, hclDefinition],
  ])("keeps the %s definition independent of persistence metadata", (_name, schema, definition) => {
    expect(schema.safeParse(definition).success).toBe(true);
    expect(
      schema.safeParse({
        ...definition,
        projectId: "project-1",
        revision: 1,
        createdBy: "analyst",
        updatedBy: "analyst",
      }).success,
    ).toBe(false);
  });

  it.each([
    [FaultTreeModelSchema, { ...modelIdentity(), ...faultTreeDefinition }],
    [BayesianNetworkModelSchema, { ...modelIdentity(BN_ID), ...bayesianNetworkDefinition }],
    [EventTreeModelSchema, { ...modelIdentity(), ...eventTreeDefinition }],
    [HclConfigurationModelSchema, { ...modelIdentity(), ...hclDefinition }],
  ])("accepts the canonical workbook-local model wrapper", (schema, model) => {
    expect(schema.safeParse(model).success).toBe(true);
    expect(schema.safeParse({ ...model, projectId: "project-1" }).success).toBe(false);
    expect(schema.safeParse({ ...model, revision: 1 }).success).toBe(false);
  });
});
