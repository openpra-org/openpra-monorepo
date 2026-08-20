import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangePasswordModal } from "../changePasswordModal";

describe("ChangePasswordModal", () => {
  it("rejects mismatched new and confirm password", async () => {
    const onSubmit = jest.fn();
    render(<ChangePasswordModal onCancel={() => undefined} onSubmit={onSubmit} pending={false} />);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText(/current password/i));
    });
    await userEvent.type(screen.getByLabelText(/current password/i), "currentpw");
    await userEvent.type(screen.getByLabelText(/^new password$/i), "longenough1");
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "different-one");
    await userEvent.click(screen.getByRole("button", { name: /change password/i }));
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the trimmed request when fields are valid", async () => {
    const onSubmit = jest.fn();
    render(<ChangePasswordModal onCancel={() => undefined} onSubmit={onSubmit} pending={false} />);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText(/current password/i));
    });
    await userEvent.type(screen.getByLabelText(/current password/i), "currentpw");
    await userEvent.type(screen.getByLabelText(/^new password$/i), "brand-new-strong");
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "brand-new-strong");
    await userEvent.click(screen.getByRole("button", { name: /change password/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      currentPassword: "currentpw",
      newPassword: "brand-new-strong",
    });
  });

  it("toggles password visibility with the Show / Hide button", async () => {
    render(<ChangePasswordModal onCancel={() => undefined} onSubmit={() => undefined} pending={false} />);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText(/current password/i));
    });
    const newPw = screen.getByLabelText(/^new password$/i) as HTMLInputElement;
    expect(newPw.type).toBe("password");
    await userEvent.click(screen.getByRole("button", { name: /show passwords/i }));
    expect(newPw.type).toBe("text");
    await userEvent.click(screen.getByRole("button", { name: /hide passwords/i }));
    expect(newPw.type).toBe("password");
  });
});
