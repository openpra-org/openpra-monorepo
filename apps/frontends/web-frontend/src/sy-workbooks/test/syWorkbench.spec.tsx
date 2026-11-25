import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { SyWorkbench } from "../syWorkbench";
import type { SyWorkbookData } from "../syWorkbookContext";

const NOW = "2026-10-05T12:00:00.000Z";

const mockContext = {
  editable: true,
  mutateSy: jest.fn(),
  controlledParameters: [],
  runtime: { workbookId: "sy-1", projectId: "project-1", revision: 3, saveStatus: "saved" },
};

jest.mock("../syWorkbookContext", () => ({ useSyWorkbook: () => mockContext }));

jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { username: "analyst" } }) }));

jest.mock("../SyDependencies", () => ({ DependenciesScreen: () => <section aria-label="Dependency tables" /> }));

jest.mock("../SyDependencyMatrix", () => ({ DependencyMatrix: () => <section aria-label="Dependency matrix" /> }));

jest.mock("../SyCommonCause", () => ({ CommonCauseScreen: () => <section aria-label="Common cause groups" /> }));

jest.mock("../../newly-developed-methods/shared/analysisRunHistory", () => ({ AnalysisRunHistory: () => <section aria-label="Analysis history" /> }));

function workbookData(): SyWorkbookData {
  const sy: Partial<SystemsAnalysis> = {
    praScope: "",
    capabilityCategory: "CC-II",
    plantStage: "PRE_OPERATIONAL",
    workflowState: "DRAFT",
    metadata: {
      versionInfo: { version: "1", lastUpdated: NOW, schemaVersion: "0.0.1" },
      analysisDate: NOW,
      analysts: ["analyst"],
      reviewers: [],
      scope: "",
      limitations: [],
      lastModifiedDate: NOW,
      lastModifiedBy: "analyst",
    },
    conformanceMatrix: [],
    internalReviewComments: { comments: [], openCount: 0, resolvedCount: 0 },
    systemDefinitions: [],
    systemLogicModels: [],
    systemBasicEvents: [],
    systemDependencies: [],
    commonCauseFailureGroups: [],
  };
  const data: Partial<SyWorkbookData> = { sy: sy as SystemsAnalysis, nms: [], links: null };
  return data as SyWorkbookData;
}

function stepRegions(step: string): (string | null)[] {
  render(
    <MemoryRouter initialEntries={[`/sy-workbooks/sy-1?step=${step}`]}>
      <SyWorkbench data={workbookData()} persona="preparer" setPersona={jest.fn()} showPersonaPicker={false} headerMeta={{ projectName: "Project", workbookName: "Systems", workbookVersion: "1" }} />
    </MemoryRouter>,
  );
  return within(screen.getByRole("main", { name: "Step content" })).getAllByRole("region").map((region) => region.getAttribute("aria-label"));
}

describe("SY workbench steps", () => {
  it("shows the dependency tables and the dependency matrix in Step 05", () => {
    expect(stepRegions("deps")).toEqual(["Dependency tables", "Dependency matrix"]);
    expect(screen.getByRole("heading", { level: 1, name: "Dependencies" })).toBeInTheDocument();
  });

  it("keeps the saved runs under the common cause step", () => {
    expect(stepRegions("ccf")).toEqual(["Common cause groups", "Analysis history"]);
  });
});
