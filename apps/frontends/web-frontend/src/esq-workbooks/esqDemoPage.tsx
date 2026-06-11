import { JSX, useEffect, useState } from "react";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { EsqWorkbench } from "./esqWorkbench";
import { EsqWorkbookProvider, type EsqWorkbookData } from "./esqWorkbookContext";
import { type EsqPersona } from "./esqViewData";

interface EsqExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface EsqBundleResponse {
  esq: EsqExampleResponse;
  configurationControl: EsqExampleResponse;
  newlyDevelopedMethods: EsqExampleResponse[];
}

function EsqDemoPage(): JSX.Element {
  const [data, setData] = useState<EsqWorkbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<EsqPersona>("preparer");

  useEffect(() => {
    let cancelled = false;
    fetchJson<EsqBundleResponse>("/api/example-workbooks/esq-bundle")
      .then((res) => {
        if (cancelled) return;
        setData({
          esq: res.esq.mef as EventSequenceQuantification,
          cc: res.configurationControl.mef as PRAConfigurationControl,
          nms: res.newlyDevelopedMethods.map((nm) => nm.mef as NewlyDevelopedMethod),
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
    <EsqWorkbookProvider data={data}>
      <EsqWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={true}
        headerMeta={{
          projectName: "Generic-1 Reactor — Pre-operational PRA",
          workbookName: data.esq.name,
          workbookVersion: data.esq.version,
        }}
      />
    </EsqWorkbookProvider>
  );
}

export { EsqDemoPage };
