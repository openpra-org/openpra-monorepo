import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  type INestApplication,
  Post,
} from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";
import type { Model } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { ProjectsService } from "../../../projects/projects.service";
import { SessionsService } from "../../../sessions/sessions.service";
import { WorkbookElementRegistry } from "../../../workbooks/workbook-element-registry";
import { Workbook, WorkbookSchema } from "../../../workbooks/workbook.schema";
import {
  FaultTreeBasicEventCatalogueRecord,
  FaultTreeBasicEventCatalogueRecordSchema,
} from "../../fault-tree/fault-tree-basic-event-catalogue-record.schema";
import { FaultTreeBasicEventCataloguesController } from "../../fault-tree/fault-tree-basic-event-catalogues.controller";
import { FaultTreeBasicEventCataloguesService } from "../../fault-tree/fault-tree-basic-event-catalogues.service";
import { PraxisNativeService } from "../../../../../../microservices/praetor/src/execution/services/praxis-native.service";
import {
  AnalysisRunRecord,
  AnalysisRunRecordSchema,
  type AnalysisRunRecordDocument,
} from "../analysis-run-record.schema";
import { MethodModelRecord, MethodModelRecordSchema } from "../method-model-record.schema";
import { MethodModelsController } from "../method-models.controller";
import { MethodModelsService } from "../method-models.service";
import { PraetorAnalysisClient } from "../praetor-analysis.client";

const PROJECT_ID = "project-ft-api";
const USERNAME = "ada";
const JWT_SECRET = "fault-tree-quantification-test-secret";
const GATE_ID = "123e4567-e89b-42d3-a456-426614174300";
const EVENT_A_ID = "123e4567-e89b-42d3-a456-426614174301";
const EVENT_B_ID = "123e4567-e89b-42d3-a456-426614174302";
const LEAF_A_ID = "123e4567-e89b-42d3-a456-426614174303";
const LEAF_B_ID = "123e4567-e89b-42d3-a456-426614174304";
const BN_PROJECT_ID = "project-bn-api";
const BN_NODE_A = "123e4567-e89b-42d3-a456-426614174320";
const BN_NODE_B = "123e4567-e89b-42d3-a456-426614174321";
const BN_A_FALSE = "123e4567-e89b-42d3-a456-426614174322";
const BN_A_TRUE = "123e4567-e89b-42d3-a456-426614174323";
const BN_B_FALSE = "123e4567-e89b-42d3-a456-426614174324";
const BN_B_TRUE = "123e4567-e89b-42d3-a456-426614174325";
const HCL_PROJECT_ID = "project-hcl-api";
const HCL_GATE_ID = "123e4567-e89b-42d3-a456-426614174340";
const HCL_EVENT_A_ID = "123e4567-e89b-42d3-a456-426614174341";
const HCL_EVENT_B_ID = "123e4567-e89b-42d3-a456-426614174342";
const HCL_LEAF_A_ID = "123e4567-e89b-42d3-a456-426614174343";
const HCL_LEAF_B_ID = "123e4567-e89b-42d3-a456-426614174344";
const HCL_NODE_A = "123e4567-e89b-42d3-a456-426614174350";
const HCL_NODE_B = "123e4567-e89b-42d3-a456-426614174351";
const HCL_A_FALSE = "123e4567-e89b-42d3-a456-426614174352";
const HCL_A_TRUE = "123e4567-e89b-42d3-a456-426614174353";
const HCL_B_FALSE = "123e4567-e89b-42d3-a456-426614174354";
const HCL_B_TRUE = "123e4567-e89b-42d3-a456-426614174355";
const HCL_BINDING_A = "123e4567-e89b-42d3-a456-426614174360";
const HCL_BINDING_B = "123e4567-e89b-42d3-a456-426614174361";
const ET_PROJECT_ID = "project-et-api";
const ET_GATE_ID = "123e4567-e89b-42d3-a456-426614174370";
const ET_EVENT_A_ID = "123e4567-e89b-42d3-a456-426614174371";
const ET_EVENT_B_ID = "123e4567-e89b-42d3-a456-426614174372";
const ET_LEAF_A_ID = "123e4567-e89b-42d3-a456-426614174373";
const ET_LEAF_B_ID = "123e4567-e89b-42d3-a456-426614174374";
const ET_INITIATING_MODEL_ID = "123e4567-e89b-42d3-a456-426614174375";
const ET_INITIATING_EVENT_ID = "123e4567-e89b-42d3-a456-426614174376";
const ET_FUNCTIONAL_EVENT_ID = "123e4567-e89b-42d3-a456-426614174377";
const ET_SAFE_END_STATE_ID = "123e4567-e89b-42d3-a456-426614174378";
const ET_RELEASE_END_STATE_ID = "123e4567-e89b-42d3-a456-426614174379";
const ET_SUCCESS_SEQUENCE_ID = "123e4567-e89b-42d3-a456-426614174380";
const ET_FAILURE_SEQUENCE_ID = "123e4567-e89b-42d3-a456-426614174381";
const HCL_ET_FUNCTION_A = "123e4567-e89b-42d3-a456-426614174390";
const HCL_ET_FUNCTION_B = "123e4567-e89b-42d3-a456-426614174391";
const HCL_ET_SAFE_STATE = "123e4567-e89b-42d3-a456-426614174392";
const HCL_ET_RELEASE_STATE = "123e4567-e89b-42d3-a456-426614174393";
const HCL_ET_SS = "123e4567-e89b-42d3-a456-426614174394";
const HCL_ET_SF = "123e4567-e89b-42d3-a456-426614174395";
const HCL_ET_FS = "123e4567-e89b-42d3-a456-426614174396";
const HCL_ET_FF = "123e4567-e89b-42d3-a456-426614174397";

@Controller()
class TestPraetorNativeController {
  constructor(private readonly nativeService: PraxisNativeService) {}

  @Post("praxis/native/execute")
  @HttpCode(HttpStatus.OK)
  execute(@Body() body: unknown): Promise<Record<string, unknown>> {
    return this.nativeService.run("execute", body);
  }
}

