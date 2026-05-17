import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginForm } from "../loginForm";
import { AuthProvider } from "../AuthContext";
import { ToastProvider } from "../../toast/toastProvider";
import { RoleContext } from "../../role/roleProvider";
import { DefaultRole } from "../../role/role";

const fetchMock = jest.fn();

function renderForm(onSwitch?: () => void): void {
  render(
    <MemoryRouter>
      <ToastProvider>
        <AuthProvider>
          <RoleContext.Provider value={DefaultRole()}>
            <LoginForm onSwitchToSignup={onSwitch} />
          </RoleContext.Provider>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("LoginForm", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, writable: true });
  });

  beforeEach(() => {
    fetchMock.mockReset();
    localStorage.clear();
  });

  it("renders identifier + password fields with the expected labels", () => {
    renderForm();
    expect(screen.getByLabelText(/username \/ email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("shows Zod-driven errors when submitting an empty form", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText(/username or email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("toggles the password between hidden and visible", async () => {
    renderForm();
    const pw = screen.getByLabelText(/^password$/i) as HTMLInputElement;
    expect(pw.type).toBe("password");
    await userEvent.click(screen.getByRole("button", { name: /show/i }));
    expect(pw.type).toBe("text");
    await userEvent.click(screen.getByRole("button", { name: /hide/i }));
    expect(pw.type).toBe("password");
  });

  it("calls fetch with the login body when both fields are filled and submits", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ username: "ada", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    const token = `${header}.${body}.sig`;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ token }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    renderForm();
    await userEvent.type(screen.getByLabelText(/username \/ email/i), "ada");
    await userEvent.type(screen.getByLabelText(/^password$/i), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sentBody).toEqual({ identifier: "ada", password: "hunter2hunter2" });
  });

  it("shows 'Invalid username or password' when the API rejects", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderForm();
    await userEvent.type(screen.getByLabelText(/username \/ email/i), "ada");
    await userEvent.type(screen.getByLabelText(/^password$/i), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText(/invalid username or password/i)).toBeInTheDocument();
  });

  it("invokes onSwitchToSignup when the signup link is clicked", async () => {
    const onSwitch = jest.fn();
    renderForm(onSwitch);
    await userEvent.click(screen.getByRole("button", { name: /sign up for access/i }));
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it("opens the forgot-password modal when 'Forgot password?' is clicked", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: /forgot password/i }));
    expect(await screen.findByText(/reset your password/i)).toBeInTheDocument();
  });
});
