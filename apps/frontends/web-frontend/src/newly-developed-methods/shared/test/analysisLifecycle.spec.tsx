import { JSX, useCallback, useState } from "react";
import { act, render, screen, waitFor, type RenderResult } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type {
  BayesianNetworkAnalysisResult,
  BayesianNetworkBatchAnalysisResult,
  BayesianNetworkExecuteResult,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import type { BayesianNetworkEditorProps } from "../../bayesian-network/bayesianNetworkTypes";
import { deleteNode } from "../../bayesian-network/bayesianNetworkOperations";
import { TEST_ID, testBayesianNetworkModel } from "../../bayesian-network/test/bayesianNetworkTestModel";
import { EsqDependencyNetwork } from "../../../esq-workbooks/EsqDependencyNetwork";
import { EsqWorkbookProvider } from "../../../esq-workbooks/esqWorkbookContext";
import {
  getEsqBayesianNetworkBatchResult,
  getEsqBayesianNetworkResult,
  runEsqBayesianNetwork,
  runEsqBayesianNetworkBatch,
} from "../../../esq-workbooks/esqWorkbookApi";
import { ESQ_ID, NOW, SAVED, dependencyConfiguration, dependencyEsq, dependencyScenarios } from "../../../esq-workbooks/test/esqDependencyFixtures";
import type { RevisionedSaveStatus } from "../../../workbooks/useRevisionedMefPatch";

type RunKind = "QUERY" | "QUERY_BATCH";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

let mockEditor: BayesianNetworkEditorProps | undefined;

jest.mock("../../bayesian-network", () => ({
  ...jest.requireActual<typeof import("../../bayesian-network")>("../../bayesian-network"),
  BayesianNetworkEditor: (props: BayesianNetworkEditorProps) => {
    mockEditor = props;
    return (
      <>
        <output data-testid="result">{JSON.stringify([props.analysisResult, props.queryBatchResult ?? null])}</output>
        <output data-testid="error">{props.runError}</output>
        <output data-testid="blocked">{props.saveBlockedReason}</output>
      </>
    );
  },
}));

jest.mock("../../../esq-workbooks/esqWorkbookApi", () => ({
  ...jest.requireActual<typeof import("../../../esq-workbooks/esqWorkbookApi")>("../../../esq-workbooks/esqWorkbookApi"),
  runEsqBayesianNetwork: jest.fn(),
  runEsqBayesianNetworkBatch: jest.fn(),
  getEsqBayesianNetworkResult: jest.fn(),
  getEsqBayesianNetworkBatchResult: jest.fn(),
}));

const RUN_ID = "40000000-0000-4000-8000-000000000001";
const NO_RESULT = "[null,null]";
const KINDS: RunKind[] = ["QUERY", "QUERY_BATCH"];
const BLOCKS: (readonly [RevisionedSaveStatus, string])[] = [
  ["saving", "Saving changes. Run after saving finishes."],
  ["failed", "Save failed. Reload or save successfully before running."],
];

function execution(): BayesianNetworkExecuteResult {
  return {
    schemaVersion: "1.0.0",
    run: {
      schemaVersion: "1.0.0",
      id: RUN_ID,
      owner: { workbookId: ESQ_ID, modelId: TEST_ID.model, workbookRevision: 5 },
      sourceWorkbooks: [{ workbookId: ESQ_ID, workbookRevision: 5 }],
      methodType: "BAYESIAN_NETWORK",
      status: "SUCCEEDED",
      requestedBy: "analyst",
      requestedAt: NOW,
      startedAt: NOW,
      completedAt: NOW,
      engine: null,
      failure: null,
    },
  };
}

function posterior(): BayesianNetworkAnalysisResult {
  return {
    schemaVersion: "1.0.0",
    runId: RUN_ID,
    owner: { workbookId: ESQ_ID, modelId: TEST_ID.model, workbookRevision: 5 },
    evidence: { observations: [] },
    marginals: [{ nodeId: TEST_ID.b, values: [{ stateId: TEST_ID.bFalse, probability: 0.5 }, { stateId: TEST_ID.bTrue, probability: 0.5 }] }],
    validationIssues: [],
    completedAt: NOW,
  };
}

function batchPosterior(): BayesianNetworkBatchAnalysisResult {
  return {
    schemaVersion: "1.0.0",
    runId: RUN_ID,
    owner: { workbookId: ESQ_ID, modelId: TEST_ID.model, workbookRevision: 5 },
    queryNodeIds: [TEST_ID.a],
    scenarios: dependencyScenarios().map((scenario) => ({ scenarioId: scenario.id, scenarioCode: scenario.code, scenarioName: scenario.name, status: "SUCCEEDED", failure: null, result: posterior() })),
    diagnostics: { junctionTreeCompilations: 1, scenarioEvaluations: 2 },
    completedAt: NOW,
  };
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function Harness({ saveStatus = "saved", revision = 5 }: { saveStatus?: RevisionedSaveStatus; revision?: number }): JSX.Element {
  const [esq, setEsq] = useState(() => dependencyEsq([dependencyConfiguration({
    baseEvidence: { observations: [{ nodeId: TEST_ID.a, stateId: TEST_ID.aTrue }] },
    evidenceScenarios: dependencyScenarios(),
  })]));
  const mutateEsq = useCallback((mutator: (current: EventSequenceQuantification) => EventSequenceQuantification): void => setEsq(mutator), []);
  return (
    <EsqWorkbookProvider data={{ esq }} editable mutateEsq={mutateEsq} runtime={{ ...SAVED, revision, saveStatus }}>
      <EsqDependencyNetwork network={esq.bayesianNetworks[0]} faultTreeOptions={[]} onNetwork={() => undefined} />
    </EsqWorkbookProvider>
  );
}

function editor(): BayesianNetworkEditorProps {
  if (mockEditor === undefined) throw new Error("the editor is not on screen");
  return mockEditor;
}

function run(kind: RunKind): void {
  if (kind === "QUERY") editor().onRun();
  else editor().onRunBatch?.(dependencyScenarios());
}

function ready(saveStatus: RevisionedSaveStatus = "saved"): RenderResult {
  const view = render(<Harness saveStatus={saveStatus} />);
  expect(editor().hclConfigurations).toHaveLength(1);
  return view;
}

function shown(): HTMLElement {
  return screen.getByTestId("result");
}

beforeEach(() => {
  mockEditor = undefined;
  jest.mocked(runEsqBayesianNetwork).mockReset();
  jest.mocked(runEsqBayesianNetwork).mockResolvedValue(execution());
  jest.mocked(runEsqBayesianNetworkBatch).mockReset();
  jest.mocked(runEsqBayesianNetworkBatch).mockResolvedValue(execution());
  jest.mocked(getEsqBayesianNetworkResult).mockReset();
  jest.mocked(getEsqBayesianNetworkResult).mockResolvedValue(posterior());
  jest.mocked(getEsqBayesianNetworkBatchResult).mockReset();
  jest.mocked(getEsqBayesianNetworkBatchResult).mockResolvedValue(batchPosterior());
});

it("preserves the evidence of the configuration through deletion, undo and rename", () => {
  ready();
  const before = structuredClone(editor().hclConfigurations);
  act(() => editor().onModelChange(deleteNode(editor().model, TEST_ID.a)));
  expect(editor().hclConfigurations).toEqual(before);
  expect(editor().validation.some((issue) => issue.code === "BN_EVIDENCE_NODE_NOT_FOUND")).toBe(true);
  act(() => editor().onModelChange(testBayesianNetworkModel()));
  expect(editor().hclConfigurations).toEqual(before);
  expect(editor().validation).toEqual([]);
  act(() => editor().onModelChange({ ...testBayesianNetworkModel(), name: "Renamed network" }));
  expect(editor().hclConfigurations).toEqual(before);
});

it.each(KINDS.flatMap((kind) => BLOCKS.map(([status, reason]) => [kind, status, reason] as const)))(
  "blocks %s callbacks while saving is %s",
  (kind, status, reason) => {
    ready(status);
    act(() => run(kind));
    expect(runEsqBayesianNetwork).not.toHaveBeenCalled();
    expect(runEsqBayesianNetworkBatch).not.toHaveBeenCalled();
    expect(editor().saving).toBe(status === "saving");
    if (status === "saving") expect(screen.getByTestId("blocked")).toBeEmptyDOMElement();
    else expect(screen.getByTestId("blocked")).toHaveTextContent(reason);
    expect(screen.getByTestId("error")).toHaveTextContent(reason);
  },
);

it.each(KINDS)("keeps completed %s results through a save that leaves the network alone", async (kind) => {
  const view = ready();
  act(() => run(kind));
  await waitFor(() => expect(shown()).not.toHaveTextContent(NO_RESULT));
  view.rerender(<Harness saveStatus="saving" />);
  expect(shown()).not.toHaveTextContent(NO_RESULT);
  view.rerender(<Harness saveStatus="saved" revision={6} />);
  expect(shown()).not.toHaveTextContent(NO_RESULT);
});

it.each(KINDS)("shows the %s result of the selected network", async (kind) => {
  ready();
  act(() => run(kind));
  await waitFor(() => expect(shown()).not.toHaveTextContent(NO_RESULT));
  if (kind === "QUERY") {
    expect(runEsqBayesianNetwork).toHaveBeenCalledWith(ESQ_ID, TEST_ID.model, 5, { observations: [{ nodeId: TEST_ID.a, stateId: TEST_ID.aTrue }] }, TEST_ID.a);
    expect(getEsqBayesianNetworkResult).toHaveBeenCalledWith(ESQ_ID, TEST_ID.model, RUN_ID);
    expect(editor().analysisResult).toEqual(posterior());
  } else {
    expect(runEsqBayesianNetworkBatch).toHaveBeenCalledWith(ESQ_ID, TEST_ID.model, 5, dependencyScenarios(), TEST_ID.a);
    expect(getEsqBayesianNetworkBatchResult).toHaveBeenCalledWith(ESQ_ID, TEST_ID.model, RUN_ID);
    expect(editor().queryBatchResult).toEqual({ queryNodeId: TEST_ID.a, scenarios: batchPosterior().scenarios });
  }
  expect(editor().running).toBe(false);
});

it.each(KINDS)("clears completed %s results after a CPT edit", async (kind) => {
  ready();
  act(() => run(kind));
  await waitFor(() => expect(shown()).not.toHaveTextContent(NO_RESULT));
  act(() => editor().onModelChange({
    ...editor().model,
    conditionalProbabilityTables: editor().model.conditionalProbabilityTables.map((table) => ({
      ...table,
      rows: table.rows.map((row) => ({ ...row, values: [{ ...row.values[0], probability: 0.5 }, ...row.values.slice(1).map((value) => ({ ...value, probability: 0.5 }))] })),
    })),
  }));
  expect(shown()).toHaveTextContent(NO_RESULT);
});

it.each(KINDS)("clears completed %s results when the evidence or the query node changes", async (kind) => {
  ready();
  act(() => run(kind));
  await waitFor(() => expect(shown()).not.toHaveTextContent(NO_RESULT));
  act(() => editor().onEvidenceChange({ observations: [] }));
  expect(shown()).toHaveTextContent(NO_RESULT);
  act(() => run(kind));
  await waitFor(() => expect(shown()).not.toHaveTextContent(NO_RESULT));
  act(() => editor().onQueryNodeChange(TEST_ID.b));
  expect(shown()).toHaveTextContent(NO_RESULT);
});

it.each(KINDS)("discards late %s results after inputs change", async (kind) => {
  const single = deferred<BayesianNetworkAnalysisResult>();
  const batch = deferred<BayesianNetworkBatchAnalysisResult>();
  jest.mocked(getEsqBayesianNetworkResult).mockReturnValue(single.promise);
  jest.mocked(getEsqBayesianNetworkBatchResult).mockReturnValue(batch.promise);
  ready();
  act(() => run(kind));
  await waitFor(() => expect(kind === "QUERY" ? getEsqBayesianNetworkResult : getEsqBayesianNetworkBatchResult).toHaveBeenCalled());
  act(() => editor().onModelChange({ ...editor().model, name: "Edited during the run" }));
  await act(async () => {
    single.resolve(posterior());
    batch.resolve(batchPosterior());
  });
  expect(shown()).toHaveTextContent(NO_RESULT);
});

it("uses the saved revision after saving completes", async () => {
  const view = ready("saving");
  act(() => run("QUERY"));
  view.rerender(<Harness saveStatus="saved" revision={6} />);
  act(() => run("QUERY"));
  await waitFor(() => expect(runEsqBayesianNetwork).toHaveBeenCalledTimes(1));
  expect(jest.mocked(runEsqBayesianNetwork).mock.calls[0]?.[2]).toBe(6);
  await waitFor(() => expect(shown()).not.toHaveTextContent(NO_RESULT));
});

it("discards stale errors and does not clear a newer run", async () => {
  const old = deferred<BayesianNetworkExecuteResult>();
  jest.mocked(runEsqBayesianNetwork).mockReturnValueOnce(old.promise);
  ready();
  act(() => run("QUERY"));
  act(() => editor().onModelChange({ ...editor().model, name: "New input" }));
  act(() => run("QUERY"));
  await waitFor(() => expect(editor().analysisResult).not.toBeNull());
  await act(async () => { old.reject(new Error("Old failure")); });
  expect(editor().analysisResult).not.toBeNull();
  expect(screen.getByTestId("error")).toBeEmptyDOMElement();
});
