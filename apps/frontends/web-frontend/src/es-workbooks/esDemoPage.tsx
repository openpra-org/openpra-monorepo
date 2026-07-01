import { JSX, useCallback, useEffect, useState } from "react";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { EsWorkbench } from "./esWorkbench";
import { EsWorkbookProvider, type EsWorkbookData } from "./esWorkbookContext";
import { type EsPosLinkStatus, type EsIeLinkStatus } from "./esWorkbookApi";
import { ES_POS_NAMES, type EsPersona } from "./esViewData";

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

function deriveDemoPosLink(es: EventSequenceAnalysis): EsPosLinkStatus {
  return {
    linkedPosWorkbookId: "example",
    linkedName: "POS Workbook Example",
    states: es.scopeDefinition.plantOperatingStateIds.map((id) => ({
      id,
      name: ES_POS_NAMES[id] ?? id,
      operatingMode: "—",
      meanDurationHours: 0,
      meanEntryFrequency: 0,
    })),
    sources: [],
  };
}

function deriveDemoIeLink(es: EventSequenceAnalysis): EsIeLinkStatus {
  return {
    linkedIeWorkbookId: "example",
    linkedName: "IE Workbook Example",
    initiators: es.scopeDefinition.initiatingEventIds.map((id) => ({ id, name: id, category: "—" })),
  };
}

function EsDemoPage(): JSX.Element {
  const [data, setData] = useState<EsWorkbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<EsPersona>("preparer");

  useEffect(() => {
    let cancelled = false;
    fetchJson<EsBundleResponse>("/api/example-workbooks/es-bundle")
      .then((res) => {
        if (cancelled) return;
        const es = res.es.mef as EventSequenceAnalysis;
        setData({
          es,
          cc: res.configurationControl.mef as PRAConfigurationControl,
          nms: res.newlyDevelopedMethods.map((nm) => nm.mef as NewlyDevelopedMethod),
          posLink: deriveDemoPosLink(es),
          ieLink: deriveDemoIeLink(es),
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
      />
    </EsWorkbookProvider>
  );
}

export { EsDemoPage };
