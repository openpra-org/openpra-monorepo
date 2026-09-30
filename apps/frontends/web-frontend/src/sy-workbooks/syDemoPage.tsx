import { JSX, useCallback, useEffect, useState } from "react";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import type { PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { SyWorkbench } from "./syWorkbench";
import {
  SyWorkbookProvider,
  type SyControlledCcfEstimateOption,
  type SyControlledCoincidentMaintenanceOption,
  type SyControlledComponentBoundaryOption,
  type SyControlledFailureModeOption,
  type SyControlledHumanFailureOption,
  type SyControlledParameterOption,
  type SyWorkbookData,
} from "./syWorkbookContext";
import {
  buildLinkedInputs,
  controlledCcfEstimateOptions,
  controlledCoincidentMaintenanceOptions,
  controlledComponentBoundaryOptions,
  controlledFailureModeOptions,
  controlledHumanFailureOptions,
  controlledParameterOptions,
  linkExampleEvents,
} from "./syLinks";
import { type SyPersona } from "./syViewData";

interface SyExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface SyBundleResponse {
  sy: SyExampleResponse;
  configurationControl: SyExampleResponse;
  newlyDevelopedMethods: SyExampleResponse[];
}

interface EsBundleResponse {
  es: { mef: EventSequenceAnalysis };
}

interface ScBundleResponse {
  sc: { mef: SuccessCriteriaDevelopment };
}

interface PosBundleResponse {
  pos: { mef: PlantOperatingStatesAnalysis };
}

interface DaBundleResponse {
  da: { slug: string; mef: DataAnalysis };
}

interface HrBundleResponse {
  hr: { slug: string; mef: HumanReliabilityAnalysis };
}

interface ExampleLinkedData {
  parameters: SyControlledParameterOption[];
  failureModes: SyControlledFailureModeOption[];
  humanFailures: SyControlledHumanFailureOption[];
  coincidentMaintenance: SyControlledCoincidentMaintenanceOption[];
  ccfEstimates: SyControlledCcfEstimateOption[];
  componentBoundaries: SyControlledComponentBoundaryOption[];
}

const NO_LINKED_DATA: ExampleLinkedData = { parameters: [], failureModes: [], humanFailures: [], coincidentMaintenance: [], ccfEstimates: [], componentBoundaries: [] };

const EXAMPLE_VARIANT = "htgr";

function SyDemoPage(): JSX.Element {
  const [data, setData] = useState<SyWorkbookData | null>(null);
  const [linked, setLinked] = useState<ExampleLinkedData>(NO_LINKED_DATA);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<SyPersona>("preparer");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchJson<SyBundleResponse>(`/api/example-workbooks/sy-bundle?example=${EXAMPLE_VARIANT}`),
      fetchJson<EsBundleResponse>(`/api/example-workbooks/es-bundle?example=${EXAMPLE_VARIANT}`),
      fetchJson<ScBundleResponse>(`/api/example-workbooks/sc-bundle?example=${EXAMPLE_VARIANT}`),
      fetchJson<PosBundleResponse>(`/api/example-workbooks/pos-bundle?example=${EXAMPLE_VARIANT}`),
      fetchJson<DaBundleResponse>(`/api/example-workbooks/da-bundle?example=${EXAMPLE_VARIANT}`),
      fetchJson<HrBundleResponse>(`/api/example-workbooks/hr-bundle?example=${EXAMPLE_VARIANT}`),
    ])
      .then(([res, es, sc, pos, da, hr]) => {
        if (cancelled) return;
        const daSources = [{ entry: { id: da.da.slug, name: da.da.mef.name }, workbook: { mef: da.da.mef } }];
        const hrSources = [{ entry: { id: hr.hr.slug, name: hr.hr.mef.name }, workbook: { mef: hr.hr.mef } }];
        const example = res.sy.mef as SystemsAnalysis;
        setLinked({
          parameters: controlledParameterOptions(daSources),
          failureModes: controlledFailureModeOptions(daSources),
          humanFailures: controlledHumanFailureOptions(hrSources),
          coincidentMaintenance: controlledCoincidentMaintenanceOptions(daSources),
          ccfEstimates: controlledCcfEstimateOptions(daSources),
          componentBoundaries: controlledComponentBoundaryOptions(daSources),
        });
        setData({
          sy: { ...example, systemBasicEvents: linkExampleEvents(example.systemBasicEvents, da.da.slug, da.da.mef) },
          cc: res.configurationControl.mef as PRAConfigurationControl,
          nms: res.newlyDevelopedMethods.map((nm) => nm.mef as NewlyDevelopedMethod),
          links: buildLinkedInputs({ ES: [], SC: [], POS: [], DA: [], HRA: [] }, {}, es.es.mef, sc.sc.mef, pos.pos.mef),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError((err as { message?: string }).message ?? "Could not load the example workbook");
      });
    return () => { cancelled = true; };
  }, []);

  const mutateSy = useCallback((mutator: (sy: SystemsAnalysis) => SystemsAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, sy: mutator(prev.sy) }));
  }, []);

  if (error !== null) {
    return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  }
  if (data === null) {
    return <div className="posw"><main className="posmain"><p className="pws-status">Loading example workbook…</p></main></div>;
  }

  return (
    <SyWorkbookProvider
      data={data}
      editable={persona === "preparer"}
      mutateSy={mutateSy}
      controlledParameters={linked.parameters}
      controlledFailureModes={linked.failureModes}
      controlledHumanFailures={linked.humanFailures}
      controlledCoincidentMaintenance={linked.coincidentMaintenance}
      controlledCcfEstimates={linked.ccfEstimates}
      controlledComponentBoundaries={linked.componentBoundaries}
    >
      <SyWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={true}
        headerMeta={{
          projectName: "Generic-1 Reactor — Pre-operational PRA",
          workbookName: data.sy.name,
          workbookVersion: data.sy.version,
        }}
      />
    </SyWorkbookProvider>
  );
}

export { SyDemoPage };
