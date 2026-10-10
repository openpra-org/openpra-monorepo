import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { AnalysisRunDetails, AnalysisRunMetadata } from "interfaces-shared-types/newly-developed-methods/shared";
import { fetchJson } from "../../api/client";
import { settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { UncertaintyScreen } from "../SyUncertaintyReview";

jest.mock("../../api/client", () => ({ ...jest.requireActual<typeof import("../../api/client")>("../../api/client"), fetchJson: jest.fn() }));
jest.mock("../SyUncertaintyAnalysis", () => ({ SyUncertaintyAnalysis: () => null }));
jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => jest.requireActual("./syUncertaintyPraxis"));

const SYSTEM_ID = "SYS-CLG";
const MODEL_ID = "00000000-0000-4000-8000-000000000071";
const RUN_ID = "00000000-0000-4000-8000-000000000072";
const TIME = "2026-10-08T12:00:00.000Z";
const DISTRIBUTION = "Distribution of the sampled top event probability on a log scale, marked at the 5th percentile, median, mean, 95th percentile and point estimate";
const CUMULATIVE = "Cumulative share of samples against the top event probability on a log scale, marked at the 5th percentile, median, mean, 95th percentile and point estimate";

const LOGNORMAL: UncertainExpression = { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "LOGNORMAL", mean: 0.002, errorFactor: 3, level: 0.95 } } };

const SY = {
  systemDefinitions: [{ uuid: SYSTEM_ID, name: "Cooling", abbreviation: "CLG", boundaries: [], successCriteriaIds: [], modeledComponentsAndFailures: {}, informationBasis: "as-designed-as-intended", implementsSrs: [] }],
  systemLogicModels: [{
    uuid: MODEL_ID, code: "FT-CLG", name: "Cooling fault tree", systemReference: SYSTEM_ID, description: "", modelRepresentation: "FAULT_TREE",
    topGate: { gateId: "top" }, gates: [{ id: "top", kind: "GATE", gateType: "OR", code: "TOP", name: "Top", description: "" }],
    leafNodes: [{ id: "leaf-a", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-a" }],
    gateInputs: [{ id: "input-a", gateId: "top", childId: "leaf-a", order: 0 }], nodePositions: [],
    layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" }, implementsSrs: [],
  }],
  systemBasicEvents: [{ uuid: "event-a", code: "PMP-A-FS", name: "Pump A fails", eventType: "BASIC", failureMode: "FAILURE_TO_START", expression: LOGNORMAL, implementsSrs: [] }],
  commonCauseFailureGroups: [],
  uncertaintyAnalyses: [],
  sensitivityStudies: [],
} as unknown as SystemsAnalysis;

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => ({
    sy: SY,
    editable: true,
    mutateSy: jest.fn(),
    shortOf: () => "CLG",
    controlledParameters: [],
    controlledCcfVectors: [],
    controlledCcfFactors: [],
    links: null,
    runtime: { workbookId: "sy-1", projectId: "project-1", revision: 4, saveStatus: "saved" },
  }),
}));

const RUN: AnalysisRunMetadata = {
  schemaVersion: "1.0.0",
  id: RUN_ID,
  owner: { workbookId: "sy-1", modelId: MODEL_ID, workbookRevision: 4 },
  sourceWorkbooks: [{ workbookId: "sy-1", workbookRevision: 4 }],
  methodType: "FAULT_TREE",
  status: "SUCCEEDED",
  requestedBy: "analyst",
  requestedAt: TIME,
  startedAt: TIME,
  completedAt: TIME,
  engine: { name: "PRAXIS", version: "1" },
  failure: null,
  freshness: { status: "CURRENT", sources: [{ workbookId: "sy-1", savedRevision: 4, currentRevision: 4, status: "CURRENT" }] },
};

const QUANTILES = [{ probability: 0.05, value: 6e-4 }, { probability: 0.5, value: 1.6e-3 }, { probability: 0.95, value: 5.4e-3 }];

function storedResult(uncertainty: Record<string, number | string | object>): Record<string, number | string | object> {
  return {
    schemaVersion: "1.0.0",
    runId: RUN_ID,
    owner: RUN.owner,
    topGateId: "00000000-0000-4000-8000-000000000073",
    topEventProbability: 2e-3,
    calculationType: "UNCERTAINTY",
    workflow: "MANUAL",
    algorithm: "BDD",
    probabilityMethod: "EXACT",
    uncertainty,
    validationIssues: [],
    completedAt: TIME,
  };
}

