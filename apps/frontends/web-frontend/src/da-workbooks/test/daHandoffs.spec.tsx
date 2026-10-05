import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { IE_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/ie-seed";
import { POS_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/pos-seed";
import { SY_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sy-seed-htgr";
import { HR_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/hr-seed-htgr";
import { ESQ_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/esq-seed-htgr";
import { daImportNeeds, withAutoMapping, withLinkedValuesSynced, withNeedsMerged } from "../daSelectors";
import { withEstimates } from "../daFailures";
import { withUnavailability } from "../daUnavailability";
import { withCcf } from "../daCcf";
import { withFrequencies } from "../daFrequencies";
import { handoffFindings, handoffView, handoffsComplete, significant, withImportanceFromEsq } from "../daHandoffs";
import { DaWorkbookProvider, type DaUpstream } from "../daWorkbookContext";
import { HandoffScreen } from "../daHandoffScreen";

const NOW = "2026-10-05T00:00:00.000Z";

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

const UPSTREAM: DaUpstream = { options: { SY: [], IE: [], HRA: [], POS: [], SC: [], ESQ: [] }, sy: SY_ANALYSIS_HTGR, ie: IE_ANALYSIS, hr: HR_ANALYSIS_HTGR, pos: POS_ANALYSIS, esq: ESQ_ANALYSIS_HTGR };

function imported(seed: DataAnalysis): DataAnalysis {
  const merged = withLinkedValuesSynced({ ...seed, dataNeeds: withNeedsMerged(seed.dataNeeds, daImportNeeds(seed, UPSTREAM, NOW)) });
  return withCcf(withFrequencies(withUnavailability(withEstimates(withAutoMapping(merged)))));
}

const DA = imported(DA_ANALYSIS_HTGR);

function counts(da: DataAnalysis, upstream: DaUpstream): Record<string, number> {
  return handoffView(da, upstream).rows.reduce<Record<string, number>>((total, row) => ({ ...total, [`${row.element} ${row.status}`]: (total[`${row.element} ${row.status}`] ?? 0) + 1 }), {});
}

describe("hand-offs", () => {
  it("finds every consumer in step with the example values", () => {
    expect(counts(DA, UPSTREAM)).toEqual({ "SY IN_STEP": 72, "IE IN_STEP": 21, "HRA TYPED": 25, "POS TYPED": 7, "POS IN_STEP": 2, "ESQ IN_STEP": 12 });
    expect(handoffFindings(DA, UPSTREAM).filter((finding) => finding.severity !== "note")).toEqual([]);
    expect(handoffsComplete(DA, UPSTREAM)).toBe(true);
  });

  it("reports a changed DA value and a unit mismatch", () => {
    const changed: DataAnalysis = { ...DA, parameters: DA.parameters.map((parameter) => (parameter.uuid === "DA-IE-03" ? { ...parameter, value: 0.05 } : parameter)) };
    expect(handoffFindings(changed, UPSTREAM).map((finding) => [finding.check, finding.item])).toContainEqual(["Out of step", "IE IEG-03"]);
    const event = SY_ANALYSIS_HTGR.systemBasicEvents[0]!;
    const sy: SystemsAnalysis = {
      ...SY_ANALYSIS_HTGR,
      systemBasicEvents: [{ ...event, quantificationBasis: { kind: "FAILURE_RATE", failureRate: { value: 0.0975, unit: "HOUR" }, missionTime: { value: 24, unit: "HOUR" }, conversion: "EXPONENTIAL" }, controlledDataSource: { referenceType: "WORKBOOK_PARAMETER", workbookId: "example-da-htgr", entityId: "DA-IE-03" } }],
    };
    const units = handoffView(DA, { ...UPSTREAM, sy }).rows.find((row) => row.element === "SY");
    expect(units).toMatchObject({ status: "UNITS", detail: "SY reads the rate per hour, but DA gives it per year." });
  });

  it("reads risk significance back from ESQ", () => {
    expect(significant(0.006, undefined)).toBe(true);
    expect(significant(0.004, 1.9)).toBe(false);
    const bare: DataAnalysis = { ...DA, parameters: DA.parameters.map((parameter) => (parameter.uuid === "DA-BE-201" ? { ...parameter, isRiskSignificant: undefined, importance: undefined } : parameter)) };
    expect(handoffFindings(bare, UPSTREAM).map((finding) => [finding.check, finding.item])).toContainEqual(["Significant in ESQ", "DA-BE-201"]);
    const read = withImportanceFromEsq(bare, UPSTREAM, NOW).parameters.find((parameter) => parameter.uuid === "DA-BE-201");
    expect(read).toMatchObject({ isRiskSignificant: true, importance: { from: "ESQ", fussellVesely: 0.04, riskAchievementWorth: 1.9, entryIds: ["IMP-1 · 5"], importedAt: NOW } });
  });

  it("summarizes each consumer and lists its rows", async () => {
    render(<DaWorkbookProvider data={{ da: DA, cc: CC, nms: [] }} editable={false} mutateDa={() => undefined} upstream={UPSTREAM}><HandoffScreen openDrawer={() => undefined} /></DaWorkbookProvider>);
    expect(screen.getByRole("table", { name: "Hand-off summary" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /^IE/ }));
    const table = screen.getAllByRole("table").find((candidate) => within(candidate).queryByText("IEG-03") !== null);
    expect(table).toBeDefined();
  });
});
