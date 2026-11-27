import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { fetchJson } from "../api/client";
import { WorkbookViewMemory } from "../workbooks/workbookViewMemory";
import { useUncertaintyVersion } from "../newly-developed-methods/shared/useUncertainty";
import { EsqWorkbench } from "./esqWorkbench";
import { EsqWorkbookProvider, useEsqUpstream, type EsqWorkbookData } from "./esqWorkbookContext";
import { NO_LINK_OPTIONS } from "./esqLinks";
import { type EsqPersona } from "./esqViewData";
import { caseOptions, loadEsqDaLinks } from "./esqDaLinks";
import { esqSavedOf, esqViewOf } from "./esqLinkedData";

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
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError((err as { message?: string }).message ?? "Could not load the example workbook");
      });
    return () => { cancelled = true; };
  }, []);

  const linkedDaId = data?.esq.linkedWorkbooks?.DA;
  useEffect(() => {
    let cancelled = false;
    void loadEsqDaLinks(linkedDaId).then((daLinks) => {
      if (!cancelled) setData((prev) => (prev === null ? prev : { ...prev, daLinks }));
    });
    return () => { cancelled = true; };
  }, [linkedDaId]);

  const { upstream } = useEsqUpstream(data?.esq, NO_LINK_OPTIONS);
  const uncertaintyVersion = useUncertaintyVersion();
  const daLinks = data?.daLinks;
  const daCases = useMemo(() => (uncertaintyVersion < 0 ? [] : caseOptions(daLinks ?? [])), [daLinks, uncertaintyVersion]);

  const mutateEsq = useCallback((mutator: (esq: EventSequenceQuantification) => EventSequenceQuantification): void => {
    setData((prev) => (prev === null ? prev : { ...prev, esq: esqSavedOf(mutator(esqViewOf(prev.esq, upstream, daCases))) }));
  }, [upstream, daCases]);

  const viewData = useMemo<EsqWorkbookData | null>(() => (data === null ? null : { ...data, esq: esqViewOf(data.esq, upstream, daCases) }), [data, upstream, daCases]);

  if (error !== null) {
    return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  }
  if (data === null || viewData === null) {
    return <div className="posw"><main className="posmain"><p className="pws-status">Loading example workbook…</p></main></div>;
  }

  return (
    <EsqWorkbookProvider data={viewData} editable={persona === "preparer"} mutateEsq={mutateEsq} upstream={upstream}>
      <WorkbookViewMemory scope={null}>
        <EsqWorkbench
          data={viewData}
          persona={persona}
          setPersona={setPersona}
          showPersonaPicker={true}
          headerMeta={{
            projectName: "Generic-1 Reactor — Pre-operational PRA",
            workbookName: data.esq.name,
            workbookVersion: data.esq.version,
          }}
        />
      </WorkbookViewMemory>
    </EsqWorkbookProvider>
  );
}

export { EsqDemoPage };
