import { JSX, useCallback, useEffect, useState } from "react";
import { type MechanisticSourceTermAnalysis } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { MsWorkbench } from "./msWorkbench";
import { MsWorkbookProvider, type MsWorkbookData } from "./msWorkbookContext";
import { type MsPersona } from "./msViewData";

interface MsExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface MsBundleResponse {
  ms: MsExampleResponse;
  configurationControl: MsExampleResponse;
  newlyDevelopedMethods: MsExampleResponse[];
}

function MsDemoPage(): JSX.Element {
  const [data, setData] = useState<MsWorkbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<MsPersona>("preparer");

  useEffect(() => {
    let cancelled = false;
    fetchJson<MsBundleResponse>("/api/example-workbooks/ms-bundle")
      .then((res) => {
        if (cancelled) return;
        setData({
          ms: res.ms.mef as MechanisticSourceTermAnalysis,
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

  const mutateMs = useCallback((mutator: (ms: MechanisticSourceTermAnalysis) => MechanisticSourceTermAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, ms: mutator(prev.ms) }));
  }, []);

  if (error !== null) {
    return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  }
  if (data === null) {
    return <div className="posw"><main className="posmain"><p className="pws-status">Loading example workbook…</p></main></div>;
  }

  return (
    <MsWorkbookProvider data={data} editable={persona === "preparer"} mutateMs={mutateMs}>
      <MsWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={true}
        headerMeta={{
          projectName: "Generic-1 Reactor — Pre-operational PRA",
          workbookName: data.ms.name,
          workbookVersion: data.ms.version,
        }}
      />
    </MsWorkbookProvider>
  );
}

export { MsDemoPage };
