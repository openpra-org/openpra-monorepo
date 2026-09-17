import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import { ToastProvider } from "../../../toast/toastProvider";
import { HclBindingEditor } from "../hclBindingEditor";
import { HclHazardSweepControls } from "../hclHazardSweepControls";
import type { HclBindingEditorProps } from "../hclBindingTypes";
import { TEST_ID, testBayesianNetworkModel } from "../../bayesian-network/test/bayesianNetworkTestModel";

const model = testBayesianNetworkModel();
const configuration: WorkbookHclConfiguration = {
  modelId: "20000000-0000-4000-8000-000000000001",
  code: "HCL",
  name: "HCL",
  description: "",
  bayesianNetwork: { workbookId: "esq", modelId: TEST_ID.model },
  faultTrees: [{ workbookId: "sy", modelId: "ft" }],
  baseEvidence: { observations: [] },
  bindings: [
    {
      id: "binding",
      faultTreeBasicEvent: { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId: "sy", entityId: "be" },
      bayesianNetworkNode: {
        referenceType: "BAYESIAN_NETWORK_NODE",
        workbookId: "esq",
        modelId: TEST_ID.model,
        entityId: TEST_ID.a,
      },
      trueStateIds: [TEST_ID.aTrue],
    },
  ],
  evidenceScenarios: [
    {
      id: "saved",
      code: "SAVED",
      name: "Saved row",
      enabled: true,
      evidence: { observations: [{ nodeId: TEST_ID.a, stateId: TEST_ID.aFalse }] },
    },
  ],
  solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
};
const tree = {
  workbookId: "sy",
  workbookName: "Systems",
  modelId: "ft",
  modelCode: "FT",
  modelName: "Fault tree",
  topGateId: "top",
  basicEvents: [{ id: "be", code: "BE", name: "Basic event" }],
};

function Harness({
  onRun = jest.fn(),
  onSave = jest.fn(),
  onGenerate,
  scope = "FAULT_TREE",
  initialConfiguration = configuration,
}: {
  onRun?: jest.Mock;
  onSave?: jest.Mock;
  onGenerate?: HclBindingEditorProps["onGenerateScenarios"];
  scope?: "FAULT_TREE" | "EVENT_TREE";
  initialConfiguration?: WorkbookHclConfiguration;
}) {
  const [configurations, setConfigurations] = useState([structuredClone(initialConfiguration)]);
  return (
    <ToastProvider>
      <HclBindingEditor
        model={model}
        editable
        workbookId="esq"
        configurations={configurations}
        scope={scope}
        faultTreeOptions={[tree]}
        eventTreeOptions={[{ workbookId: "es", workbookName: "Events", modelId: "et", modelCode: "ET", modelName: "Event tree", sequences: [], faultTrees: [{ workbookId: "sy", modelId: "ft" }] }]}
        baseEvidence={configuration.baseEvidence}
        validation={[]}
        running={false}
        runError={null}
        runResult={null}
        batchRunResult={null}
        calculationType="PROBABILITY"
        workflow="BATCH"
        onChange={(next) => {
          onSave(next);
          setConfigurations(next);
        }}
        onRunFaultTree={jest.fn()}
        onRunEventTree={jest.fn()}
        onRunFaultTreeBatch={onRun}
        onRunEventTreeBatch={onRun}
        onGenerateScenarios={onGenerate}
      />
    </ToastProvider>
  );
}

