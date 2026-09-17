import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WorkbookOracle, assertProbability } from "./hcl-independent-oracle";
import { analysisRequestSignal } from "../analysis-cancellation.interceptor";
import type { Request, Response } from "express";
import type { NativeResponse } from "praxis-node/protocol";
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
  Req,
  Res,
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
  execute(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<NativeResponse> {
    return this.nativeService.run("execute", body, { request: req, response: res });
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
    const hclCaseSystems = reconcileExampleSyDependencyOwnership(
      reconcileExampleSyHumanReliabilityReferences(
        reconcileExampleSyDataAnalysisReferences(
          structuredClone(SY_ANALYSIS_HCL),
          DA_ANALYSIS_HCL,
          HCL_CASE_DA_WORKBOOK_ID,
        ),
        HR_ANALYSIS_HCL,
        HCL_CASE_HR_WORKBOOK_ID,
      ),
      HCL_CASE_SY_WORKBOOK_ID,
    );
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

  it("rejects legacy FT rates before creating ordinary or HCL FT/ET runs", async () => {
    const executeSpy = jest.spyOn(praetorClient, "execute");
    const original = createSyMef();
    const legacy = structuredClone(original);
    legacy.systemBasicEvents[0]!.quantificationBasis = {
      kind: "FAILURE_RATE",
      conversion: "LINEAR",
      failureRate: { value: 0.001, unit: "HOUR" },
      missionTime: { value: 100, unit: "HOUR" },
    };
    const count = await runs.countDocuments();
    await syWorkbooks.updateOne({ workbookId: SY_WORKBOOK_ID }, { $set: { mef: legacy } });
    try {
      for (const [url, body] of [
        [
          `/api/sy-workbooks/${SY_WORKBOOK_ID}/fault-trees/${FT_OR}/runs`,
          { schemaVersion: "1.0.0", modelId: FT_OR, workbookRevision: 3 },
        ],
        [
          `/api/es-workbooks/${ES_WORKBOOK_ID}/event-trees/${ET_INDEPENDENT}/runs`,
          { schemaVersion: "1.0.0", modelId: ET_INDEPENDENT, workbookRevision: 5, mode: "INDEPENDENT" },
        ],
        [
          `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/fault-tree-runs`,
          {
            schemaVersion: "1.0.0",
            modelId: HCL,
            workbookRevision: 7,
            faultTreeTopGate: topReference(FT_AND, TOP_AND),
          },
        ],
        [
          `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/event-tree-runs`,
          {
            schemaVersion: "1.0.0",
            modelId: HCL,
            workbookRevision: 7,
            eventTree: { workbookId: ES_WORKBOOK_ID, modelId: ET_HCL },
          },
        ],
      ] as const) {
        const response = await request(api.getHttpServer()).post(url).send(body);
        expect(response.status).toBe(400);
        expect(JSON.stringify(response.body)).toContain("Review the rate and mission time");
      }
      expect(executeSpy).not.toHaveBeenCalled();
      expect(await runs.countDocuments()).toBe(count);
    } finally {
      await syWorkbooks.updateOne({ workbookId: SY_WORKBOOK_ID }, { $set: { mef: original } });
    }
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
    expect(result.body.minimalCutSetCount).toBeUndefined();
    expect(result.body.leadingCutSets).toBeUndefined();
    expect(result.body.basicEventQuantifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ basicEventId: EVENT_A, resolvedProbability: 0.1 }),
        expect.objectContaining({ basicEventId: EVENT_B, resolvedProbability: 0.2 }),
      ]),
    );
    const stored = await runs.findOne({ id: response.body.run.id }).lean().exec();
    expect(stored?.result).toEqual(result.body);

    const legacy = {
      ...result.body,
      minimalCutSetCount: 2,
      leadingCutSets: [
        { rank: 1, order: 1, probability: 0.2, events: [{ basicEventId: EVENT_B, complemented: false }] },
        { rank: 2, order: 1, probability: 0.1, events: [{ basicEventId: EVENT_A, complemented: false }] },
      ],
    };
    await runs.updateOne({ id: response.body.run.id }, { $set: { result: legacy } }).exec();
    const restored = await request(api.getHttpServer()).get(
      `/api/sy-workbooks/${SY_WORKBOOK_ID}/fault-trees/${FT_OR}/runs/${response.body.run.id}/result`,
    );
    expect(restored.status).toBe(200);
    expect(restored.body).toEqual(result.body);
    expect((await runs.findOne({ id: response.body.run.id }).lean().exec())?.result).toEqual(legacy);
  }, 120_000);

  it("returns exact NOT probability without cut-set results", async () => {
    const workbookId = "sy-workbook-not-probability";
    const mef = createSyMef();
    const tree = mef.systemLogicModels[0]!;
    tree.gates![0] = { ...tree.gates![0]!, gateType: "NOT" };
    tree.gateInputs = tree.gateInputs!.slice(0, 1);
    tree.leafNodes = tree.leafNodes!.slice(0, 1);
    await syWorkbooks.create({
      workbookId,
      projectId: PROJECT_ID,
      ownerUsername: USERNAME,
      revision: 1,
      mef,
    });
    const response = await request(api.getHttpServer())
      .post(`/api/sy-workbooks/${workbookId}/fault-trees/${FT_OR}/runs`)
      .send({ schemaVersion: "1.0.0", modelId: FT_OR, workbookRevision: 1 });
    expect(response.status).toBe(200);
    expect(response.body.run.status).toBe("SUCCEEDED");
    const result = await request(api.getHttpServer()).get(
      `/api/sy-workbooks/${workbookId}/fault-trees/${FT_OR}/runs/${response.body.run.id}/result`,
    );
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      topEventProbability: expect.closeTo(0.9, 12),
      validationIssues: [],
    });
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
    rateDa.parameters = [
      {
        uuid: DA_PARAMETER_ID,
        name: "Event A hourly failure rate",
        parameterType: "FREQUENCY",
        value: 2e-5,
        valueType: "POINT_ESTIMATE",
        implementsSrs: [],
      },
    ];
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
    expect(result.body.basicEventQuantifications).toEqual(
      expect.arrayContaining([
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
      ]),
    );
  }, 120_000);

  it("validates stored module wiring before BN or HCL execution and preserves ordinary BN results", async () => {
    const workbooks = api.get<Model<unknown>>(getModelToken(EsqWorkbook.name));
    const original = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
      mef: ReturnType<typeof createEsqMef>;
    };
    const mef = structuredClone(original.mef);
    const network = mef.bayesianNetworks[0]!;
    const [a, b] = network.nodes;
    const id = (n: number) => `81000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    const identity = { code: "PUMP", name: "Pump module", description: "Stored module fixture" };
    const childTable = network.conditionalProbabilityTables.find((table) => table.nodeId === b!.id)!;
    network.moduleTemplates = [
      {
        ...identity,
        id: id(1),
        nodes: [{ ...b!, id: id(2) }],
        inputPorts: [{ ...identity, id: id(3), node: { ...a!, id: id(4) } }],
        outputPorts: [{ ...identity, id: id(5), nodeId: id(2) }],
        edges: [{ id: id(6), parentNodeId: id(4), childNodeId: id(2) }],
        nodePositions: [],
        conditionalProbabilityTables: [
          {
            ...childTable,
            nodeId: id(2),
            parents: [{ nodeId: id(4), order: 0 }],
            rows: childTable.rows.map((row, index) => ({
              ...row,
              id: id(10 + index),
              parentStates: row.parentStates.map((selection) => ({ ...selection, parentNodeId: id(4) })),
            })),
          },
        ],
      },
    ];
    network.moduleInstances = [
      {
        ...identity,
        id: id(7),
        templateId: id(1),
        inputBindings: [{ portId: id(3), nodeId: a!.id }],
        nodeMappings: [
          {
            templateNodeId: id(2),
            nodeId: b!.id,
            stateMappings: b!.states.map((state) => ({ templateStateId: state.id, stateId: state.id })),
          },
        ],
        outputBindings: [{ portId: id(5), nodeId: b!.id }],
      },
    ];
    const endpoint = `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/bayesian-networks/${BN}/runs`;
    const body = {
      schemaVersion: "1.0.0",
      modelId: BN,
      workbookRevision: 7,
      query: { queryNodeIds: [NODE_A, NODE_B], evidence: { observations: [] } },
    };
    try {
      const baseline = await request(api.getHttpServer()).post(endpoint).send(body);
      const baselineResult = await request(api.getHttpServer()).get(`${endpoint}/${baseline.body.run.id}/result`);
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef } }).exec();
      const valid = await request(api.getHttpServer()).post(endpoint).send(body);
      expect(valid.status).toBe(200);
      expect(valid.body.run.status).toBe("SUCCEEDED");
      const result = await request(api.getHttpServer()).get(`${endpoint}/${valid.body.run.id}/result`);
      expect(result.body.marginals).toEqual(baselineResult.body.marginals);
      const persisted = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
        mef: ReturnType<typeof createEsqMef>;
      };
      expect(persisted.mef.bayesianNetworks[0]!.moduleInstances).toEqual(network.moduleInstances);
      // Source permits parent-axis permutations; visual metadata must not affect execution.
      const reorderedMef = structuredClone(mef);
      const graph = reorderedMef.bayesianNetworks[0]!;
      const extra = {
        ...a!,
        id: id(30),
        code: "EXTRA",
        states: a!.states.map((state, index) => ({ ...state, id: id(31 + index) })) as NonNullable<typeof a>["states"],
      };
      graph.nodes.push(extra);
      graph.conditionalProbabilityTables.push({
        nodeId: extra.id,
        parents: [],
        rows: [
          {
            id: id(33),
            parentStates: [],
            values: [
              { stateId: extra.states[0].id, probability: 0.3 },
              { stateId: extra.states[1]!.id, probability: 0.7 },
            ],
          },
        ],
      });
      graph.edges.push({ id: id(34), parentNodeId: extra.id, childNodeId: b!.id });
      const changedTable = graph.conditionalProbabilityTables.find((table) => table.nodeId === b!.id)!;
      changedTable.parents.push({ nodeId: extra.id, order: 1 });
      changedTable.rows = changedTable.rows.flatMap((row, rowIndex) =>
        extra.states.map((state, stateIndex) => ({
          ...row,
          id: id(50 + rowIndex * 2 + stateIndex),
          parentStates: [...row.parentStates, { parentNodeId: extra.id, stateId: state.id }],
          values: row.values.map((value) => ({
            ...value,
            probability: stateIndex === 0 ? value.probability : 1 - value.probability,
          })) as typeof row.values,
        })),
      );
      const savedTemplate = graph.moduleTemplates![0]!;
      savedTemplate.inputPorts.push({ ...identity, id: id(35), node: { ...extra, id: id(36) } });
      savedTemplate.edges.push({ id: id(37), parentNodeId: id(36), childNodeId: id(2) });
      savedTemplate.conditionalProbabilityTables = [
        {
          ...changedTable,
          nodeId: id(2),
          parents: [
            { nodeId: id(4), order: 0 },
            { nodeId: id(36), order: 1 },
          ],
          rows: changedTable.rows.map((row) => ({
            ...row,
            parentStates: row.parentStates.map((selection) => ({
              ...selection,
              parentNodeId: selection.parentNodeId === a!.id ? id(4) : id(36),
            })),
          })),
        },
      ];
      graph.moduleInstances![0]!.inputBindings.push({ portId: id(35), nodeId: extra.id });
      const variants = [];
      for (const permute of [false, true]) {
        if (permute) {
          changedTable.parents = [...changedTable.parents].reverse().map((parent, order) => ({ ...parent, order }));
          changedTable.rows.reverse();
          graph.xdslMetadata = {
            rootAttributes: {},
            nodeIdentifiers: [],
            extensionsXml: `<extensions><genie><submodel id="display"><name>Display only</name><node id="${b!.code}"/></submodel></genie></extensions>`,
          };
        }
        await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: reorderedMef } }).exec();
        const executed = await request(api.getHttpServer()).post(endpoint).send(body);
        expect(executed.status).toBe(200);
        expect(executed.body.run.status).toBe("SUCCEEDED");
        const output = await request(api.getHttpServer()).get(`${endpoint}/${executed.body.run.id}/result`);
        variants.push(output.body.marginals);
      }
      expect(variants[1].map((node: { nodeId: string }) => node.nodeId)).toEqual(
        variants[0].map((node: { nodeId: string }) => node.nodeId),
      );
      variants[1].forEach((node: { values: Array<{ stateId: string; probability: number }> }, nodeIndex: number) => {
        node.values.forEach((value, stateIndex) => {
          expect(value.stateId).toBe(variants[0][nodeIndex].values[stateIndex].stateId);
          expect(value.probability).toBeCloseTo(variants[0][nodeIndex].values[stateIndex].probability, 12);
        });
      });
      for (const kind of ["declared input", "CPT", "edge", "template probability"]) {
        const invalid = structuredClone(mef);
        const bn = invalid.bayesianNetworks[0]!;
        if (kind === "declared input") bn.moduleInstances![0]!.inputBindings[0]!.nodeId = NODE_B;
        if (kind === "CPT") bn.conditionalProbabilityTables[1]!.parents[0]!.nodeId = NODE_B;
        if (kind === "edge") bn.edges[0]!.parentNodeId = NODE_B;
        if (kind === "template probability")
          bn.moduleTemplates![0]!.conditionalProbabilityTables[0]!.rows[0]!.values[0].probability = 0.5;
        await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: invalid } }).exec();
        const before = await runs.countDocuments();
        const rejected = await request(api.getHttpServer()).post(endpoint).send(body);
        expect(rejected.status).toBe(400);
        expect(rejected.body.message).toMatch(/Module/);
        const hcl = await request(api.getHttpServer())
          .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/fault-tree-runs`)
          .send({
            schemaVersion: "1.0.0",
            modelId: HCL,
            workbookRevision: 7,
            faultTreeTopGate: topReference(FT_AND, TOP_AND),
          });
        expect(hcl.status).toBe(400);
        expect(hcl.body.message).toMatch(/Module/);
        expect(await runs.countDocuments()).toBe(before);
      }
    } finally {
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: original.mef } }).exec();
    }
  });

  it("executes and persists an imported single-state BN through HTTP and the native addon", async () => {
    const workbooks = api.get<Model<unknown>>(getModelToken(EsqWorkbook.name));
    const original = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
      mef: ReturnType<typeof createEsqMef>;
    };
    const mef = structuredClone(original.mef);
    const network = mef.bayesianNetworks[0]!;
    network.nodes[0]!.states = [network.nodes[0]!.states[0]];
    network.conditionalProbabilityTables[0]!.rows[0]!.values = [{ stateId: A_FALSE, probability: 1 }];
    network.conditionalProbabilityTables[1]!.rows.length = 1;
    const endpoint = `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/bayesian-networks/${BN}/runs`;
    try {
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef } }).exec();
      const response = await request(api.getHttpServer())
        .post(endpoint)
        .send({
          schemaVersion: "1.0.0",
          modelId: BN,
          workbookRevision: 7,
          query: { queryNodeIds: [NODE_A, NODE_B], evidence: { observations: [] } },
        });
      expect(response.status).toBe(200);
      expect(response.body.run.status).toBe("SUCCEEDED");
      const result = await request(api.getHttpServer()).get(`${endpoint}/${response.body.run.id}/result`);
      expect(result.status).toBe(200);
      expect(result.body.marginals[0].values).toEqual([{ stateId: A_FALSE, probability: 1 }]);
      expect(result.body.marginals[1].values[1].probability).toBeCloseTo(0.1125, 12);
      const saved = await runs.findOne({ id: response.body.run.id }).lean().exec();
      expect(saved?.status).toBe("SUCCEEDED");
    } finally {
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: original.mef } }).exec();
    }
  });

  it.each(["ESQ", "SY"] as const)(
    "executes a %s-owned native BN batch with one saved run",
    async (host) => {
      const syNetwork = SY_ANALYSIS_HCL.dependencyBayesianNetworks!.find(
        (network) => network.modelId === HCL_CASE_BAYESIAN_IDS.model,
      )!;
      const syNode = syNetwork.nodes.find((node) => node.id === HCL_CASE_BAYESIAN_IDS.seismic)!;
      const workbookId = host === "SY" ? HCL_CASE_SY_WORKBOOK_ID : ESQ_WORKBOOK_ID;
      const modelId = host === "SY" ? HCL_CASE_BAYESIAN_IDS.model : BN;
      const workbookRevision = host === "SY" ? 1 : 7;
      const nodeId = host === "SY" ? syNode.id : NODE_B;
      const stateId = host === "SY" ? syNode.states[1]!.id : B_TRUE;
      const queryNodeIds = host === "SY" ? [syNode.id] : [NODE_A, NODE_B];
      const scenarios = [[], [{ nodeId, stateId }], [{ nodeId, stateId: EVENT_A }], [{ nodeId, stateId }]].map(
        (observations, index) => ({
          id: `70000000-0000-4000-8000-00000000000${index + 1}`,
          code: `ROW-${index}`,
          name: `Scenario ${index}`,
          evidence: { observations },
        }),
      );
      const endpoint = `/api/${host.toLowerCase()}-workbooks/${workbookId}/bayesian-networks/${modelId}/runs`;
      const body = { schemaVersion: "1.0.0", modelId, workbookRevision, query: { queryNodeIds, scenarios } };
      const before = await runs.countDocuments({ "owner.workbookId": workbookId, methodType: "BAYESIAN_NETWORK" });
      const response = await request(api.getHttpServer()).post(endpoint).send(body);
      expect(response.status).toBe(200);
      expect(response.body.run.status).toBe("SUCCEEDED");
      expect(await runs.countDocuments({ "owner.workbookId": workbookId, methodType: "BAYESIAN_NETWORK" })).toBe(
        before + 1,
      );
      const saved = await runs.findOne({ id: response.body.run.id }).lean().exec();
      expect(saved?.request).toEqual(body);
      expect(saved?.target).toEqual(expect.objectContaining({ queryNodeIds, evidenceNodeIds: [nodeId] }));
      const responseResult = await request(api.getHttpServer()).get(`${endpoint}/${response.body.run.id}/result`);
      expect(responseResult.status).toBe(200);
      const result = responseResult.body;
      expect(result.diagnostics).toEqual({ junctionTreeCompilations: 1, scenarioEvaluations: 4 });
      expect(result.scenarios.map((row: { scenarioId: string }) => row.scenarioId)).toEqual(
        scenarios.map((row) => row.id),
      );
      expect(result.scenarios[2]).toEqual(
        expect.objectContaining({ status: "FAILED", result: null, failure: expect.any(String) }),
      );
      for (const index of [0, 1, 3]) {
        const single = await request(api.getHttpServer())
          .post(endpoint)
          .send({
            schemaVersion: "1.0.0",
            modelId,
            workbookRevision,
            query: { queryNodeIds, evidence: scenarios[index]!.evidence },
          });
        expect(single.body.run.status).toBe("SUCCEEDED");
        const individual = await request(api.getHttpServer()).get(`${endpoint}/${single.body.run.id}/result`);
        expect(individual.status).toBe(200);
        expect(result.scenarios[index].result.marginals).toEqual(individual.body.marginals);
        expect(result.scenarios[index].result.evidence).toEqual(scenarios[index]!.evidence);
        expect(result.scenarios[index].result.runId).toBe(response.body.run.id);
      }
      if (host === "ESQ") expect(result.scenarios[1].result.marginals[0].values[1].probability).toBeCloseTo(0.64, 12);
    },
    120_000,
  );

  it("rejects empty batches and stale revisions before creating a BN run", async () => {
    const endpoint = `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/bayesian-networks/${BN}/runs`;
    const before = await runs.countDocuments({ methodType: "BAYESIAN_NETWORK" });
    const base = {
      schemaVersion: "1.0.0",
      modelId: BN,
      workbookRevision: 7,
      query: { queryNodeIds: [NODE_A], scenarios: [] },
    };
    expect((await request(api.getHttpServer()).post(endpoint).send(base)).status).toBe(400);
    expect(
      (
        await request(api.getHttpServer())
          .post(endpoint)
          .send({
            ...base,
            workbookRevision: 6,
            query: {
              queryNodeIds: [NODE_A],
              scenarios: [{ id: EVENT_A, code: "P", name: "Prior", evidence: { observations: [] } }],
            },
          })
      ).status,
    ).toBe(409);
    expect(await runs.countDocuments({ methodType: "BAYESIAN_NETWORK" })).toBe(before);
  });

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
      annualization: { basis: "PLANT_YEAR", hoursPerYear: 8_760 },
      annualizedInitiatingEventFrequency: { value: 0.01, unit: "PER_YEAR" },
    });
  }, 120_000);

  it("returns complete transfer paths through the backend while preserving shared FT events", async () => {
    const workbookId = "es-linked-transfer-runs";
    const mef = createEsMef();
    const source = mef.eventTrees![0]!;
    const destination = structuredClone(source);
    destination.uuid = ET_HCL;
    destination.functionalEvents.first!.uuid = FE_HCL_A;
    destination.functionalEvents.first!.faultTreeTopEvent = topReference(FT_AND, TOP_AND);
    destination.sequences = {
      success: { ...source.sequences.success!, uuid: HCL_SS, functionalEventStates: { [FE_HCL_A]: "SUCCESS" } },
      failure: { ...source.sequences.failure!, uuid: HCL_FF, functionalEventStates: { [FE_HCL_A]: "FAILURE" } },
    };
    source.sequences.failure!.endState = undefined;
    source.transfers = { [ET_FAILURE]: { targetEventTreeId: ET_HCL } };
    mef.eventTrees = [source, destination];
    await api.get<Model<unknown>>(getModelToken(EsWorkbook.name)).create({
      workbookId,
      projectId: PROJECT_ID,
      ownerUsername: USERNAME,
      revision: 1,
      mef,
    });
    const response = await request(api.getHttpServer())
      .post(`/api/es-workbooks/${workbookId}/event-trees/${ET_INDEPENDENT}/runs`)
      .send({ schemaVersion: "1.0.0", modelId: ET_INDEPENDENT, workbookRevision: 1, mode: "INDEPENDENT" });
    expect(response.status).toBe(200);
    expect(response.body.run.status).toBe("SUCCEEDED");
    const result = await request(api.getHttpServer()).get(
      `/api/es-workbooks/${workbookId}/event-trees/${ET_INDEPENDENT}/runs/${response.body.run.id}/result`,
    );
    expect(result.status).toBe(200);
    expect(result.body.sequences).toHaveLength(3);
    expect(result.body.sequences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sequenceId: ET_SUCCESS, conditionalProbability: expect.closeTo(0.72, 12) }),
        expect.objectContaining({
          sequenceChain: [
            { modelId: ET_INDEPENDENT, entityId: ET_FAILURE },
            { modelId: ET_HCL, entityId: HCL_SS },
          ],
          conditionalProbability: expect.closeTo(0.26, 12),
        }),
        expect.objectContaining({
          sequenceChain: [
            { modelId: ET_INDEPENDENT, entityId: ET_FAILURE },
            { modelId: ET_HCL, entityId: HCL_FF },
          ],
          conditionalProbability: expect.closeTo(0.02, 12),
          annualFrequency: expect.closeTo(0.0002, 12),
        }),
      ]),
    );
  }, 120_000);

  it.each(["success", "failure"] as const)(
    "executes a source tree containing only its %s outcome",
    async (outcome) => {
      const workbookId = `es-single-${outcome}-run`;
      const mef = createEsMef();
      const tree = mef.eventTrees![0]!;
      tree.sequences = { [outcome]: tree.sequences[outcome]! };
      mef.eventTrees = [tree];
      await api.get<Model<unknown>>(getModelToken(EsWorkbook.name)).create({
        workbookId,
        projectId: PROJECT_ID,
        ownerUsername: USERNAME,
        revision: 1,
        mef,
      });
      const response = await request(api.getHttpServer())
        .post(`/api/es-workbooks/${workbookId}/event-trees/${ET_INDEPENDENT}/runs`)
        .send({ schemaVersion: "1.0.0", modelId: ET_INDEPENDENT, workbookRevision: 1, mode: "INDEPENDENT" });
      expect(response.status).toBe(200);
      expect(response.body.run.status).toBe("SUCCEEDED");
      const result = await request(api.getHttpServer()).get(
        `/api/es-workbooks/${workbookId}/event-trees/${ET_INDEPENDENT}/runs/${response.body.run.id}/result`,
      );
      expect(result.status).toBe(200);
      expect(result.body.sequences).toHaveLength(1);
      expect(result.body.sequences[0].conditionalProbability).toBeCloseTo(outcome === "success" ? 0.72 : 0.28, 12);
      expect(result.body.sequences[0].annualFrequency).toBeCloseTo(outcome === "success" ? 0.0072 : 0.0028, 12);
    },
    120_000,
  );

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
    expect(faultTreeResult.body.cutSets).toBeUndefined();
    expect(faultTreeResult.body.importance).toBeUndefined();
    expect(faultTreeResult.body.bridge.quantifications).toBe(1);
    expect(faultTreeResult.body.basicEventQuantifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ basicEventId: EVENT_A, resolvedProbability: 0.1 }),
        expect.objectContaining({ basicEventId: EVENT_B, resolvedProbability: 0.2 }),
      ]),
    );

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
    eventTreeResult.body.sequences.forEach((sequence: Record<string, unknown>) => {
      expect(sequence.cutSets).toBeUndefined();
      expect(sequence.importance).toBeUndefined();
    });

    // Saved results from before deferral remain readable; stored records are preserved.
    for (const [runId, current, legacy] of [
      [faultTree.body.run.id, faultTreeResult.body, { ...faultTreeResult.body, cutSets: {}, importance: {} }],
      [
        eventTree.body.run.id,
        eventTreeResult.body,
        {
          ...eventTreeResult.body,
          sequences: eventTreeResult.body.sequences.map((sequence: Record<string, unknown>) => ({
            ...sequence,
            cutSets: {},
            importance: {},
          })),
        },
      ],
    ] as const) {
      await runs.updateOne({ id: runId }, { $set: { result: legacy } }).exec();
      const restored = await request(api.getHttpServer()).get(
        `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/runs/${runId}/result`,
      );
      expect(restored.status).toBe(200);
      expect(restored.body).toEqual(current);
      const stored = await runs.findOne({ id: runId }).lean().exec();
      expect(stored?.result).toEqual(legacy);
    }
  }, 120_000);

  it.each(["fault-tree", "event-tree"])(
    "executes uploaded %s scenarios and preserves exact run evidence",
    async (kind) => {
      const workbooks = api.get<Model<unknown>>(getModelToken(EsqWorkbook.name));
      const original = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
        mef: ReturnType<typeof createEsqMef>;
      };
      const scenarios = original.mef.hclConfigurations[0]!.evidenceScenarios!.map((row, i) => ({
        ...structuredClone(row),
        id: `30000000-0000-4000-8000-00000000000${i + 1}`,
        code: `UPLOAD-${i}`,
        name: `Uploaded ${i}`,
      }));
      const grid = {
        ...structuredClone(original.mef.hclConfigurations[0]!.hazardGrid!),
        annualFrequencyScale: { ...original.mef.hclConfigurations[0]!.hazardGrid!.annualFrequencyScale, value: 3 },
      };
      const spy = jest.spyOn(praetorClient, "execute");
      try {
        for (const integrateHazardGrid of [false, true]) {
          spy.mockClear();
          const body = {
            schemaVersion: "1.0.0",
            modelId: HCL,
            workbookRevision: 7,
            evidenceScenarioIds: scenarios.map((s) => s.id),
            integrateHazardGrid,
            batchInput: { evidenceScenarios: scenarios, hazardGrid: grid },
            ...(kind === "fault-tree" ?
              { faultTreeTopGate: topReference(FT_AND, TOP_AND) }
            : { eventTree: { workbookId: ES_WORKBOOK_ID, modelId: ET_HCL } }),
          };
          const response = await request(api.getHttpServer())
            .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/${kind}-batch-runs`)
            .send(body);
          expect(response.status).toBe(200);
          expect(spy).toHaveBeenCalledTimes(1);
          expect(spy.mock.calls[0]![0]).toMatchObject({
            request: {
              evidenceBatch: scenarios.map((row) => ({ scenarioId: row.id, observations: row.evidence.observations })),
            },
          });
          for (const [i, row] of response.body.runs.entries()) {
            expect(row.run.status).toBe("SUCCEEDED");
            const stored = await runs.findOne({ id: row.run.id }).lean().exec();
            expect(stored?.request["evidenceScenario"]).toEqual(scenarios[i]);
            expect(stored?.request["effectiveEvidence"]).toEqual(scenarios[i]!.evidence);
            if (integrateHazardGrid) expect(stored?.request["batchContext"]).toMatchObject({ hazardGrid: grid });
          }
          if (integrateHazardGrid) expect(response.body.hazardConvolution.annualizedFrequencyScale).toBe(3);
        }
        expect(
          ((await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as { mef: unknown }).mef,
        ).toEqual(original.mef);
      } finally {
        spy.mockRestore();
      }
    },
    120_000,
  );

  it.each(["fault-tree", "event-tree"])("retains successful %s scenarios after impossible evidence", async (kind) => {
    const workbooks = api.get<Model<unknown>>(getModelToken(EsqWorkbook.name));
    const original = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
      mef: ReturnType<typeof createEsqMef>;
    };
    const mef = structuredClone(original.mef);
    const table = mef.bayesianNetworks[0]!.conditionalProbabilityTables.find((entry) => entry.nodeId === NODE_A)!;
    table.rows[0]!.values.forEach((value) => { value.probability = value.stateId === A_FALSE ? 1 : 0; });
    const spy = jest.spyOn(praetorClient, "execute");
    try {
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef } }).exec();
      const response = await request(api.getHttpServer())
        .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/${kind}-batch-runs`)
        .send({
          schemaVersion: "1.0.0", modelId: HCL, workbookRevision: 7, calculationType: "PROBABILITY",
          evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE],
          ...(kind === "fault-tree" ? { faultTreeTopGate: topReference(FT_AND, TOP_AND) }
            : { eventTree: { workbookId: ES_WORKBOOK_ID, modelId: ET_HCL } }),
        });
      expect(response.status).toBe(200);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(response.body.runs.map((row: { run: { status: string } }) => row.run.status)).toEqual(["FAILED", "SUCCEEDED"]);
      expect(response.body.compilationReuse).toBeUndefined();
      const failed = response.body.runs[0].run;
      expect(failed.failure).toMatchObject({ kind: "SOLVER_ERROR", code: "PRAXIS_BAYESIAN" });
      for (const { run } of response.body.runs) {
        const details = await request(api.getHttpServer()).get(
          `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/analysis-runs/${run.id}/details`,
        );
        expect(details.status).toBe(200);
        expect(details.body.run.status).toBe(run.status);
        if (run.status === "FAILED") {
          expect(details.body.result).toBeNull();
          expect(details.body.run.failure).toEqual(run.failure);
        } else expect(details.body.result).not.toBeNull();
      }
      const parent = await request(api.getHttpServer()).get(
        `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/analysis-runs/${response.body.batchId}/details`,
      );
      expect(parent.body.run.status).toBe("SUCCEEDED");
      expect(parent.body.result).toEqual(response.body);
      expect(parent.body.members).toHaveLength(2);
    } finally {
      spy.mockRestore();
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: original.mef } }).exec();
    }
  });

  it.each(["fault-tree", "event-tree"].flatMap((kind) => [false, true].flatMap((batch) =>
    ["missing-event", "undeclared-workbook", "unused-catalogue-event"].map((variant) => [kind, batch, variant] as const),
  )))("rejects unresolved %s bindings (batch=%s, %s) before execution", async (kind, batch, variant) => {
    const workbooks = api.get<Model<unknown>>(getModelToken(EsqWorkbook.name));
    const original = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as { mef: ReturnType<typeof createEsqMef> };
    const originalSy = (await syWorkbooks.findOne({ workbookId: SY_WORKBOOK_ID }).lean().exec()) as unknown as { mef: ReturnType<typeof createSyMef> };
    const mef = structuredClone(original.mef), sy = structuredClone(originalSy.mef);
    const binding = mef.hclConfigurations[0]!.bindings[0]!;
    if (variant === "undeclared-workbook") binding.faultTreeBasicEvent.workbookId = "undeclared-sy";
    else binding.faultTreeBasicEvent.entityId = "40000000-0000-4000-8000-000000000099";
    if (variant === "unused-catalogue-event") sy.systemBasicEvents.push({ ...sy.systemBasicEvents[0]!, uuid: binding.faultTreeBasicEvent.entityId, code: "UNUSED-TEST" });
    const before = await runs.countDocuments(), spy = jest.spyOn(praetorClient, "execute");
    try {
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef } }).exec();
      await syWorkbooks.updateOne({ workbookId: SY_WORKBOOK_ID }, { $set: { mef: sy } }).exec();
      const response = await request(api.getHttpServer())
        .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/${kind}${batch ? "-batch" : ""}-runs`)
        .send({ schemaVersion: "1.0.0", modelId: HCL, workbookRevision: 7, calculationType: "PROBABILITY",
          ...(kind === "fault-tree" ? { faultTreeTopGate: topReference(FT_AND, TOP_AND) } : { eventTree: { workbookId: ES_WORKBOOK_ID, modelId: ET_HCL } }),
          ...(batch ? { evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE] } : {}),
        });
      expect(response.status).toBe(400);
      expect(response.body.message).toContain(variant === "undeclared-workbook"
        ? "Binding basic event must belong to a declared fault-tree workbook" : `HCL binding '${binding.id}'`);
      expect(spy).not.toHaveBeenCalled();
      expect(await runs.countDocuments()).toBe(before);
      expect(((await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as { mef: unknown }).mef).toEqual(mef);
    } finally {
      spy.mockRestore();
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: original.mef } }).exec();
      await syWorkbooks.updateOne({ workbookId: SY_WORKBOOK_ID }, { $set: { mef: originalSy.mef } }).exec();
    }
  });

  it("rejects invalid temporary scenario input before creating any runs", async () => {
    const scenario = createEsqMef().hclConfigurations[0]!.evidenceScenarios![0]!;
    const body = {
      schemaVersion: "1.0.0",
      modelId: HCL,
      workbookRevision: 7,
      faultTreeTopGate: topReference(FT_AND, TOP_AND),
      evidenceScenarioIds: [scenario.id],
      batchInput: { evidenceScenarios: [scenario] },
    };
    const invalid = [
      { ...body, evidenceScenarioIds: ["30000000-0000-4000-8000-000000000099"] },
      { ...body, batchInput: { evidenceScenarios: [{ ...scenario, enabled: false }] } },
      { ...body, batchInput: { evidenceScenarios: [scenario, scenario] } },
      {
        ...body,
        batchInput: { evidenceScenarios: [scenario, { ...scenario, id: "30000000-0000-4000-8000-000000000098" }] },
      },
      {
        ...body,
        batchInput: {
          evidenceScenarios: [{ ...scenario, evidence: { observations: [{ nodeId: NODE_A, stateId: B_TRUE }] } }],
        },
      },
      {
        ...body,
        batchInput: {
          evidenceScenarios: [
            {
              ...scenario,
              evidence: { observations: [scenario.evidence.observations[0], scenario.evidence.observations[0]] },
            },
          ],
        },
      },
      { ...body, integrateHazardGrid: true }, // Temporary rows do not silently inherit a saved grid.
    ];
    const count = await runs.countDocuments();
    const spy = jest.spyOn(praetorClient, "execute");
    try {
      for (const input of invalid) {
        const response = await request(api.getHttpServer())
          .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/fault-tree-batch-runs`)
          .send(input);
        expect(response.status).toBe(400);
      }
      expect(await runs.countDocuments()).toBe(count);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("generates source combinations through the addon and executes them without saving settings", async () => {
    const body = {
      schemaVersion: "1.0.0",
      modelId: HCL,
      workbookRevision: 7,
      spec: {
        dimensions: [
          {
            id: "Cause",
            bnNode: NODE_A,
            states: [A_FALSE, A_TRUE],
            stateLabels: { [A_FALSE]: "Absent", [A_TRUE]: "Present" },
          },
          { id: "Effect", bnNode: NODE_B, states: [B_FALSE, B_TRUE] },
        ],
        excludedAssignments: [{ Cause: A_FALSE, Effect: B_TRUE }],
        maxScenarios: 2,
      },
    };
    const route = `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}`;
    const count = await runs.countDocuments();
    const response = await request(api.getHttpServer()).post(`${route}/generate-scenarios`).send(body);
    expect(response.status).toBe(200);
    expect(response.body.scenarios.map((s: { code: string }) => s.code)).toEqual(["hz_0001", "hz_0002"]);
    expect(response.body.scenarios.map((s: { evidence: unknown }) => s.evidence)).toEqual([
      {
        observations: [
          { nodeId: NODE_A, stateId: A_FALSE },
          { nodeId: NODE_B, stateId: B_FALSE },
        ],
      },
      {
        observations: [
          { nodeId: NODE_A, stateId: A_TRUE },
          { nodeId: NODE_B, stateId: B_FALSE },
        ],
      },
    ]);
    expect(await runs.countDocuments()).toBe(count);
    const run = await request(api.getHttpServer())
      .post(`${route}/fault-tree-batch-runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: HCL,
        workbookRevision: 7,
        faultTreeTopGate: topReference(FT_AND, TOP_AND),
        evidenceScenarioIds: response.body.scenarios.map((s: { id: string }) => s.id),
        batchInput: { evidenceScenarios: response.body.scenarios },
      });
    expect(run.status).toBe(200);
    expect(run.body.runs.every((row: { run: { status: string } }) => row.run.status === "SUCCEEDED")).toBe(true);
    for (const spec of [
      { dimensions: [{ id: "A", bnNode: NODE_A, states: [B_TRUE] }] },
      { dimensions: [{ id: "A", bnNode: NODE_A, states: [A_TRUE, A_TRUE] }] },
      { ...body.spec, maxScenarios: 0 },
    ]) {
      const invalid = await request(api.getHttpServer())
        .post(`${route}/generate-scenarios`)
        .send({ ...body, spec });
      expect(invalid.status).toBe(400);
    }
    const stale = await request(api.getHttpServer())
      .post(`${route}/generate-scenarios`)
      .send({ ...body, workbookRevision: 6 });
    expect(stale.status).toBe(409);
    executionAllowed = false;
    try {
      const denied = await request(api.getHttpServer()).post(`${route}/generate-scenarios`).send(body);
      expect(denied.status).toBe(403);
    } finally {
      executionAllowed = true;
    }
  }, 120_000);

  it("records common evidence and scenario overrides separately for uploaded rows", async () => {
    const workbooks = api.get<Model<unknown>>(getModelToken(EsqWorkbook.name));
    const original = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
      mef: ReturnType<typeof createEsqMef>;
    };
    const mef = structuredClone(original.mef);
    mef.hclConfigurations[0]!.baseEvidence = {
      observations: [
        { nodeId: NODE_A, stateId: A_FALSE },
        { nodeId: NODE_B, stateId: B_TRUE },
      ],
    };
    const scenarios = structuredClone(mef.hclConfigurations[0]!.evidenceScenarios!);
    try {
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef } }).exec();
      const response = await request(api.getHttpServer())
        .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/fault-tree-batch-runs`)
        .send({
          schemaVersion: "1.0.0",
          modelId: HCL,
          workbookRevision: 7,
          faultTreeTopGate: topReference(FT_AND, TOP_AND),
          evidenceScenarioIds: scenarios.map((s) => s.id),
          batchInput: { evidenceScenarios: scenarios },
        });
      expect(response.status).toBe(200);
      for (const [i, row] of response.body.runs.entries()) {
        expect(row.run.status).toBe("SUCCEEDED");
        const stored = await runs.findOne({ id: row.run.id }).lean().exec();
        expect(stored?.request["evidenceScenario"]).toEqual(scenarios[i]);
        expect(stored?.request["effectiveEvidence"]).toEqual({
          observations: [scenarios[i]!.evidence.observations[0], { nodeId: NODE_B, stateId: B_TRUE }],
        });
      }
    } finally {
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: original.mef } }).exec();
    }
  });

  it.each(["SY", "ESQ"])("generates scenarios for a SY-owned dependency from the %s host", async (host) => {
    const saved = (await syWorkbooks.findOne({ workbookId: HCL_CASE_SY_WORKBOOK_ID }).lean().exec()) as unknown as {
      mef: ReturnType<typeof createSyMef>;
    };
    const configuration = saved.mef.dependencyHclConfigurations![0]!;
    const network = saved.mef.dependencyBayesianNetworks!.find(
      (n) => n.modelId === configuration.bayesianNetwork.modelId,
    )!;
    const node = network.nodes[0]!;
    const workbookId = host === "SY" ? HCL_CASE_SY_WORKBOOK_ID : HCL_CASE_ESQ_WORKBOOK_ID;
    const ownerModel = host === "SY" ? syWorkbooks : api.get<Model<unknown>>(getModelToken(EsqWorkbook.name));
    const owner = (await ownerModel.findOne({ workbookId }).lean().exec()) as unknown as { revision: number };
    const response = await request(api.getHttpServer())
      .post(
        `/api/${host.toLowerCase()}-workbooks/${workbookId}/hcl-configurations/${configuration.modelId}/generate-scenarios`,
      )
      .send({
        schemaVersion: "1.0.0",
        modelId: configuration.modelId,
        workbookRevision: owner.revision,
        ...(host === "SY" ?
          {}
        : { dependencyConfiguration: { workbookId: HCL_CASE_SY_WORKBOOK_ID, modelId: configuration.modelId } }),
        spec: {
          dimensions: [{ id: node.code, bnNode: node.id, states: node.states.map((s) => s.id) }],
          maxScenarios: 1,
        },
      });
    expect(response.status).toBe(200);
    expect(response.body.scenarios).toEqual([
      expect.objectContaining({
        code: "hz_0001",
        evidence: { observations: [{ nodeId: node.id, stateId: node.states[0]!.id }] },
      }),
    ]);
  });

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
        evidenceBatch: [{ scenarioId: SCENARIO_A_TRUE }, { scenarioId: SCENARIO_A_FALSE }],
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
        evidenceBatch: [{ scenarioId: SCENARIO_A_TRUE }, { scenarioId: SCENARIO_A_FALSE }],
      },
    });
    expect(eventTreeBatch.body.runs).toHaveLength(2);
    for (const scenario of eventTreeBatch.body.runs as Array<{ run: { id: string; status: string } }>) {
      expect(scenario.run.status).toBe("SUCCEEDED");
      const result = await request(api.getHttpServer()).get(
        `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/runs/${scenario.run.id}/result`,
      );
      expect(result.status).toBe(200);
      expect(
        result.body.sequences.reduce(
          (sum: number, sequence: { conditionalProbability: number }) => sum + sequence.conditionalProbability,
          0,
        ),
      ).toBeCloseTo(1, 12);
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
        {
          endStateId: SAFE,
          convolvedProbability: expect.closeTo(0.84, 12),
          integratedAnnualFrequency: expect.closeTo(8.4e-5, 12),
        },
        {
          endStateId: RELEASE,
          convolvedProbability: expect.closeTo(0.16, 12),
          integratedAnnualFrequency: expect.closeTo(1.6e-5, 12),
        },
      ]),
    });
  }, 120_000);

  it.each(["fault-tree", "event-tree"])(
    "persists skipped %s hazard scenarios without probability results",
    async (kind) => {
      const workbooks = api.get<Model<unknown>>(getModelToken(EsqWorkbook.name));
      const original = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
        mef: ReturnType<typeof createEsqMef>;
      };
      const mef = structuredClone(original.mef);
      mef.hclConfigurations[0]!.baseEvidence = { observations: [{ nodeId: NODE_A, stateId: A_FALSE }] };
      const body = {
        schemaVersion: "1.0.0",
        modelId: HCL,
        workbookRevision: 7,
        integrateHazardGrid: true,
        ...(kind === "fault-tree" ?
          { faultTreeTopGate: topReference(FT_AND, TOP_AND) }
        : { eventTree: { workbookId: ES_WORKBOOK_ID, modelId: ET_HCL } }),
      };
      try {
        await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef } }).exec();
        const response = await request(api.getHttpServer())
          .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/${kind}-batch-runs`)
          .send({ ...body, evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE] });
        expect(response.status).toBe(200);
        expect(response.body.runs.map(({ run }: { run: { status: string } }) => run.status)).toEqual([
          "SKIPPED",
          "SUCCEEDED",
        ]);
        expect(response.body.hazardConvolution.rows[0]).toMatchObject({ status: "skipped_zero_weight", rawWeight: 0 });
        const skipped = await runs.findOne({ id: response.body.runs[0].run.id }).lean().exec();
        expect(skipped).toMatchObject({ status: "SKIPPED", result: null, failure: null });

        for (const normalize of [false, true]) {
          mef.hclConfigurations[0]!.hazardGrid!.normalizeWeights = normalize;
          await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef } }).exec();
          const zero = await request(api.getHttpServer())
            .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/${kind}-batch-runs`)
            .send({ ...body, evidenceScenarioIds: [SCENARIO_A_TRUE] });
          expect(zero.status).toBe(200);
          expect(zero.body.runs[0].run.status).toBe("SKIPPED");
          expect(zero.body.hazardConvolution).toMatchObject({ rawWeightSum: 0, convolutionWeightSum: 0 });
          if (kind === "fault-tree")
            expect(zero.body.hazardConvolution).toMatchObject({
              convolvedProbability: 0,
              integratedAnnualFrequency: 0,
            });
          else expect(zero.body.hazardConvolution.endStateAggregates).toEqual([]);
        }
      } finally {
        await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: original.mef } }).exec();
      }
    },
  );

  it("checks overlapping BN state subsets, evidence and ET transfers by full-state enumeration", async () => {
    const workbooks = api.get<Model<unknown>>(getModelToken(EsqWorkbook.name));
    const original = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
      mef: ReturnType<typeof createEsqMef>;
    };
    const esq = createEsqMef(),
      es = createEsMef(),
      middle = randomUUID();
    const network = esq.bayesianNetworks[0]!,
      config = esq.hclConfigurations[0]!;
    network.nodes[0]!.states.splice(1, 0, { id: middle, code: "RAIN", name: "Rain" });
    network.conditionalProbabilityTables[0]!.rows[0]!.values = [
      { stateId: A_FALSE, probability: 0.5 },
      { stateId: middle, probability: 0.3 },
      { stateId: A_TRUE, probability: 0.2 },
    ];
    network.conditionalProbabilityTables[1]!.rows = [A_FALSE, middle, A_TRUE].map((stateId, i) => ({
      id: randomUUID(),
      parentStates: [{ parentNodeId: NODE_A, stateId }],
      values: [
        { stateId: B_FALSE, probability: [0.9, 0.2, 0.6][i]! },
        { stateId: B_TRUE, probability: [0.1, 0.8, 0.4][i]! },
      ],
    }));
    config.bindings[0]!.trueStateIds = [middle, A_TRUE];
    config.bindings[1]!.bayesianNetworkNode.entityId = NODE_A;
    config.bindings[1]!.trueStateIds = [A_TRUE];
    config.faultTrees.push({ workbookId: SY_WORKBOOK_ID, modelId: FT_OR });
    config.baseEvidence = { observations: [{ nodeId: NODE_B, stateId: B_TRUE }] };
    config.solverSettings.variableOrder = null;
    es.eventTrees![0]!.sequences.failure!.endState = undefined;
    es.eventTrees![0]!.transfers = { [ET_FAILURE]: { targetEventTreeId: ET_HCL } };
    const workbookId = "es-multistate-oracle";
    try {
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: esq } }).exec();
      await api
        .get<Model<unknown>>(getModelToken(EsWorkbook.name))
        .create({ workbookId, projectId: PROJECT_ID, ownerUsername: USERNAME, revision: 1, mef: es });
      const response = await request(api.getHttpServer())
        .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/event-tree-runs`)
        .send({
          schemaVersion: "1.0.0",
          modelId: HCL,
          workbookRevision: 7,
          eventTree: { workbookId, modelId: ET_INDEPENDENT },
        });
      expect(response.status).toBe(200);
      const result = await request(api.getHttpServer()).get(
        `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/runs/${response.body.run.id}/result`,
      );
      expect(result.status).toBe(200);
      const saved = (await runs.findOne({ id: response.body.run.id }).lean().exec())!;
      if (saved.target?.targetType !== "HCL_EVENT_TREE") throw new Error("Wrong subset target");
      const oracle = new WorkbookOracle(saved.workbookSnapshots, saved.target.configuration);
      await oracle.verifyEventTree(
        saved.target.eventTree,
        result.body,
        (envelope) => praetorClient.execute(envelope),
        [],
        true,
      );
      const probabilities = result.body.sequences
        .map((row: { conditionalProbability: number }) => row.conditionalProbability)
        .sort((a: number, b: number) => a - b);
      [0, 0, 0.05 / 0.37, 0.08 / 0.37, 0.24 / 0.37].forEach((expected, i) =>
        assertProbability(probabilities[i], expected),
      );
    } finally {
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: original.mef } }).exec();
    }
  });

  it("preserves rare probabilities through the backend", async () => {
    const original = (await syWorkbooks.findOne({ workbookId: SY_WORKBOOK_ID }).lean().exec()) as unknown as {
      mef: ReturnType<typeof createSyMef>;
    };
    const sy = createSyMef();
    const workbooks = api.get<Model<unknown>>(getModelToken(EsqWorkbook.name));
    const originalEsq = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
      mef: ReturnType<typeof createEsqMef>;
    };
    const esq = structuredClone(originalEsq.mef);
    esq.hclConfigurations[0]!.solverSettings.variableOrder = null;
    sy.systemBasicEvents.find((e) => e.uuid === EVENT_CONSTANT_FALSE)!.probability = 1e-14;
    try {
      await syWorkbooks.updateOne({ workbookId: SY_WORKBOOK_ID }, { $set: { mef: sy } }).exec();
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: esq } }).exec();
      const response = await request(api.getHttpServer())
        .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/fault-tree-runs`)
        .send({
          schemaVersion: "1.0.0",
          modelId: HCL,
          workbookRevision: 7,
          faultTreeTopGate: topReference(FT_MASKED, TOP_MASKED),
        });
      expect(response.status).toBe(200);
      const result = await request(api.getHttpServer()).get(
        `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/runs/${response.body.run.id}/result`,
      );
      expect(result.status).toBe(200);
      assertProbability(result.body.probability, 2e-15);
      const saved = (await runs.findOne({ id: response.body.run.id }).lean().exec())!;
      if (saved.target?.targetType !== "HCL_FAULT_TREE") throw new Error("Wrong rare target");
      const oracle = new WorkbookOracle(saved.workbookSnapshots, saved.target.configuration);
      assertProbability(
        result.body.probability,
        await oracle.faultTree(saved.target.faultTreeTopEvent, (envelope) => praetorClient.execute(envelope)),
      );
    } finally {
      await syWorkbooks.updateOne({ workbookId: SY_WORKBOOK_ID }, { $set: { mef: original.mef } }).exec();
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: originalEsq.mef } }).exec();
    }
  });

  it.each(["MC", "LHS"] as const)(
    "checks %s sampled CPTs and FT probabilities through HTTP, transfers and evidence batches against HCL_MH",
    async (sampler) => {
      const fixtures = resolve(__dirname, "../../../../../../solvers/praxis/tests/fixtures");
      const source = JSON.parse(readFileSync(resolve(fixtures, "hcl_mh_cpt/reference.json"), "utf8")).mixed.find(
        (c: { name: string }) => c.name === sampler,
      );
      const reference = JSON.parse(
        readFileSync(resolve(fixtures, "hcl_mh_summaries/reference.json"), "utf8"),
      ).native.find((c: { family: string; name: string }) => c.family === "cpt" && c.name === sampler);
      const workbooks = api.get<Model<unknown>>(getModelToken(EsqWorkbook.name));
      const originalSy = (await syWorkbooks.findOne({ workbookId: SY_WORKBOOK_ID }).lean().exec()) as unknown as {
        mef: ReturnType<typeof createSyMef>;
      };
      const originalEsq = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
        mef: ReturnType<typeof createEsqMef>;
      };
      const sy = createSyMef(),
        esq = createEsqMef(),
        es = createEsMef();
      const network = esq.bayesianNetworks[0]!,
        config = esq.hclConfigurations[0]!;
      const z = randomUUID(),
        zFalse = randomUUID(),
        zTrue = randomUUID();
      network.nodes.push({
        id: z,
        code: "Z",
        name: "Sampling-order sentinel",
        description: "Source sampling order",
        kind: "CHANCE_NODE",
        states: [
          { id: zFalse, code: "FALSE", name: "False" },
          { id: zTrue, code: "TRUE", name: "True" },
        ],
      });
      network.conditionalProbabilityTables.push({
        nodeId: z,
        parents: [],
        rows: [
          {
            id: randomUUID(),
            parentStates: [],
            values: [
              { stateId: zFalse, probability: 0.4 },
              { stateId: zTrue, probability: 0.6 },
            ],
          },
        ],
      });
      delete config.hazardGrid;
      config.solverSettings.variableOrder = null;
      const names: Record<string, string> = { A: NODE_A, B: NODE_B, Z: z };
      for (const variable of source.variables) {
        const table = network.conditionalProbabilityTables.find((t) => t.nodeId === names[variable.name])!;
        table.rows.forEach((row, i) =>
          row.values.forEach((value, j) => {
            value.probability = variable.probabilities[i * 2 + j];
          }),
        );
      }
      // Same source formula: (A & E) | (!A & B). The outer FT is a transfer,
      // so both probability and UQ must retain the bound events after flattening.
      sy.systemBasicEvents.find((e) => e.uuid === EVENT_CONSTANT_FALSE)!.probability = 0.2;
      const ft = sy.systemLogicModels.find((m) => m.uuid === FT_AND)!;
      const ae = randomUUID(),
        nb = randomUUID(),
        na = randomUUID(),
        leafE = randomUUID();
      ft.gates = [
        ...[
          [TOP_AND, "OR"],
          [ae, "AND"],
          [nb, "AND"],
          [na, "NOT"],
        ].map(([id, gateType]) => ({
          id: id!,
          code: id!,
          name: id!,
          description: "Source uncertainty formula",
          kind: "GATE" as const,
          gateType: gateType as "AND" | "OR" | "NOT",
        })),
      ];
      ft.leafNodes.push({ id: leafE, kind: "BASIC_EVENT_REFERENCE", basicEventId: EVENT_CONSTANT_FALSE });
      ft.gateInputs = [
        [TOP_AND, ae],
        [TOP_AND, nb],
        [ae, AND_LEAF_A],
        [ae, leafE],
        [nb, na],
        [nb, AND_LEAF_B],
        [na, AND_LEAF_A],
      ].map(([gateId, childId], order) => ({ id: randomUUID(), gateId: gateId!, childId: childId!, order }));
      config.faultTrees = [
        { workbookId: SY_WORKBOOK_ID, modelId: FT_AND },
        { workbookId: SY_WORKBOOK_ID, modelId: FT_TRANSFER },
      ];
      config.solverSettings.uncertainty = {
        sampler,
        sampleCount: source.settings.sample_count,
        seed: source.settings.seed,
        cptProbabilityClipEpsilon: source.settings.cpt_probability_clip_epsilon,
        basicEventDistributions: [
          {
            faultTreeBasicEvent: {
              referenceType: "FAULT_TREE_BASIC_EVENT",
              workbookId: SY_WORKBOOK_ID,
              entityId: EVENT_CONSTANT_FALSE,
            },
            distribution: source.settings.basic_event_distributions[0].distribution,
          },
        ],
        cptRowDistributions: source.settings.cpt_row_distributions.map(
          (row: {
            node: string;
            row_index: number;
            prior: { family: "BETA" | "DIRICHLET"; alpha: number | number[]; beta?: number; true_state?: string };
          }) => {
            const table = network.conditionalProbabilityTables.find((t) => t.nodeId === names[row.node])!;
            const { true_state, ...prior } = row.prior;
            return {
              bayesianNetworkNode: {
                referenceType: "BAYESIAN_NETWORK_NODE",
                workbookId: ESQ_WORKBOOK_ID,
                modelId: BN,
                entityId: names[row.node]!,
              },
              cptRowId: table.rows[row.row_index]!.id,
              prior: {
                ...prior,
                ...(true_state === undefined ?
                  {}
                : { trueStateId: network.nodes.find((n) => n.id === names[row.node])!.states[1]!.id }),
              },
            };
          },
        ),
      };
      config.evidenceScenarios = source.outputs.map((output: { evidence: Record<string, number> }, i: number) => ({
        id: randomUUID(),
        code: `SOURCE-${i}`,
        name: `Source evidence ${i}`,
        enabled: true,
        evidence: {
          observations: Object.entries(output.evidence).map(([name, state]) => ({
            nodeId: names[name]!,
            stateId: network.nodes.find((n) => n.id === names[name])!.states[state]!.id,
          })),
        },
      }));
      es.eventTrees![0]!.functionalEvents.first!.faultTreeTopEvent = topReference(FT_TRANSFER, TOP_TRANSFER);
      es.eventTrees![0]!.sequences.failure!.endState = undefined;
      es.eventTrees![0]!.transfers = { [ET_FAILURE]: { targetEventTreeId: ET_HCL } };
      const esId = `es-source-uq-${sampler}`;
      const checkSummary = (actual: Record<string, number>, expected: Record<string, number>) => {
        expect(actual["sampleCount"]).toBe(source.settings.sample_count);
        expect(actual["seed"]).toBe(source.settings.seed);
        for (const [field, value] of Object.entries(expected))
          assertProbability(actual[field]!, value, `${sampler} ${field}`);
      };
      try {
        await syWorkbooks.updateOne({ workbookId: SY_WORKBOOK_ID }, { $set: { mef: sy } }).exec();
        await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: esq } }).exec();
        await api
          .get<Model<unknown>>(getModelToken(EsWorkbook.name))
          .create({ workbookId: esId, projectId: PROJECT_ID, ownerUsername: USERNAME, revision: 1, mef: es });
        for (const kind of ["fault-tree", "event-tree"]) {
          const response = await request(api.getHttpServer())
            .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/${kind}-batch-runs`)
            .send({
              schemaVersion: "1.0.0",
              modelId: HCL,
              workbookRevision: 7,
              calculationType: "UNCERTAINTY",
              evidenceScenarioIds: config.evidenceScenarios!.map((s) => s.id),
              ...(kind === "fault-tree" ?
                { faultTreeTopGate: topReference(FT_TRANSFER, TOP_TRANSFER) }
              : { eventTree: { workbookId: esId, modelId: ET_INDEPENDENT } }),
            });
          expect({ status: response.status, body: response.body }).toEqual({
            status: 200,
            body: expect.objectContaining({ runs: expect.any(Array) }),
          });
          for (const [index, row] of response.body.runs.entries()) {
            expect({
              kind,
              status: row.run.status,
              failure: (await runs.findOne({ id: row.run.id }).lean().exec())?.failure,
            }).toEqual({ kind, status: "SUCCEEDED", failure: null });
            const result = await request(api.getHttpServer()).get(
              `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/runs/${row.run.id}/result`,
            );
            expect(result.status).toBe(200);
            const recorded = (await runs.findOne({ id: row.run.id }).lean().exec())!;
            expect(recorded.contributions!.flatMap((c) => c.entities)).toEqual(
              expect.arrayContaining(
                config.bindings.map((binding) => ({
                  referenceType: "HCL_BINDING",
                  workbookId: ESQ_WORKBOOK_ID,
                  modelId: HCL,
                  entityId: binding.id,
                })),
              ),
            );
            if (kind === "fault-tree") {
              checkSummary(result.body.uncertainty, reference.outputs[index].summary);
              expect(result.body.variableOrder.slice(0, 2)).toEqual([EVENT_A, EVENT_B]);
            } else {
              const saved = (await runs.findOne({ id: row.run.id }).lean().exec())!;
              if (saved.target?.targetType !== "HCL_EVENT_TREE") throw new Error("Wrong source test target");
              const oracle = new WorkbookOracle(saved.workbookSnapshots, saved.target.configuration);
              await oracle.verifyEventTree(
                saved.target.eventTree,
                result.body,
                (envelope) => praetorClient.execute(envelope),
                config.evidenceScenarios![index]!.evidence.observations,
                true,
              );
              for (const sequence of result.body.sequences) {
                const outcome =
                  sequence.sequenceId === ET_SUCCESS ? "SUCCESS"
                  : sequence.sequenceChain.at(-1).entityId === HCL_FF ? "FAILURE"
                  : null;
                const zero = Object.fromEntries(
                  Object.keys(reference.outputs[index].summary).map((field) => [field, 0]),
                );
                const expected =
                  outcome === null ? { conditional: zero, annual: zero } : reference.outputs[index].sequences[outcome];
                checkSummary(sequence.uncertainty.conditionalProbability, expected.conditional);
                checkSummary(sequence.uncertainty.annualFrequency, expected.annual);
              }
              for (const aggregate of result.body.endStateAggregates) {
                checkSummary(
                  aggregate.uncertainty,
                  reference.outputs[index].sequences[aggregate.endStateId === SAFE ? "SUCCESS" : "FAILURE"].annual,
                );
              }
            }
          }
        }
      } finally {
        await syWorkbooks.updateOne({ workbookId: SY_WORKBOOK_ID }, { $set: { mef: originalSy.mef } }).exec();
        await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: originalEsq.mef } }).exec();
      }
    },
    120_000,
  );

  it.each(
    (["fault-tree", "event-tree"] as const).flatMap((kind) => [false, true].map((batch) => [kind, batch] as const)),
  )(
    "honors %s calculation selection (batch=%s) without changing saved settings",
    async (kind, batch) => {
      const workbooks = api.get<Model<unknown>>(getModelToken(EsqWorkbook.name));
      const original = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
        mef: ReturnType<typeof createEsqMef>;
      };
      const mef = structuredClone(original.mef);
      const uncertainty = { sampleCount: 10, seed: 42, basicEventDistributions: [], cptRowDistributions: [] };
      mef.hclConfigurations[0]!.solverSettings.uncertainty = uncertainty;
      const client = api.get(PraetorAnalysisClient);
      const spy = jest.spyOn(client, "execute");
      try {
        await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef } }).exec();
        for (const calculationType of [undefined, "PROBABILITY", "UNCERTAINTY"]) {
          spy.mockClear();
          const body = {
            schemaVersion: "1.0.0",
            modelId: HCL,
            workbookRevision: 7,
            ...(calculationType === undefined ? {} : { calculationType }),
            ...(batch ? { evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE] } : {}),
            ...(kind === "fault-tree" ?
              { faultTreeTopGate: topReference(FT_AND, TOP_AND) }
            : { eventTree: { workbookId: ES_WORKBOOK_ID, modelId: ET_HCL } }),
          };
          const response = await request(api.getHttpServer())
            .post(
              `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/${kind}-${batch ? "batch-runs" : "runs"}`,
            )
            .send(body);
          expect(response.status).toBe(200);
          expect(spy).toHaveBeenCalledTimes(1);
          const envelope = spy.mock.calls[0]![0];
          expect(envelope.request["calculationType"]).toBe(calculationType ?? "PROBABILITY");
          const snapshot = envelope.modelSnapshots.find((s) => s["methodType"] === "HYBRID_CAUSAL_LOGIC")!;
          const settings = snapshot["solverSettings"] as Record<string, unknown>;
          expect(settings["uncertainty"] !== undefined).toBe(calculationType === "UNCERTAINTY");
          const metadata = batch ? response.body.runs.map((row: { run: unknown }) => row.run) : [response.body.run];
          for (const run of metadata) {
            expect(run.status).toBe("SUCCEEDED");
            const result = await request(api.getHttpServer()).get(
              `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/runs/${run.id}/result`,
            );
            expect(result.status).toBe(200);
            const summary =
              kind === "fault-tree" ?
                result.body.uncertainty
              : result.body.sequences[0].uncertainty?.conditionalProbability;
            if (calculationType === "UNCERTAINTY") expect(summary.sampleCount).toBe(10);
            else expect(summary == null).toBe(true);
            expect((await runs.findOne({ id: run.id }).lean().exec())?.request["calculationType"]).toBe(
              calculationType ?? "PROBABILITY",
            );
          }
        }
        const saved = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
          mef: ReturnType<typeof createEsqMef>;
        };
        expect(saved.mef).toEqual(mef);
      } finally {
        spy.mockRestore();
        await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: original.mef } }).exec();
      }
    },
    120_000,
  );

  it.each(["fault-tree", "event-tree"])("rejects %s hazard uncertainty before creating runs", async (kind) => {
    const workbooks = api.get<Model<unknown>>(getModelToken(EsqWorkbook.name));
    const original = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
      mef: ReturnType<typeof createEsqMef>;
    };
    const mef = structuredClone(original.mef);
    mef.hclConfigurations[0]!.solverSettings.uncertainty = {
      sampleCount: 10,
      seed: 42,
      basicEventDistributions: [],
      cptRowDistributions: [],
    };
    const body = {
      schemaVersion: "1.0.0",
      modelId: HCL,
      workbookRevision: 7,
      integrateHazardGrid: true,
      calculationType: "UNCERTAINTY",
      evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE],
      ...(kind === "fault-tree" ?
        { faultTreeTopGate: topReference(FT_AND, TOP_AND) }
      : { eventTree: { workbookId: ES_WORKBOOK_ID, modelId: ET_HCL } }),
    };
    try {
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef } }).exec();
      const before = await runs.countDocuments().exec();
      const response = await request(api.getHttpServer())
        .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/${kind}-batch-runs`)
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Hazard convolution supports point runs only");
      expect(await runs.countDocuments().exec()).toBe(before);
      const point = await request(api.getHttpServer())
        .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/${kind}-batch-runs`)
        .send({ ...body, calculationType: "PROBABILITY" });
      expect(point.status).toBe(200);
      const totals = kind === "fault-tree" ? [point.body.hazardConvolution] : point.body.hazardConvolution.sequences;
      expect(totals.length).toBeGreaterThan(0);
      expect(
        totals.every((total: { convolvedProbability: number }) => Number.isFinite(total.convolvedProbability)),
      ).toBe(true);
      const saved = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
        mef: ReturnType<typeof createEsqMef>;
      };
      expect(saved.mef).toEqual(mef);
      const scenarios = await request(api.getHttpServer())
        .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/${kind}-batch-runs`)
        .send({ ...body, integrateHazardGrid: false });
      expect(scenarios.status).toBe(200);
      expect(scenarios.body.runs.every(({ run }: { run: { status: string } }) => run.status === "SUCCEEDED")).toBe(
        true,
      );
    } finally {
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: original.mef } }).exec();
    }
  });

  it("allows one-cell hazard grids with raw or normalized probability totals", async () => {
    const workbooks = api.get<Model<unknown>>(getModelToken(EsqWorkbook.name));
    const original = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
      mef: ReturnType<typeof createEsqMef>;
    };
    const mef = structuredClone(original.mef);
    try {
      for (const normalize of [false, true]) {
        mef.hclConfigurations[0]!.hazardGrid!.normalizeWeights = normalize;
        await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef } }).exec();
        const response = await request(api.getHttpServer())
          .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/fault-tree-batch-runs`)
          .send({
            schemaVersion: "1.0.0",
            modelId: HCL,
            workbookRevision: 7,
            integrateHazardGrid: true,
            faultTreeTopGate: topReference(FT_AND, TOP_AND),
            evidenceScenarioIds: [SCENARIO_A_TRUE],
          });
        expect(response.status).toBe(200);
        expect(response.body.hazardConvolution.convolvedProbability).toBeCloseTo(normalize ? 0.8 : 0.16, 12);
      }
    } finally {
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: original.mef } }).exec();
    }
  });

  it("quantifies constant FT targets", async () => {
    const workbooks = api.get<Model<unknown>>(getModelToken(EsqWorkbook.name));
    const original = (await workbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
      mef: ReturnType<typeof createEsqMef>;
    };
    const mef = structuredClone(original.mef);
    mef.hclConfigurations[0]!.solverSettings.variableOrder = [EVENT_A, EVENT_CONSTANT_FALSE];
    try {
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef } }).exec();
      const response = await request(api.getHttpServer())
        .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/fault-tree-batch-runs`)
        .send({
          schemaVersion: "1.0.0",
          modelId: HCL,
          workbookRevision: 7,
          faultTreeTopGate: topReference(FT_MASKED, TOP_MASKED),
          evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE],
        });
      expect(response.status).toBe(200);
      for (const row of response.body.runs) {
        expect(row.run).toMatchObject({ status: "SUCCEEDED", failure: null });
        const result = await request(api.getHttpServer()).get(
          `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/runs/${row.run.id}/result`,
        );
        expect(result.status).toBe(200);
        expect(result.body.probability).toBe(0);
      }
    } finally {
      await workbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: original.mef } }).exec();
    }
  });

  it("retains declared-target validation for FT and ET batches", async () => {
    for (const kind of ["fault-tree", "event-tree"]) {
      const response = await request(api.getHttpServer())
        .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/${kind}-batch-runs`)
        .send({
          schemaVersion: "1.0.0",
          modelId: HCL,
          workbookRevision: 7,
          ...(kind === "fault-tree" ?
            { faultTreeTopGate: topReference(FT_OR, TOP_OR) }
          : { eventTree: { workbookId: ES_WORKBOOK_ID, modelId: ET_INDEPENDENT } }),
          evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE],
        });
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/not declared by the HCL configuration/i);
    }
  });

  it.each((["fault-tree", "event-tree"] as const).flatMap((kind) => [1, 2].map((count) => [kind, count] as const)))(
    "runs %s batches with %s identical evidence row(s)",
    async (kind, count) => {
      const original = createEsqMef().hclConfigurations[0]!.evidenceScenarios![0]!;
      const scenarios = [
        original,
        { ...original, id: SCENARIO_A_FALSE, code: "REPEATED", name: "Repeated evidence" },
      ].slice(0, count);
      const response = await request(api.getHttpServer())
        .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/${kind}-batch-runs`)
        .send({
          schemaVersion: "1.0.0",
          modelId: HCL,
          workbookRevision: 7,
          ...(kind === "fault-tree" ?
            { faultTreeTopGate: topReference(FT_AND, TOP_AND) }
          : { eventTree: { workbookId: ES_WORKBOOK_ID, modelId: ET_HCL } }),
          evidenceScenarioIds: scenarios.map((row) => row.id),
          batchInput: { evidenceScenarios: scenarios },
        });
      expect(response.status).toBe(200);
      expect(response.body.runs).toHaveLength(count);
      expect(response.body.compilationReuse).toEqual({
        ...(kind === "fault-tree" ? { bddCompilations: 1 } : { sequenceBddCompilations: 4 }),
        junctionTreeCompilations: 1,
        scenarioEvaluations: count,
      });
      for (const row of response.body.runs) {
        expect(row.run.status).toBe("SUCCEEDED");
        const result = await request(api.getHttpServer()).get(
          `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/runs/${row.run.id}/result`,
        );
        expect(result.status).toBe(200);
        expect(result.body.compilationReuse).toEqual(response.body.compilationReuse);
        if (kind === "fault-tree") {
          expect(result.body.variableOrder).toEqual(expect.arrayContaining([EVENT_A, EVENT_B]));
          expect(result.body.bridge.quantifications).toBe(1);
        } else {
          for (const sequence of result.body.sequences) {
            expect(sequence.diagnostics.bdd.variableOrder).toEqual(expect.arrayContaining([EVENT_A, EVENT_B]));
            expect(sequence.diagnostics.bridge.quantifications).toBe(1);
            expect(sequence.diagnostics.junctionTree.numCliques).toBeGreaterThan(0);
          }
        }
        const probability =
          kind === "fault-tree" ?
            result.body.probability
          : result.body.sequences.find((sequence: { sequenceId: string }) => sequence.sequenceId === HCL_FF)
              .conditionalProbability;
        expect(probability).toBeCloseTo(0.8, 12);
        const stored = await runs.findOne({ id: row.run.id }).lean().exec();
        expect((stored?.result as { compilationReuse: unknown }).compilationReuse).toEqual(
          response.body.compilationReuse,
        );
        expect(stored?.request["batchContext"]).toEqual({ evidenceScenarioIds: scenarios.map((s) => s.id) });
        expect(stored?.request["evidenceScenario"]).toEqual(scenarios.find((s) => s.id === row.scenarioId));
      }
    },
  );

  it.each(["fault-tree", "event-tree"])(
    "uses BN probabilities despite zero FT placeholders in %s batches",
    async (kind) => {
      const esqWorkbooks = api.get<Model<unknown>>(getModelToken(EsqWorkbook.name));
      const originalEsq = (await esqWorkbooks.findOne({ workbookId: ESQ_WORKBOOK_ID }).lean().exec()) as unknown as {
        mef: ReturnType<typeof createEsqMef>;
      };
      const originalSy = (await syWorkbooks.findOne({ workbookId: SY_WORKBOOK_ID }).lean().exec()) as unknown as {
        mef: ReturnType<typeof createSyMef>;
      };
      const esq = structuredClone(originalEsq.mef);
      const sy = structuredClone(originalSy.mef);
      const bn = esq.bayesianNetworks[0]!;
      bn.edges = [];
      const cpt = bn.conditionalProbabilityTables.find((table) => table.nodeId === NODE_B)!;
      cpt.parents = [];
      cpt.rows = [{ ...cpt.rows[1]!, parentStates: [] }]; // Independent P(B=true)=0.8.
      sy.systemBasicEvents.find((event) => event.uuid === EVENT_B)!.probability = 0; // Unused because B is BN-linked.
      try {
        await esqWorkbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: esq } }).exec();
        await syWorkbooks.updateOne({ workbookId: SY_WORKBOOK_ID }, { $set: { mef: sy } }).exec();
        const response = await request(api.getHttpServer())
          .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/${kind}-batch-runs`)
          .send({
            schemaVersion: "1.0.0",
            modelId: HCL,
            workbookRevision: 7,
            ...(kind === "fault-tree" ?
              { faultTreeTopGate: topReference(FT_AND, TOP_AND) }
            : { eventTree: { workbookId: ES_WORKBOOK_ID, modelId: ET_HCL } }),
            evidenceScenarioIds: [SCENARIO_A_FALSE, SCENARIO_A_TRUE],
          });
        expect(response.status).toBe(200);
        const probabilities = [];
        for (const row of response.body.runs) {
          expect(row.run.status).toBe("SUCCEEDED");
          const result = await request(api.getHttpServer()).get(
            `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/runs/${row.run.id}/result`,
          );
          expect(result.status).toBe(200);
          probabilities.push(
            kind === "fault-tree" ?
              result.body.probability
            : result.body.sequences.find((sequence: { sequenceId: string }) => sequence.sequenceId === HCL_FF)
                .conditionalProbability,
          );
        }
        expect(probabilities).toEqual([0, expect.closeTo(0.8, 12)]);
      } finally {
        await esqWorkbooks.updateOne({ workbookId: ESQ_WORKBOOK_ID }, { $set: { mef: originalEsq.mef } }).exec();
        await syWorkbooks.updateOne({ workbookId: SY_WORKBOOK_ID }, { $set: { mef: originalSy.mef } }).exec();
      }
    },
  );

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
      .post(
        `/api/sy-workbooks/${HCL_CASE_SY_WORKBOOK_ID}/hcl-configurations/${HCL_CASE_BAYESIAN_IDS.hclConfiguration}/fault-tree-runs`,
      )
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

  it("requires explicit relinking of missing DA/HRA workbooks", async () => {
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
      .post(
        `/api/sy-workbooks/${HCL_CASE_STALE_SY_WORKBOOK_ID}/hcl-configurations/${HCL_CASE_BAYESIAN_IDS.hclConfiguration}/fault-tree-runs`,
      )
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

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Relink .* explicitly/);
    const repaired = reconcileExampleSyHumanReliabilityReferences(
      reconcileExampleSyDataAnalysisReferences(staleSystems, DA_ANALYSIS_HCL, HCL_CASE_DA_WORKBOOK_ID),
      HR_ANALYSIS_HCL,
      HCL_CASE_HR_WORKBOOK_ID,
    );
    await syWorkbooks.updateOne(
      { workbookId: HCL_CASE_STALE_SY_WORKBOOK_ID },
      { $set: { mef: repaired, revision: 2 } },
    );
    const rerun = await request(api.getHttpServer())
      .post(
        `/api/sy-workbooks/${HCL_CASE_STALE_SY_WORKBOOK_ID}/hcl-configurations/${HCL_CASE_BAYESIAN_IDS.hclConfiguration}/fault-tree-runs`,
      )
      .send({
        schemaVersion: "1.0.0",
        modelId: HCL_CASE_BAYESIAN_IDS.hclConfiguration,
        workbookRevision: 2,
        faultTreeTopGate: {
          referenceType: "FAULT_TREE_TOP_EVENT",
          workbookId: HCL_CASE_STALE_SY_WORKBOOK_ID,
          modelId: HCL_CASE_FAULT_TREE_MODEL_IDS.FEED_BLEED,
          entityId: HCL_CASE_FAULT_TREE_TOP_GATE_IDS.FEED_BLEED,
        },
      });
    expect(rerun.status).toBe(200);
    expect(rerun.body.run.status).toBe("SUCCEEDED");
  });

  it("checks reconstructed dissertation inputs against an independent BN for the FT and every ET sequence", async () => {
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
    const savedFt = (await runs.findOne({ id: faultTree.body.run.id }).lean().exec())!;
    if (savedFt.target?.targetType !== "HCL_FAULT_TREE") throw new Error("Wrong saved FT target");
    const ftOracle = new WorkbookOracle(savedFt.workbookSnapshots, savedFt.target.configuration);
    assertProbability(
      faultTreeResult.body.probability,
      await ftOracle.faultTree(savedFt.target.faultTreeTopEvent, (envelope) => praetorClient.execute(envelope)),
      "Case-study FT",
    );
    expect(faultTree.body.run.sourceWorkbooks).toContainEqual({
      workbookId: HCL_CASE_DA_WORKBOOK_ID,
      workbookRevision: 2,
    });
    expect(faultTree.body.run.sourceWorkbooks).toContainEqual({
      workbookId: HCL_CASE_HR_WORKBOOK_ID,
      workbookRevision: 3,
    });

    for (const [treeKey, sequenceCount] of [
      // LOOP: 19 terminal paths + SBO; SBO: 10 terminal paths + 2 * 13 FLEX paths.
      ["LOOP", 55],
      ["SBO", 36],
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
      if (storedEventTreeRun?.target?.targetType !== "HCL_EVENT_TREE") throw new Error("Wrong saved ET target");
      const oracle = new WorkbookOracle(storedEventTreeRun.workbookSnapshots, storedEventTreeRun.target.configuration);
      // Source BDD complement subtraction loses absolute precision on rare
      // noncoherent paths. Bound roundoff AND relative error (0.1% maximum);
      // a lost positive path can never pass. Compact cases use pure relative checks.
      await oracle.verifyEventTree(
        storedEventTreeRun.target.eventTree,
        eventTreeResult.body,
        (envelope) => praetorClient.execute(envelope),
        [],
        false,
        4 * Number.EPSILON,
      );
      expect(
        eventTreeResult.body.sequences.reduce(
          (sum: number, sequence: { conditionalProbability: number }) => sum + sequence.conditionalProbability,
          0,
        ),
      ).toBeCloseTo(1, 10);
    }

    const eventTreeBatch = await request(api.getHttpServer())
      .post(
        `/api/esq-workbooks/${HCL_CASE_ESQ_WORKBOOK_ID}/hcl-configurations/${configurationId}/event-tree-batch-runs`,
      )
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
    expect(eventTreeBatch.body.runs.every(({ run }: { run: { status: string } }) => run.status === "SUCCEEDED")).toBe(
      true,
    );
    for (const row of eventTreeBatch.body.runs) {
      const saved = (await runs.findOne({ id: row.run.id }).lean().exec())!;
      if (saved.target?.targetType !== "HCL_EVENT_TREE") throw new Error("Wrong saved batch target");
      const oracle = new WorkbookOracle(saved.workbookSnapshots, saved.target.configuration);
      const scenario = oracle.configuration.evidenceScenarios!.find((s) => s.id === row.scenarioId)!;
      await oracle.verifyEventTree(
        saved.target.eventTree,
        saved.result as Parameters<WorkbookOracle["verifyEventTree"]>[1],
        (envelope) => praetorClient.execute(envelope),
        scenario.evidence.observations,
        false,
        4 * Number.EPSILON,
      );
    }
    runIds.push(eventTreeBatch.body.batchId);

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

  it.each([false, true])("saves native deadline failures (batch=%s)", async (batch) => {
    const previous = process.env["PRAETOR_NATIVE_TIMEOUT_MS"];
    process.env["PRAETOR_NATIVE_TIMEOUT_MS"] = "1";
    try {
      const response = await request(api.getHttpServer())
        .post(
          batch ?
            `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/fault-tree-batch-runs`
          : `/api/sy-workbooks/${SY_WORKBOOK_ID}/fault-trees/${FT_OR}/runs`,
        )
        .send(
          batch ?
            {
              schemaVersion: "1.0.0",
              modelId: HCL,
              workbookRevision: 7,
              faultTreeTopGate: topReference(FT_AND, TOP_AND),
              evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE],
            }
          : { schemaVersion: "1.0.0", modelId: FT_OR, workbookRevision: 3 },
        );
      expect(response.status).toBe(200);
      const rows = batch ? response.body.runs.map((row: { run: { id: string } }) => row.run) : [response.body.run];
      for (const row of rows) {
        expect(row).toMatchObject({ status: "FAILED", failure: { code: "PRAXIS_TIMEOUT" } });
        const stored = await runs.findOne({ id: row.id }).lean().exec();
        expect(stored).toMatchObject({ status: "FAILED", failure: { code: "PRAXIS_TIMEOUT" }, result: null });
      }
    } finally {
      if (previous === undefined) delete process.env["PRAETOR_NATIVE_TIMEOUT_MS"];
      else process.env["PRAETOR_NATIVE_TIMEOUT_MS"] = previous;
    }
  });

  it("cancels only the disconnected browser request and records its failure", async () => {
    let entered!: () => void;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    jest.spyOn(praetorClient, "execute").mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          const signal = analysisRequestSignal.getStore()!;
          signal.addEventListener(
            "abort",
            () =>
              resolve({
                schemaVersion: "1.0.0",
                error: { kind: "EXECUTION_ERROR", code: "PRAXIS_CANCELLED", message: "Cancelled", details: {} },
              }),
            { once: true },
          );
          entered();
        }),
    );
    const server = api.getHttpServer();
    if (!server.listening) await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const controller = new AbortController();
    const pending = fetch(
      `http://127.0.0.1:${address.port}/api/sy-workbooks/${SY_WORKBOOK_ID}/fault-trees/${FT_OR}/runs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schemaVersion: "1.0.0", modelId: FT_OR, workbookRevision: 3 }),
        signal: controller.signal,
      },
    );
    const aborted = expect(pending).rejects.toHaveProperty("name", "AbortError");
    await ready;
    const running = await runs.findOne({ status: "RUNNING" }).lean().exec();
    controller.abort();
    await aborted;
    let stored = await runs.findOne({ id: running!.id }).lean().exec();
    for (let i = 0; i < 100 && stored?.status !== "FAILED"; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      stored = await runs.findOne({ id: running!.id }).lean().exec();
    }
    expect(stored).toMatchObject({ status: "FAILED", failure: { code: "PRAXIS_CANCELLED" }, result: null });
    const next = await request(server)
      .post(`/api/sy-workbooks/${SY_WORKBOOK_ID}/fault-trees/${FT_OR}/runs`)
      .send({ schemaVersion: "1.0.0", modelId: FT_OR, workbookRevision: 3 });
    expect(next.body.run.status).toBe("SUCCEEDED");
  });
  it("pins each HCL workbook once and records the exact request and native build", async () => {
    const readSpy = jest.spyOn(syWorkbooks, "findOne");
    const response = await request(api.getHttpServer())
      .post(
        `/api/sy-workbooks/${HCL_CASE_SY_WORKBOOK_ID}/hcl-configurations/${HCL_CASE_BAYESIAN_IDS.hclConfiguration}/fault-tree-runs`,
      )
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
    expect(response.body.run.status).toBe("SUCCEEDED");
    expect(
      readSpy.mock.calls.filter(([query]) => (query as { workbookId?: string }).workbookId === HCL_CASE_SY_WORKBOOK_ID),
    ).toHaveLength(1);
    const saved = await runs.findOne({ id: response.body.run.id }).lean().exec();
    expect(saved!.nativeRequest).toMatchObject({
      schemaVersion: "1.0.0",
      request: { methodType: "HYBRID_CAUSAL_LOGIC" },
      resources: { faultTreeBasicEventCatalogue: expect.any(Object) },
    });
    expect(saved!.engine?.version).toMatch(/^sha256:[0-9a-f]{64}$/);
    const replay = await praetorClient.execute(saved!.nativeRequest);
    expect(replay.error).toBeUndefined();
    expect(replay.engine).toEqual(saved!.engine);
    expect(replay.result!["probability"]).toBe((saved!.result as { probability: number }).probability);
  });

  it("preserves old inputs and detects changes in DA and HRA sources", async () => {
    const response = await request(api.getHttpServer())
      .post(`/api/sy-workbooks/${CONTROLLED_SY_WORKBOOK_ID}/fault-trees/${FT_OR}/runs`)
      .send({ schemaVersion: "1.0.0", modelId: FT_OR, workbookRevision: 4 });
    expect(response.body.run.status).toBe("SUCCEEDED");
    const saved = await runs.findOne({ id: response.body.run.id }).lean().exec();
    const hr = api.get<Model<unknown>>(getModelToken(HrWorkbook.name));
    await daWorkbooks.updateOne({ workbookId: DA_WORKBOOK_ID }, { $inc: { revision: 1 } });
    await hr.updateOne({ workbookId: HCL_CASE_HR_WORKBOOK_ID }, { $inc: { revision: 1 } });
    try {
      const details = await request(api.getHttpServer()).get(
        `/api/sy-workbooks/${CONTROLLED_SY_WORKBOOK_ID}/analysis-runs/${saved!.id}/details`,
      );
      expect(details.status).toBe(200);
      expect(details.body.run.freshness.status).toBe("STALE");
      expect(
        details.body.run.freshness.sources.filter((row: { status: string }) => row.status === "CHANGED"),
      ).toHaveLength(2);
      expect(details.body.nativeRequest).toEqual(saved!.nativeRequest);
      expect(details.body.result).toEqual(saved!.result);
      const replay = await praetorClient.execute(details.body.nativeRequest);
      expect(replay.result!["topEventProbability"]).toBe(
        (saved!.result as { topEventProbability: number }).topEventProbability,
      );
    } finally {
      await daWorkbooks.updateOne({ workbookId: DA_WORKBOOK_ID }, { $inc: { revision: -1 } });
      await hr.updateOne({ workbookId: HCL_CASE_HR_WORKBOOK_ID }, { $inc: { revision: -1 } });
    }
  });

  it("rechecks source-project access for metadata, results, details and history", async () => {
    const foreignProject = "000000000000000000000041";
    await daWorkbooks.updateOne({ workbookId: DA_WORKBOOK_ID }, { $set: { projectId: foreignProject } });
    try {
      const response = await request(api.getHttpServer())
        .post(`/api/sy-workbooks/${CONTROLLED_SY_WORKBOOK_ID}/fault-trees/${FT_OR}/runs`)
        .send({ schemaVersion: "1.0.0", modelId: FT_OR, workbookRevision: 4 });
      expect(response.body.run.status).toBe("SUCCEEDED");
      const id = response.body.run.id;
      jest.spyOn(api.get(ProjectsService), "resolveAccess").mockImplementation(async (projectId: string) => {
        if (projectId === foreignProject) throw new ForbiddenException("Access revoked");
        return { role: "editor" } as never;
      });
      for (const url of [
        `/analysis-runs/${id}`,
        `/analysis-runs/${id}/details`,
        `/fault-trees/${FT_OR}/runs/${id}/result`,
      ]) {
        expect(
          (await request(api.getHttpServer()).get(`/api/sy-workbooks/${CONTROLLED_SY_WORKBOOK_ID}${url}`)).status,
        ).toBe(403);
      }
      const history = await request(api.getHttpServer()).get(
        `/api/sy-workbooks/${CONTROLLED_SY_WORKBOOK_ID}/analysis-runs`,
      );
      expect(history.status).toBe(200);
      expect(history.body.runs.some((row: { run: { id: string } }) => row.run.id === id)).toBe(false);
    } finally {
      await daWorkbooks.updateOne({ workbookId: DA_WORKBOOK_ID }, { $set: { projectId: PROJECT_ID } });
    }
  });

  it("retains authorized history after a source is deleted and denies unverifiable legacy access", async () => {
    const response = await request(api.getHttpServer())
      .post(`/api/sy-workbooks/${CONTROLLED_SY_WORKBOOK_ID}/fault-trees/${FT_OR}/runs`)
      .send({ schemaVersion: "1.0.0", modelId: FT_OR, workbookRevision: 4 });
    const id = response.body.run.id;
    const source = await daWorkbooks.findOne({ workbookId: DA_WORKBOOK_ID }).lean().exec();
    const original = await runs.findOne({ id }).lean().exec();
    const { _id, ...legacy } = original!;
    const legacyId = randomUUID();
    await runs.create({
      ...legacy,
      id: legacyId,
      target: null,
      contributions: null,
      workbookSnapshots: legacy.workbookSnapshots.map(({ projectId, ...snapshot }) => snapshot),
      nativeRequest: null,
    });
    await daWorkbooks.deleteOne({ workbookId: DA_WORKBOOK_ID });
    try {
      const current = await request(api.getHttpServer()).get(
        `/api/sy-workbooks/${CONTROLLED_SY_WORKBOOK_ID}/analysis-runs/${id}/details`,
      );
      expect(current.status).toBe(200);
      expect(current.body.run.freshness.sources).toContainEqual({
        workbookId: DA_WORKBOOK_ID,
        savedRevision: 6,
        currentRevision: null,
        status: "MISSING",
      });
      expect(current.body.result).toEqual(original!.result);
      const historical = await request(api.getHttpServer()).get(
        `/api/sy-workbooks/${CONTROLLED_SY_WORKBOOK_ID}/analysis-runs/${legacyId}/details`,
      );
      expect(historical.status).toBe(404);
    } finally {
      await daWorkbooks.create(source!);
      await runs.deleteOne({ id: legacyId });
    }
  });

  it("stores and retrieves complete hazard batches without recomputing weights", async () => {
    const response = await request(api.getHttpServer())
      .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/fault-tree-batch-runs`)
      .send({
        schemaVersion: "1.0.0",
        modelId: HCL,
        workbookRevision: 7,
        faultTreeTopGate: topReference(FT_AND, TOP_AND),
        evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE],
        integrateHazardGrid: true,
      });
    expect(response.body.runs.every((row: { run: { status: string } }) => row.run.status === "SUCCEEDED")).toBe(true);
    const id = response.body.batchId;
    expect(id).toEqual(expect.any(String));
    const stored = await request(api.getHttpServer()).get(
      `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/analysis-runs/${id}/details`,
    );
    expect(stored.status).toBe(200);
    expect(stored.body.run.scope).toBe("BATCH");
    expect(stored.body.result).toEqual(response.body);
    expect(stored.body.members).toHaveLength(2);
    expect(stored.body.nativeRequest.request.evidenceBatch).toHaveLength(2);
    expect(stored.body.result.hazardConvolution).toEqual(response.body.hazardConvolution);
    const first = await request(api.getHttpServer()).get(
      `/api/esq-workbooks/${ESQ_WORKBOOK_ID}/analysis-runs/${response.body.runs[0].run.id}/details`,
    );
    expect(first.body.nativeRequest).toEqual(stored.body.nativeRequest);
  });

  it("pages all histories, includes ordinary/legacy runs, and enforces workbook ownership", async () => {
    const seed = await runs
      .findOne({ "owner.workbookId": SY_WORKBOOK_ID, methodType: "FAULT_TREE", status: "SUCCEEDED", scope: "SINGLE" })
      .lean()
      .exec();
    const { _id, ...template } = seed!;
    const ids = Array.from({ length: 30 }, () => randomUUID());
    const date = new Date(Date.now() + 1000);
    await runs.insertMany(
      ids.map((id) => ({
        ...template,
        id,
        target: null,
        contributions: null,
        requestedAt: date,
        startedAt: date,
        completedAt: date,
      })),
    );
    try {
      const first = await request(api.getHttpServer()).get(`/api/sy-workbooks/${SY_WORKBOOK_ID}/analysis-runs`);
      expect(first.status).toBe(200);
      expect(first.body.runs).toHaveLength(25);
      const next = await request(api.getHttpServer())
        .get(`/api/sy-workbooks/${SY_WORKBOOK_ID}/analysis-runs`)
        .query({ cursor: first.body.nextCursor });
      const combined = [...first.body.runs, ...next.body.runs].map((row: { run: { id: string } }) => row.run.id);
      expect(new Set(combined).size).toBe(combined.length);
      expect(ids.every((id) => combined.includes(id))).toBe(true);
      expect(first.body.runs[0].target).toBeNull();
      expect(
        (
          await request(api.getHttpServer()).get(
            `/api/sy-workbooks/${HCL_CASE_SY_WORKBOOK_ID}/analysis-runs/${ids[0]}/details`,
          )
        ).status,
      ).toBe(404);
      expect(
        (await request(api.getHttpServer()).get(`/api/sy-workbooks/${SY_WORKBOOK_ID}/analysis-runs?cursor=invalid`))
          .status,
      ).toBe(400);
      const ordinaryEt = await request(api.getHttpServer()).get(`/api/es-workbooks/${ES_WORKBOOK_ID}/analysis-runs`);
      expect(
        ordinaryEt.body.runs.some((row: { run: { methodType: string } }) => row.run.methodType === "EVENT_TREE"),
      ).toBe(true);
    } finally {
      await runs.deleteMany({ id: { $in: ids } });
    }
  });

  it.each(["malformed second result", "failed child write"])(
    "does not leave a partially successful batch after %s",
    async (failure) => {
      if (failure === "malformed second result") {
        const execute = praetorClient.execute.bind(praetorClient);
        jest.spyOn(praetorClient, "execute").mockImplementationOnce(async (envelope) => {
          const response = await execute(envelope);
          (response.result!["batchResults"] as Array<Record<string, unknown>>)[1]!["probability"] = -1;
          return response;
        });
      } else {
        jest
          .spyOn(runs, "updateOne")
          .mockImplementationOnce(
            () => ({ exec: () => Promise.reject(new Error("Test child write failure")) }) as never,
          );
      }
      const response = await request(api.getHttpServer())
        .post(`/api/esq-workbooks/${ESQ_WORKBOOK_ID}/hcl-configurations/${HCL}/fault-tree-batch-runs`)
        .send({
          schemaVersion: "1.0.0",
          modelId: HCL,
          workbookRevision: 7,
          faultTreeTopGate: topReference(FT_AND, TOP_AND),
          evidenceScenarioIds: [SCENARIO_A_TRUE, SCENARIO_A_FALSE],
        });
      expect(response.status).toBeGreaterThanOrEqual(500);
      const parent = await runs.findOne({ scope: "BATCH" }).sort({ requestedAt: -1 }).lean().exec();
      const records = await runs
        .find({ $or: [{ id: parent!.id }, { batchId: parent!.id }] })
        .lean()
        .exec();
      expect(records).toHaveLength(3);
      expect(records.every((row) => row.status === "FAILED" && row.result === null)).toBe(true);
    },
  );
});
// API regressions isolate the object-store dependency; the storage campaign
// separately exercises these same routes against real MinIO and MongoDB.
jest.mock("../../../storage/model-payload-store", () => {
  const actual = jest.requireActual("../../../storage/model-payload-store");
  const { stringifyJson } = jest.requireActual("interfaces-shared-types/json");
  const { createHash } = jest.requireActual("node:crypto");
  const objects = new Map<string, string>();
  return { ...actual, modelPayloadStore: {
    put: async (value: unknown) => {
      const text = stringifyJson(value);
      if (!text || Buffer.byteLength(text) < actual.INLINE_PAYLOAD_BYTES) return undefined;
      const sha256 = createHash("sha256").update(text).digest("hex");
      objects.set(sha256, text);
      return { format: "json-gzip-v1", key: sha256, sha256, bytes: Buffer.byteLength(text) };
    },
    get: async ({ key }: { key: string }) => JSON.parse(objects.get(key)!),
  } };
});
