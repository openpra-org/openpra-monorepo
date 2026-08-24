import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  Post,
} from "@nestjs/common";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";
import type { Model } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { PraxisNativeService } from "../../../../../../microservices/praetor/src/execution/services/praxis-native.service";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { createBlankEs } from "../../../es-workbooks/blank-es";
import { EsWorkbook, EsWorkbookSchema } from "../../../es-workbooks/es-workbook.schema";
import { EsWorkbooksController } from "../../../es-workbooks/es-workbooks.controller";
import { EsWorkbooksService } from "../../../es-workbooks/es-workbooks.service";
import { createBlankEsq } from "../../../esq-workbooks/blank-esq";
import { EsqWorkbook, EsqWorkbookSchema } from "../../../esq-workbooks/esq-workbook.schema";
import { EsqWorkbooksController } from "../../../esq-workbooks/esq-workbooks.controller";
import { EsqWorkbooksService } from "../../../esq-workbooks/esq-workbooks.service";
import { ProjectsService } from "../../../projects/projects.service";
import { createBlankSy } from "../../../sy-workbooks/blank-sy";
import { SyWorkbook, SyWorkbookSchema } from "../../../sy-workbooks/sy-workbook.schema";
import { SyWorkbooksController } from "../../../sy-workbooks/sy-workbooks.controller";
import { SyWorkbooksService } from "../../../sy-workbooks/sy-workbooks.service";
import { WorkbookModelAccessService } from "../../../workbooks/workbook-model-access.service";
import {
  AnalysisRunRecord,
  AnalysisRunRecordSchema,
  type AnalysisRunRecordDocument,
} from "../analysis-run-record.schema";
import { PraetorAnalysisClient } from "../praetor-analysis.client";
import { WorkbookAnalysisRunsService } from "../workbook-analysis-runs.service";

const USERNAME = "analyst";
const PROJECT_ID = "project-workbook-method-runs";
const SY_WORKBOOK_ID = "sy-workbook-runs";
const ES_WORKBOOK_ID = "es-workbook-runs";
const ESQ_WORKBOOK_ID = "esq-workbook-runs";

const FT_OR = "10000000-0000-4000-8000-000000000001";
const FT_AND = "10000000-0000-4000-8000-000000000002";
const TOP_OR = "10000000-0000-4000-8000-000000000003";
const TOP_AND = "10000000-0000-4000-8000-000000000004";
const EVENT_A = "10000000-0000-4000-8000-000000000005";
const EVENT_B = "10000000-0000-4000-8000-000000000006";
const OR_LEAF_A = "10000000-0000-4000-8000-000000000007";
const OR_LEAF_B = "10000000-0000-4000-8000-000000000008";
const AND_LEAF_A = "10000000-0000-4000-8000-000000000009";
const AND_LEAF_B = "10000000-0000-4000-8000-000000000010";
const FT_TRANSFER = "10000000-0000-4000-8000-000000000011";
// Fault-tree entity ids are model-local; these deliberate overlaps exercise transfer flattening.
const TOP_TRANSFER = TOP_AND;
const TRANSFER_LEAF = AND_LEAF_A;

const BN = "20000000-0000-4000-8000-000000000001";
const NODE_A = "20000000-0000-4000-8000-000000000002";
const NODE_B = "20000000-0000-4000-8000-000000000003";
const A_FALSE = "20000000-0000-4000-8000-000000000004";
const A_TRUE = "20000000-0000-4000-8000-000000000005";
const B_FALSE = "20000000-0000-4000-8000-000000000006";
const B_TRUE = "20000000-0000-4000-8000-000000000007";
const HCL = "20000000-0000-4000-8000-000000000008";

