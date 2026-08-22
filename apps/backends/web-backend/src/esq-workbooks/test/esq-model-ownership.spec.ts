import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { createBlankEsq } from "../blank-esq";

const BN_MODEL_ID = "123e4567-e89b-42d3-a456-426614174301";
const BN_NODE_ID = "123e4567-e89b-42d3-a456-426614174302";
const BN_FALSE_STATE_ID = "123e4567-e89b-42d3-a456-426614174303";
const BN_TRUE_STATE_ID = "123e4567-e89b-42d3-a456-426614174304";
const FT_MODEL_ID = "123e4567-e89b-42d3-a456-426614174305";
const FT_BASIC_EVENT_ID = "123e4567-e89b-42d3-a456-426614174306";
const HCL_MODEL_ID = "123e4567-e89b-42d3-a456-426614174307";
const HCL_BINDING_ID = "123e4567-e89b-42d3-a456-426614174308";

describe("ESQ workbook BN and HCL persistence", () => {
  it("initializes both workbook-owned collections for a blank ESQ workbook", () => {
    const mef = createBlankEsq("ESQ ownership", "analyst");

    expect(mef.bayesianNetworks).toEqual([]);
    expect(mef.hclConfigurations).toEqual([]);
  });

  it("round-trips BN and HCL data through the complete ESQ workbook MEF schema", () => {
    const mef = createBlankEsq("ESQ ownership", "analyst");
    mef.bayesianNetworks = [
      {
        modelId: BN_MODEL_ID,
        code: "BN-DEPENDENCY",
        name: "Dependency network",
        description: "ESQ-owned dependency model",
        nodes: [
          {
            id: BN_NODE_ID,
            code: "PUMP-AVAILABLE",
            name: "Pump available",
            description: "Pump dependency state",
            kind: "CHANCE_NODE",
            states: [
              { id: BN_FALSE_STATE_ID, code: "FALSE", name: "False" },
              { id: BN_TRUE_STATE_ID, code: "TRUE", name: "True" },
            ],
          },
        ],
        edges: [],
        conditionalProbabilityTables: [],
        nodePositions: [{ nodeId: BN_NODE_ID, position: { x: 80, y: 40 } }],
        layout: {
          viewport: { x: 0, y: 0, zoom: 1 },
          mode: "MANUAL",
          direction: "LEFT_TO_RIGHT",
        },
      },
    ];
    mef.hclConfigurations = [
      {
        modelId: HCL_MODEL_ID,
        code: "HCL-DEPENDENCY",
        name: "Dependency bindings",
        description: "ESQ-owned HCL configuration",
        bayesianNetwork: { workbookId: "esq-workbook", modelId: BN_MODEL_ID },
        faultTrees: [{ workbookId: "sy-workbook", modelId: FT_MODEL_ID }],
        bindings: [
          {
            id: HCL_BINDING_ID,
            faultTreeBasicEvent: {
              referenceType: "FAULT_TREE_BASIC_EVENT",
              workbookId: "sy-workbook",
              entityId: FT_BASIC_EVENT_ID,
            },
            bayesianNetworkNode: {
              referenceType: "BAYESIAN_NETWORK_NODE",
              workbookId: "esq-workbook",
              modelId: BN_MODEL_ID,
              entityId: BN_NODE_ID,
            },
            trueStateIds: [BN_TRUE_STATE_ID],
          },
        ],
        baseEvidence: { observations: [] },
        solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
      },
    ];

    const parsed = EventSequenceQuantificationSchema.parse(JSON.parse(JSON.stringify(mef)));

    expect(parsed.bayesianNetworks).toEqual(mef.bayesianNetworks);
    expect(parsed.hclConfigurations).toEqual(mef.hclConfigurations);

    const duplicateWithinCollection = structuredClone(mef);
    duplicateWithinCollection.bayesianNetworks.push({ ...mef.bayesianNetworks[0]!, code: "BN-DUPLICATE" });
    expect(EventSequenceQuantificationSchema.safeParse(duplicateWithinCollection).success).toBe(false);

    const duplicateAcrossCollections = structuredClone(mef);
    duplicateAcrossCollections.hclConfigurations[0]!.modelId = BN_MODEL_ID;
    expect(EventSequenceQuantificationSchema.safeParse(duplicateAcrossCollections).success).toBe(false);
  });

  it("heals legacy ESQ payloads and does not persist a project model collection", () => {
    const legacyMef = createBlankEsq("Legacy ESQ", "analyst") as unknown as Record<string, unknown>;
    delete legacyMef.bayesianNetworks;
    delete legacyMef.hclConfigurations;
    legacyMef.methodModels = [{ projectId: "project-1", methodType: "BAYESIAN_NETWORK" }];

    const parsed = EventSequenceQuantificationSchema.parse(legacyMef);

    expect(parsed.bayesianNetworks).toEqual([]);
    expect(parsed.hclConfigurations).toEqual([]);
    expect(parsed).not.toHaveProperty("methodModels");
  });
});
