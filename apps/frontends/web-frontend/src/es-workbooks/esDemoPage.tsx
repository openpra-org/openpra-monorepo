import { JSX, useCallback, useEffect, useState } from "react";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { EsWorkbench } from "./esWorkbench";
import { EsWorkbookProvider, type EsWorkbookData } from "./esWorkbookContext";
import { EsDocumentsCard } from "./esDocumentsCard";
import { type EsPosLinkStatus, type EsIeLinkStatus } from "./esWorkbookApi";
import { type EsPersona } from "./esViewData";

interface EsExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface EsBundleResponse {
  es: EsExampleResponse;
  configurationControl: EsExampleResponse;
  newlyDevelopedMethods: EsExampleResponse[];
}

interface PosBundleResponse {
  pos: { mef: unknown };
}

interface IeBundleResponse {
  ie: { mef: unknown };
}

function buildDemoPosLink(pos: PlantOperatingStatesAnalysis): EsPosLinkStatus {
  const states = pos.plantOperatingStates.map((s) => ({
    id: s.uuid,
    name: s.name,
    operatingMode: s.operatingMode,
    meanDurationHours: s.meanDurationHours,
    meanEntryFrequency: typeof s.meanEntryFrequency === "number" ? s.meanEntryFrequency : s.meanEntryFrequency.value,
  }));
  const sourceById = new Map<string, { id: string; name: string; location: string; barriers: string[] }>();
  for (const s of pos.plantOperatingStates) {
    for (const src of s.radioactiveMaterialSources) {
      if (!sourceById.has(src.uuid)) sourceById.set(src.uuid, { id: src.uuid, name: src.name, location: src.location, barriers: src.barriers });
    }
  }
  return {
    linkedPosWorkbookId: "example",
    linkedName: `${pos.metadata.plantIdentity?.name ?? "Generic SFR"} POS Workbook`,
    states,
    sources: Array.from(sourceById.values()),
  };
}

function buildDemoIeLink(ie: InitiatingEventsAnalysis): EsIeLinkStatus {
  return {
    linkedIeWorkbookId: "example",
    linkedName: ie.name,
    initiators: ie.initiators.map((i) => ({ id: i.uuid, name: i.name, category: i.category })),
  };
}

const EMPTY_POS_LINK: EsPosLinkStatus = { linkedPosWorkbookId: null, linkedName: null, states: [], sources: [] };
const EMPTY_IE_LINK: EsIeLinkStatus = { linkedIeWorkbookId: null, linkedName: null, initiators: [] };

function EsDemoPage(): JSX.Element {
  const [data, setData] = useState<EsWorkbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<EsPersona>("preparer");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchJson<EsBundleResponse>("/api/example-workbooks/es-bundle"),
      fetchJson<PosBundleResponse>("/api/example-workbooks/pos-bundle?example=sfr").catch((): PosBundleResponse | null => null),
      fetchJson<IeBundleResponse>("/api/example-workbooks/ie-bundle?example=sfr").catch((): IeBundleResponse | null => null),
    ])
      .then(([res, posRes, ieRes]) => {
        if (cancelled) return;
        const es = res.es.mef as EventSequenceAnalysis;
        setData({
          es,
          cc: res.configurationControl.mef as PRAConfigurationControl,
          nms: res.newlyDevelopedMethods.map((nm) => nm.mef as NewlyDevelopedMethod),
          posLink: posRes !== null ? buildDemoPosLink(posRes.pos.mef as PlantOperatingStatesAnalysis) : EMPTY_POS_LINK,
          ieLink: ieRes !== null ? buildDemoIeLink(ieRes.ie.mef as InitiatingEventsAnalysis) : EMPTY_IE_LINK,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError((err as { message?: string }).message ?? "Could not load the example workbook");
      });
    return () => { cancelled = true; };
  }, []);

  const mutateEs = useCallback((mutator: (es: EventSequenceAnalysis) => EventSequenceAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, es: mutator(prev.es) }));
  }, []);

  if (error !== null) {
    return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  }
  if (data === null) {
    return <div className="posw"><main className="posmain"><p className="pws-status">Loading example workbook…</p></main></div>;
  }

  return (
    <EsWorkbookProvider data={data} editable={persona === "preparer"} mutateEs={mutateEs}>
      <EsWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={true}
        headerMeta={{
          projectName: "Generic-1 Reactor — Pre-operational PRA",
          workbookName: data.es.name,
          workbookVersion: data.es.version,
        }}
        renderDocuments={() => <EsDocumentsCard canEdit={false} />}
      />
    </EsWorkbookProvider>
  );
}

export { EsDemoPage };