it.each(["json", "csv"])(
  "edits and executes uploaded %s rows and grid without overwriting saved scenarios",
  async (extension) => {
    const user = userEvent.setup();
    const onRun = jest.fn();
    const onSave = jest.fn();
    render(
      <Harness
        onRun={onRun}
        onSave={onSave}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Configuration", exact: true }));
    const text =
      extension === "json" ?
        JSON.stringify([
          { code: "LOW", evidence: { A: "FALSE" } },
          { code: "HIGH", evidence: { A: "TRUE" } },
        ])
      : 'code,name,enabled,evidence\nLOW,Low,true,"{""A"":""FALSE""}"\nHIGH,High,true,"{""A"":""TRUE""}"';
    const file = new File([text], `batch.${extension}`);
    Object.defineProperty(file, "text", { value: async () => text });
    fireEvent.change(screen.getByLabelText("Upload HCL evidence batch"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByLabelText("Evidence scenario list")).toHaveTextContent("LOW"));
    expect(screen.getByLabelText("Evidence scenario list")).not.toHaveTextContent("SAVED");
    const edit = screen.getByRole("region", { name: "Edit scenario LOW" });
    fireEvent.change(within(edit).getByLabelText("Name"), { target: { value: "Edited upload" } });
    await user.selectOptions(screen.getByLabelText("HCL batch type"), "HAZARD_GRID");
    const grid = screen.getByRole("region", { name: "Hazard convolution settings" });
    await user.click(within(grid).getByRole("button", { name: "Enable" }));
    fireEvent.change(within(grid).getByLabelText("Annual scale"), { target: { value: "3" } });
    await user.click(screen.getByLabelText("Enable HIGH"));
    await user.click(screen.getByRole("button", { name: "Run probability batch" }));
    expect(onRun).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceScenarios: [
          expect.objectContaining({ code: "LOW", name: "Edited upload", enabled: true }),
          expect.objectContaining({ code: "HIGH", enabled: false }),
        ],
        hazardGrid: expect.objectContaining({
          hazardNodeIds: [TEST_ID.a],
          annualFrequencyScale: expect.objectContaining({ value: 3 }),
        }),
      }),
      tree,
      [expect.any(String)],
      true,
      "PROBABILITY",
    );
    expect(onSave).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Use saved scenarios" }));
    expect(screen.getByLabelText("Evidence scenario list")).toHaveTextContent("SAVED");
    expect(within(grid).getByRole("button", { name: "Enable" })).toBeInTheDocument();
  },
);

