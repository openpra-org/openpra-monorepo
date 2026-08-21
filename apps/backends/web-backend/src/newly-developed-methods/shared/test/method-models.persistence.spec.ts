import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Model } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ProjectsService } from "../../../projects/projects.service";
import {
  AnalysisRunRecord,
  AnalysisRunRecordSchema,
  type AnalysisRunRecordDocument,
} from "../analysis-run-record.schema";
import { MethodModelRecord, MethodModelRecordSchema } from "../method-model-record.schema";
import { MethodModelsService } from "../method-models.service";

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
  let analysisRunModel: Model<AnalysisRunRecordDocument>;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongo.getUri()),
        MongooseModule.forFeature([
          { name: MethodModelRecord.name, schema: MethodModelRecordSchema },
          { name: AnalysisRunRecord.name, schema: AnalysisRunRecordSchema },
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
      ],
    }).compile();
    service = moduleRef.get(MethodModelsService);
    analysisRunModel = moduleRef.get(getModelToken(AnalysisRunRecord.name));
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
      service.deleteModel("project-1", bayesianNetwork.id, acting),
    ).rejects.toMatchObject({
      response: {
        message: "Model cannot be deleted while another model references it",
        dependency: {
          id: hcl.id,
          methodType: "HYBRID_CAUSAL_LOGIC",
          code: "HCL-DEPENDENCY",
        },
      },
    });

    await service.deleteModel("project-1", hcl.id, acting);
    await expect(service.deleteModel("project-1", bayesianNetwork.id, acting)).resolves.toBeUndefined();
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

  it("persists a queued analysis run and retrieves its eventual typed result", async () => {
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
      status: "QUEUED",
    });
    await expect(
      service.getAnalysisRun("project-1", faultTree.id, created.run.id, acting),
    ).resolves.toEqual(created.run);
    await expect(
      service.getAnalysisRunResult("project-1", faultTree.id, created.run.id, acting),
    ).rejects.toThrow("Analysis result is not available while the run is QUEUED");

    const startedAt = new Date(created.run.requestedAt);
    startedAt.setSeconds(startedAt.getSeconds() + 1);
    const completedAt = new Date(startedAt);
    completedAt.setSeconds(completedAt.getSeconds() + 1);
    const result = {
      schemaVersion: "1.0.0" as const,
      runId: created.run.id,
      modelId: faultTree.id,
      modelRevision: revision,
      topGateId: gateId,
      topEventProbability: 0.01,
      minimalCutSetCount: 0,
      leadingCutSets: [],
      validationIssues: [],
      completedAt: completedAt.toISOString(),
    };
    await analysisRunModel.updateOne(
      { id: created.run.id },
      {
        $set: {
          status: "SUCCEEDED",
          startedAt,
          completedAt,
          engine: { name: "PRAXIS", version: "0.1.0" },
          result,
        },
      },
    );

    await expect(
      service.getAnalysisRunResult("project-1", faultTree.id, created.run.id, acting),
    ).resolves.toMatchObject({
      run: { id: created.run.id, status: "SUCCEEDED" },
      result,
    });
  });
});
