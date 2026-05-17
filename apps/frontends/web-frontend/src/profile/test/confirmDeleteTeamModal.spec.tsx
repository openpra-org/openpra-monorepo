import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Team } from "interfaces-shared-types";
import { ConfirmDeleteTeamModal } from "../confirmDeleteTeamModal";

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: "t-del",
    name: "Team Alpha",
    organization: "OpenPRA",
    description: "",
    visibility: "public",
    adminUsername: "ada",
    memberCount: 5,
    role: "admin",
    ...overrides,
  };
}

describe("ConfirmDeleteTeamModal", () => {
  it("renders the team name and member count in the body", () => {
    render(
      <ConfirmDeleteTeamModal
        team={makeTeam()}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        pending={false}
      />,
    );
    expect(screen.getByRole("heading", { name: /delete "team alpha"\?/i })).toBeInTheDocument();
    expect(screen.getByText(/all 5 members will lose access/i)).toBeInTheDocument();
  });

  it("invokes onConfirm when the danger button is clicked", async () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmDeleteTeamModal
        team={makeTeam()}
        onCancel={() => undefined}
        onConfirm={onConfirm}
        pending={false}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /delete team/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while pending", () => {
    render(
      <ConfirmDeleteTeamModal
        team={makeTeam()}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        pending
      />,
    );
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /deleting/i })).toBeDisabled();
  });
});
