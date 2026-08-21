import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Model } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ProjectsService } from "../../../projects/projects.service";
import { WorkbookElementRegistry } from "../../../workbooks/workbook-element-registry";
import {
  Workbook,
  WorkbookSchema,
  type WorkbookDocument,
} from "../../../workbooks/workbook.schema";
import {
  FaultTreeBasicEventCatalogueRecord,
  FaultTreeBasicEventCatalogueRecordSchema,
} from "../../fault-tree/fault-tree-basic-event-catalogue-record.schema";
import {
  AnalysisRunRecord,
  AnalysisRunRecordSchema,
} from "../analysis-run-record.schema";
import { MethodModelRecord, MethodModelRecordSchema } from "../method-model-record.schema";
import { MethodModelsService } from "../method-models.service";
import { PraetorAnalysisClient } from "../praetor-analysis.client";

const acting = { username: "ada" };
const requestMetadata = {
  schemaVersion: "1.0.0" as const,
  projectId: "project-1",
  name: "Analysis model",
  description: "An editable draft.",
  createdBy: "ada",
};

describe("MethodModelsService Mongo persistence", () => {
  let mongo: MongoMemoryServer;
  let service: MethodModelsService;
  let workbookModel: Model<WorkbookDocument>;
  let workbookElementRegistry: { tryGet: jest.Mock };
  let moduleRef: TestingModule;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    workbookElementRegistry = { tryGet: jest.fn().mockReturnValue(undefined) };
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongo.getUri()),
        MongooseModule.forFeature([
          { name: MethodModelRecord.name, schema: MethodModelRecordSchema },
          { name: AnalysisRunRecord.name, schema: AnalysisRunRecordSchema },
          {
            name: FaultTreeBasicEventCatalogueRecord.name,
            schema: FaultTreeBasicEventCatalogueRecordSchema,
          },
          { name: Workbook.name, schema: WorkbookSchema },
        ]),
      ],
      providers: [
        MethodModelsService,
        {
          provide: ProjectsService,
          useValue: {
            resolveAccess: jest.fn().mockResolvedValue({ doc: {}, role: "editor" }),
          },
        },
        {
          provide: WorkbookElementRegistry,
          useValue: workbookElementRegistry,
        },
        {
          provide: PraetorAnalysisClient,
          useValue: {
            execute: jest.fn().mockImplementation(
              (envelope: {
                request: { modelId: string; revision: number };
                modelSnapshots: Array<{
                  methodType: string;
                  topGate?: { gateId: string } | null;
                }>;
              }) => {
                const faultTree = envelope.modelSnapshots.find(
                  (model) => model.methodType === "FAULT_TREE",
                );
                return Promise.resolve({
                  schemaVersion: "1.0.0",
                  result: {
                    methodType: "FAULT_TREE",
                    modelId: envelope.request.modelId,
                    modelRevision: envelope.request.revision,
                    topGateId: faultTree?.topGate?.gateId,
                    topEventProbability: 0.01,
                    minimalCutSetCount: 0,
                    leadingCutSets: [],
                    validationIssues: [],
                  },
                });
              },
            ),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(MethodModelsService);
    workbookModel = moduleRef.get(getModelToken(Workbook.name));
  }, 90_000);

  afterAll(async () => {
    await moduleRef.close();
    await mongo.stop();
  });

  it("round-trips a draft through create, typed list, load, and delete", async () => {
    const created = await service.createModel(
      "project-1",
      { ...requestMetadata, methodType: "FAULT_TREE", code: "FT-ROUNDTRIP" },
      acting,
    );

    await expect(service.loadModel("project-1", created.id, acting)).resolves.toEqual(created);
    await expect(service.listProjectModels("project-1", "FAULT_TREE", acting)).resolves.toEqual({
      models: [
        expect.objectContaining({
          id: created.id,
          code: "FT-ROUNDTRIP",
          revision: 1,
        }),
      ],
    });

    const patched = await service.patchModel(
      "project-1",
      created.id,
      {
        schemaVersion: "1.0.0",
        methodType: "FAULT_TREE",
        modelId: created.id,
        expectedRevision: 1,
        updatedBy: "ada",
        changes: { name: "Renamed FT" },
      },
      acting,
    );
    expect(patched).toMatchObject({
      id: created.id,
      code: "FT-ROUNDTRIP",
      name: "Renamed FT",
      revision: 2,
      gates: [],
    });
    await expect(service.loadModel("project-1", created.id, acting)).resolves.toEqual(patched);

    await service.deleteModel("project-1", created.id, acting);
    await expect(service.loadModel("project-1", created.id, acting)).rejects.toThrow(
      "Method model not found",
    );
  });

  it("blocks a real delete while an HCL model references the BN", async () => {
    const bayesianNetwork = await service.createModel(
      "project-1",
      { ...requestMetadata, methodType: "BAYESIAN_NETWORK", code: "BN-DEPENDENCY" },
      acting,
    );
    const hcl = await service.createModel(
      "project-1",
      {
        ...requestMetadata,
        methodType: "HYBRID_CAUSAL_LOGIC",
        code: "HCL-DEPENDENCY",
        bayesianNetwork: { modelId: bayesianNetwork.id },
      },
      acting,
    );

    const draftValidation = await service.validateModel(
      "project-1",
      hcl.id,
      {
        schemaVersion: "1.0.0",
        methodType: "HYBRID_CAUSAL_LOGIC",
        modelId: hcl.id,
        revision: 1,
        mode: "DRAFT",
        requestedBy: "ada",
      },
      acting,
    );
    const analysisValidation = await service.validateModel(
      "project-1",
      hcl.id,
      {
        schemaVersion: "1.0.0",
        methodType: "HYBRID_CAUSAL_LOGIC",
        modelId: hcl.id,
        revision: 1,
        mode: "ANALYSIS_READY",
        requestedBy: "ada",
      },
      acting,
    );
    expect(draftValidation).toMatchObject({
      validation: { valid: false },
      saveAllowed: true,
    });
    expect(draftValidation.validation.issues.map((issue) => issue.code)).toContain(
      "HCL_FAULT_TREE_REQUIRED",
    );
    expect(analysisValidation).toMatchObject({
      validation: { valid: false },
      quantificationAllowed: false,
    });

    await expect(
      service.findModelDependencies("project-1", bayesianNetwork.id, acting),
    ).resolves.toMatchObject({
      modelId: bayesianNetwork.id,
      models: [
        {
          id: hcl.id,
          methodType: "HYBRID_CAUSAL_LOGIC",
          code: "HCL-DEPENDENCY",
          referencePaths: ["/bayesianNetwork/modelId"],
        },
      ],
      workbooks: [],
    });

    await expect(
      service.deleteModel("project-1", bayesianNetwork.id, acting),
    ).rejects.toMatchObject({
      response: {
        message: "Model cannot be deleted while models or workbooks reference it",
        dependencies: {
          models: [
            {
              id: hcl.id,
              methodType: "HYBRID_CAUSAL_LOGIC",
              code: "HCL-DEPENDENCY",
            },
          ],
        },
      },
    });

    await service.deleteModel("project-1", hcl.id, acting);
    await expect(service.deleteModel("project-1", bayesianNetwork.id, acting)).resolves.toBeUndefined();
  });

  it("finds a controlled reference in a persisted project workbook", async () => {
    const projectId = "project-workbook-dependency";
    const target = await service.createModel(
      projectId,
      { ...requestMetadata, projectId, methodType: "FAULT_TREE", code: "FT-WORKBOOK" },
      acting,
    );
    const workbook = await workbookModel.create({
      projectId,
      elementCode: "SY",
      name: "Systems dependency",
      status: "draft",
      version: 1,
      ownerUsername: "ada",
      ownerFullName: "Ada Lovelace",
    });
    workbookElementRegistry.tryGet.mockReturnValue({
      load: jest.fn().mockResolvedValue({
        projectId,
        ownerUsername: "ada",
        mef: { systems: [{ faultTree: { modelId: target.id } }] },
      }),
    });

    await expect(
      service.findModelDependencies(projectId, target.id, acting),
    ).resolves.toMatchObject({
      modelId: target.id,
      models: [],
      workbooks: [
        {
          id: String(workbook._id),
          projectId,
          elementCode: "SY",
          name: "Systems dependency",
          referencePaths: ["/systems/0/faultTree/modelId"],
        },
      ],
    });
    await expect(service.deleteModel(projectId, target.id, acting)).rejects.toMatchObject({
      response: {
        dependencies: {
          workbooks: [{ id: String(workbook._id) }],
        },
      },
    });

    await workbook.deleteOne();
    workbookElementRegistry.tryGet.mockReturnValue(undefined);
    await expect(service.deleteModel(projectId, target.id, acting)).resolves.toBeUndefined();
  });

  it("dispatches stored BN and ET models to their method validators", async () => {
    const bayesianNetwork = await service.createModel(
      "project-1",
      { ...requestMetadata, methodType: "BAYESIAN_NETWORK", code: "BN-VALIDATE" },
      acting,
    );
    const eventTree = await service.createModel(
      "project-1",
      { ...requestMetadata, methodType: "EVENT_TREE", code: "ET-VALIDATE" },
      acting,
    );

    const bnValidation = await service.validateModel(
      "project-1",
      bayesianNetwork.id,
      {
        schemaVersion: "1.0.0",
        methodType: "BAYESIAN_NETWORK",
        modelId: bayesianNetwork.id,
        revision: 1,
        mode: "ANALYSIS_READY",
        requestedBy: "ada",
      },
      acting,
    );
    const etValidation = await service.validateModel(
      "project-1",
      eventTree.id,
      {
        schemaVersion: "1.0.0",
        methodType: "EVENT_TREE",
        modelId: eventTree.id,
        revision: 1,
        mode: "DRAFT",
        requestedBy: "ada",
      },
      acting,
    );

    expect(bnValidation).toMatchObject({
      validation: { mode: "ANALYSIS_READY", modelId: bayesianNetwork.id },
      quantificationAllowed: true,
    });
    expect(etValidation).toMatchObject({
      validation: { mode: "DRAFT", modelId: eventTree.id, valid: false },
      saveAllowed: true,
    });
    expect(etValidation.validation.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["ET_INITIATING_EVENT_REQUIRED", "ET_FUNCTIONAL_EVENT_REQUIRED"]),
    );

    await service.deleteModel("project-1", eventTree.id, acting);
    await service.deleteModel("project-1", bayesianNetwork.id, acting);
  });

  it("persists a completed analysis run and retrieves its typed result", async () => {
    const faultTree = await service.createModel(
      "project-1",
      { ...requestMetadata, methodType: "FAULT_TREE", code: "FT-RUN" },
      acting,
    );
    const gateId = "123e4567-e89b-42d3-a456-426614174220";
    const leafId = "123e4567-e89b-42d3-a456-426614174221";
    let revision = faultTree.revision;
    for (const changes of [
      {
        gates: [
          {
            id: gateId,
            code: "TOP",
            name: "Top gate",
            description: "Top event logic.",
            kind: "GATE" as const,
            gateType: "OR" as const,
          },
        ],
      },
      {
        leafNodes: [
          {
            id: leafId,
            code: "UE-1",
            name: "Undeveloped event",
            description: "Leaf event.",
            kind: "UNDEVELOPED_EVENT" as const,
          },
        ],
      },
      {
        gateInputs: [
          {
            id: "123e4567-e89b-42d3-a456-426614174222",
            gateId,
            childId: leafId,
            order: 0,
          },
        ],
      },
      { topGate: { gateId } },
    ]) {
      const patched = await service.patchModel(
        "project-1",
        faultTree.id,
        {
          schemaVersion: "1.0.0",
          methodType: "FAULT_TREE",
          modelId: faultTree.id,
          expectedRevision: revision,
          updatedBy: "ada",
          changes,
        },
        acting,
      );
      revision = patched.revision;
    }

    const created = await service.createAnalysisRun(
      "project-1",
      faultTree.id,
      {
        schemaVersion: "1.0.0",
        methodType: "FAULT_TREE",
        modelId: faultTree.id,
        revision,
        requestedBy: "ada",
      },
      acting,
    );
    expect(created.run).toMatchObject({
      modelId: faultTree.id,
      modelRevision: revision,
      status: "SUCCEEDED",
    });
    await expect(
      service.getAnalysisRun("project-1", faultTree.id, created.run.id, acting),
    ).resolves.toEqual(created.run);
    const completed = await service.getAnalysisRunResult(
      "project-1",
      faultTree.id,
      created.run.id,
      acting,
    );
    expect(completed).toMatchObject({
      run: { id: created.run.id, status: "SUCCEEDED" },
      result: {
        modelId: faultTree.id,
        modelRevision: revision,
        topGateId: gateId,
        topEventProbability: 0.01,
      },
    });
  });
});
