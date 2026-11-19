import { JSX, useCallback, useMemo, useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { esqEndStateRunId, esqSequenceRunId, esqTreeRunId } from "interfaces-mef-types/esq/esq-run-inputs";
import { esqModelRunId } from "interfaces-mef-types/esq/esq-solve-inputs";
import type { EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import type { FaultTreeTopEventReference, HclHazardGridDefinition } from "interfaces-mef-types/modeling";
import type { EventTreeAnalysisResult, EventTreeExecuteResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { HclBatchExecuteResult, HclQuantificationResult } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import type { AnalysisRunMetadata } from "interfaces-shared-types/newly-developed-methods/shared";
import { TEST_ID } from "../../newly-developed-methods/bayesian-network/test/bayesianNetworkTestModel";
import { cancelAnalysisRun, listAnalysisJobs, type RunProgressListener } from "../../newly-developed-methods/shared/analysisRunWait";
import { WorkbookViewMemory } from "../../workbooks/workbookViewMemory";
import { EsqDependencies, IDLE_DEPENDENCY_SESSION, type DependencyModelRuns, type DependencySession } from "../EsqDependencies";
import { MODEL_AS_SET } from "../esqLogic";
import { EsqWorkbookProvider, type EsqWorkbookRuntime } from "../esqWorkbookContext";
import {
  generateEsqHclScenarios,
  getEsqHclEventTreeResult,
  getEsqHclFaultTreeResult,
  runEsqHclEventTree,
  runEsqHclEventTreeBatch,
  runEsqHclFaultTree,
  runEsqHclFaultTreeBatch,
  runEsqModel,
} from "../esqWorkbookApi";
import {
  CONFIGURATION_ID,
  ESQ_ID,
  NOW,
  SAVED,
  SCENARIO_HIGH,
  SCENARIO_LOW,
  SY_ID,
  dependencyConfiguration,
  dependencyEsq,
  dependencyScenarios,
} from "./esqDependencyFixtures";
import { modelUpstream } from "./esqModelFixtures";

jest.mock("../../newly-developed-methods/bayesian-network", () => ({
  ...jest.requireActual<typeof import("../../newly-developed-methods/bayesian-network")>("../../newly-developed-methods/bayesian-network"),
  BayesianNetworkEditor: () => null,
}));

jest.mock("../../newly-developed-methods/shared/analysisRunWait", () => ({
  ...jest.requireActual<typeof import("../../newly-developed-methods/shared/analysisRunWait")>("../../newly-developed-methods/shared/analysisRunWait"),
  listAnalysisJobs: jest.fn(),
  cancelAnalysisRun: jest.fn(),
}));

jest.mock("../esqWorkbookApi", () => ({
  ...jest.requireActual<typeof import("../esqWorkbookApi")>("../esqWorkbookApi"),
  generateEsqHclScenarios: jest.fn(),
  runEsqModel: jest.fn(),
  runEsqHclEventTree: jest.fn(),
  runEsqHclEventTreeBatch: jest.fn(),
  runEsqHclFaultTree: jest.fn(),
  runEsqHclFaultTreeBatch: jest.fn(),
  getEsqHclEventTreeResult: jest.fn(),
  getEsqHclFaultTreeResult: jest.fn(),
}));

const ET_A = { workbookId: ESQ_ID, modelId: "ET-A" };
const RELEASE = esqEndStateRunId("RADIONUCLIDE_RELEASE");
const SAFE = esqEndStateRunId("SUCCESSFUL_MITIGATION");
const GRID: HclHazardGridDefinition = {
  name: "Demand grid",
  hazardNodeIds: [TEST_ID.a],
  annualFrequencyScale: { value: 1, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8760 } },
  normalizeWeights: false,
};
const DEFAULT_SAMPLING = { sampleCount: 1000, sampler: "LHS", seed: 42 };

const show = jest.fn<void, [string]>();
const reload = jest.fn<void, []>();

function top(modelId: "M-COOL" | "M-SUP"): FaultTreeTopEventReference {
  return { referenceType: "FAULT_TREE_TOP_EVENT", workbookId: SY_ID, modelId, entityId: modelId === "M-COOL" ? "G-COOL" : "G-SUP" };
}

function runOf(id: string, status: AnalysisRunMetadata["status"] = "SUCCEEDED", failure?: string): AnalysisRunMetadata {
  const active = status === "QUEUED" || status === "RUNNING";
  return {
    schemaVersion: "1.0.0",
    id,
    owner: { workbookId: ESQ_ID, modelId: CONFIGURATION_ID, workbookRevision: 5 },
    sourceWorkbooks: [{ workbookId: ESQ_ID, workbookRevision: 5 }],
    methodType: "HYBRID_CAUSAL_LOGIC",
    status,
    requestedBy: "analyst",
    requestedAt: NOW,
    startedAt: status === "QUEUED" ? null : NOW,
    completedAt: active ? null : NOW,
    engine: null,
    failure: failure === undefined ? null : { kind: "ENGINE", code: "RUN_FAILED", message: failure, details: {} },
  };
}

function treeResult(runId: string, modelId: "M-COOL" | "M-SUP", probability: number, extra: Partial<HclQuantificationResult> = {}): HclQuantificationResult {
  return {
    schemaVersion: "1.0.0",
    runId,
    owner: { workbookId: ESQ_ID, workbookRevision: 5, modelId: CONFIGURATION_ID },
    faultTreeTopGate: top(modelId),
    probability,
    bddNodes: 3,
    bddVariables: 2,
    variableOrder: [],
    bridge: { quantifications: 1, bddContextCacheHits: 0, bddContextCacheMisses: 1, bnQueryCacheHits: 0, bnQueryCacheMisses: 1 },
    junctionTree: { numCliques: 1, maxCliqueSize: 2, treewidth: 1, totalTableEntries: 4 },
    validationIssues: [],
    completedAt: NOW,
    ...extra,
  };
}

function eventResult(runId: string): EventTreeAnalysisResult {
  return {
    schemaVersion: "1.0.0",
    runId,
    owner: { workbookId: ESQ_ID, workbookRevision: 5, modelId: CONFIGURATION_ID },
    mode: "HYBRID_CAUSAL_LOGIC",
    sequences: [
      { sequenceId: esqSequenceRunId("ET-A", "A-2"), path: [], result: { kind: "END_STATE", endStateId: RELEASE }, conditionalProbability: 0.02, annualFrequency: 0.05 },
      { sequenceId: esqSequenceRunId("ET-A", "A-1"), path: [], result: { kind: "END_STATE", endStateId: SAFE }, conditionalProbability: 0.98, annualFrequency: 2.45 },
    ],
    endStateAggregates: [
      { endStateId: RELEASE, annualFrequency: 0.05 },
      { endStateId: SAFE, annualFrequency: 2.45 },
    ],
    validationIssues: [],
    completedAt: NOW,
  };
}

function batchOf(extra: Partial<HclBatchExecuteResult> = {}): HclBatchExecuteResult {
  return {
    schemaVersion: "1.0.0",
    runs: [
      { scenarioId: SCENARIO_LOW, scenarioCode: "LOW", scenarioName: "Low demand", run: runOf("run-low") },
      { scenarioId: SCENARIO_HIGH, scenarioCode: "HIGH", scenarioName: "High demand", run: runOf("run-high") },
    ],
    ...extra,
  };
}

function withScenarios(patch: Partial<EsqHclConfiguration> = {}): EventSequenceQuantification {
  return dependencyEsq([dependencyConfiguration({ evidenceScenarios: dependencyScenarios(), ...patch })]);
}

function Harness({ initial, onChange, runtime = SAVED, editable = true, shownConfigurationId }: {
  initial: EventSequenceQuantification;
  onChange: (esq: EventSequenceQuantification) => void;
  runtime?: EsqWorkbookRuntime;
  editable?: boolean;
  shownConfigurationId?: string;
}): JSX.Element | null {
  const [esq, setEsq] = useState(initial);
  const [upstream] = useState(() => modelUpstream());
  const [session, setSession] = useState<DependencySession>(IDLE_DEPENDENCY_SESSION);
  const [shownId, setShownId] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(true);
  const modelRuns = useMemo<DependencyModelRuns>(() => ({
    ...(shownId === undefined ? {} : { shownId }),
    shownActive: false,
    ...(shownConfigurationId === undefined ? {} : { shownConfigurationId }),
    show: (runId) => {
      show(runId);
      setShownId(runId);
    },
    reload,
    render: () => <p>Shared run list</p>,
  }), [shownConfigurationId, shownId]);
  const mutateEsq = useCallback((mutator: (current: EventSequenceQuantification) => EventSequenceQuantification): void => setEsq((current) => {
    const next = mutator(current);
    onChange(next);
    return next;
  }), [onChange]);
  const model = esq.model;
  if (model === undefined) return null;
  return (
    <EsqWorkbookProvider data={{ esq }} editable={editable} mutateEsq={mutateEsq} upstream={upstream} runtime={runtime}>
      <button type="button" onClick={() => setOpen((shown) => !shown)}>Switch tab</button>
      <button type="button" onClick={() => mutateEsq((current) => ({ ...current, bayesianNetworks: current.bayesianNetworks.map((network) => ({ ...network, name: `${network.name} edited` })) }))}>Edit network</button>
      {open && <EsqDependencies model={model} modelRuns={modelRuns} session={session} onSession={setSession} />}
    </EsqWorkbookProvider>
  );
}

async function settle(): Promise<void> {
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await Promise.resolve(); });
}

