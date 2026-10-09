import { Logger, type Provider } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { execute } from "praxis-node";
import { expressionReferences, type UncertainExpression, type UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import { FrequencyUnit } from "interfaces-mef-types/core/events";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { EsqModel, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { carriesUncertainExpression, type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { UncertaintyResponseSchema, type UncertaintyRequest, type UncertaintyResponse } from "interfaces-shared-types/newly-developed-methods/shared";
import { DaWorkbook } from "../../da-workbooks/da-workbook.schema";
import { EsqDocumentsService } from "../../esq-workbooks/esq-documents.service";
import { EsqWorkbook } from "../../esq-workbooks/esq-workbook.schema";
import { EsqWorkbooksService } from "../../esq-workbooks/esq-workbooks.service";
import { WorkbookDependencyDiscoveryService } from "../../newly-developed-methods/shared/workbook-dependency-discovery.service";
import { ProjectsService } from "../../projects/projects.service";
import { ScWorkbook } from "../../sc-workbooks/sc-workbook.schema";
import { SyDocumentsService } from "../../sy-workbooks/sy-documents.service";
import { SyWorkbook } from "../../sy-workbooks/sy-workbook.schema";
import { SyWorkbooksService } from "../../sy-workbooks/sy-workbooks.service";
import { WorkbookModelAccessService } from "../../workbooks/workbook-model-access.service";
import { WorkbookRolesService } from "../../workbooks/workbook-roles.service";
import { WorkbookSignoff } from "../../workbooks/workbook-signoff.schema";
import { ExampleWorkbook } from "../example-workbook.schema";
import { ExampleWorkbooksService } from "../example-workbooks.service";
import {
  daMissionTimeExpressions,
  reconcileExampleDaMissionTimeReferences,
  relinkExampleMissionTimes,
  syDataAnalysisLinks,
  syMissionTimeExpressions,
} from "../seeds/dependency-model-seed";
import { DA_ANALYSIS } from "../seeds/da-seed";
import { DA_ANALYSIS_HTGR } from "../seeds/da-seed-htgr";
import { ESQ_ANALYSIS_HTGR } from "../seeds/esq-seed-htgr";
import { SC_ANALYSIS_HTGR } from "../seeds/sc-seed-htgr";
import { SY_ANALYSIS_HTGR } from "../seeds/sy-seed-htgr";

interface NativeAnswer {
  result?: Record<string, number | string | boolean | object | null>;
  error?: { message: string };
}

interface StoredWorkbook {
  workbookId: string;
  mef: object;
}

interface Saved {
  mef?: object;
}

const PROJECT_ID = "project-1";
const PROJECT_SC = "sc-project-htgr";
const PROJECT_DA = "da-project-htgr";
const PROJECT_DA_SFR = "da-project-sfr";
const PROJECT_SY = "sy-project-htgr";
const EXAMPLE_DA = "example-da-htgr";
const EXAMPLE_SY = "example-sy-htgr";
const NOW = new Date("2026-10-09T00:00:00Z");

const PROJECT_DA_MEF: DataAnalysis = relinkExampleMissionTimes(
  DA_ANALYSIS_HTGR,
  daMissionTimeExpressions(DA_ANALYSIS_HTGR),
  [{ sc: SC_ANALYSIS_HTGR, workbookId: PROJECT_SC }],
  reconcileExampleDaMissionTimeReferences,
);

function daLink(entityId: string): UncertainExpression {
  return { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: EXAMPLE_DA, entityId } };
}

function workbookIds(expressions: readonly UncertainExpression[]): string[] {
  return [...new Set(expressions.flatMap(expressionReferences).map((reference) => reference.workbookId))].sort();
}

function daLinkWorkbooks(analysis: SystemsAnalysis): string[] {
  return [...new Set(syDataAnalysisLinks(analysis).map((link) => link.workbookId).filter((id) => id !== PROJECT_SC))];
}

function exampleStrings(mef: object): string[] {
  return [...new Set(JSON.stringify(mef).split("\"").filter((part) => part.startsWith("example-da-") || part.startsWith("example-sy-")))];
}

function syExpressions(analysis: SystemsAnalysis): UncertainExpression[] {
  return [
    ...analysis.systemBasicEvents.flatMap((event) => (event.expression === undefined ? [] : [event.expression])),
    ...analysis.commonCauseFailureGroups.map((group) => group.total),
  ];
}

function syExample(): SystemsAnalysis {
  const example = structuredClone(SY_ANALYSIS_HTGR);
  const [first, ...rest] = example.commonCauseFailureGroups;
  if (first === undefined || first.factors.model !== "ALPHA_FACTOR" || first.dataAnalysisCCFParameterRef === undefined) {
    throw new Error("The SY example has no alpha-factor group to link.");
  }
  const alphas: UncertainExpression = daLink(first.dataAnalysisCCFParameterRef);
  if (alphas.node !== "PARAMETER") throw new Error("Expected a parameter link.");
  return {
    ...example,
    commonCauseFailureGroups: [{ ...first, factors: { ...first.factors, alphas } }, ...rest],
  };
}

function exampleDocument(slug: string, kind: string, mef: object): object {
  return { slug, kind, mef, updatedAt: NOW };
}

function listOf(documents: readonly StoredWorkbook[]): { find: () => { sort: () => { exec: () => Promise<readonly StoredWorkbook[]> } } } {
  return { find: () => ({ sort: () => ({ exec: async () => documents }) }) };
}

function savingModel(saved: Saved, document: object): object {
  return {
    findOne: () => ({ exec: async () => document }),
    findOneAndUpdate: (_filter: object, change: { $set: { mef: object } }) => ({
      exec: async () => {
        saved.mef = change.$set.mef;
        return { ...document, ...change.$set };
      },
    }),
  };
}

function sharedProviders(example: object, daDocuments: readonly StoredWorkbook[]): Provider[] {
  return [
    ExampleWorkbooksService,
    { provide: getModelToken(ExampleWorkbook.name), useValue: { findOne: () => ({ exec: async () => example }), find: () => ({ sort: () => ({ exec: async () => [] }) }) } },
    { provide: getModelToken(ScWorkbook.name), useValue: listOf([{ workbookId: PROJECT_SC, mef: SC_ANALYSIS_HTGR }]) },
    { provide: getModelToken(DaWorkbook.name), useValue: listOf(daDocuments) },
    { provide: getModelToken(WorkbookSignoff.name), useValue: { deleteMany: () => ({ exec: async () => ({ deletedCount: 0 }) }) } },
    { provide: ProjectsService, useValue: { resolveAccess: async () => ({ role: "editor" }) } },
    { provide: WorkbookRolesService, useValue: { resolveEffectiveRoles: async () => ["preparer"] } },
    { provide: WorkbookModelAccessService, useValue: {} },
    { provide: WorkbookDependencyDiscoveryService, useValue: {} },
  ];
}

async function loadSy(daDocuments: readonly StoredWorkbook[]): Promise<SystemsAnalysis> {
  const saved: Saved = {};
  const document = { workbookId: "sy-1", projectId: PROJECT_ID, ownerUsername: "ada", revision: 1, mef: { workflowState: "DRAFT" }, previousMefJson: null, updatedAt: NOW };
  const moduleRef = await Test.createTestingModule({
    providers: [
      SyWorkbooksService,
      ...sharedProviders(exampleDocument("sy-generic-2", "SY", syExample()), daDocuments),
      { provide: getModelToken(SyWorkbook.name), useValue: { ...savingModel(saved, document), ...listOf([]) } },
      { provide: SyDocumentsService, useValue: { removeAllForWorkbook: async () => undefined } },
    ],
  }).compile();
  await moduleRef.get(SyWorkbooksService).loadExample("sy-1", { username: "ada" }, "htgr");
  if (saved.mef === undefined) throw new Error("The SY example was not saved.");
  return SystemsAnalysisSchema.parse(saved.mef);
}

function esqExample(): EventSequenceQuantification {
  const example = structuredClone(ESQ_ANALYSIS_HTGR);
  const rps = SY_ANALYSIS_HTGR.systemLogicModels.find((model) => model.systemReference === "SYS-RPS");
  const division = SY_ANALYSIS_HTGR.systemBasicEvents.find((event) => event.code === "RPS-DVA-FS");
  const circulator = DA_ANALYSIS_HTGR.parameters.find((parameter) => parameter.uuid === "DA-BE-205");
  if (rps === undefined || rps.topGate === null || division === undefined || circulator?.estimate === undefined) {
    throw new Error("The examples lack the protection tree or the circulator estimate.");
  }
  const top = { workbookId: EXAMPLE_SY, modelId: rps.uuid, gateId: rps.topGate.gateId };
  const model: EsqModel = {
    importedAt: NOW.toISOString(),
    sources: [
      { element: "DA", workbookId: EXAMPLE_DA, workbookName: "Example DA" },
      { element: "SY", workbookId: EXAMPLE_SY, workbookName: "Example SY" },
    ],
    trees: [],
    sequences: [],
    families: [],
    functions: [{ id: "FN-RPS", name: "Reactor trip", treeIds: [], esLinks: [{ treeId: "ET-1", top }] }],
    tops: [{ modelId: rps.uuid, gateId: rps.topGate.gateId, code: "RPS", name: "Reactor protection", eventIds: [division.uuid], transferModelIds: [] }],
    initiators: [{ id: "IEG-03", name: "Loss of offsite power", stateIds: [], frequency: { expression: daLink("DA-IE-03"), basis: FrequencyUnit.PER_REACTOR_YEAR }, heldBy: "DA", holderId: "DA-IE-03" }],
    states: [],
    events: [{ id: division.uuid, code: division.code, name: division.name, expression: daLink("DA-BE-201"), heldBy: "DA", holderId: "DA-BE-201" }],
    ccfGroups: [{
      id: "CCF-RPS-DIV",
      name: "RPS trip divisions",
      systemIds: ["SYS-RPS"],
      memberIds: [division.uuid],
      factors: { model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: EXAMPLE_DA, entityId: "DA-CCF-04" } } },
      total: daLink("DA-BE-201"),
      estimateRef: "DA-CCF-04",
    }],
    parameters: [{ id: circulator.uuid, name: circulator.name, parameterType: circulator.parameterType, quantificationModel: "MISSION_PROBABILITY", estimate: circulator.estimate }],
    humanEvents: [],
  };
  return {
    ...example,
    model,
    modelDecisions: {
      ...example.modelDecisions,
      initiatorChoices: [{ groupId: "IEG-03", source: "DA", parameterId: "DA-IE-03", expression: daLink("DA-IE-03") }],
      functionLinks: [{ functionId: "FN-RPS", target: { kind: "FAULT_TREE", top } }],
    },
    barrierWork: {
      ...example.barrierWork,
      cells: [
        ...(example.barrierWork?.cells ?? []),
        { id: "BC-DA", barrierId: "Containment", modeId: "FM-5", mechanismIds: [], variable: "Damper closure", unit: "probability", basis: "REALISTIC", load: { source: "DA", parameterId: "DA-BE-201", basis: "Taken from DA." }, use: "SPLIT_FRACTION" },
      ],
    },
  };
}

