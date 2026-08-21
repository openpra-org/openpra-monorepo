import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { getModelToken } from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";
import {
  MethodAnalysisRunResultSchema,
  MethodModelExecuteResultSchema,
  MethodModelListResponseSchema,
  NewlyDevelopedMethodModelSchema,
} from "interfaces-shared-types/newly-developed-methods";
import { ProjectsService } from "../../../projects/projects.service";
import { AnalysisRunRecord } from "../analysis-run-record.schema";
import { MethodModelRecord } from "../method-model-record.schema";
import { MethodModelsService } from "../method-models.service";

const MODEL_ID = "123e4567-e89b-42d3-a456-426614174000";
const BN_MODEL_ID = "123e4567-e89b-42d3-a456-426614174001";
const RUN_ID = "123e4567-e89b-42d3-a456-426614174010";

function makeFaultTree(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: MODEL_ID,
    projectId: "project-1",
    methodType: "FAULT_TREE",
    code: "FT-001",
    name: "Reactor trip failure",
    description: "Fails to trip when demanded.",
    schemaVersion: "1.0.0",
    revision: 2,
    createdBy: "ada",
    createdAt: "2026-08-20T19:30:00.000Z",
    updatedBy: "grace",
    updatedAt: "2026-08-20T20:00:00.000Z",
    topGate: null,
    gates: [],
    leafNodes: [],
    gateInputs: [],
    nodePositions: [],
    layout: {
      viewport: { x: 0, y: 0, zoom: 1 },
      mode: "MANUAL",
      direction: "TOP_TO_BOTTOM",
    },
    ...overrides,
  };
}

function makeRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: MODEL_ID,
    projectId: "project-1",
    methodType: "FAULT_TREE",
    code: "FT-001",
    name: "Reactor trip failure",
    description: "Fails to trip when demanded.",
    schemaVersion: "1.0.0",
    revision: 2,
    createdBy: "ada",
    createdAt: new Date("2026-08-20T19:30:00.000Z"),
    updatedBy: "grace",
    updatedAt: new Date("2026-08-20T20:00:00.000Z"),
    model: makeFaultTree(),
    internalPayload: { indexingHint: true },
    deleteOne: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeRunRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: "1.0.0",
    id: RUN_ID,
    projectId: "project-1",
    modelId: MODEL_ID,
    modelRevision: 2,
    methodType: "FAULT_TREE",
    status: "QUEUED",
    requestedBy: "ada",
    requestedAt: new Date("2026-08-20T20:00:00.000Z"),
    startedAt: null,
    completedAt: null,
    engine: null,
    request: {
      schemaVersion: "1.0.0",
      methodType: "FAULT_TREE",
      modelId: MODEL_ID,
      revision: 2,
      requestedBy: "ada",
    },
    result: null,
    ...overrides,
  };
}

function makeAnalysisReadyFaultTree(): Record<string, unknown> {
  const gateId = "123e4567-e89b-42d3-a456-426614174020";
  const leafId = "123e4567-e89b-42d3-a456-426614174021";
  return makeFaultTree({
    topGate: { gateId },
    gates: [
      {
        id: gateId,
        code: "TOP",
        name: "Top gate",
        description: "Top event logic.",
        kind: "GATE",
        gateType: "OR",
      },
    ],
    leafNodes: [
      {
        id: leafId,
        code: "UE-1",
        name: "Undeveloped event",
        description: "Leaf event.",
        kind: "UNDEVELOPED_EVENT",
      },
    ],
    gateInputs: [
      {
        id: "123e4567-e89b-42d3-a456-426614174022",
        gateId,
        childId: leafId,
        order: 0,
      },
    ],
  });
}

