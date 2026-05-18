import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toggle } from "../toggle";

describe("Toggle", () => {
  it("renders a switch with the given checked state", () => {
    render(<Toggle checked label="Notify me" onChange={() => undefined} />);
    expect(screen.getByRole("switch", { name: /notify me/i })).toHaveAttribute("aria-checked", "true");
  });

  it("toggles to false when clicked while on", async () => {
    const onChange = jest.fn();
    render(<Toggle checked label="Notify me" onChange={onChange} />);
    await userEvent.click(screen.getByRole("switch", { name: /notify me/i }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("toggles to true when clicked while off", async () => {
    const onChange = jest.fn();
    render(<Toggle checked={false} label="Notify me" onChange={onChange} />);
    await userEvent.click(screen.getByRole("switch", { name: /notify me/i }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not fire onChange when disabled", async () => {
    const onChange = jest.fn();
    render(<Toggle checked={false} label="Notify me" onChange={onChange} disabled />);
    await userEvent.click(screen.getByRole("switch", { name: /notify me/i }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
