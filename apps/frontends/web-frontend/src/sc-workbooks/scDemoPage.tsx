import { JSX, useCallback, useEffect, useState } from "react";
import { type SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { ScWorkbench } from "./scWorkbench";
import { ScWorkbookProvider, type ScWorkbookData } from "./scWorkbookContext";
import { type ScPersona } from "./scViewData";

interface ScExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface ScBundleResponse {
  sc: ScExampleResponse;
  configurationControl: ScExampleResponse;
  newlyDevelopedMethods: ScExampleResponse[];
}

function ScDemoPage(): JSX.Element {
  const [data, setData] = useState<ScWorkbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<ScPersona>("preparer");

  useEffect(() => {
    let cancelled = false;
    fetchJson<ScBundleResponse>("/api/example-workbooks/sc-bundle")
      .then((res) => {
        if (cancelled) return;
        setData({
          sc: res.sc.mef as SuccessCriteriaDevelopment,
          cc: res.configurationControl.mef as PRAConfigurationControl,
          nms: res.newlyDevelopedMethods.map((nm) => nm.mef as NewlyDevelopedMethod),
          links: null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError((err as { message?: string }).message ?? "Could not load the example workbook");
      });
    return () => { cancelled = true; };
  }, []);

  const mutateSc = useCallback((mutator: (sc: SuccessCriteriaDevelopment) => SuccessCriteriaDevelopment): void => {
    setData((prev) => (prev === null ? prev : { ...prev, sc: mutator(prev.sc) }));
  }, []);

  if (error !== null) {
    return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  }
  if (data === null) {
    return <div className="posw"><main className="posmain"><p className="pws-status">Loading example workbook…</p></main></div>;
  }

  return (
    <ScWorkbookProvider data={data} editable={persona === "preparer"} mutateSc={mutateSc}>
      <ScWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={true}
        headerMeta={{
          projectName: "Generic SFR Pre-operational PRA",
          workbookName: data.sc.name,
          workbookVersion: data.sc.version,
        }}
      />
    </ScWorkbookProvider>
  );
}

export { ScDemoPage };