describe("fault-tree quantification API", () => {
  let api: INestApplication;
  let praetor: INestApplication;
  let mongo: MongoMemoryServer;
  let bearerToken: string;
  let analysisRuns: Model<AnalysisRunRecordDocument>;
  let projectRole: "viewer" | "editor" = "editor";
  let originalPraetorUrl: string | undefined;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();

    const praetorModule = await Test.createTestingModule({
      controllers: [TestPraetorNativeController],
      providers: [PraxisNativeService],
    }).compile();
    praetor = praetorModule.createNestApplication();
    await praetor.listen(0, "127.0.0.1");
    const praetorAddress = praetor.getHttpServer().address() as AddressInfo;
    originalPraetorUrl = process.env["PRAETOR_URL"];
    process.env["PRAETOR_URL"] = `http://127.0.0.1:${praetorAddress.port}`;

    const apiModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: JWT_SECRET }),
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
      controllers: [MethodModelsController, FaultTreeBasicEventCataloguesController],
      providers: [
        JwtAuthGuard,
        MethodModelsService,
        FaultTreeBasicEventCataloguesService,
        PraetorAnalysisClient,
        {
          provide: ProjectsService,
          useValue: {
            resolveAccess: jest.fn().mockImplementation(() =>
              Promise.resolve({ doc: {}, role: projectRole }),
            ),
          },
        },
        {
          provide: SessionsService,
          useValue: {
            isActive: jest.fn().mockResolvedValue(true),
            touch: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: WorkbookElementRegistry,
          useValue: { tryGet: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    api = apiModule.createNestApplication();
    api.setGlobalPrefix("api");
    await api.init();
    analysisRuns = apiModule.get(getModelToken(AnalysisRunRecord.name));
    bearerToken = apiModule.get(JwtService).sign({
      sub: "user-ada",
      username: USERNAME,
      email: "ada@example.test",
      roles: ["user"],
      jti: "session-ft-api",
    });
  }, 120_000);

  afterAll(async () => {
    if (originalPraetorUrl === undefined) delete process.env["PRAETOR_URL"];
    else process.env["PRAETOR_URL"] = originalPraetorUrl;
    await api.close();
    await praetor.close();
    await mongo.stop();
  }, 120_000);

  afterEach(() => {
    projectRole = "editor";
  });

  function authenticated(call: request.Test): request.Test {
    return call.set("authorization", `Bearer ${bearerToken}`);
  }

  it("persists its catalogue, returns 0.28 through PRAXIS, and exposes lifecycle failures", async () => {
    const server = api.getHttpServer();
    const catalogue = {
      schemaVersion: "1.0.0",
      projectId: PROJECT_ID,
      createdBy: USERNAME,
      basicEvents: [
        {
          id: EVENT_A_ID,
          code: "BE-A",
          name: "Basic event A",
          description: "Probability 0.1",
          probability: { value: 0.1 },
        },
        {
          id: EVENT_B_ID,
          code: "BE-B",
          name: "Basic event B",
          description: "Probability 0.2",
          probability: { value: 0.2 },
        },
      ],
    };
    const catalogueResponse = await authenticated(
      request(server)
        .post(`/api/projects/${PROJECT_ID}/fault-tree-basic-event-catalogue`)
        .send(catalogue),
    );
    expect(catalogueResponse.status).toBe(201);
    expect(catalogueResponse.body).toMatchObject({ revision: 1, basicEvents: catalogue.basicEvents });

    const createResponse = await authenticated(
      request(server)
        .post(`/api/projects/${PROJECT_ID}/method-models`)
        .send({
          schemaVersion: "1.0.0",
          projectId: PROJECT_ID,
          methodType: "FAULT_TREE",
          code: "FT-API-OR",
          name: "API OR tree",
          description: "Quantified through the complete backend API chain.",
          createdBy: USERNAME,
        }),
    );
    expect(createResponse.status).toBe(201);
    const modelId = createResponse.body.id as string;

    const patchResponse = await authenticated(
      request(server)
        .patch(`/api/projects/${PROJECT_ID}/method-models/${modelId}`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "FAULT_TREE",
          modelId,
          expectedRevision: 1,
          updatedBy: USERNAME,
          changes: {
            topGate: { gateId: GATE_ID },
            gates: [
              {
                id: GATE_ID,
                code: "TOP",
                name: "Top OR gate",
                description: "A or B",
                kind: "GATE",
                gateType: "OR",
              },
            ],
            leafNodes: [
              { id: LEAF_A_ID, kind: "BASIC_EVENT_REFERENCE", basicEventId: EVENT_A_ID },
              { id: LEAF_B_ID, kind: "BASIC_EVENT_REFERENCE", basicEventId: EVENT_B_ID },
            ],
            gateInputs: [
              {
                id: "123e4567-e89b-42d3-a456-426614174305",
                gateId: GATE_ID,
                childId: LEAF_A_ID,
                order: 0,
              },
              {
                id: "123e4567-e89b-42d3-a456-426614174306",
                gateId: GATE_ID,
                childId: LEAF_B_ID,
                order: 1,
              },
            ],
          },
        }),
    );
    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.revision).toBe(2);

    const validateResponse = await authenticated(
      request(server)
        .post(`/api/projects/${PROJECT_ID}/method-models/${modelId}/validate`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "FAULT_TREE",
          modelId,
          revision: 2,
          mode: "ANALYSIS_READY",
          requestedBy: USERNAME,
        }),
    );
    expect(validateResponse.status).toBe(200);
    expect(validateResponse.body).toMatchObject({
      quantificationAllowed: true,
      validation: { valid: true, issues: [] },
    });

    const executeBody = {
      schemaVersion: "1.0.0",
      methodType: "FAULT_TREE",
      modelId,
      revision: 2,
      requestedBy: USERNAME,
    };
    const executeResponse = await authenticated(
      request(server)
        .post(`/api/projects/${PROJECT_ID}/method-models/${modelId}/runs`)
        .send(executeBody),
    );
    expect(executeResponse.status).toBe(202);
    expect(executeResponse.body.run).toMatchObject({
      modelId,
      modelRevision: 2,
      methodType: "FAULT_TREE",
      status: "SUCCEEDED",
      engine: { name: "PRAXIS", version: "0.1.0" },
      failure: null,
    });
    const runId = executeResponse.body.run.id as string;

    const statusResponse = await authenticated(
      request(server).get(`/api/projects/${PROJECT_ID}/method-models/${modelId}/runs/${runId}`),
    );
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.status).toBe("SUCCEEDED");

    const resultResponse = await authenticated(
      request(server).get(
        `/api/projects/${PROJECT_ID}/method-models/${modelId}/runs/${runId}/result`,
      ),
    );
    expect(resultResponse.status).toBe(200);
    expect(resultResponse.body.result.topEventProbability).toBeCloseTo(0.28, 12);
    expect(resultResponse.body.result.minimalCutSetCount).toBe(2);
    expect(
      resultResponse.body.result.leadingCutSets.map(
        (cutSet: { probability: number }) => cutSet.probability,
      ),
    ).toEqual([0.2, 0.1]);

    const persistedSuccess = await analysisRuns.findOne({ id: runId }).lean().exec();
    expect(persistedSuccess).toMatchObject({
      status: "SUCCEEDED",
      resources: {
        faultTreeBasicEventCatalogue: {
          revision: 1,
          basicEvents: catalogue.basicEvents,
        },
      },
      result: { topEventProbability: expect.closeTo(0.28, 12) },
    });

    const staleResponse = await authenticated(
      request(server)
        .post(`/api/projects/${PROJECT_ID}/method-models/${modelId}/runs`)
        .send({ ...executeBody, revision: 1 }),
    );
    expect(staleResponse.status).toBe(409);

    const unsupportedPatch = await authenticated(
      request(server)
        .patch(`/api/projects/${PROJECT_ID}/method-models/${modelId}`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "FAULT_TREE",
          modelId,
          expectedRevision: 2,
          updatedBy: USERNAME,
          changes: {
            leafNodes: [
              {
                id: LEAF_A_ID,
                code: "UE-A",
                name: "Undeveloped A",
                description: "Unsupported by the native solver",
                kind: "UNDEVELOPED_EVENT",
              },
              { id: LEAF_B_ID, kind: "BASIC_EVENT_REFERENCE", basicEventId: EVENT_B_ID },
            ],
          },
        }),
    );
    expect(unsupportedPatch.status).toBe(200);
    expect(unsupportedPatch.body.revision).toBe(3);

    const failedResponse = await authenticated(
      request(server)
        .post(`/api/projects/${PROJECT_ID}/method-models/${modelId}/runs`)
        .send({ ...executeBody, revision: 3 }),
    );
    expect(failedResponse.status).toBe(202);
    expect(failedResponse.body.run).toMatchObject({
      status: "FAILED",
      failure: {
        kind: "SOLVER_ERROR",
        code: "PRAXIS_ILLEGAL_OPERATION",
      },
    });
    const failedRunId = failedResponse.body.run.id as string;
    const unavailableResult = await authenticated(
      request(server).get(
        `/api/projects/${PROJECT_ID}/method-models/${modelId}/runs/${failedRunId}/result`,
      ),
    );
    expect(unavailableResult.status).toBe(409);

    projectRole = "viewer";
    const viewerResponse = await authenticated(
      request(server)
        .post(`/api/projects/${PROJECT_ID}/method-models/${modelId}/runs`)
        .send({ ...executeBody, revision: 3 }),
    );
    expect(viewerResponse.status).toBe(403);
    projectRole = "editor";

    const unauthenticatedResponse = await request(server).get(
      `/api/projects/${PROJECT_ID}/method-models/${modelId}/runs/${runId}`,
    );
    expect(unauthenticatedResponse.status).toBe(401);
  }, 120_000);

  it("returns the exact Bayesian posterior through the authenticated API and TensorBayes", async () => {
    const server = api.getHttpServer();
    const createResponse = await authenticated(
      request(server)
        .post(`/api/projects/${BN_PROJECT_ID}/method-models`)
        .send({
          schemaVersion: "1.0.0",
          projectId: BN_PROJECT_ID,
          methodType: "BAYESIAN_NETWORK",
          code: "BN-API",
          name: "API Bayesian network",
          description: "Two-node exact-inference fixture.",
          createdBy: USERNAME,
        }),
    );
    expect(createResponse.status).toBe(201);
    const modelId = createResponse.body.id as string;

    const nodes = [
      {
        id: BN_NODE_A,
        code: "A",
        name: "Cause",
        description: "Parent node",
        kind: "CHANCE_NODE",
        states: [
          { id: BN_A_FALSE, code: "FALSE", name: "False" },
          { id: BN_A_TRUE, code: "TRUE", name: "True" },
        ],
      },
      {
        id: BN_NODE_B,
        code: "B",
        name: "Effect",
        description: "Child node",
        kind: "CHANCE_NODE",
        states: [
          { id: BN_B_FALSE, code: "FALSE", name: "False" },
          { id: BN_B_TRUE, code: "TRUE", name: "True" },
        ],
      },
    ];
    const conditionalProbabilityTables = [
      {
        nodeId: BN_NODE_A,
        parents: [],
        rows: [
          {
            id: "123e4567-e89b-42d3-a456-426614174327",
            parentStates: [],
            values: [
              { stateId: BN_A_FALSE, probability: 0.6 },
              { stateId: BN_A_TRUE, probability: 0.4 },
            ],
          },
        ],
      },
      {
        nodeId: BN_NODE_B,
        parents: [{ nodeId: BN_NODE_A, order: 0 }],
        rows: [
          {
            id: "123e4567-e89b-42d3-a456-426614174328",
            parentStates: [{ parentNodeId: BN_NODE_A, stateId: BN_A_FALSE }],
            values: [
              { stateId: BN_B_FALSE, probability: 0.7 },
              { stateId: BN_B_TRUE, probability: 0.3 },
            ],
          },
          {
            id: "123e4567-e89b-42d3-a456-426614174329",
            parentStates: [{ parentNodeId: BN_NODE_A, stateId: BN_A_TRUE }],
            values: [
              { stateId: BN_B_FALSE, probability: 0.2 },
              { stateId: BN_B_TRUE, probability: 0.8 },
            ],
          },
        ],
      },
    ];
    const patchResponse = await authenticated(
      request(server)
        .patch(`/api/projects/${BN_PROJECT_ID}/method-models/${modelId}`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "BAYESIAN_NETWORK",
          modelId,
          expectedRevision: 1,
          updatedBy: USERNAME,
          changes: {
            nodes,
            edges: [
              {
                id: "123e4567-e89b-42d3-a456-426614174326",
                parentNodeId: BN_NODE_A,
                childNodeId: BN_NODE_B,
              },
            ],
            conditionalProbabilityTables,
          },
        }),
    );
    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.revision).toBe(2);

    const validationResponse = await authenticated(
      request(server)
        .post(`/api/projects/${BN_PROJECT_ID}/method-models/${modelId}/validate`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "BAYESIAN_NETWORK",
          modelId,
          revision: 2,
          mode: "ANALYSIS_READY",
          requestedBy: USERNAME,
        }),
    );
    expect(validationResponse.status).toBe(200);
    expect(validationResponse.body.quantificationAllowed).toBe(true);

    const runResponse = await authenticated(
      request(server)
        .post(`/api/projects/${BN_PROJECT_ID}/method-models/${modelId}/runs`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "BAYESIAN_NETWORK",
          modelId,
          revision: 2,
          requestedBy: USERNAME,
          query: {
            evidence: { observations: [{ nodeId: BN_NODE_B, stateId: BN_B_TRUE }] },
            queryNodeIds: [BN_NODE_A],
          },
        }),
    );
    expect(runResponse.status).toBe(202);
    expect(runResponse.body.run).toMatchObject({
      methodType: "BAYESIAN_NETWORK",
      status: "SUCCEEDED",
      engine: { name: "PRAXIS", version: "0.1.0" },
    });

    const runId = runResponse.body.run.id as string;
    const resultResponse = await authenticated(
      request(server).get(
        `/api/projects/${BN_PROJECT_ID}/method-models/${modelId}/runs/${runId}/result`,
      ),
    );
    expect(resultResponse.status).toBe(200);
    expect(resultResponse.body.result).toMatchObject({
      modelId,
      modelRevision: 2,
      evidence: { observations: [{ nodeId: BN_NODE_B, stateId: BN_B_TRUE }] },
      marginals: [
        {
          nodeId: BN_NODE_A,
          values: [
            { stateId: BN_A_FALSE, probability: expect.closeTo(0.36, 12) },
            { stateId: BN_A_TRUE, probability: expect.closeTo(0.64, 12) },
          ],
        },
      ],
    });
    await expect(analysisRuns.findOne({ id: runId }).lean().exec()).resolves.toMatchObject({
      status: "SUCCEEDED",
      result: {
        marginals: [
          {
            nodeId: BN_NODE_A,
            values: [
              { stateId: BN_A_FALSE, probability: expect.closeTo(0.36, 12) },
              { stateId: BN_A_TRUE, probability: expect.closeTo(0.64, 12) },
            ],
          },
        ],
      },
    });
  }, 120_000);

  it("returns exact independent event-tree sequences and end-state frequencies through the API", async () => {
    const server = api.getHttpServer();
    const catalogueResponse = await authenticated(
      request(server)
        .post(`/api/projects/${ET_PROJECT_ID}/fault-tree-basic-event-catalogue`)
        .send({
          schemaVersion: "1.0.0",
          projectId: ET_PROJECT_ID,
          createdBy: USERNAME,
          basicEvents: [
            {
              id: ET_EVENT_A_ID,
              code: "ET-A",
              name: "ET event A",
              description: "Probability 0.1",
              probability: { value: 0.1 },
            },
            {
              id: ET_EVENT_B_ID,
              code: "ET-B",
              name: "ET event B",
              description: "Probability 0.2",
              probability: { value: 0.2 },
            },
          ],
        }),
    );
    expect(catalogueResponse.status).toBe(201);

    const faultTreeCreateResponse = await authenticated(
      request(server)
        .post(`/api/projects/${ET_PROJECT_ID}/method-models`)
        .send({
          schemaVersion: "1.0.0",
          projectId: ET_PROJECT_ID,
          methodType: "FAULT_TREE",
          code: "FT-ET-OR",
          name: "Event-tree functional failure",
          description: "OR formula used by the event-tree branches.",
          createdBy: USERNAME,
        }),
    );
    expect(faultTreeCreateResponse.status).toBe(201);
    const faultTreeId = faultTreeCreateResponse.body.id as string;
    const faultTreePatchResponse = await authenticated(
      request(server)
        .patch(`/api/projects/${ET_PROJECT_ID}/method-models/${faultTreeId}`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "FAULT_TREE",
          modelId: faultTreeId,
          expectedRevision: 1,
          updatedBy: USERNAME,
          changes: {
            topGate: { gateId: ET_GATE_ID },
            gates: [
              {
                id: ET_GATE_ID,
                code: "TOP",
                name: "Functional failure",
                description: "A or B fails",
                kind: "GATE",
                gateType: "OR",
              },
            ],
            leafNodes: [
              { id: ET_LEAF_A_ID, kind: "BASIC_EVENT_REFERENCE", basicEventId: ET_EVENT_A_ID },
              { id: ET_LEAF_B_ID, kind: "BASIC_EVENT_REFERENCE", basicEventId: ET_EVENT_B_ID },
            ],
            gateInputs: [
              {
                id: "123e4567-e89b-42d3-a456-426614174382",
                gateId: ET_GATE_ID,
                childId: ET_LEAF_A_ID,
                order: 0,
              },
              {
                id: "123e4567-e89b-42d3-a456-426614174383",
                gateId: ET_GATE_ID,
                childId: ET_LEAF_B_ID,
                order: 1,
              },
            ],
          },
        }),
    );
    expect(faultTreePatchResponse.status).toBe(200);
    expect(faultTreePatchResponse.body.revision).toBe(2);

    const eventTreeCreateResponse = await authenticated(
      request(server)
        .post(`/api/projects/${ET_PROJECT_ID}/method-models`)
        .send({
          schemaVersion: "1.0.0",
          projectId: ET_PROJECT_ID,
          methodType: "EVENT_TREE",
          code: "ET-API",
          name: "API event tree",
          description: "One functional event with explicit success complement.",
          createdBy: USERNAME,
        }),
    );
    expect(eventTreeCreateResponse.status).toBe(201);
    const eventTreeId = eventTreeCreateResponse.body.id as string;
    const eventTreePatchResponse = await authenticated(
      request(server)
        .patch(`/api/projects/${ET_PROJECT_ID}/method-models/${eventTreeId}`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "EVENT_TREE",
          modelId: eventTreeId,
          expectedRevision: 1,
          updatedBy: USERNAME,
          changes: {
            initiatingEvent: {
              target: { modelId: ET_INITIATING_MODEL_ID, entityId: ET_INITIATING_EVENT_ID },
            },
            initiatingEventFrequency: { value: 0.01 },
            functionalEvents: [
              {
                id: ET_FUNCTIONAL_EVENT_ID,
                code: "FUNCTION",
                name: "Safety function",
                description: "Succeeds unless the linked fault tree occurs.",
                order: 0,
              },
            ],
            functionalEventFaultTreeLinks: [
              {
                functionalEventId: ET_FUNCTIONAL_EVENT_ID,
                faultTreeTopGate: { modelId: faultTreeId, entityId: ET_GATE_ID },
              },
            ],
            endStates: [
              {
                id: ET_SAFE_END_STATE_ID,
                code: "SAFE",
                name: "Safe",
                description: "The safety function succeeds.",
              },
              {
                id: ET_RELEASE_END_STATE_ID,
                code: "RELEASE",
                name: "Release",
                description: "The safety function fails.",
              },
            ],
            sequences: [
              {
                id: ET_SUCCESS_SEQUENCE_ID,
                code: "SUCCESS",
                name: "Function succeeds",
                description: "Boolean complement of the linked failure tree.",
                path: [{ functionalEventId: ET_FUNCTIONAL_EVENT_ID, outcome: "SUCCESS" }],
                result: { kind: "END_STATE", endStateId: ET_SAFE_END_STATE_ID },
              },
              {
                id: ET_FAILURE_SEQUENCE_ID,
                code: "FAILURE",
                name: "Function fails",
                description: "Uses the linked fault-tree formula.",
                path: [{ functionalEventId: ET_FUNCTIONAL_EVENT_ID, outcome: "FAILURE" }],
                result: { kind: "END_STATE", endStateId: ET_RELEASE_END_STATE_ID },
              },
            ],
          },
        }),
    );
    expect(eventTreePatchResponse.status).toBe(200);
    expect(eventTreePatchResponse.body.revision).toBe(2);

    const validationResponse = await authenticated(
      request(server)
        .post(`/api/projects/${ET_PROJECT_ID}/method-models/${eventTreeId}/validate`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "EVENT_TREE",
          modelId: eventTreeId,
          revision: 2,
          mode: "ANALYSIS_READY",
          requestedBy: USERNAME,
        }),
    );
    expect(validationResponse.status).toBe(200);
    expect(validationResponse.body).toMatchObject({
      quantificationAllowed: true,
      validation: { valid: true, issues: [] },
    });

    const runResponse = await authenticated(
      request(server)
        .post(`/api/projects/${ET_PROJECT_ID}/method-models/${eventTreeId}/runs`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "EVENT_TREE",
          modelId: eventTreeId,
          revision: 2,
          mode: "INDEPENDENT",
          requestedBy: USERNAME,
        }),
    );
    expect(runResponse.status).toBe(202);
    expect(runResponse.body.run).toMatchObject({
      modelId: eventTreeId,
      modelRevision: 2,
      methodType: "EVENT_TREE",
      status: "SUCCEEDED",
      engine: { name: "PRAXIS", version: "0.1.0" },
      failure: null,
    });

    const runId = runResponse.body.run.id as string;
    const resultResponse = await authenticated(
      request(server).get(
        `/api/projects/${ET_PROJECT_ID}/method-models/${eventTreeId}/runs/${runId}/result`,
      ),
    );
    expect(resultResponse.status).toBe(200);
    expect(resultResponse.body.result).toMatchObject({
      modelId: eventTreeId,
      modelRevision: 2,
      mode: "INDEPENDENT",
      sequences: [
        {
          sequenceId: ET_SUCCESS_SEQUENCE_ID,
          conditionalProbability: expect.closeTo(0.72, 12),
          annualFrequency: expect.closeTo(0.0072, 12),
        },
        {
          sequenceId: ET_FAILURE_SEQUENCE_ID,
          conditionalProbability: expect.closeTo(0.28, 12),
          annualFrequency: expect.closeTo(0.0028, 12),
        },
      ],
      endStateAggregates: expect.arrayContaining([
        {
          endStateId: ET_SAFE_END_STATE_ID,
          annualFrequency: expect.closeTo(0.0072, 12),
        },
        {
          endStateId: ET_RELEASE_END_STATE_ID,
          annualFrequency: expect.closeTo(0.0028, 12),
        },
      ]),
      validationIssues: [],
    });
    const frequencySum = resultResponse.body.result.endStateAggregates.reduce(
      (sum: number, aggregate: { annualFrequency: number }) => sum + aggregate.annualFrequency,
      0,
    );
    expect(frequencySum).toBeCloseTo(0.01, 12);
    await expect(analysisRuns.findOne({ id: runId }).lean().exec()).resolves.toMatchObject({
      status: "SUCCEEDED",
      result: {
        sequences: [
          { conditionalProbability: expect.closeTo(0.72, 12) },
          { conditionalProbability: expect.closeTo(0.28, 12) },
        ],
      },
    });
  }, 120_000);

  it("returns correlated HCL fault-tree and event-tree results through the authenticated API", async () => {
    const server = api.getHttpServer();
    const catalogueResponse = await authenticated(
      request(server)
        .post(`/api/projects/${HCL_PROJECT_ID}/fault-tree-basic-event-catalogue`)
        .send({
          schemaVersion: "1.0.0",
          projectId: HCL_PROJECT_ID,
          createdBy: USERNAME,
          basicEvents: [
            {
              id: HCL_EVENT_A_ID,
              code: "HCL-A",
              name: "HCL event A",
              description: "Marginal probability 0.2",
              probability: { value: 0.2 },
            },
            {
              id: HCL_EVENT_B_ID,
              code: "HCL-B",
              name: "HCL event B",
              description: "Marginal probability 0.24",
              probability: { value: 0.24 },
            },
          ],
        }),
    );
    expect(catalogueResponse.status).toBe(201);

    const faultTreeCreateResponse = await authenticated(
      request(server)
        .post(`/api/projects/${HCL_PROJECT_ID}/method-models`)
        .send({
          schemaVersion: "1.0.0",
          projectId: HCL_PROJECT_ID,
          methodType: "FAULT_TREE",
          code: "FT-HCL-AND",
          name: "HCL fault tree",
          description: "AND tree driven by correlated Bayesian events.",
          createdBy: USERNAME,
        }),
    );
    expect(faultTreeCreateResponse.status).toBe(201);
    const faultTreeId = faultTreeCreateResponse.body.id as string;
    const faultTreePatchResponse = await authenticated(
      request(server)
        .patch(`/api/projects/${HCL_PROJECT_ID}/method-models/${faultTreeId}`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "FAULT_TREE",
          modelId: faultTreeId,
          expectedRevision: 1,
          updatedBy: USERNAME,
          changes: {
            topGate: { gateId: HCL_GATE_ID },
            gates: [
              {
                id: HCL_GATE_ID,
                code: "TOP",
                name: "Top AND gate",
                description: "A and B",
                kind: "GATE",
                gateType: "AND",
              },
            ],
            leafNodes: [
              {
                id: HCL_LEAF_A_ID,
                kind: "BASIC_EVENT_REFERENCE",
                basicEventId: HCL_EVENT_A_ID,
              },
              {
                id: HCL_LEAF_B_ID,
                kind: "BASIC_EVENT_REFERENCE",
                basicEventId: HCL_EVENT_B_ID,
              },
            ],
            gateInputs: [
              {
                id: "123e4567-e89b-42d3-a456-426614174345",
                gateId: HCL_GATE_ID,
                childId: HCL_LEAF_A_ID,
                order: 0,
              },
              {
                id: "123e4567-e89b-42d3-a456-426614174346",
                gateId: HCL_GATE_ID,
                childId: HCL_LEAF_B_ID,
                order: 1,
              },
            ],
          },
        }),
    );
    expect(faultTreePatchResponse.status).toBe(200);
    expect(faultTreePatchResponse.body.revision).toBe(2);

    const bayesianCreateResponse = await authenticated(
      request(server)
        .post(`/api/projects/${HCL_PROJECT_ID}/method-models`)
        .send({
          schemaVersion: "1.0.0",
          projectId: HCL_PROJECT_ID,
          methodType: "BAYESIAN_NETWORK",
          code: "BN-HCL",
          name: "HCL Bayesian network",
          description: "Correlated A and B fixture.",
          createdBy: USERNAME,
        }),
    );
    expect(bayesianCreateResponse.status).toBe(201);
    const bayesianNetworkId = bayesianCreateResponse.body.id as string;
    const bayesianPatchResponse = await authenticated(
      request(server)
        .patch(`/api/projects/${HCL_PROJECT_ID}/method-models/${bayesianNetworkId}`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "BAYESIAN_NETWORK",
          modelId: bayesianNetworkId,
          expectedRevision: 1,
          updatedBy: USERNAME,
          changes: {
            nodes: [
              {
                id: HCL_NODE_A,
                code: "A",
                name: "Cause A",
                description: "Parent event",
                kind: "CHANCE_NODE",
                states: [
                  { id: HCL_A_FALSE, code: "FALSE", name: "False" },
                  { id: HCL_A_TRUE, code: "TRUE", name: "True" },
                ],
              },
              {
                id: HCL_NODE_B,
                code: "B",
                name: "Effect B",
                description: "Conditional event",
                kind: "CHANCE_NODE",
                states: [
                  { id: HCL_B_FALSE, code: "FALSE", name: "False" },
                  { id: HCL_B_TRUE, code: "TRUE", name: "True" },
                ],
              },
            ],
            edges: [
              {
                id: "123e4567-e89b-42d3-a456-426614174356",
                parentNodeId: HCL_NODE_A,
                childNodeId: HCL_NODE_B,
              },
            ],
            conditionalProbabilityTables: [
              {
                nodeId: HCL_NODE_A,
                parents: [],
                rows: [
                  {
                    id: "123e4567-e89b-42d3-a456-426614174357",
                    parentStates: [],
                    values: [
                      { stateId: HCL_A_FALSE, probability: 0.8 },
                      { stateId: HCL_A_TRUE, probability: 0.2 },
                    ],
                  },
                ],
              },
              {
                nodeId: HCL_NODE_B,
                parents: [{ nodeId: HCL_NODE_A, order: 0 }],
                rows: [
                  {
                    id: "123e4567-e89b-42d3-a456-426614174358",
                    parentStates: [{ parentNodeId: HCL_NODE_A, stateId: HCL_A_FALSE }],
                    values: [
                      { stateId: HCL_B_FALSE, probability: 0.9 },
                      { stateId: HCL_B_TRUE, probability: 0.1 },
                    ],
                  },
                  {
                    id: "123e4567-e89b-42d3-a456-426614174359",
                    parentStates: [{ parentNodeId: HCL_NODE_A, stateId: HCL_A_TRUE }],
                    values: [
                      { stateId: HCL_B_FALSE, probability: 0.2 },
                      { stateId: HCL_B_TRUE, probability: 0.8 },
                    ],
                  },
                ],
              },
            ],
          },
        }),
    );
    expect(bayesianPatchResponse.status).toBe(200);
    expect(bayesianPatchResponse.body.revision).toBe(2);

    const hclCreateResponse = await authenticated(
      request(server)
        .post(`/api/projects/${HCL_PROJECT_ID}/method-models`)
        .send({
          schemaVersion: "1.0.0",
          projectId: HCL_PROJECT_ID,
          methodType: "HYBRID_CAUSAL_LOGIC",
          code: "HCL-API",
          name: "API HCL configuration",
          description: "Binds a correlated Bayesian network to an AND fault tree.",
          createdBy: USERNAME,
          bayesianNetwork: { modelId: bayesianNetworkId },
        }),
    );
    expect(hclCreateResponse.status).toBe(201);
    const hclModelId = hclCreateResponse.body.id as string;
    const hclPatchResponse = await authenticated(
      request(server)
        .patch(`/api/projects/${HCL_PROJECT_ID}/method-models/${hclModelId}`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "HYBRID_CAUSAL_LOGIC",
          modelId: hclModelId,
          expectedRevision: 1,
          updatedBy: USERNAME,
          changes: {
            faultTrees: [{ faultTree: { modelId: faultTreeId } }],
            bindings: [
              {
                id: HCL_BINDING_A,
                faultTreeBasicEvent: { modelId: faultTreeId, entityId: HCL_EVENT_A_ID },
                bayesianNetworkNode: { modelId: bayesianNetworkId, entityId: HCL_NODE_A },
                trueStateIds: [HCL_A_TRUE],
              },
              {
                id: HCL_BINDING_B,
                faultTreeBasicEvent: { modelId: faultTreeId, entityId: HCL_EVENT_B_ID },
                bayesianNetworkNode: { modelId: bayesianNetworkId, entityId: HCL_NODE_B },
                trueStateIds: [HCL_B_TRUE],
              },
            ],
            baseEvidence: { observations: [] },
            solverSettings: {
              variableOrder: [HCL_EVENT_A_ID, HCL_EVENT_B_ID],
              foldConstants: false,
              spliceNullGates: false,
            },
          },
        }),
    );
    expect(hclPatchResponse.status).toBe(200);
    expect(hclPatchResponse.body.revision).toBe(2);

    const validationResponse = await authenticated(
      request(server)
        .post(`/api/projects/${HCL_PROJECT_ID}/method-models/${hclModelId}/validate`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "HYBRID_CAUSAL_LOGIC",
          modelId: hclModelId,
          revision: 2,
          mode: "ANALYSIS_READY",
          requestedBy: USERNAME,
        }),
    );
    expect(validationResponse.status).toBe(200);
    expect(validationResponse.body).toMatchObject({
      quantificationAllowed: true,
      validation: { valid: true, issues: [] },
    });

    const runResponse = await authenticated(
      request(server)
        .post(`/api/projects/${HCL_PROJECT_ID}/method-models/${hclModelId}/runs`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "HYBRID_CAUSAL_LOGIC",
          modelId: hclModelId,
          revision: 2,
          requestedBy: USERNAME,
          faultTreeTopGate: { modelId: faultTreeId, entityId: HCL_GATE_ID },
        }),
    );
    expect(runResponse.status).toBe(202);
    expect(runResponse.body.run).toMatchObject({
      modelId: hclModelId,
      modelRevision: 2,
      methodType: "HYBRID_CAUSAL_LOGIC",
      status: "SUCCEEDED",
      engine: { name: "PRAXIS", version: "0.1.0" },
      failure: null,
    });

    const runId = runResponse.body.run.id as string;
    const resultResponse = await authenticated(
      request(server).get(
        `/api/projects/${HCL_PROJECT_ID}/method-models/${hclModelId}/runs/${runId}/result`,
      ),
    );
    expect(resultResponse.status).toBe(200);
    expect(resultResponse.body.result).toMatchObject({
      modelId: hclModelId,
      modelRevision: 2,
      faultTreeTopGate: { modelId: faultTreeId, entityId: HCL_GATE_ID },
      probability: expect.closeTo(0.16, 12),
      bddVariables: 2,
      variableOrder: [HCL_EVENT_A_ID, HCL_EVENT_B_ID],
      validationIssues: [],
    });
    expect(resultResponse.body.result.probability).not.toBeCloseTo(0.048, 12);
    await expect(analysisRuns.findOne({ id: runId }).lean().exec()).resolves.toMatchObject({
      status: "SUCCEEDED",
      result: {
        probability: expect.closeTo(0.16, 12),
        variableOrder: [HCL_EVENT_A_ID, HCL_EVENT_B_ID],
      },
    });

    const eventTreeCreateResponse = await authenticated(
      request(server)
        .post(`/api/projects/${HCL_PROJECT_ID}/method-models`)
        .send({
          schemaVersion: "1.0.0",
          projectId: HCL_PROJECT_ID,
          methodType: "EVENT_TREE",
          code: "ET-HCL-API",
          name: "HCL API event tree",
          description: "Two functional events sharing one correlated HCL fault-tree formula.",
          createdBy: USERNAME,
        }),
    );
    expect(eventTreeCreateResponse.status).toBe(201);
    const eventTreeId = eventTreeCreateResponse.body.id as string;
    const eventTreePatchResponse = await authenticated(
      request(server)
        .patch(`/api/projects/${HCL_PROJECT_ID}/method-models/${eventTreeId}`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "EVENT_TREE",
          modelId: eventTreeId,
          expectedRevision: 1,
          updatedBy: USERNAME,
          changes: {
            initiatingEvent: {
              target: { modelId: ET_INITIATING_MODEL_ID, entityId: ET_INITIATING_EVENT_ID },
            },
            initiatingEventFrequency: { value: 0.01 },
            functionalEvents: [
              {
                id: HCL_ET_FUNCTION_A,
                code: "HCL-F1",
                name: "HCL function one",
                description: "First use of the correlated failure formula.",
                order: 0,
              },
              {
                id: HCL_ET_FUNCTION_B,
                code: "HCL-F2",
                name: "HCL function two",
                description: "Second use of the same correlated failure formula.",
                order: 1,
              },
            ],
            functionalEventFaultTreeLinks: [
              {
                functionalEventId: HCL_ET_FUNCTION_A,
                faultTreeTopGate: { modelId: faultTreeId, entityId: HCL_GATE_ID },
              },
              {
                functionalEventId: HCL_ET_FUNCTION_B,
                faultTreeTopGate: { modelId: faultTreeId, entityId: HCL_GATE_ID },
              },
            ],
            endStates: [
              {
                id: HCL_ET_SAFE_STATE,
                code: "SAFE",
                name: "Safe",
                description: "The correlated failure formula does not occur.",
              },
              {
                id: HCL_ET_RELEASE_STATE,
                code: "RELEASE",
                name: "Release",
                description: "At least one functional failure branch is selected.",
              },
            ],
            sequences: [
              {
                id: HCL_ET_SS,
                code: "SS",
                name: "Success success",
                description: "Both functional events select the success complement.",
                path: [
                  { functionalEventId: HCL_ET_FUNCTION_A, outcome: "SUCCESS" },
                  { functionalEventId: HCL_ET_FUNCTION_B, outcome: "SUCCESS" },
                ],
                result: { kind: "END_STATE", endStateId: HCL_ET_SAFE_STATE },
              },
              {
                id: HCL_ET_SF,
                code: "SF",
                name: "Success failure",
                description: "The shared formula is both complemented and asserted.",
                path: [
                  { functionalEventId: HCL_ET_FUNCTION_A, outcome: "SUCCESS" },
                  { functionalEventId: HCL_ET_FUNCTION_B, outcome: "FAILURE" },
                ],
                result: { kind: "END_STATE", endStateId: HCL_ET_RELEASE_STATE },
              },
              {
                id: HCL_ET_FS,
                code: "FS",
                name: "Failure success",
                description: "The shared formula is asserted and complemented.",
                path: [
                  { functionalEventId: HCL_ET_FUNCTION_A, outcome: "FAILURE" },
                  { functionalEventId: HCL_ET_FUNCTION_B, outcome: "SUCCESS" },
                ],
                result: { kind: "END_STATE", endStateId: HCL_ET_RELEASE_STATE },
              },
              {
                id: HCL_ET_FF,
                code: "FF",
                name: "Failure failure",
                description: "Both functional events assert the correlated failure formula.",
                path: [
                  { functionalEventId: HCL_ET_FUNCTION_A, outcome: "FAILURE" },
                  { functionalEventId: HCL_ET_FUNCTION_B, outcome: "FAILURE" },
                ],
                result: { kind: "END_STATE", endStateId: HCL_ET_RELEASE_STATE },
              },
            ],
            hclConfiguration: { configuration: { modelId: hclModelId } },
          },
        }),
    );
    expect(eventTreePatchResponse.status).toBe(200);
    expect(eventTreePatchResponse.body.revision).toBe(2);

    const eventTreeValidationResponse = await authenticated(
      request(server)
        .post(`/api/projects/${HCL_PROJECT_ID}/method-models/${eventTreeId}/validate`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "EVENT_TREE",
          modelId: eventTreeId,
          revision: 2,
          mode: "ANALYSIS_READY",
          requestedBy: USERNAME,
        }),
    );
    expect(eventTreeValidationResponse.status).toBe(200);
    expect(eventTreeValidationResponse.body).toMatchObject({
      quantificationAllowed: true,
      validation: { valid: true, issues: [] },
    });

    const eventTreeRunResponse = await authenticated(
      request(server)
        .post(`/api/projects/${HCL_PROJECT_ID}/method-models/${eventTreeId}/runs`)
        .send({
          schemaVersion: "1.0.0",
          methodType: "EVENT_TREE",
          modelId: eventTreeId,
          revision: 2,
          mode: "HYBRID_CAUSAL_LOGIC",
          requestedBy: USERNAME,
        }),
    );
    expect(eventTreeRunResponse.status).toBe(202);
    expect(eventTreeRunResponse.body.run).toMatchObject({
      modelId: eventTreeId,
      modelRevision: 2,
      methodType: "EVENT_TREE",
      status: "SUCCEEDED",
      engine: { name: "PRAXIS", version: "0.1.0" },
      failure: null,
    });

    const eventTreeRunId = eventTreeRunResponse.body.run.id as string;
    const eventTreeResultResponse = await authenticated(
      request(server).get(
        `/api/projects/${HCL_PROJECT_ID}/method-models/${eventTreeId}/runs/${eventTreeRunId}/result`,
      ),
    );
    expect(eventTreeResultResponse.status).toBe(200);
    expect(eventTreeResultResponse.body.result).toMatchObject({
      modelId: eventTreeId,
      modelRevision: 2,
      mode: "HYBRID_CAUSAL_LOGIC",
      sequences: [
        {
          sequenceId: HCL_ET_SS,
          conditionalProbability: expect.closeTo(0.84, 12),
          annualFrequency: expect.closeTo(0.0084, 12),
        },
        {
          sequenceId: HCL_ET_SF,
          conditionalProbability: expect.closeTo(0, 12),
          annualFrequency: expect.closeTo(0, 12),
        },
        {
          sequenceId: HCL_ET_FS,
          conditionalProbability: expect.closeTo(0, 12),
          annualFrequency: expect.closeTo(0, 12),
        },
        {
          sequenceId: HCL_ET_FF,
          conditionalProbability: expect.closeTo(0.16, 12),
          annualFrequency: expect.closeTo(0.0016, 12),
        },
      ],
      endStateAggregates: expect.arrayContaining([
        {
          endStateId: HCL_ET_SAFE_STATE,
          annualFrequency: expect.closeTo(0.0084, 12),
        },
        {
          endStateId: HCL_ET_RELEASE_STATE,
          annualFrequency: expect.closeTo(0.0016, 12),
        },
      ]),
      validationIssues: [],
    });
    expect(
      eventTreeResultResponse.body.result.sequences.find(
        (sequence: { sequenceId: string }) => sequence.sequenceId === HCL_ET_FF,
      ).conditionalProbability,
    ).not.toBeCloseTo(0.048, 12);
    await expect(
      analysisRuns.findOne({ id: eventTreeRunId }).lean().exec(),
    ).resolves.toMatchObject({
      status: "SUCCEEDED",
      result: {
        mode: "HYBRID_CAUSAL_LOGIC",
        sequences: [
          { conditionalProbability: expect.closeTo(0.84, 12) },
          { conditionalProbability: expect.closeTo(0, 12) },
          { conditionalProbability: expect.closeTo(0, 12) },
          { conditionalProbability: expect.closeTo(0.16, 12) },
        ],
      },
    });
  }, 120_000);
});
