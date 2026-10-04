import { JSX, useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DistributionType } from "interfaces-mef-types/core/events";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { DaWorkbookProvider } from "../daWorkbookContext";
import { SourceWindows, SourcesScreen } from "../daSourcesScreen";

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
      valueType: "MEAN",
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
        { id: "E-001", component: "Combustion turbine", failureMode: "Fails to start", quantity: "PER_DEMAND", distribution: { type: DistributionType.BETA, alpha: 21.5, betaParam: 1012 }, mean: 0.0208 },
        { id: "E-002", component: "Diesel generator", failureMode: "Fails to start", quantity: "PER_DEMAND", failures: 2, exposure: 1046 },
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
  modelUncertainty: { uuid: "mu", name: "Model uncertainty", uncertaintySources: [], relatedAssumptions: [], reasonableAlternatives: [] },
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

function detailRows(): Element[] {
  return [...document.querySelectorAll("tr.da-rowtable__detail-row")];
}

describe("SourcesScreen distribution rows", () => {
  it("opens the chart right under the picked estimate, moves it, and hides it", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("tab", { name: /^Estimates/ }));
    expect(detailRows()).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Plot the distribution of E-001" }));
    const first = screen.getByRole("button", { name: "Hide the distribution of E-001" }).closest("tr");
    expect(first?.nextElementSibling?.classList.contains("da-rowtable__detail-row")).toBe(true);
    expect(first?.nextElementSibling?.querySelector("svg.da-dist__svg")).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Plot the distribution of E-002" }));
    expect(detailRows()).toHaveLength(1);
    const second = screen.getByRole("button", { name: "Hide the distribution of E-002" }).closest("tr");
    expect(second?.nextElementSibling?.textContent).toContain("Jeffreys distribution of its counts");
    await userEvent.click(screen.getByRole("button", { name: "Hide the distribution of E-002" }));
    expect(detailRows()).toHaveLength(0);
  });

  it("compares a parameter's sources and an elicitation's experts in place", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("tab", { name: /^Applicability/ }));
    await userEvent.click(screen.getByRole("button", { name: "Plot the distribution of DA-1" }));
    expect(screen.getByRole("button", { name: /SRC-01 · E-001/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /SRC-01 · E-002/ })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("tab", { name: /^Expert judgment/ }));
    await userEvent.click(screen.getByRole("button", { name: "Plot the distribution of EJ-01" }));
    expect(screen.getByRole("button", { name: /Pooled result/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Evaluator B/ })).toBeInTheDocument();
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
