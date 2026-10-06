import { JSX, useCallback, useEffect, useState } from "react";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { fetchJson } from "../api/client";
import { EsqWorkbench } from "./esqWorkbench";
import { EsqWorkbookProvider, useEsqUpstream, type EsqWorkbookData } from "./esqWorkbookContext";
import { NO_LINK_OPTIONS } from "./esqLinks";
import { type EsqPersona } from "./esqViewData";
import { loadEsqDaLinks } from "./esqDaLinks";

interface EsqExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface EsqBundleResponse {
  esq: EsqExampleResponse;
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
        setData({ esq: res.esq.mef as EventSequenceQuantification });
        const variant = (res.esq.mef as EventSequenceQuantification).uuid === "esq-generic-2" ? "htgr" : "sfr";
        void loadEsqDaLinks(null, res.esq.mef as EventSequenceQuantification, variant).then((daLinks) => {
          if (!cancelled) setData((prev) => (prev === null ? prev : { ...prev, daLinks }));
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError((err as { message?: string }).message ?? "Could not load the example workbook");
      });
    return () => { cancelled = true; };
  }, []);

  const upstream = useEsqUpstream(data?.esq, NO_LINK_OPTIONS);

  const mutateEsq = useCallback((mutator: (esq: EventSequenceQuantification) => EventSequenceQuantification): void => {
    setData((prev) => (prev === null ? prev : { ...prev, esq: mutator(prev.esq) }));
  }, []);

  if (error !== null) {
    return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  }
  if (data === null) {
    return <div className="posw"><main className="posmain"><p className="pws-status">Loading example workbook…</p></main></div>;
  }

  return (
    <EsqWorkbookProvider data={data} editable={persona === "preparer"} mutateEsq={mutateEsq} upstream={upstream}>
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
