import { JSX, useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { uncertaintyIdle } from "../../newly-developed-methods/shared/useUncertainty";
import { praxisUncertainty } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { DaWorkbookProvider } from "../daWorkbookContext";
import { SourceWindows, SourcesScreen } from "../daSourcesScreen";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

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

const NOW = "2026-10-04T12:00:00.000Z";

const META = {
  versionInfo: { version: "1", lastUpdated: NOW, schemaVersion: "0.0.1" },
  analysisDate: NOW,
  analysts: [],
  reviewers: [],
  scope: "",
  limitations: [],
  lastModifiedDate: NOW,
  lastModifiedBy: "tester",
};

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
  metadata: META,
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

const DA: DataAnalysis = {
  uuid: "da-test",
  name: "DA test",
  type: TechnicalElementTypes.DATA_ANALYSIS,
  version: "1",
  created: NOW,
  modified: NOW,
  workflowState: "DRAFT",
  workflowHistory: [],
  capabilityCategory: "CC-II",
  plantStage: "PRE_OPERATIONAL",
  metadata: META,
  conformanceMatrix: [],
  internalReviewComments: { comments: [], openCount: 0, resolvedCount: 0 },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "",
  parameters: [
    {
      uuid: "DA-1",
      name: "Gas turbine fails to start",
      parameterType: "PROBABILITY",
      quantificationModel: "DEMAND_PROBABILITY",
      evidenceKind: "GENERIC_NUCLEAR",
      evidenceReason: "No plant records before operation.",
      priorUseId: "U-1",
      sourceUses: [
        { id: "U-1", sourceId: "SRC-01", entryId: "E-001", verdict: "APPLIES", boundary: "SAME", reason: "Same machine class." },
        { id: "U-2", sourceId: "SRC-01", entryId: "E-002", verdict: "REJECTED", boundary: "DIFFERENT", reason: "Diesels start more reliably." },
      ],
      implementsSrs: [],
    },
  ],
  sources: [
    {
      id: "SRC-01",
      name: "Generic starts",
      kind: "GENERIC_NUCLEAR",
      origin: "OTHER_NUCLEAR",
      covers: "Start failures",
      yearsFrom: "2006",
      yearsTo: "2020",
      boundaryConvention: "Machine with its breaker",
      failureCounting: "Counted starts",
      quality: "Empirical Bayes",
      reference: "Test reference",
      entries: [
        { id: "E-001", component: "Combustion turbine", failureMode: "Fails to start", quantity: "PER_DEMAND", law: { family: "BETA", alpha: 21.5, beta: 1012, lower: 0, upper: 1 }, mean: 0.0208 },
        { id: "E-002", component: "Diesel generator", failureMode: "Fails to start", quantity: "PER_DEMAND", law: { family: "POSTERIOR", prior: null, evidence: [{ likelihood: "BINOMIAL", failures: 2, exposure: 1046 }] }, failures: 2, exposure: 1046 },
      ],
    },
  ],
  elicitations: [
    {
      id: "EJ-01",
      issue: "Duct blockage over 72 h",
      objective: "Prior for the duct parameter",
      quantity: "PROBABILITY",
      importance: "MEDIUM",
      complexity: "MEDIUM",
      structure: "PANEL",
      outsideReason: "No in-house experience",
      experts: [
        { id: "X-1", name: "Evaluator A", role: "EVALUATOR", outside: true, expertise: "Passive cooling", p05: 1e-3, median: 3e-3, p95: 1e-2, acceptsResponsibility: true },
        { id: "X-2", name: "Evaluator B", role: "EVALUATOR", outside: true, expertise: "Ducts", p05: 5e-4, median: 2e-3, p95: 8e-3, acceptsResponsibility: true },
      ],
      pooling: "LINEAR",
      integrator: "Data lead",
      responsibility: "INTEGRATOR",
    },
  ],
  componentBoundaries: [],
  documentation: {
    processDescription: "",
    systemComponentBoundaries: "",
    basicEventProbabilityModels: "",
    genericParameterSources: "",
    plantSpecificDataSourcesAndPeriods: "",
    dataExclusionJustifications: "",
    demandAndExposureCounting: "",
    unavailabilityTreatment: "",
    repairAndRecoveryData: "",
    lpsdOutageData: "",
    componentGroupingAndOutliers: "",
    ccfParameterBasis: "",
    bayesianPriorRationales: "",
    parameterEstimatesWithUncertainty: "",
    multiPosGenericUse: "",
    modelUncertaintySources: "",
    asBuiltLimitations: "",
    praTaskInterfaces: "",
    implementsSrs: [],
  },
};

function renderScreen(): void {
  render(
    <DaWorkbookProvider data={{ da: DA, cc: CC, nms: [] }} editable mutateDa={() => undefined}>
      <SourcesScreen openDrawer={() => undefined} />
    </DaWorkbookProvider>,
  );
}

function renderWindow(context: { kind: "daEntry" | "daImport"; id: string }, onChange: (da: DataAnalysis) => void): void {
  function Harness(): JSX.Element {
    const [da, setDa] = useState(DA);
    return (
      <DaWorkbookProvider data={{ da, cc: CC, nms: [] }} editable mutateDa={(mutator) => setDa((current) => { const next = mutator(current); onChange(next); return next; })}>
        <SourceWindows context={context} onClose={() => undefined} onRetarget={() => undefined} />
      </DaWorkbookProvider>
    );
  }
  render(<Harness />);
}

function rowOf(id: string): HTMLElement | null {
  return screen.getByRole("button", { name: id }).closest("tr");
}

function detailRows(): Element[] {
  return [...document.querySelectorAll("tr.da-rowtable__detail-row")];
}

describe("SourcesScreen distribution rows", () => {
  it("opens the chart right under the picked estimate, moves it, and hides it", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("tab", { name: /^Estimates/ }));
    await settle();
    expect(detailRows()).toHaveLength(0);
    expect(rowOf("E-002")?.textContent).toContain("2.39E-3");
    await userEvent.click(screen.getByRole("button", { name: "Plot the distribution of E-001" }));
    await settle();
    const first = screen.getByRole("button", { name: "Hide the distribution of E-001" }).closest("tr");
    expect(first?.nextElementSibling?.classList.contains("da-rowtable__detail-row")).toBe(true);
    expect(first?.nextElementSibling?.querySelector("svg.da-dist__svg")).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Plot the distribution of E-002" }));
    await settle();
    expect(detailRows()).toHaveLength(1);
    const second = screen.getByRole("button", { name: "Hide the distribution of E-002" }).closest("tr");
    expect(second?.nextElementSibling?.textContent).toContain("Jeffreys posterior with 2 failures");
    expect(second?.nextElementSibling?.querySelector("svg.da-dist__svg")).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Hide the distribution of E-002" }));
    expect(detailRows()).toHaveLength(0);
  });

  it("compares a parameter's sources and an elicitation's experts in place", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("tab", { name: /^Applicability/ }));
    await settle();
    expect(rowOf("DA-1")?.textContent).toContain("2.08E-2");
    await userEvent.click(screen.getByRole("button", { name: "Plot the distribution of DA-1" }));
    await settle();
    expect(screen.getByRole("button", { name: /SRC-01 · E-001/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /SRC-01 · E-002/ })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("tab", { name: /^Expert judgment/ }));
    await userEvent.click(screen.getByRole("button", { name: "Plot the distribution of EJ-01" }));
    await settle();
    expect(screen.getByRole("button", { name: /Pooled result/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Evaluator B/ })).toBeInTheDocument();
  });
});

