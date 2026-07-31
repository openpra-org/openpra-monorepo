import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { HumanReliabilityScreen } from "../seismicPraScreens";
import {
  SeismicPraWorkbookProvider,
  type SeismicPraVariant,
} from "../seismicPraWorkbookContext";

beforeAll(() => {
  if (globalThis.structuredClone === undefined) {
    globalThis.structuredClone = <T,>(value: T): T =>
      JSON.parse(JSON.stringify(value)) as T;
  }
});

function renderHumanResponse(
  variant: SeismicPraVariant = "htgr",
): ReturnType<typeof createSeismicPraExample> {
  const mef = createSeismicPraExample(variant);
  render(
    <SeismicPraWorkbookProvider
      mef={mef}
      linkedInputs={null}
      editable
      mutate={jest.fn()}
    >
      <HumanReliabilityScreen />
    </SeismicPraWorkbookProvider>,
  );
  return mef;
}

describe("Seismic PRA Step 10 human response", () => {
  it.each(["htgr", "sfr"] as const)(
    "shows the complete human-response workflow for %s",
    (variant) => {
      const mef = renderHumanResponse(variant);
      const actions =
        mef.seismicPlantResponseAnalysis.humanReliabilityModel.humanActions;

      for (const heading of [
        "Human action scope",
        "Seismic performance conditions",
        "Timing and feasibility",
        "HEP, damage states, and dependence",
      ]) {
        expect(screen.getByRole("heading", { name: heading }))
          .toBeInTheDocument();
      }

      expect(screen.queryByRole("heading", {
        name: "Fragility evaluations",
      })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", {
        name: "Seismic initiating events",
      })).not.toBeInTheDocument();

      for (const caption of [
        "HFE register",
        "Human-performance conditions",
        "Action timing",
        "Seismic HEP models",
      ]) {
        const table = screen.getByRole("table", { name: caption });
        expect(within(table).getAllByRole("row"))
          .toHaveLength(actions.length + 1);
        expect(table).toHaveStyle({ tableLayout: "fixed" });
      }

      expect(screen.getAllByText("Sequence-conditioned"))
        .toHaveLength(actions.length);
    },
  );

  it.each(["htgr", "sfr"] as const)(
    "shows technically complete timing, conditions, HEP uncertainty, and dependencies for %s",
    (variant) => {
      const mef = renderHumanResponse(variant);
      const hra = mef.seismicPlantResponseAnalysis.humanReliabilityModel;
      const timingTable = screen.getByRole("table", {
        name: "Action timing",
      });
      const hepTable = screen.getByRole("table", {
        name: "Seismic HEP models",
      });

      for (const action of hra.humanActions) {
        const timingRow = within(timingTable).getByText(action.name)
          .closest("tr");
        const hepRow = within(hepTable)
          .getByText(action.name, { selector: "strong" })
          .closest("tr");
        const margin = action.availableTime - action.requiredTime;

        expect(timingRow).not.toBeNull();
        expect((timingRow as HTMLTableRowElement).cells[3])
          .toHaveTextContent(`${margin} ${action.timeUnits}`);
        expect(within(timingRow as HTMLElement).getByText("Feasible"))
          .toBeInTheDocument();

        expect(hepRow).not.toBeNull();
        expect(within(hepRow as HTMLElement).getByText(
          `${(action.humanErrorProbability * 100).toFixed(1)}%`,
        )).toBeInTheDocument();
        expect(within(hepRow as HTMLElement).getByText(
          `Lognormal, EF ${action.probabilityDistribution?.errorFactor}`,
        )).toBeInTheDocument();
        expect(within(hepRow as HTMLElement).getByText(
          action.humanReliabilityAnalysisRef,
        )).toBeInTheDocument();
      }

      expect(hra.seismicInfluenceIntegration).toContain(
        "receives no success credit",
      );
      expect(hra.humanActions.filter((action) =>
        action.recoveryAction)).toHaveLength(2);
    },
  );

  it("uses reactor-specific actions and conditions", () => {
    const htgr = createSeismicPraExample("htgr")
      .seismicPlantResponseAnalysis.humanReliabilityModel;
    const sfr = createSeismicPraExample("sfr")
      .seismicPlantResponseAnalysis.humanReliabilityModel;

    expect(htgr.humanActions.some((action) =>
      action.name.includes("module"))).toBe(true);
    expect(htgr.humanActions.some((action) =>
      action.name.includes("RCCS"))).toBe(true);
    expect(sfr.humanActions.some((action) =>
      action.name.includes("sodium"))).toBe(true);
    expect(sfr.humanActions.some((action) =>
      action.name.includes("scram"))).toBe(true);
  });

  it("keeps section help behind a question mark and entry detail beside its name", async () => {
    const mef = renderHumanResponse();
    const sectionHelp =
      "Earthquake damage can change what operators see, how they diagnose the event, how much work and stress they face, whether communications and job aids remain available, and whether a field route is safe. This section confirms that those conditions were evaluated for every credited action.";
    const action =
      mef.seismicPlantResponseAnalysis.humanReliabilityModel.humanActions[0]!;

    expect(screen.queryByText(sectionHelp)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", {
      name: "About Seismic performance conditions",
    }));
    expect(screen.getByText(sectionHelp)).toBeInTheDocument();

    expect(screen.queryByText(
      action.seismicSpecificChallenges.trainingAndProcedures,
    )).not.toBeInTheDocument();
    const detailButton = screen.getByRole("button", {
      name: `Seismic performance conditions for ${action.name}`,
    });
    expect(detailButton.closest(".sentryname")?.querySelector("strong"))
      .toHaveTextContent(action.name);
    await userEvent.click(detailButton);
    expect(screen.getByText(
      action.seismicSpecificChallenges.trainingAndProcedures,
      { exact: false },
    )).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps action controls with the HFE register", () => {
    renderHumanResponse();
    const table = screen.getByRole("table", { name: "HFE register" });
    const captionRow = table.parentElement?.querySelector(
      ".stable__caption-row",
    );

    expect(captionRow).not.toBeNull();
    expect(within(captionRow as HTMLElement).getByRole("button", {
      name: "Edit HRA method",
    })).toBeInTheDocument();
    expect(within(captionRow as HTMLElement).getByRole("button", {
      name: "Add human action",
    })).toBeInTheDocument();
  });

  it("opens the method and human-action fields in one flat editor", async () => {
    renderHumanResponse();

    await userEvent.click(screen.getByRole("button", {
      name: "Edit HRA method",
    }));
    const methodDialog = screen.getByRole("dialog", {
      name: "Seismic HRA method",
    });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(methodDialog).getByText(
      "Relevant internal-events HFE references",
    )).toBeInTheDocument();
    expect(within(methodDialog).getByLabelText(
      "Seismic influence integration",
    )).toBeInTheDocument();
    expect(methodDialog.querySelector(".sstructured__navlist")).toBeNull();
    await userEvent.click(within(methodDialog).getByRole("button", {
      name: "Close editor",
    }));

    await userEvent.click(screen.getByRole("button", {
      name: "Add human action",
    }));
    const actionDialog = screen.getByRole("dialog", {
      name: "New seismic human action",
    });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(actionDialog).getByLabelText("HEP"))
      .toBeInTheDocument();
    expect(within(actionDialog).getByLabelText("Training and procedures"))
      .toBeInTheDocument();
    expect(within(actionDialog).getByLabelText("Workload and stress"))
      .toBeInTheDocument();
    expect(within(actionDialog).getByLabelText("Timing and accessibility"))
      .toBeInTheDocument();
    expect(within(actionDialog).getByLabelText("Physical hazards"))
      .toBeInTheDocument();
    expect(actionDialog.querySelector(".sstructured__navlist")).toBeNull();
  });
});
