import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Team } from "interfaces-shared-types";
import { TeamsSection } from "../teamsSection";

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: "t1",
    name: "Risk & Reliability Research Group",
    organization: "NC State",
    description: "",
    visibility: "public",
    adminUsername: "chen",
    memberCount: 7,
    role: "member",
    ...overrides,
  };
}

describe("TeamsSection", () => {
  it("renders the empty state with two CTAs when teams is empty", () => {
    const onJoin = jest.fn();
    const onCreate = jest.fn();
    render(<TeamsSection teams={[]} onJoin={onJoin} onCreate={onCreate} onLeave={() => undefined} />);
    expect(screen.getByRole("heading", { name: /you're not on any teams yet/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /browse teams/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create a team/i })).toBeInTheDocument();
  });

  it("does not render the Leave button for an admin team", () => {
    render(
      <TeamsSection
        teams={[makeTeam({ role: "admin", adminUsername: "ada" })]}
        onJoin={() => undefined}
        onCreate={() => undefined}
        onLeave={() => undefined}
      />,
    );
    expect(screen.queryByRole("button", { name: /leave/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Admin/)).toBeInTheDocument();
  });

  it("labels the action 'Cancel' for pending memberships", () => {
    render(
      <TeamsSection
        teams={[makeTeam({ role: "pending", visibility: "private" })]}
        onJoin={() => undefined}
        onCreate={() => undefined}
        onLeave={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("invokes onLeave with the team when the leave button is clicked", async () => {
    const team = makeTeam({ role: "member" });
    const onLeave = jest.fn();
    render(<TeamsSection teams={[team]} onJoin={() => undefined} onCreate={() => undefined} onLeave={onLeave} />);
    await userEvent.click(screen.getByRole("button", { name: /leave/i }));
    expect(onLeave).toHaveBeenCalledWith(team);
  });
});
