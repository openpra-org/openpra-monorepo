import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { FrequencyUnit } from "interfaces-mef-types/core/events";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { IE_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/ie-seed";
import { POS_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/pos-seed";
import { SY_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sy-seed-htgr";
import { HR_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/hr-seed-htgr";
import { ESQ_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/esq-seed-htgr";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { uncertaintyIdle } from "../../newly-developed-methods/shared/useUncertainty";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { daImportNeeds, withAutoMapping, withLinkedValuesSynced, withNeedsMerged } from "../daSelectors";
import { withEstimates } from "../daFailures";
import { withUnavailability } from "../daUnavailability";
import { withCcf } from "../daCcf";
import { withFrequencies } from "../daFrequencies";
import { handoffFindings, handoffView, handoffsComplete, significant, withImportanceFromEsq } from "../daHandoffs";
import { DaWorkbookProvider, type DaUpstream } from "../daWorkbookContext";
import { HandoffScreen } from "../daHandoffScreen";
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

const UPSTREAM: DaUpstream = { options: { SY: [], IE: [], HRA: [], POS: [], SC: [], ESQ: [] }, scReferenced: [], sy: SY_ANALYSIS_HTGR, ie: IE_ANALYSIS, hr: HR_ANALYSIS_HTGR, pos: POS_ANALYSIS, esq: ESQ_ANALYSIS_HTGR };

function imported(seed: DataAnalysis): DataAnalysis {
  const merged = withLinkedValuesSynced({ ...seed, dataNeeds: withNeedsMerged(seed.dataNeeds, daImportNeeds(seed, UPSTREAM, NOW)) });
  return withCcf(withFrequencies(withUnavailability(withEstimates(withAutoMapping(merged)))));
}

let DA: DataAnalysis = DA_ANALYSIS_HTGR;

linkScExamples();

beforeAll(async () => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
  DA = await settledWithPraxis(() => imported(DA_ANALYSIS_HTGR));
});

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

function counts(da: DataAnalysis, upstream: DaUpstream): Promise<Record<string, number>> {
  return settledWithPraxis(() => handoffView(da, upstream).rows.reduce<Record<string, number>>((total, row) => ({ ...total, [`${row.element} ${row.status}`]: (total[`${row.element} ${row.status}`] ?? 0) + 1 }), {}));
}

function findings(da: DataAnalysis, upstream: DaUpstream): Promise<string[][]> {
  return settledWithPraxis(() => handoffFindings(da, upstream).map((finding) => [finding.severity, finding.check, finding.item]));
}

describe("hand-offs", () => {
  it("finds every consumer in step with the example values", async () => {
    expect(await counts(DA, UPSTREAM)).toEqual({ "SY IN_STEP": 72, "IE IN_STEP": 21, "HRA IN_STEP": 1, "HRA TYPED": 24, "POS TYPED": 7, "POS IN_STEP": 2, "ESQ IN_STEP": 12 });
    expect((await findings(DA, UPSTREAM)).filter(([severity]) => severity !== "note")).toEqual([]);
    expect(await settledWithPraxis(() => handoffsComplete(DA, UPSTREAM))).toBe(true);
  });

  it("reports an IE frequency that differs from the DA estimate and a component event that reads a frequency", async () => {
    const estimate = DA.parameters.find((parameter) => parameter.uuid === "DA-IE-03")?.estimate;
    if (estimate === undefined) throw new Error("DA-IE-03 has no estimate.");
    const holding = (expression: UncertainExpression): DaUpstream => ({ ...UPSTREAM, ie: { ...IE_ANALYSIS, initiatingEventGroups: IE_ANALYSIS.initiatingEventGroups.map((group) => (group.uuid === "IEG-03" ? { ...group, frequency: { expression, basis: FrequencyUnit.PER_PLANT_YEAR } } : group)) } });
    const copied = handoffView(DA, holding(estimate)).rows.find((row) => row.element === "IE" && row.id === "IEG-03");
    expect(copied).toMatchObject({ status: "IN_STEP", daExpression: estimate, consumerExpression: estimate });
    const other: UncertainExpression = { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: 0.05, errorFactor: 2.8, level: 0.95 } } };
    expect((await findings(DA, holding(other))).map(([, check, item]) => [check, item])).toContainEqual(["Out of step", "IE IEG-03"]);
    const event = SY_ANALYSIS_HTGR.systemBasicEvents[0]!;
    const sy: SystemsAnalysis = { ...SY_ANALYSIS_HTGR, systemBasicEvents: [{ ...event, expression: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "example-da-htgr", entityId: "DA-IE-03" } } }] };
    const units = handoffView(DA, { ...UPSTREAM, sy }).rows.find((row) => row.element === "SY");
    expect(units).toMatchObject({ status: "UNITS", holder: "DA", target: "DA-IE-03", detail: "DA-IE-03 is not a component estimate." });
  });

  it("puts a component event in step when SY reads the DA estimate", async () => {
    const event = SY_ANALYSIS_HTGR.systemBasicEvents.find((candidate) => candidate.expression?.node === "PARAMETER");
    if (event === undefined || event.expression?.node !== "PARAMETER") throw new Error("No SY event reads a DA parameter.");
    const reference = event.expression.reference;
    const row = await settledWithPraxis(() => handoffView(DA, UPSTREAM).rows.find((candidate) => candidate.element === "SY" && candidate.id === event.uuid));
    const parameter = DA.parameters.find((candidate) => candidate.uuid === reference.entityId.trim());
    expect(row).toMatchObject({ status: "IN_STEP", holder: "DA", target: parameter?.uuid, daExpression: parameter?.estimate, consumerExpression: event.expression });
    expect(row?.daValue).toBeDefined();
  });

  it("reads risk significance back from ESQ", async () => {
    expect(significant(0.006, undefined)).toBe(true);
    expect(significant(0.004, 1.9)).toBe(false);
    const bare: DataAnalysis = { ...DA, parameters: DA.parameters.map((parameter) => (parameter.uuid === "DA-BE-201" ? { ...parameter, isRiskSignificant: undefined, importance: undefined } : parameter)) };
    expect((await findings(bare, UPSTREAM)).map(([, check, item]) => [check, item])).toContainEqual(["Significant in ESQ", "DA-BE-201"]);
    const read = withImportanceFromEsq(bare, UPSTREAM, NOW).parameters.find((parameter) => parameter.uuid === "DA-BE-201");
    expect(read).toMatchObject({ isRiskSignificant: true, importance: { from: "ESQ", fussellVesely: 0.04, riskAchievementWorth: 1.9, entryIds: ["IMP-1 · 5"], importedAt: NOW } });
  });

  it("summarizes each consumer and lists its rows", async () => {
    render(<DaWorkbookProvider data={{ da: DA, cc: CC, nms: [] }} editable={false} mutateDa={() => undefined} upstream={UPSTREAM}><HandoffScreen openDrawer={() => undefined} /></DaWorkbookProvider>);
    await settle();
    expect(screen.getByRole("table", { name: "Hand-off summary" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /^IE/ }));
    const table = screen.getAllByRole("table").find((candidate) => within(candidate).queryByText("IEG-03") !== null);
    expect(table).toBeDefined();
    await userEvent.click(screen.getByRole("tab", { name: /^SY/ }));
    await userEvent.click(screen.getAllByRole("button", { name: /^Show the details of/ })[0]!);
    await settle();
    const detail = document.querySelector("tr.da-rowtable__detail-row")?.textContent ?? "";
    expect(detail).toContain("DA estimate");
    expect(detail).not.toContain("…");
  });
});
