import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Team } from "interfaces-shared-types";
import { EditTeamModal } from "../editTeamModal";

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: "t1",
    name: "Original Team",
    organization: "OpenPRA",
    description: "First team",
    visibility: "private",
    adminUsername: "ada",
    memberCount: 1,
    role: "admin",
    avatarUrl: null,
    ...overrides,
  };
}

describe("EditTeamModal", () => {
  it("pre-fills inputs with team values", () => {
    render(
      <EditTeamModal team={makeTeam()} onCancel={() => undefined} onSubmit={() => undefined} pending={false} />,
    );
    expect((screen.getByLabelText(/team name/i) as HTMLInputElement).value).toBe("Original Team");
    expect((screen.getByLabelText(/organization/i) as HTMLInputElement).value).toBe("OpenPRA");
    expect((screen.getByLabelText(/private/i) as HTMLInputElement).checked).toBe(true);
  });

  it("submits only the changed fields", async () => {
    const onSubmit = jest.fn();
    render(
      <EditTeamModal team={makeTeam()} onCancel={() => undefined} onSubmit={onSubmit} pending={false} />,
    );
    const name = screen.getByLabelText(/team name/i);
    await userEvent.clear(name);
    await userEvent.type(name, "Renamed Team");
    await userEvent.click(screen.getByLabelText(/public/i));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toEqual({ name: "Renamed Team", visibility: "public" });
  });

  it("closes via cancel without calling onSubmit when nothing changed", async () => {
    const onSubmit = jest.fn();
    const onCancel = jest.fn();
    render(
      <EditTeamModal team={makeTeam()} onCancel={onCancel} onSubmit={onSubmit} pending={false} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
