import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { PlantOperatingState, PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { fetchJson } from "../api/client";
import { getDaWorkbook } from "../da-workbooks/daWorkbookApi";

const EXAMPLE_PREFIX = "example-da-";

interface PosDaOutageOption {
  workbookId: string;
  workbookName: string;
  stateId: string;
  outageIds: string[];
  hoursPerYear: number;
  entriesPerYear: number;
}

interface PosDaSource {
  id: string;
  name: string;
  mef: Pick<DataAnalysis, "name" | "outages">;
}

function daOutageOptions(sources: readonly PosDaSource[]): PosDaOutageOption[] {
  return sources.flatMap((source) => {
    const byState = new Map<string, PosDaOutageOption>();
    (source.mef.outages ?? []).forEach((outage) => {
      const stateId = outage.stateId;
      if (stateId === undefined || outage.valueFrom === "POS" || !(outage.hours > 0) || !(outage.perYear > 0)) return;
      const current = byState.get(stateId) ?? {
        workbookId: source.id,
        workbookName: source.name.length > 0 ? source.name : source.mef.name,
        stateId,
        outageIds: [],
        hoursPerYear: 0,
        entriesPerYear: 0,
      };
      byState.set(stateId, {
        ...current,
        outageIds: [...current.outageIds, outage.id],
        hoursPerYear: current.hoursPerYear + outage.hours * outage.perYear,
        entriesPerYear: current.entriesPerYear + outage.perYear,
      });
    });
    return [...byState.values()];
  }).sort((left, right) => [left.stateId, left.workbookName].join(":").localeCompare([right.stateId, right.workbookName].join(":"), undefined, { numeric: true }));
}

function entriesOf(state: PlantOperatingState): number {
  return typeof state.meanEntryFrequency === "number" ? state.meanEntryFrequency : state.meanEntryFrequency.value;
}

function linkedDaOutage(state: PlantOperatingState, options: readonly PosDaOutageOption[]): PosDaOutageOption | undefined {
  const source = state.outageSource;
  if (source === undefined) return undefined;
  return options.find((option) => option.workbookId === source.workbookId && option.stateId === state.uuid);
}

function sameValue(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right));
}

function outageDiffers(state: PlantOperatingState, option: PosDaOutageOption): boolean {
  return !sameValue(state.meanDurationHours, option.hoursPerYear) || !sameValue(entriesOf(state), option.entriesPerYear);
}

function withOutageSource(pos: PlantOperatingStatesAnalysis, stateId: string, workbookId: string | undefined): PlantOperatingStatesAnalysis {
  return {
    ...pos,
    plantOperatingStates: pos.plantOperatingStates.map((state) => (state.uuid === stateId ? { ...state, outageSource: workbookId === undefined ? undefined : { workbookId } } : state)),
  };
}

async function loadDaSource(id: string): Promise<PosDaSource[]> {
  try {
    if (id.startsWith(EXAMPLE_PREFIX)) {
      const bundle = await fetchJson<{ da: { mef: DataAnalysis } }>(`/api/example-workbooks/da-bundle?example=${encodeURIComponent(id.slice(EXAMPLE_PREFIX.length))}`);
      return [{ id, name: "", mef: bundle.da.mef }];
    }
    const workbook = await getDaWorkbook(id);
    return [{ id, name: "", mef: workbook.mef }];
  } catch {
    return [];
  }
}

async function loadPosDaOutages(daWorkbookId: string | undefined): Promise<PosDaOutageOption[]> {
  if (daWorkbookId === undefined || daWorkbookId.length === 0) return [];
  return daOutageOptions(await loadDaSource(daWorkbookId));
}

function withDaLink(pos: PlantOperatingStatesAnalysis, workbookId: string): PlantOperatingStatesAnalysis {
  const links = { ...pos.linkedWorkbooks };
  delete links.DA;
  return { ...pos, linkedWorkbooks: workbookId.length === 0 ? links : { ...links, DA: workbookId } };
}

export {
  EXAMPLE_PREFIX,
  withDaLink,
  daOutageOptions,
  entriesOf,
  linkedDaOutage,
  loadPosDaOutages,
  outageDiffers,
  withOutageSource,
  type PosDaOutageOption,
  type PosDaSource,
};
