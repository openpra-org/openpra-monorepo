import { JSX, useCallback, useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EsqBayesianNetwork } from "interfaces-mef-types/esq/workbook-models";
import type { BayesianNetworkAnalysisResult } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import type { AnalysisRunMetadata } from "interfaces-shared-types/newly-developed-methods/shared";
import { fetchJson, postJson } from "../../api/client";
import { addNode, exportBayesianNetworkXdsl } from "../../newly-developed-methods/bayesian-network";
import { TEST_ID } from "../../newly-developed-methods/bayesian-network/test/bayesianNetworkTestModel";
import { ToastProvider } from "../../toast/toastProvider";
import { WorkbookViewMemory } from "../../workbooks/workbookViewMemory";
import { EsqDependencies, IDLE_DEPENDENCY_SESSION, type DependencySession } from "../EsqDependencies";
import { EsqWorkbookProvider } from "../esqWorkbookContext";
import { ESQ_ID, NOW, SAVED, SY_ID, dependencyConfiguration, dependencyEsq, testNetwork } from "./esqDependencyFixtures";
import { modelUpstream } from "./esqModelFixtures";

jest.mock("../../api/client", () => ({ fetchJson: jest.fn(), postJson: jest.fn() }));

const post = jest.mocked(postJson);
const get = jest.mocked(fetchJson);
const RUN_ID = "40000000-0000-4000-8000-000000000001";
const OTHER_NETWORK_ID = "10000000-0000-4000-8000-0000000000aa";
const OTHER_CONFIGURATION_ID = "30000000-0000-4000-8000-0000000000aa";
const RUNS_PATH = `/api/esq-workbooks/${ESQ_ID}/bayesian-networks/${TEST_ID.model}/runs`;

function otherNetwork(): EsqBayesianNetwork {
  return { ...testNetwork(), modelId: OTHER_NETWORK_ID, code: "BN-OTHER", name: "Other network" };
}

function networkRun(status: AnalysisRunMetadata["status"] = "SUCCEEDED", failure?: string): { schemaVersion: "1.0.0"; run: AnalysisRunMetadata } {
  return {
    schemaVersion: "1.0.0",
    run: {
      schemaVersion: "1.0.0",
      id: RUN_ID,
      owner: { workbookId: ESQ_ID, modelId: TEST_ID.model, workbookRevision: 5 },
      sourceWorkbooks: [{ workbookId: ESQ_ID, workbookRevision: 5 }],
      methodType: "BAYESIAN_NETWORK",
      status,
      requestedBy: "analyst",
      requestedAt: NOW,
      startedAt: NOW,
      completedAt: NOW,
      engine: null,
      failure: failure === undefined ? null : { kind: "ENGINE", code: "RUN_FAILED", message: failure, details: {} },
    },
  };
}

function posterior(falseShare: number): BayesianNetworkAnalysisResult {
  return {
    schemaVersion: "1.0.0",
    runId: RUN_ID,
    owner: { workbookId: ESQ_ID, modelId: TEST_ID.model, workbookRevision: 5 },
    evidence: { observations: [] },
    marginals: [{ nodeId: TEST_ID.a, values: [{ stateId: TEST_ID.aFalse, probability: falseShare }, { stateId: TEST_ID.aTrue, probability: 1 - falseShare }] }],
    validationIssues: [],
    completedAt: NOW,
  };
}

function Harness({ initial, onChange, editable = true }: {
  initial: EventSequenceQuantification;
  onChange: (esq: EventSequenceQuantification) => void;
  editable?: boolean;
}): JSX.Element | null {
  const [esq, setEsq] = useState(initial);
  const [upstream] = useState(() => modelUpstream());
  const [session, setSession] = useState<DependencySession>(IDLE_DEPENDENCY_SESSION);
  const mutateEsq = useCallback((mutator: (current: EventSequenceQuantification) => EventSequenceQuantification): void => setEsq((current) => {
    const next = mutator(current);
    onChange(next);
    return next;
  }), [onChange]);
  const model = esq.model;
  if (model === undefined) return null;
  return (
    <ToastProvider>
      <EsqWorkbookProvider data={{ esq }} editable={editable} mutateEsq={mutateEsq} upstream={upstream} runtime={SAVED}>
        <EsqDependencies model={model} modelRuns={{ shownActive: false, show: jest.fn(), reload: jest.fn(), render: () => <p>Shared run list</p> }} session={session} onSession={setSession} />
      </EsqWorkbookProvider>
    </ToastProvider>
  );
}

