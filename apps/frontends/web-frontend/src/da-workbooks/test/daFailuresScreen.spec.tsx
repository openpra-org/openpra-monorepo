import { JSX, useState } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import type { DataAnalysis, DaEvidence } from "interfaces-mef-types/da/data-analysis";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { uncertaintyIdle } from "../../newly-developed-methods/shared/useUncertainty";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { parameterPoint, readyNumber } from "../daLaws";
import { sciText } from "../daShared";
import { DaWorkbookProvider, EMPTY_UPSTREAM } from "../daWorkbookContext";
import { FailureWindows, FailuresScreen } from "../daFailuresScreen";
import { SC_EXAMPLES, linkScExamples } from "./daScExamples";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

const CIRCULATOR_PRIOR_RATE = 0.5 / ((90.5 / 1570000) * 2.39710255853434);

linkScExamples();

const SCREEN_UPSTREAM = { ...EMPTY_UPSTREAM, scReferenced: SC_EXAMPLES };

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

async function praxisRead<T>(read: () => T): Promise<T> {
  let value = read();
  await act(async () => {
    value = await settledWithPraxis(read);
  });
  return value;
}

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

function Harness({ children, onChange, initial = DA_ANALYSIS_HTGR }: { children: (da: DataAnalysis) => JSX.Element; onChange: (da: DataAnalysis) => void; initial?: DataAnalysis }): JSX.Element {
  const [da, setDa] = useState<DataAnalysis>(initial);
  return (
    <DaWorkbookProvider data={{ da, cc: CC, nms: [] }} upstream={SCREEN_UPSTREAM} editable mutateDa={(mutator) => setDa((current) => { const next = mutator(current); onChange(next); return next; })}>
      {children(da)}
    </DaWorkbookProvider>
  );
}

function withCirculatorFactor(nominal: number): DataAnalysis {
  return {
    ...DA_ANALYSIS_HTGR,
    parameters: DA_ANALYSIS_HTGR.parameters.map((parameter) => (parameter.uuid !== "DA-BE-205" ? parameter : { ...parameter, sourceUses: (parameter.sourceUses ?? []).map((use) => (use.id === "U-1" ? { ...use, factors: (use.factors ?? []).map((factor) => ({ ...factor, nominal })) } : use)) })),
  };
}

function circulatorCell(): HTMLElement | null {
  return screen.getByRole("button", { name: "DA-BE-205" }).closest("tr")?.querySelectorAll("td")[4] ?? null;
}

