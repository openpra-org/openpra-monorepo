import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import type { DataAnalysis, DataAnalysisParameter } from "interfaces-mef-types/da/data-analysis";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { IE_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/ie-seed";
import { POS_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/pos-seed";
import { daImportNeeds, withAutoMapping, withLinkedValuesSynced, withNeedsMerged } from "../daSelectors";
import { withEstimates } from "../daFailures";
import { withUnavailability } from "../daUnavailability";
import { withCcf } from "../daCcf";
import { frequencyEstimate, frequencyFindings, withFrequencies } from "../daFrequencies";
import { DaWorkbookProvider } from "../daWorkbookContext";
import { FrequencyScreen } from "../daFrequencyScreen";

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

const UPSTREAM = { options: { SY: [], IE: [], HRA: [], POS: [], SC: [], ESQ: [] }, ie: IE_ANALYSIS, pos: POS_ANALYSIS };

function imported(seed: DataAnalysis): DataAnalysis {
  const merged = withLinkedValuesSynced({ ...seed, dataNeeds: withNeedsMerged(seed.dataNeeds, daImportNeeds(seed, UPSTREAM, NOW)) });
  return withCcf(withFrequencies(withUnavailability(withEstimates(withAutoMapping(merged)))));
}

function parameterOf(da: DataAnalysis, id: string): DataAnalysisParameter {
  const found = da.parameters.find((parameter) => parameter.uuid === id);
  if (found === undefined) throw new Error(`${id} is missing.`);
  return found;
}

function withParameter(da: DataAnalysis, parameter: DataAnalysisParameter): DataAnalysis {
  return { ...da, parameters: [...da.parameters.filter((candidate) => candidate.uuid !== parameter.uuid), parameter] };
}

const DA = imported(DA_ANALYSIS_HTGR);

describe("initiating event frequencies", () => {
  it("reproduces every IE group mean and maps each imported group to its parameter", () => {
    const groups = IE_ANALYSIS.initiatingEventGroups;
    expect((DA.dataNeeds?.initiators ?? []).every((need) => need.parameterId === `DA-IE-${need.id.split("-")[1]}`)).toBe(true);
    for (const group of groups) {
      const held = group.meanFrequency;
      const value = typeof held === "number" ? held : held?.value;
      const estimate = frequencyEstimate(DA, parameterOf(DA, `DA-IE-${group.uuid.split("-")[1]}`));
      expect(estimate.problem).toBeUndefined();
      expect(estimate.mean).toBeCloseTo(value ?? 0, 12);
    }
    expect(frequencyFindings(DA).filter((finding) => finding.severity !== "note")).toEqual([]);
  });

  it("compares offsite power with the 2020 rates over the power and shutdown states", () => {
    const estimate = frequencyEstimate(DA, parameterOf(DA, "DA-IE-03"));
    const [power, shutdown] = estimate.comparisons;
    expect(power?.value).toBeCloseTo(0.022415351291226685, 12);
    expect(power?.ratio).toBeCloseTo(0.0975 / 0.022415351291226685, 9);
    expect(shutdown?.value).toBeCloseTo(0.034228276390151025 - 0.022415351291226685, 12);
  });

  it("sums parts by moments and keeps only the states that fit each part", () => {
    const loop = parameterOf(DA, "DA-IE-03");
    const twoParts: DataAnalysisParameter = {
      ...loop,
      uuid: "DA-IE-T1",
      frequency: { ...loop.frequency, parts: [
        { id: "P-1", label: "Power", per: "CRITICAL_YEAR", stateIds: loop.stateIds, useId: "U-2", priorForm: "AS_PUBLISHED", method: "PRIOR" },
        { id: "P-2", label: "Shutdown", per: "SHUTDOWN_YEAR", stateIds: loop.stateIds, useId: "U-3", priorForm: "AS_PUBLISHED", method: "PRIOR" },
      ], comparisons: [] },
    };
    const estimate = frequencyEstimate(withParameter(DA, twoParts), twoParts);
    expect(estimate.mean).toBeCloseTo(0.034228276390151025, 12);
    expect(estimate.fit).toBe("GAMMA_MOMENTS");
    expect(estimate.parts[0]?.share.ignored).toEqual(["POS-04", "POS-05", "POS-06", "POS-07", "POS-08"]);
  });

  it("updates a Jeffreys prior with typed events", () => {
    const base = parameterOf(DA, "DA-IE-06");
    const counted: DataAnalysisParameter = {
      ...base,
      uuid: "DA-IE-T2",
      frequency: { category: "I", categoryReason: "Test.", parts: [{ id: "P-1", label: "Counts", per: "CALENDAR_YEAR", priorForm: "JEFFREYS", method: "BAYES", evidence: [
        { id: "EV-1", origin: "TECHNOLOGY", failuresFrom: "TYPED", exposureFrom: "TYPED", failures: 2, exposure: 5, unit: "YEARS", boundary: "SAME", reason: "Test.", included: true },
      ] }] },
    };
    expect(frequencyEstimate(withParameter(DA, counted), counted).mean).toBeCloseTo(0.5, 12);
  });

  it("asks for a reason behind a large gap and for a wider spread at category III", () => {
    const base = parameterOf(DA, "DA-IE-04");
    const bare: DataAnalysisParameter = {
      ...base,
      frequency: { ...base.frequency, parts: (base.frequency?.parts ?? []).map((part) => ({ ...part, reason: undefined })), category: "III", comparisons: (base.frequency?.comparisons ?? []).map((comparison) => ({ ...comparison, reason: undefined })) },
    };
    const checks = frequencyFindings(withParameter(DA, bare)).filter((finding) => finding.item === "DA-IE-04").map((finding) => finding.check);
    expect(checks).toEqual(expect.arrayContaining(["Comparison gap", "Uncertainty not widened"]));
  });

  it("stops a value that IE and DA each take from the other", () => {
    const base = parameterOf(DA, "DA-IE-05");
    const linked: DataAnalysisParameter = { ...base, valueMode: "LINKED", valueLink: { element: "IE", needId: "IEG-05" } };
    const findings = frequencyFindings(withParameter(DA, linked)).filter((finding) => finding.item === "DA-IE-05");
    expect(findings.map((finding) => finding.check)).toEqual(["Circular link"]);
  });

  it("lists the groups and their categories, and shows the comparison gap", async () => {
    render(<DaWorkbookProvider data={{ da: DA, cc: CC, nms: [] }} editable={false} mutateDa={() => undefined}><FrequencyScreen openDrawer={() => undefined} /></DaWorkbookProvider>);
    const groups = screen.getByRole("table", { name: "Groups" });
    expect(within(groups).getByRole("button", { name: "DA-IE-01" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Estimates (21 of 21)" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Comparison" }));
    const comparison = screen.getByRole("table", { name: "Comparison" });
    const row = within(comparison).getByRole("button", { name: "DA-IE-03" }).closest("tr");
    expect(row).toHaveTextContent("8.3 times");
  });
});
