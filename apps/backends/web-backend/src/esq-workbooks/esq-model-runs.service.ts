import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import type { Model } from "mongoose";
import type { EsqModel, EsqTreeRecord, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { SuccessCriteriaDevelopmentSchema } from "interfaces-mef-types/zod/sc/success-criteria-development";
import { parameterReferenceKey, type UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import { esqSequenceRunId, esqTreeRunId, transferTreeIds, treesInScope } from "interfaces-mef-types/esq/esq-run-inputs";
import { esqCellRunId } from "interfaces-mef-types/esq/esq-barrier-inputs";
import { esqModelRunId, sequenceFamilyOf, solveInputsKey } from "interfaces-mef-types/esq/esq-solve-inputs";
import { esqPostRunId } from "interfaces-mef-types/esq/esq-post-inputs";
import { esqImportanceRunId, esqUncertaintyRunId, sampledInputsOf, uncertaintyInputsKey } from "interfaces-mef-types/esq/esq-measure-inputs";
import { applySensitivityCase, caseInputsKey, caseOf, esqSensitivityRunId } from "interfaces-mef-types/esq/esq-sensitivity-inputs";
import {
  EsqBarrierCellRunRequestSchema,
  EsqEventTreeRunRequestSchema,
  EsqImportanceRunRequestSchema,
  EsqImportanceRunResultSchema,
  EsqModelRunRequestSchema,
  EsqModelRunResultSchema,
  EsqPostRunRequestSchema,
  EsqPostRunResultSchema,
  EsqSensitivityRunRequestSchema,
  EsqUncertaintyRunRequestSchema,
  EsqUncertaintyRunResultSchema,
  EventTreeAnalysisResultSchema,
  LoadCapacityAnalysisResultSchema,
  type AnalysisRunMetadata,
  type EsqEventTreeRunLogic,
  type EsqImportanceRunResult,
  type EsqModelRunRequest,
  type EsqModelRunResult,
  type EsqPostRunResult,
  type EsqUncertaintyRunResult,
  type EventTreeCutSetSettings,
  type EventTreeAnalysisResult,
  type LoadCapacityAnalysisResult,
} from "interfaces-shared-types/newly-developed-methods";
import { ExampleWorkbooksService } from "../example-workbooks/example-workbooks.service";
import { SC_EXAMPLES, SY_EXAMPLES } from "../example-workbooks/seeds";
import { ProjectsService } from "../projects/projects.service";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { SyWorkbook, type SyWorkbookDocument } from "../sy-workbooks/sy-workbook.schema";
import { ScWorkbook, type ScWorkbookDocument } from "../sc-workbooks/sc-workbook.schema";
import { WorkbookModelAccessService } from "../workbooks/workbook-model-access.service";
import { UncertaintyService } from "../newly-developed-methods/shared/uncertainty.service";
import { assertExpectedWorkbookRevision, readWorkbookRevision } from "../workbooks/workbook-revision";
import {
  combineFaultTrees,
  WorkbookAnalysisRunsService,
  type ActingUser,
  type EsqPreparedTreeRun,
  type LoadedWorkbook,
} from "../newly-developed-methods/shared/workbook-analysis-runs.service";
import { EsqWorkbook, type EsqWorkbookDocument } from "./esq-workbook.schema";
import { normalizeEsqMef } from "./esq-mef-normalize";
import { buildEsqEventTreeRun, EsqRunBuildError, type EsqRunBuild } from "./esq-model-run-builder";
import { buildEsqCellRun, type EsqCellRunBuild } from "./esq-barrier-run-builder";
import { summarizeEsqModelRun } from "./esq-model-run-summary";
import { summarizeEsqPostRun, type EsqPostTreeInfo } from "./esq-post-run-summary";
import { caseOverridesFor, importanceGroupsFor, importanceSpecFor, sampledBuild, type EsqSampling, type EsqSamplingTally } from "./esq-measure-run-builder";
import { summarizeEsqImportanceRun, summarizeEsqUncertaintyRun } from "./esq-measure-run-summary";

function sequenceFamilies(esq: EventSequenceQuantification, model: EsqModel, rootId: string): Record<string, string> {
  const treeIds = transferTreeIds(model, rootId);
  const families: Record<string, string> = {};
  for (const record of model.sequences) {
    if (!treeIds.includes(record.treeId)) continue;
    const familyId = sequenceFamilyOf(esq, record);
    if (familyId !== undefined) families[esqSequenceRunId(record.treeId, record.id)] = familyId;
  }
  return families;
}

@Injectable()
export class EsqModelRunsService {
  constructor(
    @InjectModel(EsqWorkbook.name) private readonly esqWorkbookModel: Model<EsqWorkbookDocument>,
    @InjectModel(SyWorkbook.name) private readonly syWorkbookModel: Model<SyWorkbookDocument>,
    @InjectModel(ScWorkbook.name) private readonly scWorkbookModel: Model<ScWorkbookDocument>,
    private readonly exampleWorkbooksService: ExampleWorkbooksService,
    private readonly accessService: WorkbookModelAccessService,
    private readonly projectsService: ProjectsService,
    private readonly analysisRunsService: WorkbookAnalysisRunsService,
    private readonly uncertainty: UncertaintyService,
  ) {}

  private async loadEsq(workbookId: string): Promise<LoadedWorkbook<EventSequenceQuantification>> {
    const document = await this.esqWorkbookModel.findOne({ workbookId }).exec();
    if (!document) throw new NotFoundException("ESQ workbook not found");
    const parsed = EventSequenceQuantificationSchema.safeParse(normalizeEsqMef(document.mef));
    if (!parsed.success) throw new BadRequestException(`Stored ESQ workbook failed validation: ${parsed.error.message}`);
    return {
      hostType: "ESQ",
      workbookId,
      workbookRevision: readWorkbookRevision(document),
      projectId: document.projectId,
      ownerUsername: document.ownerUsername,
      mef: parsed.data,
      document,
    };
  }

  private async loadSy(workbookId: string, owner: LoadedWorkbook<EventSequenceQuantification>, acting: ActingUser): Promise<LoadedWorkbook<SystemsAnalysis>> {
    if (workbookId.startsWith("example-")) {
      const variant = workbookId.split("-").slice(2).join("-");
      const entry = SY_EXAMPLES.find((candidate) => candidate.id === variant);
      if (entry === undefined) throw new NotFoundException(`SY example ${variant} not found`);
      const example = await this.exampleWorkbooksService.findBySlug(entry.slug);
      const parsed = SystemsAnalysisSchema.safeParse(stripNulls(example.mef));
      if (!parsed.success) throw new BadRequestException(`The SY example failed validation: ${parsed.error.message}`);
      return {
        hostType: "SY",
        workbookId,
        workbookRevision: 1,
        projectId: owner.projectId,
        ownerUsername: owner.ownerUsername,
        mef: parsed.data,
        document: { revision: 1, mef: parsed.data },
      };
    }
    const document = await this.syWorkbookModel.findOne({ workbookId }).exec();
    if (!document) throw new NotFoundException("The linked SY workbook was not found. Relink SY in Step 01.");
    await this.projectsService.resolveAccess(document.projectId, acting);
    const parsed = SystemsAnalysisSchema.safeParse(stripNulls(document.mef));
    if (!parsed.success) throw new BadRequestException(`Stored SY workbook failed validation: ${parsed.error.message}`);
    return {
      hostType: "SY",
      workbookId,
      workbookRevision: readWorkbookRevision(document),
      projectId: document.projectId,
      ownerUsername: document.ownerUsername,
      mef: parsed.data,
      document,
    };
  }

  private async loadSc(workbookId: string, owner: LoadedWorkbook<EventSequenceQuantification>, acting: ActingUser): Promise<LoadedWorkbook<SuccessCriteriaDevelopment>> {
    if (workbookId.startsWith("example-")) {
      const variant = workbookId.split("-").slice(2).join("-");
      const entry = SC_EXAMPLES.find((candidate) => candidate.id === variant);
      if (entry === undefined) throw new NotFoundException(`SC example ${variant} not found`);
      const example = await this.exampleWorkbooksService.findBySlug(entry.slug);
      const parsed = SuccessCriteriaDevelopmentSchema.safeParse(stripNulls(example.mef));
      if (!parsed.success) throw new BadRequestException(`The SC example failed validation: ${parsed.error.message}`);
      return {
        hostType: "SC",
        workbookId,
        workbookRevision: 1,
        projectId: owner.projectId,
        ownerUsername: owner.ownerUsername,
        mef: parsed.data,
        document: { revision: 1, mef: parsed.data },
      };
    }
    const document = await this.scWorkbookModel.findOne({ workbookId }).exec();
    if (!document) throw new NotFoundException("The linked SC workbook was not found. Relink SC in Step 01.");
    await this.projectsService.resolveAccess(document.projectId, acting);
    const parsed = SuccessCriteriaDevelopmentSchema.safeParse(stripNulls(document.mef));
    if (!parsed.success) throw new BadRequestException(`Stored SC workbook failed validation: ${parsed.error.message}`);
    return {
      hostType: "SC",
      workbookId,
      workbookRevision: 1,
      projectId: document.projectId,
      ownerUsername: document.ownerUsername,
      mef: parsed.data,
      document: { mef: document.mef },
    };
  }

  private async loadMissionTimes(owner: LoadedWorkbook<EventSequenceQuantification>, acting: ActingUser): Promise<{ sources: LoadedWorkbook<SuccessCriteriaDevelopment>[]; missionTimes: Map<string, UncertainParameter> }> {
    const missionTimes = new Map<string, UncertainParameter>();
    const workbookId = owner.mef.linkedWorkbooks?.SC;
    if (workbookId === undefined) return { sources: [], missionTimes };
    const sc = await this.loadSc(workbookId, owner, acting);
    for (const entry of [...sc.mef.missionTimes, ...(sc.mef.componentMissionTimes ?? [])]) {
      const reference = { referenceType: "WORKBOOK_PARAMETER" as const, workbookId, entityId: entry.uuid };
      missionTimes.set(parameterReferenceKey(reference), { reference, expression: entry.missionTime });
    }
    return { sources: [sc], missionTimes };
  }

  async runEventTree(workbookId: string, treeId: string, body: object, acting: ActingUser): Promise<AnalysisRunMetadata> {
    const parsed = EsqEventTreeRunRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.message);
    const request = parsed.data;
    if (request.treeId !== treeId) throw new BadRequestException("Route tree id must match the request treeId");
    const owner = await this.loadEsq(workbookId);
    await this.accessService.requireExecution({ workbookId, projectId: owner.projectId, mef: owner.mef, acting });
    assertExpectedWorkbookRevision(owner.document, request.workbookRevision);
    const syLink = owner.mef.model?.sources.find((source) => source.element === "SY");
    if (syLink === undefined) throw new BadRequestException("The Step 02 import holds no SY workbook. Link SY in Step 01 and import the model.");
    const sy = await this.loadSy(syLink.workbookId, owner, acting);
    const sc = await this.loadMissionTimes(owner, acting);
    let build: EsqRunBuild;
    try {
      build = buildEsqEventTreeRun({
        esq: owner.mef,
        treeId,
        sy: sy.mef,
        syWorkbookId: sy.workbookId,
        syRevision: sy.workbookRevision,
        missionTimes: sc.missionTimes,
        esqWorkbookId: workbookId,
        esqRevision: owner.workbookRevision,
        logic: request.logic,
      });
    } catch (error) {
      if (error instanceof EsqRunBuildError) throw new BadRequestException(error.message);
      throw error;
    }
    const runId = randomUUID();
    const faultTrees = combineFaultTrees(runId, build.faultTrees, build.initiatorTables);
    return this.analysisRunsService.executePreparedEventTreeRun({
      runId,
      owner: { workbookId, modelId: build.rootModelId, workbookRevision: owner.workbookRevision },
      request,
      sources: [owner, sy, ...sc.sources],
      envelope: {
        schemaVersion: "1.0.0",
        request: {
          schemaVersion: request.schemaVersion,
          methodType: "EVENT_TREE",
          modelId: build.rootModelId,
          revision: owner.workbookRevision,
          mode: "INDEPENDENT",
          requestedBy: acting.username,
          expandCcf: request.logic.expandCcf,
        },
        modelSnapshots: [...build.eventTreeSnapshots, ...faultTrees.modelSnapshots],
        resources: { faultTreeBasicEventCatalogue: faultTrees.resource },
      },
      models: [
        ...[...build.eventTreeModelIds, ...build.splitFractionModelIds].map((modelId) => ({ workbookId, modelId })),
        ...build.syModelIds.map((modelId) => ({ workbookId: sy.workbookId, modelId })),
      ],
      acting,
    });
  }

  private async loadRunSources(workbookId: string, workbookRevision: number, acting: ActingUser) {
    const owner = await this.loadEsq(workbookId);
    await this.accessService.requireExecution({ workbookId, projectId: owner.projectId, mef: owner.mef, acting });
    assertExpectedWorkbookRevision(owner.document, workbookRevision);
    const model = owner.mef.model;
    if (model?.importedAt === undefined) throw new BadRequestException("Import the model in Step 02 before running.");
    const roots = treesInScope(owner.mef, model).filter((tree) => !tree.transferEntry);
    if (roots.length === 0) throw new BadRequestException("No event tree is in scope. Check the coverage in Step 01.");
    const syLink = model.sources.find((source) => source.element === "SY");
    if (syLink === undefined) throw new BadRequestException("The Step 02 import holds no SY workbook. Link SY in Step 01 and import the model.");
    const sy = await this.loadSy(syLink.workbookId, owner, acting);
    const sc = await this.loadMissionTimes(owner, acting);
    return { owner, model, roots, sy, sc };
  }

  private prepareTrees(input: {
    workbookId: string;
    owner: LoadedWorkbook<EventSequenceQuantification>;
    sy: LoadedWorkbook<SystemsAnalysis>;
    missionTimes: ReadonlyMap<string, UncertainParameter>;
    roots: readonly EsqTreeRecord[];
    schemaVersion: string;
    workbookRevision: number;
    logic: EsqEventTreeRunLogic;
    raisedHep?: number;
    failedEventIds?: readonly string[];
    esq?: EventSequenceQuantification;
    acting: ActingUser;
    extras: (build: EsqRunBuild, root: EsqTreeRecord) => Record<string, unknown>;
    transform?: (build: EsqRunBuild, root: EsqTreeRecord) => EsqRunBuild;
    eventCodes: Record<string, string>;
    builds: Map<string, EsqRunBuild>;
  }): EsqPreparedTreeRun[] {
    const { workbookId, owner, sy } = input;
    return input.roots.map((root): EsqPreparedTreeRun => {
      const runId = randomUUID();
      const treeOwner = { workbookId, modelId: esqTreeRunId(root.id), workbookRevision: owner.workbookRevision };
      const childRequest = { schemaVersion: input.schemaVersion, treeId: root.id, workbookRevision: input.workbookRevision, logic: { ...input.logic } };
      let built: EsqRunBuild;
      try {
        built = buildEsqEventTreeRun({
          esq: input.esq ?? owner.mef,
          treeId: root.id,
          sy: sy.mef,
          syWorkbookId: sy.workbookId,
          syRevision: sy.workbookRevision,
          missionTimes: input.missionTimes,
          esqWorkbookId: workbookId,
          esqRevision: owner.workbookRevision,
          logic: input.logic,
          ...(input.raisedHep === undefined ? {} : { raisedHep: input.raisedHep }),
          ...(input.failedEventIds === undefined || input.failedEventIds.length === 0 ? {} : { failedEventIds: input.failedEventIds }),
        });
      } catch (error) {
        if (!(error instanceof EsqRunBuildError)) throw error;
        return { treeId: root.id, runId, owner: treeOwner, request: childRequest, envelope: null, failure: error.message, models: [] };
      }
      const build = input.transform === undefined ? built : input.transform(built, root);
      input.builds.set(root.id, build);
      const faultTrees = combineFaultTrees(runId, build.faultTrees, build.initiatorTables);
      Object.assign(input.eventCodes, build.eventCodes);
      return {
        treeId: root.id,
        runId,
        owner: treeOwner,
        request: childRequest,
        envelope: {
          schemaVersion: "1.0.0",
          request: {
            schemaVersion: input.schemaVersion,
            methodType: "EVENT_TREE",
            modelId: build.rootModelId,
            revision: owner.workbookRevision,
            mode: "INDEPENDENT",
            requestedBy: input.acting.username,
            expandCcf: input.logic.expandCcf,
            ...input.extras(build, root),
          },
          modelSnapshots: [...build.eventTreeSnapshots, ...faultTrees.modelSnapshots],
          resources: { faultTreeBasicEventCatalogue: faultTrees.resource },
        },
        failure: null,
        models: [
          ...[...build.eventTreeModelIds, ...build.splitFractionModelIds].map((modelId) => ({ workbookId, modelId })),
          ...build.syModelIds.map((modelId) => ({ workbookId: sy.workbookId, modelId })),
        ],
      };
    });
  }

  async runModel(workbookId: string, body: object, acting: ActingUser): Promise<AnalysisRunMetadata> {
    const parsed = EsqModelRunRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.message);
    const request = parsed.data;
    const { owner, model, roots, sy, sc } = await this.loadRunSources(workbookId, request.workbookRevision, acting);
    const eventCodes: Record<string, string> = {};
    const cutSets = request.cutSets;
    const trees = this.prepareTrees({
      workbookId,
      owner,
      sy,
      missionTimes: sc.missionTimes,
      roots,
      schemaVersion: request.schemaVersion,
      workbookRevision: request.workbookRevision,
      logic: request.logic,
      acting,
      eventCodes,
      builds: new Map(),
      extras: (_build, root) => (cutSets === undefined ? {} : { cutSets: { ...cutSets, cutOffs: [...cutSets.cutOffs] }, sequenceFamilies: sequenceFamilies(owner.mef, model, root.id) }),
    });
    const modelOwner = { workbookId, modelId: esqModelRunId(), workbookRevision: owner.workbookRevision };
    const inputs = solveInputsKey(owner.mef);
    return this.analysisRunsService.executeEsqModelRun({
      owner: modelOwner,
      request,
      sources: [owner, sy, ...sc.sources],
      trees,
      summarize: (batchId, completedAt, outcomes) => summarizeEsqModelRun({
        esq: owner.mef,
        request,
        batchId,
        owner: modelOwner,
        completedAt,
        inputs,
        outcomes,
        eventCodes,
      }),
      acting,
    });
  }

  async runPost(workbookId: string, body: object, acting: ActingUser): Promise<AnalysisRunMetadata> {
    const parsed = EsqPostRunRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.message);
    const request = parsed.data;
    const { owner, roots, sy, sc } = await this.loadRunSources(workbookId, request.workbookRevision, acting);
    const combinations = request.purpose === "COMBINATIONS";
    const logic: EsqEventTreeRunLogic = combinations ? { ...request.logic, dependency: false } : { ...request.logic, exclusions: false, dependency: false };
    const exclusions = (owner.mef.logic?.exclusions ?? []).flatMap((exclusion) => {
      const events = [...new Set(exclusion.eventIds)];
      return events.length < 2 ? [] : [{ key: exclusion.id, events, minimum: events.length }];
    });
    if (!combinations && exclusions.length === 0) throw new BadRequestException("Step 03 holds no exclusion with two or more events to check.");
    const eventCodes: Record<string, string> = {};
    const builds = new Map<string, EsqRunBuild>();
    const trees = this.prepareTrees({
      workbookId,
      owner,
      sy,
      missionTimes: sc.missionTimes,
      roots,
      schemaVersion: request.schemaVersion,
      workbookRevision: request.workbookRevision,
      logic,
      ...(combinations && request.raisedHep !== undefined ? { raisedHep: request.raisedHep } : {}),
      acting,
      eventCodes,
      builds,
      extras: (build) => {
        const focus = combinations
          ? build.humanEventIds.length < 2 ? [] : [{ key: "HFE", events: [...build.humanEventIds], minimum: 2 }]
          : exclusions;
        const cutSets: EventTreeCutSetSettings = { basis: "FREQUENCY", cutOffs: [request.cutOff], quantifier: "RARE_EVENT", keep: 1, ...(focus.length === 0 ? {} : { focus }) };
        return { cutSets };
      },
    });
    const info = new Map<string, EsqPostTreeInfo>([...builds.entries()].map(([treeId, build]) => [treeId, { humanEventIds: build.humanEventIds, nominal: build.nominal }]));
    const postOwner = { workbookId, modelId: esqPostRunId(), workbookRevision: owner.workbookRevision };
    const inputs = solveInputsKey(owner.mef, { combinations: false });
    return this.analysisRunsService.executeEsqModelRun({
      owner: postOwner,
      request,
      sources: [owner, sy, ...sc.sources],
      trees,
      summarize: (batchId, completedAt, outcomes) => summarizeEsqPostRun({
        request,
        logic,
        batchId,
        owner: postOwner,
        completedAt,
        inputs,
        outcomes,
        trees: info,
        exclusionIds: exclusions.map((exclusion) => exclusion.key),
        eventCodes,
      }),
      acting,
    });
  }

  async runImportance(workbookId: string, body: object, acting: ActingUser): Promise<AnalysisRunMetadata> {
    const parsed = EsqImportanceRunRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.message);
    const request = parsed.data;
    const { owner, model, roots, sy, sc } = await this.loadRunSources(workbookId, request.workbookRevision, acting);
    const groups = importanceGroupsFor(owner.mef, request.logic);
    const eventCodes: Record<string, string> = {};
    const builds = new Map<string, EsqRunBuild>();
    const families = new Map<string, Record<string, string>>();
    const trees = this.prepareTrees({
      workbookId,
      owner,
      sy,
      missionTimes: sc.missionTimes,
      roots,
      schemaVersion: request.schemaVersion,
      workbookRevision: request.workbookRevision,
      logic: request.logic,
      acting,
      eventCodes,
      builds,
      extras: (build, root) => {
        const map = sequenceFamilies(owner.mef, model, root.id);
        families.set(root.id, map);
        return { importance: { groups: importanceSpecFor(groups, build) }, sequenceFamilies: map };
      },
    });
    const runOwner = { workbookId, modelId: esqImportanceRunId(), workbookRevision: owner.workbookRevision };
    const inputs = solveInputsKey(owner.mef);
    return this.analysisRunsService.executeEsqModelRun({
      owner: runOwner,
      request,
      sources: [owner, sy, ...sc.sources],
      trees,
      summarize: (batchId, completedAt, outcomes) => summarizeEsqImportanceRun({
        esq: owner.mef,
        logic: request.logic,
        batchId,
        owner: runOwner,
        completedAt,
        inputs,
        outcomes,
        families,
        builds,
        groups,
        eventCodes,
      }),
      acting,
    });
  }

  async runUncertainty(workbookId: string, body: object, acting: ActingUser): Promise<AnalysisRunMetadata> {
    const parsed = EsqUncertaintyRunRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.message);
    const request = parsed.data;
    const { owner, model, roots, sy, sc } = await this.loadRunSources(workbookId, request.workbookRevision, acting);
    const inputs = new Map(sampledInputsOf(owner.mef).map((input) => [input.key, input]));
    const tally: EsqSamplingTally = { used: new Map(), unsampled: new Map() };
    const families = new Map<string, Record<string, string>>();
    const samplings = new Map<string, EsqSampling>();
    const settings = { trials: request.trials, seed: request.seed, method: request.method, correlation: request.correlation };
    const trees = this.prepareTrees({
      workbookId,
      owner,
      sy,
      missionTimes: sc.missionTimes,
      roots,
      schemaVersion: request.schemaVersion,
      workbookRevision: request.workbookRevision,
      logic: request.logic,
      acting,
      eventCodes: {},
      builds: new Map(),
      transform: (build, root) => {
        const sampled = sampledBuild({ esq: owner.mef, build, root, logic: request.logic, settings, inputs, tally, esqWorkbookId: workbookId });
        samplings.set(root.id, sampled.sampling);
        return sampled.build;
      },
      extras: (_build, root) => {
        const map = sequenceFamilies(owner.mef, model, root.id);
        families.set(root.id, map);
        return { sampling: samplings.get(root.id), sequenceFamilies: map };
      },
    });
    const runOwner = { workbookId, modelId: esqUncertaintyRunId(), workbookRevision: owner.workbookRevision };
    const key = uncertaintyInputsKey(owner.mef);
    return this.analysisRunsService.executeEsqModelRun({
      owner: runOwner,
      request,
      sources: [owner, sy, ...sc.sources],
      trees,
      stored: (result) => (result.sampling === undefined ? result : { ...result, sampling: { ...result.sampling, families: result.sampling.families.map((family) => ({ familyId: family.familyId, values: [] })) } }),
      summarize: (batchId, completedAt, outcomes) => summarizeEsqUncertaintyRun({
        esq: owner.mef,
        logic: request.logic,
        batchId,
        owner: runOwner,
        completedAt,
        inputs: key,
        outcomes,
        families,
        trials: request.trials,
        seed: request.seed,
        method: request.method,
        correlation: request.correlation,
        keys: [...tally.used.entries()].flatMap(([entry, use]) => (use.input.expression === undefined ? [] : [{ key: entry, label: use.input.label, source: use.input.source ?? "TYPED", expression: use.input.expression, unit: use.input.unit, events: use.events.size }])),
        unsampled: [...tally.unsampled.values()],
      }),
      acting,
    });
  }

  async runSensitivity(workbookId: string, caseId: string, body: object, acting: ActingUser): Promise<AnalysisRunMetadata> {
    const parsed = EsqSensitivityRunRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.message);
    const request = parsed.data;
    if (request.caseId !== caseId) throw new BadRequestException("Route case id must match the request caseId");
    const { owner, model, roots, sy, sc } = await this.loadRunSources(workbookId, request.workbookRevision, acting);
    const entry = caseOf(owner.mef, caseId);
    if (entry === undefined) throw new NotFoundException(`Step 09 holds no case ${caseId}.`);
    const applied = applySensitivityCase(owner.mef, entry);
    if (applied.problem !== undefined) throw new BadRequestException(`${entry.name}: ${applied.problem}`);
    const logic: EsqEventTreeRunLogic = { ...request.logic, ...applied.logic };
    const cutSets = request.cutSets;
    const overrides = applied.overrides.events.length === 0 && applied.overrides.ccfGroups.length === 0 ? undefined : applied.overrides;
    const eventCodes: Record<string, string> = {};
    const trees = this.prepareTrees({
      workbookId,
      owner,
      sy,
      missionTimes: sc.missionTimes,
      roots,
      schemaVersion: request.schemaVersion,
      workbookRevision: request.workbookRevision,
      logic,
      failedEventIds: applied.failedEvents,
      esq: applied.esq,
      acting,
      eventCodes,
      builds: new Map(),
      extras: (build, root) => {
        const present = caseOverridesFor(overrides, build);
        return {
          ...(present === undefined ? {} : { overrides: present }),
          ...(cutSets === undefined ? {} : { cutSets: { ...cutSets, cutOffs: [...cutSets.cutOffs] }, sequenceFamilies: sequenceFamilies(applied.esq, model, root.id) }),
        };
      },
    });
    const runOwner = { workbookId, modelId: esqSensitivityRunId(caseId), workbookRevision: owner.workbookRevision };
    const inputs = caseInputsKey(owner.mef, caseId);
    const modelRequest: EsqModelRunRequest = {
      schemaVersion: request.schemaVersion,
      workbookRevision: request.workbookRevision,
      logic,
      calculation: request.calculation,
      ...(cutSets === undefined ? {} : { cutSets }),
    };
    return this.analysisRunsService.executeEsqModelRun({
      owner: runOwner,
      request,
      sources: [owner, sy, ...sc.sources],
      trees,
      summarize: (batchId, completedAt, outcomes) => ({
        ...summarizeEsqModelRun({ esq: applied.esq, request: modelRequest, batchId, owner: runOwner, completedAt, inputs, outcomes, eventCodes }),
        caseId,
      }),
      acting,
    });
  }

  async getImportanceResult(workbookId: string, runId: string, acting: ActingUser): Promise<EsqImportanceRunResult> {
    return EsqImportanceRunResultSchema.parse(await this.analysisRunsService.getResult("ESQ", workbookId, esqImportanceRunId(), runId, acting));
  }

  async getUncertaintyResult(workbookId: string, runId: string, acting: ActingUser): Promise<EsqUncertaintyRunResult> {
    return EsqUncertaintyRunResultSchema.parse(await this.analysisRunsService.getResult("ESQ", workbookId, esqUncertaintyRunId(), runId, acting));
  }

  async getSensitivityResult(workbookId: string, caseId: string, runId: string, acting: ActingUser): Promise<EsqModelRunResult> {
    return EsqModelRunResultSchema.parse(await this.analysisRunsService.getResult("ESQ", workbookId, esqSensitivityRunId(caseId), runId, acting));
  }

  async getPostResult(workbookId: string, runId: string, acting: ActingUser): Promise<EsqPostRunResult> {
    return EsqPostRunResultSchema.parse(await this.analysisRunsService.getResult("ESQ", workbookId, esqPostRunId(), runId, acting));
  }

  async getModelResult(workbookId: string, runId: string, acting: ActingUser): Promise<EsqModelRunResult> {
    return EsqModelRunResultSchema.parse(await this.analysisRunsService.getResult("ESQ", workbookId, esqModelRunId(), runId, acting));
  }

  async getEventTreeResult(workbookId: string, treeId: string, runId: string, acting: ActingUser): Promise<EventTreeAnalysisResult> {
    return EventTreeAnalysisResultSchema.parse(await this.analysisRunsService.getResult("ESQ", workbookId, esqTreeRunId(treeId), runId, acting));
  }

  async runBarrierCell(workbookId: string, cellId: string, body: object, acting: ActingUser): Promise<AnalysisRunMetadata> {
    const parsed = EsqBarrierCellRunRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.message);
    const request = parsed.data;
    if (request.cellId !== cellId) throw new BadRequestException("Route cell id must match the request cellId");
    const owner = await this.loadEsq(workbookId);
    await this.accessService.requireExecution({ workbookId, projectId: owner.projectId, mef: owner.mef, acting });
    assertExpectedWorkbookRevision(owner.document, request.workbookRevision);
    let build: EsqCellRunBuild;
    try {
      build = await buildEsqCellRun({ esq: owner.mef, cellId, esqRevision: owner.workbookRevision }, (fit) => this.uncertainty.evaluate(fit));
    } catch (error) {
      if (error instanceof EsqRunBuildError) throw new BadRequestException(error.message);
      throw error;
    }
    return this.analysisRunsService.executePreparedLoadCapacityRun({
      runId: randomUUID(),
      owner: { workbookId, modelId: build.modelId, workbookRevision: owner.workbookRevision },
      request,
      sources: [owner],
      envelope: {
        schemaVersion: "1.0.0",
        request: {
          schemaVersion: request.schemaVersion,
          methodType: "LOAD_CAPACITY",
          modelId: build.modelId,
          revision: owner.workbookRevision,
          requestedBy: acting.username,
          settings: { ...request.settings },
        },
        modelSnapshots: [build.snapshot],
        resources: {},
      },
      acting,
    });
  }

  async getBarrierCellResult(workbookId: string, cellId: string, runId: string, acting: ActingUser): Promise<LoadCapacityAnalysisResult> {
    return LoadCapacityAnalysisResultSchema.parse(await this.analysisRunsService.getResult("ESQ", workbookId, esqCellRunId(cellId), runId, acting));
  }
}
