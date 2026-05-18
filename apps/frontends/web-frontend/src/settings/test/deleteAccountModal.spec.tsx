import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteAccountModal } from "../deleteAccountModal";

describe("DeleteAccountModal", () => {
  it("keeps the Delete button disabled until DELETE is typed AND password is filled", async () => {
    const onConfirm = jest.fn();
    render(<DeleteAccountModal onCancel={() => undefined} onConfirm={onConfirm} pending={false} />);
    const confirmInput = screen.getByLabelText(/type delete to confirm/i);
    const pwInput = screen.getByLabelText(/current password/i);
    const danger = screen.getByRole("button", { name: /delete my account/i });

    expect(danger).toBeDisabled();
    await userEvent.type(confirmInput, "DELETE");
    expect(danger).toBeDisabled();
    await userEvent.type(pwInput, "hunter2hunter2");
    expect(danger).toBeEnabled();
  });

  it("calls onConfirm with the password when submitted", async () => {
    const onConfirm = jest.fn();
    render(<DeleteAccountModal onCancel={() => undefined} onConfirm={onConfirm} pending={false} />);
    await userEvent.type(screen.getByLabelText(/type delete to confirm/i), "DELETE");
    await userEvent.type(screen.getByLabelText(/current password/i), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: /delete my account/i }));
    expect(onConfirm).toHaveBeenCalledWith("hunter2hunter2");
  });

  it("does not enable the button when confirm text is different case", async () => {
    render(<DeleteAccountModal onCancel={() => undefined} onConfirm={() => undefined} pending={false} />);
    await userEvent.type(screen.getByLabelText(/type delete to confirm/i), "delete");
    await userEvent.type(screen.getByLabelText(/current password/i), "hunter2hunter2");
    expect(screen.getByRole("button", { name: /delete my account/i })).toBeDisabled();
  });
});
