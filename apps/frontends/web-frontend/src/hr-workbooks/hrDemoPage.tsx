import { JSX, useCallback, useEffect, useState } from "react";
import { type HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { fetchHrLinkedInputs } from "./hrWorkbookApi";
import { HrWorkbench } from "./hrWorkbench";
import { HrWorkbookProvider, type HrWorkbookData } from "./hrWorkbookContext";
import { type HrPersona } from "./hrViewData";

interface HrExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface HrBundleResponse {
  hr: HrExampleResponse;
  configurationControl: HrExampleResponse;
  newlyDevelopedMethods: HrExampleResponse[];
}

function HrDemoPage(): JSX.Element {
  const [data, setData] = useState<HrWorkbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<HrPersona>("preparer");

  useEffect(() => {
    let cancelled = false;
    fetchJson<HrBundleResponse>("/api/example-workbooks/hr-bundle")
      .then((res) => {
        if (cancelled) return;
        setData({
          hr: res.hr.mef as HumanReliabilityAnalysis,
          cc: res.configurationControl.mef as PRAConfigurationControl,
          nms: res.newlyDevelopedMethods.map((nm) => nm.mef as NewlyDevelopedMethod),
          links: null,
        });
        const variant = (res.hr.mef as HumanReliabilityAnalysis).uuid === "hr-generic-2" ? "htgr" : "sfr";
        fetchHrLinkedInputs(variant)
          .then((links) => { if (!cancelled) setData((prev) => (prev === null ? prev : { ...prev, links })); })
          .catch(() => undefined);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError((err as { message?: string }).message ?? "Could not load the example workbook");
      });
    return () => { cancelled = true; };
  }, []);

  const mutateHr = useCallback((mutator: (hr: HumanReliabilityAnalysis) => HumanReliabilityAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, hr: mutator(prev.hr) }));
  }, []);

  if (error !== null) {
    return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  }
  if (data === null) {
    return <div className="posw"><main className="posmain"><p className="pws-status">Loading example workbook…</p></main></div>;
  }

  return (
    <HrWorkbookProvider data={data} editable={persona === "preparer"} mutateHr={mutateHr}>
      <HrWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={true}
        headerMeta={{
          projectName: "Generic-1 Reactor — Pre-operational PRA",
          workbookName: data.hr.name,
          workbookVersion: data.hr.version,
        }}
      />
    </HrWorkbookProvider>
  );
}

export { HrDemoPage };
