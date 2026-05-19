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

function renderSection(teams: Team[], handlers: Partial<{
  onJoin: () => void;
  onCreate: () => void;
  onLeave: (team: Team) => void;
  onTeamUpdated: (team: Team) => void;
  onEdit: (team: Team) => void;
  onDelete: (team: Team) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}> = {}) {
  return render(
    <TeamsSection
      teams={teams}
      onJoin={handlers.onJoin ?? (() => undefined)}
      onCreate={handlers.onCreate ?? (() => undefined)}
      onLeave={handlers.onLeave ?? (() => undefined)}
      onTeamUpdated={handlers.onTeamUpdated ?? (() => undefined)}
      onEdit={handlers.onEdit ?? (() => undefined)}
      onDelete={handlers.onDelete ?? (() => undefined)}
      onError={handlers.onError ?? (() => undefined)}
      onSuccess={handlers.onSuccess ?? (() => undefined)}
    />,
  );
}

describe("TeamsSection", () => {
  it("renders the empty state with two CTAs when teams is empty", () => {
    renderSection([]);
    expect(screen.getByRole("heading", { name: /you're not on any teams yet/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /browse teams/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create a team/i })).toBeInTheDocument();
  });

  it("renders a Manage toggle for an admin team instead of a Leave button", () => {
    renderSection([makeTeam({ role: "admin", adminUsername: "ada" })]);
    expect(screen.queryByRole("button", { name: /^leave$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manage/i })).toBeInTheDocument();
    expect(screen.getByText(/Admin/)).toBeInTheDocument();
  });

  it("renders no row-level action for an invited membership (invitations are accepted from the Invitations section)", () => {
    renderSection([makeTeam({ role: "invited", visibility: "private" })]);
    expect(screen.queryByRole("button", { name: /^leave$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /manage/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Invited/)).toBeInTheDocument();
  });

  it("invokes onLeave with the team when the leave button is clicked", async () => {
    const team = makeTeam({ role: "member" });
    const onLeave = jest.fn();
    renderSection([team], { onLeave });
    await userEvent.click(screen.getByRole("button", { name: /leave/i }));
    expect(onLeave).toHaveBeenCalledWith(team);
  });
});
