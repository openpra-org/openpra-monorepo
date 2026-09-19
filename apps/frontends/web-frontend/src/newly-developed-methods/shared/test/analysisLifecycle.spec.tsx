import { act, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import type { BayesianNetworkEditorProps } from "../../bayesian-network/bayesianNetworkTypes";
import { deleteNode } from "../../bayesian-network/bayesianNetworkOperations";
import { testBayesianNetworkModel, TEST_ID } from "../../bayesian-network/test/bayesianNetworkTestModel";
import { SyBayesianNetworkWorkspace } from "../../../sy-workbooks/syBayesianNetworkWorkspace";
import { EsqEventTreeHclWorkspace } from "../../../esq-workbooks/esqEventTreeHclWorkspace";
import { ToastProvider } from "../../../toast/toastProvider";
import type { RevisionedSaveStatus } from "../../../workbooks/useRevisionedMefPatch";

let mockEditor: BayesianNetworkEditorProps;
let mockSyContext: unknown;
let mockEsqContext: unknown;
const mockExecute = jest.fn();
const mockResult = jest.fn();
jest.mock("../../../sy-workbooks/syWorkbookContext", () => ({ useSyWorkbook: () => mockSyContext }));
jest.mock("../../../esq-workbooks/esqWorkbookContext", () => ({ useEsqWorkbook: () => mockEsqContext }));
jest.mock("../../bayesian-network", () => ({
  ...jest.requireActual("../../bayesian-network"),
  BayesianNetworkEditor: (props: BayesianNetworkEditorProps) => {
    mockEditor = props;
    return <>
      <output data-testid="result">{JSON.stringify([props.analysisResult, props.queryBatchResult ?? null, props.hclRunResult, props.hclBatchRunResult])}</output>
      <output data-testid="error">{props.runError ?? props.hclRunError}</output>
      <output data-testid="blocked">{props.saveBlockedReason}</output>
    </>;
  },
}));
jest.mock("../../../sy-workbooks/syWorkbookApi", () => ({
  runSyBayesianNetwork: (...args: unknown[]) => mockExecute(...args),
  runSyBayesianNetworkBatch: (...args: unknown[]) => mockExecute(...args),
  runSyHclFaultTree: (...args: unknown[]) => mockExecute(...args),
  runSyHclFaultTreeBatch: (...args: unknown[]) => mockExecute(...args),
  generateSyHclScenarios: (...args: unknown[]) => mockExecute(...args),
  getSyBayesianNetworkResult: () => mockResult(),
  getSyBayesianNetworkBatchResult: () => mockResult(),
  getSyHclFaultTreeResult: () => mockResult(),
  getSyWorkbook: async () => ({ mef: { dependencyBayesianNetworks: [], dependencyHclConfigurations: [],
    systemLogicModels: [{ uuid: "ft", code: "FT", name: "Fault tree", topGate: { gateId: "top" }, leafNodes: [] }], systemBasicEvents: [] } }),
}));
jest.mock("../../../esq-workbooks/esqWorkbookApi", () => ({
  runEsqHclEventTree: (...args: unknown[]) => mockExecute(...args),
  runEsqHclEventTreeBatch: (...args: unknown[]) => mockExecute(...args),
  generateEsqHclScenarios: (...args: unknown[]) => mockExecute(...args),
  getEsqHclEventTreeResult: () => mockResult(),
}));
jest.mock("../../../workbooks/workbookApi", () => ({
  listWorkbooks: async (_project: string, kind: string) => ({ workbooks: [{ id: kind.toLowerCase(), name: kind }] }),
}));
jest.mock("../../../es-workbooks/esWorkbookApi", () => ({
  getEsWorkbook: async () => ({ mef: { eventTrees: [{ uuid: "et", name: "ET", sequences: {}, functionalEvents: {
    f: { uuid: "f", name: "Function", faultTreeTopEvent: { workbookId: "sy", modelId: "ft", entityId: "top" } },
  } }] } }),
}));

const original = testBayesianNetworkModel();
function configuration(host: string): WorkbookHclConfiguration {
  return {
    modelId: "hcl", code: "HCL", name: "HCL", description: "",
    bayesianNetwork: { workbookId: host, modelId: TEST_ID.model }, faultTrees: [{ workbookId: "sy", modelId: "ft" }],
    bindings: [], baseEvidence: { observations: [{ nodeId: TEST_ID.a, stateId: TEST_ID.aTrue }] },
    evidenceScenarios: [{ id: "scenario", code: "S1", name: "Earthquake", enabled: true,
      evidence: { observations: [{ nodeId: TEST_ID.a, stateId: TEST_ID.aFalse }] } }],
    solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
  };
}
function Harness({ host = "SY", saveStatus = "saved", revision = 1 }: {
  host?: "SY" | "ESQ"; saveStatus?: RevisionedSaveStatus; revision?: number;
}) {
  const [sy, setSy] = useState(() => ({ dependencyBayesianNetworks: [structuredClone(original)],
    dependencyHclConfigurations: [configuration("sy")], systemLogicModels: [], systemBasicEvents: [] }) as unknown as SystemsAnalysis);
  const [esq, setEsq] = useState(() => ({ bayesianNetworks: [structuredClone(original)],
    hclConfigurations: [configuration("esq")] }) as unknown as EventSequenceQuantification);
  mockSyContext = { sy, editable: true, mutateSy: setSy, runtime: { workbookId: "sy", revision, saveStatus } };
  mockEsqContext = { esq, editable: true, mutateEsq: setEsq, runtime: { workbookId: "esq", projectId: "project", revision, saveStatus } };
  return <ToastProvider>{host === "SY" ? <SyBayesianNetworkWorkspace /> : <EsqEventTreeHclWorkspace />}</ToastProvider>;
}
type RunKind = "BN" | "BN_BATCH" | "FT" | "FT_BATCH" | "ET" | "ET_BATCH";
function run(kind: RunKind) {
  const config = mockEditor.hclConfigurations[0]!;
  const tree = { workbookId: "sy", workbookName: "SY", modelId: "ft", modelName: "FT", modelCode: "FT", topGateId: "top", basicEvents: [] };
  if (kind === "BN") mockEditor.onRun();
  if (kind === "BN_BATCH") mockEditor.onRunBatch!(config.evidenceScenarios!);
  if (kind === "FT") mockEditor.onRunHclFaultTree(config, tree, "PROBABILITY");
  if (kind === "FT_BATCH") mockEditor.onRunHclFaultTreeBatch(config, tree, ["scenario"], false, "PROBABILITY");
  if (kind === "ET") mockEditor.onRunHclEventTree(config, mockEditor.eventTreeOptions[0]!, "PROBABILITY");
  if (kind === "ET_BATCH") mockEditor.onRunHclEventTreeBatch(config, mockEditor.eventTreeOptions[0]!, ["scenario"], false, "PROBABILITY");
}
async function ready(host: "SY" | "ESQ" = "SY", saveStatus: RevisionedSaveStatus = "saved") {
  const view = render(<Harness host={host} saveStatus={saveStatus} />);
  await waitFor(() => expect(mockEditor.hclConfigurations).toHaveLength(1));
  if (host === "ESQ") await waitFor(() => expect(mockEditor.eventTreeOptions).toHaveLength(1));
  return view;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockExecute.mockResolvedValue({ run: { id: "run", status: "SUCCEEDED" }, runs: [{ scenarioId: "scenario", scenarioCode: "S1", scenarioName: "Earthquake", run: { id: "run", status: "SUCCEEDED" } }] });
  mockResult.mockResolvedValue({ probability: 0.2, marginals: [], sequences: [], scenarios: [] });
});

