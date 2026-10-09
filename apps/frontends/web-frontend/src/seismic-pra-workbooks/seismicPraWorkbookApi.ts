import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { type SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import {
  normalizeSystemsAnalysisModels,
  systemLogicModelBasicEvents,
} from "interfaces-mef-types/sy/system-models";
import { deleteJson, fetchJson, patchJson, postJson, postMultipart } from "../api/client";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { estimateUnit, pointsOf, workbookParameterTable } from "../newly-developed-methods/shared/uncertaintyPoints";
import { scMissionTimeTable } from "../sc-workbooks/scMissionTimeLinks";
import { seismicPraVariant, type SeismicPraLinkedInputs, type SeismicPraVariant } from "./seismicPraWorkbookContext";

type SeismicPraWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface SeismicPraWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: SeismicPRA;
  myRoles: SeismicPraWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

interface SeismicPraExampleOption { id: string; label: string }
interface SeismicPraDocumentEntry { documentId: string; filename: string; mimeType: string; size: number; uploadedBy: string; uploadedAt: string }

interface LinkedPosMef {
  plantOperatingStates?: {
    uuid: string;
    name: string;
    operatingMode?: string;
    meanDurationHours: number;
    radioactiveMaterialSources?: { name: string }[];
  }[];
  screeningRecords?: { posId: string; retained: boolean }[];
}

interface LinkedIeMef {
  initiatingEventGroups?: {
    uuid: string;
    name: string;
    frequency?: { expression: UncertainExpression };
    applicableStates?: string[];
    riskImportance?: string;
  }[];
}

interface LinkedEsMef {
  eventSequenceFamilies?: {
    uuid: string;
    name: string;
    endState?: string;
    memberSequenceIds?: string[];
  }[];
}

type LinkedScMef = Partial<Pick<SuccessCriteriaDevelopment, "missionTimes" | "componentMissionTimes">>;

type LinkedSyMef = Partial<
  Pick<SystemsAnalysis, "systemDefinitions" | "systemLogicModels" | "systemBasicEvents">
>;

interface LinkedHrMef {
  humanFailureEvents?: {
    uuid: string;
    name: string;
    hfeTiming?: string;
    affectedSystems?: string[];
  }[];
  hepQuantifications?: {
    hfeId?: string;
    meanHep?: number;
    pointEstimateHep?: number;
  }[];
}

interface LinkedDaMef {
  parameters?: {
    uuid: string;
    name: string;
    parameterType?: string;
    value?: number;
    estimate?: UncertainExpression;
    basicEventRef?: string;
    systemReference?: string;
  }[];
}

async function fetchSeismicPraLinkedInputs(variant: SeismicPraVariant): Promise<SeismicPraLinkedInputs> {
  const [posBundle, ieBundle, esBundle, scBundle, syBundle, hrBundle, daBundle] = await Promise.all([
    fetchJson<{ pos: { mef: LinkedPosMef } }>(`/api/example-workbooks/pos-bundle?example=${variant}`),
    fetchJson<{ ie: { mef: LinkedIeMef } }>(`/api/example-workbooks/ie-bundle?example=${variant}`),
    fetchJson<{ es: { mef: LinkedEsMef } }>(`/api/example-workbooks/es-bundle?example=${variant}`),
    fetchJson<{ sc: { mef: LinkedScMef } }>(`/api/example-workbooks/sc-bundle?example=${variant}`),
    fetchJson<{ sy: { mef: LinkedSyMef } }>(`/api/example-workbooks/sy-bundle?example=${variant}`),
    fetchJson<{ hr: { mef: LinkedHrMef } }>(`/api/example-workbooks/hr-bundle?example=${variant}`),
    fetchJson<{ da: { mef: LinkedDaMef } }>(`/api/example-workbooks/da-bundle?example=${variant}`),
  ]);

  const daParameters = daBundle.da.mef.parameters ?? [];
  const daTable = workbookParameterTable(`example-da-${variant}`, daParameters);
  const frequencies = await pointsOf(
    (ieBundle.ie.mef.initiatingEventGroups ?? []).flatMap((group) => (group.frequency === undefined ? [] : [{ key: group.uuid, expression: group.frequency.expression, unit: "PER_YEAR" as const }])),
    daTable,
  );
  const estimates = await pointsOf(
    daParameters.flatMap((parameter) => {
      const unit = parameter.estimate === undefined ? undefined : estimateUnit(parameter.estimate);
      return parameter.estimate === undefined || unit === undefined ? [] : [{ key: parameter.uuid, expression: parameter.estimate, unit }];
    }),
    daTable,
  );

  const scId = `example-sc-${variant}`;
  const scMissionTimes = { missionTimes: scBundle.sc.mef.missionTimes ?? [], componentMissionTimes: scBundle.sc.mef.componentMissionTimes ?? [] };
  const missionHours = await pointsOf(
    scMissionTimes.missionTimes.map((mission) => ({ key: mission.uuid, expression: mission.missionTime, unit: "HOURS" as const })),
    new Map(),
  );
  const systemHours = await pointsOf(
    (syBundle.sy.mef.systemDefinitions ?? []).flatMap((system) => (system.missionTime === undefined ? [] : [{ key: system.uuid, expression: system.missionTime, unit: "HOURS" as const }])),
    scMissionTimeTable(scId, scMissionTimes),
  );

  const screenedOut = new Set(
    (posBundle.pos.mef.screeningRecords ?? []).filter((record) => !record.retained).map((record) => record.posId),
  );
  const syMef = normalizeSystemsAnalysisModels(syBundle.sy.mef) as LinkedSyMef;
  const logicBySystem = new Map(
    (syMef.systemLogicModels ?? []).map((logic) => [logic.systemReference, logic]),
  );
  const hepByAction = new Map(
    (hrBundle.hr.mef.hepQuantifications ?? [])
      .filter((quantification): quantification is typeof quantification & { hfeId: string } => quantification.hfeId !== undefined)
      .map((quantification) => [quantification.hfeId, quantification.meanHep ?? quantification.pointEstimateHep]),
  );

  return {
    variant,
    posStates: (posBundle.pos.mef.plantOperatingStates ?? [])
      .filter((state) => !screenedOut.has(state.uuid))
      .map((state) => ({
        id: state.uuid,
        name: state.name,
        mode: state.operatingMode ?? "—",
        durationHours: state.meanDurationHours,
        materialSources: Array.from(new Set((state.radioactiveMaterialSources ?? []).map((source) => source.name))),
      })),
    ieGroups: (ieBundle.ie.mef.initiatingEventGroups ?? []).map((group) => ({
      id: group.uuid,
      name: group.name,
      meanFrequency: frequencies.get(group.uuid),
      applicableStates: group.applicableStates ?? [],
      riskImportance: group.riskImportance ?? "—",
    })),
    esFamilies: (esBundle.es.mef.eventSequenceFamilies ?? []).map((family) => ({
      id: family.uuid,
      name: family.name,
      endState: family.endState ?? "—",
      memberCount: family.memberSequenceIds?.length,
    })),
    scMissionTimes: scMissionTimes.missionTimes.map((mission) => ({
      id: mission.uuid,
      eventSequence: mission.eventSequenceReference,
      hours: missionHours.get(mission.uuid),
      riskSignificant: mission.isRiskSignificant,
    })),
    sySystems: (syMef.systemDefinitions ?? []).map((system) => {
      const logic = logicBySystem.get(system.uuid);
      return {
        id: system.uuid,
        name: system.name,
        missionHours: systemHours.get(system.uuid),
        applicableStates: system.applicablePlantOperatingStates ?? [],
        basicEventCount:
          logic === undefined
            ? undefined
            : systemLogicModelBasicEvents(
                { systemBasicEvents: syMef.systemBasicEvents ?? [] },
                logic,
              ).length,
      };
    }),
    hrActions: (hrBundle.hr.mef.humanFailureEvents ?? []).map((action) => ({
      id: action.uuid,
      name: action.name,
      timing: action.hfeTiming ?? "—",
      affectedSystems: action.affectedSystems ?? [],
      humanErrorProbability: hepByAction.get(action.uuid),
    })),
    daParameters: daParameters.map((parameter) => ({
      id: parameter.uuid,
      name: parameter.name,
      parameterType: parameter.parameterType ?? "PARAMETER",
      value: parameter.value ?? estimates.get(parameter.uuid),
      basicEvent: parameter.basicEventRef ?? "—",
      system: parameter.systemReference ?? "—",
    })),
  };
}

const getSeismicPraWorkbook = (workbookId: string): Promise<SeismicPraWorkbookResponse> => fetchJson(`/api/seismic-pra-workbooks/${workbookId}`);
const patchSeismicPraWorkbook = (workbookId: string, current: SeismicPRA, mef: SeismicPRA): Promise<SeismicPraWorkbookResponse> => patchJson(`/api/seismic-pra-workbooks/${workbookId}`, { operations: createWorkbookPatch(current, mef) });
const getSeismicPraExamples = (): Promise<SeismicPraExampleOption[]> => fetchJson("/api/example-workbooks/seismic-pra-examples");
const loadSeismicPraExample = (workbookId: string, exampleId?: string): Promise<SeismicPraWorkbookResponse> => postJson(`/api/seismic-pra-workbooks/${workbookId}/load-example`, exampleId === undefined ? {} : { example: exampleId });
const unloadSeismicPraExample = (workbookId: string): Promise<SeismicPraWorkbookResponse> => postJson(`/api/seismic-pra-workbooks/${workbookId}/unload-example`, {});
const listSeismicPraDocuments = (workbookId: string): Promise<SeismicPraDocumentEntry[]> => fetchJson(`/api/seismic-pra-workbooks/${workbookId}/documents`);
async function uploadSeismicPraDocument(workbookId: string, file: File): Promise<SeismicPraDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart(`/api/seismic-pra-workbooks/${workbookId}/documents`, form);
}
const deleteSeismicPraDocument = async (workbookId: string, documentId: string): Promise<void> => { await deleteJson(`/api/seismic-pra-workbooks/${workbookId}/documents/${documentId}`); };
const updateSeismicPraDocument = (workbookId: string, documentId: string, name: string): Promise<SeismicPraDocumentEntry> => patchJson(`/api/seismic-pra-workbooks/${workbookId}/documents/${documentId}`, { name });
const getSeismicPraDocumentDownload = (workbookId: string, documentId: string): Promise<{ url: string; filename: string }> => fetchJson(`/api/seismic-pra-workbooks/${workbookId}/documents/${documentId}/download`);

export {
  fetchSeismicPraLinkedInputs,
  getSeismicPraWorkbook,
  patchSeismicPraWorkbook,
  getSeismicPraExamples,
  loadSeismicPraExample,
  unloadSeismicPraExample,
  listSeismicPraDocuments,
  uploadSeismicPraDocument,
  deleteSeismicPraDocument,
  updateSeismicPraDocument,
  getSeismicPraDocumentDownload,
  seismicPraVariant,
  type SeismicPraWorkbookResponse,
  type SeismicPraWorkbookRoleName,
  type SeismicPraExampleOption,
  type SeismicPraDocumentEntry,
};
