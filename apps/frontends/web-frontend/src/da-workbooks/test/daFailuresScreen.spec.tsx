import { JSX, useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { DaWorkbookProvider } from "../daWorkbookContext";
import { FailureWindows, FailuresScreen } from "../daFailuresScreen";

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

function Harness({ children, onChange }: { children: (da: DataAnalysis) => JSX.Element; onChange: (da: DataAnalysis) => void }): JSX.Element {
  const [da, setDa] = useState<DataAnalysis>(DA_ANALYSIS_HTGR);
  return (
    <DaWorkbookProvider data={{ da, cc: CC, nms: [] }} editable mutateDa={(mutator) => setDa((current) => { const next = mutator(current); onChange(next); return next; })}>
      {children(da)}
    </DaWorkbookProvider>
  );
}

describe("FailuresScreen", () => {
  it("plots an estimate against its prior and evidence, and lists the judged records", async () => {
    render(<Harness onChange={() => undefined}>{() => <FailuresScreen openDrawer={() => undefined} />}</Harness>);
    expect(screen.getByRole("tab", { name: "Estimates (31 of 31)" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /^Estimates/ }));
    const row = screen.getByRole("button", { name: "DA-BE-205" }).closest("tr");
    expect(row?.textContent).toContain("Bayes update");
    expect(row?.textContent).toContain("2.32E-4");
    await userEvent.click(screen.getByRole("button", { name: "Plot the distribution of DA-BE-205" }));
    expect(screen.getByRole("button", { name: /^Estimate/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Prior used/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Evidence alone/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /^Records/ }));
    const sets = screen.getByRole("table", { name: "Record sets" });
    expect(within(sets).getByRole("row", { name: /RS-01/ }).textContent).toContain("15");
    expect(within(screen.getByRole("table", { name: "Records" })).getAllByText("Counts")).toHaveLength(2);
  });

  it("recomputes the estimate when the evidence window leaves the evidence out", async () => {
    let latest: DataAnalysis = DA_ANALYSIS_HTGR;
    render(<Harness onChange={(next) => { latest = next; }}>{() => <FailureWindows context={{ kind: "daEvidence", id: "DA-BE-205" }} onClose={() => undefined} onRetarget={() => undefined} />}</Harness>);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "In the update" }), "no");
    const circulator = latest.parameters.find((parameter) => parameter.uuid === "DA-BE-205");
    expect(circulator?.evidence?.[0]?.included).toBe(false);
    expect(circulator?.value).toBeCloseTo(1 - (((0.5 / (90.5 / 785000)) / ((0.5 / (90.5 / 785000)) + 24)) ** 0.5), 6);
  });
});