it.each(["SY", "ESQ"] as const)("preserves %s evidence through deletion, undo and rename", async (host) => {
  await ready(host);
  const before = structuredClone(mockEditor.hclConfigurations);
  act(() => mockEditor.onModelChange(deleteNode(mockEditor.model, TEST_ID.a)));
  expect(mockEditor.hclConfigurations).toEqual(before);
  expect(mockEditor.validation.some((issue) => issue.code === "BN_EVIDENCE_NODE_NOT_FOUND")).toBe(true);
  act(() => mockEditor.onModelChange(original));
  expect(mockEditor.hclConfigurations).toEqual(before);
  expect(mockEditor.validation).toEqual([]);
  act(() => mockEditor.onModelChange({ ...original, name: "Renamed network" }));
  expect(mockEditor.hclConfigurations).toEqual(before);
});

const kinds: RunKind[] = ["BN", "BN_BATCH", "FT", "FT_BATCH", "ET", "ET_BATCH"];
it.each(kinds.flatMap((kind) => (["saving", "failed"] as const).map((status) => [kind, status] as const)))(
  "blocks %s callbacks while saving is %s", async (kind, status) => {
    await ready(kind.startsWith("ET") ? "ESQ" : "SY", status);
    act(() => run(kind));
    expect(mockExecute).not.toHaveBeenCalled();
    expect(screen.getByTestId("blocked").textContent).not.toBe("");
  },
);
it.each(kinds)("clears completed %s results after a CPT edit", async (kind) => {
  await ready(kind.startsWith("ET") ? "ESQ" : "SY");
  act(() => run(kind));
  await waitFor(() => expect(screen.getByTestId("result")).not.toHaveTextContent("[null,null,null,null]"));
  act(() => mockEditor.onModelChange({ ...mockEditor.model, conditionalProbabilityTables: mockEditor.model.conditionalProbabilityTables.map((table) => ({
    ...table, rows: table.rows.map((row) => ({ ...row, values: row.values.map((value) => ({ ...value, probability: 0.5 })) })),
  })) }));
  expect(screen.getByTestId("result")).toHaveTextContent("[null,null,null,null]");
});
it.each(kinds)("discards late %s results after inputs change", async (kind) => {
  let resolve!: (value: unknown) => void;
  mockResult.mockReturnValue(new Promise((done) => { resolve = done; }));
  await ready(kind.startsWith("ET") ? "ESQ" : "SY");
  act(() => run(kind));
  await waitFor(() => expect(mockResult).toHaveBeenCalled());
  act(() => mockEditor.onModelChange({ ...mockEditor.model, name: "Edited during execution" }));
  await act(async () => { resolve({ probability: 0.9, marginals: [], scenarios: [], sequences: [] }); });
  expect(screen.getByTestId("result")).toHaveTextContent("[null,null,null,null]");
});
it("uses the saved revision after saving completes", async () => {
  const view = await ready("SY", "saving");
  act(() => run("BN"));
  view.rerender(<Harness saveStatus="saved" revision={2} />);
  act(() => run("BN"));
  await waitFor(() => expect(mockExecute).toHaveBeenCalledTimes(1));
  expect(mockExecute.mock.calls[0][2]).toBe(2);
});
it("discards stale errors and does not clear a newer run", async () => {
  let rejectOld!: (error: Error) => void;
  mockExecute.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject; }));
  await ready();
  act(() => run("BN"));
  act(() => mockEditor.onModelChange({ ...mockEditor.model, name: "New input" }));
  act(() => run("BN"));
  await waitFor(() => expect(mockEditor.analysisResult).not.toBeNull());
  await act(async () => { rejectOld(new Error("Old failure")); });
  expect(mockEditor.analysisResult).not.toBeNull();
  expect(screen.getByTestId("error")).toBeEmptyDOMElement();
});


