import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationsSection } from "../notificationsSection";

describe("NotificationsSection", () => {
  const prefs = { projectShared: true, teamInvite: false, runFinished: true, quantErrors: true };

  it("renders one toggle per event type with the correct checked state", () => {
    render(<NotificationsSection prefs={prefs} onToggle={() => undefined} />);
    expect(screen.getByRole("switch", { name: /project shared with me/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /team invite/i })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: /model run finished/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /quantification errors/i })).toHaveAttribute("aria-checked", "true");
  });

  it("invokes onToggle with the event key and next value", async () => {
    const onToggle = jest.fn();
    render(<NotificationsSection prefs={prefs} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("switch", { name: /team invite/i }));
    expect(onToggle).toHaveBeenCalledWith("teamInvite", true);
  });
});
