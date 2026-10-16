import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type DataAnalysis, type DaLinkCode } from "interfaces-mef-types/da/data-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { type HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { type SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { type Workbook } from "interfaces-shared-types";
import { useUncertaintyVersion } from "../newly-developed-methods/shared/useUncertainty";
import { type UncertainExpression, type UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import { syLinkRoots } from "../sy-workbooks/syLinks";
import { scMissionTimeTable } from "../sc-workbooks/scMissionTimeLinks";
import { useLinkedScSources, type ScMissionTimeSource } from "../sc-workbooks/scMissionTimeSources";
import { type LinkRoot } from "../newly-developed-methods/shared/uncertaintyLinks";
import { loadLinkedEsq, loadLinkedHr, loadLinkedIe, loadLinkedPos, loadLinkedSc, loadLinkedSy } from "./daWorkbookApi";
import { setDaMissionTimes } from "./daLaws";
import { withEstimates } from "./daFailures";
import { withUnavailability } from "./daUnavailability";
import { withCcf } from "./daCcf";
import { withFrequencies } from "./daFrequencies";

interface DaWorkbookData {
  da: DataAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

type DaMutator = (da: DataAnalysis) => DataAnalysis;

interface DaUpstream {
  options: Record<DaLinkCode, Workbook[]>;
  workbookId?: string;
  sy?: SystemsAnalysis;
  ie?: InitiatingEventsAnalysis;
  hr?: HumanReliabilityAnalysis;
  pos?: PlantOperatingStatesAnalysis;
  esq?: EventSequenceQuantification;
  sc?: SuccessCriteriaDevelopment;
  scReferenced: ScMissionTimeSource[];
}

const EMPTY_UPSTREAM: DaUpstream = {
  options: { SY: [], IE: [], HRA: [], POS: [], SC: [], ESQ: [] },
  scReferenced: [],
};

function linkedScSource(da: DataAnalysis | undefined, sc: SuccessCriteriaDevelopment | undefined): ScMissionTimeSource[] {
  const linked = da?.linkedWorkbooks?.SC;
  return linked === undefined || sc === undefined ? [] : [{ workbookId: linked, sc }];
}

function daMissionTimeSources(da: DataAnalysis, upstream: DaUpstream): ScMissionTimeSource[] {
  const linked = linkedScSource(da, upstream.sc);
  return [...linked, ...upstream.scReferenced.filter((source) => linked.every((entry) => entry.workbookId !== source.workbookId))];
}

function root(expression: UncertainExpression | undefined, missionTime: boolean): LinkRoot[] {
  return expression === undefined ? [] : [{ expression, missionTime }];
}

function daLinkRoots(da: DataAnalysis): LinkRoot[] {
  const needs = da.dataNeeds;
  return [
    ...da.parameters.flatMap((parameter) => [...root(parameter.estimate, false), ...root(parameter.missionTime, true)]),
    ...(needs?.basicEvents ?? []).flatMap((need) => [...root(need.expression, false), ...root(need.importedMissionTime, true), ...root(need.missionTime, true)]),
    ...(needs?.ccfGroups ?? []).flatMap((group) => root(group.total, false)),
  ];
}

const NO_PARAMETERS: ReadonlyMap<string, UncertainParameter> = new Map();

function scSequenceFamilies(sc: Pick<SuccessCriteriaDevelopment, "overallSuccessCriteria"> | undefined): Map<string, string[]> {
  const families = new Map<string, string[]>();
  for (const criterion of sc?.overallSuccessCriteria ?? []) {
    const sequence = criterion.eventSequenceReference;
    const family = criterion.eventSequenceFamilyReference;
    if (sequence === undefined || family === undefined) continue;
    const known = families.get(sequence) ?? [];
    if (!known.includes(family)) families.set(sequence, [...known, family]);
  }
  return families;
}

interface DaWorkbookContextValue extends DaWorkbookData {
  editable: boolean;
  mutateDa: (mutator: DaMutator) => void;
  upstream: DaUpstream;
}

const DaWorkbookContext = createContext<DaWorkbookContextValue | null>(null);

function derived(da: DataAnalysis, self: string | undefined): DataAnalysis {
  return withCcf(withFrequencies(withUnavailability(withEstimates(da))), self);
}

function useLinkedMef<T>(id: string | undefined, load: (id: string) => Promise<T>): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    if (id === undefined) {
      setValue(undefined);
      return;
    }
    let cancelled = false;
    load(id)
      .then((mef) => { if (!cancelled) setValue(mef); })
      .catch(() => { if (!cancelled) setValue(undefined); });
    return () => { cancelled = true; };
  }, [id, load]);
  return value;
}

