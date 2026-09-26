import { fireEvent, render, screen, within } from "@testing-library/react";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { Workbook } from "interfaces-shared-types";
import { ScopeScreen } from "../SyScope";
import type { SyLinkedInputs, SyUpstream } from "../syWorkbookContext";

const PUMP_SYSTEM = "SYS-CCW";
const NEW_SYSTEM = "SYS-NEW";

function workbook(id: string, name: string, elementCode: string): Workbook {
  return {
    id,
    projectId: "project-1",
    elementCode,
    name,
    status: "in-progress",
    version: 3,
    ownerUsername: "ada",
    ownerFullName: "Ada Analyst",
    ownerInitials: "AA",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
  };
}

function makeAnalysis(overrides: Partial<SystemsAnalysis> = {}): SystemsAnalysis {
  return {
    praScope: "Full-scope systems analysis.",
    plantStage: "PRE_OPERATIONAL",
    systemDefinitions: [
      {
        uuid: PUMP_SYSTEM,
        name: "Component cooling water",
        abbreviation: "CCW",
        description: "Cooling water fails",
        boundaries: [],
        successCriteriaIds: [],
        missionTimeHours: 24,
        modeledComponentsAndFailures: {},
        informationBasis: "as-designed-as-intended",
        implementsSrs: [],
      },
      {
        uuid: NEW_SYSTEM,
        name: "Fire water",
        boundaries: [],
        successCriteriaIds: [],
        missionTimeHours: 24,
        modeledComponentsAndFailures: {},
        informationBasis: "as-designed-as-intended",
        implementsSrs: [],
      },
    ],
    systemToSafetyFunctionMappings: [
      { uuid: `MAP-${PUMP_SYSTEM}`, systemReference: PUMP_SYSTEM, safetyFunctions: ["SF-DHR"], eventSequences: [], implementsSrs: [] },
    ],
    systemLogicModels: [],
    systemBasicEvents: [],
    systemDependencies: [],
    commonCauseFailureGroups: [],
    humanFailureEventIntegrations: [],
    ...overrides,
  } as unknown as SystemsAnalysis;
}

const LINKS: SyLinkedInputs = {
  scName: "",
  posName: "",
  esName: "ES workbook",
  scSystems: [],
  scMissionTimes: [],
  posStates: [],
  esSafetyFunctions: [
    { id: "SF-DHR", name: "Core heat removal", supportingSystems: ["Shutdown cooling system"] },
  ],
};

const UPSTREAM: SyUpstream = {
  options: {
    ES: [workbook("es-1", "ES workbook", "ES")],
    SC: [],
    POS: [workbook("pos-1", "POS workbook", "POS")],
    DA: [workbook("da-1", "DA workbook", "DA")],
    HRA: [],
  },
};

const mockMutateSy = jest.fn();
let mockContext: { sy: SystemsAnalysis; links: SyLinkedInputs | null; editable: boolean; mutateSy: typeof mockMutateSy; upstream: SyUpstream };

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => mockContext,
}));

function renderScope({ sy = makeAnalysis(), links = null, editable = true, openDrawer = jest.fn(), setStage = jest.fn() }: {
  sy?: SystemsAnalysis;
  links?: SyLinkedInputs | null;
  editable?: boolean;
  openDrawer?: jest.Mock;
  setStage?: jest.Mock;
} = {}): void {
  mockContext = { sy, links, editable, mutateSy: mockMutateSy, upstream: UPSTREAM };
  render(<ScopeScreen ccId="cc-ii" setCcId={jest.fn()} stage="pre_operational" setStage={setStage} onAction={jest.fn()} openDrawer={openDrawer} />);
}

function applyLastMutation(base: SystemsAnalysis): SystemsAnalysis {
  const calls = mockMutateSy.mock.calls;
  const mutator = calls[calls.length - 1]![0] as (draft: SystemsAnalysis) => SystemsAnalysis;
  return mutator(base);
}