async function mount(initial: EventSequenceQuantification = dependencyEsq(), options: { runtime?: EsqWorkbookRuntime; editable?: boolean; shownConfigurationId?: string } = {}): Promise<jest.Mock<void, [EventSequenceQuantification]>> {
  const onChange = jest.fn<void, [EventSequenceQuantification]>();
  render(<Harness initial={initial} onChange={onChange} {...options} />);
  await settle();
  return onChange;
}

function pick(group: string, option: string): void {
  fireEvent.click(within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name: option }));
}

function choose(label: string, value: string): void {
  fireEvent.change(screen.getByRole("combobox", { name: label }), { target: { value } });
}

function enter(label: string, value: string): void {
  fireEvent.change(screen.getByRole("spinbutton", { name: label }), { target: { value } });
}

function optionTexts(label: string): (string | null)[] {
  return within(screen.getByRole("combobox", { name: label })).getAllByRole("option").map((option) => option.textContent);
}

async function run(name = "Run dependencies"): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name }));
  await waitFor(() => expect(screen.getByRole("button", { name })).toBeEnabled());
}

function results(): HTMLElement {
  return screen.getByRole("region", { name: "Dependency results" });
}

describe("ESQ Step 05 dependency runs", () => {
  beforeEach(() => {
    window.localStorage.clear();
    show.mockReset();
    reload.mockReset();
    jest.mocked(listAnalysisJobs).mockReset();
    jest.mocked(listAnalysisJobs).mockResolvedValue({ schemaVersion: "1.0.0", jobs: [] });
    jest.mocked(cancelAnalysisRun).mockReset();
    jest.mocked(generateEsqHclScenarios).mockReset();
    jest.mocked(runEsqModel).mockReset();
    jest.mocked(runEsqModel).mockResolvedValue({ schemaVersion: "1.0.0", run: runOf("model-run") });
    jest.mocked(runEsqHclEventTree).mockReset();
    jest.mocked(runEsqHclEventTree).mockResolvedValue({ schemaVersion: "1.0.0", run: runOf("run-tree") });
    jest.mocked(runEsqHclEventTreeBatch).mockReset();
    jest.mocked(runEsqHclEventTreeBatch).mockResolvedValue(batchOf());
    jest.mocked(getEsqHclEventTreeResult).mockReset();
    jest.mocked(getEsqHclEventTreeResult).mockImplementation(async (_workbookId, _configurationId, runId) => eventResult(runId));
    jest.mocked(runEsqHclFaultTree).mockReset();
    jest.mocked(runEsqHclFaultTree).mockImplementation(async (_workbookId, _configurationId, _revision, topGate) => ({ schemaVersion: "1.0.0", run: runOf(`run-${topGate.modelId}`) }));
    jest.mocked(runEsqHclFaultTreeBatch).mockReset();
    jest.mocked(runEsqHclFaultTreeBatch).mockResolvedValue(batchOf());
    jest.mocked(getEsqHclFaultTreeResult).mockReset();
    jest.mocked(getEsqHclFaultTreeResult).mockImplementation(async (_workbookId, _configurationId, runId) => (runId === "run-M-SUP" ? treeResult(runId, "M-SUP", 0.004) : treeResult(runId, "M-COOL", 0.02)));
  });

  it("shows the run composer only for a network that has a configuration", async () => {
    const view = render(<Harness initial={dependencyEsq([])} onChange={jest.fn()} />);
    await settle();
    expect(screen.getByRole("heading", { name: "Dependencies" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No jobs running" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Dependency network" })).toHaveDisplayValue("BN-TEST · Test network");
    expect(screen.queryByLabelText("Dependency quantification controls")).not.toBeInTheDocument();
    view.unmount();
    await mount();
    const composer = within(screen.getByLabelText("Dependency quantification controls"));
    expect(within(composer.getByRole("radiogroup", { name: "Dependency target" })).getAllByRole("radio").map((radio) => radio.closest("label")?.textContent)).toEqual(["Event trees", "Fault trees"]);
    expect(within(composer.getByRole("radiogroup", { name: "Dependency workflow" })).getAllByRole("radio").map((radio) => radio.closest("label")?.textContent)).toEqual(["Manual", "Batch"]);
    expect(within(composer.getByRole("radiogroup", { name: "Dependency result" })).getAllByRole("radio").map((radio) => radio.closest("label")?.textContent)).toEqual(["Probability", "Uncertainty"]);
    expect(within(composer.getByRole("radiogroup", { name: "Dependency evidence" })).getAllByRole("radio").map((radio) => radio.closest("label")?.textContent)).toEqual(["Base evidence", "Evidence scenarios", "Hazard convolution"]);
    expect(optionTexts("Event tree")).toEqual(["ET-A · POS-01", "ET-B · POS-02"]);
    expect(composer.getByRole("button", { name: "Run dependencies" })).toBeEnabled();
  });

  it("names the running jobs by event trees, configuration, network and event tree, and cancels one", async () => {
    const named = dependencyConfiguration();
    const coded = dependencyConfiguration({ modelId: "30000000-0000-4000-8000-000000000002", code: "DEP-2", name: " " });
    const jobs = [esqModelRunId(), named.modelId, coded.modelId, TEST_ID.model, esqTreeRunId("ET-B")].map((modelId, index) => ({
      run: { ...runOf(`40000000-0000-4000-8000-00000000000${String(index)}`, index === 0 ? "RUNNING" : "QUEUED"), owner: { workbookId: ESQ_ID, modelId, workbookRevision: 5 } },
      calculationType: index === 1 ? "PROBABILITY" : null,
    }));
    jest.mocked(listAnalysisJobs).mockResolvedValue({ schemaVersion: "1.0.0", jobs });
    jest.mocked(cancelAnalysisRun).mockResolvedValue(runOf("40000000-0000-4000-8000-000000000001", "CANCELLED"));
    await mount(dependencyEsq([named, coded]));
    fireEvent.click(await screen.findByRole("button", { name: "1 running · 4 queued" }));
    const panel = within(screen.getByRole("dialog", { name: "Running jobs" }));
    expect(panel.getAllByRole("listitem").map((item) => item.querySelector("strong")?.textContent)).toEqual([
      "Event trees",
      "Dependencies · DEP-1 · Test network bindings · Probability",
      "Dependencies · DEP-2",
      "Network query · BN-TEST",
      "ET-B · POS-02",
    ]);
    fireEvent.click(panel.getByRole("button", { name: "Cancel Dependencies · DEP-1 · Test network bindings · Probability" }));
    fireEvent.click(within(screen.getByRole("alertdialog", { name: "Stop this job?" })).getByRole("button", { name: "Stop job" }));
    await waitFor(() => expect(cancelAnalysisRun).toHaveBeenCalledWith("esq", ESQ_ID, "40000000-0000-4000-8000-000000000001"));
    await settle();
  });

  it("runs the base model of an event tree through the shared run list", async () => {
    await mount();
    await run();
    expect(runEsqModel).toHaveBeenCalledTimes(1);
    expect(runEsqModel).toHaveBeenCalledWith(ESQ_ID, 5, { ...MODEL_AS_SET, expandCcf: false }, "EXACT", undefined, { workbookId: ESQ_ID, modelId: CONFIGURATION_ID }, expect.any(Function), ["ET-A"]);
    expect(show).toHaveBeenLastCalledWith("model-run");
    expect(reload).toHaveBeenCalled();
    expect(screen.getByText("Shared run list")).toBeInTheDocument();
    expect(runEsqHclEventTree).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Dependency results" })).not.toBeInTheDocument();
  });

  it("shows the shared run list only for a dependency run of this configuration", async () => {
    const other = render(<Harness initial={dependencyEsq()} onChange={jest.fn()} shownConfigurationId="another-configuration" />);
    await settle();
    expect(screen.queryByText("Shared run list")).not.toBeInTheDocument();
    other.unmount();
    const none = render(<Harness initial={dependencyEsq()} onChange={jest.fn()} />);
    await settle();
    expect(screen.queryByText("Shared run list")).not.toBeInTheDocument();
    none.unmount();
    await mount(dependencyEsq(), { shownConfigurationId: CONFIGURATION_ID });
    expect(screen.getByText("Shared run list")).toBeInTheDocument();
    pick("Dependency target", "Fault trees");
    expect(screen.queryByText("Shared run list")).not.toBeInTheDocument();
  });

  it("sends the chosen event trees of a batch to the base model run", async () => {
    await mount();
    pick("Dependency workflow", "Batch");
    expect(screen.getByText("2 event trees selected")).toBeInTheDocument();
    await run("Run dependencies batch");
    expect(jest.mocked(runEsqModel).mock.calls[0]?.[7]).toBeUndefined();
    fireEvent.click(screen.getByRole("checkbox", { name: "ET-A · POS-01" }));
    expect(screen.getByText("1 event tree selected")).toBeInTheDocument();
    await run("Run dependencies batch");
    expect(jest.mocked(runEsqModel).mock.calls[1]?.[7]).toEqual(["ET-B"]);
    fireEvent.click(screen.getByRole("checkbox", { name: "ET-B · POS-02" }));
    expect(screen.getByText("0 event trees selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run dependencies batch" })).toBeDisabled();
  });

  it("shows the progress of a base model run and stops it", async () => {
    let progress: RunProgressListener | undefined;
    let finish: (result: EventTreeExecuteResult) => void = () => undefined;
    jest.mocked(runEsqModel).mockImplementation((_workbookId, _revision, _logic, _calculation, _cutSets, _hcl, onProgress) => {
      progress = onProgress;
      return new Promise((resolve) => { finish = resolve; });
    });
    jest.mocked(cancelAnalysisRun).mockResolvedValue(runOf("model-run", "CANCELLED"));
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Run dependencies" }));
    expect(screen.getByRole("button", { name: "Running…" })).toBeDisabled();
    expect(screen.getByText("Building the event trees for PRAXIS")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    act(() => progress?.(runOf("model-run", "RUNNING")));
    expect(show).toHaveBeenCalledWith("model-run");
    expect(screen.queryByText("Building the event trees for PRAXIS")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(cancelAnalysisRun).toHaveBeenCalledWith("esq", ESQ_ID, "model-run");
    await act(async () => { finish({ schemaVersion: "1.0.0", run: runOf("model-run", "CANCELLED") }); });
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  });

  it("sends an event tree study with ranked cut sets and importance", async () => {
    await mount();
    choose("Event tree", "ET-B");
    choose("Ranked cut sets", "FAILED_EVENTS_AND_SEQUENCE");
    enter("Cut sets kept", "25");
    enter("Maximum cut set order", "3");
    choose("Cut set cutoff", "-8");
    enter("Causes per cut set", "5");
    choose("Importance under dependencies", "ON");
    expect(screen.queryByRole("spinbutton", { name: "Events sampled for importance" })).not.toBeInTheDocument();
    await run();
    expect(runEsqHclEventTree).toHaveBeenCalledTimes(1);
    expect(runEsqHclEventTree).toHaveBeenCalledWith(ESQ_ID, CONFIGURATION_ID, 5, { workbookId: ESQ_ID, modelId: "ET-B" }, "PROBABILITY", undefined, { score: "FAILED_EVENTS_AND_SEQUENCE", keep: 25, limitOrder: 3, cutOff: 1e-8, causes: 5 }, true);
    expect(getEsqHclEventTreeResult).toHaveBeenCalledWith(ESQ_ID, CONFIGURATION_ID, "run-tree");
    expect(runEsqModel).not.toHaveBeenCalled();
    expect(within(results()).getByRole("table", { name: "Sequences" })).toBeInTheDocument();
    expect(screen.queryByText("Shared run list")).not.toBeInTheDocument();
  });

  it("shows a picker for the results of a study over several event trees", async () => {
    await mount();
    pick("Dependency workflow", "Batch");
    choose("Importance under dependencies", "ON");
    await run("Run dependencies batch");
    expect(jest.mocked(runEsqHclEventTree).mock.calls.map((call) => call[3])).toEqual([ET_A, { workbookId: ESQ_ID, modelId: "ET-B" }]);
    const picker = within(results()).getByRole("combobox", { name: "Event tree" });
    expect(within(picker).getAllByRole("option").map((option) => option.textContent)).toEqual(["ET-A · POS-01", "ET-B · POS-02"]);
    expect(runEsqModel).not.toHaveBeenCalled();
  });

  it("leaves out the cut set limits and the importance that are switched off", async () => {
    await mount();
    choose("Ranked cut sets", "FAILED_EVENTS");
    await run();
    expect(jest.mocked(runEsqHclEventTree).mock.calls[0]?.slice(5)).toEqual([undefined, { score: "FAILED_EVENTS", keep: 100 }, undefined]);
    choose("Ranked cut sets", "NONE");
    choose("Importance under dependencies", "ON");
    await run();
    expect(jest.mocked(runEsqHclEventTree).mock.calls[1]?.slice(5)).toEqual([undefined, undefined, true]);
    expect(runEsqModel).not.toHaveBeenCalled();
  });

  it("sends the sampling and the sampled event count of an uncertainty study", async () => {
    await mount();
    pick("Dependency result", "Uncertainty");
    expect(screen.queryByRole("combobox", { name: "Ranked cut sets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Events sampled for importance" })).not.toBeInTheDocument();
    await run();
    expect(runEsqHclEventTree).toHaveBeenLastCalledWith(ESQ_ID, CONFIGURATION_ID, 5, ET_A, "UNCERTAINTY", DEFAULT_SAMPLING, undefined, undefined);
    choose("Importance under dependencies", "ON");
    expect(screen.getByRole("spinbutton", { name: "Events sampled for importance" })).toHaveValue(10);
    enter("Events sampled for importance", "500");
    expect(screen.getByRole("spinbutton", { name: "Events sampled for importance" })).toHaveValue(100);
    enter("Events sampled for importance", "7");
    choose("Dependency sampling method", "MC");
    choose("Dependency BN sampling method", "LHS");
    enter("Dependency samples", "250");
    enter("Dependency seed", "7");
    choose("Dependency parameter draws", "INDEPENDENT");
    choose("Dependency out-of-range probabilities", "CLIP");
    choose("Dependency zero-probability contexts", "FAIL");
    enter("Dependency CPT floor", "0.001");
    await run();
    expect(runEsqHclEventTree).toHaveBeenLastCalledWith(ESQ_ID, CONFIGURATION_ID, 5, ET_A, "UNCERTAINTY", {
      sampleCount: 250,
      sampler: "MC",
      seed: 7,
      cptSampler: "LHS",
      correlation: "INDEPENDENT",
      clipProbabilities: true,
      cptClipEpsilon: 0.001,
      zeroProbabilityContexts: "FAIL",
    }, undefined, 7);
    choose("Dependency seed source", "RUN");
    expect(screen.queryByRole("spinbutton", { name: "Dependency seed" })).not.toBeInTheDocument();
    await run();
    expect(jest.mocked(runEsqHclEventTree).mock.calls[2]?.[5]).not.toHaveProperty("seed");
  });

  it("starts the sampling from the settings saved in the configuration", async () => {
    await mount(dependencyEsq([dependencyConfiguration({
      solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true, uncertainty: { sampleCount: 250, seed: 9, sampler: "MC", basicEvents: [], cptRows: [], cptGenerators: [] } },
    })]));
    pick("Dependency result", "Uncertainty");
    expect(screen.getByRole("spinbutton", { name: "Dependency samples" })).toHaveValue(250);
    expect(screen.getByRole("spinbutton", { name: "Dependency seed" })).toHaveValue(9);
    expect(screen.getByRole("combobox", { name: "Dependency sampling method" })).toHaveValue("MC");
    await run();
    expect(jest.mocked(runEsqHclEventTree).mock.calls[0]?.[5]).toEqual({ sampleCount: 250, sampler: "MC", seed: 9 });
  });

  it("runs an event tree over the enabled scenarios and over the hazard grid", async () => {
    const off = { id: "30000000-0000-4000-8000-000000000013", code: "OFF", name: "Not used", enabled: false, evidence: { observations: [] } };
    await mount(withScenarios({ evidenceScenarios: [...dependencyScenarios(), off], hazardGrid: GRID }));
    pick("Dependency evidence", "Evidence scenarios");
    await run();
    expect(runEsqHclEventTreeBatch).toHaveBeenLastCalledWith(ESQ_ID, CONFIGURATION_ID, 5, ET_A, "PROBABILITY", [SCENARIO_LOW, SCENARIO_HIGH], false, undefined, undefined, undefined, undefined);
    expect(getEsqHclEventTreeResult).toHaveBeenCalledWith(ESQ_ID, CONFIGURATION_ID, "run-low");
    expect(getEsqHclEventTreeResult).toHaveBeenCalledWith(ESQ_ID, CONFIGURATION_ID, "run-high");
    expect(within(results()).getByRole("button", { name: "Results of LOW" })).toBeInTheDocument();
    expect(within(results()).getByRole("button", { name: "Results of HIGH" })).toBeInTheDocument();
    pick("Dependency evidence", "Hazard convolution");
    choose("Ranked cut sets", "FAILED_EVENTS");
    enter("Cut sets kept", "25");
    enter("Maximum cut set order", "3");
    await run();
    expect(runEsqHclEventTreeBatch).toHaveBeenLastCalledWith(ESQ_ID, CONFIGURATION_ID, 5, ET_A, "PROBABILITY", [SCENARIO_LOW, SCENARIO_HIGH], true, undefined, undefined, { score: "FAILED_EVENTS", keep: 25, limitOrder: 3 }, undefined);
    expect(runEsqHclEventTree).not.toHaveBeenCalled();
    expect(runEsqModel).not.toHaveBeenCalled();
  });

  it("runs a fault tree with ranked cut sets and never sends the success-branch score", async () => {
    await mount();
    choose("Ranked cut sets", "FAILED_EVENTS_AND_SEQUENCE");
    pick("Dependency target", "Fault trees");
    expect(optionTexts("Fault tree")).toEqual(["COOL-TOP · COOL fails", "SUP-TOP · SUP fails"]);
    expect(optionTexts("Ranked cut sets")).toEqual(["Off", "Failed events"]);
    expect(screen.getByRole("combobox", { name: "Ranked cut sets" })).toHaveValue("FAILED_EVENTS");
    await run();
    expect(runEsqHclFaultTree).toHaveBeenLastCalledWith(ESQ_ID, CONFIGURATION_ID, 5, top("M-COOL"), "PROBABILITY", undefined, { keep: 100 }, undefined);
    choose("Fault tree", "M-SUP");
    enter("Cut sets kept", "25");
    enter("Maximum cut set order", "3");
    choose("Cut set cutoff", "-8");
    enter("Causes per cut set", "250");
    expect(screen.getByRole("spinbutton", { name: "Causes per cut set" })).toHaveValue(100);
    await run();
    expect(runEsqHclFaultTree).toHaveBeenLastCalledWith(ESQ_ID, CONFIGURATION_ID, 5, top("M-SUP"), "PROBABILITY", undefined, { keep: 25, limitOrder: 3, cutOff: 1e-8, causes: 100 }, undefined);
    expect(getEsqHclFaultTreeResult).toHaveBeenLastCalledWith(ESQ_ID, CONFIGURATION_ID, "run-M-SUP");
    enter("Maximum cut set order", "");
    enter("Causes per cut set", "");
    choose("Cut set cutoff", "");
    await run();
    expect(jest.mocked(runEsqHclFaultTree).mock.calls[2]?.[6]).toEqual({ keep: 25 });
    choose("Ranked cut sets", "NONE");
    expect(screen.queryByRole("spinbutton", { name: "Cut sets kept" })).not.toBeInTheDocument();
    await run();
    expect(jest.mocked(runEsqHclFaultTree).mock.calls[3]?.slice(5)).toEqual([undefined, undefined, undefined]);
    expect(runEsqModel).not.toHaveBeenCalled();
    expect(runEsqHclEventTree).not.toHaveBeenCalled();
  });

  it("shows the result of a fault tree run with its event codes", async () => {
    jest.mocked(getEsqHclFaultTreeResult).mockResolvedValue(treeResult("run-M-SUP", "M-SUP", 0.004, {
      dependencyCutSets: { count: 3, items: [{ order: 2, probability: 0.003, basicEventIds: ["E-2", "E-3"] }] },
    }));
    await mount();
    pick("Dependency target", "Fault trees");
    choose("Fault tree", "M-SUP");
    choose("Ranked cut sets", "FAILED_EVENTS");
    await run();
    const result = within(within(results()).getByLabelText("Dependency fault tree result"));
    expect(result.getByText("SUP fails")).toBeInTheDocument();
    expect(result.getByText("4.00E-03")).toBeInTheDocument();
    expect(within(results()).queryByRole("combobox", { name: "Fault tree" })).not.toBeInTheDocument();
    fireEvent.click(result.getByRole("button", { name: "Cut sets of SUP-TOP · SUP fails" }));
    const dialog = within(screen.getByRole("dialog", { name: "Dependency cut sets" }));
    expect(dialog.getByText("SUP-HFE · SUP-FAN-FR")).toBeInTheDocument();
    expect(dialog.queryByText("E-2", { exact: false })).not.toBeInTheDocument();
  });

  it("names cut set events that sit in a transferred fault tree", async () => {
    jest.mocked(getEsqHclFaultTreeResult).mockResolvedValue(treeResult("run-M-COOL", "M-COOL", 0.004, {
      dependencyCutSets: { count: 1, items: [{ order: 3, probability: 0.003, basicEventIds: ["E-1", "E-2", "E-3"] }] },
    }));
    await mount();
    pick("Dependency target", "Fault trees");
    choose("Fault tree", "M-COOL");
    choose("Ranked cut sets", "FAILED_EVENTS");
    await run();
    fireEvent.click(within(results()).getByRole("button", { name: "Cut sets of COOL-TOP · COOL fails" }));
    const dialog = within(screen.getByRole("dialog", { name: "Dependency cut sets" }));
    expect(dialog.getByText("COOL-PMP-FS · SUP-HFE · SUP-FAN-FR")).toBeInTheDocument();
    expect(dialog.queryByText("Unlisted event", { exact: false })).not.toBeInTheDocument();
  });

  it("keeps the results of a study while another tab is open and drops them when the network changes", async () => {
    jest.mocked(getEsqHclFaultTreeResult).mockResolvedValue(treeResult("run-M-SUP", "M-SUP", 0.004));
    render(<WorkbookViewMemory scope="esq-dependency-session"><Harness initial={dependencyEsq()} onChange={jest.fn()} /></WorkbookViewMemory>);
    await settle();
    pick("Dependency target", "Fault trees");
    choose("Fault tree", "M-SUP");
    await run();
    expect(within(results()).getByText("4.00E-03")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch tab" }));
    expect(screen.queryByRole("region", { name: "Dependency results" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch tab" }));
    await settle();
    expect(within(results()).getByText("4.00E-03")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit network" }));
    await settle();
    expect(screen.queryByRole("region", { name: "Dependency results" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeEnabled();
  });

  it("keeps a run that finishes while another tab is open and blocks a second run meanwhile", async () => {
    let finish: (result: HclQuantificationResult) => void = () => undefined;
    jest.mocked(getEsqHclFaultTreeResult).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<WorkbookViewMemory scope="esq-dependency-late-run"><Harness initial={dependencyEsq()} onChange={jest.fn()} /></WorkbookViewMemory>);
    await settle();
    pick("Dependency target", "Fault trees");
    choose("Fault tree", "M-SUP");
    fireEvent.click(screen.getByRole("button", { name: "Run dependencies" }));
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Switch tab" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch tab" }));
    await settle();
    expect(screen.getByRole("button", { name: "Running…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Switch tab" }));
    await act(async () => { finish(treeResult("run-M-SUP", "M-SUP", 0.004)); });
    fireEvent.click(screen.getByRole("button", { name: "Switch tab" }));
    await settle();
    expect(within(results()).getByText("4.00E-03")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeEnabled();
    expect(runEsqHclFaultTree).toHaveBeenCalledTimes(1);
  });

  it("asks for the importance of a fault tree with and without ranked cut sets", async () => {
    await mount();
    pick("Dependency target", "Fault trees");
    choose("Importance under dependencies", "ON");
    await run();
    expect(jest.mocked(runEsqHclFaultTree).mock.calls[0]?.slice(4)).toEqual(["PROBABILITY", undefined, undefined, true]);
    choose("Ranked cut sets", "FAILED_EVENTS");
    await run();
    expect(jest.mocked(runEsqHclFaultTree).mock.calls[1]?.slice(4)).toEqual(["PROBABILITY", undefined, { keep: 100 }, true]);
    choose("Importance under dependencies", "OFF");
    await run();
    expect(jest.mocked(runEsqHclFaultTree).mock.calls[2]?.slice(4)).toEqual(["PROBABILITY", undefined, { keep: 100 }, undefined]);
    pick("Dependency result", "Uncertainty");
    expect(screen.queryByRole("combobox", { name: "Ranked cut sets" })).not.toBeInTheDocument();
    choose("Importance under dependencies", "ON");
    enter("Events sampled for importance", "4");
    await run();
    expect(jest.mocked(runEsqHclFaultTree).mock.calls[3]?.slice(4)).toEqual(["UNCERTAINTY", DEFAULT_SAMPLING, undefined, 4]);
  });

  it("runs a fault tree over the scenarios and over the hazard grid", async () => {
    jest.mocked(getEsqHclFaultTreeResult).mockImplementation(async (_workbookId, _configurationId, runId) => treeResult(runId, "M-COOL", runId === "run-low" ? 0.01 : 0.2));
    await mount(withScenarios({ hazardGrid: GRID }));
    pick("Dependency target", "Fault trees");
    pick("Dependency evidence", "Evidence scenarios");
    await run();
    expect(runEsqHclFaultTreeBatch).toHaveBeenLastCalledWith(ESQ_ID, CONFIGURATION_ID, 5, top("M-COOL"), "PROBABILITY", [SCENARIO_LOW, SCENARIO_HIGH], false, undefined, undefined, undefined, undefined);
    expect(getEsqHclFaultTreeResult).toHaveBeenCalledWith(ESQ_ID, CONFIGURATION_ID, "run-low");
    expect(getEsqHclFaultTreeResult).toHaveBeenCalledWith(ESQ_ID, CONFIGURATION_ID, "run-high");
    const batch = within(results()).getByLabelText("Dependency scenario batch result");
    expect(batch).toHaveTextContent("2 of 2 completed");
    expect(batch).toHaveTextContent("1.00E-02");
    expect(batch).toHaveTextContent("2.00E-01");
    pick("Dependency evidence", "Hazard convolution");
    choose("Ranked cut sets", "FAILED_EVENTS");
    enter("Cut sets kept", "50");
    choose("Importance under dependencies", "ON");
    await run();
    expect(runEsqHclFaultTreeBatch).toHaveBeenLastCalledWith(ESQ_ID, CONFIGURATION_ID, 5, top("M-COOL"), "PROBABILITY", [SCENARIO_LOW, SCENARIO_HIGH], true, undefined, undefined, { keep: 50 }, true);
    pick("Dependency result", "Uncertainty");
    expect(screen.queryByRole("combobox", { name: "Importance under dependencies" })).not.toBeInTheDocument();
    await run();
    expect(runEsqHclFaultTreeBatch).toHaveBeenLastCalledWith(ESQ_ID, CONFIGURATION_ID, 5, top("M-COOL"), "UNCERTAINTY", [SCENARIO_LOW, SCENARIO_HIGH], true, undefined, DEFAULT_SAMPLING, undefined, undefined);
    expect(runEsqHclFaultTree).not.toHaveBeenCalled();
  });

  it("shows no compilation counts for a fault tree batch", async () => {
    jest.mocked(runEsqHclFaultTreeBatch).mockResolvedValue(batchOf({ compilationReuse: { bddCompilations: 1, junctionTreeCompilations: 1, scenarioEvaluations: 2 } }));
    await mount(withScenarios());
    pick("Dependency target", "Fault trees");
    pick("Dependency evidence", "Evidence scenarios");
    await run();
    expect(within(results()).getByLabelText("Dependency scenario batch result")).toHaveTextContent("2 of 2 completed");
    expect(within(results()).queryByText("Batch compilation diagnostics")).not.toBeInTheDocument();
    expect(within(results()).queryByText("FT BDD compilations")).not.toBeInTheDocument();
  });

  it("closes the evidence scenarios when results arrive and keeps them closed until they are opened", async () => {
    await mount(withScenarios());
    pick("Dependency target", "Fault trees");
    pick("Dependency evidence", "Evidence scenarios");
    const toggle = screen.getByRole("button", { name: "Evidence scenarios" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("table", { name: "Evidence scenarios" })).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("table", { name: "Evidence scenarios" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Evidence scenarios" })).getByText("2 saved")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByRole("table", { name: "Evidence scenarios" })).toBeInTheDocument();
    await run();
    expect(within(results()).getByLabelText("Dependency scenario batch result")).toHaveTextContent("2 of 2 completed");
    expect(screen.getByRole("button", { name: "Evidence scenarios" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("table", { name: "Evidence scenarios" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add scenario" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Evidence scenarios" }));
    expect(screen.getByRole("table", { name: "Evidence scenarios" })).toHaveTextContent("LOW");
    expect(within(results()).getByLabelText("Dependency scenario batch result")).toBeInTheDocument();
  });

  it.each([
    ["JSON", "rows.json", JSON.stringify([{ code: "DRY", evidence: { A: "FALSE" } }, { code: "WET", evidence: { A: "TRUE" } }])],
    ["CSV", "rows.csv", 'code,name,enabled,evidence\nDRY,Dry,true,"{""A"":""FALSE""}"\nWET,Wet,true,"{""A"":""TRUE""}"'],
  ])("runs uploaded %s rows and their grid without saving them", async (_format, filename, text) => {
    const onChange = await mount(withScenarios());
    pick("Dependency target", "Fault trees");
    pick("Dependency evidence", "Hazard convolution");
    const file = new File([text], filename);
    Object.defineProperty(file, "text", { value: async () => text });
    fireEvent.change(screen.getByLabelText("Upload evidence scenarios"), { target: { files: [file] } });
    const rows = await screen.findByRole("table", { name: "Evidence scenarios" });
    expect(rows).toHaveTextContent("DRY");
    expect(rows).not.toHaveTextContent("LOW");
    const facts = within(screen.getByRole("table", { name: "Evidence" }));
    expect(facts.queryByRole("rowheader", { name: "Scenarios" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use saved scenarios" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("The evidence scenarios have no hazard grid.");
    fireEvent.click(facts.getByRole("checkbox", { name: "A" }));
    fireEvent.change(facts.getByRole("spinbutton", { name: "Annual scale" }), { target: { value: "3" } });
    fireEvent.blur(facts.getByRole("spinbutton", { name: "Annual scale" }));
    await run();
    const call = jest.mocked(runEsqHclFaultTreeBatch).mock.calls[0];
    const sent = call?.[7];
    expect(sent?.evidenceScenarios.map((row) => [row.code, row.enabled, row.evidence.observations])).toEqual([
      ["DRY", true, [{ nodeId: TEST_ID.a, stateId: TEST_ID.aFalse }]],
      ["WET", true, [{ nodeId: TEST_ID.a, stateId: TEST_ID.aTrue }]],
    ]);
    expect(sent?.hazardGrid).toEqual({ name: "DEP-1 hazard grid", hazardNodeIds: [TEST_ID.a], annualFrequencyScale: { value: 3, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8760 } }, normalizeWeights: false });
    expect(call?.[5]).toEqual(sent?.evidenceScenarios.map((row) => row.id));
    expect(call?.[6]).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Evidence scenarios" }));
    fireEvent.click(screen.getByRole("button", { name: "Use saved scenarios" }));
    expect(screen.getByRole("table", { name: "Evidence scenarios" })).toHaveTextContent("LOW");
    expect(within(screen.getByRole("table", { name: "Evidence" })).getByRole("checkbox", { name: "A" })).not.toBeChecked();
  });

  it("runs generated rows over every grid node of the generator without saving them", async () => {
    const cells = [[TEST_ID.aFalse, TEST_ID.bFalse], [TEST_ID.aTrue, TEST_ID.bFalse]].map(([a, b], index) => ({
      id: `30000000-0000-4000-8000-00000000002${String(index)}`,
      code: `hz_000${String(index + 1)}`,
      name: `Cell ${String(index + 1)}`,
      enabled: true,
      evidence: { observations: [{ nodeId: TEST_ID.a, stateId: a ?? "" }, { nodeId: TEST_ID.b, stateId: b ?? "" }] },
    }));
    jest.mocked(generateEsqHclScenarios).mockResolvedValue({ schemaVersion: "1.0.0", scenarios: cells });
    const onChange = await mount(withScenarios());
    pick("Dependency evidence", "Hazard convolution");
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    const dialog = within(screen.getByRole("dialog", { name: "Generate evidence scenarios" }));
    fireEvent.click(dialog.getByRole("checkbox", { name: "A" }));
    fireEvent.click(dialog.getByRole("checkbox", { name: "B" }));
    fireEvent.click(dialog.getByRole("checkbox", { name: "B TRUE" }));
    fireEvent.click(dialog.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Generate evidence scenarios" })).not.toBeInTheDocument());
    expect(generateEsqHclScenarios).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await run();
    const call = jest.mocked(runEsqHclEventTreeBatch).mock.calls[0];
    expect(call?.slice(3, 7)).toEqual([ET_A, "PROBABILITY", cells.map((cell) => cell.id), true]);
    expect(call?.[7]?.evidenceScenarios.map((row) => [row.id, row.code, row.evidence])).toEqual([
      [cells[0]?.id, "FALSE-FALSE", cells[0]?.evidence],
      [cells[1]?.id, "TRUE-FALSE", cells[1]?.evidence],
    ]);
    expect(call?.[7]?.hazardGrid?.hazardNodeIds).toEqual([TEST_ID.a, TEST_ID.b]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each((["Event trees", "Fault trees"] as const).flatMap((target) => [1, 2].map((count) => [target, count] as const)))(
    "offers %s for %s identical evidence row(s)",
    async (target, count) => {
      const [first] = dependencyScenarios();
      if (first === undefined) throw new Error("fixture has no scenario");
      const rows = [first, { ...first, id: SCENARIO_HIGH, code: "REPEATED", name: "Repeated evidence" }].slice(0, count);
      await mount(withScenarios({ evidenceScenarios: rows }));
      pick("Dependency target", target);
      pick("Dependency evidence", "Evidence scenarios");
      expect(optionTexts(target === "Event trees" ? "Event tree" : "Fault tree")[0]).toBe(target === "Event trees" ? "ET-A · POS-01" : "COOL-TOP · COOL fails");
      expect(screen.getByRole("button", { name: "Run dependencies" })).toBeEnabled();
      await run();
      const sent = target === "Event trees" ? jest.mocked(runEsqHclEventTreeBatch).mock.calls[0] : jest.mocked(runEsqHclFaultTreeBatch).mock.calls[0];
      expect(sent?.slice(3, 7)).toEqual([target === "Event trees" ? ET_A : top("M-COOL"), "PROBABILITY", rows.map((row) => row.id), false]);
    },
  );

  it("shows a picker for the results of a batch over several fault trees", async () => {
    await mount();
    pick("Dependency target", "Fault trees");
    pick("Dependency workflow", "Batch");
    expect(screen.queryByRole("combobox", { name: "Fault tree" })).not.toBeInTheDocument();
    expect(screen.getByText("2 fault trees selected")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "COOL-TOP · COOL fails" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "SUP-TOP · SUP fails" })).toBeChecked();
    await run("Run dependencies batch");
    expect(jest.mocked(runEsqHclFaultTree).mock.calls.map((call) => call[3])).toEqual([top("M-COOL"), top("M-SUP")]);
    const picker = within(results()).getByRole("combobox", { name: "Fault tree" });
    expect(within(picker).getAllByRole("option").map((option) => option.textContent)).toEqual(["COOL-TOP · COOL fails", "SUP-TOP · SUP fails"]);
    expect(within(results()).getByLabelText("Dependency fault tree result")).toHaveTextContent("2.00E-02");
    fireEvent.change(picker, { target: { value: "M-SUP" } });
    expect(within(results()).getByLabelText("Dependency fault tree result")).toHaveTextContent("4.00E-03");
    fireEvent.click(screen.getByRole("checkbox", { name: "COOL-TOP · COOL fails" }));
    expect(screen.getByText("1 fault tree selected")).toBeInTheDocument();
    await run("Run dependencies batch");
    expect(jest.mocked(runEsqHclFaultTree).mock.calls[2]?.[3]).toEqual(top("M-SUP"));
    expect(within(results()).queryByRole("combobox", { name: "Fault tree" })).not.toBeInTheDocument();
  });

  it("offers only the included fault trees that have a top event", async () => {
    await mount(dependencyEsq([dependencyConfiguration({ faultTrees: [{ workbookId: SY_ID, modelId: "M-SUP" }] })]));
    pick("Dependency target", "Fault trees");
    expect(optionTexts("Fault tree")).toEqual(["SUP-TOP · SUP fails"]);
  });

  it("disables the run when the configuration includes no fault tree", async () => {
    await mount(dependencyEsq([dependencyConfiguration({ faultTrees: [] })]));
    pick("Dependency target", "Fault trees");
    expect(screen.getByRole("combobox", { name: "Fault tree" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeDisabled();
  });

  it("shows why a fault tree run did not finish", async () => {
    jest.mocked(runEsqHclFaultTree).mockResolvedValueOnce({ schemaVersion: "1.0.0", run: runOf("run-failed", "FAILED", "The evidence is impossible.") });
    await mount();
    pick("Dependency target", "Fault trees");
    await run();
    expect(within(results()).getByRole("alert")).toHaveTextContent("The evidence is impossible.");
    expect(getEsqHclFaultTreeResult).not.toHaveBeenCalled();
    jest.mocked(runEsqHclFaultTree).mockRejectedValueOnce(new Error("The workbook changed."));
    await run();
    expect(within(results()).getByRole("alert")).toHaveTextContent("The workbook changed.");
  });

  it("lets a number of the run panel be emptied before a new one is typed", async () => {
    await mount();
    choose("Ranked cut sets", "FAILED_EVENTS");
    const kept = screen.getByRole("spinbutton", { name: "Cut sets kept" });
    enter("Cut sets kept", "");
    expect(kept).toHaveValue(null);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    enter("Cut sets kept", "25");
    expect(kept).toHaveValue(25);
    pick("Dependency result", "Uncertainty");
    const samples = screen.getByRole("spinbutton", { name: "Dependency samples" });
    enter("Dependency samples", "");
    expect(samples).toHaveValue(null);
    enter("Dependency samples", "200");
    expect(samples).toHaveValue(200);
    enter("Dependency samples", "");
    fireEvent.blur(samples);
    expect(samples).toHaveValue(200);
    const floor = screen.getByRole("spinbutton", { name: "Dependency CPT floor" });
    enter("Dependency CPT floor", "");
    expect(floor).toHaveValue(null);
    enter("Dependency CPT floor", "0.01");
    expect(floor).toHaveValue(0.01);
    choose("Importance under dependencies", "ON");
    const events = screen.getByRole("spinbutton", { name: "Events sampled for importance" });
    enter("Events sampled for importance", "");
    expect(events).toHaveValue(null);
    enter("Events sampled for importance", "7");
    expect(events).toHaveValue(7);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeEnabled();
  });

  it.each([
    ["0"],
    ["5000"],
  ])("blocks a ranked cut set run that keeps %s cut sets", async (keep) => {
    await mount();
    pick("Dependency target", "Fault trees");
    choose("Ranked cut sets", "FAILED_EVENTS");
    enter("Cut sets kept", keep);
    expect(screen.getByRole("alert")).toHaveTextContent("Keep between 1 and 1000 cut sets.");
    expect(screen.getByRole("spinbutton", { name: "Cut sets kept" })).toBeInvalid();
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeDisabled();
    pick("Dependency target", "Event trees");
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeDisabled();
    choose("Ranked cut sets", "NONE");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeEnabled();
  });

  it("blocks a scenario run until a scenario is on and a hazard run until the grid fits", async () => {
    const [low, high] = dependencyScenarios();
    if (low === undefined || high === undefined) throw new Error("fixture has no scenario");
    const cases: (readonly [Partial<EsqHclConfiguration>, "Evidence scenarios" | "Hazard convolution", string])[] = [
      [{ evidenceScenarios: [] }, "Evidence scenarios", "The dependency configuration has no enabled evidence scenario."],
      [{ evidenceScenarios: [{ ...low, enabled: false }] }, "Evidence scenarios", "The dependency configuration has no enabled evidence scenario."],
      [{ evidenceScenarios: [low, high] }, "Hazard convolution", "The evidence scenarios have no hazard grid."],
      [{ evidenceScenarios: [low, high], hazardGrid: { ...GRID, hazardNodeIds: [TEST_ID.a, TEST_ID.b] } }, "Hazard convolution", "Every evidence scenario must set each grid node."],
      [{ evidenceScenarios: [low, { ...high, evidence: low.evidence }], hazardGrid: GRID }, "Hazard convolution", "Two evidence scenarios set the same grid cell."],
      [{ evidenceScenarios: [low, { ...high, evidence: { observations: [{ nodeId: TEST_ID.a, stateId: "deleted-state" }] } }] }, "Evidence scenarios", "Evidence scenario HIGH sets a node or a state that is not in the network."],
      [{ evidenceScenarios: [low, { ...high, evidence: { observations: [{ nodeId: "deleted-node", stateId: TEST_ID.aTrue }] } }], hazardGrid: GRID }, "Hazard convolution", "Evidence scenario HIGH sets a node or a state that is not in the network."],
    ];
    for (const [patch, evidence, problem] of cases) {
      const view = render(<Harness initial={withScenarios(patch)} onChange={jest.fn()} />);
      await settle();
      pick("Dependency target", "Fault trees");
      pick("Dependency evidence", evidence);
      expect(optionTexts("Fault tree")).toEqual(["COOL-TOP · COOL fails", "SUP-TOP · SUP fails"]);
      expect(screen.getByRole("alert")).toHaveTextContent(problem);
      expect(screen.getByRole("button", { name: "Run dependencies" })).toBeDisabled();
      view.unmount();
    }
    expect(runEsqHclFaultTreeBatch).not.toHaveBeenCalled();
  });

  it("allows hazard convolution under probability and under uncertainty without changing the saved settings", async () => {
    const onChange = await mount(withScenarios({ hazardGrid: GRID }));
    pick("Dependency target", "Fault trees");
    pick("Dependency result", "Uncertainty");
    pick("Dependency evidence", "Hazard convolution");
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeEnabled();
    pick("Dependency result", "Probability");
    expect(within(screen.getByRole("radiogroup", { name: "Dependency evidence" })).getByRole("radio", { name: "Hazard convolution" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeEnabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    [null],
    ["legacy"],
    [[]],
    [{}],
    [{ sampleCount: 10, seed: 42, sampler: "BAD", basicEvents: [], cptRows: [], cptGenerators: [] }],
    [{ sampleCount: 10, seed: 42, sampler: "MC", basicEvents: null, cptRows: [], cptGenerators: [] }],
    [{ sampleCount: 10, seed: 42, sampler: "MC", basicEventDistributions: [], cptRowDistributions: [], cptProbabilityClipEpsilon: 0 }],
  ])("allows probability runs and blocks uncertainty runs without changing the saved draft %j", async (uncertainty) => {
    const onChange = await mount(withScenarios({ solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true, uncertainty } }));
    pick("Dependency target", "Fault trees");
    await run();
    expect(runEsqHclFaultTree).toHaveBeenCalledTimes(1);
    pick("Dependency evidence", "Evidence scenarios");
    await run();
    expect(runEsqHclFaultTreeBatch).toHaveBeenCalledTimes(1);
    pick("Dependency result", "Uncertainty");
    expect(screen.getByRole("alert")).toHaveTextContent("The uncertainty laws of this dependency configuration need review.");
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeDisabled();
    pick("Dependency evidence", "Base evidence");
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeDisabled();
    pick("Dependency result", "Probability");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeEnabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    ["0", true],
    ["4294967295", true],
    ["4294967296", true],
    ["4294967297", true],
    ["9007199254740990", true],
    ["9007199254740991", true],
    ["9007199254740992", false],
    ["9007199254740993", false],
    ["-1", false],
    ["1.5", false],
  ])("sends seed %s without truncation or unsafe rounding", async (value, accepted) => {
    await mount();
    pick("Dependency target", "Fault trees");
    pick("Dependency result", "Uncertainty");
    enter("Dependency seed", value);
    const seed = screen.getByRole("spinbutton", { name: "Dependency seed" });
    if (accepted) {
      expect(seed).toBeValid();
      await run();
      expect(jest.mocked(runEsqHclFaultTree).mock.calls[0]?.[5]?.seed).toBe(Number(value));
    } else {
      expect(seed).toBeInvalid();
      expect(screen.getByRole("alert")).toHaveTextContent("The seed must be a whole number from 0 to 9007199254740991.");
      expect(screen.getByRole("button", { name: "Run dependencies" })).toBeDisabled();
    }
  });

  it("blocks an uncertainty run with too few samples or a CPT floor out of range", async () => {
    await mount();
    pick("Dependency result", "Uncertainty");
    enter("Dependency samples", "1");
    expect(screen.getByRole("alert")).toHaveTextContent("Uncertainty samples must be a whole number of at least 2.");
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeDisabled();
    enter("Dependency samples", "2");
    enter("Dependency CPT floor", "0.5");
    expect(screen.getByRole("alert")).toHaveTextContent("The CPT floor must be at least 0 and below 0.5.");
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeDisabled();
    enter("Dependency CPT floor", "0.25");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeEnabled();
  });

  it("blocks an uncertainty run while the seed is empty and never sends seed 0 for it", async () => {
    jest.mocked(getEsqHclFaultTreeResult).mockResolvedValue(treeResult("run-M-COOL", "M-COOL", 0.02));
    await mount();
    pick("Dependency target", "Fault trees");
    pick("Dependency result", "Uncertainty");
    enter("Dependency seed", "");
    expect(screen.getByRole("spinbutton", { name: "Dependency seed" })).toHaveValue(null);
    expect(screen.getByRole("spinbutton", { name: "Dependency seed" })).toBeInvalid();
    expect(screen.getByRole("alert")).toHaveTextContent("The seed must be a whole number from 0 to 9007199254740991.");
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeDisabled();
    enter("Dependency seed", "7");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await run();
    expect(jest.mocked(runEsqHclFaultTree).mock.calls[0]?.[5]).toEqual({ ...DEFAULT_SAMPLING, seed: 7 });
    enter("Dependency seed", "");
    choose("Dependency seed source", "RUN");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Dependency seed" })).not.toBeInTheDocument();
  });

  it("holds the run during a save without a status line", async () => {
    await mount(dependencyEsq(), { runtime: { ...SAVED, saveStatus: "saving" } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeDisabled();
    pick("Dependency target", "Fault trees");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeDisabled();
  });

  it.each<[string, EsqWorkbookRuntime]>([
    ["Save failed. Reload or save successfully before running.", { ...SAVED, saveStatus: "failed" }],
    ["Save the workbook before running.", { ...SAVED, workbookId: null }],
  ])("blocks event tree and fault tree runs: %s", async (message, runtime) => {
    await mount(dependencyEsq(), { runtime });
    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeDisabled();
    pick("Dependency target", "Fault trees");
    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Run dependencies" })).toBeDisabled();
  });

  it("offers no run to a reader", async () => {
    await mount(dependencyEsq(), { editable: false });
    expect(screen.getByLabelText("Dependency quantification controls")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run dependencies" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add network" })).not.toBeInTheDocument();
  });

  it("keeps the selections and the sampling when the tab opens again", async () => {
    const tab = (): JSX.Element => <WorkbookViewMemory scope="esq-dependencies"><Harness initial={dependencyEsq()} onChange={jest.fn()} /></WorkbookViewMemory>;
    const first = render(tab());
    await settle();
    pick("Dependency target", "Fault trees");
    choose("Fault tree", "M-SUP");
    pick("Dependency result", "Uncertainty");
    enter("Dependency samples", "64");
    first.unmount();
    render(tab());
    await settle();
    expect(within(screen.getByRole("radiogroup", { name: "Dependency target" })).getByRole("radio", { name: "Fault trees" })).toBeChecked();
    expect(within(screen.getByRole("radiogroup", { name: "Dependency result" })).getByRole("radio", { name: "Uncertainty" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Fault tree" })).toHaveValue("M-SUP");
    expect(screen.getByRole("spinbutton", { name: "Dependency samples" })).toHaveValue(64);
  });
});
