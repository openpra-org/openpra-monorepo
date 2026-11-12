import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type JSX } from "react";
import {
  validateBayesianNetworkModel,
  type BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { BayesianNetworkEditor } from "../bayesianNetworkEditor";
import type { BayesianNetworkEditorProps } from "../bayesianNetworkTypes";
import { ToastProvider } from "../../../toast/toastProvider";
import { testBayesianNetworkModel } from "./bayesianNetworkTestModel";

const BUILT_NETWORK = `<?xml version='1.0' encoding='UTF-8'?>
<smile version="1.0" id="built_case" numsamples="1000" discsamples="1000">
  <nodes>
    <cpt id="PGA">
      <state id="None" />
      <state id="PGA_1" />
      <probabilities>0.75 0.25</probabilities>
    </cpt>
    <cpt id="SEISMIC_FAIL_DG_A">
      <state id="False" />
      <state id="True" />
      <parents>PGA</parents>
      <probabilities>1 0 0.5 0.5</probabilities>
    </cpt>
  </nodes>
</smile>`;

function Harness({
  onBuildFromSpecification,
  onModelChange,
}: {
  onBuildFromSpecification?: BayesianNetworkEditorProps["onBuildFromSpecification"];
  onModelChange: (model: BayesianNetworkModel) => void;
}): JSX.Element {
  const [model, setModel] = useState(testBayesianNetworkModel());
  return (
    <ToastProvider>
      <BayesianNetworkEditor
        model={model}
        editable
        showAnalysis={false}
        evidence={{ observations: [] }}
        queryNodeId={model.nodes[0]?.id ?? null}
        validation={validateBayesianNetworkModel(model)}
        analysisResult={null}
        running={false}
        runError={null}
        workbookId={null}
        hclConfigurations={[]}
        faultTreeOptions={[]}
        eventTreeOptions={[]}
        hclRunning={false}
        hclRunError={null}
        hclRunResult={null}
        hclBatchRunResult={null}
        onModelChange={(next) => {
          setModel(next);
          onModelChange(next);
        }}
        onEvidenceChange={() => undefined}
        onQueryNodeChange={() => undefined}
        onHclConfigurationsChange={() => undefined}
        onRunHclFaultTree={() => undefined}
        onRunHclEventTree={() => undefined}
        onRunHclFaultTreeBatch={() => undefined}
        onRunHclEventTreeBatch={() => undefined}
        onRun={() => undefined}
        onBuildFromSpecification={onBuildFromSpecification}
      />
    </ToastProvider>
  );
}

function specificationFile(name: string, source: string): File {
  const file = new File([], name);
  Object.defineProperty(file, "text", { value: async () => source });
  return file;
}

describe("building a Bayesian network from a specification", () => {
  beforeEach(() => {
    jest.spyOn(HTMLInputElement.prototype, "click").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("offers the action only when the host can build", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness onModelChange={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: "File" }));
    expect(screen.queryByRole("menuitem", { name: "Build from specification" })).not.toBeInTheDocument();
    unmount();
    render(
      <Harness
        onModelChange={jest.fn()}
        onBuildFromSpecification={jest.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "File" }));
    expect(screen.getByRole("menuitem", { name: "Build from specification" })).toBeInTheDocument();
  });

  it.each([
    ["site.yaml", "YAML"],
    ["site.yml", "YAML"],
    ["SITE.JSON", "JSON"],
  ])("sends %s as %s and replaces the network after confirmation", async (name, format) => {
    const user = userEvent.setup();
    const changed = jest.fn();
    const build = jest.fn().mockResolvedValue(BUILT_NETWORK);
    const { container } = render(
      <Harness
        onModelChange={changed}
        onBuildFromSpecification={build}
      />,
    );
    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(screen.getByRole("menuitem", { name: "Build from specification" }));
    fireEvent.change(container.querySelector('input[type="file"][accept*=".yaml"]')!, {
      target: { files: [specificationFile(name, "schema_version: '0.1'")] },
    });
    const dialog = await screen.findByRole("alertdialog", { name: "Replace this Bayesian network?" });
    expect(build).toHaveBeenCalledWith(format, "schema_version: '0.1'");
    expect(changed).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Replace network" }));
    const built: BayesianNetworkModel = changed.mock.lastCall![0];
    expect(built.nodes.map((node) => node.code)).toEqual(["PGA", "SEISMIC_FAIL_DG_A"]);
    expect(built.edges).toHaveLength(1);
  });

  it("shows the builder's message and keeps the network when the build fails", async () => {
    const user = userEvent.setup();
    const changed = jest.fn();
    const build = jest.fn().mockRejectedValue(new Error("seismic.DG_A.theta must be > 0."));
    const { container } = render(
      <Harness
        onModelChange={changed}
        onBuildFromSpecification={build}
      />,
    );
    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(screen.getByRole("menuitem", { name: "Build from specification" }));
    fireEvent.change(container.querySelector('input[type="file"][accept*=".yaml"]')!, {
      target: { files: [specificationFile("site.yaml", "x")] },
    });
    expect(await screen.findByText("seismic.DG_A.theta must be > 0.")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog", { name: "Replace this Bayesian network?" })).not.toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });
});
