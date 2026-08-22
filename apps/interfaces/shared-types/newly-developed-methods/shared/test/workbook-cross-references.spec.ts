import {
  BayesianNetworkNodeReferenceSchema,
  EventTreeFunctionalEventReferenceSchema,
  FaultTreeBasicEventCatalogueReferenceSchema,
  FaultTreeTopEventReferenceSchema,
  HclBindingReferenceSchema,
  WorkbookCrossReferenceSchema,
} from "../..";

const WORKBOOK_ID = "workbook-1";
const MODEL_ID = "123e4567-e89b-42d3-a456-426614174000";
const ENTITY_ID = "123e4567-e89b-42d3-a456-426614174001";

const modelEntityAddress = {
  workbookId: WORKBOOK_ID,
  modelId: MODEL_ID,
  entityId: ENTITY_ID,
};

const references = [
  {
    schema: FaultTreeTopEventReferenceSchema,
    reference: { referenceType: "FAULT_TREE_TOP_EVENT", ...modelEntityAddress },
  },
  {
    schema: FaultTreeBasicEventCatalogueReferenceSchema,
    reference: { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId: WORKBOOK_ID, entityId: ENTITY_ID },
  },
  {
    schema: EventTreeFunctionalEventReferenceSchema,
    reference: { referenceType: "EVENT_TREE_FUNCTIONAL_EVENT", ...modelEntityAddress },
  },
  {
    schema: BayesianNetworkNodeReferenceSchema,
    reference: { referenceType: "BAYESIAN_NETWORK_NODE", ...modelEntityAddress },
  },
  {
    schema: HclBindingReferenceSchema,
    reference: { referenceType: "HCL_BINDING", ...modelEntityAddress },
  },
] as const;

describe("typed cross-workbook references", () => {
  it.each(references)("accepts $reference.referenceType with its required scope", ({ schema, reference }) => {
    expect(schema.safeParse(reference).success).toBe(true);
    expect(WorkbookCrossReferenceSchema.safeParse(reference).success).toBe(true);
  });

  it("keeps the canonical fault-tree basic-event catalogue at workbook scope", () => {
    const reference = { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId: WORKBOOK_ID, entityId: ENTITY_ID };
    expect(FaultTreeBasicEventCatalogueReferenceSchema.safeParse(reference).success).toBe(true);
    expect(FaultTreeBasicEventCatalogueReferenceSchema.safeParse({ ...reference, modelId: MODEL_ID }).success).toBe(false);
  });

  it.each([
    { referenceType: "FAULT_TREE_TOP_EVENT", workbookId: WORKBOOK_ID, entityId: ENTITY_ID },
    { referenceType: "EVENT_TREE_FUNCTIONAL_EVENT", workbookId: WORKBOOK_ID, entityId: ENTITY_ID },
    { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: WORKBOOK_ID, entityId: ENTITY_ID },
    { referenceType: "HCL_BINDING", workbookId: WORKBOOK_ID, entityId: ENTITY_ID },
  ])("requires model scope for $referenceType", (reference) => {
    expect(WorkbookCrossReferenceSchema.safeParse(reference).success).toBe(false);
  });

  it.each([
    { ...references[0].reference, workbookRevision: 4 },
    { ...references[0].reference, projectId: "project-1" },
    { ...references[0].reference, code: "TOP-EVENT" },
    { ...references[0].reference, name: "Renamed top event" },
  ])("rejects mutable, project, snapshot, or display metadata %#", (reference) => {
    expect(WorkbookCrossReferenceSchema.safeParse(reference).success).toBe(false);
  });

  it.each([
    { ...references[0].reference, workbookId: " " },
    { ...references[0].reference, modelId: "FT-1" },
    { ...references[0].reference, entityId: "TOP-1" },
    { ...references[0].reference, referenceType: "FAULT_TREE_GATE" },
  ])("rejects malformed or untyped targets %#", (reference) => {
    expect(WorkbookCrossReferenceSchema.safeParse(reference).success).toBe(false);
  });

  it("does not let one typed schema impersonate another target kind", () => {
    expect(BayesianNetworkNodeReferenceSchema.safeParse(references[0].reference).success).toBe(false);
    expect(HclBindingReferenceSchema.safeParse(references[2].reference).success).toBe(false);
  });
});
