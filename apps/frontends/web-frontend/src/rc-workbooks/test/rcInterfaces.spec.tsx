import { fireEvent, render, screen } from "@testing-library/react";
import { RcInterfaces } from "../rcScreens";
import { RcWorkbookProvider, type RcWorkbookData } from "../rcWorkbookContext";
import type { EventSequenceFamilySource, ReleaseCategorySource } from "../../workbooks/riskWorkbookConnections";

it("shows ES category definitions and leaves consequence results in Quantification", () => {
  const data = {
    rc: {
      releaseCategoryToConsequence: {
        releaseCategoryInputs: [
          { releaseCategory: "RC-1", sourceTermDefinitionRef: "MS source file", releaseCharacteristics: { numberOfPlumes: 8 } },
          { releaseCategory: "RC-2", releaseCharacteristics: {} },
        ],
      },
      scope: { consequenceMetrics: ["Site boundary dose"], metricSelectionApplicationBasis: "Intended application" },
      consequenceQuantification: { eventSequenceConsequences: [{ eventSequenceFamily: "ESF-1", consequenceResults: [] }] },
    },
    cc: {},
    nms: [],
  } as unknown as RcWorkbookData;
  const releaseCategorySources = [{
    workbookId: "es-workbook", workbookName: "ES analysis",
    category: { uuid: "mapping-1", releaseCategoryId: "RC-1", physicalReleaseCharacteristics: ["Early release", "Large magnitude", "Unfiltered"] },
  }] as ReleaseCategorySource[];
  const eventSequenceFamilySources = [{
    workbookId: "es-workbook", family: { uuid: "family-1", name: "Early bypass", releaseCategoryIds: ["RC-1"] },
  }] as EventSequenceFamilySource[];

  render(<RcWorkbookProvider data={data} editable mutateRc={jest.fn()} releaseCategorySources={releaseCategorySources} eventSequenceFamilySources={eventSequenceFamilySources}>
    <RcInterfaces openDrawer={jest.fn()} />
  </RcWorkbookProvider>);

  fireEvent.click(screen.getByRole("button", { name: /ES Event Sequence Analysis/ }));
  expect(screen.getByRole("columnheader", { name: "Physical release characteristics" })).toBeInTheDocument();
  expect(screen.getByText("Early bypass")).toBeInTheDocument();
  expect(screen.getByText("Early release · Large magnitude · Unfiltered")).toBeInTheDocument();
  expect(screen.getByText("No matching ES category")).toBeInTheDocument();
  expect(screen.queryByText("MS source file")).not.toBeInTheDocument();
  expect(screen.queryByText("Plumes")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /RI Risk Integration/ }));
  expect(screen.getByText("Provides measures · Receives results")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Site boundary dose")).toBeInTheDocument();
  expect(screen.queryByText("Consequence table delivered to Risk Integration")).not.toBeInTheDocument();
  expect(screen.queryByText("No consequence families yet. They are compiled under Quantification.")).not.toBeInTheDocument();
});
