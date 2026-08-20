import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ResetPasswordPage } from "../resetPassword";

const fetchMock = jest.fn();

function renderAt(url: string): void {
  render(
    <MemoryRouter initialEntries={[url]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

describe("ResetPasswordPage", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, writable: true });
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("shows 'invalid or missing reset token' and disables submit when no token is present", () => {
    renderAt("/reset-password");
    expect(screen.getByText(/invalid or missing reset token/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /update password/i })).toBeDisabled();
  });

  it("shows the new-password field and hint with a valid token", () => {
    renderAt(`/reset-password?token=${"a".repeat(64)}`);
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it("blocks submit and shows error when the new password is too short", async () => {
    renderAt(`/reset-password?token=${"a".repeat(64)}`);
    await userEvent.type(screen.getByLabelText(/new password/i), "short");
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs token + newPassword and switches to the success state", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Password updated successfully." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const token = "a".repeat(64);
    renderAt(`/reset-password?token=${token}`);
    await userEvent.type(screen.getByLabelText(/new password/i), "brand-new-strong");
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/reset-password",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ token, newPassword: "brand-new-strong" });
    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
  });

  it("surfaces an inline error when the API rejects the reset", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Reset link is invalid or has expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    renderAt(`/reset-password?token=${"a".repeat(64)}`);
    await userEvent.type(screen.getByLabelText(/new password/i), "brand-new-strong");
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
  });
});