describe("SY Scope step", () => {
  beforeEach(() => jest.clearAllMocks());

  it("links a source workbook for an upstream element", () => {
    const sy = makeAnalysis();
    renderScope({ sy });

    const source = screen.getByRole("combobox", { name: "Source workbook" });
    expect(source).toHaveValue("");
    fireEvent.change(source, { target: { value: "es-1" } });
    expect(applyLastMutation(sy).linkedWorkbooks).toEqual({ ES: "es-1" });
  });

  it("shows the linked workbook", () => {
    renderScope({ sy: makeAnalysis({ linkedWorkbooks: { ES: "es-1" } }), links: LINKS });

    const linked = screen.getByRole("table", { name: "Linked ES workbook" });
    expect(within(linked).getByText("ES workbook")).toBeInTheDocument();
    expect(within(linked).getByText("Ada Analyst")).toBeInTheDocument();
    expect(screen.getAllByRole("table").map((table) => table.getAttribute("aria-label"))).toEqual(["Linked ES workbook", "Systems in scope"]);
  });

  it("clears a link when Not linked is chosen", () => {
    const sy = makeAnalysis({ linkedWorkbooks: { ES: "es-1", POS: "pos-1" } });
    renderScope({ sy });

    fireEvent.change(screen.getByRole("combobox", { name: "Source workbook" }), { target: { value: "" } });
    expect(applyLastMutation(sy).linkedWorkbooks).toEqual({ POS: "pos-1" });
  });

  it("commits the PRA scope text when the field loses focus", () => {
    const sy = makeAnalysis();
    renderScope({ sy });

    const scope = screen.getByRole("textbox", { name: "PRA scope" });
    fireEvent.focus(scope);
    fireEvent.change(scope, { target: { value: "Pre-operational systems analysis." } });
    fireEvent.blur(scope);
    expect(applyLastMutation(sy).praScope).toBe("Pre-operational systems analysis.");
  });

  it("opens a system's editor from its Edit button", () => {
    const openDrawer = jest.fn();
    renderScope({ openDrawer, links: LINKS });

    const table = screen.getByRole("table", { name: "Systems in scope" });
    expect(within(table).getByText("SF-DHR · Core heat removal")).toBeInTheDocument();
    fireEvent.click(within(table).getByRole("button", { name: "Edit Fire water" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "system", id: NEW_SYSTEM });
  });

  it("adds a system with a 24 hour mission time and opens its editor", () => {
    const sy = makeAnalysis();
    const openDrawer = jest.fn();
    jest.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000010");
    renderScope({ sy, openDrawer });

    fireEvent.click(screen.getByRole("button", { name: "Add system" }));
    expect(applyLastMutation(sy).systemDefinitions).toContainEqual(
      expect.objectContaining({ uuid: "00000000-0000-4000-8000-000000000010", name: "New system", missionTimeHours: 24, informationBasis: "as-designed-as-intended" }),
    );
    expect(openDrawer).toHaveBeenCalledWith({ kind: "system", id: "00000000-0000-4000-8000-000000000010" });
  });

  it("flags a system-level model without a justification", () => {
    renderScope({
      sy: makeAnalysis({
        systemLogicModels: [{
          uuid: "LM-NEW", code: "FT-NEW", name: "Fire water model", systemReference: NEW_SYSTEM, description: "", modelRepresentation: "System-level",
          nonDetailedModelJustification: "", topGate: null, gates: [], leafNodes: [], gateInputs: [], nodePositions: [],
          layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" }, implementsSrs: [],
        }],
      }),
    });

    const table = screen.getByRole("table", { name: "Systems in scope" });
    expect(within(table).getByText("System-level model")).toBeInTheDocument();
    expect(within(table).getByText("Justification required")).toBeInTheDocument();
  });

  it("sets every system's information basis from the plant stage", () => {
    const sy = makeAnalysis();
    const setStage = jest.fn();
    renderScope({ sy, setStage });

    fireEvent.click(screen.getByRole("radio", { name: /Operational/ }));
    const next = applyLastMutation(sy);
    expect(setStage).toHaveBeenCalledWith("operational");
    expect(next.plantStage).toBe("OPERATIONAL");
    expect(next.systemDefinitions.map(({ informationBasis }) => informationBasis)).toEqual(["as-built-as-operated", "as-built-as-operated"]);
  });

  it("hides editing controls from a reviewer", () => {
    renderScope({ editable: false });

    expect(screen.queryByRole("button", { name: "Add system" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Source workbook" })).toBeDisabled();
  });
});
