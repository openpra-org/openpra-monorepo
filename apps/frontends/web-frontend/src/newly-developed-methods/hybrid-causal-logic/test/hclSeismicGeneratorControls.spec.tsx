import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { HclUncertaintySettings } from "interfaces-mef-types/modeling";
import { HclSeismicGeneratorControls } from "../hclSeismicGeneratorControls";
import { TEST_ID, testBayesianNetworkModel } from "../../bayesian-network/test/bayesianNetworkTestModel";
import { connectNodes } from "../../bayesian-network/bayesianNetworkOperations";

const model = connectNodes(testBayesianNetworkModel(), TEST_ID.a, TEST_ID.b);
const empty: HclUncertaintySettings = {
  sampleCount: 513,
  seed: 42,
  sampler: "LHS",
  basicEventDistributions: [],
  cptRowDistributions: [],
};
function Harness({
  changed,
  initial = empty,
  disabled = false,
}: {
  changed: jest.Mock;
  initial?: HclUncertaintySettings;
  disabled?: boolean;
}) {
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState("");
  return (
    <>
      <HclSeismicGeneratorControls
        model={model}
        reference={{ workbookId: "esq", modelId: model.modelId }}
        settings={settings}
        disabled={disabled}
        onError={setError}
        onChange={(next) => {
          setSettings(next);
          changed(next);
        }}
      />
      <div role="alert">{error}</div>
    </>
  );
}

it("adds fragility, edits capacity and centers, and preserves the shared sampler", async () => {
  const user = userEvent.setup();
  const changed = jest.fn();
  render(<Harness changed={changed} />);
  expect(screen.getByLabelText("Generator node")).toHaveValue(TEST_ID.b);
  await user.click(screen.getByRole("button", { name: "Add generator" }));
  await user.click(screen.getByText("B · Seismic fragility"));
  const theta = screen.getByLabelText("Median capacity (theta)");
  await user.clear(theta);
  await user.type(theta, "0.5");
  await user.tab();
  const center = screen.getByLabelText("PGA center: TRUE");
  await user.clear(center);
  await user.type(center, "0.5");
  await user.tab();
  expect(changed.mock.lastCall[0]).toMatchObject({
    sampler: "LHS",
    cptGenerators: [{ generator: { theta: 0.5, pgaParentId: TEST_ID.a, pgaCenters: [{ value: 0 }, { value: 0.5 }] } }],
  });
  const beta = screen.getByLabelText("Randomness (beta R)");
  await user.clear(beta);
  await user.type(beta, "0");
  await user.tab();
  expect(beta).toHaveValue(1);
  expect(screen.getByRole("alert")).not.toBeEmptyDOMElement();
  await user.selectOptions(screen.getByLabelText("Failure state"), TEST_ID.bFalse);
  expect(changed.mock.lastCall[0].cptGenerators[0].generator).toMatchObject({
    trueStateId: TEST_ID.bFalse,
    falseStateId: TEST_ID.bTrue,
  });
});

it("adds root PGA bins, edits conversion, and deletes the generator", async () => {
  const user = userEvent.setup();
  const changed = jest.fn();
  render(<Harness changed={changed} />);
  await user.selectOptions(screen.getByLabelText("Generator"), "seismic_pga_bins");
  expect(screen.getByLabelText("Generator node")).toHaveValue(TEST_ID.a);
  await user.click(screen.getByRole("button", { name: "Add generator" }));
  await user.click(screen.getByText("A · PGA bins"));
  await user.selectOptions(screen.getByLabelText("Frequency conversion"), "linear");
  const frequency = screen.getByLabelText("Median frequency");
  await user.clear(frequency);
  await user.type(frequency, "0.01");
  await user.tab();
  expect(changed.mock.lastCall[0].cptGenerators[0].generator).toMatchObject({
    frequencyToProbability: "linear",
    bins: [{ medianFrequency: 0.01, errorFactor95: 2 }],
  });
  const factor = screen.getByLabelText("95% error factor");
  await user.clear(factor);
  await user.type(factor, "1");
  await user.tab();
  expect(factor).toHaveValue(2);
  await user.selectOptions(screen.getByLabelText("No-earthquake state"), TEST_ID.aTrue);
  expect(changed.mock.lastCall[0].cptGenerators[0].generator.bins[0].stateId).toBe(TEST_ID.aFalse);
  await user.click(screen.getByRole("button", { name: "Delete generator" }));
  expect(changed.mock.lastCall[0].cptGenerators).toEqual([]);
});

it("excludes nodes already using row priors", () => {
  render(
    <Harness
      changed={jest.fn()}
      initial={{
        ...empty,
        cptRowDistributions: [
          {
            bayesianNetworkNode: {
              referenceType: "BAYESIAN_NETWORK_NODE",
              workbookId: "esq",
              modelId: model.modelId,
              entityId: TEST_ID.b,
            },
            cptRowId: TEST_ID.bRow,
            prior: { family: "DIRICHLET", alpha: [1, 1] },
          },
        ],
      }}
    />,
  );
  expect(screen.getByRole("button", { name: "Add generator" })).toBeDisabled();
});

it("does not offer mutations in read-only mode", () => {
  render(
    <Harness
      changed={jest.fn()}
      disabled
    />,
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
