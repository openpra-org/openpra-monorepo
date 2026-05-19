import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Project } from "interfaces-shared-types";
import { ProjectCard } from "../projectCard";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    name: "Sample Project",
    mode: "internal-events",
    modeLabel: "Internal Events",
    ownerUsername: "ada",
    ownerFullName: "Ada Lovelace",
    ownerInitials: "AL",
    ownerTeamId: null,
    ownerTeamName: null,
    collaborators: ["a", "b"],
    status: { POS: "baseline", IE: "baseline", ES: "in-progress" },
    progress: 2 / 11,
    pinned: false,
    state: "active",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const noopHandlers = {
  onOpen: jest.fn(),
  onTogglePin: jest.fn(),
  onRename: jest.fn(),
  onDuplicate: jest.fn(),
  onShare: jest.fn(),
  onMoveToTeam: jest.fn(),
  onMoveToPersonal: jest.fn(),
  onToggleArchive: jest.fn(),
  onDelete: jest.fn(),
};

describe("ProjectCard", () => {
  beforeEach(() => {
    Object.values(noopHandlers).forEach((fn) => fn.mockClear());
  });

  it("renders the project title, mode chip, and collaborator count", () => {
    render(<ProjectCard project={makeProject()} {...noopHandlers} />);
    expect(screen.getByText("Sample Project")).toBeInTheDocument();
    expect(screen.getByText("Internal Events")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows the percentage from project.progress", () => {
    render(<ProjectCard project={makeProject({ progress: 0.5 })} {...noopHandlers} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("renders the Baseline chip when state is 'baseline'", () => {
    render(<ProjectCard project={makeProject({ state: "baseline" })} {...noopHandlers} />);
    expect(screen.getByText("Baseline")).toBeInTheDocument();
  });

  it("renders the Archived chip when state is 'archived'", () => {
    render(<ProjectCard project={makeProject({ state: "archived" })} {...noopHandlers} />);
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("invokes onOpen when the card is clicked", async () => {
    render(<ProjectCard project={makeProject()} {...noopHandlers} />);
    await userEvent.click(screen.getByText("Sample Project"));
    expect(noopHandlers.onOpen).toHaveBeenCalledTimes(1);
  });

  it("renders the team chip when the project is owned by a team", () => {
    render(<ProjectCard project={makeProject({ ownerTeamId: "t-1", ownerTeamName: "Risk Group" })} {...noopHandlers} />);
    expect(screen.getByText("Risk Group")).toBeInTheDocument();
  });
});
