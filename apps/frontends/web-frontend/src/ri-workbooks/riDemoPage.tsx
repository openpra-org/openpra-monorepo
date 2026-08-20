import { JSX, useCallback, useEffect, useState } from "react";
import { type RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { RiWorkbench } from "./riWorkbench";
import { RiDocumentsCard } from "./riDocumentsCard";
import { RiWorkbookProvider, type RiWorkbookData } from "./riWorkbookContext";
import { type RiPersona } from "./riViewData";

interface RiExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface RiBundleResponse {
  ri: RiExampleResponse;
  configurationControl: RiExampleResponse;
  newlyDevelopedMethods: RiExampleResponse[];
}

function RiDemoPage(): JSX.Element {
  const [data, setData] = useState<RiWorkbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<RiPersona>("preparer");

  useEffect(() => {
    let cancelled = false;
    fetchJson<RiBundleResponse>("/api/example-workbooks/ri-bundle")
      .then((res) => {
        if (cancelled) return;
        setData({
          ri: res.ri.mef as RiskIntegration,
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

  const mutateRi = useCallback((mutator: (ri: RiskIntegration) => RiskIntegration): void => {
    setData((prev) => (prev === null ? prev : { ...prev, ri: mutator(prev.ri) }));
  }, []);

  if (error !== null) {
    return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  }
  if (data === null) {
    return <div className="posw"><main className="posmain"><p className="pws-status">Loading example workbook…</p></main></div>;
  }

  return (
    <RiWorkbookProvider data={data} editable={persona === "preparer"} mutateRi={mutateRi}>
      <RiWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={true}
        headerMeta={{
          projectName: data.ri.uuid === "ri-generic-2" ? "Generic-2 Reactor — Pre-operational PRA" : "Generic-1 Reactor — Pre-operational PRA",
          workbookName: data.ri.name,
          workbookVersion: data.ri.version,
        }}
        renderDocuments={() => <RiDocumentsCard canEdit={persona === "preparer"} />}
      />
    </RiWorkbookProvider>
  );
}

export { RiDemoPage };
