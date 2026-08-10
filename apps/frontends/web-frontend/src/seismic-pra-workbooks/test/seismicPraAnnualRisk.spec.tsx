import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { AnnualRiskQuantificationScreen } from "../seismicPraScreens";
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

function renderAnnualRisk(
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
      <AnnualRiskQuantificationScreen />
    </SeismicPraWorkbookProvider>,
  );
  return mef;
}

describe("Seismic PRA Step 11 annual risk", () => {
  it.each(["htgr", "sfr"] as const)(
    "shows the complete annual-risk workflow for %s",
    (variant) => {
      const mef = renderAnnualRisk(variant);
      const quant = mef.seismicPlantResponseAnalysis.quantification;
      const releaseCategoryCount = new Set(
        quant.eventSequenceFamilyQuantifications.map((family) =>
          family.releaseCategoryRef ?? "UNASSIGNED"),
      ).size;
      const expectedRows = new Map<string, number>([
        ["Event-sequence-family frequencies", 7],
        ["Release-category frequencies", releaseCategoryCount],
        ["Integration mesh", 1],
        ["Hazard intervals", 8],
        ["Convergence runs", 4],
        ["Rare-event corrections", 3],
        ["Model and parameter uncertainty", 8],
        ["Sensitivity studies", 8],
        ["Significant cutsets", 12],
        ["Risk-significant contributors", 13],
      ]);

      for (const heading of [
        "Annual frequency results",
        "Hazard integration",
        "Uncertainty and sensitivity",
        "Cutsets and contributors",
      ]) {
        expect(screen.getByRole("heading", { name: heading }))
          .toBeInTheDocument();
      }

      expect(screen.queryByText("Referenced ESQ checks"))
        .not.toBeInTheDocument();
      expect(screen.queryByText("HLR-SPR-E")).not.toBeInTheDocument();

      for (const [caption, rowCount] of expectedRows) {
        const table = screen.getByRole("table", { name: caption });
        expect(within(table).getAllByRole("row")).toHaveLength(rowCount + 1);
        expect(table).toHaveStyle({ tableLayout: "fixed" });
      }
    },
  );

  it.each(["htgr", "sfr"] as const)(
    "shows aligned family, interval, uncertainty, and cutset results for %s",
    (variant) => {
      const mef = renderAnnualRisk(variant);
      const quant = mef.seismicPlantResponseAnalysis.quantification;
      const familyTable = screen.getByRole("table", {
        name: "Event-sequence-family frequencies",
      });
      const cutsetTable = screen.getByRole("table", {
        name: "Significant cutsets",
      });

      for (const family of quant.eventSequenceFamilyQuantifications) {
        const row = within(familyTable)
          .getByText(family.name, { selector: "strong" })
          .closest("tr");
        expect(row).not.toBeNull();
        expect(row).toHaveTextContent(
          family.pointEstimateFrequency.toExponential(3),
        );
        expect(row).toHaveTextContent(
          (family.meanFrequency ?? family.pointEstimateFrequency)
            .toExponential(3),
        );
        expect(row).toHaveTextContent(
          family.releaseCategoryRef ?? "Unassigned",
        );
      }

      for (const cutset of quant.significantCutsets) {
        const row = within(cutsetTable)
          .getAllByText(cutset.name, { selector: "strong" })[0]!
          .closest("tr");
        expect(row).not.toBeNull();
        expect(row).toHaveTextContent(cutset.meanFrequency.toExponential(3));
        expect(row).toHaveTextContent(
          `${(cutset.contributionFraction * 100).toFixed(1)}%`,
        );
        expect(row).toHaveTextContent("Verified");
      }
    },
  );

  it("uses reactor-specific families and cutsets", () => {
    const htgr = createSeismicPraExample("htgr")
      .seismicPlantResponseAnalysis.quantification;
    const sfr = createSeismicPraExample("sfr")
      .seismicPlantResponseAnalysis.quantification;

    expect(htgr.eventSequenceFamilyQuantifications.some((family) =>
      family.name.includes("multi-module"))).toBe(true);
    expect(sfr.eventSequenceFamilyQuantifications.some((family) =>
      family.name.includes("sodium-boundary"))).toBe(true);
    expect(htgr.significantCutsets.some((cutset) =>
      /RCCS|helium/i.test(cutset.name))).toBe(true);
    expect(sfr.significantCutsets.some((cutset) =>
      /sodium|decay-heat/i.test(cutset.name))).toBe(true);
    expect(new Set(htgr.significantCutsets.flatMap((cutset) =>
      cutset.basicEventRefs)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(sfr.significantCutsets.flatMap((cutset) =>
      cutset.basicEventRefs)).size).toBeGreaterThanOrEqual(10);
  });

  it("uses question marks for sections and exclamation marks for entries", async () => {
    const mef = renderAnnualRisk();
    const family =
      mef.seismicPlantResponseAnalysis.quantification
        .eventSequenceFamilyQuantifications[0]!;

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    const sectionHelp = screen.getByRole("button", {
      name: "About Hazard integration",
    });
    expect(sectionHelp).toHaveClass("sinfo__button--help");
    expect(sectionHelp.querySelector(
      'path[d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"]',
    )).toBeInTheDocument();
    await userEvent.click(sectionHelp);
    expect(screen.getByRole("note")).toHaveTextContent(
      "The hazard curve is divided into non-overlapping ground-motion intervals",
    );
    expect(screen.getByRole("note")).toHaveTextContent("For example");

    expect(screen.queryByText(family.quantificationMethod, { exact: false }))
      .not.toBeInTheDocument();
    const entryDetail = screen.getByRole("button", {
      name: `Calculation basis for ${family.name}`,
    });
    expect(entryDetail).toHaveClass("sinfo__button--entry");
    expect(entryDetail.querySelector(
      'path[d="M12 7v7M12 17h.01"]',
    )).toBeInTheDocument();
    expect(entryDetail.closest(".sentryname")?.querySelector("strong"))
      .toHaveTextContent(family.name);
    await userEvent.click(entryDetail);
    expect(screen.getByText(family.quantificationMethod, { exact: false }))
      .toBeInTheDocument();
  });

  it("keeps method and family controls with the family-results table", () => {
    renderAnnualRisk();
    const table = screen.getByRole("table", {
      name: "Event-sequence-family frequencies",
    });
    const captionRow = table.parentElement?.querySelector(
      ".stable__caption-row",
    );

    expect(captionRow).not.toBeNull();
    expect(within(captionRow as HTMLElement).getByRole("button", {
      name: "Edit method",
    })).toBeInTheDocument();
    expect(within(captionRow as HTMLElement).getByRole("button", {
      name: "Add family result",
    })).toBeInTheDocument();
  });

  it("opens the method, family, cutset, and sensitivity fields in flat editors", async () => {
    renderAnnualRisk();

    await userEvent.click(screen.getByRole("button", {
      name: "Edit method",
    }));
    const methodDialog = screen.getByRole("dialog", {
      name: "Annual-risk quantification method",
    });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(methodDialog).getByLabelText("Result type"))
      .toBeInTheDocument();
    expect(within(methodDialog).getByLabelText(
      "Integrated hazard fragility systems method",
    )).toBeInTheDocument();
    expect(methodDialog.querySelector(".sstructured__navlist")).toBeNull();
    await userEvent.click(within(methodDialog).getByRole("button", {
      name: "Close editor",
    }));

    await userEvent.click(screen.getByRole("button", {
      name: "Add family result",
    }));
    const familyDialog = screen.getByRole("dialog", {
      name: "New family result",
    });
    expect(within(familyDialog).getByLabelText("Mean frequency"))
      .toBeInTheDocument();
    expect(within(familyDialog).getByLabelText("Median"))
      .toBeInTheDocument();
    expect(familyDialog.querySelector(".sstructured__navlist")).toBeNull();
    await userEvent.click(within(familyDialog).getByRole("button", {
      name: "Close editor",
    }));

    await userEvent.click(screen.getByRole("button", {
      name: "Add cutset",
    }));
    const cutsetDialog = screen.getByRole("dialog", {
      name: "New significant cutset",
    });
    expect(within(cutsetDialog).getByLabelText("Mean frequency"))
      .toBeInTheDocument();
    expect(within(cutsetDialog).getByLabelText("Review status"))
      .toBeInTheDocument();
    expect(cutsetDialog.querySelector(".sstructured__navlist")).toBeNull();
    await userEvent.click(within(cutsetDialog).getByRole("button", {
      name: "Close editor",
    }));

    await userEvent.click(screen.getByRole("button", {
      name: "Add sensitivity study",
    }));
    const sensitivityDialog = screen.getByRole("dialog", {
      name: "New sensitivity study",
    });
    expect(within(sensitivityDialog).getByText("Parameter ranges")
      .closest("label")?.querySelector("textarea")).toBeInTheDocument();
    expect(within(sensitivityDialog).getByLabelText("Calculated effect"))
      .toBeInTheDocument();
    expect(sensitivityDialog.querySelector(".sstructured__navlist")).toBeNull();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
});
