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
import type { NestExpressApplication } from "@nestjs/platform-express";
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
import {
  DA_ANALYSIS_HCL,
  ES_ANALYSIS_HCL,
  ESQ_ANALYSIS_HCL,
  HR_ANALYSIS_HCL,
  HCL_CASE_EVENT_TREE_IDS,
  HCL_CASE_FAULT_TREE_MODEL_IDS,
  HCL_CASE_FAULT_TREE_TOP_GATE_IDS,
  HCL_CASE_BAYESIAN_IDS,
  SY_ANALYSIS_HCL,
} from "../../../example-workbooks/seeds/hcl-case-study-seed";
import {
  EXAMPLE_DEPENDENCY_IDS,
  reconcileExampleEsqDependencyReferences,
  reconcileExampleEventTreeDependencyReferences,
  reconcileExampleSyDataAnalysisReferences,
  reconcileExampleSyHumanReliabilityReferences,
  reconcileExampleSyDependencyOwnership,
} from "../../../example-workbooks/seeds/dependency-model-seed";
import { SY_ANALYSIS } from "../../../example-workbooks/seeds/sy-seed";
import { SY_ANALYSIS_HTGR } from "../../../example-workbooks/seeds/sy-seed-htgr";
import { ES_ANALYSIS } from "../../../example-workbooks/seeds/es-seed";
import { ES_ANALYSIS_HTGR } from "../../../example-workbooks/seeds/es-seed-htgr";
import { ESQ_ANALYSIS } from "../../../example-workbooks/seeds/esq-seed";
import { ESQ_ANALYSIS_HTGR } from "../../../example-workbooks/seeds/esq-seed-htgr";
import { DA_ANALYSIS } from "../../../example-workbooks/seeds/da-seed";
import { DA_ANALYSIS_HTGR } from "../../../example-workbooks/seeds/da-seed-htgr";
import { HR_ANALYSIS } from "../../../example-workbooks/seeds/hr-seed";
import { HR_ANALYSIS_HTGR } from "../../../example-workbooks/seeds/hr-seed-htgr";
import { createBlankSy } from "../../../sy-workbooks/blank-sy";
import { createBlankDa } from "../../../da-workbooks/blank-da";
import { DaWorkbook, DaWorkbookSchema } from "../../../da-workbooks/da-workbook.schema";
import { HrWorkbook, HrWorkbookSchema } from "../../../hr-workbooks/hr-workbook.schema";
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
const DA_WORKBOOK_ID = "da-workbook-runs";
const DA_PARAMETER_ID = "40000000-0000-4000-8000-000000000001";
const CONTROLLED_SY_WORKBOOK_ID = "controlled-sy-workbook-runs";
const HCL_CASE_SY_WORKBOOK_ID = "hcl-case-sy-workbook-runs";
const HCL_CASE_STALE_SY_WORKBOOK_ID = "hcl-case-stale-sy-workbook-runs";
const HCL_CASE_DA_WORKBOOK_ID = "hcl-case-da-workbook-runs";
const HCL_CASE_HR_WORKBOOK_ID = "hcl-case-hr-workbook-runs";
const HCL_CASE_ES_WORKBOOK_ID = "hcl-case-es-workbook-runs";
const HCL_CASE_ESQ_WORKBOOK_ID = "hcl-case-esq-workbook-runs";
const HCL_CASE_SCENARIO_BASE_ID = "d15c0190-cafe-4a10-8b00-000000000001";
const HCL_CASE_SCENARIO_SEISMIC_ID = "d15c0190-cafe-4a10-8b00-000000000002";
const connectedExampleIds = (variant: "sfr" | "htgr") => ({
  sy: `${variant}-sy-workbook-runs`,
  da: `${variant}-da-workbook-runs`,
  hr: `${variant}-hr-workbook-runs`,
  es: `${variant}-es-workbook-runs`,
  esq: `${variant}-esq-workbook-runs`,
});