const ET_INDEPENDENT = "30000000-0000-4000-8000-000000000001";
const ET_HCL = "30000000-0000-4000-8000-000000000002";
const FE_INDEPENDENT = "30000000-0000-4000-8000-000000000003";
const FE_HCL_A = "30000000-0000-4000-8000-000000000004";
const FE_HCL_B = "30000000-0000-4000-8000-000000000005";
const SAFE = "30000000-0000-4000-8000-000000000006";
const RELEASE = "30000000-0000-4000-8000-000000000007";
const ET_SUCCESS = "30000000-0000-4000-8000-000000000008";
const ET_FAILURE = "30000000-0000-4000-8000-000000000009";
const HCL_SS = "30000000-0000-4000-8000-000000000010";
const HCL_SF = "30000000-0000-4000-8000-000000000011";
const HCL_FS = "30000000-0000-4000-8000-000000000012";
const HCL_FF = "30000000-0000-4000-8000-000000000013";

@Controller()
class TestPraetorController {
  constructor(private readonly nativeService: PraxisNativeService) {}

  @Post("praxis/native/execute")
  @HttpCode(HttpStatus.OK)
  execute(@Body() body: unknown): Promise<Record<string, unknown>> {
    return this.nativeService.run("execute", body);
  }
}

const topReference = (modelId: string, entityId: string) => ({
  referenceType: "FAULT_TREE_TOP_EVENT" as const,
  workbookId: SY_WORKBOOK_ID,
  modelId,
  entityId,
});

const createSyMef = () => {
  const mef = createBlankSy("Run fixtures", USERNAME);
  mef.systemBasicEvents = [
    {
      uuid: EVENT_A,
      code: "EVENT-A",
      name: "Event A",
      description: "Probability 0.1",
      eventType: "BASIC",
      probability: 0.1,
      implementsSrs: [],
    },
    {
      uuid: EVENT_B,
      code: "EVENT-B",
      name: "Event B",
      description: "Probability 0.2",
      eventType: "BASIC",
      probability: 0.2,
      implementsSrs: [],
    },
  ];
  mef.systemLogicModels = [
    {
      uuid: FT_OR,
      code: "FT-OR",
      name: "Top OR",
      systemReference: "SYS-OR",
      description: "A or B",
      modelRepresentation: "Fault tree",
      topGate: { gateId: TOP_OR },
      gates: [
        {
          id: TOP_OR,
          code: "TOP-OR",
          name: "Top OR",
          description: "A or B",
          kind: "GATE",
          gateType: "OR",
        },
      ],
      leafNodes: [
        { id: OR_LEAF_A, kind: "BASIC_EVENT_REFERENCE", basicEventId: EVENT_A },
        { id: OR_LEAF_B, kind: "BASIC_EVENT_REFERENCE", basicEventId: EVENT_B },
      ],
      gateInputs: [
        { id: `${TOP_OR}:${OR_LEAF_A}:0`, gateId: TOP_OR, childId: OR_LEAF_A, order: 0 },
        { id: `${TOP_OR}:${OR_LEAF_B}:1`, gateId: TOP_OR, childId: OR_LEAF_B, order: 1 },
      ],
      nodePositions: [],
      layout: {
        viewport: { x: 0, y: 0, zoom: 1 },
        mode: "AUTOMATIC",
        direction: "TOP_TO_BOTTOM",
      },
      implementsSrs: [],
    },
    {
      uuid: FT_AND,
      code: "FT-AND",
      name: "Top AND",
      systemReference: "SYS-AND",
      description: "A and B",
      modelRepresentation: "Fault tree",
      topGate: { gateId: TOP_AND },
      gates: [
        {
          id: TOP_AND,
          code: "TOP-AND",
          name: "Top AND",
          description: "A and B",
          kind: "GATE",
          gateType: "AND",
        },
      ],
      leafNodes: [
        { id: AND_LEAF_A, kind: "BASIC_EVENT_REFERENCE", basicEventId: EVENT_A },
        { id: AND_LEAF_B, kind: "BASIC_EVENT_REFERENCE", basicEventId: EVENT_B },
      ],
      gateInputs: [
        { id: `${TOP_AND}:${AND_LEAF_A}:0`, gateId: TOP_AND, childId: AND_LEAF_A, order: 0 },
        { id: `${TOP_AND}:${AND_LEAF_B}:1`, gateId: TOP_AND, childId: AND_LEAF_B, order: 1 },
      ],
      nodePositions: [],
      layout: {
        viewport: { x: 0, y: 0, zoom: 1 },
        mode: "AUTOMATIC",
        direction: "TOP_TO_BOTTOM",
      },
      implementsSrs: [],
    },
    {
      uuid: FT_TRANSFER,
      code: "FT-TRANSFER",
      name: "Transferred AND",
      systemReference: "SYS-TRANSFER",
      description: "Transfer to the shared AND fault tree",
      modelRepresentation: "Fault tree",
      topGate: { gateId: TOP_TRANSFER },
      gates: [
        {
          id: TOP_TRANSFER,
          code: "TOP-TRANSFER",
          name: "Transferred AND",
          description: "Delegates to the shared AND top gate",
          kind: "GATE",
          gateType: "OR",
        },
      ],
      leafNodes: [
        {
          id: TRANSFER_LEAF,
          code: "TRANSFER-AND",
          name: "Transfer to AND",
          description: "Reference to the shared AND model",
          kind: "TRANSFER_REFERENCE",
          target: { modelId: FT_AND, entityId: TOP_AND },
        },
      ],
      gateInputs: [
        {
          id: `${TOP_TRANSFER}:${TRANSFER_LEAF}:0`,
          gateId: TOP_TRANSFER,
          childId: TRANSFER_LEAF,
          order: 0,
        },
      ],
      nodePositions: [],
      layout: {
        viewport: { x: 0, y: 0, zoom: 1 },
        mode: "AUTOMATIC",
        direction: "TOP_TO_BOTTOM",
      },
      implementsSrs: [],
    },
  ];
  return mef;
};

