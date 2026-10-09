import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { execute } from "praxis-node";
import { expressionReferences, type UncertainExpression, type UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { DataAnalysisSchema } from "interfaces-mef-types/zod/da/data-analysis";
import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { UncertaintyResponseSchema, type UncertaintyRequest, type UncertaintyResponse } from "interfaces-shared-types/newly-developed-methods/shared";
import { DaWorkbooksService } from "../../da-workbooks/da-workbooks.service";
import { DaWorkbook } from "../../da-workbooks/da-workbook.schema";
import { DaDocumentsService } from "../../da-workbooks/da-documents.service";
import { ProjectsService } from "../../projects/projects.service";
import { ScWorkbook } from "../../sc-workbooks/sc-workbook.schema";
import { WorkbookRolesService } from "../../workbooks/workbook-roles.service";
import { WorkbookSignoff } from "../../workbooks/workbook-signoff.schema";
import { ExampleWorkbook } from "../example-workbook.schema";
import { ExampleWorkbooksService } from "../example-workbooks.service";
import {
  daMissionTimeExpressions,
  esqMissionTimeExpressions,
  reconcileExampleDaMissionTimeReferences,
  reconcileExampleEsqMissionTimeReferences,
  reconcileExampleSyMissionTimeReferences,
  relinkExampleMissionTimes,
  syMissionTimeExpressions,
  type ProjectMissionTimeSource,
} from "../seeds/dependency-model-seed";
import { DA_ANALYSIS_HTGR } from "../seeds/da-seed-htgr";
import { ESQ_ANALYSIS_HTGR } from "../seeds/esq-seed-htgr";
import { SC_ANALYSIS } from "../seeds/sc-seed";
import { SC_ANALYSIS_HTGR } from "../seeds/sc-seed-htgr";
import { SY_ANALYSIS_HTGR } from "../seeds/sy-seed-htgr";

interface NativeAnswer {
  result?: Record<string, number | string | boolean | object | null>;
  error?: { message: string };
}

const PROJECT_ID = "project-1";
const PROJECT_SC_HTGR = "sc-project-htgr";
const PROJECT_SC_SFR = "sc-project-sfr";
const EXAMPLE_PREFIX = "example-sc-";

const SFR_SOURCE: ProjectMissionTimeSource = { sc: SC_ANALYSIS, workbookId: PROJECT_SC_SFR };

const SOURCES: ProjectMissionTimeSource[] = [SFR_SOURCE, { sc: SC_ANALYSIS_HTGR, workbookId: PROJECT_SC_HTGR }];

function workbookIds(expressions: readonly UncertainExpression[]): Set<string> {
  return new Set(expressions.flatMap(expressionReferences).map((reference) => reference.workbookId));
}

function exampleLinks(expressions: readonly UncertainExpression[]): string[] {
  return [...workbookIds(expressions)].filter((id) => id.startsWith(EXAMPLE_PREFIX));
}

function evaluate(request: UncertaintyRequest): UncertaintyResponse {
  const answer: NativeAnswer = JSON.parse(execute(JSON.stringify({ schemaVersion: "1.0.0", request: { schemaVersion: "1.0.0", methodType: "UNCERTAINTY", ...request }, modelSnapshots: [] })));
  if (answer.error !== undefined) throw new Error(answer.error.message);
  const result = { ...(answer.result ?? {}) };
  delete result["methodType"];
  return UncertaintyResponseSchema.parse(result);
}

function scTable(sc: SuccessCriteriaDevelopment, workbookId: string): UncertainParameter[] {
  return [...sc.missionTimes, ...(sc.componentMissionTimes ?? [])].map((record) => ({
    reference: { referenceType: "WORKBOOK_PARAMETER", workbookId, entityId: record.uuid },
    expression: record.missionTime,
  }));
}

function missionEstimates(da: DataAnalysis): { id: string; expression: UncertainExpression }[] {
  return da.parameters.flatMap((parameter) => {
    const estimate = parameter.estimate;
    return estimate?.node === "MODEL" && estimate.model.form === "MISSION" ? [{ id: parameter.uuid, expression: estimate }] : [];
  });
}

describe("example mission time links in a project", () => {
  it("moves every HTGR DA link to the project SC workbook that holds those mission times", () => {
    const relinked = relinkExampleMissionTimes(DA_ANALYSIS_HTGR, daMissionTimeExpressions(DA_ANALYSIS_HTGR), SOURCES, reconcileExampleDaMissionTimeReferences);

    expect(exampleLinks(daMissionTimeExpressions(DA_ANALYSIS_HTGR))).toEqual(["example-sc-htgr"]);
    expect(exampleLinks(daMissionTimeExpressions(relinked))).toEqual([]);
    expect(workbookIds(daMissionTimeExpressions(relinked)).has(PROJECT_SC_HTGR)).toBe(true);
    expect(workbookIds(daMissionTimeExpressions(relinked)).has(PROJECT_SC_SFR)).toBe(false);
    expect(relinked.linkedWorkbooks?.SC).toBe(PROJECT_SC_HTGR);
    expect(DataAnalysisSchema.safeParse(relinked).success).toBe(true);
  });

  it("evaluates every relinked DA mission estimate with the project SC table in PRAXIS", () => {
    const relinked = relinkExampleMissionTimes(DA_ANALYSIS_HTGR, daMissionTimeExpressions(DA_ANALYSIS_HTGR), SOURCES, reconcileExampleDaMissionTimeReferences);
    const estimates = missionEstimates(relinked);
    const response = evaluate({
      parameters: scTable(SC_ANALYSIS_HTGR, PROJECT_SC_HTGR),
      laws: [],
      operations: [],
      expressions: estimates.map((estimate) => ({ id: estimate.id, expression: estimate.expression, unit: "PROBABILITY", probabilities: [] })),
    });

    expect(estimates.length).toBeGreaterThan(0);
    expect(response.expressions.filter((answer) => !("point" in answer))).toEqual([]);
  });

  it("moves the HTGR SY and ESQ links too", () => {
    const sy = relinkExampleMissionTimes(SY_ANALYSIS_HTGR, syMissionTimeExpressions(SY_ANALYSIS_HTGR), SOURCES, reconcileExampleSyMissionTimeReferences);
    const esq = relinkExampleMissionTimes(ESQ_ANALYSIS_HTGR, esqMissionTimeExpressions(ESQ_ANALYSIS_HTGR), SOURCES, reconcileExampleEsqMissionTimeReferences);

    expect(exampleLinks(syMissionTimeExpressions(SY_ANALYSIS_HTGR))).toEqual(["example-sc-htgr"]);
    expect(exampleLinks(syMissionTimeExpressions(sy))).toEqual([]);
    expect(exampleLinks(esqMissionTimeExpressions(esq))).toEqual([]);
    expect(SystemsAnalysisSchema.safeParse(sy).success).toBe(true);
    expect(EventSequenceQuantificationSchema.safeParse(esq).success).toBe(true);
  });

  it("keeps the example links when no project SC workbook holds those mission times", () => {
    const onlySfr = relinkExampleMissionTimes(DA_ANALYSIS_HTGR, daMissionTimeExpressions(DA_ANALYSIS_HTGR), [SFR_SOURCE], reconcileExampleDaMissionTimeReferences);
    const none = relinkExampleMissionTimes(DA_ANALYSIS_HTGR, daMissionTimeExpressions(DA_ANALYSIS_HTGR), [], reconcileExampleDaMissionTimeReferences);

    expect(onlySfr).toBe(DA_ANALYSIS_HTGR);
    expect(none).toBe(DA_ANALYSIS_HTGR);
  });
});

describe("loading the DA example into a project", () => {
  const saved: { mef?: DataAnalysis } = {};

  async function service(): Promise<DaWorkbooksService> {
    const document = { workbookId: "da-1", projectId: PROJECT_ID, ownerUsername: "ada", revision: 1, mef: { workflowState: "DRAFT" }, previousMefJson: null, updatedAt: new Date("2026-10-09T00:00:00Z") };
    const scDocuments = [
      { workbookId: PROJECT_SC_HTGR, mef: SC_ANALYSIS_HTGR },
      { workbookId: "sc-broken", mef: { name: "Broken" } },
    ];
    const moduleRef = await Test.createTestingModule({
      providers: [
        DaWorkbooksService,
        ExampleWorkbooksService,
        { provide: getModelToken(ExampleWorkbook.name), useValue: { findOne: () => ({ exec: async () => ({ slug: "da-generic-2", kind: "DA", mef: DA_ANALYSIS_HTGR, updatedAt: new Date("2026-10-09T00:00:00Z") }) }), find: () => ({ sort: () => ({ exec: async () => [] }) }) } },
        { provide: getModelToken(ScWorkbook.name), useValue: { find: () => ({ sort: () => ({ exec: async () => scDocuments }) }) } },
        {
          provide: getModelToken(DaWorkbook.name),
          useValue: {
            findOne: () => ({ exec: async () => document }),
            findOneAndUpdate: (_filter: object, change: { $set: { mef: DataAnalysis; revision: number } }) => ({
              exec: async () => {
                saved.mef = change.$set.mef;
                return { ...document, ...change.$set };
              },
            }),
          },
        },
        { provide: getModelToken(WorkbookSignoff.name), useValue: { deleteMany: () => ({ exec: async () => ({ deletedCount: 0 }) }) } },
        { provide: ProjectsService, useValue: { resolveAccess: async () => ({ role: "editor" }) } },
        { provide: WorkbookRolesService, useValue: { resolveEffectiveRoles: async () => ["preparer"] } },
        { provide: DaDocumentsService, useValue: { removeAllForWorkbook: async () => undefined } },
      ],
    }).compile();
    return moduleRef.get(DaWorkbooksService);
  }

  it("links the DA mission estimates to the project SC workbook instead of the example", async () => {
    await (await service()).loadExample("da-1", { username: "ada" }, "htgr");

    const mef = saved.mef;
    if (mef === undefined) throw new Error("The DA example was not saved.");
    expect(exampleLinks(daMissionTimeExpressions(mef))).toEqual([]);
    expect(workbookIds(daMissionTimeExpressions(mef)).has(PROJECT_SC_HTGR)).toBe(true);
    expect(mef.linkedWorkbooks?.SC).toBe(PROJECT_SC_HTGR);
  });
});
