import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { DA_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed";
import { IE_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/ie-seed";
import { IE_ANALYSIS_SFR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/ie-seed-sfr";
import { POS_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/pos-seed";
import { POS_ANALYSIS_SFR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/pos-seed-sfr";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { uncertaintyIdle } from "../../newly-developed-methods/shared/useUncertainty";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { daImportNeeds, withAutoMapping, withLinkedValuesSynced, withNeedsMerged } from "../daSelectors";
import { withEstimates } from "../daFailures";
import { withUnavailability } from "../daUnavailability";
import { withCcf } from "../daCcf";
import { withFrequencies } from "../daFrequencies";
import { distributionSummary, sensitivityResult, uncertaintyComplete, uncertaintyFindings } from "../daUncertainty";
import { DaWorkbookProvider } from "../daWorkbookContext";
import { UncertaintyScreen } from "../daUncertaintyScreen";
import { sciText } from "../daShared";
import { linkScExamples } from "./daScExamples";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

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

const OPTIONS = { SY: [], IE: [], HRA: [], POS: [], SC: [], ESQ: [] };

function imported(seed: DataAnalysis, upstream: Parameters<typeof daImportNeeds>[1]): DataAnalysis {
  const merged = withLinkedValuesSynced({ ...seed, dataNeeds: withNeedsMerged(seed.dataNeeds, daImportNeeds(seed, upstream, NOW)) });
  return withCcf(withFrequencies(withUnavailability(withEstimates(withAutoMapping(merged)))));
}

let HTGR: DataAnalysis = DA_ANALYSIS_HTGR;

let SFR: DataAnalysis = DA_ANALYSIS;

linkScExamples();

beforeAll(async () => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
  HTGR = await settledWithPraxis(() => imported(DA_ANALYSIS_HTGR, { options: OPTIONS, ie: IE_ANALYSIS, pos: POS_ANALYSIS, scReferenced: [] }));
  SFR = await settledWithPraxis(() => imported(DA_ANALYSIS, { options: OPTIONS, ie: IE_ANALYSIS_SFR, pos: POS_ANALYSIS_SFR, scReferenced: [] }));
}, 120_000);

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

async function settle(): Promise<void> {
  for (let round = 0; round < 40; round += 1) {
    await act(async () => {
      do await new Promise((resolve) => setTimeout(resolve, 0));
      while (!uncertaintyIdle());
    });
    if (uncertaintyIdle()) return;
  }
  throw new Error("PRAXIS answers did not settle.");
}

function caseOf(da: DataAnalysis, id: string): Promise<ReturnType<typeof sensitivityResult>> {
  const item = (da.sensitivityCases ?? []).find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`${id} is missing.`);
  return settledWithPraxis(() => sensitivityResult(da, item));
}

function findings(da: DataAnalysis): Promise<ReturnType<typeof uncertaintyFindings>> {
  return settledWithPraxis(() => uncertaintyFindings(da));
}

function parameterOf(da: DataAnalysis, id: string): DataAnalysis["parameters"][number] {
  const parameter = da.parameters.find((candidate) => candidate.uuid === id);
  if (parameter === undefined) throw new Error(id);
  return parameter;
}

describe("uncertainty", () => {
  it("passes the register, cases and assumptions of both examples", async () => {
    expect((await findings(HTGR)).filter((finding) => finding.severity !== "note")).toEqual([]);
    expect((await findings(SFR)).filter((finding) => finding.severity !== "note")).toEqual([]);
    expect(await settledWithPraxis(() => uncertaintyComplete(HTGR))).toBe(true);
  }, 60_000);

  it("summarizes a component estimate through PRAXIS", async () => {
    const monitor = await settledWithPraxis(() => distributionSummary(HTGR, parameterOf(HTGR, "DA-BE-223")));
    expect(monitor).toMatchObject({ family: "Truncated", sampled: false });
    expect(monitor.pending).toBeUndefined();
    expect(monitor.problem).toBeUndefined();
    const sigma = Math.log(10) / 1.6448536269514722;
    expect(monitor.errorFactor).toBeCloseTo(10, 3);
    expect((monitor.median ?? 0) / (0.00036 * Math.exp((-sigma * sigma) / 2))).toBeCloseTo(1, 5);
    const circulator = await settledWithPraxis(() => distributionSummary(HTGR, parameterOf(HTGR, "DA-BE-205")));
    const rate = 0.5 / ((90.5 / 1570000) * 2.39710255853434) + 253886;
    expect(circulator.family).toBe("Mission model");
    expect(circulator.sampled).toBe(true);
    expect(Math.abs((circulator.mean ?? 0) / (1 - (rate / (rate + 24)) ** 2.5) - 1)).toBeLessThan(5e-3);
  });

  it("recomputes each kind of case through the estimates", async () => {
    const sweep = await caseOf(HTGR, "SS-1");
    expect(sweep).toMatchObject({ low: expect.closeTo(0.001799877471427639, 12), high: expect.closeTo(0.010739690083886403, 12) });
    expect((sweep.low ?? 0) / (0.5 * 0.0036)).toBeLessThan(1);
    expect((sweep.high ?? 0) / (3 * 0.0036)).toBeGreaterThan(0.99);
    expect(Math.abs(((await caseOf(HTGR, "SS-2")).high ?? 0) / 0.0005974621337499246 - 1)).toBeLessThan(1e-6);
    expect(await caseOf(HTGR, "SS-5")).toMatchObject({ low: 0.034228276390151025, high: 0.0975 });
    const testing = await caseOf(HTGR, "SS-6");
    expect((testing.high ?? 0) / (testing.low ?? 1)).toBeCloseTo(1.9856, 3);
    expect(Math.abs(((await caseOf(SFR, "SS-6")).high ?? 0) / 0.00017300976092140088 - 1)).toBeLessThan(1e-6);
  });

  it("asks for a register and checks what the entries point at", async () => {
    const empty = await findings({ ...HTGR, uncertaintyRegister: [] });
    expect(empty.find((finding) => finding.check === "Empty register")?.severity).toBe("error");
    const broken = await findings({
      ...HTGR,
      uncertaintyRegister: (HTGR.uncertaintyRegister ?? []).map((entry) => (entry.id === "MU-1" ? { ...entry, parameterIds: ["DA-BE-999"], sensitivityIds: ["SS-9"] } : entry)),
    });
    expect(broken.filter((finding) => finding.item === "MU-1").map((finding) => finding.check)).toEqual(["Parameter missing", "Case missing"]);
  });

  it("accepts common cause estimates in an assumption and flags unknown targets", async () => {
    const assumption = (HTGR.preOperationalAssumptions ?? []).find((candidate) => candidate.assumptionId === "PA-6");
    expect(assumption?.affectedElementIds).toContain("DA-CCF-08");
    const found = await findings({ ...HTGR, preOperationalAssumptions: (HTGR.preOperationalAssumptions ?? []).map((candidate) => (candidate.assumptionId === "PA-6" ? { ...candidate, affectedElementIds: ["DA-CCF-08", "parameters"] } : candidate)) });
    expect(found.filter((finding) => finding.item === "PA-6").map((finding) => finding.detail)).toEqual(["parameters is not a DA parameter or common cause estimate."]);
  });

  it("shows component means from PRAXIS in the distributions table", async () => {
    render(<DaWorkbookProvider data={{ da: HTGR, cc: CC, nms: [] }} editable={false} mutateDa={() => undefined}><UncertaintyScreen openDrawer={() => undefined} /></DaWorkbookProvider>);
    await settle();
    while (screen.queryByRole("button", { name: "DA-UA-11" }) === null) await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await settle();
    const row = screen.getByRole("button", { name: "DA-UA-11" }).closest("tr");
    expect(row?.textContent).toContain("Constrained noninformative");
    expect(row?.querySelectorAll("td")[3]?.textContent).toBe(sciText(35 / 8760));
    await userEvent.click(screen.getByRole("button", { name: "Plot the distribution of DA-UA-11" }));
    await settle();
    expect(document.querySelector("tr.da-rowtable__detail-row svg.da-dist__svg")).not.toBeNull();
  });

  it("shows the register and the case ranges", async () => {
    render(<DaWorkbookProvider data={{ da: HTGR, cc: CC, nms: [] }} editable={false} mutateDa={() => undefined}><UncertaintyScreen openDrawer={() => undefined} /></DaWorkbookProvider>);
    await userEvent.click(screen.getByRole("tab", { name: /^Register/ }));
    expect(within(screen.getByRole("table", { name: "Register" })).getByRole("button", { name: "MU-5" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /^Sensitivity/ }));
    expect(within(screen.getByRole("table", { name: "Sensitivity cases" })).getByRole("button", { name: "SS-6" })).toBeInTheDocument();
  });
});