it.each(["FT_BATCH", "ET_BATCH"] as const)("preserves %s compilation counts and saved diagnostics", async (kind) => {
  const compilationReuse = {
    ...(kind === "FT_BATCH" ? { bddCompilations: 1 } : { sequenceBddCompilations: 2 }),
    junctionTreeCompilations: 1,
    scenarioEvaluations: 1,
  };
  const diagnostics = {
    bdd: { nodes: 3, variables: 2, variableOrder: ["B", "A"] },
    bridge: { quantifications: 1, bddContextCacheHits: 0, bddContextCacheMisses: 2, bnQueryCacheHits: 0, bnQueryCacheMisses: 1 },
    junctionTree: { numCliques: 1, maxCliqueSize: 2, treewidth: 1, totalTableEntries: 4 },
  };
  mockExecute.mockResolvedValue({
    compilationReuse,
    runs: [{ scenarioId: "scenario", scenarioCode: "S1", scenarioName: "Earthquake", run: { id: "run", status: "SUCCEEDED" } }],
  });
  const savedResult = kind === "FT_BATCH"
    ? { probability: 0.2, bddNodes: 3, bddVariables: 2, variableOrder: ["B", "A"], bridge: diagnostics.bridge, junctionTree: diagnostics.junctionTree, compilationReuse }
    : { sequences: [{ sequenceId: "S1", probability: 0.2, diagnostics }], compilationReuse };
  mockResult.mockResolvedValue(savedResult);
  await ready(kind === "ET_BATCH" ? "ESQ" : "SY");
  act(() => run(kind));
  await waitFor(() => expect(mockEditor.hclBatchRunResult?.compilationReuse).toEqual(compilationReuse));
  expect(mockEditor.hclBatchRunResult?.scenarios[0]?.result?.result).toEqual(savedResult);
  expect(mockExecute).toHaveBeenCalledTimes(1);
  expect(mockResult).toHaveBeenCalledTimes(1);
});