describe("FailuresScreen", () => {
  it("plots an estimate against its prior and evidence, and lists the judged records", async () => {
    render(<Harness onChange={() => undefined}>{() => <FailuresScreen openDrawer={() => undefined} />}</Harness>);
    expect(screen.getByRole("tab", { name: "Estimates (32 of 32)" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Estimates (32 of 32)" }));
    await settle();
    const row = screen.getByRole("button", { name: "DA-BE-205" }).closest("tr");
    expect(row?.textContent).toContain("Bayes update");
    expect(circulatorCell()?.textContent).toBe("2.33E-4");
    await userEvent.click(screen.getByRole("button", { name: "Plot the distribution of DA-BE-205" }));
    await settle();
    expect(screen.getByRole("button", { name: /^Estimate/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Prior used/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Evidence alone/ })).toBeInTheDocument();
    const detail = document.querySelector("tr.da-rowtable__detail-row")?.textContent ?? "";
    expect(detail).toContain("Bayes posterior");
    expect(detail).toContain("sampled");
    await userEvent.click(screen.getByRole("tab", { name: /^Records/ }));
    const sets = screen.getByRole("table", { name: "Record sets" });
    expect(within(sets).getByRole("row", { name: /RS-01/ }).textContent).toContain("15");
    expect(within(screen.getByRole("table", { name: "Records" })).getAllByText("Counts")).toHaveLength(2);
  }, 60_000);

  it("recomputes the estimate when the evidence window leaves the evidence out", async () => {
    let latest: DataAnalysis = DA_ANALYSIS_HTGR;
    render(<Harness onChange={(next) => { latest = next; }}>{() => <FailureWindows context={{ kind: "daEvidence", id: "DA-BE-205" }} onClose={() => undefined} onRetarget={() => undefined} />}</Harness>);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "In the update" }), "no");
    await settle();
    const circulator = latest.parameters.find((parameter) => parameter.uuid === "DA-BE-205");
    expect(circulator?.evidence?.[0]?.included).toBe(false);
    expect(circulator?.value).toBeUndefined();
    const rate = circulator?.estimate?.node === "MODEL" && circulator.estimate.model.form === "MISSION" ? circulator.estimate.model.rate : undefined;
    expect(rate).toEqual({ node: "VALUE", value: { unit: "PER_HOUR", law: { family: "GAMMA", shape: 0.5, rate: expect.closeTo(CIRCULATOR_PRIOR_RATE, 9) } } });
    const point = circulator === undefined ? undefined : await praxisRead(() => readyNumber(parameterPoint(circulator)));
    expect(point).toBeCloseTo(-Math.expm1((-24 * 0.5) / CIRCULATOR_PRIOR_RATE), 12);
  });

  it("types an estimate as a mission model in the estimate window", async () => {
    let latest: DataAnalysis = DA_ANALYSIS_HTGR;
    render(<Harness onChange={(next) => { latest = next; }}>{() => <FailureWindows context={{ kind: "daEstimate", id: "DA-BE-207" }} onClose={() => undefined} onRetarget={() => undefined} />}</Harness>);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Method" }), "TYPED");
    expect(screen.getByRole("combobox", { name: "Form" })).toHaveValue("MISSION");
    const source = screen.getByRole("combobox", { name: "Source" });
    expect(source).toHaveValue("example-sc-htgr:MT-DLOFC");
    await userEvent.selectOptions(source, "");
    const hours = screen.getByRole("textbox", { name: "Value" });
    await userEvent.clear(hours);
    await userEvent.type(hours, "12");
    await userEvent.tab();
    await settle();
    const cooler = latest.parameters.find((parameter) => parameter.uuid === "DA-BE-207");
    expect(cooler?.valueMode).toBe("TYPED");
    expect(cooler?.estimate).toEqual({ node: "MODEL", model: { form: "MISSION", rate: { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "GAMMA", shape: 0.483, rate: 1420000 } } }, missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 12 } } } } });
    const point = cooler === undefined ? undefined : await praxisRead(() => readyNumber(parameterPoint(cooler)));
    expect(point).toBeCloseTo(-Math.expm1((-12 * 0.483) / 1420000), 15);
  });

  it("edits the population hyperprior in the estimate window", async () => {
    const second: DaEvidence = { id: "EV-POP", origin: "TECHNOLOGY", failuresFrom: "TYPED", exposureFrom: "TYPED", failures: 3, exposure: 4e5, unit: "HOURS", boundary: "SAME", reason: "Second member of the population", included: true };
    const initial: DataAnalysis = {
      ...DA_ANALYSIS_HTGR,
      parameters: DA_ANALYSIS_HTGR.parameters.map((parameter) => (parameter.uuid === "DA-BE-205" ? { ...parameter, estimateMethod: "POPULATION" as const, evidence: [...(parameter.evidence ?? []), second] } : parameter)),
    };
    let latest: DataAnalysis = initial;
    render(<Harness initial={initial} onChange={(next) => { latest = next; }}>{() => <FailureWindows context={{ kind: "daEstimate", id: "DA-BE-205" }} onClose={() => undefined} onRetarget={() => undefined} />}</Harness>);
    await settle();
    expect(screen.getByText(/These are the default flat priors/)).toBeInTheDocument();
    const spreadLower = screen.getAllByRole("textbox", { name: "Lower" })[1];
    if (spreadLower === undefined) throw new Error("The log-spread prior has no lower bound field.");
    await userEvent.clear(spreadLower);
    await userEvent.type(spreadLower, "0.1");
    await userEvent.tab();
    await settle();
    const edited = latest.parameters.find((parameter) => parameter.uuid === "DA-BE-205")?.populationHyperprior;
    expect(edited?.sigma).toEqual({ family: "UNIFORM", lower: 0.1, upper: 3 });
    expect(edited?.mu.family).toBe("UNIFORM");
    await userEvent.click(screen.getByRole("button", { name: "Use the default priors" }));
    await settle();
    expect(latest.parameters.find((parameter) => parameter.uuid === "DA-BE-205")?.populationHyperprior).toBeUndefined();
  });

  it("shows a dot while PRAXIS works and the value once it answers", async () => {
    const waiting: (() => void)[] = [];
    jest.mocked(evaluateUncertainty).mockImplementation((request) => new Promise((resolve, reject) => { waiting.push(() => { praxisUncertainty(request).then(resolve, reject); }); }));
    render(<Harness onChange={() => undefined} initial={withCirculatorFactor(4)}>{() => <FailuresScreen openDrawer={() => undefined} />}</Harness>);
    await userEvent.click(screen.getByRole("tab", { name: /^Estimates/ }));
    expect(circulatorCell()?.textContent).toBe("…");
    expect(waiting.length).toBeGreaterThan(0);
    jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
    for (const release of waiting.splice(0)) release();
    await settle();
    const rate = 0.5 / (90.5 / (1570000 / 4)) + 253886;
    expect(circulatorCell()?.textContent).toBe(sciText(-Math.expm1((-24 * 2.5) / rate)));
  });

  it("shows the PRAXIS message when PRAXIS fails", async () => {
    jest.mocked(evaluateUncertainty).mockImplementation(() => Promise.reject(new Error("PRAXIS is out of reach.")));
    render(<Harness onChange={() => undefined} initial={withCirculatorFactor(3)}>{() => <FailuresScreen openDrawer={() => undefined} />}</Harness>);
    await userEvent.click(screen.getByRole("tab", { name: /^Estimates/ }));
    await settle();
    const cell = circulatorCell()?.querySelector(".da-severity--error");
    expect(cell?.textContent).toBe("Cannot compute");
    expect(cell?.getAttribute("title")).toContain("PRAXIS is out of reach.");
  });
});
