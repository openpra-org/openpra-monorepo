import type { JSX } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { FrequencyUnit } from "interfaces-mef-types/core/events";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { FrequencyDataSource } from "interfaces-mef-types/ie/initiating-event-analysis";
import { evaluateUncertainty } from "../../shared/uncertaintyApi";
import { uncertaintyIdle } from "../../shared/useUncertainty";
import { expressionText } from "../../shared/uncertainText";
import { praxisUncertainty } from "../../shared/test/praxisUncertainty";
import { IeFrequencyQuantificationEditor } from "../ieFrequencyQuantificationEditor";

jest.mock("../../shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

const OPERATING: FrequencyDataSource = { uuid: "DS-1", label: "Plant records", basis: "OPERATING_DATA", perModule: false, sourceReference: "Plant records.", eventCount: 2, exposureModuleYears: 5 };

const DESIGN: FrequencyDataSource = {
  uuid: "DS-2",
  label: "Design estimate",
  basis: "DESIGN_BASED",
  perModule: false,
  sourceReference: "Design analysis.",
  estimate: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: 0.02, errorFactor: 5, level: 0.95 } } },
};

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

function editor(sources: FrequencyDataSource[], primaryId: string, modules: number, onChange: (sources: FrequencyDataSource[], primaryId: string | undefined, frequency: UncertainExpression | undefined) => void): JSX.Element {
  return (
    <IeFrequencyQuantificationEditor
      sources={sources}
      primaryId={primaryId}
      numberOfModules={modules}
      basis={FrequencyUnit.PER_PLANT_YEAR}
      table={new Map()}
      describe={(expression) => expressionText(expression)}
      editable={true}
      onChange={onChange}
    />
  );
}

describe("IE frequency quantifier", () => {
  beforeEach(() => {
    jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
  });

  it("shows the PRAXIS posterior of the primary operating data and its spread", async () => {
    render(editor([OPERATING, DESIGN], "DS-1", 1, jest.fn()));
    await settle();
    expect(screen.getAllByText("5.0E-01").length).toBeGreaterThan(0);
    expect(screen.getByText("per plant-year")).toBeInTheDocument();
    expect(screen.getByText((text) => text.includes("5th percentile") && text.includes("95th percentile"))).toBeInTheDocument();
    expect(screen.getByText("2.0E-02")).toBeInTheDocument();
  });

  it("sends the posterior of the edited counts as the frequency", async () => {
    const onChange = jest.fn();
    render(editor([OPERATING], "DS-1", 1, onChange));
    await settle();
    fireEvent.change(screen.getByDisplayValue("2"), { target: { value: "4" } });
    const [sources, primaryId, frequency] = onChange.mock.calls[onChange.mock.calls.length - 1] ?? [];
    expect(primaryId).toBe("DS-1");
    expect(sources).toEqual([{ ...OPERATING, eventCount: 4 }]);
    expect(frequency).toEqual({ node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POSTERIOR", prior: null, evidence: [{ likelihood: "POISSON", failures: 4, exposure: 5 }] } } });
  });

  it("scales a per-module primary by the module count", async () => {
    render(editor([{ ...OPERATING, perModule: true }], "DS-1", 3, jest.fn()));
    await settle();
    expect(screen.getAllByText("1.5E+00").length).toBeGreaterThan(0);
  });

  it("keeps the stored frequency while the primary source is incomplete", async () => {
    const onChange = jest.fn();
    render(editor([{ ...DESIGN, estimate: undefined }], "DS-2", 1, onChange));
    await settle();
    expect(screen.getByText((text) => text.includes("The primary source is not complete, so the frequency stays as stored."))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Per site" }));
    expect(onChange).toHaveBeenLastCalledWith([{ ...DESIGN, estimate: undefined, perModule: true }], "DS-2", undefined);
  });
});
