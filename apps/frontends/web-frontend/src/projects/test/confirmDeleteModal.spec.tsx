import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Project } from "interfaces-shared-types";
import { ConfirmDeleteModal } from "../confirmDeleteModal";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    name: "Unit 2 Internal Events",
    mode: "internal-events",
    modeLabel: "Internal Events",
    ownerUsername: "ada",
    ownerFullName: "Ada Lovelace",
    ownerInitials: "AL",
    ownerTeamId: null,
    ownerTeamName: null,
    collaborators: [],
    status: { POS: "baseline" },
    progress: 0,
    pinned: false,
    state: "active",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ConfirmDeleteModal", () => {
  it("renders the project name in the title", () => {
    render(
      <ConfirmDeleteModal
        project={makeProject({ name: "Plant Alpha PRA" })}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        pending={false}
      />,
    );
    expect(screen.getByRole("heading", { name: /delete "plant alpha pra"\?/i })).toBeInTheDocument();
  });

  it("invokes onConfirm when the danger button is clicked", async () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmDeleteModal
        project={makeProject()}
        onCancel={() => undefined}
        onConfirm={onConfirm}
        pending={false}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /delete project/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape when not pending", async () => {
    const onCancel = jest.fn();
    render(
      <ConfirmDeleteModal
        project={makeProject()}
        onCancel={onCancel}
        onConfirm={() => undefined}
        pending={false}
      />,
    );
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables Cancel + Delete while pending and shows 'Deleting…'", () => {
    render(
      <ConfirmDeleteModal
        project={makeProject()}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        pending
      />,
    );
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /deleting/i })).toBeDisabled();
  });
});
