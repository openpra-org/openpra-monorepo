import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type {
  EventSequenceFamilyQuantificationReference,
  EventSequenceFamilyWorkbookReference,
  RadiologicalConsequenceResultReference,
} from "interfaces-mef-types/modeling/references";
import { getEsWorkbook } from "../es-workbooks/esWorkbookApi";
import { getEsqWorkbook } from "../esq-workbooks/esqWorkbookApi";
import { getRcWorkbook } from "../rc-workbooks/rcWorkbookApi";
import { listWorkbooks } from "./workbookApi";

type EventSequenceFamily = EventSequenceAnalysis["eventSequenceFamilies"][number];
type FamilyQuantification = EventSequenceQuantification["familyQuantifications"][number];
type ConsequenceRecord = RadiologicalConsequenceAnalysis["consequenceQuantification"]["eventSequenceConsequences"][number];

interface EventSequenceFamilySource {
  workbookId: string;
  workbookName: string;
  family: EventSequenceFamily;
  reference: EventSequenceFamilyWorkbookReference;
}

interface FamilyQuantificationSource {
  workbookId: string;
  workbookName: string;
  quantification: FamilyQuantification;
  reference: EventSequenceFamilyQuantificationReference;
}

interface ConsequenceResultSource {
  workbookId: string;
  workbookName: string;
  result: ConsequenceRecord & { uuid: string };
  reference: RadiologicalConsequenceResultReference;
}

interface RiRiskSources {
  eventSequenceFamilies: EventSequenceFamilySource[];
  familyQuantifications: FamilyQuantificationSource[];
  consequenceResults: ConsequenceResultSource[];
}

function meanFrequencyValue(value: number | { value: number }): number {
  return typeof value === "number" ? value : value.value;
}

function consequenceMetricMatches(left: string, right: string): boolean {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  if (a === b) return true;
  return [
    ["latent", "cancer"],
    ["early", "fatal"],
    ["boundary", "dose"],
    ["population", "dose"],
  ].some((tokens) => tokens.every((token) => a.includes(token) && b.includes(token)));
}

function sourcesForEventSequenceFamily(
  sources: RiRiskSources,
  familySource: EventSequenceFamilySource,
): { quantifications: FamilyQuantificationSource[]; consequence?: ConsequenceResultSource } {
  const isSameFamily = (workbookId: string | undefined, entityId: string): boolean =>
    entityId === familySource.family.uuid &&
    (workbookId === undefined || workbookId === familySource.workbookId || workbookId.startsWith("example-"));
  return {
    quantifications: sources.familyQuantifications.filter(({ quantification }) =>
      isSameFamily(
        quantification.eventSequenceFamilyReference?.workbookId,
        quantification.eventSequenceFamilyReference?.entityId ?? quantification.eventSequenceFamilyRef,
      )),
    consequence: sources.consequenceResults.find(({ result }) =>
      isSameFamily(
        result.eventSequenceFamilyReference?.workbookId,
        result.eventSequenceFamilyReference?.entityId ?? result.eventSequenceFamily,
      )),
  };
}

async function loadEventSequenceFamilySources(projectId: string): Promise<EventSequenceFamilySource[]> {
  const { workbooks } = await listWorkbooks(projectId, "ES");
  const loaded = await Promise.allSettled(workbooks.map(async (workbook) => ({
    workbook,
    response: await getEsWorkbook(workbook.id),
  })));
  return loaded.flatMap((entry) => entry.status === "fulfilled"
    ? entry.value.response.mef.eventSequenceFamilies.map((family) => ({
      workbookId: entry.value.workbook.id,
      workbookName: entry.value.workbook.name,
      family,
      reference: {
        referenceType: "EVENT_SEQUENCE_FAMILY" as const,
        workbookId: entry.value.workbook.id,
        entityId: family.uuid,
      },
    }))
    : []).sort((a, b) => a.family.name.localeCompare(b.family.name));
}

async function loadFamilyQuantificationSources(projectId: string): Promise<FamilyQuantificationSource[]> {
  const { workbooks } = await listWorkbooks(projectId, "ESQ");
  const loaded = await Promise.allSettled(workbooks.map(async (workbook) => ({
    workbook,
    response: await getEsqWorkbook(workbook.id),
  })));
  return loaded.flatMap((entry) => entry.status === "fulfilled"
    ? entry.value.response.mef.familyQuantifications.map((quantification) => ({
      workbookId: entry.value.workbook.id,
      workbookName: entry.value.workbook.name,
      quantification,
      reference: {
        referenceType: "EVENT_SEQUENCE_FAMILY_QUANTIFICATION" as const,
        workbookId: entry.value.workbook.id,
        entityId: quantification.uuid,
      },
    }))
    : []).sort((a, b) => a.quantification.name.localeCompare(b.quantification.name));
}

async function loadConsequenceResultSources(projectId: string): Promise<ConsequenceResultSource[]> {
  const { workbooks } = await listWorkbooks(projectId, "RC");
  const loaded = await Promise.allSettled(workbooks.map(async (workbook) => ({
    workbook,
    response: await getRcWorkbook(workbook.id),
  })));
  return loaded.flatMap((entry) => entry.status === "fulfilled"
    ? entry.value.response.mef.consequenceQuantification.eventSequenceConsequences.flatMap((result) => {
      if (result.uuid === undefined || result.uuid.length === 0) return [];
      return [{
        workbookId: entry.value.workbook.id,
        workbookName: entry.value.workbook.name,
        result: { ...result, uuid: result.uuid },
        reference: {
          referenceType: "RADIOLOGICAL_CONSEQUENCE_RESULT" as const,
          workbookId: entry.value.workbook.id,
          entityId: result.uuid,
        },
      }];
    })
    : []).sort((a, b) => a.result.eventSequenceFamily.localeCompare(b.result.eventSequenceFamily));
}

async function loadRiRiskSources(projectId: string): Promise<RiRiskSources> {
  const [eventSequenceFamilies, familyQuantifications, consequenceResults] = await Promise.all([
    loadEventSequenceFamilySources(projectId),
    loadFamilyQuantificationSources(projectId),
    loadConsequenceResultSources(projectId),
  ]);
  return { eventSequenceFamilies, familyQuantifications, consequenceResults };
}

export {
  loadEventSequenceFamilySources,
  loadRiRiskSources,
  meanFrequencyValue,
  consequenceMetricMatches,
  sourcesForEventSequenceFamily,
  type EventSequenceFamilySource,
  type FamilyQuantificationSource,
  type ConsequenceResultSource,
  type RiRiskSources,
};
