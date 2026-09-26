import { render, screen, within } from "@testing-library/react";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { SySystemDescription } from "../SySystemDescription";
import type { SyLinkedInputs } from "../syWorkbookContext";

type DescriptionAnalysis = Pick<SystemsAnalysis, "systemDefinitions" | "variableSuccessCriteria" | "exampleDocuments">;

interface MockContext {
  sy: DescriptionAnalysis;
  links: SyLinkedInputs | null;
  editable: boolean;
  mutateSy: jest.Mock;
  runtime: { workbookId: string | null; projectId: string | null; revision: number | null; saveStatus: "saved" };
}

const SYSTEM_ID = "SYS-RPS";

const LINKS: SyLinkedInputs = {
  scName: "",
  posName: "",
  esName: "",
  scSystems: [],
  scMissionTimes: [],
  esSafetyFunctions: [],
  posStates: [
    { id: "POS-01", name: "Full power", mode: "POWER", durationHours: 8000 },
    { id: "POS-03", name: "Hot standby", mode: "STANDBY", durationHours: 200 },
  ],
};

function makeAnalysis(): DescriptionAnalysis {
  return {
    systemDefinitions: [{
      uuid: SYSTEM_ID,
      name: "Reactor protection system",
      abbreviation: "RPS",
      boundaries: ["Flux and process sensors", "Two trip divisions", "Reserve shutdown and rod insertion"],
      successCriteriaIds: [],
      modeledComponentsAndFailures: {},
      informationBasis: "as-designed-as-intended",
      applicablePlantOperatingStates: ["POS-01", "POS-03", "POS-09"],
      operatingProcedures: ["Reactor trip response procedure", "Reserve shutdown actuation procedure"],
      operatingLimitations: ["One trip division may be bypassed for no more than 6 hours for testing."],
      alignments: [{
        uuid: "align-a",
        name: "Both divisions in service",
        description: "Either division trips the reactor.",
        systemReference: SYSTEM_ID,
        isNormalAlignment: true,
        modeled: true,
        implementsSrs: [],
      }],
      implementsSrs: [],
    }],
    variableSuccessCriteria: [],
  };
}

let mockContext: MockContext;

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => mockContext,
}));

function renderDescription(): void {
  mockContext = { sy: makeAnalysis(), links: LINKS, editable: true, mutateSy: jest.fn(), runtime: { workbookId: "sy-1", projectId: "project-1", revision: 2, saveStatus: "saved" } };
  render(<SySystemDescription systemId={SYSTEM_ID} openDrawer={jest.fn()} />);
}

function rowOf(table: HTMLElement, label: string): HTMLElement {
  return within(table).getByRole("rowheader", { name: label }).closest("tr")!;
}

describe("SY system description", () => {
  it("shows several entries as bullets and a single entry as plain text", () => {
    renderDescription();

    const boundary = screen.getByRole("table", { name: "Boundary" });
    expect(within(boundary).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Flux and process sensors", "Two trip divisions", "Reserve shutdown and rod insertion"]);
    const operation = screen.getByRole("table", { name: "Operation and maintenance" });
    expect(within(rowOf(operation, "Operating procedures")).getAllByRole("listitem")).toHaveLength(2);
    const limits = rowOf(operation, "Operating limits");
    expect(within(limits).queryByRole("list")).not.toBeInTheDocument();
    expect(within(limits).getByText("One trip division may be bypassed for no more than 6 hours for testing.")).toBeInTheDocument();
  });

  it("keeps alignment content out of the label column", () => {
    renderDescription();

    const alignments = screen.getByRole("table", { name: "Alignments" });
    expect(within(alignments).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Alignment", "Description", "Status", ""]);
    expect(within(alignments).queryAllByRole("rowheader")).toHaveLength(0);
    expect(within(alignments).getByRole("cell", { name: "Either division trips the reactor." })).toBeInTheDocument();
  });

  it("names the operating states on one line", () => {
    renderDescription();

    const states = screen.getByRole("table", { name: "Operating states" });
    expect(within(states).getByRole("cell", { name: "Full power (POS-01), Hot standby (POS-03), POS-09" })).toBeInTheDocument();
  });
});