it("runs generated rows with the generator's full hazard dimensions", async () => {
  const user = userEvent.setup();
  const onRun = jest.fn();
  const onSave = jest.fn();
  const generated = [
    {
      id: "generated",
      code: "hz_0001",
      name: "A=TRUE | B=FALSE",
      enabled: true,
      evidence: {
        observations: [
          { nodeId: TEST_ID.a, stateId: TEST_ID.aTrue },
          { nodeId: TEST_ID.b, stateId: TEST_ID.bFalse },
        ],
      },
    },
  ];
  const onGenerate = jest.fn().mockResolvedValue(generated);
  render(
    <Harness
      onRun={onRun}
      onSave={onSave}
      onGenerate={onGenerate}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Configuration", exact: true }));
  await user.click(screen.getByText("Generate scenario combinations", { selector: "summary" }));
  const dimensions = screen.getByRole("group", { name: "Nodes and states" });
  await user.click(within(dimensions).getByLabelText("A", { exact: true }));
  await user.click(within(dimensions).getByLabelText("B", { exact: true }));
  await user.click(screen.getByRole("button", { name: "Generate scenarios" }));
  await screen.findByRole("region", { name: "Edit scenario hz_0001" });
  await user.selectOptions(screen.getByLabelText("HCL batch type"), "HAZARD_GRID");
  await user.click(screen.getByRole("button", { name: "Run probability batch" }));
  expect(onGenerate).toHaveBeenCalledTimes(1);
  expect(onRun.mock.calls[0]?.[0]).toMatchObject({
    evidenceScenarios: generated,
    hazardGrid: { hazardNodeIds: [TEST_ID.a, TEST_ID.b] },
  });
  expect(onSave).not.toHaveBeenCalled();
});

it("sends state selections, partial exclusions and the limit to the source generator", async () => {
  const user = userEvent.setup();
  const onGenerate = jest.fn().mockResolvedValue([]);
  const onGenerated = jest.fn();
  const onError = jest.fn();
  render(
    <HclHazardSweepControls
      model={model}
      disabled={false}
      onGenerate={onGenerate}
      onGenerated={onGenerated}
      onError={onError}
    />,
  );
  await user.click(screen.getByText("Generate scenario combinations", { selector: "summary" }));
  await user.click(screen.getByLabelText("A", { exact: true }));
  await user.click(screen.getByLabelText("B", { exact: true }));
  await user.click(screen.getByLabelText("B: TRUE"));
  await user.click(screen.getByRole("button", { name: "Add exclusion" }));
  await user.selectOptions(screen.getByLabelText("Exclusion 1: A"), TEST_ID.aFalse);
  fireEvent.change(screen.getByLabelText("Scenario limit (optional)"), { target: { value: "2" } });
  await user.click(screen.getByRole("button", { name: "Generate scenarios" }));
  expect(onGenerate).toHaveBeenCalledWith({
    dimensions: [
      {
        id: "A",
        bnNode: TEST_ID.a,
        states: [TEST_ID.aFalse, TEST_ID.aTrue],
        stateLabels: { [TEST_ID.aFalse]: "FALSE", [TEST_ID.aTrue]: "TRUE" },
      },
      {
        id: "B",
        bnNode: TEST_ID.b,
        states: [TEST_ID.bFalse],
        stateLabels: { [TEST_ID.bFalse]: "FALSE", [TEST_ID.bTrue]: "TRUE" },
      },
    ],
    excludedAssignments: [{ A: TEST_ID.aFalse }],
    maxScenarios: 2,
  });
  expect(onGenerated).not.toHaveBeenCalled();
  expect(onError).toHaveBeenLastCalledWith("No scenarios remain after exclusions.");
});

it.each((["FAULT_TREE", "EVENT_TREE"] as const).flatMap((scope) => [1, 2].map((count) => [scope, count] as const)))(
  "offers %s targets for %s identical evidence row(s)", async (scope, count) => {
    const user = userEvent.setup(); const onRun = jest.fn();
    const initialConfiguration = structuredClone(configuration);
    initialConfiguration.evidenceScenarios = [configuration.evidenceScenarios![0]!, {
      ...configuration.evidenceScenarios![0]!, id: "repeated", code: "REPEATED", name: "Repeated evidence",
    }].slice(0, count);
    render(<Harness onRun={onRun} scope={scope} initialConfiguration={initialConfiguration} />);
    const run = screen.getByRole("button", { name: "Run probability batch" });
    expect(run).toBeEnabled();
    expect(screen.getByLabelText(scope === "FAULT_TREE" ? "HCL fault-tree target" : "HCL event-tree target"))
      .toHaveTextContent(scope === "FAULT_TREE" ? "FT" : "ET");
    await user.click(run);
    expect(onRun).toHaveBeenCalledWith(expect.objectContaining({ evidenceScenarios: initialConfiguration.evidenceScenarios }),
      expect.objectContaining({ modelId: scope === "FAULT_TREE" ? "ft" : "et" }),
      initialConfiguration.evidenceScenarios.map((s) => s.id), false, "PROBABILITY");
  },
);

it("keeps empty batches disabled while showing declared targets", () => {
  render(<Harness initialConfiguration={{ ...configuration, evidenceScenarios: [] }} />);
  expect(screen.getByLabelText("HCL fault-tree target")).toHaveTextContent("FT");
  expect(screen.getByRole("button", { name: "Run probability batch" })).toBeDisabled();
});

it.each(["FAULT_TREE", "EVENT_TREE"] as const)("blocks %s batches with preserved missing-state evidence", async (scope) => {
  const user = userEvent.setup(); const onRun = jest.fn();
  const initialConfiguration = structuredClone(configuration);
  initialConfiguration.evidenceScenarios![0]!.evidence.observations[0]!.stateId = "deleted-state";
  render(<Harness scope={scope} initialConfiguration={initialConfiguration} onRun={onRun} />);
  expect(screen.getByRole("button", { name: "Run probability batch" })).toBeDisabled();
  expect(screen.getByText(/Scenario SAVED references missing or invalid/)).toBeInTheDocument();
  if (scope === "FAULT_TREE") {
    await user.click(screen.getByRole("button", { name: "Configuration", exact: true }));
    expect(screen.getByText(/Evidence references deleted nodes/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove observation" }));
    expect(screen.getByRole("button", { name: "Run probability batch" })).toBeEnabled();
  }
  expect(onRun).not.toHaveBeenCalled();
});
