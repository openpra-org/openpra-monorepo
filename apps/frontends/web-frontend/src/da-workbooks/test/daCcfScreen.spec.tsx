import { JSX, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import type { CcfParameterEstimation, DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { DA_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed";
import { DaWorkbookProvider } from "../daWorkbookContext";
import type { DaDrawerContext } from "../daScreens";
import { CcfWindows } from "../daCcfScreen";

const NOW = "2026-10-04T12:00:00.000Z";

const CC: PRAConfigurationControl = {
  uuid: "cc-test",
  name: "CC test",
  type: TechnicalElementTypes.PRA_CONFIGURATION_CONTROL,
  version: "1",
  created: NOW,
  modified: NOW,
  workflowState: "DRAFT",
  workflowHistory: [],
  plantStage: "PRE_OPERATIONAL",
  metadata: { versionInfo: { version: "1", lastUpdated: NOW, schemaVersion: "0.0.1" }, analysisDate: NOW, analysts: [], reviewers: [], scope: "", limitations: [], lastModifiedDate: NOW, lastModifiedBy: "tester" },
  conformanceMatrix: [],
  internalReviewComments: { comments: [], openCount: 0, resolvedCount: 0 },
  activePeerReviewIds: [],
  activeAuditIds: [],
  freezeDate: "2026-05-01",
  monitoredChanges: [],
  praUpdateRecords: [],
  pendingChangeAssessments: [],
  computerCodeControls: [],
  documentation: { programDescription: "", changeMonitoringProcess: "", praMaintenanceProcess: "", cumulativeImpactProcess: "", codeControlProcess: "", implementsSrs: [] },
  invokedPriorToFirstPeerReview: false,
};

function Harness({ start, context, onChange }: { start: DataAnalysis; context: DaDrawerContext; onChange: (da: DataAnalysis) => void }): JSX.Element {
  const [da, setDa] = useState<DataAnalysis>(start);
  return (
    <DaWorkbookProvider data={{ da, cc: CC, nms: [] }} editable mutateDa={(mutator) => setDa((current) => { const next = mutator(current); onChange(next); return next; })}>
      <CcfWindows context={context} onClose={() => undefined} onRetarget={() => undefined} />
    </DaWorkbookProvider>
  );
}

function estimateOf(da: DataAnalysis, id: string): CcfParameterEstimation | undefined {
  return (da.ccfParameterEstimations ?? []).find((candidate) => candidate.uuid === id);
}

describe("common cause windows", () => {
  it("keeps the Dirichlet when the testing scheme changes and hands the scheme on with it", async () => {
    let latest: DataAnalysis = DA_ANALYSIS_HTGR;
    render(<Harness start={DA_ANALYSIS_HTGR} context={{ kind: "daCcfGroup", id: "DA-CCF-05" }} onChange={(next) => { latest = next; }} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Testing" }), "STAGGERED");
    const rods = estimateOf(latest, "DA-CCF-05");
    expect(rods?.testing).toBe("STAGGERED");
    expect(rods?.factors).toEqual({ model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [880.1, 12.01] } } });
  });

  it("moves the testing scheme of typed alpha factors with the group", async () => {
    let latest: DataAnalysis = DA_ANALYSIS;
    render(<Harness start={DA_ANALYSIS} context={{ kind: "daCcfGroup", id: "DA-CCF-21" }} onChange={(next) => { latest = next; }} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Testing" }), "STAGGERED");
    const software = estimateOf(latest, "DA-CCF-21");
    expect(software?.testing).toBe("STAGGERED");
    expect(software?.factors).toEqual({ model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "FIXED", values: [0, 0, 0, 1] } } });
  });

  it("types factors in the shared editor, starting from the derived Dirichlet", async () => {
    let latest: DataAnalysis = DA_ANALYSIS_HTGR;
    render(<Harness start={DA_ANALYSIS_HTGR} context={{ kind: "daCcfFactors", id: "DA-CCF-04" }} onChange={(next) => { latest = next; }} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Method" }), "TYPED");
    expect(estimateOf(latest, "DA-CCF-04")?.factors).toEqual({ model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [880.1, 12.01] } } });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Model" }), "BETA_FACTOR");
    const typed = estimateOf(latest, "DA-CCF-04");
    expect(typed?.method).toBe("TYPED");
    expect(typed?.factors?.model).toBe("BETA_FACTOR");
  });
});
