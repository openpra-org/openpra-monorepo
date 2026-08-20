import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForgotPassword } from "../forgotPassword";

const fetchMock = jest.fn();

describe("ForgotPassword modal", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, writable: true });
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("shows the username/email field and submit button initially", () => {
    render(<ForgotPassword onClose={() => undefined} />);
    expect(screen.getByLabelText(/username \/ email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
  });

  it("blocks submit and shows error when identifier is empty", async () => {
    render(<ForgotPassword onClose={() => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(await screen.findByText(/username or email is required/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs the identifier and switches to the success state", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "If the account exists, a reset link has been sent." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<ForgotPassword onClose={() => undefined} />);
    await userEvent.type(screen.getByLabelText(/username \/ email/i), "ada@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/forgot-password",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
    expect(screen.getByText(/ada@example.com/)).toBeInTheDocument();
  });

  it("invokes onClose when the back button on the success card is clicked", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const onClose = jest.fn();
    render(<ForgotPassword onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/username \/ email/i), "ada@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    await screen.findByText(/check your inbox/i);
    await userEvent.click(screen.getByRole("button", { name: /back to login/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when the initial back link is clicked", async () => {
    const onClose = jest.fn();
    render(<ForgotPassword onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /back to login/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