function details(result: Record<string, number | string | object>): AnalysisRunDetails {
  return {
    run: RUN,
    target: null,
    contributions: null,
    request: { modelId: MODEL_ID, calculationType: "UNCERTAINTY", workflow: "MANUAL", uncertaintyInputSource: "DA" },
    nativeRequest: null,
    workbookSnapshots: [{ hostType: "SY", identity: { workbookId: "sy-1", workbookRevision: 4 }, mef: { systemBasicEvents: [] } }],
    result,
  };
}

function serve(saved: AnalysisRunDetails): void {
  jest.mocked(fetchJson).mockImplementation(async (path: string) => (path.endsWith("/details")
    ? saved
    : { schemaVersion: "1.0.0", runs: [{ run: RUN, target: null, contributions: null }], nextCursor: null }));
}

async function openSavedRun(): Promise<HTMLElement> {
  render(<UncertaintyScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
  await act(async () => { await settledWithPraxis(() => undefined); });
  const history = screen.getByRole("region", { name: "Uncertainty history" });
  fireEvent.click(within(history).getByRole("button", { name: "Review saved runs" }));
  fireEvent.click(await within(history).findByRole("button", { name: (name) => name.startsWith("FAULT TREE") }));
  return within(history).findByRole("region", { name: "Saved run details" });
}

describe("SY Step 07 uncertainty history", () => {
  beforeEach(() => {
    jest.mocked(fetchJson).mockReset();
  });

  it("opens a saved uncertainty run in the shared view with its chart, switch, values and details", async () => {
    serve(details(storedResult({
      mean: 2.1e-3, standardDeviation: 1.4e-3, standardError: 4.4e-5, quantiles: QUANTILES,
      samples: [4e-4, 9e-4, 1.6e-3, 2.4e-3, 6e-3], sampleCount: 5, seed: 847, samplingMethod: "MONTE_CARLO",
    })));
    const saved = await openSavedRun();

    const card = within(saved).getByRole("article", { name: "Uncertainty result" });
    expect(within(card).getByRole("img", { name: DISTRIBUTION })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Distribution" })).toHaveAttribute("aria-pressed", "true");
    const values = within(card).getByRole("table", { name: "Summary values" });
    expect(within(values).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Point estimate", "5th percentile", "Median", "Mean", "95th percentile"]);
    expect(within(values).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2.000E-3", "6.000E-4", "1.600E-3", "2.100E-3", "5.400E-3"]);
    expect(card).toHaveTextContent("5 Monte Carlo samples · seed 847 · standard deviation 1.400E-3 · standard error of the mean 4.400E-5");
    fireEvent.click(within(card).getByRole("button", { name: "Cumulative" }));
    expect(within(card).getByRole("button", { name: "Cumulative" })).toHaveAttribute("aria-pressed", "true");
    expect(within(card).getByRole("img", { name: CUMULATIVE })).toBeInTheDocument();
    expect(within(saved).queryByText("Standard error")).not.toBeInTheDocument();
  });

  it("draws the summary markers and says so when the stored result holds no samples", async () => {
    serve(details(storedResult({
      mean: 2.1e-3, standardDeviation: 1.4e-3, standardError: 1.4e-5, quantiles: QUANTILES,
      samples: [], sampleCount: 10_000, seed: 847, samplingMethod: "LATIN_HYPERCUBE",
    })));
    const saved = await openSavedRun();

    const card = within(saved).getByRole("article", { name: "Uncertainty result" });
    expect(within(card).getByRole("img", { name: DISTRIBUTION })).toBeInTheDocument();
    expect(within(card).getByRole("status")).toHaveTextContent("This result holds no samples, so the chart shows the summary values without the distribution.");
    expect(within(within(card).getByRole("table", { name: "Summary values" })).getAllByRole("cell")).toHaveLength(5);
    fireEvent.click(within(card).getByRole("button", { name: "Cumulative" }));
    expect(within(card).getByRole("status")).toHaveTextContent("This result holds no samples, so the chart shows the summary values without the cumulative curve.");
    expect(within(card).queryByRole("button", { name: "Export results CSV" })).not.toBeInTheDocument();
  });

  it("names an older stored format instead of failing the step", async () => {
    serve(details(storedResult({ mean: 2.1e-3, standardDeviation: 1.4e-3, errorFactor: 3.1, quantiles: QUANTILES, sampleCount: 1_000, seed: 847 })));
    const saved = await openSavedRun();

    expect(saved).toHaveTextContent("This saved result uses an older result format, so it cannot be drawn here. Download the saved run to read it.");
    expect(within(saved).getByRole("button", { name: "Download saved run" })).toBeInTheDocument();
  });
});
