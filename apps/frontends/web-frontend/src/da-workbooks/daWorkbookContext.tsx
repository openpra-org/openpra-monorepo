import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { type DataAnalysis, type DaLinkCode } from "interfaces-mef-types/da/data-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { type HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import { type Workbook } from "interfaces-shared-types";
import { loadLinkedHr, loadLinkedIe, loadLinkedPos, loadLinkedSy } from "./daWorkbookApi";

interface DaWorkbookData {
  da: DataAnalysis;
  cc: PRAConfigurationControl;
  nms: NewlyDevelopedMethod[];
}

type DaMutator = (da: DataAnalysis) => DataAnalysis;

interface DaUpstream {
  options: Record<DaLinkCode, Workbook[]>;
  sy?: SystemsAnalysis;
  ie?: InitiatingEventsAnalysis;
  hr?: HumanReliabilityAnalysis;
  pos?: PlantOperatingStatesAnalysis;
}

const EMPTY_UPSTREAM: DaUpstream = {
  options: { SY: [], IE: [], HRA: [], POS: [], SC: [], ESQ: [] },
};

interface DaWorkbookContextValue extends DaWorkbookData {
  editable: boolean;
  mutateDa: (mutator: DaMutator) => void;
  upstream: DaUpstream;
}

const DaWorkbookContext = createContext<DaWorkbookContextValue | null>(null);

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

function useDaUpstream(da: DataAnalysis | undefined, options: Record<DaLinkCode, Workbook[]>): DaUpstream {
  const links = da?.linkedWorkbooks;
  const sy = useLinkedMef(links?.SY, loadLinkedSy);
  const ie = useLinkedMef(links?.IE, loadLinkedIe);
  const hr = useLinkedMef(links?.HRA, loadLinkedHr);
  const pos = useLinkedMef(links?.POS, loadLinkedPos);
  return useMemo<DaUpstream>(() => ({ options, sy, ie, hr, pos }), [options, sy, ie, hr, pos]);
}

function DaWorkbookProvider({ data, editable, mutateDa, upstream = EMPTY_UPSTREAM, children }: {
  data: DaWorkbookData;
  editable: boolean;
  mutateDa: (mutator: DaMutator) => void;
  upstream?: DaUpstream;
  children: React.ReactNode;
}): JSX.Element {
  const value = useMemo<DaWorkbookContextValue>(
    () => ({ ...data, editable, mutateDa, upstream }),
    [data, editable, mutateDa, upstream],
  );
  return <DaWorkbookContext.Provider value={value}>{children}</DaWorkbookContext.Provider>;
}

function useDaWorkbook(): DaWorkbookContextValue {
  const ctx = useContext(DaWorkbookContext);
  if (ctx === null) throw new Error("useDaWorkbook must be used inside DaWorkbookProvider");
  return ctx;
}

export { DaWorkbookProvider, useDaWorkbook, useDaUpstream, EMPTY_UPSTREAM, type DaWorkbookData, type DaMutator, type DaUpstream };