const createEsqMef = () => {
  const mef = createBlankEsq("BN and HCL fixtures", USERNAME);
  mef.bayesianNetworks = [
    {
      modelId: BN,
      code: "BN-1",
      name: "Correlated events",
      description: "A causes B",
      nodes: [
        {
          id: NODE_A,
          code: "A",
          name: "A",
          description: "Cause",
          kind: "CHANCE_NODE",
          states: [
            { id: A_FALSE, code: "FALSE", name: "False" },
            { id: A_TRUE, code: "TRUE", name: "True" },
          ],
        },
        {
          id: NODE_B,
          code: "B",
          name: "B",
          description: "Effect",
          kind: "CHANCE_NODE",
          states: [
            { id: B_FALSE, code: "FALSE", name: "False" },
            { id: B_TRUE, code: "TRUE", name: "True" },
          ],
        },
      ],
      edges: [
        {
          id: "20000000-0000-4000-8000-000000000009",
          parentNodeId: NODE_A,
          childNodeId: NODE_B,
        },
      ],
      conditionalProbabilityTables: [
        {
          nodeId: NODE_A,
          parents: [],
          rows: [
            {
              id: "20000000-0000-4000-8000-000000000010",
              parentStates: [],
              values: [
                { stateId: A_FALSE, probability: 0.8 },
                { stateId: A_TRUE, probability: 0.2 },
              ],
            },
          ],
        },
        {
          nodeId: NODE_B,
          parents: [{ nodeId: NODE_A, order: 0 }],
          rows: [
            {
              id: "20000000-0000-4000-8000-000000000011",
              parentStates: [{ parentNodeId: NODE_A, stateId: A_FALSE }],
              values: [
                { stateId: B_FALSE, probability: 0.8875 },
                { stateId: B_TRUE, probability: 0.1125 },
              ],
            },
            {
              id: "20000000-0000-4000-8000-000000000012",
              parentStates: [{ parentNodeId: NODE_A, stateId: A_TRUE }],
              values: [
                { stateId: B_FALSE, probability: 0.2 },
                { stateId: B_TRUE, probability: 0.8 },
              ],
            },
          ],
        },
      ],
      nodePositions: [
        { nodeId: NODE_A, position: { x: 0, y: 0 } },
        { nodeId: NODE_B, position: { x: 200, y: 0 } },
      ],
      layout: {
        viewport: { x: 0, y: 0, zoom: 1 },
        mode: "MANUAL",
        direction: "LEFT_TO_RIGHT",
      },
    },
  ];
  mef.hclConfigurations = [
    {
      modelId: HCL,
      code: "HCL-1",
      name: "HCL bindings",
      description: "Bind the AND tree to the correlated BN",
      bayesianNetwork: { workbookId: ESQ_WORKBOOK_ID, modelId: BN },
      faultTrees: [{ workbookId: SY_WORKBOOK_ID, modelId: FT_AND }],
      bindings: [
        {
          id: "20000000-0000-4000-8000-000000000013",
          faultTreeBasicEvent: {
            referenceType: "FAULT_TREE_BASIC_EVENT",
            workbookId: SY_WORKBOOK_ID,
            entityId: EVENT_A,
          },
          bayesianNetworkNode: {
            referenceType: "BAYESIAN_NETWORK_NODE",
            workbookId: ESQ_WORKBOOK_ID,
            modelId: BN,
            entityId: NODE_A,
          },
          trueStateIds: [A_TRUE],
        },
        {
          id: "20000000-0000-4000-8000-000000000014",
          faultTreeBasicEvent: {
            referenceType: "FAULT_TREE_BASIC_EVENT",
            workbookId: SY_WORKBOOK_ID,
            entityId: EVENT_B,
          },
          bayesianNetworkNode: {
            referenceType: "BAYESIAN_NETWORK_NODE",
            workbookId: ESQ_WORKBOOK_ID,
            modelId: BN,
            entityId: NODE_B,
          },
          trueStateIds: [B_TRUE],
        },
      ],
      baseEvidence: { observations: [] },
      solverSettings: {
        variableOrder: [EVENT_A, EVENT_B],
        foldConstants: false,
        spliceNullGates: false,
      },
    },
  ];
  return mef;
};

