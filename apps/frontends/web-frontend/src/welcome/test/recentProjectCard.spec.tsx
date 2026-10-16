import { render, screen } from "@testing-library/react";
import { type Project, elementsForMode } from "interfaces-shared-types";
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
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe("RecentProjectCard", () => {
  it("renders the title, mode chip and collaborator count with no progress bar", () => {
    render(<RecentProjectCard project={makeProject()} onContinue={() => undefined} />);
    expect(screen.getByText("Unit 2 — Internal Events Baseline")).toBeInTheDocument();
    expect(screen.getByText("Internal Events")).toBeInTheDocument();
    expect(screen.getByText(/3 collaborators/i)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("invokes onContinue when the primary action is clicked", () => {
    const onContinue = jest.fn();
    render(<RecentProjectCard project={makeProject()} onContinue={onContinue} />);
    screen.getByRole("button", { name: /continue analysis/i }).click();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("renders no technical element status pills", () => {
    render(<RecentProjectCard project={makeProject()} onContinue={() => undefined} />);
    for (const element of elementsForMode("internal-events")) expect(screen.queryByText(element.code)).not.toBeInTheDocument();
  });
});
