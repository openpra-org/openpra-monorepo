import { ConflictException, type CanActivate, type ExecutionContext, type INestApplication } from "@nestjs/common";
import { getModelToken } from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { EsWorkbooksController } from "../../es-workbooks/es-workbooks.controller";
import { EsWorkbook, EsWorkbookSchema } from "../../es-workbooks/es-workbook.schema";
import { EsWorkbooksService } from "../../es-workbooks/es-workbooks.service";
import { EsDocumentsService } from "../../es-workbooks/es-documents.service";
import { createBlankEs } from "../../es-workbooks/blank-es";
import { EsqWorkbooksController } from "../../esq-workbooks/esq-workbooks.controller";
import { EsqWorkbook, EsqWorkbookSchema } from "../../esq-workbooks/esq-workbook.schema";
import { EsqWorkbooksService } from "../../esq-workbooks/esq-workbooks.service";
import { EsqDocumentsService } from "../../esq-workbooks/esq-documents.service";
import { createBlankEsq } from "../../esq-workbooks/blank-esq";
import { ExampleWorkbooksService } from "../../example-workbooks/example-workbooks.service";
import { SY_ANALYSIS } from "../../example-workbooks/seeds/sy-seed";
import { ProjectsService } from "../../projects/projects.service";
import { SyWorkbooksController } from "../../sy-workbooks/sy-workbooks.controller";
import { SyWorkbook, SyWorkbookSchema } from "../../sy-workbooks/sy-workbook.schema";
import { SyWorkbooksService } from "../../sy-workbooks/sy-workbooks.service";
import { SyDocumentsService } from "../../sy-workbooks/sy-documents.service";
import { createBlankSy } from "../../sy-workbooks/blank-sy";
import { DaWorkbookSchema } from "../../da-workbooks/da-workbook.schema";
import { WorkbookRolesService } from "../workbook-roles.service";
import { WorkbookSignoff } from "../workbook-signoff.schema";
import { WorkbookModelAccessService } from "../workbook-model-access.service";
import { WorkbookDependencyDiscoveryService } from "../../newly-developed-methods/shared/workbook-dependency-discovery.service";
import { WorkbookAnalysisRunsService } from "../../newly-developed-methods/shared/workbook-analysis-runs.service";

const UPDATED_AT = new Date("2026-08-21T20:00:00.000Z");
const BN_MODEL_ID = "123e4567-e89b-42d3-a456-426614174301";
const BN_NODE_ID = "123e4567-e89b-42d3-a456-426614174302";
const BN_FALSE_STATE_ID = "123e4567-e89b-42d3-a456-426614174303";
const BN_TRUE_STATE_ID = "123e4567-e89b-42d3-a456-426614174304";
const FT_MODEL_ID = "123e4567-e89b-42d3-a456-426614174305";
const FT_BASIC_EVENT_ID = "123e4567-e89b-42d3-a456-426614174306";
const HCL_MODEL_ID = "123e4567-e89b-42d3-a456-426614174307";
const HCL_BINDING_ID = "123e4567-e89b-42d3-a456-426614174308";

interface MockWorkbookDocument {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  revision?: number;
  mef: unknown;
  previousMefJson: string | null;
  linkedPosWorkbookId?: string | null;
  linkedIeWorkbookId?: string | null;
  exampleVariant?: string;
  updatedAt: Date;
  save: jest.Mock;
}

interface MockWorkbookModel {
  findOne: jest.Mock;
  findOneAndUpdate: jest.Mock;
}

interface MockRevisionFilter {
  workbookId: string;
  revision?: number;
  $or?: Array<{ revision: number } | { revision: { $exists: false } }>;
}

