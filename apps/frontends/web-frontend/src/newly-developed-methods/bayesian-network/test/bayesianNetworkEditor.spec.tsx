import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type JSX } from "react";
import type { EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import type { BayesianNetworkEvidenceConfiguration, WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import {
  validateBayesianNetworkModel,
  type BayesianNetworkAnalysisResult,
  type BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { BayesianNetworkEditor } from "../bayesianNetworkEditor";
import { connectNodes } from "../bayesianNetworkOperations";
import type {
  BayesianNetworkFaultTreeOption,
  BayesianNetworkQueryBatchResult,
} from "../bayesianNetworkTypes";
import { ToastContainer } from "../../../toast/toastContainer";
import { ToastProvider } from "../../../toast/toastProvider";
import {
  HclBindingEditor,
  type HclEditorBatchRunResult,
  type HclEditorRunResult,
  type HclEventTreeOption,
} from "../../hybrid-causal-logic";
import { serializeHclCutSetsCsv } from "../../hybrid-causal-logic/hclCutSetExport";
import { serializeHclImportanceCsv } from "../../hybrid-causal-logic/hclImportanceExport";
import { TEST_ID, testBayesianNetworkModel } from "./bayesianNetworkTestModel";

const WORKBOOK_ID = "esq-workbook";
const FT_WORKBOOK_ID = "sy-workbook";
const FT_MODEL_ID = "20000000-0000-4000-8000-000000000001";
const BASIC_EVENT_ID = "20000000-0000-4000-8000-000000000002";
const TOP_GATE_ID = "20000000-0000-4000-8000-000000000003";
const ET_MODEL_ID = "20000000-0000-4000-8000-000000000005";

function pointerEvent(
  type: "pointerdown" | "pointermove" | "pointerup",
  init: MouseEventInit & { pointerId: number },
): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, "pointerId", { value: init.pointerId });
  return event;
}

const faultTreeOptions: BayesianNetworkFaultTreeOption[] = [{
  workbookId: FT_WORKBOOK_ID,
  workbookName: "Systems workbook",
  modelId: FT_MODEL_ID,
  modelCode: "FT-A",
  modelName: "Fault tree A",
  topGateId: TOP_GATE_ID,
  basicEvents: [{ id: BASIC_EVENT_ID, code: "BE-PUMP", name: "Pump failure" }],
  gates: [{ id: TOP_GATE_ID, gateType: "OR" }],
  leafNodes: [{ id: "20000000-0000-4000-8000-000000000004", kind: "BASIC_EVENT_REFERENCE", basicEventId: BASIC_EVENT_ID }],
  gateInputs: [{
    gateId: TOP_GATE_ID,
    childId: "20000000-0000-4000-8000-000000000004",
    order: 0,
  }],
  constantBasicEventStates: {},
}];

const syOwnedConfiguration: WorkbookHclConfiguration = {
  modelId: "20000000-0000-4000-8000-000000000006",
  code: "HCL-SY",
  name: "SY dependency configuration",
  description: "Fault-tree dependency configuration owned by Systems Analysis.",
  bayesianNetwork: { workbookId: FT_WORKBOOK_ID, modelId: TEST_ID.model },
  faultTrees: [{ workbookId: FT_WORKBOOK_ID, modelId: FT_MODEL_ID }],
  bindings: [],
  baseEvidence: { observations: [] },
  evidenceScenarios: [],
  solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
};

const linkedEventTree: HclEventTreeOption = {
  workbookId: "es-workbook",
  workbookName: "Event Sequence Analysis",
  modelId: ET_MODEL_ID,
  modelCode: "ET-LOSS-COOLING",
  modelName: "Loss of cooling event tree",
  sequences: [{ id: "20000000-0000-4000-8000-000000000007", name: "Safe" }],
  faultTrees: [{ workbookId: FT_WORKBOOK_ID, modelId: FT_MODEL_ID }],
  linkedFaultTrees: [{
    workbookId: FT_WORKBOOK_ID,
    workbookName: "Systems workbook",
    modelId: FT_MODEL_ID,
    modelCode: "FT-A",
    modelName: "Fault tree A",
    functionalEvents: [{
      id: "20000000-0000-4000-8000-000000000008",
      code: "FE-PUMP",
      name: "Pump responds",
      topGateId: TOP_GATE_ID,
    }],
  }],
  transferTargets: [],
};

const analysisResult: BayesianNetworkAnalysisResult = {
  schemaVersion: "1.0.0",
  runId: "30000000-0000-4000-8000-000000000001",
  owner: { workbookId: WORKBOOK_ID, modelId: TEST_ID.model, workbookRevision: 2 },
  evidence: { observations: [] },
  marginals: [{
    nodeId: TEST_ID.a,
    values: [
      { stateId: TEST_ID.aFalse, probability: 0.8 },
      { stateId: TEST_ID.aTrue, probability: 0.2 },
    ],
  }],
  validationIssues: [],
  completedAt: "2026-08-23T12:00:00.000Z",
};

const unchangedBatchResult: HclEditorBatchRunResult = {
  kind: "FAULT_TREE",
  scenarios: ["1", "2"].map((suffix) => ({
    scenarioId: `30000000-0000-4000-8000-00000000000${suffix}`,
    scenarioCode: `SCN-${suffix}`,
    scenarioName: `Scenario ${suffix}`,
    status: "SUCCEEDED" as const,
    failure: null,
    result: {
      kind: "FAULT_TREE" as const,
      result: {
        schemaVersion: "1.0.0" as const,
        runId: `40000000-0000-4000-8000-00000000000${suffix}`,
        owner: { workbookId: WORKBOOK_ID, modelId: TEST_ID.model, workbookRevision: 2 },
        faultTreeTopGate: {
          referenceType: "FAULT_TREE_TOP_EVENT" as const,
          workbookId: FT_WORKBOOK_ID,
          modelId: FT_MODEL_ID,
          entityId: TOP_GATE_ID,
        },
        probability: 0.25,
        cutSets: {
          totalCount: 1,
          cutSets: [{
            rank: 1,
            order: 1,
            probability: 0.25,
            coverage: 1,
            literals: [{
              basicEventId: BASIC_EVENT_ID,
              complemented: false,
              binding: {
                bayesianNetworkNodeId: TEST_ID.a,
                stateIds: [TEST_ID.aTrue],
                parentNodeIds: [],
              },
            }],
            bnAncestorNodeIds: [],
            bnRootCauseNodeIds: [],
          }],
        },
        bddNodes: 1,
        bddVariables: 1,
        variableOrder: [BASIC_EVENT_ID],
        bridge: {
          quantifications: 1,
          bddContextCacheHits: 0,
          bddContextCacheMisses: 1,
          bnQueryCacheHits: 0,
          bnQueryCacheMisses: 1,
        },
        junctionTree: {
          numCliques: 1,
          maxCliqueSize: 1,
          treewidth: 0,
          totalTableEntries: 2,
        },
        validationIssues: [],
        completedAt: "2026-08-31T12:00:00.000Z",
      },
    },
  })),
};

const commonHclResult = unchangedBatchResult.scenarios[0]!.result as HclEditorRunResult;

function hclResultWithCutSets(count: number): HclEditorRunResult {
  if (commonHclResult.kind !== "FAULT_TREE" || commonHclResult.result.cutSets === undefined) {
    throw new Error("Expected the common test result to contain fault-tree cut sets");
  }
  const template = commonHclResult.result.cutSets.cutSets[0]!;
  return {
    kind: "FAULT_TREE",
    result: {
      ...commonHclResult.result,
      cutSets: {
        totalCount: count,
        cutSets: Array.from({ length: count }, (_, index) => ({
          ...template,
          rank: index + 1,
          probability: template.probability / (index + 1),
          coverage: 1 / (index + 1),
        })),
      },
    },
  };
}

function hclResultWithImportance(count: number): HclEditorRunResult {
  if (commonHclResult.kind !== "FAULT_TREE") {
    throw new Error("Expected a fault-tree test result");
  }
  const template = {
    rank: 1,
    basicEventId: BASIC_EVENT_ID,
    bayesianNetworkNodeId: TEST_ID.a,
    eventProbability: 0.25,
    probabilityIfTrue: 1,
    probabilityIfFalse: 0,
    birnbaum: 1,
    criticality: 1,
    fussellVesely: 1,
    riskAchievementWorth: 4,
    riskReductionWorth: null,
  };
  return {
    kind: "FAULT_TREE",
    result: {
      ...commonHclResult.result,
      importance: {
        totalCount: count,
        measures: Array.from({ length: count }, (_, index) => ({
          ...template,
          rank: index + 1,
          basicEventId: `${BASIC_EVENT_ID}-${String(index + 1)}`,
          fussellVesely: 1 / (index + 1),
        })),
      },
    },
  };
}

const eventHclResult = {
  kind: "EVENT_TREE",
  result: {
    schemaVersion: "1.0.0",
    runId: "40000000-0000-4000-8000-000000000010",
    owner: { workbookId: linkedEventTree.workbookId, modelId: linkedEventTree.modelId, workbookRevision: 2 },
    mode: "HYBRID_CAUSAL_LOGIC",
    sequences: [{
      sequenceId: linkedEventTree.sequences[0]!.id,
      path: [],
      result: { kind: "END_STATE", endStateId: "40000000-0000-4000-8000-000000000011" },
      conditionalProbability: 0.25,
      annualFrequency: 0.00025,
      cutSets: {
        totalCount: 1,
        cutSets: [{
          rank: 1,
          order: 1,
          probability: 0.25,
          coverage: 1,
          literals: [{
            basicEventId: BASIC_EVENT_ID,
            complemented: false,
            binding: {
              bayesianNetworkNodeId: TEST_ID.a,
              stateIds: [TEST_ID.aTrue],
              parentNodeIds: [],
            },
          }],
          bnAncestorNodeIds: [],
          bnRootCauseNodeIds: [],
        }],
      },
    }],
    endStateAggregates: [{
      endStateId: "40000000-0000-4000-8000-000000000011",
      annualFrequency: 0.00025,
    }],
    validationIssues: [],
    completedAt: "2026-08-31T12:00:00.000Z",
  },
} as HclEditorRunResult;
const hazardBatchResult: HclEditorBatchRunResult = {
  ...unchangedBatchResult,
  hazardConvolution: {
    targetKind: "FAULT_TREE",
    gridName: "Hazard grid",
    annualFrequencyScale: {
      value: 1,
      unit: "PER_YEAR",
      annualization: { basis: "PLANT_YEAR", hoursPerYear: 8_760 },
    },
    annualizedFrequencyScale: 1,
    normalizeWeights: true,
    rawWeightSum: 0.9944,
    convolutionWeightSum: 1,
    rows: unchangedBatchResult.scenarios.map((scenario, index) => ({
      scenarioId: scenario.scenarioId,
      rawWeight: index === 0 ? 0.75 : 0.2444,
      normalizedWeight: index === 0 ? 0.7542 : 0.2458,
      convolutionWeight: index === 0 ? 0.7542 : 0.2458,
      annualFrequency: index === 0 ? 0.7542 : 0.2458,
      conditionalProbability: 0.25,
      annualContribution: index === 0 ? 0.18855 : 0.06145,
    })),
    integratedAnnualFrequency: 0.25,
  },
};

function Harness({
  initialModel = testBayesianNetworkModel(),
  editable = true,
  showQueryAnalysis = true,
  hclScope = "FAULT_TREE",
  result = null,
  onRun = jest.fn(),
  onConfigurationsChange = jest.fn(),
  onRunHclFaultTree = jest.fn(),
  onRunHclFaultTreeBatch = jest.fn(),
  hclRunResult = null,
  hclBatchRunResult = null,
  onModelChange = jest.fn(),
  queryBatchResult = null,
  onRunBatch = jest.fn(),
}: {
  initialModel?: BayesianNetworkModel;
  editable?: boolean;
  showQueryAnalysis?: boolean;
  hclScope?: "BOTH" | "FAULT_TREE" | "EVENT_TREE";
  result?: BayesianNetworkAnalysisResult | null;
  onRun?: () => void;
  onConfigurationsChange?: (configurations: EsqHclConfiguration[]) => void;
  onRunHclFaultTree?: jest.Mock;
  onRunHclFaultTreeBatch?: jest.Mock;
  hclRunResult?: HclEditorRunResult | null;
  hclBatchRunResult?: HclEditorBatchRunResult | null;
  onModelChange?: (model: BayesianNetworkModel) => void;
  queryBatchResult?: BayesianNetworkQueryBatchResult | null;
  onRunBatch?: jest.Mock;
}): JSX.Element {
  const [model, setModel] = useState(initialModel);
  const [evidence, setEvidence] = useState<BayesianNetworkEvidenceConfiguration>({ observations: [] });
  const [queryNodeId, setQueryNodeId] = useState<string | null>(model.nodes[0]?.id ?? null);
  const [configurations, setConfigurations] = useState<EsqHclConfiguration[]>([]);
  const validation = validateBayesianNetworkModel(model, {
    evidence,
    hclBindings: configurations.flatMap((configuration) => configuration.bindings),
    workbookId: WORKBOOK_ID,
  });
  function replaceConfigurations(next: EsqHclConfiguration[]): void {
    setConfigurations(next);
    onConfigurationsChange(next);
  }
  function replaceModel(next: BayesianNetworkModel): void {
    setModel(next);
    onModelChange(next);
  }
  return (
    <ToastProvider>
      <BayesianNetworkEditor
        model={model}
        editable={editable}
        showQueryAnalysis={showQueryAnalysis}
        hclScope={hclScope}
        evidence={evidence}
        queryNodeId={queryNodeId}
        validation={validation}
        analysisResult={result}
        queryBatchResult={queryBatchResult}
        running={false}
        runError={null}
        workbookId={WORKBOOK_ID}
        hclConfigurations={configurations}
        faultTreeOptions={faultTreeOptions}
        eventTreeOptions={[]}
        hclRunning={false}
        hclRunError={null}
        hclRunResult={hclRunResult}
        hclBatchRunResult={hclBatchRunResult}
        onModelChange={replaceModel}
        onEvidenceChange={setEvidence}
        onQueryNodeChange={setQueryNodeId}
        onHclConfigurationsChange={replaceConfigurations}
        onRunHclFaultTree={onRunHclFaultTree}
        onRunHclEventTree={jest.fn()}
        onRunHclFaultTreeBatch={onRunHclFaultTreeBatch}
        onRunHclEventTreeBatch={jest.fn()}
        onRunBatch={onRunBatch}
        onRun={onRun}
      />
      <ToastContainer />
    </ToastProvider>
  );
}

describe("BayesianNetworkEditor", () => {
  afterEach(() => jest.restoreAllMocks());

  it("renders the canonical graph, CPT, and exact-query controls", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "Manual" }));

    expect(screen.getByLabelText("Bayesian-network graph")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /BN node/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Connection handle/i })).toHaveLength(8);
    expect(screen.getAllByLabelText(/State code/)).toHaveLength(2);
    expect(screen.queryByLabelText(/State name/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("CPT for A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run exact inference" })).toBeEnabled();
    expect(screen.queryByText(/backend selector/i)).not.toBeInTheDocument();
  });

  it("keeps evidence and HCL setup behind compact progressive controls", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("radio", { name: "BN query" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Manual" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Batch" })).not.toBeChecked();
    expect(screen.queryByLabelText("Bayesian-network query node")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Manual" }));

    expect(screen.queryByText("No evidence")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Evidence for A")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create HCL configuration" })).not.toBeInTheDocument();
    const evidenceAction = screen.getByRole("button", { name: "Edit evidence" });
    expect(evidenceAction.closest(".bneditor__query-composer")).not.toBeNull();
    expect(evidenceAction).toHaveClass("posnav__btn", "posnav__btn--sm");

    await user.click(screen.getByRole("button", { name: "Edit evidence" }));
    const evidenceEditor = screen.getByLabelText("Evidence editor");
    expect(evidenceEditor).toBeInTheDocument();
    expect(evidenceEditor.closest(".bneditor__evidence-anchor")).not.toBeNull();
    expect(screen.getByLabelText("Evidence for A")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Probability" }));
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    expect(screen.getByRole("button", { name: "Create HCL configuration" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run exact inference" })).not.toBeInTheDocument();
  });

  it("imports JSON or CSV evidence rows for BN batch inference", async () => {
    const user = userEvent.setup();
    const onRunBatch = jest.fn();
    const { container } = render(<Harness onRunBatch={onRunBatch} />);

    await user.click(screen.getByRole("radio", { name: "Batch" }));
    const batchActions = screen.getByRole("region", { name: "BN query" }).querySelector(".bneditor__batch-intake");
    expect(batchActions).not.toBeNull();
    expect(within(batchActions as HTMLElement).getAllByRole("button")).toHaveLength(3);
    expect(within(batchActions as HTMLElement).getByRole("button", { name: "Upload JSON/CSV" })).toBeInTheDocument();
    const sampleButton = within(batchActions as HTMLElement).getByRole("button", { name: "Download samples" });
    expect(sampleButton).toContainHTML("<svg");
    expect(screen.queryByText("JSON or CSV")).not.toBeInTheDocument();

    await user.click(sampleButton);
    const sampleDetails = sampleButton.closest("details");
    expect(sampleDetails).toHaveAttribute("open");
    const sampleMenu = screen.getByRole("menu", { name: "BN query batch samples" });
    expect(within(sampleMenu).getByRole("menuitem", { name: "Sample JSON" })).toBeInTheDocument();
    expect(within(sampleMenu).getByRole("menuitem", { name: "Sample CSV" })).toBeInTheDocument();
    await user.click(screen.getByText("Query node"));
    expect(sampleDetails).not.toHaveAttribute("open");

    const input = container.querySelector<HTMLInputElement>('input[type="file"][accept*=".csv"]');
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute("accept", expect.stringContaining(".json"));
    expect(input).toHaveAttribute("accept", expect.stringContaining(".csv"));
    const source = JSON.stringify({
      schemaVersion: "1.0.0",
      scenarios: [{ code: "SCN-1", name: "Scenario 1", enabled: true, evidence: { A: "TRUE" } }],
    });
    const file = new File([source], "evidence.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => source });
    fireEvent.change(input!, { target: { files: [file] } });

    expect(await screen.findByText("1", { selector: ".bneditor__batch-upload b" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run batch" }));
    expect(onRunBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        code: "SCN-1",
        evidence: { observations: [{ nodeId: TEST_ID.a, stateId: TEST_ID.aTrue }] },
      }),
    ]);
  });

  it("presents each BN query batch posterior in a collapsible scenario row", async () => {
    const user = userEvent.setup();
    const queryBatchResult: BayesianNetworkQueryBatchResult = {
      queryNodeId: TEST_ID.a,
      scenarios: [{
        scenarioId: "30000000-0000-4000-8000-000000000099",
        scenarioCode: "BNQ-BASE",
        scenarioName: "No seismic, flood, or fire hazard",
        status: "SUCCEEDED",
        failure: null,
        result: analysisResult,
      }],
    };
    render(<Harness queryBatchResult={queryBatchResult} />);

    await user.click(screen.getByRole("radio", { name: "Batch" }));
    const scenario = screen.getByText("BNQ-BASE").closest("details");
    expect(scenario).not.toHaveAttribute("open");
    expect(scenario).toHaveTextContent("Complete");
    await user.click(screen.getByText("BNQ-BASE"));
    expect(within(scenario!).getByText("80.00%")).toBeInTheDocument();
    expect(within(scenario!).getByText("20.00%")).toBeInTheDocument();
  });

  it("adds a node and supports undo and redo", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Add node" }));
    expect(screen.getAllByRole("button", { name: /BN node/i })).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getAllByRole("button", { name: /BN node/i })).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.getAllByRole("button", { name: /BN node/i })).toHaveLength(3);
  });

  it("closes the node inspector when the blank canvas is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByLabelText("Bayesian-network node inspector")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Bayesian-network graph"));

    expect(screen.queryByLabelText("Bayesian-network node inspector")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "BN node Cause" }));
    expect(screen.getByLabelText("Bayesian-network node inspector")).toBeInTheDocument();
  });

  it("allows temporarily empty node identity fields without persisting an invalid model", async () => {
    const user = userEvent.setup();
    const onModelChange = jest.fn();
    render(<Harness onModelChange={onModelChange} />);
    const inspector = screen.getByLabelText("Bayesian-network node inspector");
    const code = within(inspector).getByLabelText("Code");
    const name = within(inspector).getByLabelText("Name");

    await user.clear(code);
    expect(code).toHaveValue("");
    expect(onModelChange).not.toHaveBeenCalled();
    expect(screen.getByText("Node code is required.")).toBeInTheDocument();

    await user.type(code, "X");
    expect(code).toHaveValue("X");
    expect(onModelChange).toHaveBeenCalledWith(expect.objectContaining({
      nodes: expect.arrayContaining([expect.objectContaining({ id: TEST_ID.a, code: "X" })]),
    }));

    onModelChange.mockClear();
    await user.clear(name);
    expect(name).toHaveValue("");
    expect(onModelChange).not.toHaveBeenCalled();
    expect(screen.getByText("Node name is required.")).toBeInTheDocument();
  });

  it("keeps a duplicate node code local and reports it through a warning toast", async () => {
    const user = userEvent.setup();
    const onModelChange = jest.fn();
    render(<Harness onModelChange={onModelChange} />);
    const code = within(screen.getByLabelText("Bayesian-network node inspector")).getByLabelText("Code");

    await user.clear(code);
    await user.type(code, "b");

    expect(code).toHaveValue("b");
    expect(onModelChange).not.toHaveBeenCalled();
    expect(screen.getByText("Bayesian-network node codes must be unique.")).toBeInTheDocument();
    expect(screen.queryByText("Validation")).not.toBeInTheDocument();
  });

  it("allows a temporarily empty state code without persisting an invalid model", async () => {
    const user = userEvent.setup();
    const onModelChange = jest.fn();
    render(<Harness onModelChange={onModelChange} />);
    const stateCode = screen.getAllByLabelText(/State code/)[0]!;

    await user.clear(stateCode);

    expect(stateCode).toHaveValue("");
    expect(onModelChange).not.toHaveBeenCalled();
    expect(screen.getByText("State code is required.")).toBeInTheDocument();

    await user.type(stateCode, "OFF");
    expect(stateCode).toHaveValue("OFF");
    expect(onModelChange).toHaveBeenLastCalledWith(expect.objectContaining({
      nodes: expect.arrayContaining([expect.objectContaining({
        id: TEST_ID.a,
        states: expect.arrayContaining([expect.objectContaining({ id: TEST_ID.aFalse, code: "OFF" })]),
      })]),
    }));
  });

  it("creates and instantiates a reusable branch module with compatible inputs", async () => {
    const user = userEvent.setup();
    const initial = testBayesianNetworkModel();
    initial.nodes[1]!.states = initial.nodes[1]!.states.map((state, index) => ({
      ...state,
      code: index === 0 ? "OFF" : "ON",
    }));
    render(<Harness initialModel={connectNodes(initial, TEST_ID.a, TEST_ID.b)} />);

    await user.click(screen.getByRole("button", { name: "BN node Effect" }));
    await user.click(screen.getByRole("button", { name: "Reusable modules" }));
    expect(screen.queryByText("Reusable modules", { selector: "strong" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Save a branch once/i)).not.toBeInTheDocument();
    expect(screen.getByText("Select the branch root and save it as a module")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toHaveClass("bneditor__module-save");
    await user.click(save);

    const savedModules = screen.getByLabelText("Saved modules");
    const moduleCard = within(savedModules).getByText("MOD-B").closest("details");
    expect(moduleCard).not.toHaveAttribute("open");
    await user.click(within(savedModules).getByText("MOD-B"));
    expect(moduleCard).toHaveAttribute("open");
    expect(within(savedModules).getByLabelText("Code")).toHaveValue("MOD-B-1");
    expect(within(savedModules).getByLabelText("Name")).toHaveValue("Effect module 1");
    expect(within(savedModules).getByText("Input")).toBeInTheDocument();
    const inputList = within(savedModules).getByText("Input").parentElement;
    expect(inputList).toHaveTextContent(/^InputA$/);
    expect(inputList).not.toHaveTextContent(/→|Cause/);
    expect(within(savedModules).queryByRole("combobox", { name: "Input A" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Instance code|Instance name|Add instance/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use this module" }));

    expect(screen.getAllByRole("button", { name: /BN node/i })).toHaveLength(3);
    expect(screen.getByText("Module instance")).toBeInTheDocument();
  });

  it("closes the reusable-module viewport when clicking outside it", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole("button", { name: "Reusable modules" });
    const menu = trigger.closest("details");
    await user.click(trigger);
    expect(menu).toHaveAttribute("open");

    await user.click(screen.getByLabelText("Bayesian-network graph"));

    expect(menu).not.toHaveAttribute("open");
  });

  it("uses the shared icon treatment for history, file, and canvas tools", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("radio", { name: "Manual" }));

    const toolbar = screen.getByLabelText("Bayesian-network tools");
    ["Undo", "Redo", "File"].forEach((name) => {
      const control = within(toolbar).getByRole("button", { name });
      expect(control).toContainHTML("<svg");
      expect(control).not.toHaveTextContent(name);
    });

    const canvas = screen.getByLabelText("Bayesian-network graph").closest(".bneditor__canvas");
    const controls = screen.getByLabelText("Bayesian-network canvas controls");
    expect(canvas).toContainElement(controls);
    ["Add node", "Auto arrange", "Zoom out", "Zoom in", "Fit"].forEach((name) => {
      expect(within(controls).getByRole("button", { name })).toContainHTML("<svg");
    });

    const deleteNode = screen.getByRole("button", { name: "Delete node" });
    const inspector = screen.getByLabelText("Bayesian-network node inspector");
    expect(deleteNode).toHaveClass("posnav__btn", "posnav__btn--sm", "bneditor__delete-btn");
    expect(deleteNode).toContainHTML("<svg");
    expect(inspector.lastElementChild).toContainElement(deleteNode);
    expect(screen.queryByText("Selected node")).not.toBeInTheDocument();

    const inferenceAction = screen.getByRole("button", { name: "Run exact inference" });
    expect(inferenceAction).toHaveClass(
      "posnav__btn",
      "posnav__btn--sm",
      "posnav__btn--primary",
      "bneditor__query-submit",
    );
    expect(inferenceAction).toContainHTML("<svg");

    fireEvent.click(screen.getByRole("radio", { name: "Probability" }));
    fireEvent.click(screen.getByRole("radio", { name: "Manual" }));
    const configurationAction = screen.getByRole("button", { name: "Create HCL configuration" });
    expect(configurationAction).toHaveClass("posnav__btn", "posnav__btn--sm", "posnav__btn--primary");
    expect(configurationAction).toContainHTML("<svg");
  });

  it("offers a centered first-node action before showing canvas controls", async () => {
    const user = userEvent.setup();
    const emptyModel = testBayesianNetworkModel();
    emptyModel.nodes = [];
    emptyModel.edges = [];
    emptyModel.conditionalProbabilityTables = [];
    emptyModel.nodePositions = [];
    render(<Harness initialModel={emptyModel} />);

    const editor = screen.getByTestId("bayesian-network-editor");
    expect(editor.querySelector(".bneditor__workspace")).not.toHaveClass("bneditor__workspace--inspecting");
    expect(screen.queryByLabelText("Bayesian-network node inspector")).not.toBeInTheDocument();
    expect(screen.getByText("Add node to begin.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add first node" })).toContainHTML("<svg");
    expect(screen.queryByLabelText("Bayesian-network canvas controls")).not.toBeInTheDocument();
    expect(screen.queryByText("No discrete nodes yet")).not.toBeInTheDocument();
    expect(screen.queryByText(/Select a node to edit/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add first node" }));

    expect(screen.getByLabelText("Bayesian-network canvas controls")).toBeInTheDocument();
    expect(screen.getByLabelText("Bayesian-network node inspector")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add first node" })).not.toBeInTheDocument();
  });

  it("groups import and export actions under the File menu", async () => {
    const user = userEvent.setup();
    const inputClick = jest.spyOn(HTMLInputElement.prototype, "click").mockImplementation();
    render(<Harness />);

    const fileButton = screen.getByRole("button", { name: "File" });
    const details = fileButton.closest("details");
    expect(details).not.toHaveAttribute("open");
    await user.click(fileButton);
    expect(details).toHaveAttribute("open");
    const menu = screen.getByRole("menu", { name: "Bayesian-network file actions" });
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Export XDSL",
      "Export JSON",
      "Import XDSL",
      "Import JSON",
    ]);

    await user.click(within(menu).getByRole("menuitem", { name: "Import JSON" }));
    expect(inputClick).toHaveBeenCalledTimes(1);
    expect(details).not.toHaveAttribute("open");
  });

  it("warns and rebuilds CPTs after a state change", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Add state" }));

    const dialog = screen.getByRole("alertdialog", { name: "Rebuild probability tables?" });
    expect(dialog).toHaveTextContent(/will not be reinterpreted/i);
    expect(screen.getAllByLabelText(/State code/)).toHaveLength(2);
    await user.click(within(dialog).getByRole("button", { name: "Rebuild CPTs" }));

    expect(screen.getAllByLabelText(/State code/)).toHaveLength(3);
    const cpt = screen.getByLabelText("CPT for A");
    expect(within(cpt).getByLabelText("A STATE-3 probability")).toHaveDisplayValue("0.33");
  });

  it("reveals destination docks, snaps to one, and connects only through it", () => {
    render(<Harness />);

    const target = screen
      .getByRole("button", { name: "BN node Effect" })
      .closest<HTMLElement>("[data-bn-node-id]");
    expect(target).not.toBeNull();
    const handle = screen.getByRole("button", { name: "Connection handle A right" });
    fireEvent(handle, pointerEvent("pointerdown", {
      button: 0,
      pointerId: 7,
      clientX: 220,
      clientY: 82,
    }));
    expect(document.querySelector(".bneditor__connection-preview")).toBeInTheDocument();
    fireEvent(handle, pointerEvent("pointermove", {
      pointerId: 7,
      clientX: 390,
      clientY: 82,
    }));
    expect(target).toHaveClass("is-connection-candidate");
    expect(target).not.toHaveClass("is-connection-target");
    within(target!).getAllByRole("button", { name: /Connection handle B/ }).forEach((dock) => {
      expect(dock).toHaveClass("is-dock-option");
      expect(dock).not.toHaveClass("is-dock-active");
    });

    fireEvent(handle, pointerEvent("pointermove", {
      pointerId: 7,
      clientX: 300,
      clientY: 82,
    }));
    expect(target).toHaveClass("is-connection-target");
    expect(screen.getByRole("button", { name: "Connection handle B left" })).toHaveClass("is-dock-active");
    expect(document.querySelector(".bneditor__connection-preview")).toHaveClass("is-docked");
    expect(document.querySelector(".bneditor__connection-preview")).toHaveAttribute(
      "d",
      expect.stringMatching(/L 300 82$/),
    );
    fireEvent(handle, pointerEvent("pointerup", {
      button: 0,
      pointerId: 7,
      clientX: 300,
      clientY: 82,
    }));

    expect(screen.getByTestId("bayesian-network-edge")).toBeInTheDocument();
    expect(screen.getByLabelText("CPT for B").querySelectorAll("tbody tr")).toHaveLength(2);
    expect(document.querySelector(".bneditor__connection-preview")).not.toBeInTheDocument();
    expect(screen.queryByText(/Connecting from/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Connect from/ })).not.toBeInTheDocument();
  });

  it("does not connect when released over a node away from its docking points", () => {
    render(<Harness />);

    const handle = screen.getByRole("button", { name: "Connection handle A right" });
    fireEvent(handle, pointerEvent("pointerdown", {
      button: 0,
      pointerId: 8,
      clientX: 220,
      clientY: 82,
    }));
    fireEvent(handle, pointerEvent("pointermove", {
      pointerId: 8,
      clientX: 390,
      clientY: 82,
    }));
    fireEvent(handle, pointerEvent("pointerup", {
      button: 0,
      pointerId: 8,
      clientX: 390,
      clientY: 82,
    }));

    expect(screen.queryByTestId("bayesian-network-edge")).not.toBeInTheDocument();
  });

  it("selects and moves a node with a left-button drag", () => {
    render(<Harness />);

    const node = screen.getByRole("button", { name: "BN node Effect" });
    const shell = node.closest<HTMLElement>("[data-bn-node-id]");
    expect(shell).not.toBeNull();
    fireEvent(node, pointerEvent("pointerdown", {
      button: 0,
      pointerId: 9,
      clientX: 320,
      clientY: 70,
    }));
    expect(screen.getByLabelText("Bayesian-network node inspector")).toHaveTextContent("B");
    fireEvent(node, pointerEvent("pointermove", {
      pointerId: 9,
      clientX: 380,
      clientY: 120,
    }));
    fireEvent(node, pointerEvent("pointerup", {
      button: 0,
      pointerId: 9,
      clientX: 380,
      clientY: 120,
    }));

    expect(shell).toHaveStyle({ left: "360px", top: "90px" });
  });

  it("opens an edge context menu on right click and deletes the connection", async () => {
    const user = userEvent.setup();
    render(<Harness initialModel={connectNodes(testBayesianNetworkModel(), TEST_ID.a, TEST_ID.b)} />);

    expect(screen.getByTestId("bayesian-network-edge")).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByTestId("bayesian-network-edge-hit"), {
      clientX: 280,
      clientY: 140,
    });
    const menu = screen.getByRole("menu", { name: "Actions for connection A to B" });
    expect(menu).toBeInTheDocument();
    await user.click(within(menu).getByRole("menuitem", { name: "Delete connection" }));

    expect(screen.queryByTestId("bayesian-network-edge")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "BN node Effect" }));
    expect(screen.getByLabelText("CPT for B").querySelectorAll("tbody tr")).toHaveLength(1);
  });

  it("keeps zoom controls with the canvas and scales only its contents", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const workspace = screen.getByTestId("bayesian-network-editor").querySelector(".bneditor__workspace");
    const heightBefore = workspace?.getBoundingClientRect().height;
    expect(screen.getByLabelText("Bayesian-network canvas controls")).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("100%");
    await user.click(screen.getByRole("button", { name: "Zoom in" }));

    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("110%");
    expect(workspace?.getBoundingClientRect().height).toBe(heightBefore);
  });

  it("does not automatically enlarge the network beyond its saved zoom", () => {
    jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(900);
    jest.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(500);

    render(<Harness />);

    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("100%");
  });

  it("allows deliberate zooming beyond the automatic fit scale", async () => {
    const user = userEvent.setup();
    jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    jest.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(500);

    render(<Harness />);
    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("52%");
    await user.click(screen.getByRole("button", { name: "Zoom in" }));

    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("62%");
  });

  it("disables zoom in when a viewport constraint prevents the requested increase", async () => {
    const user = userEvent.setup();
    const resizeCallbacks: ResizeObserverCallback[] = [];
    class TestResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: TestResizeObserver,
    });
    jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(640);
    jest.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(500);

    render(<Harness />);
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    await user.click(zoomIn);
    await user.click(zoomIn);
    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("120%");

    act(() => resizeCallbacks.at(-1)?.([], {} as ResizeObserver));

    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("117%");
    expect(zoomIn).toBeDisabled();
    delete (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  });

  it("identifies an invalid row and normalizes it only on request", async () => {
    const user = userEvent.setup();
    const initial = testBayesianNetworkModel();
    initial.conditionalProbabilityTables[0]!.rows[0]!.values.forEach((value) => { value.probability = 0.2; });
    render(<Harness initialModel={initial} />);

    const cpt = screen.getByLabelText("CPT for A");
    expect(within(cpt).queryByText(/Rows are never normalized automatically/)).not.toBeInTheDocument();
    expect(within(cpt).getByRole("columnheader", { name: "Row actions" })).toBeEmptyDOMElement();
    expect(within(cpt).queryByRole("columnheader", { name: "Action" })).not.toBeInTheDocument();
    expect(within(cpt).getByLabelText("A FALSE probability")).toHaveDisplayValue("0.20");
    expect(screen.getByLabelText(`Row total ${TEST_ID.aRow}`)).toHaveTextContent("0.40");
    await user.click(screen.getByRole("button", { name: "Normalize row" }));
    expect(screen.getByLabelText(`Row total ${TEST_ID.aRow}`)).toHaveTextContent("1.00");
  });

  it("keeps incomplete CPT edits local and editable until the whole row is valid", () => {
    const onModelChange = jest.fn();
    const initial = testBayesianNetworkModel();
    initial.conditionalProbabilityTables[0]!.rows[0]!.values[0]!.probability = 0.03;
    initial.conditionalProbabilityTables[0]!.rows[0]!.values[1]!.probability = 0.97;
    render(<Harness initialModel={initial} onModelChange={onModelChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Manual" }));

    const firstProbability = screen.getByLabelText("A FALSE probability");
    const secondProbability = screen.getByLabelText("A TRUE probability");
    const row = firstProbability.closest("tr");
    const runExactInference = screen.getByRole("button", { name: "Run exact inference" });

    expect(firstProbability).toHaveAttribute("type", "text");
    expect(firstProbability).toHaveAttribute("inputmode", "decimal");
    fireEvent.change(firstProbability, { target: { value: "0.0" } });

    expect(firstProbability).toHaveValue("0.0");
    expect(firstProbability).toBeEnabled();
    expect(secondProbability).toBeEnabled();
    expect(row).toHaveClass("is-invalid");
    expect(runExactInference).toBeDisabled();
    expect(onModelChange).not.toHaveBeenCalled();

    fireEvent.change(firstProbability, { target: { value: "0.04" } });
    expect(firstProbability).toHaveValue("0.04");
    expect(onModelChange).not.toHaveBeenCalled();

    fireEvent.change(secondProbability, { target: { value: "0.96" } });

    expect(firstProbability).toHaveValue("0.04");
    expect(secondProbability).toHaveValue("0.96");
    expect(row).not.toHaveClass("is-invalid");
    expect(runExactInference).toBeEnabled();
    expect(onModelChange).toHaveBeenLastCalledWith(expect.objectContaining({
      conditionalProbabilityTables: expect.arrayContaining([
        expect.objectContaining({
          nodeId: TEST_ID.a,
          rows: expect.arrayContaining([
            expect.objectContaining({
              id: TEST_ID.aRow,
              values: [
                expect.objectContaining({ stateId: TEST_ID.aFalse, probability: 0.04 }),
                expect.objectContaining({ stateId: TEST_ID.aTrue, probability: 0.96 }),
              ],
            }),
          ]),
        }),
      ]),
    }));
  });

  it("refuses to normalize negative and above-one CPT drafts", async () => {
    const user = userEvent.setup();
    const onModelChange = jest.fn();
    render(<Harness onModelChange={onModelChange} />);

    const probability = screen.getByLabelText("A FALSE probability");
    const row = probability.closest("tr");
    const normalize = screen.getByRole("button", { name: "Normalize row" });

    fireEvent.change(probability, { target: { value: "-0.20" } });
    await user.click(normalize);

    expect(probability).toHaveValue("-0.20");
    expect(row).toHaveClass("is-invalid");
    expect(onModelChange).not.toHaveBeenCalled();
    expect(screen.getByText("Enter probabilities between 0 and 1 before normalizing this row.")).toBeInTheDocument();

    fireEvent.change(probability, { target: { value: "1.20" } });
    await user.click(normalize);

    expect(probability).toHaveValue("1.20");
    expect(row).toHaveClass("is-invalid");
    expect(onModelChange).not.toHaveBeenCalled();
  });

  it("marks only parent-state CPT columns for left alignment", async () => {
    const user = userEvent.setup();
    render(<Harness initialModel={connectNodes(testBayesianNetworkModel(), TEST_ID.a, TEST_ID.b)} />);

    await user.click(screen.getByRole("button", { name: "BN node Effect" }));
    const cpt = screen.getByLabelText("CPT for B");
    const parentHeader = within(cpt).getByRole("columnheader", { name: "A" });
    const probabilityHeader = within(cpt).getByRole("columnheader", { name: "P(TRUE)" });

    expect(parentHeader).toHaveClass("bneditor__cpt-parent");
    expect(within(cpt).getAllByRole("cell")[0]).toHaveClass("bneditor__cpt-parent");
    expect(probabilityHeader).not.toHaveClass("bneditor__cpt-parent");
  });

  it("applies and clears evidence and displays the exact posterior", async () => {
    const user = userEvent.setup();
    const onRun = jest.fn();
    render(<Harness result={analysisResult} onRun={onRun} />);
    await user.click(screen.getByRole("radio", { name: "Manual" }));

    await user.click(screen.getByRole("button", { name: "Edit evidence" }));
    await user.selectOptions(screen.getByLabelText("Evidence for A"), TEST_ID.aTrue);
    expect(screen.getByRole("button", { name: "BN node Cause" })).toHaveTextContent("Evidence: TRUE");
    await user.selectOptions(screen.getByLabelText("Evidence for A"), "");
    expect(screen.getByRole("button", { name: "BN node Cause" })).not.toHaveTextContent("Evidence:");
    await user.click(screen.getByRole("button", { name: "Run exact inference" }));

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Posterior distribution")).toHaveTextContent("80.00%");
  });

  it("shows every posterior state without repeating the queried node or collapsing details", () => {
    const severeStateId = "10000000-0000-4000-8000-000000000010";
    const initial = testBayesianNetworkModel();
    initial.nodes[0]!.states = [
      ...initial.nodes[0]!.states,
      { id: severeStateId, code: "SEVERE", name: "Severe" },
    ];
    initial.conditionalProbabilityTables[0]!.rows[0]!.values = [
      { stateId: TEST_ID.aFalse, probability: 0.6 },
      { stateId: TEST_ID.aTrue, probability: 0.3 },
      { stateId: severeStateId, probability: 0.1 },
    ];
    const threeStateResult: BayesianNetworkAnalysisResult = {
      ...analysisResult,
      marginals: [{
        nodeId: TEST_ID.a,
        values: [
          { stateId: TEST_ID.aFalse, probability: 0.6 },
          { stateId: TEST_ID.aTrue, probability: 0.3 },
          { stateId: severeStateId, probability: 0.1 },
        ],
      }],
    };

    render(<Harness initialModel={initial} result={threeStateResult} />);
    fireEvent.click(screen.getByRole("radio", { name: "Manual" }));

    const posterior = screen.getByLabelText("Posterior distribution");
    expect(within(posterior).getAllByRole("status")).toHaveLength(3);
    expect(within(posterior).getByText("SEVERE")).toBeInTheDocument();
    expect(within(posterior).getByText("10.00%")).toBeInTheDocument();
    expect(within(posterior).queryByText("A", { selector: "strong" })).not.toBeInTheDocument();
    expect(within(posterior).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/more details/i)).not.toBeInTheDocument();
  });

  it("creates a typed HCL binding and rejects selecting every BN state", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("radio", { name: "Probability" }));
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    expect(screen.getByRole("button", { name: "Add binding" })).toHaveClass(
      "posnav__btn",
      "posnav__btn--sm",
      "posnav__btn--primary",
      "hcleditor__add-binding",
    );
    await user.click(screen.getByRole("button", { name: "Advanced" }));
    expect(screen.getByRole("button", { name: "Delete configuration" })).toHaveClass("hcleditor__aligned-action");
    expect(screen.getByRole("button", { name: "Run probability" })).toHaveClass(
      "posnav__btn",
      "posnav__btn--sm",
      "posnav__btn--primary",
    );
    await user.click(screen.getByText("Bindings", { selector: "summary" }));
    await user.click(screen.getByRole("checkbox", { name: "FALSE" }));
    await user.click(screen.getByRole("checkbox", { name: "TRUE" }));
    await user.click(screen.getByRole("button", { name: "Add binding" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/cannot contain every state/i);

    await user.click(screen.getByRole("checkbox", { name: "FALSE" }));
    await user.click(screen.getByRole("button", { name: "Add binding" }));
    expect(screen.getByLabelText("HCL bindings")).toHaveTextContent("FT-A / BE-PUMP");
    expect(screen.getByLabelText("HCL bindings")).toHaveTextContent("A = TRUE");
  });

  it("persists evidence into HCL and runs an explicitly included fault tree", async () => {
    const user = userEvent.setup();
    const onConfigurationsChange = jest.fn();
    const onRunHclFaultTree = jest.fn();
    render(
      <Harness
        onConfigurationsChange={onConfigurationsChange}
        onRunHclFaultTree={onRunHclFaultTree}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Manual" }));
    await user.click(screen.getByRole("button", { name: "Edit evidence" }));
    await user.selectOptions(screen.getByLabelText("Evidence for A"), TEST_ID.aTrue);
    await user.click(screen.getByRole("radio", { name: "Probability" }));
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    expect(onConfigurationsChange.mock.calls.at(-1)?.[0]?.[0]?.baseEvidence).toEqual({
      observations: [{ nodeId: TEST_ID.a, stateId: TEST_ID.aTrue }],
    });

    await user.click(screen.getByText("Fault trees", { selector: "summary" }));
    await user.click(screen.getByRole("button", { name: "Include" }));
    expect(screen.getByLabelText("Included HCL fault trees")).toHaveTextContent("FT-A");
    await user.click(screen.getByRole("button", { name: "Run probability" }));
    expect(onRunHclFaultTree).toHaveBeenCalledWith(expect.any(Object), faultTreeOptions[0]);
  });

  it("keeps ESQ event-tree orchestration read-only and exposes its automatically linked fault trees", async () => {
    const user = userEvent.setup();
    const onRunEventTree = jest.fn();
    render(
      <HclBindingEditor
        model={testBayesianNetworkModel()}
        editable={false}
        workbookId={FT_WORKBOOK_ID}
        configurations={[syOwnedConfiguration]}
        scope="EVENT_TREE"
        faultTreeOptions={faultTreeOptions}
        eventTreeOptions={[linkedEventTree]}
        baseEvidence={syOwnedConfiguration.baseEvidence}
        validation={[]}
        running={false}
        runError={null}
        runResult={null}
        batchRunResult={null}
        onChange={jest.fn()}
        onRunFaultTree={jest.fn()}
        onRunEventTree={onRunEventTree}
        onRunFaultTreeBatch={jest.fn()}
        onRunEventTreeBatch={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText("HCL target type")).not.toBeInTheDocument();
    expect(screen.getByLabelText("HCL event-tree target")).toHaveValue(`${linkedEventTree.workbookId}:${linkedEventTree.modelId}`);
    expect(screen.getByLabelText("HCL event-tree target")).toHaveDisplayValue("ET-LOSS-COOLING");
    const linkedTreeDisclosure = screen.getByText("Linked fault trees", { selector: "summary" }).closest("details");
    expect(linkedTreeDisclosure).not.toHaveAttribute("open");
    await user.click(screen.getByText("Linked fault trees", { selector: "summary" }));
    const linkedTrees = screen.getByLabelText("Automatically linked fault trees");
    expect(linkedTrees).toHaveClass("hcleditor__trees");
    expect(linkedTreeDisclosure).toHaveClass("hcleditor__linked-tree-directory");
    expect(linkedTrees).toHaveTextContent("FT-A");
    expect(linkedTrees).not.toHaveTextContent("FE-PUMP");
    expect(within(linkedTrees).getByRole("listitem", { name: /FT-A/ })).toHaveAttribute("title", expect.stringContaining("FE-PUMP"));
    expect(screen.queryByRole("button", { name: "Configuration" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("HCL fault-tree target")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run probability" }));
    expect(onRunEventTree).toHaveBeenCalledWith(syOwnedConfiguration, linkedEventTree);
  });

  it("presents the selected event-tree HCL result without competing calculations", () => {
    render(
      <HclBindingEditor
        model={testBayesianNetworkModel()}
        editable={false}
        workbookId={FT_WORKBOOK_ID}
        configurations={[syOwnedConfiguration]}
        scope="EVENT_TREE"
        faultTreeOptions={faultTreeOptions}
        eventTreeOptions={[linkedEventTree]}
        baseEvidence={syOwnedConfiguration.baseEvidence}
        validation={[]}
        running={false}
        runError={null}
        runResult={eventHclResult}
        batchRunResult={null}
        onChange={jest.fn()}
        onRunFaultTree={jest.fn()}
        onRunEventTree={jest.fn()}
        onRunFaultTreeBatch={jest.fn()}
        onRunEventTreeBatch={jest.fn()}
        calculationType="CUT_SETS"
      />,
    );

    const result = screen.getByLabelText("HCL event-tree result");
    expect(result).toHaveClass("hcleditor__batch-result");
    expect(result).toHaveTextContent("Sequence results");
    expect(result).not.toHaveTextContent("2.50E-04/yr");
    expect(result).toHaveTextContent("Sequence cut sets");
    expect(screen.queryByRole("button", { name: "View sequence results" })).not.toBeInTheDocument();
  });

  it("blocks HCL quantification while a CPT edit is invalid", () => {
    render(
      <HclBindingEditor
        model={testBayesianNetworkModel()}
        editable={false}
        workbookId={FT_WORKBOOK_ID}
        configurations={[syOwnedConfiguration]}
        faultTreeOptions={faultTreeOptions}
        eventTreeOptions={[]}
        baseEvidence={syOwnedConfiguration.baseEvidence}
        validation={[]}
        quantificationBlocked
        running={false}
        runError={null}
        runResult={null}
        batchRunResult={null}
        onChange={jest.fn()}
        onRunFaultTree={jest.fn()}
        onRunEventTree={jest.fn()}
        onRunFaultTreeBatch={jest.fn()}
        onRunEventTreeBatch={jest.fn()}
      />,
    );

    expect(screen.queryByText(/Needs attention/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run probability" })).toBeDisabled();
  });

  it("uses the compact Systems Analysis HCL composer without configuration details or a target-kind selector", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("radio", { name: "Probability" }));
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));

    const composer = screen.getByLabelText("HCL quantification controls");
    expect(within(composer).getByLabelText("HCL fault-tree target")).toBeInTheDocument();
    expect(composer).not.toHaveTextContent("Common evidence");
    expect(within(composer).getByRole("button", { name: "Edit evidence" })).toBeInTheDocument();
    expect(within(composer).getByRole("button", { name: "Configuration" })).toBeInTheDocument();
    expect(within(composer).getByRole("button", { name: "Advanced" })).toBeInTheDocument();
    expect(within(composer).getByRole("button", { name: "Edit evidence" }).closest(".hcleditor__setup-row")).not.toBeNull();
    expect(within(composer).getByLabelText("HCL fault-tree target").closest(".hcleditor__execution-row")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Close HCL manager" })).toBeInTheDocument();
    expect(within(composer).getByRole("button", { name: "Run probability" })).toBeInTheDocument();
    expect(within(composer).queryByLabelText("HCL target type")).not.toBeInTheDocument();
    expect(screen.queryByText("HCL-1")).not.toBeInTheDocument();
    expect(screen.queryByText(/Ready.*FTs.*bindings.*scenarios/)).not.toBeInTheDocument();
    await user.click(within(composer).getByRole("button", { name: "Edit evidence" }));
    expect(screen.getByLabelText("Evidence editor").closest(".hcleditor__evidence-anchor")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Close" }));

    await user.click(screen.getByRole("button", { name: "Close HCL manager" }));
    expect(screen.queryByLabelText("HCL configuration manager")).not.toBeInTheDocument();
    expect(within(composer).getByRole("button", { name: "Configuration" })).toBeInTheDocument();

    await user.click(within(composer).getByRole("button", { name: "Configuration" }));
    expect(screen.getByLabelText("HCL configuration manager")).toBeInTheDocument();
    expect(screen.getByText("Fault trees", { selector: "summary" })).toBeInTheDocument();
    expect(screen.getByText("Bindings", { selector: "summary" })).toBeInTheDocument();
    expect(screen.queryByText("Evidence scenarios", { selector: "summary" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("HCL uncertainty settings")).not.toBeInTheDocument();
    expect(screen.queryByText("Advanced", { selector: "summary" })).not.toBeInTheDocument();
    expect(within(composer).getByRole("button", { name: "Configuration" })).toBeInTheDocument();
  });

  it("configures PRAXIS uncertainty sampling and BN CPT-row distributions", async () => {
    const user = userEvent.setup();
    const onConfigurationsChange = jest.fn();
    render(<Harness onConfigurationsChange={onConfigurationsChange} />);

    await user.click(screen.getByRole("radio", { name: "Probability" }));
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    await user.click(screen.getByText("Fault trees", { selector: "summary" }));
    await user.click(screen.getByRole("button", { name: "Include" }));
    await user.click(screen.getByRole("radio", { name: "Uncertainty" }));
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    await user.click(screen.getByRole("button", { name: "Configuration" }));
    await user.click(screen.getByRole("button", { name: "Enable uncertainty" }));

    expect(screen.getByRole("spinbutton", { name: "Samples" })).toHaveValue(1000);
    expect(screen.getByRole("spinbutton", { name: "Seed" })).toHaveValue(42);
    const basicEvents = screen.getByText("Basic events").closest("section");
    expect(basicEvents).not.toBeNull();
    await user.click(within(basicEvents!).getByRole("button", { name: "Add" }));
    const basicEventCollection = within(basicEvents!).getByText("Configured basic events").closest("details");
    expect(basicEventCollection).not.toHaveAttribute("open");
    await user.click(within(basicEvents!).getByText("Configured basic events"));
    await user.click(within(basicEvents!).getByText("Settings"));
    await user.selectOptions(
      within(basicEvents!).getByRole("combobox", { name: /Distribution for/ }),
      "LOGNORMAL",
    );
    expect(within(basicEvents!).getByRole("spinbutton", { name: "Median" })).toBeInTheDocument();
    expect(within(basicEvents!).getByRole("spinbutton", { name: "Error factor" })).toBeInTheDocument();
    const bnParameters = screen.getByText("BN parameters").closest("section");
    expect(bnParameters).not.toBeNull();
    await user.click(within(bnParameters!).getByRole("button", { name: "Add" }));
    expect(within(bnParameters!).getByText("Configured CPT rows").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByLabelText("HCL uncertainty settings")).toHaveTextContent("Dirichlet");
    expect(onConfigurationsChange.mock.calls.at(-1)?.[0]?.[0]?.solverSettings.uncertainty.cptRowDistributions).toHaveLength(1);
  });

  it("keeps the BN canvas visible when ESQ exposes only event-tree HCL analysis", () => {
    render(<Harness editable={false} showQueryAnalysis={false} />);

    expect(screen.getByLabelText("Bayesian-network graph")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Probability" })).toBeChecked();
    expect(screen.queryByRole("radio", { name: "BN query" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run exact inference" })).not.toBeInTheDocument();
  });

  it("builds and runs an enabled evidence-scenario batch", async () => {
    const user = userEvent.setup();
    const onRunHclFaultTreeBatch = jest.fn();
    render(<Harness onRunHclFaultTreeBatch={onRunHclFaultTreeBatch} />);

    await user.click(screen.getByRole("radio", { name: "Probability" }));
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    await user.click(screen.getByText("Bindings", { selector: "summary" }));
    await user.click(screen.getByRole("checkbox", { name: "TRUE" }));
    await user.click(screen.getByRole("button", { name: "Add binding" }));
    await user.click(screen.getByText("Fault trees", { selector: "summary" }));
    await user.click(screen.getByRole("button", { name: "Include" }));
    await user.click(screen.getByRole("radio", { name: "Batch" }));
    const batchComposer = screen.getByLabelText("HCL quantification controls");
    expect(within(batchComposer).getByLabelText("HCL batch type").closest(".hcleditor__setup-row")).not.toBeNull();
    expect(within(batchComposer).getByRole("button", { name: "Upload JSON/CSV" })).toBeInTheDocument();
    const sampleDownload = within(batchComposer).getByRole("button", { name: "Download samples" });
    expect(sampleDownload).toContainHTML("<svg");
    expect(within(batchComposer).getByLabelText("HCL fault-tree target").closest(".hcleditor__execution-row")).not.toBeNull();
    expect(within(batchComposer).getByRole("button", { name: "Run probability batch" }).closest(".hcleditor__execution-row")).not.toBeNull();
    await user.click(sampleDownload);
    expect(screen.getByRole("menu", { name: "HCL batch samples" })).toHaveTextContent("Sample JSONSample CSV");
    await user.click(screen.getByText("Batch type"));
    expect(sampleDownload.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Evidence scenarios", { selector: "summary" }).closest("details")).toHaveAttribute("open");
    await user.click(screen.getByRole("button", { name: "Add scenario" }));
    await user.selectOptions(screen.getByLabelText("A evidence for SCN-1"), TEST_ID.aTrue);
    await user.click(screen.getByRole("button", { name: "Add scenario" }));
    await user.selectOptions(screen.getByLabelText("A evidence for SCN-2"), TEST_ID.aTrue);
    expect(screen.getByLabelText("Evidence scenario list")).toHaveTextContent("SCN-1");
    expect(screen.getByLabelText("Evidence scenario list")).toHaveTextContent("SCN-2");
    expect(screen.queryByRole("button", { name: "Import JSON/CSV" })).not.toBeInTheDocument();
    const exportButton = screen.getByRole("button", { name: "Export" });
    expect(exportButton).toContainHTML("<svg");
    await user.click(exportButton);
    expect(screen.getByRole("menu", { name: "Evidence scenario export formats" })).toHaveTextContent("JSONCSV");
    await user.click(screen.getByText("Scenarios", { selector: "strong" }));
    expect(exportButton.closest("details")).not.toHaveAttribute("open");

    expect(screen.getByLabelText("HCL batch type")).toHaveDisplayValue("Evidence scenarios");
    expect(screen.queryByRole("region", { name: "Hazard convolution settings" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("HCL batch target scope")).not.toBeInTheDocument();
    expect(screen.getByLabelText("HCL fault-tree target")).toHaveTextContent("No affected fault tree");
    expect(screen.getByRole("button", { name: "Run probability batch" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /SCN-2 Evidence scenario 2/i }));
    await user.selectOptions(screen.getByLabelText("A evidence for SCN-2"), TEST_ID.aFalse);
    expect(screen.getByLabelText("HCL fault-tree target")).toHaveTextContent("FT-A");
    await user.click(screen.getByRole("button", { name: "Run probability batch" }));

    expect(onRunHclFaultTreeBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceScenarios: expect.arrayContaining([
          expect.objectContaining({ code: "SCN-1" }),
          expect.objectContaining({ code: "SCN-2" }),
        ]),
      }),
      faultTreeOptions[0],
      [expect.any(String), expect.any(String)],
      false,
    );

    onRunHclFaultTreeBatch.mockClear();
    await user.selectOptions(screen.getByLabelText("HCL batch type"), "HAZARD_GRID");
    const hazardSettings = screen.getByRole("region", { name: "Hazard convolution settings" });
    await user.click(within(hazardSettings).getByRole("button", { name: "Enable" }));
    await user.click(screen.getByRole("button", { name: "Run probability batch" }));
    expect(onRunHclFaultTreeBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        hazardGrid: expect.objectContaining({
          hazardNodeIds: [TEST_ID.a],
          normalizeWeights: false,
        }),
      }),
      faultTreeOptions[0],
      [expect.any(String), expect.any(String)],
      true,
    );
  });

  it("shows the missing hazard-grid setup beside the enable control", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("radio", { name: "Probability" }));
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    await user.click(screen.getByRole("radio", { name: "Batch" }));
    expect(screen.queryByRole("region", { name: "Hazard convolution settings" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("HCL batch type"), "HAZARD_GRID");
    await user.click(screen.getByRole("button", { name: "Add scenario" }));

    const hazardSettings = screen.getByRole("region", { name: "Hazard convolution settings" });
    expect(within(hazardSettings).getByRole("status")).toHaveTextContent(
      /Choose BN states for every enabled scenario so each scenario has a complete, unique combination/i,
    );
    expect(within(hazardSettings).getByRole("button", { name: "Enable" })).toBeDisabled();
    expect(within(hazardSettings).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(hazardSettings).queryByText("Annual scale")).not.toBeInTheDocument();
  });

  it("preserves scenario edits by disabling an invalidated hazard grid", async () => {
    const user = userEvent.setup();
    const onConfigurationsChange = jest.fn();
    render(<Harness onConfigurationsChange={onConfigurationsChange} />);

    await user.click(screen.getByRole("radio", { name: "Probability" }));
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    await user.click(screen.getByRole("radio", { name: "Batch" }));
    await user.selectOptions(screen.getByLabelText("HCL batch type"), "HAZARD_GRID");
    await user.click(screen.getByRole("button", { name: "Add scenario" }));
    await user.selectOptions(screen.getByLabelText("A evidence for SCN-1"), TEST_ID.aTrue);

    const hazardSettings = screen.getByRole("region", { name: "Hazard convolution settings" });
    await user.click(within(hazardSettings).getByRole("button", { name: "Enable" }));
    expect(within(hazardSettings).getByLabelText("Hours/year")).toHaveValue(8_760);

    await user.selectOptions(screen.getByLabelText("A evidence for SCN-1"), "");

    const updatedConfiguration = onConfigurationsChange.mock.calls.at(-1)?.[0]?.[0];
    expect(updatedConfiguration?.hazardGrid).toBeUndefined();
    expect(updatedConfiguration?.evidenceScenarios?.[0]?.evidence.observations).toEqual([]);
    expect(screen.getByText(/Scenario updated\. Hazard convolution was turned off/i)).toBeInTheDocument();
  });

  it("selects every dimension needed to make hazard-grid cells unique", async () => {
    const user = userEvent.setup();
    const onConfigurationsChange = jest.fn();
    render(<Harness onConfigurationsChange={onConfigurationsChange} />);

    await user.click(screen.getByRole("radio", { name: "Probability" }));
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    await user.click(screen.getByRole("radio", { name: "Batch" }));
    await user.selectOptions(screen.getByLabelText("HCL batch type"), "HAZARD_GRID");
    const combinations = [
      [TEST_ID.aFalse, TEST_ID.bFalse],
      [TEST_ID.aFalse, TEST_ID.bTrue],
      [TEST_ID.aTrue, TEST_ID.bFalse],
      [TEST_ID.aTrue, TEST_ID.bTrue],
    ] as const;
    for (const [index, [aStateId, bStateId]] of combinations.entries()) {
      await user.click(screen.getByRole("button", { name: "Add scenario" }));
      const scenarioNumber = index + 1;
      await user.selectOptions(screen.getByLabelText(`A evidence for SCN-${String(scenarioNumber)}`), aStateId);
      await user.selectOptions(screen.getByLabelText(`B evidence for SCN-${String(scenarioNumber)}`), bStateId);
    }

    const hazardSettings = screen.getByRole("region", { name: "Hazard convolution settings" });
    expect(within(hazardSettings).getByRole("button", { name: "Enable" })).toBeEnabled();
    await user.click(within(hazardSettings).getByRole("button", { name: "Enable" }));

    expect(within(hazardSettings).getByRole("checkbox", { name: "A" })).toBeChecked();
    expect(within(hazardSettings).getByRole("checkbox", { name: "B" })).toBeChecked();
    expect(onConfigurationsChange.mock.calls.at(-1)?.[0]?.[0]?.hazardGrid?.hazardNodeIds).toEqual([
      TEST_ID.a,
      TEST_ID.b,
    ]);
  });

  it("labels completed batches whose numerical result does not vary", async () => {
    const user = userEvent.setup();
    render(<Harness hclRunResult={commonHclResult} hclBatchRunResult={unchangedBatchResult} />);

    await user.click(screen.getByRole("radio", { name: "Probability" }));
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));

    const commonResult = screen.getByLabelText("HCL fault-tree result");
    expect(commonResult).toHaveTextContent("Top event probability");
    expect(commonResult).toHaveTextContent("2.50E-01");
    expect(commonResult.querySelectorAll(".hcleditor__result-metric")).toHaveLength(1);
    await user.click(screen.getByRole("radio", { name: "Batch" }));
    const scenarioResult = screen.getByLabelText("HCL scenario batch result");
    expect(scenarioResult).toHaveTextContent("No variation across scenarios");
    expect(scenarioResult.querySelectorAll(".hcleditor__batch-table .hcleditor__result-metric"))
      .toHaveLength(2);

    await user.click(screen.getByRole("radio", { name: "Cut sets" }));
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    const commonResultAfterModeChange = screen.getByLabelText("HCL fault-tree result");
    expect(commonResultAfterModeChange).not.toHaveTextContent("Top event probability");
    expect(commonResultAfterModeChange).toHaveTextContent("HCL-aware cut sets");
    await user.click(within(commonResultAfterModeChange).getByText("HCL-aware cut sets"));
    const cutSetSummary = within(commonResultAfterModeChange).getByText("Cut set 1").closest("summary");
    expect(cutSetSummary).toHaveClass("bneditor__posterior-state", "hcleditor__cut-set-metric");
    expect(cutSetSummary?.querySelector("code")).toBeNull();
    expect(commonResultAfterModeChange).toHaveTextContent("BE-PUMP");
    expect(commonResultAfterModeChange).toHaveTextContent("BE-PUMP → A = TRUE");
    expect(commonResultAfterModeChange).toHaveTextContent("100.00% coverage");

  });

  it("separates uncertainty statistics for manual and scenario results", async () => {
    const user = userEvent.setup();
    const uncertainty = {
      sampleCount: 1_000,
      seed: 42,
      mean: 0.25,
      standardDeviation: 0.01,
      coefficientOfVariation: 0.04,
      minimum: 0.2,
      percentile05: 0.23,
      median: 0.25,
      percentile95: 0.27,
      maximum: 0.3,
    };
    if (commonHclResult.kind !== "FAULT_TREE") throw new Error("Expected a fault-tree result");
    const manualResult: HclEditorRunResult = {
      kind: "FAULT_TREE",
      result: { ...commonHclResult.result, uncertainty },
    };
    const batchResult: HclEditorBatchRunResult = {
      ...unchangedBatchResult,
      scenarios: unchangedBatchResult.scenarios.map((scenario) => ({
        ...scenario,
        result: scenario.result?.kind === "FAULT_TREE"
          ? { ...scenario.result, result: { ...scenario.result.result, uncertainty } }
          : scenario.result,
      })),
    };
    render(<Harness hclRunResult={manualResult} hclBatchRunResult={batchResult} />);

    await user.click(screen.getByRole("radio", { name: "Uncertainty" }));
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));

    const manualUncertainty = screen.getByLabelText("Uncertainty results");
    expect(manualUncertainty.querySelectorAll(".hcleditor__uncertainty-metric")).toHaveLength(5);
    expect(within(manualUncertainty).getByText("Standard deviation")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Batch" }));
    const scenarioOneDisclosure = screen.getByText("SCN-1").closest("details");
    const scenarioTwoDisclosure = screen.getByText("SCN-2").closest("details");
    expect(scenarioOneDisclosure).not.toHaveAttribute("open");
    expect(scenarioTwoDisclosure).not.toHaveAttribute("open");
    expect(scenarioOneDisclosure).toHaveTextContent("Mean 2.50E-01");
    await user.click(screen.getByText("SCN-1"));
    await user.click(screen.getByText("SCN-2"));
    const [scenarioOne, scenarioTwo] = screen.getAllByLabelText("Statistics uncertainty results");
    expect(scenarioOne).toHaveClass("hcleditor__uncertainty-result--inline");
    expect(scenarioOne!.querySelectorAll(".hcleditor__uncertainty-metric")).toHaveLength(5);
    expect(scenarioTwo!.querySelectorAll(".hcleditor__uncertainty-metric")).toHaveLength(5);
  });

  it("groups batch cut sets and importance measures under identified scenarios", async () => {
    const user = userEvent.setup();
    const importanceResult = hclResultWithImportance(2);
    if (importanceResult.kind !== "FAULT_TREE") throw new Error("Expected a fault-tree result");
    const batchResult: HclEditorBatchRunResult = {
      ...unchangedBatchResult,
      scenarios: unchangedBatchResult.scenarios.map((scenario) => ({
        ...scenario,
        result: scenario.result?.kind === "FAULT_TREE"
          ? {
              ...scenario.result,
              result: {
                ...scenario.result.result,
                importance: importanceResult.result.importance,
              },
            }
          : scenario.result,
      })),
    };
    render(<Harness hclBatchRunResult={batchResult} />);

    await user.click(screen.getByRole("radio", { name: "Cut sets" }));
    await user.click(screen.getByRole("radio", { name: "Batch" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    let scenarioOne = screen.getByText("SCN-1").closest("details");
    expect(scenarioOne).not.toHaveAttribute("open");
    expect(scenarioOne).toHaveTextContent("1 cut set");
    expect(scenarioOne).not.toHaveTextContent("Scenario cut sets");
    await user.click(screen.getByText("SCN-1"));
    expect(within(scenarioOne!).getByLabelText("Cut sets results")).toHaveTextContent("Cut set 1");

    await user.click(screen.getByRole("radio", { name: "Importance" }));
    await user.click(screen.getByRole("radio", { name: "Batch" }));
    scenarioOne = screen.getByText("SCN-1").closest("details");
    expect(scenarioOne).not.toHaveAttribute("open");
    expect(scenarioOne).toHaveTextContent("2 measures");
    await user.click(screen.getByText("SCN-1"));
    expect(within(scenarioOne!).getByLabelText("Importance measures results")).toHaveTextContent("Event probability");
  });

  it("shows at most ten HCL cut sets per page and retains a complete CSV export", async () => {
    const user = userEvent.setup();
    render(<Harness hclRunResult={hclResultWithCutSets(12)} />);

    await user.click(screen.getByRole("radio", { name: "Cut sets" }));
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    const result = screen.getByLabelText("HCL fault-tree result");
    await user.click(within(result).getByText("HCL-aware cut sets"));

    expect(result).toHaveTextContent("Showing 1–10 of 12");
    expect(within(result).getByText("Cut set 10")).toBeInTheDocument();
    expect(within(result).queryByText("Cut set 11")).not.toBeInTheDocument();
    expect(within(result).getByRole("button", { name: "Export CSV" })).toBeEnabled();

    const pagination = within(result).getByRole("navigation", { name: "HCL-aware cut sets pagination" });
    await user.click(within(pagination).getByRole("button", { name: "Next" }));

    expect(result).toHaveTextContent("Showing 11–12 of 12");
    expect(within(result).queryByText("Cut set 10")).not.toBeInTheDocument();
    expect(within(result).getByText("Cut set 11")).toBeInTheDocument();
    expect(within(pagination).getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("serializes cut-set calculations and causal traces as portable CSV", () => {
    const csv = serializeHclCutSetsCsv([{
      rank: 1,
      order: 2,
      probability: 0.0025,
      coverage: 0.75,
      expression: "BE-A ∩ BE-B",
      conditions: ["BE-A → HAZARD = HIGH"],
      rootCauses: ["HAZARD"],
      ancestors: ["WEATHER", "HAZARD"],
    }]);

    expect(csv).toContain("rank,order,probability,coverage_fraction,cut_set,bn_conditions,bn_root_causes,bn_ancestors");
    expect(csv).toContain('1,2,0.0025,0.75,"BE-A ∩ BE-B","BE-A → HAZARD = HIGH","HAZARD","WEATHER | HAZARD"');
  });

  it("paginates PRAXIS importance measures ten at a time", async () => {
    const user = userEvent.setup();
    render(<Harness hclRunResult={hclResultWithImportance(12)} />);

    await user.click(screen.getByRole("radio", { name: "Importance" }));
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    const result = screen.getByLabelText("HCL fault-tree result");
    await user.click(within(result).getByText("Importance measures"));

    expect(result).toHaveTextContent("Showing 1–10 of 12");
    expect(result.querySelectorAll(".hcleditor__importance-row")).toHaveLength(10);
    const pagination = within(result).getByRole("navigation", { name: "Importance measures pagination" });
    await user.click(within(pagination).getByRole("button", { name: "Next" }));
    expect(result).toHaveTextContent("Showing 11–12 of 12");
    expect(result.querySelectorAll(".hcleditor__importance-row")).toHaveLength(2);
  });

  it("serializes every PRAXIS importance input and measure as CSV", () => {
    const csv = serializeHclImportanceCsv([{
      rank: 1,
      basicEvent: "BE-A",
      bayesianNetworkNode: "HAZARD",
      eventProbability: 0.1,
      probabilityIfTrue: 0.15,
      probabilityIfFalse: 0,
      birnbaum: 0.15,
      criticality: 1,
      fussellVesely: 1,
      riskAchievementWorth: 10,
      riskReductionWorth: null,
    }]);

    expect(csv).toContain("P(target | event true)");
    expect(csv).toContain("1,BE-A,HAZARD,0.1,0.15,0,0.15,1,1,10,");
  });

  it("presents hazard convolution as summary and weighted contribution metrics", async () => {
    const user = userEvent.setup();
    render(<Harness hclBatchRunResult={hazardBatchResult} />);

    await user.click(screen.getByRole("radio", { name: "Probability" }));
    await user.click(screen.getByRole("radio", { name: "Batch" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));

    const result = screen.getByLabelText("HCL scenario batch result");
    expect(within(result).getByLabelText("Hazard convolution summary")).toHaveTextContent("99.44%");
    expect(result).toHaveTextContent("1.89E-01/yr");
    expect(result).toHaveTextContent("75.42% weight");
    expect(result).not.toHaveTextContent("w=");
  });

  it("keeps mutation controls unavailable in read-only mode", () => {
    render(<Harness editable={false} />);

    expect(screen.getByTestId("bayesian-network-editor")).toHaveClass("bneditor--readonly");
    expect(screen.getByLabelText("Bayesian-network code")).toHaveTextContent("BN-TEST");
    expect(screen.getByLabelText("Bayesian-network name")).toHaveTextContent("Test network");
    expect(screen.getByRole("button", { name: "Add node" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reusable modules" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Add state" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create HCL configuration" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "BN node Effect" }));
    expect(screen.getByLabelText("Bayesian-network node inspector")).toHaveTextContent("B");
    expect(screen.getAllByLabelText(/State code/)[0]).toHaveAttribute("readonly");
  });
});
