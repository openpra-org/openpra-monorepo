import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { deleteJson, fetchJson, patchJson, postJson, postMultipart } from "../api/client";
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
    meanFrequency?: number | { value?: number };
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

interface LinkedScMef {
  missionTimes?: {
    uuid: string;
    eventSequenceReference: string;
    missionTimeHours: number;
    isRiskSignificant?: boolean;
  }[];
}

interface LinkedSyMef {
  systemDefinitions?: {
    uuid: string;
    name: string;
    missionTimeHours?: number;
    applicablePlantOperatingStates?: string[];
  }[];
  systemLogicModels?: {
    systemReference: string;
    basicEvents?: unknown[];
  }[];
}

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
    value: number;
    basicEventRef?: string;
    systemReference?: string;
  }[];
}

function numericFrequency(value: number | { value?: number } | undefined): number | undefined {
  if (typeof value === "number") return value;
  return value?.value;
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

  const screenedOut = new Set(
    (posBundle.pos.mef.screeningRecords ?? []).filter((record) => !record.retained).map((record) => record.posId),
  );
  const logicBySystem = new Map(
    (syBundle.sy.mef.systemLogicModels ?? []).map((logic) => [logic.systemReference, logic]),
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
      meanFrequency: numericFrequency(group.meanFrequency),
      applicableStates: group.applicableStates ?? [],
      riskImportance: group.riskImportance ?? "—",
    })),
    esFamilies: (esBundle.es.mef.eventSequenceFamilies ?? []).map((family) => ({
      id: family.uuid,
      name: family.name,
      endState: family.endState ?? "—",
      memberCount: family.memberSequenceIds?.length,
    })),
    scMissionTimes: (scBundle.sc.mef.missionTimes ?? []).map((mission) => ({
      id: mission.uuid,
      eventSequence: mission.eventSequenceReference,
      hours: mission.missionTimeHours,
      riskSignificant: mission.isRiskSignificant,
    })),
    sySystems: (syBundle.sy.mef.systemDefinitions ?? []).map((system) => ({
      id: system.uuid,
      name: system.name,
      missionTimeHours: system.missionTimeHours,
      applicableStates: system.applicablePlantOperatingStates ?? [],
      basicEventCount: logicBySystem.get(system.uuid)?.basicEvents?.length,
    })),
    hrActions: (hrBundle.hr.mef.humanFailureEvents ?? []).map((action) => ({
      id: action.uuid,
      name: action.name,
      timing: action.hfeTiming ?? "—",
      affectedSystems: action.affectedSystems ?? [],
      humanErrorProbability: hepByAction.get(action.uuid),
    })),
    daParameters: (daBundle.da.mef.parameters ?? []).map((parameter) => ({
      id: parameter.uuid,
      name: parameter.name,
      parameterType: parameter.parameterType ?? "PARAMETER",
      value: parameter.value,
      basicEvent: parameter.basicEventRef ?? "—",
      system: parameter.systemReference ?? "—",
    })),
  };
}

const getSeismicPraWorkbook = (workbookId: string): Promise<SeismicPraWorkbookResponse> => fetchJson(`/api/seismic-pra-workbooks/${workbookId}`);
const patchSeismicPraWorkbook = (workbookId: string, mef: SeismicPRA): Promise<SeismicPraWorkbookResponse> => patchJson(`/api/seismic-pra-workbooks/${workbookId}`, { mef });
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
