import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Project } from "interfaces-shared-types";
import { KebabMenu } from "../kebabMenu";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    name: "Sample",
    mode: "internal-events",
    modeLabel: "Internal Events",
    ownerUsername: "ada",
    ownerFullName: "Ada Lovelace",
    ownerInitials: "AL",
    myRole: "owner",
    sharedTeams: [],
    sharedUsers: [],
    status: { POS: "baseline" },
    progress: 0,
    pinned: false,
    state: "active",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function setup(project: Project) {
  const onOpen = jest.fn();
  const onTogglePin = jest.fn();
  const onRename = jest.fn();
  const onDuplicate = jest.fn();
  const onShare = jest.fn();
  const onToggleArchive = jest.fn();
  const onDelete = jest.fn();
  render(
    <KebabMenu
      project={project}
      onOpen={onOpen}
      onTogglePin={onTogglePin}
      onRename={onRename}
      onDuplicate={onDuplicate}
      onShare={onShare}
      onToggleArchive={onToggleArchive}
      onDelete={onDelete}
    />,
  );
  return { onOpen, onTogglePin, onRename, onDuplicate, onShare, onToggleArchive, onDelete };
}

describe("KebabMenu", () => {
  it("is closed by default and opens on click", async () => {
    setup(makeProject());
    expect(screen.queryByRole("menuitem", { name: /rename/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /project actions/i }));
    expect(screen.getByRole("menuitem", { name: /rename/i })).toBeInTheDocument();
  });

  it("labels the pin toggle as 'Pin to top' for unpinned projects", async () => {
    setup(makeProject({ pinned: false }));
    await userEvent.click(screen.getByRole("button", { name: /project actions/i }));
    expect(screen.getByRole("menuitem", { name: /pin to top/i })).toBeInTheDocument();
  });

  it("labels the pin toggle as 'Unpin' for pinned projects", async () => {
    setup(makeProject({ pinned: true }));
    await userEvent.click(screen.getByRole("button", { name: /project actions/i }));
    expect(screen.getByRole("menuitem", { name: /^unpin$/i })).toBeInTheDocument();
  });

  it("labels the archive toggle as 'Restore' for archived projects", async () => {
    setup(makeProject({ state: "archived" }));
    await userEvent.click(screen.getByRole("button", { name: /project actions/i }));
    expect(screen.getByRole("menuitem", { name: /restore/i })).toBeInTheDocument();
  });

  it("invokes onDelete when the danger item is clicked", async () => {
    const handlers = setup(makeProject());
    await userEvent.click(screen.getByRole("button", { name: /project actions/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);
  });

  it("invokes onRename when Rename is clicked", async () => {
    const handlers = setup(makeProject());
    await userEvent.click(screen.getByRole("button", { name: /project actions/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /rename/i }));
    expect(handlers.onRename).toHaveBeenCalledTimes(1);
  });

  it("invokes onShare when the Share item is clicked", async () => {
    const handlers = setup(makeProject());
    await userEvent.click(screen.getByRole("button", { name: /project actions/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /share/i }));
    expect(handlers.onShare).toHaveBeenCalledTimes(1);
  });
});
