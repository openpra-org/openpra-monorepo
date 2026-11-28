import type { EventSequenceAnalysis, EsTimingSource } from "interfaces-mef-types/es/event-sequence-analysis";
import type { UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import {
  esConditionIsLinked,
  esMilestoneIsLinked,
  esShowsSavedCopies,
  esTypedWindows,
  esWindowLink,
  esWithLinkedTiming,
  esWithTypedWindowsReplaced,
  esWithoutLinkedTiming,
  type EsLinkedSources,
  type EsLinkedWindow,
  type EsWindowField,
} from "interfaces-mef-types/es/es-linked-timing";
import { getHrWorkbook } from "../hr-workbooks/hrWorkbookApi";
import { pointsOf } from "../newly-developed-methods/shared/uncertaintyPoints";
import { getScWorkbook } from "../sc-workbooks/scWorkbookApi";
import { getEsWorkbook } from "./esWorkbookApi";

const NO_PARAMETERS: ReadonlyMap<string, UncertainParameter> = new Map();

async function scMissionHours(sc: SuccessCriteriaDevelopment): Promise<Map<string, number>> {
  return pointsOf(sc.missionTimes.map((entry) => ({ key: entry.uuid, expression: entry.missionTime, unit: "HOURS" as const })), NO_PARAMETERS);
}

async function loadEsLinkedSources(es: Pick<EventSequenceAnalysis, "linkedWorkbooks">): Promise<{ sources: EsLinkedSources; unavailable: EsTimingSource[]; missionTimesUnavailable: boolean }> {
  const scId = es.linkedWorkbooks?.SC;
  const hrId = es.linkedWorkbooks?.HRA;
  const [sc, hr] = await Promise.all([
    scId === undefined ? undefined : getScWorkbook(scId).then((workbook) => workbook.mef).catch(() => undefined),
    hrId === undefined ? undefined : getHrWorkbook(hrId).then((workbook) => workbook.mef).catch(() => undefined),
  ]);
  const hours = sc === undefined ? undefined : await scMissionHours(sc).catch(() => undefined);
  const unavailable: EsTimingSource[] = [];
  if (scId !== undefined && sc === undefined) unavailable.push("SC");
  if (hrId !== undefined && hr === undefined) unavailable.push("HRA");
  return {
    sources: { ...(sc === undefined ? {} : { sc }), ...(hr === undefined ? {} : { hr }), ...(hours === undefined ? {} : { scMissionHours: hours }) },
    unavailable,
    missionTimesUnavailable: sc !== undefined && sc.missionTimes.length > 0 && hours === undefined,
  };
}

async function loadEsWithLinkedTiming(workbookId: string): Promise<EventSequenceAnalysis> {
  const es = (await getEsWorkbook(workbookId)).mef;
  if (esShowsSavedCopies(es)) return es;
  return esWithLinkedTiming(es, (await loadEsLinkedSources(es)).sources);
}

export {
  esConditionIsLinked,
  esMilestoneIsLinked,
  esShowsSavedCopies,
  esTypedWindows,
  esWindowLink,
  esWithLinkedTiming,
  esWithTypedWindowsReplaced,
  esWithoutLinkedTiming,
  loadEsLinkedSources,
  loadEsWithLinkedTiming,
  type EsLinkedSources,
  type EsLinkedWindow,
  type EsWindowField,
};