async function mount(initial: EventSequenceQuantification, options: { editable?: boolean } = {}): Promise<{ onChange: jest.Mock<void, [EventSequenceQuantification]>; container: HTMLElement }> {
  const onChange = jest.fn<void, [EventSequenceQuantification]>();
  const { container } = render(<Harness initial={initial} onChange={onChange} {...options} />);
  await act(async () => { await Promise.resolve(); });
  return { onChange, container };
}

function last(onChange: jest.Mock<void, [EventSequenceQuantification]>): EventSequenceQuantification {
  const calls = onChange.mock.calls;
  const esq = calls[calls.length - 1]?.[0];
  if (esq === undefined) throw new Error("the workbook was not changed");
  return esq;
}

function host(): HTMLElement {
  return screen.getByRole("region", { name: "Dependency network" });
}

function queryWorkflow(option: "Manual" | "Batch"): void {
  fireEvent.click(within(screen.getByRole("radiogroup", { name: "Network query workflow" })).getByRole("radio", { name: option }));
}

function resultCalls(): string[] {
  return get.mock.calls.map(([path]) => path).filter((path) => path.endsWith("/result"));
}

function fileOf(name: string, text: string): File {
  const file = new File([text], name);
  Object.defineProperty(file, "text", { value: async () => text });
  return file;
}

