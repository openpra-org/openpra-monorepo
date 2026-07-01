import { JSX, useCallback, useEffect, useState } from "react";
import { type DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { DaWorkbench } from "./daWorkbench";
import { DaWorkbookProvider, type DaWorkbookData } from "./daWorkbookContext";
import { type DaPersona } from "./daViewData";

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

  const mutateDa = useCallback((mutator: (da: DataAnalysis) => DataAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, da: mutator(prev.da) }));
  }, []);

  if (error !== null) {
    return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  }
  if (data === null) {
    return <div className="posw"><main className="posmain"><p className="pws-status">Loading example workbook…</p></main></div>;
  }

  return (
    <DaWorkbookProvider data={data} editable={persona === "preparer"} mutateDa={mutateDa}>
      <DaWorkbench
        data={data}
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
