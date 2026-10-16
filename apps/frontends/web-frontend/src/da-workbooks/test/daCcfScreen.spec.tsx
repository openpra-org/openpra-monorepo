import { JSX, useState } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import type { CcfParameterEstimation, DataAnalysis, DaSource, DaSourceEntry } from "interfaces-mef-types/da/data-analysis";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { DA_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed";
import { DaWorkbookProvider, EMPTY_UPSTREAM, type DaUpstream } from "../daWorkbookContext";
import type { DaDrawerContext } from "../daScreens";
import { CcfWindows } from "../daCcfScreen";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

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

function Harness({ start, context, onChange, upstream = EMPTY_UPSTREAM }: { start: DataAnalysis; context: DaDrawerContext; onChange: (da: DataAnalysis) => void; upstream?: DaUpstream }): JSX.Element {
  const [da, setDa] = useState<DataAnalysis>(start);
  return (
    <DaWorkbookProvider data={{ da, cc: CC, nms: [] }} editable upstream={upstream} mutateDa={(mutator) => setDa((current) => { const next = mutator(current); onChange(next); return next; })}>
      <CcfWindows context={context} onClose={() => undefined} onRetarget={() => undefined} />
    </DaWorkbookProvider>
  );
}

function estimateOf(da: DataAnalysis, id: string): CcfParameterEstimation | undefined {
  return (da.ccfParameterEstimations ?? []).find((candidate) => candidate.uuid === id);
}

function entry(id: string, value: number, failureMode: string, method?: string): DaSourceEntry {
  return { id, component: "Redundant components", failureMode, quantity: "PROBABILITY", table: "Test table", law: { family: "POINT", value }, ...(method === undefined ? {} : { method }) };
}

function source(id: string, catalogId: string, entries: DaSourceEntry[]): DaSource {
  return { id, name: catalogId, catalogId, kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR", covers: "Test", boundaryConvention: "Test", failureCounting: "Test", quality: "Test", reference: "Test", entries };
}

const PAIR: CcfParameterEstimation = {
  uuid: "DA-CCF-T",
  ccfGroupReference: "CCF-T",
  name: "Test pair",
  groupSize: 2,
  testing: "STAGGERED",
  testingReason: "Plan",
  parameterSource: "GENERIC",
  componentBoundaryConsistencyBasis: "Same",
  implementsSrs: [],
};

function withPair(sources: DaSource[], next: Partial<CcfParameterEstimation> = {}): DataAnalysis {
  return { ...DA_ANALYSIS_HTGR, sources: [...(DA_ANALYSIS_HTGR.sources ?? []), ...sources], ccfParameterEstimations: [{ ...PAIR, ...next }], ccfVectors: undefined, ccfFactors: undefined };
}

describe("common cause windows", () => {
  it("keeps the Dirichlet when the testing scheme changes and hands the scheme on with it", async () => {
    let latest: DataAnalysis = DA_ANALYSIS_HTGR;
    render(<Harness start={DA_ANALYSIS_HTGR} context={{ kind: "daCcfGroup", id: "DA-CCF-05" }} onChange={(next) => { latest = next; }} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Testing" }), "STAGGERED");
    const rods = estimateOf(latest, "DA-CCF-05");
    expect(rods?.testing).toBe("STAGGERED");
    const seeded = estimateOf(DA_ANALYSIS_HTGR, "DA-CCF-05")?.factors;
    expect(seeded?.model).toBe("ALPHA_FACTOR");
    expect(rods?.factors).toEqual(seeded?.model === "ALPHA_FACTOR" ? { ...seeded, testing: "STAGGERED" } : undefined);
  });

  it("moves the testing scheme of typed alpha factors with the group", async () => {
    let latest: DataAnalysis = DA_ANALYSIS;
    render(<Harness start={DA_ANALYSIS} context={{ kind: "daCcfGroup", id: "DA-CCF-21" }} onChange={(next) => { latest = next; }} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Testing" }), "STAGGERED");
    const software = estimateOf(latest, "DA-CCF-21");
    expect(software?.testing).toBe("STAGGERED");
    expect(software?.factors).toEqual({ model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "FIXED", values: [0, 0, 0, 1] } } });
  });

  it("types factors in the shared editor, starting from the derived Dirichlet", async () => {
    let latest: DataAnalysis = DA_ANALYSIS_HTGR;
    render(<Harness start={DA_ANALYSIS_HTGR} context={{ kind: "daCcfFactors", id: "DA-CCF-04" }} onChange={(next) => { latest = next; }} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Method" }), "TYPED");
    expect(estimateOf(latest, "DA-CCF-04")?.factors).toEqual({ model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [880.1, 12.01] } } });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Model" }), "BETA_FACTOR");
    const typed = estimateOf(latest, "DA-CCF-04");
    expect(typed?.method).toBe("TYPED");
    expect(typed?.factors?.model).toBe("BETA_FACTOR");
  });

  it("imports an EBR-II beta factor next to hand entry and states the conversion", async () => {
    const ebr = source("SRC-EBR", "EBR-II-PRA", [entry("EB-T7-36-BETAN-N2", 0.1, "Generic beta(n) factor, n = 2")]);
    const start = withPair([ebr]);
    let latest: DataAnalysis = start;
    render(<Harness start={start} context={{ kind: "daCcfFactors", id: "DA-CCF-T" }} onChange={(next) => { latest = next; }} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Method" }), "PRIOR");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Model" }), "BETA_FACTOR");
    await userEvent.click(screen.getByRole("combobox", { name: "Dataset values" }));
    await userEvent.click(await screen.findByRole("option", { name: /EB-T7-36-BETAN-N2/ }));
    const picked = estimateOf(latest, "DA-CCF-T");
    expect([picked?.priorSourceId, picked?.priorKind, picked?.priorTemplate]).toEqual(["SRC-EBR", "BETA", "EB-T7-36-BETAN-N2"]);
    await act(() => settledWithPraxis(() => undefined));
    expect(await screen.findByText("The source writes Qt = (1 + b) Qs. PRAXIS converts b to the standard b' = b / (1 + b), so 0.1 becomes 0.090909.")).toBeTruthy();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Method" }), "TYPED");
    expect(estimateOf(latest, "DA-CCF-T")?.factors?.model).toBe("BETA_FACTOR");
  });

  it("lists the dataset rows DA cannot use with their reasons", async () => {
    const cr4550 = source("SRC-4550", "NUREG-CR-4550", [
      entry("N4550-T6-2-1-DG-FTS-2", 0.038, "Fail to start, common cause beta factor, two components"),
      entry("N4550-T6-2-1-BWRSRV-FTRC-X2", 0.0013, "Fail to reclose, exactly two SRVs, probability per transient"),
    ]);
    render(<Harness start={withPair([cr4550], { method: "PRIOR" })} context={{ kind: "daCcfFactors", id: "DA-CCF-T" }} onChange={() => undefined} />);
    expect(screen.getByText("Rows DA cannot use (1)")).toBeTruthy();
    expect(screen.getByText("A probability per transient of failing to reclose, not a factor.")).toBeTruthy();
    expect(screen.getByText("SRC-4550 · N4550-T6-2-1-BWRSRV-FTRC-X2")).toBeTruthy();
  });

  it("links an imported alpha set to the shared vector of the workbook", async () => {
    const pairRows = [0.95, 0.05].map((value, index) => entry(`V2-T4-3-EDG-FTS-CCCG2-A${index + 1}`, value, `CCF alpha factor, fail to start, CCCG 2, alpha ${index + 1}`));
    const start = withPair([source("SRC-6890", "NUREG-CR-6890", pairRows)], { method: "PRIOR", priorSourceId: "SRC-6890", priorKind: "ALPHA_POINTS", priorTemplate: "V2-T4-3-EDG-FTS" });
    let latest: DataAnalysis = start;
    render(<Harness start={start} upstream={{ ...EMPTY_UPSTREAM, workbookId: "da-1" }} context={{ kind: "daCcfFactors", id: "DA-CCF-T" }} onChange={(next) => { latest = next; }} />);
    await act(() => settledWithPraxis(() => undefined));
    const id = "ccfv/SRC-6890/V2-T4-3-EDG-FTS/ALPHA_POINTS/C2";
    expect(latest.ccfVectors?.map((vector) => [vector.id, vector.vector])).toEqual([[id, { family: "FIXED", values: [0.95, 0.05] }]]);
    expect(estimateOf(latest, "DA-CCF-T")?.factors).toEqual({ model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: id } } });
  });

  it("imports counts as evidence and asks for rho when they are mapped up", async () => {
    const vector = "Impact vector for CCCG 2: Adj. Ind 10.00, N1 0.5000, N2 2.0000.";
    const ccf = source("SRC-CCF", "CCF-2020", [
      { ...entry("ALL-MDP-FS-C2-A1", 0.9, "Fail to start, CCCG 2, alpha 1", vector), law: { family: "BETA", alpha: 90, beta: 10, lower: 0, upper: 1 } },
      { ...entry("ALL-MDP-FS-C2-A2", 0.1, "Fail to start, CCCG 2, alpha 2", vector), law: { family: "BETA", alpha: 10, beta: 90, lower: 0, upper: 1 } },
    ]);
    const start = withPair([ccf], { groupSize: 3, method: "BAYES" });
    let latest: DataAnalysis = start;
    render(<Harness start={start} context={{ kind: "daCcfEvents", id: "DA-CCF-T" }} onChange={(next) => { latest = next; }} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Import events" }));
    await userEvent.click(await screen.findByRole("option", { name: /ALL-MDP-FS-C2/ }));
    const evidence = estimateOf(latest, "DA-CCF-T")?.evidence?.[0];
    expect(evidence).toMatchObject({ population: 2, independentFailures: 10, impactSize: 2, counts: [0.5, 2], imported: { sourceId: "SRC-CCF", kind: "IMPACT_VECTOR", set: "ALL-MDP-FS-C2", rowIds: ["ALL-MDP-FS-C2-A1"] } });
    expect(screen.getByRole("spinbutton", { name: "Rho" })).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "Lethal shocks" })).toBeTruthy();
  });
});
