import type { Model } from "mongoose";
import { WorkbookModelDependenciesResponseSchema } from "interfaces-shared-types/newly-developed-methods";
import type { SyWorkbookDocument } from "../../../sy-workbooks/sy-workbook.schema";
import type { EsWorkbookDocument } from "../../../es-workbooks/es-workbook.schema";
import type { EsqWorkbookDocument } from "../../../esq-workbooks/esq-workbook.schema";
import {
  WorkbookDependencyDiscoveryService,
  escapeJsonPointerSegment,
  findTypedWorkbookReferences,
  referenceTargetsModel,
} from "../workbook-dependency-discovery.service";

const BN_MODEL_ID = "123e4567-e89b-42d3-a456-426614174900";
const BN_NODE_ID = "123e4567-e89b-42d3-a456-426614174901";
const FT_MODEL_ID = "123e4567-e89b-42d3-a456-426614174902";
const TOP_EVENT_ID = "123e4567-e89b-42d3-a456-426614174903";

const mockModel = <T>(documents: unknown[]): Model<T> =>
  ({
    find: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(documents) }),
    }),
  }) as unknown as Model<T>;

describe("WorkbookDependencyDiscoveryService", () => {
  it("finds only strict typed references and escapes JSON-pointer paths", () => {
    const references = findTypedWorkbookReferences({
      "models/active": [
        {
          referenceType: "FAULT_TREE_TOP_EVENT",
          workbookId: "sy-workbook",
          modelId: FT_MODEL_ID,
          entityId: TOP_EVENT_ID,
        },
        { modelId: FT_MODEL_ID, entityId: TOP_EVENT_ID },
      ],
    });

    expect(references).toEqual([
      {
        path: "/models~1active/0",
        reference: {
          referenceType: "FAULT_TREE_TOP_EVENT",
          workbookId: "sy-workbook",
          modelId: FT_MODEL_ID,
          entityId: TOP_EVENT_ID,
        },
      },
    ]);
    expect(escapeJsonPointerSegment("a~/b")).toBe("a~0~1b");
  });

  it("matches model addresses and model-qualified typed references only", () => {
    const target = { workbookId: "esq-workbook", modelId: BN_MODEL_ID };
    expect(referenceTargetsModel(target, target)).toBe(true);
    expect(
      referenceTargetsModel(
        {
          referenceType: "BAYESIAN_NETWORK_NODE",
          ...target,
          entityId: BN_NODE_ID,
        },
        target,
      ),
    ).toBe(true);
    expect(
      referenceTargetsModel(
        {
          referenceType: "FAULT_TREE_BASIC_EVENT",
          workbookId: "sy-workbook",
          entityId: TOP_EVENT_ID,
        },
        target,
      ),
    ).toBe(false);
  });

  it("discovers and sorts references across SY, ES, and ESQ workbook documents", async () => {
    const service = new WorkbookDependencyDiscoveryService(
      mockModel<SyWorkbookDocument>([
        { workbookId: "sy-workbook", mef: { legacy: { modelId: BN_MODEL_ID } } },
      ]),
      mockModel<EsWorkbookDocument>([
        {
          workbookId: "es-workbook",
          mef: {
            eventTrees: [
              {
                functionalEvents: {
                  pump: {
                    faultTreeTopEvent: {
                      referenceType: "FAULT_TREE_TOP_EVENT",
                      workbookId: "sy-workbook",
                      modelId: FT_MODEL_ID,
                      entityId: TOP_EVENT_ID,
                    },
                  },
                },
              },
            ],
          },
        },
      ]),
      mockModel<EsqWorkbookDocument>([
        {
          workbookId: "esq-z",
          mef: {
            hclConfigurations: [
              {
                bayesianNetwork: { workbookId: "esq-workbook", modelId: BN_MODEL_ID },
                bindings: [
                  {
                    bayesianNetworkNode: {
                      referenceType: "BAYESIAN_NETWORK_NODE",
                      workbookId: "esq-workbook",
                      modelId: BN_MODEL_ID,
                      entityId: BN_NODE_ID,
                    },
                  },
                ],
              },
            ],
          },
        },
      ]),
    );

    const result = await service.findModelDependencies({
      workbookId: "esq-workbook",
      modelId: BN_MODEL_ID,
    });

    expect(result.dependencies).toEqual([
      expect.objectContaining({
        sourceHostType: "ESQ",
        sourceWorkbookId: "esq-z",
        path: "/hclConfigurations/0/bayesianNetwork",
      }),
      expect.objectContaining({
        sourceHostType: "ESQ",
        sourceWorkbookId: "esq-z",
        path: "/hclConfigurations/0/bindings/0/bayesianNetworkNode",
      }),
    ]);
    expect(WorkbookModelDependenciesResponseSchema.safeParse(result).success).toBe(true);

    const faultTreeResult = await service.findModelDependencies({
      workbookId: "sy-workbook",
      modelId: FT_MODEL_ID,
    });
    expect(faultTreeResult.dependencies).toEqual([
      expect.objectContaining({ sourceHostType: "ES", sourceWorkbookId: "es-workbook" }),
    ]);
  });

  it("blocks deletion when another workbook contains a typed model reference", async () => {
    const service = new WorkbookDependencyDiscoveryService(
      mockModel<SyWorkbookDocument>([]),
      mockModel<EsWorkbookDocument>([
        {
          workbookId: "es-workbook",
          mef: {
            faultTreeTopEvent: {
              referenceType: "FAULT_TREE_TOP_EVENT",
              workbookId: "sy-workbook",
              modelId: FT_MODEL_ID,
              entityId: TOP_EVENT_ID,
            },
          },
        },
      ]),
      mockModel<EsqWorkbookDocument>([]),
    );

    await expect(
      service.assertModelCanBeDeleted({ workbookId: "sy-workbook", modelId: FT_MODEL_ID }),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        target: { workbookId: "sy-workbook", modelId: FT_MODEL_ID },
        dependencies: [
          expect.objectContaining({ sourceWorkbookId: "es-workbook", path: "/faultTreeTopEvent" }),
        ],
      },
    });
  });

  it("ignores references contained in the model being deleted but not its sibling models", async () => {
    const target = { workbookId: "esq-workbook", modelId: BN_MODEL_ID };
    const serviceWithOnlySelfReference = new WorkbookDependencyDiscoveryService(
      mockModel<SyWorkbookDocument>([]),
      mockModel<EsWorkbookDocument>([]),
      mockModel<EsqWorkbookDocument>([
        {
          workbookId: "esq-workbook",
          mef: { bayesianNetworks: [{ uuid: BN_MODEL_ID, self: target }] },
        },
      ]),
    );
    await expect(
      serviceWithOnlySelfReference.assertModelCanBeDeleted(target, {
        ignoredSourcePathPrefixes: ["/bayesianNetworks/0"],
      }),
    ).resolves.toBeUndefined();

    const serviceWithSiblingReference = new WorkbookDependencyDiscoveryService(
      mockModel<SyWorkbookDocument>([]),
      mockModel<EsWorkbookDocument>([]),
      mockModel<EsqWorkbookDocument>([
        {
          workbookId: "esq-workbook",
          mef: { bayesianNetworks: [{ uuid: BN_MODEL_ID, self: target }, { dependency: target }] },
        },
      ]),
    );
    await expect(
      serviceWithSiblingReference.assertModelCanBeDeleted(target, {
        ignoredSourcePathPrefixes: ["/bayesianNetworks/0"],
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
