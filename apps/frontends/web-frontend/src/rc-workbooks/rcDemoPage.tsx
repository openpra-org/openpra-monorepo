import { JSX, useCallback, useEffect, useState } from "react";
import { type RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { RcWorkbench } from "./rcWorkbench";
import { RcWorkbookProvider, type RcWorkbookData } from "./rcWorkbookContext";
import { RcDocumentsCard } from "./rcDocumentsCard";
import { type RcPersona } from "./rcViewData";

interface RcExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface RcBundleResponse {
  rc: RcExampleResponse;
  configurationControl: RcExampleResponse;
  newlyDevelopedMethods: RcExampleResponse[];
}

function RcDemoPage(): JSX.Element {
  const [data, setData] = useState<RcWorkbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<RcPersona>("preparer");

  useEffect(() => {
    let cancelled = false;
    fetchJson<RcBundleResponse>("/api/example-workbooks/rc-bundle")
      .then((res) => {
        if (cancelled) return;
        setData({
          rc: res.rc.mef as RadiologicalConsequenceAnalysis,
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

  const mutateRc = useCallback((mutator: (rc: RadiologicalConsequenceAnalysis) => RadiologicalConsequenceAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, rc: mutator(prev.rc) }));
  }, []);

  if (error !== null) {
    return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  }
  if (data === null) {
    return <div className="posw"><main className="posmain"><p className="pws-status">Loading example workbook…</p></main></div>;
  }

  return (
    <RcWorkbookProvider data={data} editable={persona === "preparer"} mutateRc={mutateRc}>
      <RcWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={true}
        headerMeta={{
          projectName: data.rc.uuid === "rc-generic-2" ? "Generic-2 Reactor — Pre-operational PRA" : "Generic-1 Reactor — Pre-operational PRA",
          workbookName: data.rc.name,
          workbookVersion: data.rc.version,
        }}
        renderDocuments={() => <RcDocumentsCard canEdit={false} />}
      />
    </RcWorkbookProvider>
  );
}

export { RcDemoPage };
