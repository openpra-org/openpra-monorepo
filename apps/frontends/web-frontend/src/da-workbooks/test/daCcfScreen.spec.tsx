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
import { CcfWindows, STAGGERED_TOAST, TYPED_ALPHA_TOAST } from "../daCcfScreen";

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

function Harness({ start, context, toasts, onChange }: { start: DataAnalysis; context: DaDrawerContext; toasts: string[]; onChange: (da: DataAnalysis) => void }): JSX.Element {
  const [da, setDa] = useState<DataAnalysis>(start);
  return (
    <DaWorkbookProvider data={{ da, cc: CC, nms: [] }} editable mutateDa={(mutator) => setDa((current) => { const next = mutator(current); onChange(next); return next; })}>
      <CcfWindows context={context} onClose={() => undefined} onRetarget={() => undefined} onToast={(message) => { toasts.push(message); }} />
    </DaWorkbookProvider>
  );
}

function estimateOf(da: DataAnalysis, id: string): CcfParameterEstimation | undefined {
  return (da.ccfParameterEstimations ?? []).find((candidate) => candidate.uuid === id);
}

describe("common cause windows", () => {
  it("says how a staggered group reaches Systems Analysis and switches its hand-off to MGL", async () => {
    const toasts: string[] = [];
    let latest: DataAnalysis = DA_ANALYSIS_HTGR;
    render(<Harness start={DA_ANALYSIS_HTGR} context={{ kind: "daCcfGroup", id: "DA-CCF-05" }} toasts={toasts} onChange={(next) => { latest = next; }} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Testing" }), "STAGGERED");
    expect(toasts).toEqual([STAGGERED_TOAST]);
    const rods = estimateOf(latest, "DA-CCF-05");
    expect(rods?.testing).toBe("STAGGERED");
    expect(rods?.modelType).toBe("MGL");
    expect(rods?.parameters["beta"]).toBeCloseTo(0.013462465391039222, 12);
  });

  it("warns that typed alpha factors cannot be staggered yet", async () => {
    const toasts: string[] = [];
    render(<Harness start={DA_ANALYSIS} context={{ kind: "daCcfGroup", id: "DA-CCF-21" }} toasts={toasts} onChange={() => undefined} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Testing" }), "STAGGERED");
    expect(toasts).toEqual([TYPED_ALPHA_TOAST]);
  });

  it("warns when a staggered group is typed with alpha factors, but not when it keeps its MGL values", async () => {
    const toasts: string[] = [];
    render(<Harness start={DA_ANALYSIS_HTGR} context={{ kind: "daCcfFactors", id: "DA-CCF-04" }} toasts={toasts} onChange={() => undefined} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Method" }), "TYPED");
    expect(toasts).toEqual([]);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Model" }), "ALPHA_FACTOR");
    expect(toasts).toEqual([TYPED_ALPHA_TOAST]);
  });
});