async function loadEsq(): Promise<EventSequenceQuantification> {
  const saved: Saved = {};
  const document = { workbookId: "esq-1", projectId: PROJECT_ID, ownerUsername: "ada", revision: 1, mef: { workflowState: "DRAFT" }, previousMefJson: null, updatedAt: NOW };
  const projectSy = { workbookId: PROJECT_SY, projectId: PROJECT_ID, mef: SY_ANALYSIS_HTGR };
  const moduleRef = await Test.createTestingModule({
    providers: [
      EsqWorkbooksService,
      ...sharedProviders(exampleDocument("esq-generic-2", "ESQ", esqExample()), [{ workbookId: PROJECT_DA, mef: PROJECT_DA_MEF }]),
      { provide: getModelToken(EsqWorkbook.name), useValue: savingModel(saved, document) },
      { provide: getModelToken(SyWorkbook.name), useValue: { findOne: () => ({ exec: async () => projectSy }), ...listOf([projectSy]) } },
      { provide: EsqDocumentsService, useValue: { removeAllForWorkbook: async () => undefined } },
    ],
  }).compile();
  await moduleRef.get(EsqWorkbooksService).loadExample("esq-1", { username: "ada" }, "htgr");
  if (saved.mef === undefined) throw new Error("The ESQ example was not saved.");
  return EventSequenceQuantificationSchema.parse(saved.mef);
}