describe("SourcesScreen windows", () => {
  it("edits a law row with the law editor and keeps it inside its unit", async () => {
    let latest = DA;
    renderWindow({ kind: "daEntry", id: "SRC-01|E-001" }, (next) => { latest = next; });
    expect(screen.getByRole("combobox", { name: "Law" })).toHaveValue("BETA");
    const alpha = screen.getByRole("textbox", { name: "α" });
    await userEvent.clear(alpha);
    await userEvent.type(alpha, "22");
    await userEvent.tab();
    expect(latest.sources?.[0]?.entries[0]?.law).toEqual({ family: "BETA", alpha: 22, beta: 1012, lower: 0, upper: 1 });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Law" }), "LOGNORMAL");
    expect(latest.sources?.[0]?.entries[0]?.law).toMatchObject({ family: "TRUNCATED", lower: null, upper: 1, law: { family: "LOGNORMAL", errorFactor: 3, level: 0.95 } });
    expect(latest.sources?.[0]?.entries[0]?.distribution).toBeUndefined();
  });

  it("waits for PRAXIS before importing rows that need a fitted lognormal", async () => {
    const waiting: (() => void)[] = [];
    jest.mocked(evaluateUncertainty).mockImplementation((request) => new Promise((resolve, reject) => { waiting.push(() => { praxisUncertainty(request).then(resolve, reject); }); }));
    let latest = DA;
    renderWindow({ kind: "daImport", id: "SRC-01" }, (next) => { latest = next; });
    fireEvent.change(screen.getByRole("textbox", { name: "Or paste rows" }), { target: { value: "Code,Description,d or h,Median,95th\nVLV-FTO,Valve fails to open,d,1E-03,5E-03\n" } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(screen.getByText("1 row waits for PRAXIS to fit a lognormal to the printed values.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import 0 rows" })).toBeDisabled();
    jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
    for (const release of waiting.splice(0)) release();
    await settle();
    await userEvent.click(screen.getByRole("button", { name: "Import 1 row" }));
    const law = latest.sources?.[0]?.entries.find((entry) => entry.id === "VLV-FTO")?.law;
    const sigma = Math.log(5) / 1.6448536269514722;
    expect(law).toEqual({ family: "LOGNORMAL", mean: expect.closeTo(1e-3 * Math.exp((sigma * sigma) / 2), 15), errorFactor: expect.closeTo(5, 12), level: 0.95 });
  });
});

describe("source catalog", () => {
  it("removes a chosen source with its uses and adds it back", async () => {
    const start: DataAnalysis = { ...DA, sources: (DA.sources ?? []).map((source) => ({ ...source, catalogId: "NASCORD" })) };
    let latest = start;
    function Harness(): JSX.Element {
      const [da, setDa] = useState(start);
      return (
        <DaWorkbookProvider data={{ da, cc: CC, nms: [] }} editable mutateDa={(mutator) => setDa((current) => { latest = mutator(current); return latest; })}>
          <SourceWindows context={{ kind: "daCatalog", id: "catalog" }} onClose={() => undefined} onRetarget={() => undefined} />
        </DaWorkbookProvider>
      );
    }
    render(<Harness />);
    const row = (): HTMLElement => screen.getByRole("row", { name: /NaSCoRD/ });
    expect(within(row()).getByText(/Used by 1 parameter/)).toBeInTheDocument();
    await userEvent.click(within(row()).getByRole("button", { name: "Remove SRC-01 from the library" }));
    expect(latest.sources).toEqual([]);
    expect(latest.parameters[0]?.sourceUses).toEqual([]);
    expect(latest.parameters[0]?.priorUseId).toBeUndefined();
    await userEvent.click(within(row()).getByRole("button", { name: "Add" }));
    expect(latest.sources?.map((source) => [source.id, source.catalogId, source.entries.length])).toEqual([["SRC-01", "NASCORD", 0]]);
    expect(within(row()).getByRole("button", { name: "Remove SRC-01 from the library" })).toBeInTheDocument();
  });
});