describe("ESQ Step 05 dependency network", () => {
  beforeEach(() => {
    window.localStorage.clear();
    post.mockReset();
    get.mockReset();
    get.mockImplementation(async (path) => {
      if (path.endsWith("/analysis-jobs")) return { schemaVersion: "1.0.0", jobs: [] };
      if (path.endsWith("/result")) return posterior(0.8);
      throw new Error(`No answer for ${path}`);
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it("shows only Add network when the workbook has no network", async () => {
    await mount(dependencyEsq([], []));
    expect(within(host()).getAllByRole("button").map((button) => button.textContent)).toEqual(["Add network"]);
    expect(within(host()).queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bayesian-network-editor")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Dependency quantification controls")).not.toBeInTheDocument();
  });

  it("adds a network to the workbook and selects it", async () => {
    const { onChange } = await mount(dependencyEsq([], []));
    fireEvent.click(screen.getByRole("button", { name: "Add network" }));
    const [first] = last(onChange).bayesianNetworks;
    expect(first).toMatchObject({ code: "BN-1", name: "Dependency network", nodes: [], edges: [], conditionalProbabilityTables: [] });
    expect(screen.getByRole("combobox", { name: "Dependency network" })).toHaveValue(first?.modelId);
    expect(screen.getByRole("combobox", { name: "Dependency network" })).toHaveDisplayValue("BN-1 · Dependency network");
    expect(screen.getByTestId("bayesian-network-editor")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Bayesian-network name" })).toHaveValue("Dependency network");
    fireEvent.change(screen.getByRole("textbox", { name: "Bayesian-network code" }), { target: { value: "DN-FIRST" } });
    fireEvent.click(screen.getByRole("button", { name: "Add network" }));
    const networks = last(onChange).bayesianNetworks;
    expect(networks.map((network) => network.code)).toEqual(["DN-FIRST", "BN-1"]);
    expect(screen.getByRole("combobox", { name: "Dependency network" })).toHaveValue(networks[1]?.modelId);
    fireEvent.change(screen.getByRole("combobox", { name: "Dependency network" }), { target: { value: first?.modelId } });
    expect(screen.getByRole("textbox", { name: "Bayesian-network code" })).toHaveValue("DN-FIRST");
    expect(last(onChange).hclConfigurations).toEqual([]);
  });

  it("saves the edits of the selected network in the workbook", async () => {
    const { onChange } = await mount(dependencyEsq([], [testNetwork(), otherNetwork()]));
    fireEvent.change(screen.getByRole("combobox", { name: "Dependency network" }), { target: { value: OTHER_NETWORK_ID } });
    fireEvent.change(screen.getByRole("textbox", { name: "Bayesian-network name" }), { target: { value: "Flood network" } });
    fireEvent.click(screen.getByRole("button", { name: "Add node" }));
    const [kept, edited] = last(onChange).bayesianNetworks;
    expect(kept).toEqual(testNetwork());
    expect(edited).toMatchObject({ modelId: OTHER_NETWORK_ID, code: "BN-OTHER", name: "Flood network" });
    expect(edited?.nodes.map((node) => node.code)).toEqual(["A", "B", "N-3"]);
    expect(screen.getByRole("combobox", { name: "Dependency network" })).toHaveDisplayValue("BN-OTHER · Flood network");
  });

  it("keeps the selected network when the tab opens again", async () => {
    const tab = (): JSX.Element => (
      <WorkbookViewMemory scope="esq-dependency-network">
        <Harness initial={dependencyEsq([], [testNetwork(), otherNetwork()])} onChange={jest.fn()} />
      </WorkbookViewMemory>
    );
    const first = render(tab());
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("combobox", { name: "Dependency network" })).toHaveDisplayValue("BN-TEST · Test network");
    fireEvent.change(screen.getByRole("combobox", { name: "Dependency network" }), { target: { value: OTHER_NETWORK_ID } });
    first.unmount();
    render(tab());
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("combobox", { name: "Dependency network" })).toHaveDisplayValue("BN-OTHER · Other network");
    expect(screen.getByRole("textbox", { name: "Bayesian-network code" })).toHaveValue("BN-OTHER");
  });

  it("deletes the network and its configurations after the confirmation", async () => {
    const mine = dependencyConfiguration();
    const theirs = dependencyConfiguration({ modelId: OTHER_CONFIGURATION_ID, code: "DEP-2", bayesianNetwork: { workbookId: ESQ_ID, modelId: OTHER_NETWORK_ID } });
    const { onChange } = await mount(dependencyEsq([mine, theirs], [testNetwork(), otherNetwork()]));
    fireEvent.click(within(host()).getByRole("button", { name: "Delete network" }));
    let dialog = screen.getByRole("alertdialog", { name: "Delete BN-TEST?" });
    expect(dialog).toHaveTextContent("1 dependency configuration using this network will also be removed.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.click(within(host()).getByRole("button", { name: "Delete network" }));
    dialog = screen.getByRole("alertdialog", { name: "Delete BN-TEST?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete network" }));
    expect(last(onChange).bayesianNetworks).toEqual([otherNetwork()]);
    expect(last(onChange).hclConfigurations).toEqual([theirs]);
    expect(screen.getByRole("combobox", { name: "Dependency network" })).toHaveDisplayValue("BN-OTHER · Other network");
    fireEvent.click(within(host()).getByRole("button", { name: "Delete network" }));
    fireEvent.click(within(screen.getByRole("alertdialog", { name: "Delete BN-OTHER?" })).getByRole("button", { name: "Delete network" }));
    expect(last(onChange).bayesianNetworks).toEqual([]);
    expect(last(onChange).hclConfigurations).toEqual([]);
    expect(within(host()).getAllByRole("button").map((button) => button.textContent)).toEqual(["Add network"]);
  });

  it("says how many Step 02 links lose their node when the network is deleted", async () => {
    const base = dependencyEsq();
    const target = { kind: "NETWORK_NODE" as const, node: { workbookId: ESQ_ID, modelId: TEST_ID.model, nodeId: TEST_ID.a }, trueStateIds: [TEST_ID.aTrue] };
    const elsewhere = { ...target, node: { ...target.node, modelId: OTHER_NETWORK_ID } };
    await mount({
      ...base,
      modelDecisions: {
        ...base.modelDecisions,
        functionLinks: [
          { functionId: "COOL", target, rules: [{ id: "rule-1", treeIds: ["ET-A"], groupIds: [], stateIds: [], target, reason: "" }] },
          { functionId: "SUP", target: elsewhere },
        ],
      },
    });
    fireEvent.click(within(host()).getByRole("button", { name: "Delete network" }));
    expect(screen.getByRole("alertdialog", { name: "Delete BN-TEST?" })).toHaveTextContent("1 dependency configuration using this network will also be removed. 2 function links in Step 02 will lose their nodes.");
  });

  it("creates a configuration and binds an SY basic event to a network state", async () => {
    const { onChange } = await mount(dependencyEsq([]));
    expect(screen.queryByLabelText("Dependency quantification controls")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create dependency configuration" }));
    expect(last(onChange).hclConfigurations).toEqual([{
      modelId: expect.any(String),
      code: "DEP-1",
      name: "Test network bindings",
      description: "Fault tree events bound to network states.",
      bayesianNetwork: { workbookId: ESQ_ID, modelId: TEST_ID.model },
      faultTrees: [],
      bindings: [],
      baseEvidence: { observations: [] },
      evidenceScenarios: [],
      solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
    }]);
    expect(screen.getByLabelText("Dependency quantification controls")).toBeInTheDocument();
    const manager = within(screen.getByLabelText("Dependency configuration manager"));
    fireEvent.click(manager.getByText("Bindings", { selector: "summary" }));
    const tree = manager.getByRole("combobox", { name: "Fault tree for binding" });
    expect(within(tree).getAllByRole("option").map((option) => option.textContent)).toEqual(["COOL-TOP", "SUP-TOP", "RPS-TOP"]);
    fireEvent.change(tree, { target: { value: `${SY_ID}:M-SUP` } });
    const event = manager.getByRole("combobox", { name: "Basic event for binding" });
    expect(within(event).getAllByRole("option").map((option) => option.textContent)).toEqual(["SUP-HFE", "SUP-FAN-FR"]);
    fireEvent.change(event, { target: { value: "E-3" } });
    fireEvent.change(manager.getByRole("combobox", { name: "Network node for binding" }), { target: { value: TEST_ID.b } });
    fireEvent.click(within(manager.getByRole("group", { name: "True states" })).getByRole("checkbox", { name: "TRUE" }));
    fireEvent.click(manager.getByRole("button", { name: "Add binding" }));
    const [configuration] = last(onChange).hclConfigurations;
    expect(configuration?.faultTrees).toEqual([{ workbookId: SY_ID, modelId: "M-SUP" }]);
    expect(configuration?.bindings).toEqual([{
      id: expect.any(String),
      faultTreeBasicEvent: { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId: SY_ID, entityId: "E-3" },
      bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: ESQ_ID, modelId: TEST_ID.model, entityId: TEST_ID.b },
      trueStateIds: [TEST_ID.bTrue],
    }]);
    const bindings = manager.getByRole("tabpanel", { name: "Dependency bindings" });
    expect(bindings).toHaveTextContent("1 mapping");
    expect(bindings).toHaveTextContent("Fault tree / basic eventSUP-TOP / SUP-FAN-FR");
    expect(bindings).toHaveTextContent("Network conditionB = TRUE");
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Dependency target" })).getByRole("radio", { name: "Fault trees" }));
    expect(within(screen.getByRole("combobox", { name: "Fault tree" })).getAllByRole("option").map((option) => option.textContent)).toEqual(["SUP-TOP · SUP fails"]);
  });

  it("keeps the base evidence in the configuration and sends it with a network query", async () => {
    post.mockResolvedValue(networkRun());
    const { onChange } = await mount(dependencyEsq());
    fireEvent.click(screen.getByRole("button", { name: "Edit evidence" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Evidence for B" }), { target: { value: TEST_ID.bTrue } });
    expect(last(onChange).hclConfigurations[0]?.baseEvidence).toEqual({ observations: [{ nodeId: TEST_ID.b, stateId: TEST_ID.bTrue }] });
    queryWorkflow("Manual");
    fireEvent.click(screen.getByRole("button", { name: "Run exact inference" }));
    await screen.findByLabelText("Posterior distribution");
    expect(post).toHaveBeenCalledWith(RUNS_PATH, expect.objectContaining({ query: { evidence: { observations: [{ nodeId: TEST_ID.b, stateId: TEST_ID.bTrue }] }, queryNodeIds: [TEST_ID.a] } }));
  });

  it("runs a network query through the ESQ workbook and shows the result", async () => {
    post.mockResolvedValue(networkRun());
    await mount(dependencyEsq([]));
    expect(screen.queryByRole("region", { name: "Network query" })).not.toBeInTheDocument();
    queryWorkflow("Manual");
    fireEvent.change(screen.getByRole("combobox", { name: "Bayesian-network query node" }), { target: { value: TEST_ID.b } });
    fireEvent.click(screen.getByRole("button", { name: "Run exact inference" }));
    const result = await screen.findByLabelText("Posterior distribution");
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(RUNS_PATH, {
      schemaVersion: "1.0.0",
      modelId: TEST_ID.model,
      workbookRevision: 5,
      query: { evidence: { observations: [] }, queryNodeIds: [TEST_ID.b] },
    });
    expect(resultCalls()).toEqual([`${RUNS_PATH}/${RUN_ID}/result`]);
    expect(within(result).getByText("A / FALSE")).toBeInTheDocument();
    expect(within(result).getByText("0.8")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run exact inference" })).toBeEnabled();
  });

  it("submits a batch of evidence rows once and shows a row for each of them", async () => {
    post.mockResolvedValue(networkRun());
    get.mockImplementation(async (path) => {
      if (path.endsWith("/analysis-jobs")) return { schemaVersion: "1.0.0", jobs: [] };
      return {
        scenarios: [
          { scenarioId: "50000000-0000-4000-8000-000000000001", scenarioCode: "DRY", scenarioName: "Dry room", status: "SUCCEEDED", failure: null, result: posterior(0.9) },
          { scenarioId: "50000000-0000-4000-8000-000000000002", scenarioCode: "WET", scenarioName: "Wet room", status: "FAILED", failure: "The evidence is impossible.", result: null },
        ],
      };
    });
    await mount(dependencyEsq([]));
    queryWorkflow("Batch");
    fireEvent.change(screen.getByLabelText("Upload BN evidence batch"), {
      target: { files: [fileOf("rows.json", JSON.stringify([{ code: "DRY", name: "Dry room", evidence: { B: "FALSE" } }, { code: "WET", name: "Wet room", evidence: { B: "TRUE" } }]))] },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Run batch" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Run batch" }));
    const batch = await screen.findByLabelText("BN query batch results");
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(RUNS_PATH, {
      schemaVersion: "1.0.0",
      modelId: TEST_ID.model,
      workbookRevision: 5,
      query: {
        scenarios: [
          { id: expect.any(String), code: "DRY", name: "Dry room", evidence: { observations: [{ nodeId: TEST_ID.b, stateId: TEST_ID.bFalse }] } },
          { id: expect.any(String), code: "WET", name: "Wet room", evidence: { observations: [{ nodeId: TEST_ID.b, stateId: TEST_ID.bTrue }] } },
        ],
        queryNodeIds: [TEST_ID.a],
      },
    });
    expect(resultCalls()).toEqual([`${RUNS_PATH}/${RUN_ID}/result`]);
    expect(within(batch).getByText("DRY").closest("summary")).toHaveTextContent("DRYDry roomComplete");
    expect(within(batch).getByText("WET").closest("summary")).toHaveTextContent("WETWet roomFailed");
    expect(within(batch).getByText("The evidence is impossible.")).toBeInTheDocument();
  });

  it("drops uploaded evidence rows when another network is picked", async () => {
    await mount(dependencyEsq([], [testNetwork(), otherNetwork()]));
    queryWorkflow("Batch");
    fireEvent.change(screen.getByLabelText("Upload BN evidence batch"), {
      target: { files: [fileOf("rows.json", JSON.stringify([{ code: "DRY", name: "Dry room", evidence: { B: "FALSE" } }]))] },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Run batch" })).toBeEnabled());
    fireEvent.change(screen.getByRole("combobox", { name: "Dependency network" }), { target: { value: OTHER_NETWORK_ID } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Run batch" })).toBeDisabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says why a network query did not finish", async () => {
    post.mockResolvedValueOnce(networkRun("FAILED", "The network has a cycle."));
    await mount(dependencyEsq([]));
    queryWorkflow("Manual");
    fireEvent.click(screen.getByRole("button", { name: "Run exact inference" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The network has a cycle.");
    post.mockRejectedValueOnce(new Error("The workbook changed."));
    fireEvent.click(screen.getByRole("button", { name: "Run exact inference" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("The workbook changed."));
    expect(post).toHaveBeenCalledTimes(2);
    expect(resultCalls()).toEqual([]);
    expect(screen.queryByLabelText("Posterior distribution")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run exact inference" })).toBeEnabled();
  });

  it("builds a new network from a specification and keeps the open network", async () => {
    jest.spyOn(HTMLInputElement.prototype, "click").mockImplementation();
    post.mockResolvedValue({ modelId: "built_case", networkFile: exportBayesianNetworkXdsl(addNode(testNetwork()).model), builderOrder: ["seismic"], couplingsApplied: 0, nodeCount: 3 });
    const { onChange, container } = await mount(dependencyEsq());
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Build from specification" }));
    const input = container.querySelector<HTMLInputElement>('input[type="file"][accept*=".yaml"]');
    if (input === null) throw new Error("the editor has no file input");
    fireEvent.change(input, { target: { files: [fileOf("site.yaml", "schema_version: '0.1'")] } });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith("/api/bayesian-network/network-builder", { format: "YAML", source: "schema_version: '0.1'" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    const [kept, built] = last(onChange).bayesianNetworks;
    expect(kept).toEqual(testNetwork());
    expect(built?.modelId).not.toBe(TEST_ID.model);
    expect(built?.nodes.map((node) => node.code)).toEqual(["A", "B", "N-3"]);
    expect(last(onChange).bayesianNetworks).toHaveLength(2);
    expect(last(onChange).hclConfigurations).toEqual([dependencyConfiguration()]);
    expect(screen.getByRole("combobox", { name: "Dependency network" })).toHaveValue(built?.modelId);
    expect(screen.getByRole("button", { name: "Create dependency configuration" })).toBeInTheDocument();
  });

  it("lets a reader look at the network and its configuration without edits", async () => {
    const bound = dependencyConfiguration({
      bindings: [{
        id: "30000000-0000-4000-8000-000000000031",
        faultTreeBasicEvent: { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId: SY_ID, entityId: "E-1" },
        bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: ESQ_ID, modelId: TEST_ID.model, entityId: TEST_ID.a },
        trueStateIds: [TEST_ID.aTrue],
      }],
    });
    const { onChange } = await mount(dependencyEsq([bound]), { editable: false });
    expect(within(host()).queryByRole("button", { name: "Add network" })).not.toBeInTheDocument();
    expect(within(host()).queryByRole("button", { name: "Delete network" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Dependency network" })).toHaveDisplayValue("BN-TEST · Test network");
    expect(screen.getByTestId("bayesian-network-editor")).toHaveClass("bneditor--readonly");
    expect(screen.getByRole("button", { name: "Add node" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Create dependency configuration" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Configuration" }));
    const manager = within(screen.getByLabelText("Dependency configuration manager"));
    expect(manager.getByRole("tabpanel", { name: "Dependency bindings" })).toHaveTextContent("COOL-TOP / COOL-PMP-FS");
    expect(manager.queryByRole("button", { name: "Add binding" })).not.toBeInTheDocument();
    expect(manager.queryByRole("button", { name: "Include" })).not.toBeInTheDocument();
    expect(manager.queryByRole("button", { name: "Delete binding COOL-PMP-FS" })).not.toBeInTheDocument();
    expect(manager.queryByRole("button", { name: "Enable uncertainty" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    const advanced = within(screen.getByLabelText("Advanced settings"));
    expect(advanced.getByRole("textbox", { name: "Code" })).toBeDisabled();
    expect(advanced.getByRole("checkbox", { name: "Fold constants" })).toBeDisabled();
    expect(advanced.queryByRole("button", { name: "Delete configuration" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run dependencies" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