function evaluate(request: UncertaintyRequest): UncertaintyResponse {
  const answer: NativeAnswer = JSON.parse(execute(JSON.stringify({ schemaVersion: "1.0.0", request: { schemaVersion: "1.0.0", methodType: "UNCERTAINTY", ...request }, modelSnapshots: [] })));
  if (answer.error !== undefined) throw new Error(answer.error.message);
  const result = { ...(answer.result ?? {}) };
  delete result["methodType"];
  return UncertaintyResponseSchema.parse(result);
}

function projectTable(da: DataAnalysis, sc: SuccessCriteriaDevelopment): UncertainParameter[] {
  return [
    ...da.parameters.flatMap((parameter) => (parameter.estimate === undefined ? [] : [{
      reference: { referenceType: "WORKBOOK_PARAMETER" as const, workbookId: PROJECT_DA, entityId: parameter.uuid },
      expression: parameter.estimate,
    }])),
    ...[...sc.missionTimes, ...(sc.componentMissionTimes ?? [])].map((record) => ({
      reference: { referenceType: "WORKBOOK_PARAMETER" as const, workbookId: PROJECT_SC, entityId: record.uuid },
      expression: record.missionTime,
    })),
  ];
}

describe("example DA links in a project", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("moves every SY link to the project DA workbook that holds all the linked values", async () => {
    const sy = await loadSy([
      { workbookId: PROJECT_DA_SFR, mef: DA_ANALYSIS },
      { workbookId: "da-broken", mef: { name: "Broken" } },
      { workbookId: PROJECT_DA, mef: PROJECT_DA_MEF },
    ]);

    const [first] = sy.commonCauseFailureGroups;
    expect(syDataAnalysisLinks(syExample()).length).toBeGreaterThan(60);
    expect(daLinkWorkbooks(sy)).toEqual([PROJECT_DA]);
    expect(workbookIds(syExpressions(sy))).toEqual([PROJECT_DA]);
    expect(first?.factors.model === "ALPHA_FACTOR" ? first.factors.alphas : undefined).toEqual({
      node: "PARAMETER",
      reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: PROJECT_DA, entityId: first?.dataAnalysisCCFParameterRef },
    });
    expect(sy.linkedWorkbooks?.DA).toBe(PROJECT_DA);
    expect(workbookIds(syMissionTimeExpressions(sy)).filter((id) => id.startsWith("example-"))).toEqual([]);
    expect(exampleStrings(sy)).toEqual([]);
    expect(warn).toHaveBeenCalledWith("DA workbook da-broken failed validation, so example DA links stay on the example.");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("keeps the SY links on the example when the project DA misses one linked value", async () => {
    const missing = { ...PROJECT_DA_MEF, parameters: PROJECT_DA_MEF.parameters.filter((parameter) => parameter.uuid !== "DA-BE-201") };
    const sy = await loadSy([{ workbookId: PROJECT_DA, mef: missing }]);

    expect(daLinkWorkbooks(sy)).toEqual([EXAMPLE_DA]);
    expect(workbookIds(syExpressions(sy))).toEqual([EXAMPLE_DA]);
    expect(sy.linkedWorkbooks?.DA).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`SY links to ${EXAMPLE_DA} stay on the example because no project DA workbook holds all`));
  });

  it("moves the ESQ links to the project DA and SY workbooks", async () => {
    const esq = await loadEsq();
    const model = esq.model;
    const [ccf] = model?.ccfGroups ?? [];
    const [choice] = esq.modelDecisions?.initiatorChoices ?? [];
    const [link] = esq.modelDecisions?.functionLinks ?? [];

    expect(esq.linkedWorkbooks?.DA).toBe(PROJECT_DA);
    expect(esq.linkedWorkbooks?.SY).toBe(PROJECT_SY);
    expect(model?.sources.map((source) => source.workbookId)).toEqual([PROJECT_DA, PROJECT_SY]);
    expect(workbookIds([
      ...(model?.events ?? []).flatMap((event) => (event.expression === undefined ? [] : [event.expression])),
      ...(model?.initiators ?? []).flatMap((initiator) => (initiator.frequency === undefined ? [] : [initiator.frequency.expression])),
      ...(ccf?.total === undefined ? [] : [ccf.total]),
      ...(choice?.expression === undefined ? [] : [choice.expression]),
      ...esq.uncertaintyPropagation.parameterUncertainties.flatMap((entry) => (entry.estimate === undefined ? [] : [entry.estimate])),
    ])).toEqual([PROJECT_DA]);
    expect(ccf?.factors?.model === "ALPHA_FACTOR" && ccf.factors.alphas.node === "PARAMETER" ? ccf.factors.alphas.reference.workbookId : undefined).toBe(PROJECT_DA);
    expect((esq.modelUncertaintySourceAssessments ?? []).flatMap((entry) => entry.dataAnalysisSourceRef?.workbookId ?? [])).toEqual(Array(6).fill(PROJECT_DA));
    expect((esq.sensitivityStudies ?? []).flatMap((entry) => entry.dataAnalysisCaseRef?.workbookId ?? [])).toEqual(Array(6).fill(PROJECT_DA));
    expect(model?.functions.flatMap((record) => record.esLinks.map((entry) => entry.top.workbookId))).toEqual([PROJECT_SY]);
    expect(link?.target?.kind === "FAULT_TREE" ? link.target.top.workbookId : undefined).toBe(PROJECT_SY);
    expect(esq.hclConfigurations.flatMap((configuration) => configuration.faultTrees.map((faultTree) => faultTree.workbookId))).toEqual([PROJECT_SY]);
    expect(exampleStrings(esq)).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("evaluates every relinked SY event in PRAXIS to the point of its project DA parameter", async () => {
    const sy = await loadSy([{ workbookId: PROJECT_DA, mef: PROJECT_DA_MEF }]);
    const estimates = new Map(PROJECT_DA_MEF.parameters.flatMap((parameter) => (parameter.estimate === undefined ? [] : [[parameter.uuid, parameter.estimate] as const])));
    const events = sy.systemBasicEvents.flatMap((event) => {
      const expression = event.expression;
      if (!carriesUncertainExpression(event.failureMode) || expression?.node !== "PARAMETER") return [];
      const estimate = estimates.get(expression.reference.entityId);
      return estimate === undefined ? [] : [{ id: event.uuid, expression, estimate }];
    });
    const response = evaluate({
      parameters: projectTable(PROJECT_DA_MEF, SC_ANALYSIS_HTGR),
      laws: [],
      operations: [],
      expressions: events.flatMap((event) => [
        { id: `sy:${event.id}`, expression: event.expression, unit: "PROBABILITY" as const, probabilities: [] },
        { id: `da:${event.id}`, expression: event.estimate, unit: "PROBABILITY" as const, probabilities: [] },
      ]),
    });
    const points = new Map(response.expressions.flatMap((answer) => ("point" in answer ? [[answer.id, answer.point] as const] : [])));

    expect(events.length).toBeGreaterThan(40);
    expect(events.every((event) => event.expression.reference.workbookId === PROJECT_DA)).toBe(true);
    expect(response.expressions.filter((answer) => !("point" in answer))).toEqual([]);
    for (const event of events) {
      const point = points.get(`sy:${event.id}`);
      expect(point).toBeGreaterThan(0);
      expect(point).toBe(points.get(`da:${event.id}`));
    }
  });
});