const createEsMef = () => {
  const mef = createBlankEs("ET fixtures", USERNAME);
  mef.eventTrees = [
    {
      uuid: ET_INDEPENDENT,
      name: "Independent ET",
      initiatingEventId: "initiator-independent",
      initiatingEventFrequency: { value: 0.01 },
      functionalEvents: {
        first: {
          uuid: FE_INDEPENDENT,
          name: "OR tree failure",
          order: 0,
          faultTreeTopEvent: topReference(FT_OR, TOP_OR),
        },
      },
      sequences: {
        success: {
          uuid: ET_SUCCESS,
          name: "Success",
          endState: "SUCCESSFUL_MITIGATION",
          functionalEventStates: { [FE_INDEPENDENT]: "SUCCESS" },
        },
        failure: {
          uuid: ET_FAILURE,
          name: "Failure",
          endState: "RADIONUCLIDE_RELEASE",
          functionalEventStates: { [FE_INDEPENDENT]: "FAILURE" },
        },
      },
      endStateIds: {
        SUCCESSFUL_MITIGATION: SAFE,
        RADIONUCLIDE_RELEASE: RELEASE,
      },
      branches: {},
      initialState: { branchId: "initial" },
      implementsSrs: [],
    },
    {
      uuid: ET_HCL,
      name: "HCL ET",
      initiatingEventId: "initiator-hcl",
      initiatingEventFrequency: { value: 0.01 },
      functionalEvents: {
        first: {
          uuid: FE_HCL_A,
          name: "AND tree first use",
          order: 0,
          faultTreeTopEvent: topReference(FT_AND, TOP_AND),
        },
        second: {
          uuid: FE_HCL_B,
          name: "AND tree second use",
          order: 1,
          faultTreeTopEvent: topReference(FT_AND, TOP_AND),
        },
      },
      sequences: {
        ss: {
          uuid: HCL_SS,
          name: "SS",
          endState: "SUCCESSFUL_MITIGATION",
          functionalEventStates: { [FE_HCL_A]: "SUCCESS", [FE_HCL_B]: "SUCCESS" },
        },
        sf: {
          uuid: HCL_SF,
          name: "SF",
          endState: "RADIONUCLIDE_RELEASE",
          functionalEventStates: { [FE_HCL_A]: "SUCCESS", [FE_HCL_B]: "FAILURE" },
        },
        fs: {
          uuid: HCL_FS,
          name: "FS",
          endState: "RADIONUCLIDE_RELEASE",
          functionalEventStates: { [FE_HCL_A]: "FAILURE", [FE_HCL_B]: "SUCCESS" },
        },
        ff: {
          uuid: HCL_FF,
          name: "FF",
          endState: "RADIONUCLIDE_RELEASE",
          functionalEventStates: { [FE_HCL_A]: "FAILURE", [FE_HCL_B]: "FAILURE" },
        },
      },
      endStateIds: {
        SUCCESSFUL_MITIGATION: SAFE,
        RADIONUCLIDE_RELEASE: RELEASE,
      },
      branches: {},
      initialState: { branchId: "initial" },
      implementsSrs: [],
    },
  ];
  return mef;
};

