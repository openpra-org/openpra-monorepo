import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteAccountModal } from "../deleteAccountModal";

const setup = () => userEvent.setup({ delay: null });

describe("DeleteAccountModal", () => {
  it("keeps the Delete button disabled until DELETE is typed AND password is filled", async () => {
    const user = setup();
    const onConfirm = jest.fn();
    render(<DeleteAccountModal onCancel={() => undefined} onConfirm={onConfirm} pending={false} hasPassword />);
    const confirmInput = screen.getByLabelText(/type delete to confirm/i);
    const pwInput = screen.getByLabelText(/current password/i);
    const danger = screen.getByRole("button", { name: /delete my account/i });

    expect(danger).toBeDisabled();
    await user.type(confirmInput, "DELETE");
    expect(danger).toBeDisabled();
    await user.type(pwInput, "hunter2hunter2");
    expect(danger).toBeEnabled();
  });

  it("calls onConfirm with the password when submitted", async () => {
    const user = setup();
    const onConfirm = jest.fn();
    render(<DeleteAccountModal onCancel={() => undefined} onConfirm={onConfirm} pending={false} hasPassword />);
    await user.type(screen.getByLabelText(/type delete to confirm/i), "DELETE");
    await user.type(screen.getByLabelText(/current password/i), "hunter2hunter2");
    await user.click(screen.getByRole("button", { name: /delete my account/i }));
    expect(onConfirm).toHaveBeenCalledWith("hunter2hunter2");
  });

  it("does not enable the button when confirm text is different case", async () => {
    const user = setup();
    render(<DeleteAccountModal onCancel={() => undefined} onConfirm={() => undefined} pending={false} hasPassword />);
    await user.type(screen.getByLabelText(/type delete to confirm/i), "delete");
    await user.type(screen.getByLabelText(/current password/i), "hunter2hunter2");
    expect(screen.getByRole("button", { name: /delete my account/i })).toBeDisabled();
  });

  it("for a provider-only account, needs only DELETE and confirms with no password", async () => {
    const user = setup();
    const onConfirm = jest.fn();
    render(<DeleteAccountModal onCancel={() => undefined} onConfirm={onConfirm} pending={false} hasPassword={false} />);
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument();
    const danger = screen.getByRole("button", { name: /delete my account/i });
    expect(danger).toBeDisabled();
    await user.type(screen.getByLabelText(/type delete to confirm/i), "DELETE");
    expect(danger).toBeEnabled();
    await user.click(danger);
    expect(onConfirm).toHaveBeenCalledWith("");
  });
});