function useDaUpstream(da: DataAnalysis | undefined, options: Record<DaLinkCode, Workbook[]>, workbookId?: string): DaUpstream {
  const links = da?.linkedWorkbooks;
  const sy = useLinkedMef(links?.SY, loadLinkedSy);
  const ie = useLinkedMef(links?.IE, loadLinkedIe);
  const hr = useLinkedMef(links?.HRA, loadLinkedHr);
  const pos = useLinkedMef(links?.POS, loadLinkedPos);
  const esq = useLinkedMef(links?.ESQ, loadLinkedEsq);
  const sc = useLinkedMef(links?.SC, loadLinkedSc);
  const scRoots = useMemo(() => [...(da === undefined ? [] : daLinkRoots(da)), ...(sy === undefined ? [] : syLinkRoots(sy))], [da, sy]);
  const scBaseTable = useMemo(() => {
    const [linked] = linkedScSource(da, sc);
    return linked === undefined ? NO_PARAMETERS : scMissionTimeTable(linked.workbookId, linked.sc);
  }, [da, sc]);
  const scReferenced = useLinkedScSources(scRoots, scBaseTable);
  return useMemo<DaUpstream>(() => ({ options, workbookId, sy, ie, hr, pos, esq, sc, scReferenced }), [options, workbookId, sy, ie, hr, pos, esq, sc, scReferenced]);
}

function DaWorkbookProvider({ data, editable, mutateDa, upstream = EMPTY_UPSTREAM, children }: {
  data: DaWorkbookData;
  editable: boolean;
  mutateDa: (mutator: DaMutator) => void;
  upstream?: DaUpstream;
  children: React.ReactNode;
}): JSX.Element {
  const missionTimes = useMemo(() => ({ sources: daMissionTimeSources(data.da, upstream), families: scSequenceFamilies(upstream.sc) }), [data.da, upstream]);
  setDaMissionTimes(missionTimes);
  const self = upstream.workbookId;
  const mutateWithEstimates = useCallback((mutator: DaMutator): void => mutateDa((da) => derived(mutator(da), self)), [mutateDa, self]);
  const version = useUncertaintyVersion();
  useEffect(() => {
    if (!editable) return;
    if (derived(data.da, self) !== data.da) mutateDa((da) => derived(da, self));
  }, [version, missionTimes, data.da, editable, mutateDa, self]);
  const value = useMemo<DaWorkbookContextValue>(
    () => ({ ...data, editable, mutateDa: mutateWithEstimates, upstream }),
    [data, editable, mutateWithEstimates, upstream],
  );
  return <DaWorkbookContext.Provider value={value}>{children}</DaWorkbookContext.Provider>;
}

function useDaWorkbook(): DaWorkbookContextValue {
  const ctx = useContext(DaWorkbookContext);
  if (ctx === null) throw new Error("useDaWorkbook must be used inside DaWorkbookProvider");
  return ctx;
}

export { DaWorkbookProvider, daMissionTimeSources, scSequenceFamilies, useDaWorkbook, useDaUpstream, EMPTY_UPSTREAM, type DaWorkbookData, type DaMutator, type DaUpstream };
