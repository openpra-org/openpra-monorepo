import { JSX, useCallback, useEffect, useState } from "react";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { type DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import { fetchJson } from "../api/client";
import { EXAMPLE_PREFIX, daFrequencyOptions } from "../ie-workbooks/ieDaLinks";
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

interface SyBundleResponse {
  sy: { mef: unknown };
}

interface DaBundleResponse {
  da: { mef: DataAnalysis };
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
    groups: ie.initiatingEventGroups.map((group) => ({ id: group.uuid, name: group.name })),
  };
}

const EMPTY_POS_LINK: EsPosLinkStatus = { linkedPosWorkbookId: null, linkedName: null, states: [], sources: [] };
const EMPTY_IE_LINK: EsIeLinkStatus = { linkedIeWorkbookId: null, linkedName: null, groups: [] };

function EsDemoPage(): JSX.Element {
  const [data, setData] = useState<EsWorkbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<EsPersona>("preparer");

  useEffect(() => {
    let cancelled = false;
    fetchJson<EsBundleResponse>("/api/example-workbooks/es-bundle")
      .then(async (res) => {
        const es = res.es.mef as EventSequenceAnalysis;
        const variant = es.uuid === "es-generic-2" ? "htgr" : "sfr";
        const [posRes, ieRes, syRes, daRes] = await Promise.all([
          fetchJson<PosBundleResponse>(`/api/example-workbooks/pos-bundle?example=${variant}`).catch((): PosBundleResponse | null => null),
          fetchJson<IeBundleResponse>(`/api/example-workbooks/ie-bundle?example=${variant}`).catch((): IeBundleResponse | null => null),
          fetchJson<SyBundleResponse>(`/api/example-workbooks/sy-bundle?example=${variant}`).catch((): SyBundleResponse | null => null),
          fetchJson<DaBundleResponse>(`/api/example-workbooks/da-bundle?example=${variant}`).catch((): DaBundleResponse | null => null),
        ]);
        if (cancelled) return;
        setData({
          es,
          posLink: posRes !== null ? buildDemoPosLink(posRes.pos.mef as PlantOperatingStatesAnalysis) : EMPTY_POS_LINK,
          ieLink: ieRes !== null ? buildDemoIeLink(ieRes.ie.mef as InitiatingEventsAnalysis) : EMPTY_IE_LINK,
          daFrequencies: daRes === null ? [] : daFrequencyOptions([{ id: `${EXAMPLE_PREFIX}${variant}`, name: daRes.da.mef.name, mef: daRes.da.mef }]),
          ...(syRes === null ? {} : {
            upstream: { sy: syRes.sy.mef as SystemsAnalysis },
            faultTreeSource: {
              workbookId: `example-sy-${variant}`,
              workbookName: `${variant.toUpperCase()} Systems Analysis example`,
              mef: syRes.sy.mef as SystemsAnalysis,
            },
          }),
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
          projectName: "Generic SFR Pre-operational PRA",
          workbookName: data.es.name,
          workbookVersion: data.es.version,
        }}
        renderDocuments={() => <EsDocumentsCard canEdit={false} />}
      />
    </EsWorkbookProvider>
  );
}

export { EsDemoPage };
