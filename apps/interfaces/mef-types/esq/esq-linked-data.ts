import type {
  EsqModel,
  EsqModelDecisions,
  EsqModelElement,
  EsqModuleCount,
  EsqQuantificationPlan,
  EsqReportingFloor,
  EsqTreeMissionTime,
  EventSequenceQuantification,
} from "./event-sequence-quantification";
import type { InitiatingEventsAnalysis } from "../ie/initiating-event-analysis";
import type { RiskIntegration } from "../ri/risk-integration";
import { esqLinkOf, esqLiveModel, type EsqModelSources } from "./esq-model-import";

type EsqLinkedRi = Pick<RiskIntegration, "reportingThresholds">;

interface EsqLinkedSources extends EsqModelSources {
  ri?: EsqLinkedRi;
}

const EDITABLE_STATES: ReadonlySet<string> = new Set(["DRAFT", "REVISION_REQUIRED"]);

function modelSourcesOf(sources: EsqLinkedSources): EsqModelSources {
  const { ri: _ri, ...rest } = sources;
  return rest;
}

function esqIeModules(ie: Pick<InitiatingEventsAnalysis, "metadata"> | undefined): number | undefined {
  const modules = ie?.metadata.plantIdentity?.numberOfModules;
  return typeof modules === "number" && Number.isInteger(modules) && modules >= 1 ? modules : undefined;
}

function esqRiFloor(ri: EsqLinkedRi | undefined, modules: number | undefined): number | undefined {
  const perPlantYear = ri?.reportingThresholds.minimumReportingFrequencyPerPlantYear;
  if (perPlantYear === undefined || !(perPlantYear > 0)) return undefined;
  return perPlantYear / Math.max(1, modules ?? 1);
}

function moduleCountView(saved: EsqModuleCount | undefined, esq: EventSequenceQuantification, sources: EsqLinkedSources): EsqModuleCount | undefined {
  const workbookId = esqLinkOf(esq, "IE");
  if (saved !== undefined && saved.link === undefined) return saved;
  const modules = workbookId === undefined ? undefined : esqIeModules(sources.ie);
  if (workbookId === undefined || modules === undefined) return saved?.link === undefined ? saved : undefined;
  return { value: modules, link: { element: "IE", workbookId, field: "numberOfModules" } };
}

function floorView(saved: EsqReportingFloor | undefined, esq: EventSequenceQuantification, sources: EsqLinkedSources, modules: number | undefined): EsqReportingFloor | undefined {
  const workbookId = esqLinkOf(esq, "RI");
  if (saved !== undefined && saved.link === undefined) return saved;
  const floor = workbookId === undefined ? undefined : esqRiFloor(sources.ri, modules);
  if (workbookId === undefined || floor === undefined) return saved?.link === undefined ? saved : undefined;
  return { value: floor, link: { element: "RI", workbookId, field: "minimumReportingFrequencyPerPlantYear" } };
}

function planView(esq: EventSequenceQuantification, sources: EsqLinkedSources): EsqQuantificationPlan | undefined {
  const plan = esq.quantificationPlan ?? {};
  const { modulesPerPlant: _modules, reportingFloorPerYear: _floor, ...rest } = plan;
  const modules = moduleCountView(plan.modulesPerPlant, esq, sources);
  const floor = floorView(plan.reportingFloorPerYear, esq, sources, modules?.value);
  const next: EsqQuantificationPlan = { ...rest, ...(modules === undefined ? {} : { modulesPerPlant: modules }), ...(floor === undefined ? {} : { reportingFloorPerYear: floor }) };
  return esq.quantificationPlan === undefined && Object.keys(next).length === 0 ? undefined : next;
}

function planSaved(plan: EsqQuantificationPlan | undefined): EsqQuantificationPlan | undefined {
  if (plan === undefined) return undefined;
  const { modulesPerPlant, reportingFloorPerYear, ...rest } = plan;
  return {
    ...rest,
    ...(modulesPerPlant === undefined || modulesPerPlant.link !== undefined ? {} : { modulesPerPlant }),
    ...(reportingFloorPerYear === undefined || reportingFloorPerYear.link !== undefined ? {} : { reportingFloorPerYear }),
  };
}

function esqHoldsSavedCopies(esq: EventSequenceQuantification): boolean {
  const plan = esq.quantificationPlan;
  return esq.model !== undefined || plan?.modulesPerPlant?.link !== undefined || plan?.reportingFloorPerYear?.link !== undefined;
}

function esqShowsSavedCopies(esq: EventSequenceQuantification): boolean {
  return !EDITABLE_STATES.has(esq.workflowState ?? "DRAFT") && esqHoldsSavedCopies(esq);
}

function esqWithLinkedData(saved: EventSequenceQuantification, sources: EsqLinkedSources, nameOf: (element: EsqModelElement, workbookId: string) => string): EventSequenceQuantification {
  if (esqShowsSavedCopies(saved)) return saved;
  const { model: _copy, quantificationPlan: _plan, ...rest } = saved;
  const model = esqLiveModel(saved, modelSourcesOf(sources), nameOf);
  const plan = planView(saved, sources);
  return { ...rest, ...(plan === undefined ? {} : { quantificationPlan: plan }), ...(model === undefined ? {} : { model }) };
}

function missionTimesSaved(model: EsqModel | undefined, decisions: EsqModelDecisions): EsqTreeMissionTime[] {
  const held = decisions.treeMissionTimes ?? [];
  if (model === undefined) return held;
  const shown = model.trees.flatMap((tree): EsqTreeMissionTime[] => (tree.missionTime === undefined ? [] : [{ treeId: tree.id, missionTime: tree.missionTime }]));
  const missing = held.filter((entry) => !model.trees.some((tree) => tree.id === entry.treeId));
  return [...shown, ...missing];
}

function esqWithoutLinkedData(view: EventSequenceQuantification): EventSequenceQuantification {
  const { model, quantificationPlan, modelDecisions, ...rest } = view;
  const decisions = modelDecisions ?? {};
  const { treeMissionTimes: _times, ...otherDecisions } = decisions;
  const missionTimes = missionTimesSaved(model, decisions);
  const nextDecisions: EsqModelDecisions = missionTimes.length === 0 ? otherDecisions : { ...otherDecisions, treeMissionTimes: missionTimes };
  const plan = planSaved(quantificationPlan);
  return {
    ...rest,
    ...(plan === undefined ? {} : { quantificationPlan: plan }),
    ...(modelDecisions === undefined && missionTimes.length === 0 ? {} : { modelDecisions: nextDecisions }),
  };
}

export {
  esqHoldsSavedCopies,
  esqIeModules,
  esqRiFloor,
  esqShowsSavedCopies,
  esqWithLinkedData,
  esqWithoutLinkedData,
  type EsqLinkedSources,
};
