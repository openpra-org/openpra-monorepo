import { JSX, useEffect, useState } from "react";
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
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

function deriveDemoPosLink(ie: InitiatingEventsAnalysis): IePosLinkStatus {
  return {
    linkedPosWorkbookId: "example",
    linkedName: "POS Workbook Example",
    states: ie.applicablePlantOperatingStates.map((id) => ({
      id,
      name: id,
      operatingMode: "—",
      meanDurationHours: 0,
      meanEntryFrequency: 0,
    })),
    sources: [],
  };
}

function IeDemoPage(): JSX.Element {
  const [data, setData] = useState<IeWorkbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<IePersona>("preparer");

  useEffect(() => {
    let cancelled = false;
    fetchJson<IeBundleResponse>("/api/example-workbooks/ie-bundle")
      .then((res) => {
        if (cancelled) return;
        const ie = res.ie.mef as InitiatingEventsAnalysis;
        setData({
          ie,
          cc: res.configurationControl.mef as PRAConfigurationControl,
          nms: res.newlyDevelopedMethods.map((nm) => nm.mef as NewlyDevelopedMethod),
          posLink: deriveDemoPosLink(ie),
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

  return (
    <IeWorkbookProvider data={data}>
      <IeWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={true}
        headerMeta={{
          projectName: "Generic-1 Reactor — Pre-operational PRA",
          workbookName: data.ie.name,
          workbookVersion: data.ie.version,
          plantIdentity: data.ie.metadata.plantIdentity !== undefined
            ? {
                name: data.ie.metadata.plantIdentity.name,
                type: data.ie.metadata.plantIdentity.reactorType,
                power: data.ie.metadata.plantIdentity.thermalPower,
                vendor: data.ie.metadata.plantIdentity.vendor,
              }
            : undefined,
        }}
      />
    </IeWorkbookProvider>
  );
}

export { IeDemoPage };
