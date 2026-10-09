import { useEffect, useMemo, useState } from "react";
import type { UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { fetchJson } from "../api/client";
import { missingLinks, type LinkRoot, type LinkTable } from "../newly-developed-methods/shared/uncertaintyLinks";
import { scMissionTimeTable, type ScMissionTimes } from "./scMissionTimeLinks";
import { getScWorkbook } from "./scWorkbookApi";

const SC_EXAMPLE_PREFIX = "example-sc-";

const ID_SEPARATOR = "\n";

interface ScMissionTimeSource {
  workbookId: string;
  sc: ScMissionTimes;
}

function missionTimesOf(sc: SuccessCriteriaDevelopment): ScMissionTimes {
  return { missionTimes: sc.missionTimes, componentMissionTimes: sc.componentMissionTimes ?? [] };
}

async function loadScMissionTimeSource(workbookId: string): Promise<ScMissionTimeSource> {
  if (workbookId.startsWith(SC_EXAMPLE_PREFIX)) {
    const bundle = await fetchJson<{ sc: { mef: SuccessCriteriaDevelopment } }>(`/api/example-workbooks/sc-bundle?example=${encodeURIComponent(workbookId.slice(SC_EXAMPLE_PREFIX.length))}`);
    return { workbookId, sc: missionTimesOf(bundle.sc.mef) };
  }
  return { workbookId, sc: missionTimesOf((await getScWorkbook(workbookId)).mef) };
}

async function loadScMissionTimeSources(ids: readonly string[]): Promise<ScMissionTimeSource[]> {
  const loaded = await Promise.allSettled(ids.map(loadScMissionTimeSource));
  return loaded.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

function tableRoots(table: LinkTable): LinkRoot[] {
  return [...table.values()].map((parameter) => ({ expression: parameter.expression, missionTime: false }));
}

function linkedScWorkbookIds(roots: readonly LinkRoot[], table: LinkTable): string[] {
  const ids = missingLinks([...roots, ...tableRoots(table)], table)
    .filter((link) => link.missionTime || link.reference.workbookId.startsWith(SC_EXAMPLE_PREFIX))
    .map((link) => link.reference.workbookId);
  return [...new Set(ids)].sort();
}

function scSourcesTable(sources: readonly ScMissionTimeSource[]): Map<string, UncertainParameter> {
  return new Map(sources.flatMap((source) => [...scMissionTimeTable(source.workbookId, source.sc)]));
}

function withScSources(table: LinkTable, sources: readonly ScMissionTimeSource[]): Map<string, UncertainParameter> {
  return new Map([...table, ...scSourcesTable(sources)]);
}

function useLinkedScSources(roots: readonly LinkRoot[], table: LinkTable): ScMissionTimeSource[] {
  const key = useMemo(() => linkedScWorkbookIds(roots, table).join(ID_SEPARATOR), [roots, table]);
  const [sources, setSources] = useState<ScMissionTimeSource[]>([]);
  useEffect(() => {
    const ids = key.length === 0 ? [] : key.split(ID_SEPARATOR);
    let cancelled = false;
    void loadScMissionTimeSources(ids).then((loaded) => {
      if (!cancelled) setSources(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return sources;
}

export {
  SC_EXAMPLE_PREFIX,
  linkedScWorkbookIds,
  loadScMissionTimeSources,
  scSourcesTable,
  useLinkedScSources,
  withScSources,
  type ScMissionTimeSource,
};
