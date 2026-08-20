import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateTeamModal } from "../createTeamModal";

describe("CreateTeamModal", () => {
  it("defaults the visibility radio to 'private'", () => {
    render(<CreateTeamModal onCancel={() => undefined} onSubmit={() => undefined} pending={false} />);
    const priv = screen.getByLabelText(/private/i) as HTMLInputElement;
    expect(priv.checked).toBe(true);
  });

  it("rejects names shorter than 3 characters", async () => {
    const onSubmit = jest.fn();
    render(<CreateTeamModal onCancel={() => undefined} onSubmit={onSubmit} pending={false} />);
    await userEvent.type(screen.getByLabelText(/team name/i), "ab");
    await userEvent.click(screen.getByRole("button", { name: /create team/i }));
    expect(await screen.findByText(/must be at least 3 characters/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits with the visibility the user selected", async () => {
    const onSubmit = jest.fn();
    render(<CreateTeamModal onCancel={() => undefined} onSubmit={onSubmit} pending={false} />);
    await userEvent.type(screen.getByLabelText(/team name/i), "Risk Research Group");
    await userEvent.click(screen.getByLabelText(/public/i));
    await userEvent.click(screen.getByRole("button", { name: /create team/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as Record<string, string>;
    expect(payload.name).toBe("Risk Research Group");
    expect(payload.visibility).toBe("public");
  });
});
