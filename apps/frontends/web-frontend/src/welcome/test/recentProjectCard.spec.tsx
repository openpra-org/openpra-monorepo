import { render, screen } from "@testing-library/react";
import { type Project } from "interfaces-shared-types";
import { RecentProjectCard } from "../recentProjectCard";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    name: "Unit 2 — Internal Events Baseline",
    mode: "internal-events",
    modeLabel: "Internal Events",
    ownerUsername: "ada",
    ownerFullName: "Ada Lovelace",
    ownerInitials: "AL",
    myRole: "owner",
    sharedTeams: [],
    sharedUsers: [
      { username: "b", fullName: "Bob", role: "viewer" },
      { username: "c", fullName: "Cara", role: "editor" },
      { username: "d", fullName: "Dan", role: "viewer" },
    ],
    pinned: false,
    state: "active",
    pageLayout: "modern",
    version: 1,
    status: {
      POS: "baseline", IE: "baseline", ES: "baseline",
      SC: "in-progress", SY: "in-progress",
      HRA: "not-started", DA: "not-started", ESQ: "not-started",
      MS: "not-started", RC: "not-started", RI: "not-started",
    },
    progress: 3 / 11,
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe("RecentProjectCard", () => {
  it("renders the title, mode chip, and progress percentage", () => {
    render(<RecentProjectCard project={makeProject()} onContinue={() => undefined} onViewAll={() => undefined} />);
    expect(screen.getByText("Unit 2 — Internal Events Baseline")).toBeInTheDocument();
    expect(screen.getByText("Internal Events")).toBeInTheDocument();
    expect(screen.getByText(`${Math.round((3 / 11) * 100)}%`)).toBeInTheDocument();
    expect(screen.getByText(/3 collaborators/i)).toBeInTheDocument();
  });

  it("invokes onContinue when the primary action is clicked", () => {
    const onContinue = jest.fn();
    render(<RecentProjectCard project={makeProject()} onContinue={onContinue} onViewAll={() => undefined} />);
    screen.getByRole("button", { name: /continue analysis/i }).click();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("renders one element pill (code only) for each technical element in the mode", () => {
    render(<RecentProjectCard project={makeProject()} onContinue={() => undefined} onViewAll={() => undefined} />);
    expect(screen.getByText("POS")).toBeInTheDocument();
    expect(screen.getByText("IE")).toBeInTheDocument();
    expect(screen.getByText("ESQ")).toBeInTheDocument();
    expect(screen.getByText("RI")).toBeInTheDocument();
  });
});