function makeBayesianNetwork(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: BN_MODEL_ID,
    projectId: "project-1",
    methodType: "BAYESIAN_NETWORK",
    code: "BN-001",
    name: "Dependency network",
    description: "Dependency model.",
    schemaVersion: "1.0.0",
    revision: 2,
    createdBy: "ada",
    createdAt: "2026-08-20T19:30:00.000Z",
    updatedBy: "ada",
    updatedAt: "2026-08-20T20:00:00.000Z",
    nodes: [],
    edges: [],
    conditionalProbabilityTables: [],
    nodePositions: [],
    layout: {
      viewport: { x: 0, y: 0, zoom: 1 },
      mode: "MANUAL",
      direction: "LEFT_TO_RIGHT",
    },
    ...overrides,
  };
}

describe("MethodModelsService", () => {
  let service: MethodModelsService;
  let methodModelMock: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    create: jest.Mock;
  };
  let projectsServiceMock: { resolveAccess: jest.Mock };
  let analysisRunModelMock: {
    findOne: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(async () => {
    methodModelMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      create: jest.fn(),
    };
    analysisRunModelMock = {
      findOne: jest.fn(),
      create: jest.fn(),
    };
    projectsServiceMock = {
      resolveAccess: jest.fn().mockResolvedValue({ doc: {}, role: "viewer" }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MethodModelsService,
        { provide: getModelToken(MethodModelRecord.name), useValue: methodModelMock },
        { provide: getModelToken(AnalysisRunRecord.name), useValue: analysisRunModelMock },
        { provide: ProjectsService, useValue: projectsServiceMock },
      ],
    }).compile();

    service = moduleRef.get(MethodModelsService);
  });

  it("lists metadata scoped to one project and method type in stable recency order", async () => {
    const exec = jest.fn().mockResolvedValue([makeRecord()]);
    const sort = jest.fn().mockReturnValue({ exec });
    methodModelMock.find.mockReturnValue({ sort });

    const result = await service.listProjectModels("project-1", "FAULT_TREE", {
      username: "ada",
    });

    expect(projectsServiceMock.resolveAccess).toHaveBeenCalledWith("project-1", {
      username: "ada",
    });
    expect(methodModelMock.find).toHaveBeenCalledWith({
      projectId: "project-1",
      methodType: "FAULT_TREE",
    });
    expect(sort).toHaveBeenCalledWith({ updatedAt: -1, id: 1 });
    expect(result.models).toEqual([
      expect.objectContaining({
        id: MODEL_ID,
        methodType: "FAULT_TREE",
        updatedAt: "2026-08-20T20:00:00.000Z",
      }),
    ]);
    expect(result.models[0]).not.toHaveProperty("internalPayload");
    expect(MethodModelListResponseSchema.safeParse(result).success).toBe(true);
  });

  it("does not query model metadata when the caller cannot access the project", async () => {
    projectsServiceMock.resolveAccess.mockRejectedValue(new NotFoundException("Project not found"));

    await expect(
      service.listProjectModels("private-project", "BAYESIAN_NETWORK", {
        username: "mallory",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(methodModelMock.find).not.toHaveBeenCalled();
  });

  describe("createModel", () => {
    const baseRequest = {
      schemaVersion: "1.0.0" as const,
      projectId: "project-1",
      code: "MODEL-001",
      name: "Analysis model",
      description: "An editable draft.",
      createdBy: "ada",
    };

    it.each([
      { ...baseRequest, methodType: "FAULT_TREE" as const },
      { ...baseRequest, methodType: "BAYESIAN_NETWORK" as const },
      { ...baseRequest, methodType: "EVENT_TREE" as const },
      {
        ...baseRequest,
        methodType: "HYBRID_CAUSAL_LOGIC" as const,
        bayesianNetwork: { modelId: BN_MODEL_ID },
      },
    ])("creates a schema-valid empty $methodType draft", async (request) => {
      projectsServiceMock.resolveAccess.mockResolvedValue({ doc: {}, role: "editor" });
      methodModelMock.create.mockImplementation((record: Record<string, unknown>) => Promise.resolve(record));

      const result = await service.createModel("project-1", request, {
        username: "ada",
      });

      expect(result.methodType).toBe(request.methodType);
      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(result.revision).toBe(1);
      expect(result.createdBy).toBe("ada");
      expect(NewlyDevelopedMethodModelSchema.safeParse(result).success).toBe(true);
      expect(methodModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          methodType: request.methodType,
          normalizedCode: "MODEL-001",
          model: result,
        }),
      );
    });

    it("rejects route/project and authenticated/creator mismatches", async () => {
      await expect(
        service.createModel("other-project", { ...baseRequest, methodType: "FAULT_TREE" }, { username: "ada" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createModel("project-1", { ...baseRequest, methodType: "FAULT_TREE" }, { username: "mallory" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(projectsServiceMock.resolveAccess).not.toHaveBeenCalled();
    });

    it("forbids viewers from creating models", async () => {
      await expect(
        service.createModel("project-1", { ...baseRequest, methodType: "FAULT_TREE" }, { username: "ada" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(methodModelMock.create).not.toHaveBeenCalled();
    });

    it("reports a duplicate method code as a conflict", async () => {
      projectsServiceMock.resolveAccess.mockResolvedValue({ doc: {}, role: "owner" });
      methodModelMock.create.mockRejectedValue({ code: 11_000 });

      await expect(
        service.createModel("project-1", { ...baseRequest, code: " ft-001 ", methodType: "FAULT_TREE" }, { username: "ada" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("loadModel", () => {
    it("loads and validates a model scoped to its project", async () => {
      const record = makeRecord();
      methodModelMock.findOne.mockReturnValue({ exec: () => Promise.resolve(record) });

      const result = await service.loadModel("project-1", MODEL_ID, {
        username: "ada",
      });

      expect(methodModelMock.findOne).toHaveBeenCalledWith({
        projectId: "project-1",
        id: MODEL_ID,
      });
      expect(result).toEqual(record.model);
    });

    it("does not reveal a missing or differently scoped model", async () => {
      methodModelMock.findOne.mockReturnValue({ exec: () => Promise.resolve(null) });

      await expect(
        service.loadModel("project-1", MODEL_ID, { username: "ada" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("patchModel", () => {
    const basePatch = {
      schemaVersion: "1.0.0" as const,
      methodType: "FAULT_TREE" as const,
      modelId: MODEL_ID,
      expectedRevision: 2,
      updatedBy: "ada",
    };

    it("updates only one changed field plus audit and revision paths", async () => {
      projectsServiceMock.resolveAccess.mockResolvedValue({ doc: {}, role: "editor" });
      methodModelMock.findOne.mockReturnValue({
        exec: () => Promise.resolve(makeRecord()),
      });
      const updatedModel = makeFaultTree({
        name: "Updated name",
        revision: 3,
        updatedBy: "ada",
        updatedAt: "2026-08-20T21:00:00.000Z",
      });
      methodModelMock.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve(makeRecord({ name: "Updated name", revision: 3, model: updatedModel })),
      });

      const result = await service.patchModel(
        "project-1",
        MODEL_ID,
        { ...basePatch, changes: { name: "Updated name" } },
        { username: "ada" },
      );

      expect(result.name).toBe("Updated name");
      const [filter, update, options] = methodModelMock.findOneAndUpdate.mock.calls[0] as [
        Record<string, unknown>,
        { $set: Record<string, unknown>; $inc: Record<string, number> },
        Record<string, unknown>,
      ];
      expect(filter).toEqual({
        projectId: "project-1",
        id: MODEL_ID,
        methodType: "FAULT_TREE",
        revision: 2,
      });
      expect(update.$set).toEqual({
        updatedBy: "ada",
        updatedAt: expect.any(Date),
        "model.updatedBy": "ada",
        "model.updatedAt": expect.any(String),
        "model.name": "Updated name",
        name: "Updated name",
      });
      expect(update.$set).not.toHaveProperty("model.description");
      expect(update.$set).not.toHaveProperty("model.gates");
      expect(update.$inc).toEqual({ revision: 1, "model.revision": 1 });
      expect(options).toEqual({ new: true, runValidators: true });
    });

    it("updates one structural collection without replacing the model", async () => {
      projectsServiceMock.resolveAccess.mockResolvedValue({ doc: {}, role: "owner" });
      methodModelMock.findOne.mockReturnValue({
        exec: () => Promise.resolve(makeRecord()),
      });
      const updatedModel = makeFaultTree({
        gates: [],
        revision: 3,
        updatedBy: "ada",
        updatedAt: "2026-08-20T21:00:00.000Z",
      });
      methodModelMock.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve(makeRecord({ revision: 3, model: updatedModel })),
      });

      await service.patchModel(
        "project-1",
        MODEL_ID,
        { ...basePatch, changes: { gates: [] } },
        { username: "ada" },
      );

      const update = methodModelMock.findOneAndUpdate.mock.calls[0][1] as {
        $set: Record<string, unknown>;
      };
      expect(update.$set["model.gates"]).toEqual([]);
      expect(update.$set).not.toHaveProperty("model");
      expect(update.$set).not.toHaveProperty("model.leafNodes");
    });

    it("rejects model-id, updater, and method-type mismatches", async () => {
      await expect(
        service.patchModel(
          "project-1",
          "123e4567-e89b-42d3-a456-426614174099",
          { ...basePatch, changes: { name: "X" } },
          { username: "ada" },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.patchModel(
          "project-1",
          MODEL_ID,
          { ...basePatch, changes: { name: "X" } },
          { username: "mallory" },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      projectsServiceMock.resolveAccess.mockResolvedValue({ doc: {}, role: "editor" });
      methodModelMock.findOne.mockReturnValue({
        exec: () => Promise.resolve(makeRecord()),
      });
      await expect(
        service.patchModel(
          "project-1",
          MODEL_ID,
          {
            ...basePatch,
            methodType: "BAYESIAN_NETWORK",
            changes: { name: "X" },
          },
          { username: "ada" },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(methodModelMock.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("forbids viewers and returns a conflict for stale or racing revisions", async () => {
      await expect(
        service.patchModel(
          "project-1",
          MODEL_ID,
          { ...basePatch, changes: { name: "X" } },
          { username: "ada" },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      projectsServiceMock.resolveAccess.mockResolvedValue({ doc: {}, role: "editor" });
      methodModelMock.findOne.mockReturnValue({
        exec: () => Promise.resolve(makeRecord({ revision: 3 })),
      });
      await expect(
        service.patchModel(
          "project-1",
          MODEL_ID,
          { ...basePatch, changes: { name: "X" } },
          { username: "ada" },
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      methodModelMock.findOne.mockReturnValue({
        exec: () => Promise.resolve(makeRecord()),
      });
      methodModelMock.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve(null),
      });
      await expect(
        service.patchModel(
          "project-1",
          MODEL_ID,
          { ...basePatch, changes: { name: "X" } },
          { username: "ada" },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("validateModel", () => {
    const draftRequest = {
      schemaVersion: "1.0.0" as const,
      methodType: "FAULT_TREE" as const,
      modelId: MODEL_ID,
      revision: 2,
      mode: "DRAFT" as const,
      requestedBy: "ada",
    };

    it("reports the same model errors while allowing draft saves and blocking analysis", async () => {
      const target = makeRecord();
      methodModelMock.findOne.mockReturnValue({
        exec: () => Promise.resolve(target),
      });
      methodModelMock.find.mockReturnValue({
        exec: () => Promise.resolve([target]),
      });

      const draft = await service.validateModel(
        "project-1",
        MODEL_ID,
        draftRequest,
        { username: "ada" },
      );
      const analysis = await service.validateModel(
        "project-1",
        MODEL_ID,
        { ...draftRequest, mode: "ANALYSIS_READY" },
        { username: "ada" },
      );

      expect(draft).toMatchObject({
        saveAllowed: true,
        validation: { mode: "DRAFT", valid: false },
      });
      expect(analysis).toMatchObject({
        quantificationAllowed: false,
        validation: { mode: "ANALYSIS_READY", valid: false },
      });
      expect(draft.validation.issues.map((issue) => issue.code)).toEqual(
        analysis.validation.issues.map((issue) => issue.code),
      );
      expect(methodModelMock.find).toHaveBeenCalledWith({ projectId: "project-1" });
    });

    it("rejects identity, method, and revision mismatches before validation", async () => {
      await expect(
        service.validateModel(
          "project-1",
          "123e4567-e89b-42d3-a456-426614174099",
          draftRequest,
          { username: "ada" },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.validateModel("project-1", MODEL_ID, draftRequest, {
          username: "mallory",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      methodModelMock.findOne.mockReturnValue({
        exec: () => Promise.resolve(makeRecord()),
      });
      await expect(
        service.validateModel(
          "project-1",
          MODEL_ID,
          { ...draftRequest, methodType: "EVENT_TREE" },
          { username: "ada" },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.validateModel(
          "project-1",
          MODEL_ID,
          { ...draftRequest, revision: 1 },
          { username: "ada" },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(methodModelMock.find).not.toHaveBeenCalled();
    });
  });

  describe("analysis runs", () => {
    const executeRequest = {
      schemaVersion: "1.0.0" as const,
      methodType: "FAULT_TREE" as const,
      modelId: MODEL_ID,
      revision: 2,
      requestedBy: "ada",
    };

    it("validates an analysis-ready revision and persists a queued typed request", async () => {
      projectsServiceMock.resolveAccess.mockResolvedValue({ doc: {}, role: "editor" });
      const model = makeAnalysisReadyFaultTree();
      const record = makeRecord({ model });
      methodModelMock.findOne.mockReturnValue({ exec: () => Promise.resolve(record) });
      methodModelMock.find.mockReturnValue({ exec: () => Promise.resolve([record]) });
      analysisRunModelMock.create.mockImplementation((run: Record<string, unknown>) =>
        Promise.resolve(run),
      );

      const result = await service.createAnalysisRun(
        "project-1",
        MODEL_ID,
        executeRequest,
        { username: "ada" },
      );

      expect(result).toMatchObject({
        schemaVersion: "1.0.0",
        run: {
          modelId: MODEL_ID,
          modelRevision: 2,
          methodType: "FAULT_TREE",
          status: "QUEUED",
          requestedBy: "ada",
          startedAt: null,
          completedAt: null,
          engine: null,
        },
      });
      expect(MethodModelExecuteResultSchema.safeParse(result).success).toBe(true);
      expect(analysisRunModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "project-1",
          request: executeRequest,
          modelSnapshots: [model],
          result: null,
        }),
      );
    });

    it("does not queue an invalid draft", async () => {
      projectsServiceMock.resolveAccess.mockResolvedValue({ doc: {}, role: "owner" });
      const record = makeRecord();
      methodModelMock.findOne.mockReturnValue({ exec: () => Promise.resolve(record) });
      methodModelMock.find.mockReturnValue({ exec: () => Promise.resolve([record]) });

      await expect(
        service.createAnalysisRun("project-1", MODEL_ID, executeRequest, {
          username: "ada",
        }),
      ).rejects.toMatchObject({
        response: {
          message: "Method model is not ready for analysis",
          validation: { quantificationAllowed: false },
        },
      });
      expect(analysisRunModelMock.create).not.toHaveBeenCalled();
    });

    it("rejects a stale revision before preserving or queuing snapshots", async () => {
      projectsServiceMock.resolveAccess.mockResolvedValue({ doc: {}, role: "editor" });
      const model = makeAnalysisReadyFaultTree();
      const staleModel = { ...model, revision: 3 };
      methodModelMock.find.mockReturnValue({
        exec: () => Promise.resolve([{ model: staleModel }]),
      });

      await expect(
        service.createAnalysisRun("project-1", MODEL_ID, executeRequest, {
          username: "ada",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(analysisRunModelMock.create).not.toHaveBeenCalled();
    });

    it("rejects a Bayesian-network query node outside the validated snapshot", async () => {
      projectsServiceMock.resolveAccess.mockResolvedValue({ doc: {}, role: "editor" });
      const model = makeBayesianNetwork({ id: MODEL_ID });
      methodModelMock.find.mockReturnValue({ exec: () => Promise.resolve([{ model }]) });

      await expect(
        service.createAnalysisRun(
          "project-1",
          MODEL_ID,
          {
            schemaVersion: "1.0.0",
            methodType: "BAYESIAN_NETWORK",
            modelId: MODEL_ID,
            revision: 2,
            requestedBy: "ada",
            query: {
              evidence: { observations: [] },
              queryNodeIds: ["123e4567-e89b-42d3-a456-426614174099"],
            },
          },
          { username: "ada" },
        ),
      ).rejects.toThrow("does not exist");
      expect(analysisRunModelMock.create).not.toHaveBeenCalled();
    });

    it("resolves an HCL execution top gate from the preserved FT snapshot", async () => {
      projectsServiceMock.resolveAccess.mockResolvedValue({ doc: {}, role: "editor" });
      const faultTreeId = "123e4567-e89b-42d3-a456-426614174030";
      const faultTree = makeAnalysisReadyFaultTree() as {
        topGate: { gateId: string };
      } & Record<string, unknown>;
      faultTree.id = faultTreeId;
      const bayesianNetwork = makeBayesianNetwork();
      const hcl = {
        id: MODEL_ID,
        projectId: "project-1",
        methodType: "HYBRID_CAUSAL_LOGIC",
        code: "HCL-001",
        name: "Hybrid model",
        description: "Hybrid configuration.",
        schemaVersion: "1.0.0",
        revision: 2,
        createdBy: "ada",
        createdAt: "2026-08-20T19:30:00.000Z",
        updatedBy: "ada",
        updatedAt: "2026-08-20T20:00:00.000Z",
        bayesianNetwork: { modelId: BN_MODEL_ID },
        faultTrees: [{ faultTree: { modelId: faultTreeId } }],
        bindings: [],
        baseEvidence: { observations: [] },
        solverSettings: {
          variableOrder: null,
          foldConstants: false,
          spliceNullGates: false,
        },
      };
      methodModelMock.find.mockReturnValue({
        exec: () =>
          Promise.resolve([
            { model: hcl },
            { model: bayesianNetwork },
            { model: faultTree },
          ]),
      });
      analysisRunModelMock.create.mockImplementation((run: Record<string, unknown>) =>
        Promise.resolve(run),
      );
      const hclRequest = {
        schemaVersion: "1.0.0" as const,
        methodType: "HYBRID_CAUSAL_LOGIC" as const,
        modelId: MODEL_ID,
        revision: 2,
        requestedBy: "ada",
        faultTreeTopGate: {
          modelId: faultTreeId,
          entityId: faultTree.topGate.gateId,
        },
      };

      const hclRun = await service.createAnalysisRun("project-1", MODEL_ID, hclRequest, {
        username: "ada",
      });
      expect(hclRun).toMatchObject({
        run: { methodType: "HYBRID_CAUSAL_LOGIC", status: "QUEUED" },
      });
      expect(MethodModelExecuteResultSchema.safeParse(hclRun).success).toBe(true);

      await expect(
        service.createAnalysisRun(
          "project-1",
          MODEL_ID,
          {
            ...hclRequest,
            faultTreeTopGate: {
              ...hclRequest.faultTreeTopGate,
              entityId: "123e4567-e89b-42d3-a456-426614174099",
            },
          },
          { username: "ada" },
        ),
      ).rejects.toThrow("does not match");
    });

    it("retrieves scoped status and withholds an unfinished result", async () => {
      const run = makeRunRecord();
      analysisRunModelMock.findOne.mockReturnValue({ exec: () => Promise.resolve(run) });

      await expect(
        service.getAnalysisRun("project-1", MODEL_ID, RUN_ID, { username: "ada" }),
      ).resolves.toMatchObject({ id: RUN_ID, status: "QUEUED" });
      await expect(
        service.getAnalysisRunResult("project-1", MODEL_ID, RUN_ID, {
          username: "ada",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(analysisRunModelMock.findOne).toHaveBeenCalledWith({
        projectId: "project-1",
        modelId: MODEL_ID,
        id: RUN_ID,
      });
    });

    it("returns a successful result only when its run identity is consistent", async () => {
      const completedAt = new Date("2026-08-20T20:01:00.000Z");
      const result = {
        schemaVersion: "1.0.0",
        runId: RUN_ID,
        modelId: MODEL_ID,
        modelRevision: 2,
        topGateId: "123e4567-e89b-42d3-a456-426614174020",
        topEventProbability: 0.01,
        minimalCutSetCount: 0,
        leadingCutSets: [],
        validationIssues: [],
        completedAt: completedAt.toISOString(),
      };
      analysisRunModelMock.findOne.mockReturnValue({
        exec: () =>
          Promise.resolve(
            makeRunRecord({
              status: "SUCCEEDED",
              startedAt: new Date("2026-08-20T20:00:01.000Z"),
              completedAt,
              engine: { name: "PRAXIS", version: "0.1.0" },
              result,
            }),
          ),
      });

      const response = await service.getAnalysisRunResult(
        "project-1",
        MODEL_ID,
        RUN_ID,
        { username: "ada" },
      );
      expect(response.result).toEqual(result);
      expect(MethodAnalysisRunResultSchema.safeParse(response).success).toBe(true);
    });
  });

  describe("deleteModel", () => {
    it("deletes an unreferenced model for an editor", async () => {
      projectsServiceMock.resolveAccess.mockResolvedValue({ doc: {}, role: "editor" });
      const record = makeRecord();
      methodModelMock.findOne
        .mockReturnValueOnce({ exec: () => Promise.resolve(record) })
        .mockReturnValueOnce({ exec: () => Promise.resolve(null) });

      await service.deleteModel("project-1", MODEL_ID, { username: "ada" });

      expect(record.deleteOne).toHaveBeenCalledTimes(1);
      const dependencyQuery = methodModelMock.findOne.mock.calls[1][0] as {
        $or: Record<string, string>[];
      };
      expect(dependencyQuery.$or).toContainEqual({
        "model.faultTrees.faultTree.modelId": MODEL_ID,
      });
      expect(dependencyQuery.$or).toContainEqual({
        "model.sequences.result.target.modelId": MODEL_ID,
      });
    });

    it("blocks deletion and identifies the dependent model", async () => {
      projectsServiceMock.resolveAccess.mockResolvedValue({ doc: {}, role: "owner" });
      const target = makeRecord();
      const dependent = makeRecord({
        id: "123e4567-e89b-42d3-a456-426614174099",
        methodType: "EVENT_TREE",
        code: "ET-001",
      });
      methodModelMock.findOne
        .mockReturnValueOnce({ exec: () => Promise.resolve(target) })
        .mockReturnValueOnce({ exec: () => Promise.resolve(dependent) });

      await expect(
        service.deleteModel("project-1", MODEL_ID, { username: "ada" }),
      ).rejects.toMatchObject({
        response: {
          dependency: {
            id: dependent.id,
            methodType: "EVENT_TREE",
            code: "ET-001",
          },
        },
      });
      expect(target.deleteOne).not.toHaveBeenCalled();
    });

    it("forbids viewers before loading or checking model dependencies", async () => {
      await expect(
        service.deleteModel("project-1", MODEL_ID, { username: "viewer" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(methodModelMock.findOne).not.toHaveBeenCalled();
    });
  });
});
