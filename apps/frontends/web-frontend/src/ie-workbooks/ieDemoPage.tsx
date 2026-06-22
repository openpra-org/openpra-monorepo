import { JSX, useEffect, useState } from "react";
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { IeWorkbench } from "./ieWorkbench";
import { IeWorkbookProvider, type IeWorkbookData } from "./ieWorkbookContext";
import { type IePosLinkStatus } from "./ieWorkbookApi";
import { type IePersona } from "./ieViewData";

interface IeExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface IeBundleResponse {
  ie: IeExampleResponse;
  configurationControl: IeExampleResponse;
  newlyDevelopedMethods: IeExampleResponse[];
}

interface PosBundleResponse {
  pos: { mef: unknown };
}

function buildPosLink(ie: InitiatingEventsAnalysis, pos: PlantOperatingStatesAnalysis): IePosLinkStatus {
  const wanted = new Set(ie.applicablePlantOperatingStates);
  const wantedStates = pos.plantOperatingStates.filter((s) => wanted.has(s.uuid));
  const states = wantedStates.map((s) => ({
    id: s.uuid,
    name: s.name,
    operatingMode: s.operatingMode,
    meanDurationHours: s.meanDurationHours,
    meanEntryFrequency: typeof s.meanEntryFrequency === "number" ? s.meanEntryFrequency : s.meanEntryFrequency.value,
  }));
  const sourceById = new Map<string, { id: string; name: string; location: string; barriers: string[] }>();
  for (const s of wantedStates) {
    for (const src of s.radioactiveMaterialSources) {
      if (!sourceById.has(src.uuid)) {
        sourceById.set(src.uuid, { id: src.uuid, name: src.name, location: src.location, barriers: src.barriers });
      }
    }
  }
  return {
    linkedPosWorkbookId: "example",
    linkedName: "Generic HTGR POS Workbook",
    states,
    sources: Array.from(sourceById.values()),
  };
}

function IeDemoPage(): JSX.Element {
  const [data, setData] = useState<IeWorkbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<IePersona>("preparer");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchJson<IeBundleResponse>("/api/example-workbooks/ie-bundle"),
      fetchJson<PosBundleResponse>("/api/example-workbooks/pos-bundle"),
    ])
      .then(([res, posRes]) => {
        if (cancelled) return;
        const ie = res.ie.mef as InitiatingEventsAnalysis;
        const pos = posRes.pos.mef as PlantOperatingStatesAnalysis;
        setData({
          ie,
          cc: res.configurationControl.mef as PRAConfigurationControl,
          nms: res.newlyDevelopedMethods.map((nm) => nm.mef as NewlyDevelopedMethod),
          posLink: buildPosLink(ie, pos),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError((err as { message?: string }).message ?? "Could not load the example workbook");
      });
    return () => { cancelled = true; };
  }, []);

  if (error !== null) {
    return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  }
  if (data === null) {
    return <div className="posw"><main className="posmain"><p className="pws-status">Loading example workbook…</p></main></div>;
  }

  const identity = data.ie.metadata.plantIdentity;
  const stageLabel = data.ie.plantStage === "OPERATIONAL" ? "Operational" : "Pre-operational";

  return (
    <IeWorkbookProvider data={data}>
      <IeWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={true}
        headerMeta={{
          projectName: identity !== undefined ? `${identity.name} ${stageLabel} PRA` : "Generic HTGR Pre-operational PRA",
          workbookName: data.ie.name,
          workbookVersion: data.ie.version,
          plantIdentity: identity !== undefined
            ? {
                name: identity.name,
                type: identity.reactorType,
                power: identity.thermalPower,
                vendor: identity.vendor,
              }
            : undefined,
        }}
      />
    </IeWorkbookProvider>
  );
}

export { IeDemoPage };