const FT_OR = "10000000-0000-4000-8000-000000000001";
const FT_AND = "10000000-0000-4000-8000-000000000002";
const FT_MASKED = "10000000-0000-4000-8000-000000000012";
const TOP_OR = "10000000-0000-4000-8000-000000000003";
const TOP_AND = "10000000-0000-4000-8000-000000000004";
const TOP_MASKED = "10000000-0000-4000-8000-000000000013";
const EVENT_A = "10000000-0000-4000-8000-000000000005";
const EVENT_B = "10000000-0000-4000-8000-000000000006";
const OR_LEAF_A = "10000000-0000-4000-8000-000000000007";
const OR_LEAF_B = "10000000-0000-4000-8000-000000000008";
const AND_LEAF_A = "10000000-0000-4000-8000-000000000009";
const AND_LEAF_B = "10000000-0000-4000-8000-000000000010";
const EVENT_CONSTANT_FALSE = "10000000-0000-4000-8000-000000000014";
const MASKED_LEAF_A = "10000000-0000-4000-8000-000000000015";
const MASKED_LEAF_FALSE = "10000000-0000-4000-8000-000000000016";
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
const SCENARIO_A_TRUE = "20000000-0000-4000-8000-000000000015";
const SCENARIO_A_FALSE = "20000000-0000-4000-8000-000000000016";

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
    {
      uuid: EVENT_CONSTANT_FALSE,
      code: "EVENT-FALSE",
      name: "Constant false event",
      description: "Probability 0",
      eventType: "BASIC",
      probability: 0,
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
    {
      uuid: FT_MASKED,
      code: "FT-MASKED",
      name: "Constant-masked top event",
      systemReference: "SYS-MASKED",
      description: "A and a constant-false event",
      modelRepresentation: "Fault tree",
      topGate: { gateId: TOP_MASKED },
      gates: [{
        id: TOP_MASKED,
        code: "TOP-MASKED",
        name: "Constant-masked top event",
        description: "A and a constant-false event",
        kind: "GATE",
        gateType: "AND",
      }],
      leafNodes: [
        { id: MASKED_LEAF_A, kind: "BASIC_EVENT_REFERENCE", basicEventId: EVENT_A },
        {
          id: MASKED_LEAF_FALSE,
          kind: "BASIC_EVENT_REFERENCE",
          basicEventId: EVENT_CONSTANT_FALSE,
        },
      ],
      gateInputs: [
        {
          id: `${TOP_MASKED}:${MASKED_LEAF_A}:0`,
          gateId: TOP_MASKED,
          childId: MASKED_LEAF_A,
          order: 0,
        },
        {
          id: `${TOP_MASKED}:${MASKED_LEAF_FALSE}:1`,
          gateId: TOP_MASKED,
          childId: MASKED_LEAF_FALSE,
          order: 1,
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
      faultTrees: [
        { workbookId: SY_WORKBOOK_ID, modelId: FT_AND },
        { workbookId: SY_WORKBOOK_ID, modelId: FT_MASKED },
      ],
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
      evidenceScenarios: [
        {
          id: SCENARIO_A_TRUE,
          code: "A-TRUE",
          name: "Cause present",
          enabled: true,
          evidence: { observations: [{ nodeId: NODE_A, stateId: A_TRUE }] },
        },
        {
          id: SCENARIO_A_FALSE,
          code: "A-FALSE",
          name: "Cause absent",
          enabled: true,
          evidence: { observations: [{ nodeId: NODE_A, stateId: A_FALSE }] },
        },
      ],
      hazardGrid: {
        name: "A-state grid",
        hazardNodeIds: [NODE_A],
        annualFrequencyScale: {
          value: 1e-4,
          unit: "PER_YEAR",
          annualization: { basis: "PLANT_YEAR", hoursPerYear: 8_766 },
        },
        normalizeWeights: false,
      },
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
  let syWorkbooks: Model<unknown>;
  let daWorkbooks: Model<unknown>;
  let praetorClient: PraetorAnalysisClient;
  let executionAllowed = true;
  let originalPraetorUrl: string | undefined;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const praetorModule = await Test.createTestingModule({
      controllers: [TestPraetorController],
      providers: [PraxisNativeService],
    }).compile();
    praetor = praetorModule.createNestApplication<NestExpressApplication>();
    (praetor as NestExpressApplication).useBodyParser("json", { limit: "25mb" });
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
          { name: DaWorkbook.name, schema: DaWorkbookSchema },
          { name: HrWorkbook.name, schema: HrWorkbookSchema },
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
    syWorkbooks = moduleRef.get(getModelToken(SyWorkbook.name));
    daWorkbooks = moduleRef.get(getModelToken(DaWorkbook.name));
    praetorClient = moduleRef.get(PraetorAnalysisClient);

    await syWorkbooks.create({
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
    const controlledSy = createSyMef();
    controlledSy.systemBasicEvents[0] = {
      ...controlledSy.systemBasicEvents[0]!,
      probability: 0.99,
      controlledDataSource: {
        referenceType: "WORKBOOK_PARAMETER",
        workbookId: DA_WORKBOOK_ID,
        entityId: DA_PARAMETER_ID,
      },
    };
    const controlledHfe = HR_ANALYSIS_HCL.humanFailureEvents[0]!;
    const controlledHepQuantification = HR_ANALYSIS_HCL.hepQuantifications.find(
      (quantification) => quantification.hfeId === controlledHfe.uuid,
    )!;
    controlledSy.systemBasicEvents[1] = {
      ...controlledSy.systemBasicEvents[1]!,
      failureMode: "HUMAN_ERROR",
      probability: 0.99,
      controlledDataSource: {
        referenceType: "HUMAN_FAILURE_EVENT",
        workbookId: HCL_CASE_HR_WORKBOOK_ID,
        entityId: controlledHfe.uuid,
        quantificationId: controlledHepQuantification.uuid,
      },
    };
    await moduleRef.get<Model<unknown>>(getModelToken(SyWorkbook.name)).create({
      workbookId: CONTROLLED_SY_WORKBOOK_ID,
      projectId: PROJECT_ID,
      ownerUsername: USERNAME,
      revision: 4,
      mef: controlledSy,
    });
    const da = createBlankDa("Controlled probabilities", USERNAME);
    da.parameters = [
      {
        uuid: DA_PARAMETER_ID,
        name: "Event A probability",
        parameterType: "PROBABILITY",
        value: 0.3,
        valueType: "POINT_ESTIMATE",
        implementsSrs: [],
      },
    ];
    await daWorkbooks.create({
      workbookId: DA_WORKBOOK_ID,
      projectId: PROJECT_ID,
      ownerUsername: USERNAME,
      revision: 6,
      mef: da,
    });
    const hclCaseSystems = reconcileExampleSyDependencyOwnership(reconcileExampleSyHumanReliabilityReferences(
      reconcileExampleSyDataAnalysisReferences(
        structuredClone(SY_ANALYSIS_HCL),
        DA_ANALYSIS_HCL,
        HCL_CASE_DA_WORKBOOK_ID,
      ),
      HR_ANALYSIS_HCL,
      HCL_CASE_HR_WORKBOOK_ID,
    ), HCL_CASE_SY_WORKBOOK_ID);
    const hclCaseNetwork = hclCaseSystems.dependencyBayesianNetworks?.find(
      ({ modelId }) => modelId === HCL_CASE_BAYESIAN_IDS.model,
    )!;
    const seismicNode = hclCaseNetwork.nodes.find(({ id }) => id === HCL_CASE_BAYESIAN_IDS.seismic)!;
    hclCaseSystems.dependencyHclConfigurations![0]!.evidenceScenarios = [
      {
        id: HCL_CASE_SCENARIO_BASE_ID,
        code: "SCN-SEISMIC-0",
        name: "Baseline seismic evidence regression scenario",
        enabled: true,
        evidence: { observations: [{ nodeId: seismicNode.id, stateId: seismicNode.states[0]!.id }] },
      },
      {
        id: HCL_CASE_SCENARIO_SEISMIC_ID,
        code: "SCN-SEISMIC-1",
        name: "Alternate seismic evidence regression scenario",
        enabled: true,
        evidence: { observations: [{ nodeId: seismicNode.id, stateId: seismicNode.states[1]!.id }] },
      },
    ];
    await moduleRef.get<Model<unknown>>(getModelToken(DaWorkbook.name)).create({
      workbookId: HCL_CASE_DA_WORKBOOK_ID,
      projectId: PROJECT_ID,
      ownerUsername: USERNAME,
      revision: 2,
      mef: structuredClone(DA_ANALYSIS_HCL),
    });
    await moduleRef.get<Model<unknown>>(getModelToken(HrWorkbook.name)).create({
      workbookId: HCL_CASE_HR_WORKBOOK_ID,
      projectId: PROJECT_ID,
      ownerUsername: USERNAME,
      revision: 3,
      mef: structuredClone(HR_ANALYSIS_HCL),
    });
    await moduleRef.get<Model<unknown>>(getModelToken(SyWorkbook.name)).create({
      workbookId: HCL_CASE_SY_WORKBOOK_ID,
      projectId: PROJECT_ID,
      ownerUsername: USERNAME,
      revision: 1,
      mef: hclCaseSystems,
    });
    await moduleRef.get<Model<unknown>>(getModelToken(EsWorkbook.name)).create({
      workbookId: HCL_CASE_ES_WORKBOOK_ID,
      projectId: PROJECT_ID,
      ownerUsername: USERNAME,
      revision: 1,
      mef: reconcileExampleEventTreeDependencyReferences(
        structuredClone(ES_ANALYSIS_HCL),
        hclCaseSystems,
        HCL_CASE_SY_WORKBOOK_ID,
      ),
    });
    await moduleRef.get<Model<unknown>>(getModelToken(EsqWorkbook.name)).create({
      workbookId: HCL_CASE_ESQ_WORKBOOK_ID,
      projectId: PROJECT_ID,
      ownerUsername: USERNAME,
      revision: 1,
      mef: reconcileExampleEsqDependencyReferences(
        structuredClone(ESQ_ANALYSIS_HCL),
        HCL_CASE_ESQ_WORKBOOK_ID,
        hclCaseSystems,
        HCL_CASE_SY_WORKBOOK_ID,
      ),
    });

    for (const variant of [
      {
        id: "sfr" as const,
        sy: SY_ANALYSIS,
        da: DA_ANALYSIS,
        hr: HR_ANALYSIS,
        es: ES_ANALYSIS,
        esq: ESQ_ANALYSIS,
      },
      {
        id: "htgr" as const,
        sy: SY_ANALYSIS_HTGR,
        da: DA_ANALYSIS_HTGR,
        hr: HR_ANALYSIS_HTGR,
        es: ES_ANALYSIS_HTGR,
        esq: ESQ_ANALYSIS_HTGR,
      },
    ]) {
      const ids = connectedExampleIds(variant.id);
      const systems = reconcileExampleSyHumanReliabilityReferences(
        reconcileExampleSyDataAnalysisReferences(structuredClone(variant.sy), variant.da, ids.da),
        variant.hr,
        ids.hr,
      );
      await moduleRef.get<Model<unknown>>(getModelToken(DaWorkbook.name)).create({
        workbookId: ids.da,
        projectId: PROJECT_ID,
        ownerUsername: USERNAME,
        revision: 1,
        mef: structuredClone(variant.da),
      });
      await moduleRef.get<Model<unknown>>(getModelToken(HrWorkbook.name)).create({
        workbookId: ids.hr,
        projectId: PROJECT_ID,
        ownerUsername: USERNAME,
        revision: 1,
        mef: structuredClone(variant.hr),
      });
      await moduleRef.get<Model<unknown>>(getModelToken(SyWorkbook.name)).create({
        workbookId: ids.sy,
        projectId: PROJECT_ID,
        ownerUsername: USERNAME,
        revision: 1,
        mef: systems,
      });
      await moduleRef.get<Model<unknown>>(getModelToken(EsWorkbook.name)).create({
        workbookId: ids.es,
        projectId: PROJECT_ID,
        ownerUsername: USERNAME,
        revision: 1,
        mef: reconcileExampleEventTreeDependencyReferences(structuredClone(variant.es), systems, ids.sy),
      });
      await moduleRef.get<Model<unknown>>(getModelToken(EsqWorkbook.name)).create({
        workbookId: ids.esq,
        projectId: PROJECT_ID,
        ownerUsername: USERNAME,
        revision: 1,
        mef: reconcileExampleEsqDependencyReferences(structuredClone(variant.esq), ids.esq, systems, ids.sy),
      });
    }
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
    expect(result.body.leadingCutSets.map((set: { probability: number }) => set.probability)).toEqual([0.2, 0.1]);
    expect(result.body.leadingCutSets.map((set: { contribution: number }) => set.contribution)).toEqual([
      expect.closeTo(0.2 / 0.28, 12),
      expect.closeTo(0.1 / 0.28, 12),
    ]);
    expect(result.body.basicEventQuantifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ basicEventId: EVENT_A, resolvedProbability: 0.1 }),
      expect.objectContaining({ basicEventId: EVENT_B, resolvedProbability: 0.2 }),
    ]));
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

  it("resolves controlled DA and HRA probabilities from their immutable workbook revisions", async () => {
    const response = await request(api.getHttpServer())
      .post(`/api/sy-workbooks/${CONTROLLED_SY_WORKBOOK_ID}/fault-trees/${FT_OR}/runs`)
      .send({ schemaVersion: "1.0.0", modelId: FT_OR, workbookRevision: 4 });
    expect(response.status).toBe(200);
    expect(response.body.run.sourceWorkbooks).toEqual([
      { workbookId: CONTROLLED_SY_WORKBOOK_ID, workbookRevision: 4 },
      { workbookId: DA_WORKBOOK_ID, workbookRevision: 6 },
      { workbookId: HCL_CASE_HR_WORKBOOK_ID, workbookRevision: 3 },
    ]);

    const result = await request(api.getHttpServer()).get(
      `/api/sy-workbooks/${CONTROLLED_SY_WORKBOOK_ID}/fault-trees/${FT_OR}/runs/${response.body.run.id}/result`,
    );
    expect(result.status).toBe(200);
    const controlledHfe = HR_ANALYSIS_HCL.humanFailureEvents[0]!;
    const controlledHepQuantification = HR_ANALYSIS_HCL.hepQuantifications.find(
      (quantification) => quantification.hfeId === controlledHfe.uuid,
    )!;
    const controlledHep = controlledHepQuantification.meanHep ?? controlledHepQuantification.pointEstimateHep!;
    expect(result.body.topEventProbability).toBeCloseTo(1 - (1 - 0.3) * (1 - controlledHep), 12);
    const stored = await runs.findOne({ id: response.body.run.id }).lean().exec();
    expect(stored?.workbookSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hostType: "DA",
          identity: { workbookId: DA_WORKBOOK_ID, workbookRevision: 6 },
        }),
        expect.objectContaining({
          hostType: "HRA",
          identity: { workbookId: HCL_CASE_HR_WORKBOOK_ID, workbookRevision: 3 },
        }),
      ]),
    );
  }, 120_000);

  it("resolves a controlled DA failure rate through mission-time semantics", async () => {
    const rateSyWorkbookId = "sy-workbook-rate-semantics";
    const rateDaWorkbookId = "da-workbook-rate-semantics";
    const rateMef = createSyMef();
    rateMef.systemBasicEvents[0] = {
      ...rateMef.systemBasicEvents[0]!,
      probability: 0,
      quantificationBasis: {
        kind: "FAILURE_RATE",
        failureRate: { value: 0, unit: "HOUR" },
        missionTime: { value: 24, unit: "HOUR" },
        conversion: "EXPONENTIAL",
      },
      controlledDataSource: {
        referenceType: "WORKBOOK_PARAMETER",
        workbookId: rateDaWorkbookId,
        entityId: DA_PARAMETER_ID,
      },
    };
    await syWorkbooks.create({
      workbookId: rateSyWorkbookId,
      projectId: PROJECT_ID,
      ownerUsername: USERNAME,
      revision: 1,
      mef: rateMef,
    });
    const rateDa = createBlankDa("Controlled failure rate", USERNAME);
    rateDa.parameters = [{
      uuid: DA_PARAMETER_ID,
      name: "Event A hourly failure rate",
      parameterType: "FREQUENCY",
      value: 2e-5,
      valueType: "POINT_ESTIMATE",
      implementsSrs: [],
    }];
    await daWorkbooks.create({
      workbookId: rateDaWorkbookId,
      projectId: PROJECT_ID,
      ownerUsername: USERNAME,
      revision: 1,
      mef: rateDa,
    });

    const response = await request(api.getHttpServer())
      .post(`/api/sy-workbooks/${rateSyWorkbookId}/fault-trees/${FT_OR}/runs`)
      .send({ schemaVersion: "1.0.0", modelId: FT_OR, workbookRevision: 1 });
    expect(response.status).toBe(200);
    const result = await request(api.getHttpServer()).get(
      `/api/sy-workbooks/${rateSyWorkbookId}/fault-trees/${FT_OR}/runs/${response.body.run.id}/result`,
    );
    const missionProbability = 4.798848184297884e-4;
    expect(result.status).toBe(200);
    expect(result.body.topEventProbability).toBeCloseTo(1 - (1 - missionProbability) * 0.8, 12);
    expect(result.body.basicEventQuantifications).toEqual(expect.arrayContaining([
      expect.objectContaining({
        basicEventId: EVENT_A,
        resolvedProbability: expect.closeTo(missionProbability, 15),
        input: expect.objectContaining({
          quantificationBasis: expect.objectContaining({
            kind: "FAILURE_RATE",
            failureRate: { value: 2e-5, unit: "HOUR" },
            missionTime: { value: 24, unit: "HOUR" },
          }),
        }),
      }),
    ]));
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

    const provenance = await request(api.getHttpServer()).get(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/analysis-runs`);
    expect(provenance.status).toBe(200);
    expect(provenance.body.runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          run: expect.objectContaining({ id: response.body.run.id }),
          target: {
            targetType: "BAYESIAN_NETWORK_QUERY",
            model: { workbookId: ESQ_WORKBOOK_ID, modelId: BN, workbookRevision: 7 },
            queryNodeIds: [NODE_A],
            evidenceNodeIds: [NODE_B],
          },
          contributions: [
            {
              hostType: "ESQ",
              workbook: { workbookId: ESQ_WORKBOOK_ID, workbookRevision: 7 },
              models: [{ workbookId: ESQ_WORKBOOK_ID, modelId: BN }],
              entities: expect.arrayContaining([
                {
                  referenceType: "BAYESIAN_NETWORK_NODE",
                  workbookId: ESQ_WORKBOOK_ID,
                  modelId: BN,
                  entityId: NODE_A,
                },
                {
                  referenceType: "BAYESIAN_NETWORK_NODE",
                  workbookId: ESQ_WORKBOOK_ID,
                  modelId: BN,
                  entityId: NODE_B,
                },
              ]),
            },
          ],
        }),
      ]),
    );
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
    expect(result.body.frequencySemantics).toEqual({
      initiatingEventFrequency: { value: 0.01, unit: "PER_YEAR" },
      annualization: { basis: "PLANT_YEAR", hoursPerYear: 8_766 },
      annualizedInitiatingEventFrequency: { value: 0.01, unit: "PER_YEAR" },
    });
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
    expect(faultTreeResult.body.cutSets).toMatchObject({
      totalCount: 1,
      cutSets: [expect.objectContaining({
        rank: 1,
        order: 2,
        probability: expect.closeTo(0.16, 12),
        coverage: expect.closeTo(1, 12),
      })],
    });
    expect(faultTreeResult.body.importance).toMatchObject({
      totalCount: 2,
      measures: expect.arrayContaining([
        expect.objectContaining({
          basicEventId: EVENT_A,
          bayesianNetworkNodeId: NODE_A,
          probabilityIfTrue: expect.closeTo(0.25, 12),
          probabilityIfFalse: 0,
          birnbaum: expect.closeTo(0.25, 12),
          fussellVesely: 1,
        }),
      ]),
    });
    expect(faultTreeResult.body.basicEventQuantifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ basicEventId: EVENT_A, resolvedProbability: 0.1 }),
      expect.objectContaining({ basicEventId: EVENT_B, resolvedProbability: 0.2 }),
    ]));

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
    expect(eventTreeResult.body.sequences.find(
      (sequence: { sequenceId: string }) => sequence.sequenceId === HCL_FF,
    )?.cutSets).toMatchObject({
      totalCount: 1,
      cutSets: [expect.objectContaining({ probability: expect.closeTo(0.16, 12) })],
    });
    expect(eventTreeResult.body.sequences.find(
      (sequence: { sequenceId: string }) => sequence.sequenceId === HCL_FF,
    )?.importance).toMatchObject({
      totalCount: 2,
      measures: expect.arrayContaining([
        expect.objectContaining({ basicEventId: EVENT_A, birnbaum: expect.closeTo(0.25, 12) }),
      ]),
    });
  }, 120_000);

  it("runs HCL fault-tree and event-tree targets for a saved evidence-scenario set", async () => {
    const executeSpy = jest.spyOn(praetorClient, "execute");
    const faultTreeBatch = await request(api.getHttpServer())
      .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/fault-tree-batch-runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: HCL,
        workbookRevision: 7,
        faultTreeTopGate: topReference(FT_AND, TOP_AND),
        evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE],
      });
    expect(faultTreeBatch.status).toBe(200);
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy.mock.calls[0]?.[0]).toMatchObject({
      request: {
        methodType: "HYBRID_CAUSAL_LOGIC",
        evidenceBatch: [
          { scenarioId: SCENARIO_A_TRUE },
          { scenarioId: SCENARIO_A_FALSE },
        ],
      },
    });
    expect(faultTreeBatch.body.runs).toEqual([
      expect.objectContaining({ scenarioId: SCENARIO_A_TRUE, scenarioCode: "A-TRUE" }),
      expect.objectContaining({ scenarioId: SCENARIO_A_FALSE, scenarioCode: "A-FALSE" }),
    ]);
    const faultTreeProbabilities: number[] = [];
    for (const scenario of faultTreeBatch.body.runs as Array<{ run: { id: string; status: string } }>) {
      expect(scenario.run.status).toBe("SUCCEEDED");
      const result = await request(api.getHttpServer()).get(
        `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/runs/${scenario.run.id}/result`,
      );
      expect(result.status).toBe(200);
      faultTreeProbabilities.push(result.body.probability);
    }
    expect(faultTreeProbabilities).toEqual([expect.closeTo(0.8, 12), expect.closeTo(0, 12)]);
    const storedBatchRun = await runs.findOne({ id: faultTreeBatch.body.runs[0].run.id }).lean().exec();
    expect(storedBatchRun?.request).toMatchObject({
      batchContext: {
        evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE],
        varyingEvidenceNodeIds: [NODE_A],
        targetKey: `${SY_WORKBOOK_ID}:${FT_AND}`,
        targetEvidenceNodeIds: [NODE_A],
      },
    });

    executeSpy.mockClear();
    const eventTreeBatch = await request(api.getHttpServer())
      .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/event-tree-batch-runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: HCL,
        workbookRevision: 7,
        eventTree: { workbookId: ES_WORKBOOK_ID, modelId: ET_HCL },
        evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE],
      });
    expect(eventTreeBatch.status).toBe(200);
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy.mock.calls[0]?.[0]).toMatchObject({
      request: {
        methodType: "EVENT_TREE",
        evidenceBatch: [
          { scenarioId: SCENARIO_A_TRUE },
          { scenarioId: SCENARIO_A_FALSE },
        ],
      },
    });
    expect(eventTreeBatch.body.runs).toHaveLength(2);
    for (const scenario of eventTreeBatch.body.runs as Array<{ run: { id: string; status: string } }>) {
      expect(scenario.run.status).toBe("SUCCEEDED");
      const result = await request(api.getHttpServer()).get(
        `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/runs/${scenario.run.id}/result`,
      );
      expect(result.status).toBe(200);
      expect(result.body.sequences.reduce(
        (sum: number, sequence: { conditionalProbability: number }) => sum + sequence.conditionalProbability,
        0,
      )).toBeCloseTo(1, 12);
    }

    executeSpy.mockClear();
    const faultTreeConvolution = await request(api.getHttpServer())
      .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/fault-tree-batch-runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: HCL,
        workbookRevision: 7,
        faultTreeTopGate: topReference(FT_AND, TOP_AND),
        evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE],
        integrateHazardGrid: true,
      });
    expect(faultTreeConvolution.status).toBe(200);
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy.mock.calls[0]?.[0]).toMatchObject({
      request: {
        hazardConvolution: {
          gridName: "A-state grid",
          hazardNodeIds: [NODE_A],
          annualFrequencyScale: { value: 1e-4, unit: "PER_YEAR" },
          normalizeWeights: false,
        },
        evidenceBatch: [
          { scenarioId: SCENARIO_A_TRUE, hazardObservations: [{ nodeId: NODE_A, stateId: A_TRUE }] },
          { scenarioId: SCENARIO_A_FALSE, hazardObservations: [{ nodeId: NODE_A, stateId: A_FALSE }] },
        ],
      },
    });
    expect(faultTreeConvolution.body.hazardConvolution).toMatchObject({
      targetKind: "FAULT_TREE",
      gridName: "A-state grid",
      rawWeightSum: expect.closeTo(1, 12),
      convolutionWeightSum: expect.closeTo(1, 12),
      integratedAnnualFrequency: expect.closeTo(1.6e-5, 12),
      rows: [
        expect.objectContaining({
          scenarioId: SCENARIO_A_TRUE,
          rawWeight: expect.closeTo(0.2, 12),
          conditionalProbability: expect.closeTo(0.8, 12),
          annualContribution: expect.closeTo(1.6e-5, 12),
        }),
        expect.objectContaining({
          scenarioId: SCENARIO_A_FALSE,
          rawWeight: expect.closeTo(0.8, 12),
          conditionalProbability: expect.closeTo(0, 12),
          annualContribution: expect.closeTo(0, 12),
        }),
      ],
    });

    const eventTreeConvolution = await request(api.getHttpServer())
      .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/event-tree-batch-runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: HCL,
        workbookRevision: 7,
        eventTree: { workbookId: ES_WORKBOOK_ID, modelId: ET_HCL },
        evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE],
        integrateHazardGrid: true,
      });
    expect(eventTreeConvolution.status).toBe(200);
    expect(eventTreeConvolution.body.hazardConvolution).toMatchObject({
      targetKind: "EVENT_TREE",
      rawWeightSum: expect.closeTo(1, 12),
      endStateAggregates: expect.arrayContaining([
        { endStateId: SAFE, integratedAnnualFrequency: expect.closeTo(8.4e-5, 12) },
        { endStateId: RELEASE, integratedAnnualFrequency: expect.closeTo(1.6e-5, 12) },
      ]),
    });
  }, 120_000);

  it("rejects batch targets that cannot change across the selected scenarios", async () => {
    const constantMasked = await request(api.getHttpServer())
      .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/fault-tree-batch-runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: HCL,
        workbookRevision: 7,
        faultTreeTopGate: topReference(FT_MASKED, TOP_MASKED),
        evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE],
      });
    expect(constantMasked.status).toBe(400);
    expect(constantMasked.body.message).toMatch(/masked by constant fault-tree logic/i);

    const constantEvidence = await request(api.getHttpServer())
      .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/fault-tree-batch-runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: HCL,
        workbookRevision: 7,
        faultTreeTopGate: topReference(FT_AND, TOP_AND),
        evidenceScenarioIds: [SCENARIO_A_TRUE],
      });
    expect(constantEvidence.status).toBe(400);
    expect(constantEvidence.body.message).toMatch(/not affected by evidence that varies/i);

    const unrelatedEventTree = await request(api.getHttpServer())
      .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/event-tree-batch-runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: HCL,
        workbookRevision: 7,
        eventTree: { workbookId: ES_WORKBOOK_ID, modelId: ET_INDEPENDENT },
        evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE],
      });
    expect(unrelatedEventTree.status).toBe(400);
    expect(unrelatedEventTree.body.message).toMatch(/not affected by evidence that varies/i);
  });

  it.each(["sfr", "htgr"] as const)(
    "executes and traces the connected %s example through its real workbook revisions",
    async (variant) => {
      const ids = connectedExampleIds(variant);
      const execution = await request(api.getHttpServer())
        .post(
          `/api/esq-workbooks/${ids.esq}/hcl-configurations/${EXAMPLE_DEPENDENCY_IDS.hclConfiguration}/event-tree-runs`,
        )
        .send({
          schemaVersion: "1.0.0",
          modelId: EXAMPLE_DEPENDENCY_IDS.hclConfiguration,
          workbookRevision: 1,
          eventTree: {
            workbookId: ids.es,
            modelId: EXAMPLE_DEPENDENCY_IDS.eventTree,
          },
        });
      expect(execution.status).toBe(200);
      expect(execution.body.run.status).toBe("SUCCEEDED");

      const provenance = await request(api.getHttpServer()).get(`/api/esq-workbooks/${ids.esq}/analysis-runs`);
      expect(provenance.status).toBe(200);
      expect(provenance.body.runs).toEqual([
        expect.objectContaining({
          run: expect.objectContaining({ id: execution.body.run.id }),
          target: {
            targetType: "HCL_EVENT_TREE",
            configuration: {
              workbookId: ids.esq,
              workbookRevision: 1,
              modelId: EXAMPLE_DEPENDENCY_IDS.hclConfiguration,
            },
            eventTree: {
              workbookId: ids.es,
              workbookRevision: 1,
              modelId: EXAMPLE_DEPENDENCY_IDS.eventTree,
            },
          },
          contributions: expect.arrayContaining([
            expect.objectContaining({
              hostType: "ESQ",
              workbook: { workbookId: ids.esq, workbookRevision: 1 },
            }),
            expect.objectContaining({
              hostType: "ES",
              workbook: { workbookId: ids.es, workbookRevision: 1 },
            }),
            expect.objectContaining({
              hostType: "SY",
              workbook: { workbookId: ids.sy, workbookRevision: 1 },
            }),
          ]),
        }),
      ]);
    },
    120_000,
  );

  it("executes exact BN inference and fault-tree HCL from the SY-owned dependency configuration", async () => {
    const bn = await request(api.getHttpServer())
      .post(`/api/sy-workbooks/${HCL_CASE_SY_WORKBOOK_ID}/bayesian-networks/${HCL_CASE_BAYESIAN_IDS.model}/runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: HCL_CASE_BAYESIAN_IDS.model,
        workbookRevision: 1,
        query: {
          evidence: { observations: [] },
          queryNodeIds: [HCL_CASE_BAYESIAN_IDS.seismic],
        },
      });
    expect(bn.status).toBe(200);
    expect(bn.body.run.status).toBe("SUCCEEDED");
    const bnResult = await request(api.getHttpServer()).get(
      `/api/sy-workbooks/${HCL_CASE_SY_WORKBOOK_ID}/bayesian-networks/${HCL_CASE_BAYESIAN_IDS.model}/runs/${bn.body.run.id}/result`,
    );
    expect(bnResult.status).toBe(200);

    const hcl = await request(api.getHttpServer())
      .post(`/api/sy-workbooks/${HCL_CASE_SY_WORKBOOK_ID}/hcl-configurations/${HCL_CASE_BAYESIAN_IDS.hclConfiguration}/fault-tree-runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: HCL_CASE_BAYESIAN_IDS.hclConfiguration,
        workbookRevision: 1,
        faultTreeTopGate: {
          referenceType: "FAULT_TREE_TOP_EVENT",
          workbookId: HCL_CASE_SY_WORKBOOK_ID,
          modelId: HCL_CASE_FAULT_TREE_MODEL_IDS.FEED_BLEED,
          entityId: HCL_CASE_FAULT_TREE_TOP_GATE_IDS.FEED_BLEED,
        },
      });
    expect(hcl.status).toBe(200);
    expect(hcl.body.run.status).toBe("SUCCEEDED");
  });

  it("recovers stale DA and HRA workbook references by entity identity within the project", async () => {
    const staleSystems = reconcileExampleSyDependencyOwnership(
      structuredClone(SY_ANALYSIS_HCL),
      HCL_CASE_STALE_SY_WORKBOOK_ID,
    );
    await syWorkbooks.create({
      workbookId: HCL_CASE_STALE_SY_WORKBOOK_ID,
      projectId: PROJECT_ID,
      ownerUsername: USERNAME,
      revision: 1,
      mef: staleSystems,
    });

    const response = await request(api.getHttpServer())
      .post(`/api/sy-workbooks/${HCL_CASE_STALE_SY_WORKBOOK_ID}/hcl-configurations/${HCL_CASE_BAYESIAN_IDS.hclConfiguration}/fault-tree-runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: HCL_CASE_BAYESIAN_IDS.hclConfiguration,
        workbookRevision: 1,
        faultTreeTopGate: {
          referenceType: "FAULT_TREE_TOP_EVENT",
          workbookId: HCL_CASE_STALE_SY_WORKBOOK_ID,
          modelId: HCL_CASE_FAULT_TREE_MODEL_IDS.FEED_BLEED,
          entityId: HCL_CASE_FAULT_TREE_TOP_GATE_IDS.FEED_BLEED,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.run.status).toBe("SUCCEEDED");
    expect(response.body.run.sourceWorkbooks).toEqual(expect.arrayContaining([
      { workbookId: HCL_CASE_DA_WORKBOOK_ID, workbookRevision: 2 },
      { workbookId: HCL_CASE_HR_WORKBOOK_ID, workbookRevision: 3 },
    ]));
  });

  it("executes the dissertation HCL case-study FT and all three event trees", async () => {
    const configurationId = HCL_CASE_BAYESIAN_IDS.hclConfiguration;
    const runIds: string[] = [];
    const faultTree = await request(api.getHttpServer())
      .post(`/api/esq-workbooks/${HCL_CASE_ESQ_WORKBOOK_ID}/hcl-configurations/${configurationId}/fault-tree-runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: configurationId,
        workbookRevision: 1,
        faultTreeTopGate: {
          referenceType: "FAULT_TREE_TOP_EVENT",
          workbookId: HCL_CASE_SY_WORKBOOK_ID,
          modelId: HCL_CASE_FAULT_TREE_MODEL_IDS.FEED_BLEED,
          entityId: HCL_CASE_FAULT_TREE_TOP_GATE_IDS.FEED_BLEED,
        },
      });
    expect(faultTree.status).toBe(200);
    runIds.push(faultTree.body.run.id);
    const faultTreeResult = await request(api.getHttpServer()).get(
      `/api/esq-workbooks/${HCL_CASE_ESQ_WORKBOOK_ID}/hcl-configurations/${configurationId}/runs/${faultTree.body.run.id}/result`,
    );
    expect(faultTreeResult.status).toBe(200);
    expect(faultTreeResult.body.probability).toBeGreaterThanOrEqual(0);
    expect(faultTreeResult.body.probability).toBeLessThanOrEqual(1);
    expect(faultTree.body.run.sourceWorkbooks).toContainEqual({
      workbookId: HCL_CASE_DA_WORKBOOK_ID,
      workbookRevision: 2,
    });
    expect(faultTree.body.run.sourceWorkbooks).toContainEqual({
      workbookId: HCL_CASE_HR_WORKBOOK_ID,
      workbookRevision: 3,
    });

    for (const [treeKey, sequenceCount] of [
      ["LOOP", 20],
      ["SBO", 12],
      ["FLEX", 13],
    ] as const) {
      const eventTree = await request(api.getHttpServer())
        .post(`/api/esq-workbooks/${HCL_CASE_ESQ_WORKBOOK_ID}/hcl-configurations/${configurationId}/event-tree-runs`)
        .send({
          schemaVersion: "1.0.0",
          modelId: configurationId,
          workbookRevision: 1,
          dependencyConfiguration: {
            workbookId: HCL_CASE_SY_WORKBOOK_ID,
            modelId: configurationId,
          },
          eventTree: {
            workbookId: HCL_CASE_ES_WORKBOOK_ID,
            modelId: HCL_CASE_EVENT_TREE_IDS[treeKey],
          },
        });
      expect(eventTree.status).toBe(200);
      runIds.push(eventTree.body.run.id);
      const eventTreeResult = await request(api.getHttpServer()).get(
        `/api/esq-workbooks/${HCL_CASE_ESQ_WORKBOOK_ID}/hcl-configurations/${configurationId}/runs/${eventTree.body.run.id}/result`,
      );
      const storedEventTreeRun = await runs.findOne({ id: eventTree.body.run.id }).lean().exec();
      expect({
        treeKey,
        status: eventTreeResult.status,
        body: eventTreeResult.body,
        failure: storedEventTreeRun?.failure,
      }).toEqual({
        treeKey,
        status: 200,
        body: expect.objectContaining({ sequences: expect.any(Array) }),
        failure: null,
      });
      expect(eventTreeResult.body.sequences).toHaveLength(sequenceCount);
      expect(
        eventTreeResult.body.sequences.reduce(
          (sum: number, sequence: { conditionalProbability: number }) => sum + sequence.conditionalProbability,
          0,
        ),
      ).toBeCloseTo(1, 10);
    }

    const eventTreeBatch = await request(api.getHttpServer())
      .post(`/api/esq-workbooks/${HCL_CASE_ESQ_WORKBOOK_ID}/hcl-configurations/${configurationId}/event-tree-batch-runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: configurationId,
        workbookRevision: 1,
        dependencyConfiguration: {
          workbookId: HCL_CASE_SY_WORKBOOK_ID,
          modelId: configurationId,
        },
        eventTree: {
          workbookId: HCL_CASE_ES_WORKBOOK_ID,
          modelId: HCL_CASE_EVENT_TREE_IDS.LOOP,
        },
        evidenceScenarioIds: [HCL_CASE_SCENARIO_BASE_ID, HCL_CASE_SCENARIO_SEISMIC_ID],
        integrateHazardGrid: false,
      });
    expect({ status: eventTreeBatch.status, body: eventTreeBatch.body }).toEqual({
      status: 200,
      body: expect.objectContaining({ runs: expect.any(Array) }),
    });
    expect(eventTreeBatch.body.runs).toHaveLength(2);
    expect(eventTreeBatch.body.runs.every(({ run }: { run: { status: string } }) => run.status === "SUCCEEDED")).toBe(true);
    runIds.push(...eventTreeBatch.body.runs.map(({ run }: { run: { id: string } }) => run.id));

    const provenance = await request(api.getHttpServer()).get(
      `/api/esq-workbooks/${HCL_CASE_ESQ_WORKBOOK_ID}/analysis-runs`,
    );
    expect(provenance.status).toBe(200);
    expect(provenance.body.runs.map((entry: { run: { id: string } }) => entry.run.id).sort()).toEqual(
      [...runIds].sort(),
    );
    const faultTreeProvenance = provenance.body.runs.find(
      (entry: { run: { id: string } }) => entry.run.id === faultTree.body.run.id,
    );
    expect(faultTreeProvenance).toMatchObject({
      target: {
        targetType: "HCL_FAULT_TREE",
        configuration: {
          workbookId: HCL_CASE_ESQ_WORKBOOK_ID,
          workbookRevision: 1,
          modelId: configurationId,
        },
        faultTreeTopEvent: {
          workbookId: HCL_CASE_SY_WORKBOOK_ID,
          workbookRevision: 1,
          modelId: HCL_CASE_FAULT_TREE_MODEL_IDS.FEED_BLEED,
          entityId: HCL_CASE_FAULT_TREE_TOP_GATE_IDS.FEED_BLEED,
        },
      },
    });
    expect(faultTreeProvenance.contributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hostType: "DA",
          workbook: { workbookId: HCL_CASE_DA_WORKBOOK_ID, workbookRevision: 2 },
          entities: expect.arrayContaining([expect.objectContaining({ referenceType: "WORKBOOK_PARAMETER" })]),
        }),
        expect.objectContaining({
          hostType: "HRA",
          workbook: { workbookId: HCL_CASE_HR_WORKBOOK_ID, workbookRevision: 3 },
          entities: expect.arrayContaining([expect.objectContaining({ referenceType: "HUMAN_FAILURE_EVENT" })]),
        }),
        expect.objectContaining({
          hostType: "ESQ",
          models: expect.arrayContaining([
            { workbookId: HCL_CASE_ESQ_WORKBOOK_ID, modelId: configurationId },
            { workbookId: HCL_CASE_ESQ_WORKBOOK_ID, modelId: HCL_CASE_BAYESIAN_IDS.model },
          ]),
          entities: expect.arrayContaining([
            expect.objectContaining({ referenceType: "HCL_BINDING" }),
            expect.objectContaining({ referenceType: "BAYESIAN_NETWORK_NODE" }),
          ]),
        }),
      ]),
    );
    const eventTreeProvenance = provenance.body.runs.find(
      (entry: { target: { targetType: string } }) => entry.target.targetType === "HCL_EVENT_TREE",
    );
    expect(eventTreeProvenance).toMatchObject({
      target: {
        targetType: "HCL_EVENT_TREE",
        configuration: {
          workbookId: HCL_CASE_SY_WORKBOOK_ID,
          workbookRevision: 1,
          modelId: configurationId,
        },
        orchestrator: {
          workbookId: HCL_CASE_ESQ_WORKBOOK_ID,
          workbookRevision: 1,
          modelId: configurationId,
        },
        eventTree: {
          workbookId: HCL_CASE_ES_WORKBOOK_ID,
          workbookRevision: 1,
        },
      },
    });
    expect(eventTreeProvenance.contributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hostType: "ES",
          entities: expect.arrayContaining([expect.objectContaining({ referenceType: "EVENT_TREE_FUNCTIONAL_EVENT" })]),
        }),
        expect.objectContaining({
          hostType: "SY",
          models: expect.arrayContaining([
            { workbookId: HCL_CASE_SY_WORKBOOK_ID, modelId: configurationId },
            { workbookId: HCL_CASE_SY_WORKBOOK_ID, modelId: HCL_CASE_BAYESIAN_IDS.model },
          ]),
          entities: expect.arrayContaining([
            expect.objectContaining({ referenceType: "HCL_BINDING" }),
            expect.objectContaining({ referenceType: "BAYESIAN_NETWORK_NODE" }),
          ]),
        }),
      ]),
    );
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