describe("workbook-owned analysis-run APIs", () => {
  let api: INestApplication;
  let praetor: INestApplication;
  let mongo: MongoMemoryServer;
  let runs: Model<AnalysisRunRecordDocument>;
  let praetorClient: PraetorAnalysisClient;
  let executionAllowed = true;
  let originalPraetorUrl: string | undefined;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const praetorModule = await Test.createTestingModule({
      controllers: [TestPraetorController],
      providers: [PraxisNativeService],
    }).compile();
    praetor = praetorModule.createNestApplication();
    await praetor.listen(0, "127.0.0.1");
    const address = praetor.getHttpServer().address() as AddressInfo;
    originalPraetorUrl = process.env["PRAETOR_URL"];
    process.env["PRAETOR_URL"] = `http://127.0.0.1:${address.port}`;

    const accessService = {
      requireExecution: jest.fn().mockImplementation(() => {
        if (!executionAllowed) throw new ForbiddenException("Execution denied");
        return Promise.resolve({ projectRole: "editor", workbookRoles: ["preparer"] });
      }),
    };
    const authGuard = {
      canActivate: jest.fn((context: ExecutionContext) => {
        context.switchToHttp().getRequest().user = { username: USERNAME };
        return true;
      }),
    } satisfies CanActivate;
    const moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongo.getUri()),
        MongooseModule.forFeature([
          { name: AnalysisRunRecord.name, schema: AnalysisRunRecordSchema },
          { name: SyWorkbook.name, schema: SyWorkbookSchema },
          { name: EsWorkbook.name, schema: EsWorkbookSchema },
          { name: EsqWorkbook.name, schema: EsqWorkbookSchema },
        ]),
      ],
      controllers: [SyWorkbooksController, EsWorkbooksController, EsqWorkbooksController],
      providers: [
        WorkbookAnalysisRunsService,
        PraetorAnalysisClient,
        { provide: WorkbookModelAccessService, useValue: accessService },
        {
          provide: ProjectsService,
          useValue: { resolveAccess: jest.fn().mockResolvedValue({ role: "editor" }) },
        },
        { provide: SyWorkbooksService, useValue: {} },
        { provide: EsWorkbooksService, useValue: {} },
        { provide: EsqWorkbooksService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .compile();
    api = moduleRef.createNestApplication();
    api.setGlobalPrefix("api");
    await api.init();
    runs = moduleRef.get(getModelToken(AnalysisRunRecord.name));
    praetorClient = moduleRef.get(PraetorAnalysisClient);

    await moduleRef.get<Model<unknown>>(getModelToken(SyWorkbook.name)).create({
      workbookId: SY_WORKBOOK_ID,
      projectId: PROJECT_ID,
      ownerUsername: USERNAME,
      revision: 3,
      mef: createSyMef(),
    });
    await moduleRef.get<Model<unknown>>(getModelToken(EsWorkbook.name)).create({
      workbookId: ES_WORKBOOK_ID,
      projectId: PROJECT_ID,
      ownerUsername: USERNAME,
      revision: 5,
      mef: createEsMef(),
    });
    await moduleRef.get<Model<unknown>>(getModelToken(EsqWorkbook.name)).create({
      workbookId: ESQ_WORKBOOK_ID,
      projectId: PROJECT_ID,
      ownerUsername: USERNAME,
      revision: 7,
      mef: createEsqMef(),
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
    executionAllowed = true;
    jest.restoreAllMocks();
  });

  it("executes an SY-owned OR fault tree through PRAXIS and returns 0.28", async () => {
    const response = await request(api.getHttpServer())
      .post(`/api/sy-workbooks/${SY_WORKBOOK_ID}/fault-trees/${FT_OR}/runs`)
      .send({ schemaVersion: "1.0.0", modelId: FT_OR, workbookRevision: 3 });
    expect(response.status).toBe(200);
    expect(response.body.run).toMatchObject({
      owner: { workbookId: SY_WORKBOOK_ID, modelId: FT_OR, workbookRevision: 3 },
      methodType: "FAULT_TREE",
      status: "SUCCEEDED",
    });

    const result = await request(api.getHttpServer()).get(
      `/api/sy-workbooks/${SY_WORKBOOK_ID}/fault-trees/${FT_OR}/runs/${response.body.run.id}/result`,
    );
    expect(result.status).toBe(200);
    expect(result.body.topEventProbability).toBeCloseTo(0.28, 12);
    expect(result.body.leadingCutSets.map((set: { probability: number }) => set.probability)).toEqual([
      0.2,
      0.1,
    ]);
    expect(result.body.leadingCutSets.map((set: { contribution: number }) => set.contribution)).toEqual([
      expect.closeTo(0.2 / 0.28, 12),
      expect.closeTo(0.1 / 0.28, 12),
    ]);
  }, 120_000);

  it("quantifies an SY transfer reference through the existing fault-tree run API", async () => {
    const response = await request(api.getHttpServer())
      .post(`/api/sy-workbooks/${SY_WORKBOOK_ID}/fault-trees/${FT_TRANSFER}/runs`)
      .send({ schemaVersion: "1.0.0", modelId: FT_TRANSFER, workbookRevision: 3 });
    expect(response.status).toBe(200);
    expect(response.body.run).toMatchObject({
      owner: { workbookId: SY_WORKBOOK_ID, modelId: FT_TRANSFER, workbookRevision: 3 },
      methodType: "FAULT_TREE",
      status: "SUCCEEDED",
    });

    const result = await request(api.getHttpServer()).get(
      `/api/sy-workbooks/${SY_WORKBOOK_ID}/fault-trees/${FT_TRANSFER}/runs/${response.body.run.id}/result`,
    );
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      topGateId: TOP_TRANSFER,
      topEventProbability: expect.closeTo(0.02, 12),
      minimalCutSetCount: 1,
      leadingCutSets: [
        expect.objectContaining({
          order: 2,
          probability: expect.closeTo(0.02, 12),
          events: [
            { basicEventId: EVENT_A, complemented: false },
            { basicEventId: EVENT_B, complemented: false },
          ],
        }),
      ],
    });
  }, 120_000);

  it("executes an ESQ-owned BN query and returns the exact 0.64 posterior", async () => {
    const response = await request(api.getHttpServer())
      .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/bayesian-networks/${BN}/runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: BN,
        workbookRevision: 7,
        query: {
          evidence: { observations: [{ nodeId: NODE_B, stateId: B_TRUE }] },
          queryNodeIds: [NODE_A],
        },
      });
    expect(response.status).toBe(200);
    expect(response.body.run.status).toBe("SUCCEEDED");
    const result = await request(api.getHttpServer()).get(
      `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/bayesian-networks/${BN}/runs/${response.body.run.id}/result`,
    );
    expect(result.status).toBe(200);
    expect(result.body.marginals).toEqual([
      {
        nodeId: NODE_A,
        values: [
          { stateId: A_FALSE, probability: expect.closeTo(0.36, 12) },
          { stateId: A_TRUE, probability: expect.closeTo(0.64, 12) },
        ],
      },
    ]);
  }, 120_000);

  it("executes an ES-owned ET with a typed SY top-event reference", async () => {
    const response = await request(api.getHttpServer())
      .post(`/api/es-workbooks/${ES_WORKBOOK_ID}/event-trees/${ET_INDEPENDENT}/runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: ET_INDEPENDENT,
        workbookRevision: 5,
        mode: "INDEPENDENT",
      });
    expect(response.status).toBe(200);
    expect(response.body.run.sourceWorkbooks).toEqual([
      { workbookId: ES_WORKBOOK_ID, workbookRevision: 5 },
      { workbookId: SY_WORKBOOK_ID, workbookRevision: 3 },
    ]);
    const result = await request(api.getHttpServer()).get(
      `/api/es-workbooks/${ES_WORKBOOK_ID}/event-trees/${ET_INDEPENDENT}/runs/${response.body.run.id}/result`,
    );
    expect(result.status).toBe(200);
    expect(result.body.sequences).toEqual([
      expect.objectContaining({
        sequenceId: ET_SUCCESS,
        conditionalProbability: expect.closeTo(0.72, 12),
        annualFrequency: expect.closeTo(0.0072, 12),
      }),
      expect.objectContaining({
        sequenceId: ET_FAILURE,
        conditionalProbability: expect.closeTo(0.28, 12),
        annualFrequency: expect.closeTo(0.0028, 12),
      }),
    ]);
  }, 120_000);

  it("executes exact HCL FT and HCL ET runs through the integration workbook API", async () => {
    const faultTree = await request(api.getHttpServer())
      .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/fault-tree-runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: HCL,
        workbookRevision: 7,
        faultTreeTopGate: topReference(FT_AND, TOP_AND),
      });
    expect(faultTree.status).toBe(200);
    const faultTreeResult = await request(api.getHttpServer()).get(
      `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/runs/${faultTree.body.run.id}/result`,
    );
    expect(faultTreeResult.status).toBe(200);
    expect(faultTreeResult.body.probability).toBeCloseTo(0.16, 12);
    expect(faultTreeResult.body.probability).not.toBeCloseTo(0.02, 12);

    const eventTree = await request(api.getHttpServer())
      .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/event-tree-runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: HCL,
        workbookRevision: 7,
        eventTree: { workbookId: ES_WORKBOOK_ID, modelId: ET_HCL },
      });
    expect(eventTree.status).toBe(200);
    const eventTreeResult = await request(api.getHttpServer()).get(
      `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/runs/${eventTree.body.run.id}/result`,
    );
    expect(eventTreeResult.status).toBe(200);
    expect(eventTreeResult.body.sequences).toEqual([
      expect.objectContaining({ sequenceId: HCL_SS, conditionalProbability: expect.closeTo(0.84, 12) }),
      expect.objectContaining({ sequenceId: HCL_SF, conditionalProbability: expect.closeTo(0, 12) }),
      expect.objectContaining({ sequenceId: HCL_FS, conditionalProbability: expect.closeTo(0, 12) }),
      expect.objectContaining({ sequenceId: HCL_FF, conditionalProbability: expect.closeTo(0.16, 12) }),
    ]);
  }, 120_000);

  it("persists and retrieves immutable run snapshots with every contributing revision", async () => {
    const success = await request(api.getHttpServer())
      .post(`/api/es-workbooks/${ES_WORKBOOK_ID}/event-trees/${ET_INDEPENDENT}/runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: ET_INDEPENDENT,
        workbookRevision: 5,
        mode: "INDEPENDENT",
      });
    const stored = await runs.findOne({ id: success.body.run.id }).lean().exec();
    expect(stored).toMatchObject({
      owner: { workbookId: ES_WORKBOOK_ID, modelId: ET_INDEPENDENT, workbookRevision: 5 },
      sourceWorkbooks: [
        { workbookId: ES_WORKBOOK_ID, workbookRevision: 5 },
        { workbookId: SY_WORKBOOK_ID, workbookRevision: 3 },
      ],
      workbookSnapshots: [
        { hostType: "ES", identity: { workbookId: ES_WORKBOOK_ID, workbookRevision: 5 } },
        { hostType: "SY", identity: { workbookId: SY_WORKBOOK_ID, workbookRevision: 3 } },
      ],
      status: "SUCCEEDED",
    });

    const status = await request(api.getHttpServer()).get(
      `/api/es-workbooks/${ES_WORKBOOK_ID}/event-trees/${ET_INDEPENDENT}/runs/${success.body.run.id}`,
    );
    const result = await request(api.getHttpServer()).get(
      `/api/es-workbooks/${ES_WORKBOOK_ID}/event-trees/${ET_INDEPENDENT}/runs/${success.body.run.id}/result`,
    );
    expect(status.status).toBe(200);
    expect(status.body.sourceWorkbooks).toEqual(stored!.sourceWorkbooks);
    expect(result.status).toBe(200);
    expect(result.body.owner).toEqual(stored!.owner);
  }, 120_000);

  it("covers permission, revision, reference, malformed-response, and result boundaries", async () => {

    executionAllowed = false;
    const forbidden = await request(api.getHttpServer())
      .post(`/api/sy-workbooks/${SY_WORKBOOK_ID}/fault-trees/${FT_OR}/runs`)
      .send({ schemaVersion: "1.0.0", modelId: FT_OR, workbookRevision: 3 });
    expect(forbidden.status).toBe(403);
    executionAllowed = true;

    const stale = await request(api.getHttpServer())
      .post(`/api/sy-workbooks/${SY_WORKBOOK_ID}/fault-trees/${FT_OR}/runs`)
      .send({ schemaVersion: "1.0.0", modelId: FT_OR, workbookRevision: 2 });
    expect(stale.status).toBe(409);

    const missing = await request(api.getHttpServer())
      .post(`/api/sy-workbooks/${SY_WORKBOOK_ID}/fault-trees/40000000-0000-4000-8000-000000000001/runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: "40000000-0000-4000-8000-000000000001",
        workbookRevision: 3,
      });
    expect(missing.status).toBe(404);

    jest.spyOn(praetorClient, "execute").mockResolvedValueOnce({
      schemaVersion: "1.0.0",
      result: { malformed: true },
    });
    const malformed = await request(api.getHttpServer())
      .post(`/api/sy-workbooks/${SY_WORKBOOK_ID}/fault-trees/${FT_OR}/runs`)
      .send({ schemaVersion: "1.0.0", modelId: FT_OR, workbookRevision: 3 });
    expect(malformed.status).toBe(502);
    const failedRun = await runs.findOne({ status: "FAILED" }).sort({ requestedAt: -1 }).lean().exec();
    expect(failedRun?.failure).toMatchObject({ code: "PRAETOR_FAILURE" });

    const unavailable = await request(api.getHttpServer()).get(
      `/api/sy-workbooks/${SY_WORKBOOK_ID}/fault-trees/${FT_OR}/runs/${failedRun!.id}/result`,
    );
    expect(unavailable.status).toBe(409);
  }, 120_000);
});
