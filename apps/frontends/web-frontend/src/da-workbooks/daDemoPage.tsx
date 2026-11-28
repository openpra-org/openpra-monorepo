import { JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { DaWorkbench } from "./daWorkbench";
import { DaWorkbookProvider, EMPTY_UPSTREAM, useDaUpstream, type DaWorkbookData } from "./daWorkbookContext";
import { type DaPersona } from "./daViewData";
import { daSavedOf, daViewOf } from "./daLinkedData";

interface DaExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface DaBundleResponse {
  da: DaExampleResponse;
  configurationControl: DaExampleResponse;
  newlyDevelopedMethods: DaExampleResponse[];
}

function DaDemoPage(): JSX.Element {
  const [data, setData] = useState<DaWorkbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<DaPersona>("preparer");

  useEffect(() => {
    let cancelled = false;
    fetchJson<DaBundleResponse>("/api/example-workbooks/da-bundle")
      .then((res) => {
        if (cancelled) return;
        setData({
          da: res.da.mef as DataAnalysis,
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

  const upstream = useDaUpstream(data?.da, EMPTY_UPSTREAM.options);
  const viewUpstream = useRef(upstream);
  viewUpstream.current = upstream;

  const mutateDa = useCallback((mutator: (da: DataAnalysis) => DataAnalysis): void => {
    setData((prev) => {
      if (prev === null) return prev;
      const before = daViewOf(prev.da, viewUpstream.current);
      return { ...prev, da: daSavedOf(mutator(before), before, viewUpstream.current) };
    });
  }, []);

  const viewData = useMemo<DaWorkbookData | null>(() => (data === null ? null : { ...data, da: daViewOf(data.da, upstream) }), [data, upstream]);

  if (error !== null) {
    return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  }
  if (data === null || viewData === null) {
    return <div className="posw"><main className="posmain"><p className="pws-status">Loading example workbook…</p></main></div>;
  }

  return (
    <DaWorkbookProvider data={viewData} editable={persona === "preparer"} mutateDa={mutateDa} upstream={upstream}>
      <DaWorkbench
        data={viewData}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={true}
        headerMeta={{
          projectName: "Generic-1 Reactor — Pre-operational PRA",
          workbookName: data.da.name,
          workbookVersion: data.da.version,
        }}
      />
    </DaWorkbookProvider>
  );
}

export { DaDemoPage };
