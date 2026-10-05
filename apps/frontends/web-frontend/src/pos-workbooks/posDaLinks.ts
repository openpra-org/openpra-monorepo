import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { PlantOperatingState, PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { fetchJson } from "../api/client";
import { listWorkbooks } from "../workbooks/workbookApi";

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

async function loadDaSource(id: string, name: string): Promise<PosDaSource[]> {
  try {
    if (id.startsWith(EXAMPLE_PREFIX)) {
      const bundle = await fetchJson<{ da: { mef: DataAnalysis } }>(`/api/example-workbooks/da-bundle?example=${encodeURIComponent(id.slice(EXAMPLE_PREFIX.length))}`);
      return [{ id, name, mef: bundle.da.mef }];
    }
    const workbook = await fetchJson<{ mef: DataAnalysis }>(`/api/da-workbooks/${encodeURIComponent(id)}`);
    return [{ id, name, mef: workbook.mef }];
  } catch {
    return [];
  }
}

async function loadPosDaOutages(projectId: string | null, pos: PlantOperatingStatesAnalysis, exampleVariant?: string): Promise<PosDaOutageOption[]> {
  let listed: { id: string; name: string }[] = [];
  if (projectId !== null) {
    try {
      listed = (await listWorkbooks(projectId, "DA")).workbooks.map((workbook) => ({ id: workbook.id, name: workbook.name }));
    } catch {
      listed = [];
    }
  }
  const known = new Set(listed.map((entry) => entry.id));
  const referenced = pos.plantOperatingStates.flatMap((state) => state.outageSource?.workbookId ?? []);
  const wanted = exampleVariant === undefined ? referenced : [...referenced, `${EXAMPLE_PREFIX}${exampleVariant}`];
  const examples = [...new Set(wanted)]
    .filter((id) => id.startsWith(EXAMPLE_PREFIX) && !known.has(id))
    .map((id) => ({ id, name: "" }));
  const sources = await Promise.all([...listed, ...examples].map((entry) => loadDaSource(entry.id, entry.name)));
  return daOutageOptions(sources.flat());
}

export {
  daOutageOptions,
  entriesOf,
  linkedDaOutage,
  loadPosDaOutages,
  outageDiffers,
  withOutageSource,
  type PosDaOutageOption,
  type PosDaSource,
};