function createDocument(workbookId: string, mef: unknown): MockWorkbookDocument {
  return {
    workbookId,
    projectId: "project-1",
    ownerUsername: "analyst",
    revision: 1,
    mef,
    previousMefJson: null,
    linkedPosWorkbookId: null,
    linkedIeWorkbookId: null,
    updatedAt: UPDATED_AT,
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function createFaultTreeModel(name: string): SystemsAnalysis["systemLogicModels"][number] {
  return {
    uuid: FT_MODEL_ID,
    code: "FT-DELETE",
    name,
    systemReference: "system-1",
    description: name,
    modelRepresentation: "Fault tree",
    topGate: { gateId: "top-gate" },
    gates: [
      {
        id: "top-gate",
        code: "TOP",
        name: "Top",
        description: "Top",
        kind: "GATE",
        gateType: "OR",
      },
    ],
    leafNodes: [],
    gateInputs: [],
    nodePositions: [],
    layout: {
      viewport: { x: 0, y: 0, zoom: 1 },
      mode: "AUTOMATIC",
      direction: "TOP_TO_BOTTOM",
    },
    implementsSrs: [],
  };
}

function matchesRevision(document: MockWorkbookDocument, filter: MockRevisionFilter): boolean {
  if (filter.revision !== undefined) return document.revision === filter.revision;
  return (
    filter.$or?.some((condition) => {
      if (typeof condition.revision === "number") return document.revision === condition.revision;
      return condition.revision.$exists === false && document.revision === undefined;
    }) ?? false
  );
}

function createModel(document: MockWorkbookDocument): MockWorkbookModel {
  return {
    findOne: jest.fn().mockImplementation(({ workbookId }: { workbookId: string }) => ({
      exec: jest.fn().mockResolvedValue(workbookId === document.workbookId ? document : null),
    })),
    findOneAndUpdate: jest.fn().mockImplementation(
      (
        filter: MockRevisionFilter,
        update: { $set: Partial<MockWorkbookDocument> },
      ) => ({
        exec: jest.fn().mockImplementation(async () => {
          if (filter.workbookId !== document.workbookId || !matchesRevision(document, filter)) {
            return null;
          }
          Object.assign(document, update.$set);
          return document;
        }),
      }),
    ),
  };
}

function createEventTreeMef(): EventSequenceAnalysis {
  const mef = createBlankEs("Workbook-owned ET", "analyst");
  mef.eventTrees = [
    {
      uuid: "ET-01",
      name: "Loss of flow",
      initiatingEventId: "IE-01",
      initiatingEventFrequency: { value: 0.02 },
      functionalEvents: {},
      sequences: {},
      branches: {},
      initialState: { branchId: "" },
      implementsSrs: [],
    },
  ];
  return mef;
}

function createEsqModelsMef(): EventSequenceQuantification {
  const mef = createBlankEsq("Workbook-owned BN and HCL", "analyst");
  (mef as unknown as Record<string, unknown>).legacyNullableField = null;
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
  return mef;
}

describe("workbook-owned method-model APIs", () => {
  let app: INestApplication;
  let syDocument: MockWorkbookDocument;
  let esDocument: MockWorkbookDocument;
  let esqDocument: MockWorkbookDocument;
  let syModel: MockWorkbookModel;
  let esModel: MockWorkbookModel;
  let esqModel: MockWorkbookModel;
  let projectAccess: { resolveAccess: jest.Mock };
  let workbookRoles: { resolveEffectiveRoles: jest.Mock };
  let dependencyDiscovery: { assertModelCanBeDeleted: jest.Mock };
  let signoffs: { deleteMany: jest.Mock };
  let examples: {
    getSyBundle: jest.Mock;
    getEsBundle: jest.Mock;
    getEsqBundle: jest.Mock;
  };
  let syDocuments: { removeAllForWorkbook: jest.Mock };
  let esDocuments: { removeAllForWorkbook: jest.Mock };
  let esqDocuments: { removeAllForWorkbook: jest.Mock };

  beforeEach(async () => {
    syDocument = createDocument("sy-workbook", structuredClone(SY_ANALYSIS));
    esDocument = createDocument("es-workbook", createEventTreeMef());
    esqDocument = createDocument("esq-workbook", createEsqModelsMef());
    syModel = createModel(syDocument);
    esModel = createModel(esDocument);
    esqModel = createModel(esqDocument);

    projectAccess = { resolveAccess: jest.fn().mockResolvedValue({ role: "owner" }) };
    workbookRoles = {
      resolveEffectiveRoles: jest.fn().mockResolvedValue(["preparer"]),
    };
    dependencyDiscovery = {
      assertModelCanBeDeleted: jest.fn().mockResolvedValue(undefined),
    };
    signoffs = { deleteMany: jest.fn().mockReturnValue({ exec: () => Promise.resolve() }) };
    examples = {
      getSyBundle: jest.fn().mockResolvedValue({ sy: { mef: createBlankSy("SY example", "analyst") } }),
      getEsBundle: jest.fn().mockResolvedValue({ es: { mef: createBlankEs("ES example", "analyst") } }),
      getEsqBundle: jest.fn().mockResolvedValue({ esq: { mef: createBlankEsq("ESQ example", "analyst") } }),
    };
    syDocuments = { removeAllForWorkbook: jest.fn().mockResolvedValue(undefined) };
    esDocuments = { removeAllForWorkbook: jest.fn().mockResolvedValue(undefined) };
    esqDocuments = { removeAllForWorkbook: jest.fn().mockResolvedValue(undefined) };
    const authGuard = {
      canActivate: jest.fn((context: ExecutionContext): boolean => {
        context.switchToHttp().getRequest().user = { username: "analyst" };
        return true;
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [SyWorkbooksController, EsWorkbooksController, EsqWorkbooksController],
      providers: [
        SyWorkbooksService,
        EsWorkbooksService,
        EsqWorkbooksService,
        WorkbookModelAccessService,
        { provide: getModelToken(SyWorkbook.name), useValue: syModel },
        { provide: getModelToken(EsWorkbook.name), useValue: esModel },
        { provide: getModelToken(EsqWorkbook.name), useValue: esqModel },
        { provide: getModelToken(WorkbookSignoff.name), useValue: signoffs },
        { provide: ProjectsService, useValue: projectAccess },
        { provide: ExampleWorkbooksService, useValue: examples },
        { provide: WorkbookRolesService, useValue: workbookRoles },
        { provide: SyDocumentsService, useValue: syDocuments },
        { provide: EsDocumentsService, useValue: esDocuments },
        { provide: EsqDocumentsService, useValue: esqDocuments },
        { provide: WorkbookDependencyDiscoveryService, useValue: dependencyDiscovery },
        { provide: WorkbookAnalysisRunsService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard satisfies CanActivate)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("persists revision 1 by default in every method-owning workbook schema", () => {
    for (const schema of [SyWorkbookSchema, EsWorkbookSchema, EsqWorkbookSchema, DaWorkbookSchema]) {
      const revisionPath = schema.path("revision");
      expect(revisionPath.options).toMatchObject({ required: true, default: 1, min: 1 });
    }
  });

  it("deletes an SY fault tree only after the typed dependency gate passes", async () => {
    const mef = syDocument.mef as SystemsAnalysis;
    mef.systemLogicModels.push(createFaultTreeModel("Deletable FT"));

    const response = await request(app.getHttpServer()).delete(
      `/api/sy-workbooks/sy-workbook/fault-trees/${FT_MODEL_ID}?expectedRevision=1`,
    );

    expect(response.status).toBe(200);
    expect(response.body.revision).toBe(2);
    expect(
      (syDocument.mef as SystemsAnalysis).systemLogicModels.some(
        (model) => model.uuid === FT_MODEL_ID,
      ),
    ).toBe(false);
    expect(dependencyDiscovery.assertModelCanBeDeleted).toHaveBeenCalledWith(
      { workbookId: "sy-workbook", modelId: FT_MODEL_ID },
      expect.objectContaining({ ignoredSourcePathPrefixes: [expect.stringMatching(/^\/systemLogicModels\//)] }),
    );
  });

  it("leaves an SY fault tree untouched when a typed dependency blocks deletion", async () => {
    const mef = syDocument.mef as SystemsAnalysis;
    mef.systemLogicModels.push(createFaultTreeModel("Referenced FT"));
    dependencyDiscovery.assertModelCanBeDeleted.mockRejectedValue(
      new ConflictException("Referenced"),
    );

    const response = await request(app.getHttpServer()).delete(
      `/api/sy-workbooks/sy-workbook/fault-trees/${FT_MODEL_ID}?expectedRevision=1`,
    );

    expect(response.status).toBe(409);
    expect(syDocument.revision).toBe(1);
    expect(
      (syDocument.mef as SystemsAnalysis).systemLogicModels.some(
        (model) => model.uuid === FT_MODEL_ID,
      ),
    ).toBe(true);
    expect(syModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("deletes ES event trees and both ESQ-owned model kinds through owner routes", async () => {
    const eventTreeResponse = await request(app.getHttpServer()).delete(
      "/api/es-workbooks/es-workbook/event-trees/ET-01?expectedRevision=1",
    );
    const hclResponse = await request(app.getHttpServer()).delete(
      `/api/esq-workbooks/esq-workbook/hcl-configurations/${HCL_MODEL_ID}?expectedRevision=1`,
    );
    const bayesianResponse = await request(app.getHttpServer()).delete(
      `/api/esq-workbooks/esq-workbook/bayesian-networks/${BN_MODEL_ID}?expectedRevision=2`,
    );

    expect(eventTreeResponse.status).toBe(200);
    expect(eventTreeResponse.body.revision).toBe(2);
    expect((esDocument.mef as EventSequenceAnalysis).eventTrees).toEqual([]);
    expect(bayesianResponse.status).toBe(200);
    expect(bayesianResponse.body.revision).toBe(3);
    expect(hclResponse.status).toBe(200);
    expect(hclResponse.body.revision).toBe(2);
    expect((esqDocument.mef as EventSequenceQuantification).bayesianNetworks).toEqual([]);
    expect((esqDocument.mef as EventSequenceQuantification).hclConfigurations).toEqual([]);
    expect(dependencyDiscovery.assertModelCanBeDeleted).toHaveBeenCalledTimes(3);
  });

  it("rejects deletion without a positive expected workbook revision", async () => {
    const response = await request(app.getHttpServer()).delete(
      `/api/esq-workbooks/esq-workbook/bayesian-networks/${BN_MODEL_ID}`,
    );

    expect(response.status).toBe(400);
    expect(esqModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(dependencyDiscovery.assertModelCanBeDeleted).not.toHaveBeenCalled();
  });

  it("treats a legacy method-owning workbook without a revision as revision 1", async () => {
    syDocument.revision = undefined;

    const loaded = await request(app.getHttpServer()).get("/api/sy-workbooks/sy-workbook");
    expect(loaded.status).toBe(200);
    expect(loaded.body.revision).toBe(1);

    const patched = await request(app.getHttpServer())
      .patch("/api/sy-workbooks/sy-workbook")
      .send({
        expectedRevision: 1,
        operations: [{ op: "replace", path: ["name"], value: "Migrated legacy workbook" }],
      });
    expect(patched.status).toBe(200);
    expect(patched.body.revision).toBe(2);
    expect(syDocument.revision).toBe(2);
    expect(syModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(syDocument.save).not.toHaveBeenCalled();
  });

  it("atomically advances revisions when loading and unloading examples", async () => {
    for (const endpoint of ["sy-workbooks", "es-workbooks", "esq-workbooks"] as const) {
      const workbookId = endpoint.split("-")[0] + "-workbook";
      const loaded = await request(app.getHttpServer())
        .post(`/api/${endpoint}/${workbookId}/load-example`)
        .send({ example: "htgr" });
      expect(loaded.status).toBe(200);
      expect(loaded.body.revision).toBe(2);

      const unloaded = await request(app.getHttpServer()).post(
        `/api/${endpoint}/${workbookId}/unload-example`,
      );
      expect(unloaded.status).toBe(200);
      expect(unloaded.body.revision).toBe(3);
    }

    for (const [model, document] of [
      [syModel, syDocument],
      [esModel, esDocument],
      [esqModel, esqDocument],
    ] as const) {
      expect(document.revision).toBe(3);
      expect(document.previousMefJson).toBeNull();
      expect(model.findOneAndUpdate).toHaveBeenNthCalledWith(
        1,
        { workbookId: document.workbookId, $or: [{ revision: 1 }, { revision: { $exists: false } }] },
        expect.objectContaining({ $set: expect.objectContaining({ revision: 2 }) }),
        { new: true, runValidators: true },
      );
      expect(model.findOneAndUpdate).toHaveBeenNthCalledWith(
        2,
        { workbookId: document.workbookId, revision: 2 },
        expect.objectContaining({ $set: expect.objectContaining({ revision: 3 }) }),
        { new: true, runValidators: true },
      );
      expect(document.save).not.toHaveBeenCalled();
    }
  });

  it("does not perform example side effects when the revision CAS loses a race", async () => {
    const originalMef = structuredClone(syDocument.mef);
    syModel.findOneAndUpdate.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });

    const response = await request(app.getHttpServer())
      .post("/api/sy-workbooks/sy-workbook/load-example")
      .send({ example: "htgr" });

    expect(response.status).toBe(409);
    expect(syDocument.revision).toBe(1);
    expect(syDocument.mef).toEqual(originalMef);
    expect(signoffs.deleteMany).not.toHaveBeenCalled();
    expect(syDocuments.removeAllForWorkbook).not.toHaveBeenCalled();
  });

  it("loads and patches an SY-owned fault tree without changing the workbook catalogue", async () => {
    const analysis = syDocument.mef as SystemsAnalysis;
    const modelIndex = analysis.systemLogicModels.findIndex((model) => model.topGate !== null);
    expect(modelIndex).toBeGreaterThanOrEqual(0);
    const model = analysis.systemLogicModels[modelIndex];
    if (model === undefined || model.topGate === null) throw new Error("Expected a fault-tree model");
    const topGateId = model.topGate.gateId;
    const gateIndex = model.gates.findIndex((gate) => gate.id === topGateId);
    expect(gateIndex).toBeGreaterThanOrEqual(0);
    const originalCatalogue = structuredClone(analysis.systemBasicEvents);

    const loaded = await request(app.getHttpServer()).get("/api/sy-workbooks/sy-workbook");
    expect(loaded.status).toBe(200);
    expect(loaded.body.revision).toBe(1);
    expect(loaded.body.mef.systemLogicModels[modelIndex].topGate).not.toBeNull();

    const patched = await request(app.getHttpServer())
      .patch("/api/sy-workbooks/sy-workbook")
      .send({
        expectedRevision: 1,
        operations: [
          {
            op: "replace",
            path: ["systemLogicModels", modelIndex, "gates", gateIndex, "name"],
            value: "Updated top event",
          },
        ],
      });

    expect(patched.status).toBe(200);
    expect(patched.body.revision).toBe(2);
    expect(syDocument.revision).toBe(2);
    expect(patched.body.mef.systemLogicModels[modelIndex].gates[gateIndex].name).toBe("Updated top event");
    expect((syDocument.mef as SystemsAnalysis).systemBasicEvents).toEqual(originalCatalogue);
    expect(syModel.findOneAndUpdate).toHaveBeenCalledWith(
      { workbookId: "sy-workbook", $or: [{ revision: 1 }, { revision: { $exists: false } }] },
      expect.objectContaining({ $set: expect.objectContaining({ revision: 2 }) }),
      { new: true, runValidators: true },
    );
    expect(syDocument.save).not.toHaveBeenCalled();
  });

  it("applies editor patches to the normalized SY fault tree returned to the client", async () => {
    const legacy = structuredClone(createBlankSy("Legacy SY", "analyst")) as unknown as Record<string, unknown>;
    legacy.systemLogicModels = [{
      uuid: "MODEL-A",
      systemReference: "SYS-A",
      description: "Legacy fault tree",
      modelRepresentation: "Fault tree",
      faultTree: { id: "TOP-A", type: "OR", name: "Legacy top gate", children: [] },
      implementsSrs: [],
    }];
    legacy.systemBasicEvents = [];
    syDocument.mef = legacy;

    const loaded = await request(app.getHttpServer()).get("/api/sy-workbooks/sy-workbook");
    expect(loaded.status).toBe(200);
    expect(loaded.body.mef.systemLogicModels[0].layout.viewport.x).toBe(0);
    expect((syDocument.mef as Record<string, unknown>).systemLogicModels).toEqual(legacy.systemLogicModels);

    const patched = await request(app.getHttpServer())
      .patch("/api/sy-workbooks/sy-workbook")
      .send({
        expectedRevision: 1,
        operations: [{
          op: "replace",
          path: ["systemLogicModels", 0, "layout", "viewport", "x"],
          value: 48,
        }],
      });

    expect(patched.status).toBe(200);
    expect(patched.body.mef.systemLogicModels[0].layout.viewport.x).toBe(48);
    expect(syDocument.revision).toBe(2);
  });

  it("loads and patches an ES-owned event tree inside the ES MEF", async () => {
    const loaded = await request(app.getHttpServer()).get("/api/es-workbooks/es-workbook");
    expect(loaded.status).toBe(200);
    expect(loaded.body.revision).toBe(1);
    expect(loaded.body.mef.eventTrees[0]).toMatchObject({ uuid: "ET-01", name: "Loss of flow" });

    const patched = await request(app.getHttpServer())
      .patch("/api/es-workbooks/es-workbook")
      .send({
        expectedRevision: 1,
        operations: [
          {
            op: "replace",
            path: ["eventTrees", 0, "name"],
            value: "Updated loss of flow",
          },
        ],
      });

    expect(patched.status).toBe(200);
    expect(patched.body.revision).toBe(2);
    expect(esDocument.revision).toBe(2);
    expect(patched.body.mef.eventTrees[0]).toMatchObject({
      uuid: "ET-01",
      name: "Updated loss of flow",
      initiatingEventFrequency: { value: 0.02 },
    });
    expect((esDocument.mef as EventSequenceAnalysis).eventTrees?.[0]?.name).toBe(
      "Updated loss of flow",
    );
    expect(esModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(esDocument.save).not.toHaveBeenCalled();
  });

  it("loads and independently patches ESQ-owned BN and HCL models", async () => {
    const loaded = await request(app.getHttpServer()).get("/api/esq-workbooks/esq-workbook");
    expect(loaded.status).toBe(200);
    expect(loaded.body.revision).toBe(1);
    expect(loaded.body.mef.bayesianNetworks[0].modelId).toBe(BN_MODEL_ID);
    expect(loaded.body.mef.hclConfigurations[0].modelId).toBe(HCL_MODEL_ID);
    expect(loaded.body.mef.hclConfigurations[0].solverSettings.variableOrder).toBeNull();
    expect(loaded.body.mef).not.toHaveProperty("legacyNullableField");

    const bnPatched = await request(app.getHttpServer())
      .patch("/api/esq-workbooks/esq-workbook")
      .send({
        expectedRevision: 1,
        operations: [
          {
            op: "replace",
            path: ["bayesianNetworks", 0, "name"],
            value: "Updated dependency network",
          },
        ],
      });
    expect(bnPatched.status).toBe(200);
    expect(bnPatched.body.revision).toBe(2);
    expect(bnPatched.body.mef.bayesianNetworks[0].name).toBe("Updated dependency network");
    expect(bnPatched.body.mef.hclConfigurations[0].description).toBe(
      "ESQ-owned HCL configuration",
    );
    expect(bnPatched.body.mef.hclConfigurations[0].solverSettings.variableOrder).toBeNull();

    const hclPatched = await request(app.getHttpServer())
      .patch("/api/esq-workbooks/esq-workbook")
      .send({
        expectedRevision: 2,
        operations: [
          {
            op: "replace",
            path: ["hclConfigurations", 0, "description"],
            value: "Updated HCL configuration",
          },
        ],
      });
    expect(hclPatched.status).toBe(200);
    expect(hclPatched.body.revision).toBe(3);
    expect(esqDocument.revision).toBe(3);
    expect(hclPatched.body.mef.hclConfigurations[0].description).toBe(
      "Updated HCL configuration",
    );
    expect(hclPatched.body.mef.hclConfigurations[0].solverSettings.variableOrder).toBeNull();
    expect(hclPatched.body.mef.bayesianNetworks[0].nodes[0].id).toBe(BN_NODE_ID);
    expect((esqDocument.mef as EventSequenceQuantification).bayesianNetworks[0]?.name).toBe(
      "Updated dependency network",
    );
    expect(
      (esqDocument.mef as EventSequenceQuantification).hclConfigurations[0]?.description,
    ).toBe("Updated HCL configuration");
    expect(esqModel.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { workbookId: "esq-workbook", revision: 2 },
      expect.objectContaining({ $set: expect.objectContaining({ revision: 3 }) }),
      { new: true, runValidators: true },
    );
    expect(esqDocument.save).not.toHaveBeenCalled();
  });

  it("rejects model patches from workbook reviewers across all owner APIs", async () => {
    workbookRoles.resolveEffectiveRoles.mockResolvedValue(["reviewer"]);

    for (const endpoint of [
      "/api/sy-workbooks/sy-workbook",
      "/api/es-workbooks/es-workbook",
      "/api/esq-workbooks/esq-workbook",
    ]) {
      const response = await request(app.getHttpServer())
        .patch(endpoint)
        .send({
          expectedRevision: 1,
          operations: [{ op: "replace", path: ["name"], value: "Blocked" }],
        });
      expect(response.status).toBe(403);
    }

    expect(syDocument.save).not.toHaveBeenCalled();
    expect(esDocument.save).not.toHaveBeenCalled();
    expect(esqDocument.save).not.toHaveBeenCalled();
    expect(syModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(esModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(esqModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects preparer model patches while owner workbooks are under review", async () => {
    for (const document of [syDocument, esDocument, esqDocument]) {
      (document.mef as { workflowState: string }).workflowState =
        "INTERNAL_TECHNICAL_REVIEW";
    }

    for (const endpoint of [
      "/api/sy-workbooks/sy-workbook",
      "/api/es-workbooks/es-workbook",
      "/api/esq-workbooks/esq-workbook",
    ]) {
      const response = await request(app.getHttpServer())
        .patch(endpoint)
        .send({
          expectedRevision: 1,
          operations: [{ op: "replace", path: ["name"], value: "Blocked" }],
        });
      expect(response.status).toBe(403);
    }

    expect(syDocument.save).not.toHaveBeenCalled();
    expect(esDocument.save).not.toHaveBeenCalled();
    expect(esqDocument.save).not.toHaveBeenCalled();
    expect(syModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(esModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(esqModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects project viewers before resolving workbook roles", async () => {
    projectAccess.resolveAccess.mockResolvedValue({ role: "viewer" });

    for (const endpoint of [
      "/api/sy-workbooks/sy-workbook",
      "/api/es-workbooks/es-workbook",
      "/api/esq-workbooks/esq-workbook",
    ]) {
      const response = await request(app.getHttpServer())
        .patch(endpoint)
        .send({
          expectedRevision: 1,
          operations: [{ op: "replace", path: ["name"], value: "Blocked" }],
        });
      expect(response.status).toBe(403);
    }

    expect(workbookRoles.resolveEffectiveRoles).not.toHaveBeenCalled();
    expect(syDocument.save).not.toHaveBeenCalled();
    expect(esDocument.save).not.toHaveBeenCalled();
    expect(esqDocument.save).not.toHaveBeenCalled();
    expect(syModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(esModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(esqModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("requires the expected revision and rejects a stale method patch without saving", async () => {
    const missingRevision = await request(app.getHttpServer())
      .patch("/api/sy-workbooks/sy-workbook")
      .send({ operations: [{ op: "replace", path: ["name"], value: "Missing revision" }] });
    expect(missingRevision.status).toBe(400);

    const staleRevision = await request(app.getHttpServer())
      .patch("/api/sy-workbooks/sy-workbook")
      .send({
        expectedRevision: 2,
        operations: [{ op: "replace", path: ["name"], value: "Stale revision" }],
      });
    expect(staleRevision.status).toBe(409);
    expect(staleRevision.body.message).toContain("expected 2, current 1");
    expect(syDocument.revision).toBe(1);
    expect(syDocument.save).not.toHaveBeenCalled();
    expect(syModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("atomically accepts one racing method patch and rejects the other with 409", async () => {
    let arrivals = 0;
    let releaseBoth!: () => void;
    const bothLoaded = new Promise<void>((resolve) => {
      releaseBoth = resolve;
    });

    syModel.findOne.mockImplementation(({ workbookId }: { workbookId: string }) => ({
      exec: jest.fn().mockImplementation(async () => {
        if (workbookId !== syDocument.workbookId) return null;
        const snapshot = {
          ...syDocument,
          mef: structuredClone(syDocument.mef),
        };
        arrivals += 1;
        if (arrivals === 2) releaseBoth();
        await bothLoaded;
        return snapshot;
      }),
    }));

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .patch("/api/sy-workbooks/sy-workbook")
        .send({
          expectedRevision: 1,
          operations: [{ op: "replace", path: ["name"], value: "First racing edit" }],
        }),
      request(app.getHttpServer())
        .patch("/api/sy-workbooks/sy-workbook")
        .send({
          expectedRevision: 1,
          operations: [{ op: "replace", path: ["name"], value: "Second racing edit" }],
        }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const winner = first.status === 200 ? first : second;
    const loser = first.status === 409 ? first : second;
    expect(winner.body.revision).toBe(2);
    expect(loser.body.message).toContain("expected 1");
    expect(syDocument.revision).toBe(2);
    expect((syDocument.mef as SystemsAnalysis).name).toBe(winner.body.mef.name);
    expect(syModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(syDocument.save).not.toHaveBeenCalled();
  });
});
