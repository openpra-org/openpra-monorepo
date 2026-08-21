import type { CanActivate, ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { MethodModelsController } from "../method-models.controller";
import { MethodModelsService } from "../method-models.service";

describe("MethodModelsController", () => {
  let app: INestApplication;
  let methodModelsServiceMock: {
    listProjectModels: jest.Mock;
    createModel: jest.Mock;
    loadModel: jest.Mock;
    patchModel: jest.Mock;
    validateModel: jest.Mock;
    createAnalysisRun: jest.Mock;
    getAnalysisRun: jest.Mock;
    getAnalysisRunResult: jest.Mock;
    deleteModel: jest.Mock;
  };

  beforeEach(async () => {
    methodModelsServiceMock = {
      listProjectModels: jest.fn().mockResolvedValue({ models: [] }),
      createModel: jest.fn().mockResolvedValue({ id: "model-1" }),
      loadModel: jest.fn().mockResolvedValue({ id: "model-1" }),
      patchModel: jest.fn().mockResolvedValue({ id: "model-1", revision: 2 }),
      validateModel: jest.fn().mockResolvedValue({
        validation: { mode: "DRAFT", valid: false },
        saveAllowed: true,
      }),
      createAnalysisRun: jest.fn().mockResolvedValue({
        schemaVersion: "1.0.0",
        run: { id: "123e4567-e89b-42d3-a456-426614174010", status: "QUEUED" },
      }),
      getAnalysisRun: jest.fn().mockResolvedValue({
        id: "123e4567-e89b-42d3-a456-426614174010",
        status: "QUEUED",
      }),
      getAnalysisRunResult: jest.fn().mockResolvedValue({
        run: { id: "123e4567-e89b-42d3-a456-426614174010", status: "SUCCEEDED" },
        result: { topEventProbability: 0.01 },
      }),
      deleteModel: jest.fn().mockResolvedValue(undefined),
    };
    const authenticatedGuard: CanActivate = {
      canActivate(context: ExecutionContext): boolean {
        context.switchToHttp().getRequest().user = { username: "ada" };
        return true;
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [MethodModelsController],
      providers: [{ provide: MethodModelsService, useValue: methodModelsServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authenticatedGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("passes a supported method type and the authenticated user to the service", async () => {
    const response = await request(app.getHttpServer()).get(
      "/api/projects/project-1/method-models?methodType=EVENT_TREE",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ models: [] });
    expect(methodModelsServiceMock.listProjectModels).toHaveBeenCalledWith("project-1", "EVENT_TREE", {
      username: "ada",
    });
  });

  it("rejects missing or unsupported method types before querying", async () => {
    for (const query of ["", "?methodType=DYNAMIC_EVENT_TREE"]) {
      const response = await request(app.getHttpServer()).get(`/api/projects/project-1/method-models${query}`);
      expect(response.status).toBe(400);
    }

    expect(methodModelsServiceMock.listProjectModels).not.toHaveBeenCalled();
  });

  it("validates and delegates model creation", async () => {
    const body = {
      schemaVersion: "1.0.0",
      projectId: "project-1",
      methodType: "FAULT_TREE",
      code: "FT-001",
      name: "Reactor trip failure",
      description: "Fails to trip when demanded.",
      createdBy: "ada",
    };

    const response = await request(app.getHttpServer())
      .post("/api/projects/project-1/method-models")
      .send(body);

    expect(response.status).toBe(201);
    expect(methodModelsServiceMock.createModel).toHaveBeenCalledWith("project-1", body, {
      username: "ada",
    });

    const invalid = await request(app.getHttpServer())
      .post("/api/projects/project-1/method-models")
      .send({ ...body, methodType: "DYNAMIC_EVENT_TREE" });
    expect(invalid.status).toBe(400);
  });

  it("delegates project-scoped load and delete operations", async () => {
    const loaded = await request(app.getHttpServer()).get(
      "/api/projects/project-1/method-models/model-1",
    );
    const removed = await request(app.getHttpServer()).delete(
      "/api/projects/project-1/method-models/model-1",
    );

    expect(loaded.status).toBe(200);
    expect(methodModelsServiceMock.loadModel).toHaveBeenCalledWith("project-1", "model-1", {
      username: "ada",
    });
    expect(removed.status).toBe(204);
    expect(methodModelsServiceMock.deleteModel).toHaveBeenCalledWith("project-1", "model-1", {
      username: "ada",
    });
  });

  it("validates and delegates a partial patch", async () => {
    const modelId = "123e4567-e89b-42d3-a456-426614174000";
    const body = {
      schemaVersion: "1.0.0",
      methodType: "FAULT_TREE",
      modelId,
      expectedRevision: 1,
      updatedBy: "ada",
      changes: { name: "Updated name" },
    };

    const response = await request(app.getHttpServer())
      .patch(`/api/projects/project-1/method-models/${modelId}`)
      .send(body);

    expect(response.status).toBe(200);
    expect(methodModelsServiceMock.patchModel).toHaveBeenCalledWith("project-1", modelId, body, {
      username: "ada",
    });

    const invalid = await request(app.getHttpServer())
      .patch(`/api/projects/project-1/method-models/${modelId}`)
      .send({ ...body, changes: {} });
    expect(invalid.status).toBe(400);
  });

  it("validates and delegates draft or analysis-ready validation requests", async () => {
    const modelId = "123e4567-e89b-42d3-a456-426614174000";
    const body = {
      schemaVersion: "1.0.0",
      methodType: "FAULT_TREE",
      modelId,
      revision: 2,
      mode: "DRAFT",
      requestedBy: "ada",
    };

    const response = await request(app.getHttpServer())
      .post(`/api/projects/project-1/method-models/${modelId}/validate`)
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body.saveAllowed).toBe(true);
    expect(methodModelsServiceMock.validateModel).toHaveBeenCalledWith(
      "project-1",
      modelId,
      body,
      { username: "ada" },
    );

    const invalid = await request(app.getHttpServer())
      .post(`/api/projects/project-1/method-models/${modelId}/validate`)
      .send({ ...body, mode: "PREVIEW" });
    expect(invalid.status).toBe(400);
  });

  it("validates and delegates analysis-run creation", async () => {
    const modelId = "123e4567-e89b-42d3-a456-426614174000";
    const body = {
      schemaVersion: "1.0.0",
      methodType: "EVENT_TREE",
      modelId,
      revision: 2,
      mode: "INDEPENDENT",
      requestedBy: "ada",
    };

    const response = await request(app.getHttpServer())
      .post(`/api/projects/project-1/method-models/${modelId}/runs`)
      .send(body);

    expect(response.status).toBe(202);
    expect(methodModelsServiceMock.createAnalysisRun).toHaveBeenCalledWith(
      "project-1",
      modelId,
      body,
      { username: "ada" },
    );

    const invalid = await request(app.getHttpServer())
      .post(`/api/projects/project-1/method-models/${modelId}/runs`)
      .send({ ...body, mode: "HCL" });
    expect(invalid.status).toBe(400);
  });

  it("delegates analysis-run status and result retrieval", async () => {
    const modelId = "123e4567-e89b-42d3-a456-426614174000";
    const runId = "123e4567-e89b-42d3-a456-426614174010";

    const status = await request(app.getHttpServer()).get(
      `/api/projects/project-1/method-models/${modelId}/runs/${runId}`,
    );
    const result = await request(app.getHttpServer()).get(
      `/api/projects/project-1/method-models/${modelId}/runs/${runId}/result`,
    );

    expect(status.status).toBe(200);
    expect(result.status).toBe(200);
    expect(methodModelsServiceMock.getAnalysisRun).toHaveBeenCalledWith(
      "project-1",
      modelId,
      runId,
      { username: "ada" },
    );
    expect(methodModelsServiceMock.getAnalysisRunResult).toHaveBeenCalledWith(
      "project-1",
      modelId,
      runId,
      { username: "ada" },
    );
  });
});
