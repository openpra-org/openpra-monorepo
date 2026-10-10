import { readFileSync } from "fs";
import { join } from "path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import type { DataAnalysis, DataAnalysisParameter, DaSourceEntry } from "interfaces-mef-types/da/data-analysis";
import { DaSourceEntrySchema, DataAnalysisSchema } from "interfaces-mef-types/zod/da/data-analysis";
import type { Law, UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { DA_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed";
import { IE_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/ie-seed";
import { POS_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/pos-seed";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { daImportNeeds, withAutoMapping, withLinkedValuesSynced, withNeedsMerged } from "../daSelectors";
import { withEstimates } from "../daFailures";
import { withUnavailability } from "../daUnavailability";
import { withCcf } from "../daCcf";
import { lawSummary, pointState, readyNumber } from "../daLaws";
import { frequencyEstimate, frequencyFindings, withFrequencies } from "../daFrequencies";
import { DaWorkbookProvider } from "../daWorkbookContext";
import { FrequencyScreen } from "../daFrequencyScreen";

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

const UPSTREAM = { options: { SY: [], IE: [], HRA: [], POS: [], SC: [], ESQ: [] }, scReferenced: [], ie: IE_ANALYSIS, pos: POS_ANALYSIS };

const DATASETS = join(__dirname, "../../../../../interfaces/mef-types/da");

function datasetRow(name: string, id: string): DaSourceEntry {
  const rows: DaSourceEntry[] = JSON.parse(readFileSync(join(DATASETS, name), "utf-8"));
  const row = rows.find((candidate) => candidate.id === id);
  if (row === undefined) throw new Error(`${id} is missing.`);
  return row;
}

function close(actual: number | undefined, expected: number, tolerance = 1e-9): void {
  expect(actual).toBeDefined();
  expect(Math.abs((actual ?? 0) - expected) / Math.abs(expected)).toBeLessThan(tolerance);
}

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

function primaryLaw(groupId: string): Law {
  const quantification = IE_ANALYSIS.quantifications.find((candidate) => candidate.initiatorOrGroupId === groupId);
  const source = quantification?.dataSources?.find((candidate) => candidate.uuid === quantification.primaryDataSourceId);
  const expression = source?.estimate ?? source?.faultTreeTop;
  if (expression?.node !== "VALUE") throw new Error(`${groupId} has no IE result.`);
  return expression.value.law;
}

function meanOf(expression: UncertainExpression | undefined): Promise<number | undefined> {
  if (expression === undefined) return Promise.resolve(undefined);
  return settledWithPraxis(() => readyNumber(pointState(expression, "PER_YEAR")));
}

let DA: DataAnalysis;

beforeAll(async () => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
  DA = await settledWithPraxis(() => imported(DA_ANALYSIS_HTGR));
});

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

describe("initiating event frequencies", () => {
  it("takes every IE group result as its law and maps each imported group to its parameter", async () => {
    expect((DA.dataNeeds?.initiators ?? []).every((need) => need.parameterId === `DA-IE-${need.id.split("-")[1]}`)).toBe(true);
    const updated = new Map([["IEG-09", "POPULATION"], ["IEG-11", "POSTERIOR"]]);
    for (const [groupId, family] of updated) {
      const estimate = parameterOf(DA, `DA-IE-${groupId.split("-")[1]}`).estimate;
      expect(estimate?.node === "VALUE" ? estimate.value.law.family : undefined).toBe(family);
    }
    for (const group of IE_ANALYSIS.initiatingEventGroups.filter((candidate) => !updated.has(candidate.uuid))) {
      const parameter = parameterOf(DA, `DA-IE-${group.uuid.split("-")[1]}`);
      const estimate = await settledWithPraxis(() => frequencyEstimate(DA, parameter));
      expect(estimate.problem).toBeUndefined();
      expect(estimate.estimate).toEqual({ node: "VALUE", value: { unit: "PER_YEAR", law: primaryLaw(group.uuid) } });
      expect(parameter.estimate).toEqual(estimate.estimate);
      const law = primaryLaw(group.uuid);
      if (law.family !== "LOGNORMAL") throw new Error("A lognormal IE result is expected.");
      close(await meanOf(estimate.estimate), law.mean, 1e-12);
    }
    expect((await settledWithPraxis(() => frequencyFindings(DA))).filter((finding) => finding.severity !== "note")).toEqual([]);
  });

  it("keeps both examples stable and valid", async () => {
    for (const seed of [DA_ANALYSIS_HTGR, DA_ANALYSIS]) {
      expect(await settledWithPraxis(() => withFrequencies(seed))).toBe(seed);
      const parsed = DataAnalysisSchema.safeParse(seed);
      expect(parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)).toEqual([]);
    }
    expect(await settledWithPraxis(() => withFrequencies(DA))).toBe(DA);
  });

  it("compares offsite power with the 2020 rates over the power and shutdown states", async () => {
    const parameter = parameterOf(DA, "DA-IE-03");
    const estimate = await settledWithPraxis(() => frequencyEstimate(DA, parameter));
    const [power, shutdown] = estimate.comparisons;
    close(power?.value, 0.022415351291226685, 1e-9);
    close(power?.ratio, 0.0975 / 0.022415351291226685, 1e-9);
    close(shutdown?.value, 0.034228276390151025 - 0.022415351291226685, 1e-9);
  });

  it("adds parts exactly, so the estimate's mean is the sum of the parts' means", async () => {
    const loop = parameterOf(DA, "DA-IE-03");
    const twoParts: DataAnalysisParameter = {
      ...loop,
      uuid: "DA-IE-T1",
      frequency: { ...loop.frequency, parts: [
        { id: "P-1", label: "Power", per: "CRITICAL_YEAR", stateIds: loop.stateIds, useId: "U-2", priorForm: "AS_PUBLISHED", method: "PRIOR" },
        { id: "P-2", label: "Shutdown", per: "SHUTDOWN_YEAR", stateIds: loop.stateIds, useId: "U-3", priorForm: "AS_PUBLISHED", method: "PRIOR" },
      ], comparisons: [] },
    };
    const da = withParameter(DA, twoParts);
    const estimate = await settledWithPraxis(() => frequencyEstimate(da, twoParts));
    const held = estimate.estimate;
    if (held?.node !== "OPERATION") throw new Error("A sum of parts is expected.");
    expect(held.operation).toBe("ADD");
    expect(held.operands).toHaveLength(2);
    const means: number[] = [];
    for (const part of estimate.parts) {
      const law = part.law;
      if (law === undefined) throw new Error("A part has no law.");
      const summary = await settledWithPraxis(() => lawSummary("PER_YEAR", law));
      if (summary.status !== "ready") throw new Error("PRAXIS gave no summary.");
      means.push(summary.value.mean);
    }
    const total = await meanOf(held);
    close(total, means.reduce((sum, mean) => sum + mean, 0), 1e-12);
    close(total, 0.034228276390151025, 1e-9);
    expect(estimate.parts[0]?.share.ignored).toEqual(["POS-04", "POS-05", "POS-06", "POS-07", "POS-08"]);
    expect(estimate.parts[0]?.law).toEqual({ family: "GAMMA", shape: 1.3, rate: expect.closeTo(52.8 / (estimate.parts[0]?.factor ?? 1), 9) });
  });

  it("updates a Jeffreys prior with typed events as a posterior law", async () => {
    const base = parameterOf(DA, "DA-IE-06");
    const counted: DataAnalysisParameter = {
      ...base,
      uuid: "DA-IE-T2",
      frequency: { category: "I", categoryReason: "Test.", parts: [{ id: "P-1", label: "Counts", per: "CALENDAR_YEAR", priorForm: "JEFFREYS", method: "BAYES", evidence: [
        { id: "EV-1", origin: "TECHNOLOGY", failuresFrom: "TYPED", exposureFrom: "TYPED", failures: 2, exposure: 5, unit: "YEARS", boundary: "SAME", reason: "Test.", included: true },
      ] }] },
    };
    const da = withParameter(DA, counted);
    const estimate = await settledWithPraxis(() => frequencyEstimate(da, counted));
    expect(estimate.estimate).toEqual({ node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POSTERIOR", prior: null, evidence: [{ likelihood: "POISSON", failures: 2, exposure: 5 }] } } });
    close(await meanOf(estimate.estimate), 0.5, 1e-12);
  });

  it("asks for a reason behind a large gap and for a wider spread at category III", async () => {
    const base = parameterOf(DA, "DA-IE-04");
    const bare: DataAnalysisParameter = {
      ...base,
      frequency: { ...base.frequency, parts: (base.frequency?.parts ?? []).map((part) => ({ ...part, reason: undefined })), category: "III", comparisons: (base.frequency?.comparisons ?? []).map((comparison) => ({ ...comparison, reason: undefined })) },
    };
    const da = withParameter(DA, bare);
    const checks = (await settledWithPraxis(() => frequencyFindings(da))).filter((finding) => finding.item === "DA-IE-04").map((finding) => finding.check);
    expect(checks).toEqual(expect.arrayContaining(["Comparison gap", "Uncertainty not widened"]));
  });

  it("stops a value that IE and DA each take from the other", async () => {
    const base = parameterOf(DA, "DA-IE-05");
    const linked: DataAnalysisParameter = { ...base, valueMode: "LINKED", valueLink: { element: "IE", needId: "IEG-05" } };
    const da = withParameter(DA, linked);
    const findings = (await settledWithPraxis(() => frequencyFindings(da))).filter((finding) => finding.item === "DA-IE-05");
    expect(findings.map((finding) => finding.check)).toEqual(["Circular link"]);
  });

  it("round trips a per-year row law through the schema and PRAXIS gives its printed mean", async () => {
    for (const [file, id, mean] of [["source-nureg-cr-6890.json", "V1-T3-1-CR-PC", 0.00207], ["source-inl-2020.json", "FWLB PWR FI", 0.00127]] as const) {
      const row = datasetRow(file, id);
      const parsed = DaSourceEntrySchema.parse(JSON.parse(JSON.stringify(row)));
      expect(parsed).toEqual(row);
      expect(parsed.distribution).toBeUndefined();
      const law = parsed.law;
      if (law === undefined) throw new Error(`${id} has no law.`);
      const summary = await settledWithPraxis(() => lawSummary("PER_YEAR", law));
      if (summary.status !== "ready") throw new Error("PRAXIS gave no summary.");
      close(summary.value.mean, mean, 5e-3);
    }
    expect(datasetRow("source-nureg-cr-6890.json", "V1-T3-1-CR-PC").law).toEqual({ family: "POSTERIOR", prior: null, evidence: [{ likelihood: "POISSON", failures: 1, exposure: 724.3 }] });
  });

  it("lists the groups and their categories, and shows the comparison gap", async () => {
    render(<DaWorkbookProvider data={{ da: DA, cc: CC, nms: [] }} editable={false} mutateDa={() => undefined}><FrequencyScreen openDrawer={() => undefined} /></DaWorkbookProvider>);
    const groups = screen.getByRole("table", { name: "Groups" });
    expect(within(groups).getByRole("button", { name: "DA-IE-01" })).toBeInTheDocument();
    expect(await screen.findByRole("tab", { name: "Estimates (21 of 21)" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Comparison" }));
    const comparison = screen.getByRole("table", { name: "Comparison" });
    const row = within(comparison).getByRole("button", { name: "DA-IE-03" }).closest("tr");
    expect(row).toHaveTextContent("8.3 times");
  });
});
