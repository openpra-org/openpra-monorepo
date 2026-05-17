import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SignUpForm } from "../signUpForm";
import { ToastProvider } from "../../toast/toastProvider";
import { ToastContainer } from "../../toast/toastContainer";
import { RoleContext } from "../../role/roleProvider";
import { DefaultRole } from "../../role/role";

const fetchMock = jest.fn();

function renderForm(onSwitch?: () => void): void {
  render(
    <MemoryRouter>
      <ToastProvider>
        <RoleContext.Provider value={DefaultRole()}>
          <SignUpForm onSwitchToLogin={onSwitch} />
          <ToastContainer />
        </RoleContext.Provider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("SignUpForm", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, writable: true });
  });

  beforeEach(() => {
    fetchMock.mockReset();
    localStorage.clear();
  });

  it("renders all five fields plus username and password hints", () => {
    renderForm();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/organization/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it("shows required error for missing full name", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/^email$/i), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/username/i), "ada");
    await userEvent.type(screen.getByLabelText(/^password$/i), "longenough!");
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    expect(await screen.findByText(/full name is required/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows invalid-email error for malformed email", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText(/^email$/i), "not-an-email");
    await userEvent.type(screen.getByLabelText(/username/i), "ada");
    await userEvent.type(screen.getByLabelText(/^password$/i), "longenough!");
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    expect(await screen.findByText(/invalid email format/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows too-short error for usernames below 3 characters", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText(/^email$/i), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/username/i), "ad");
    await userEvent.type(screen.getByLabelText(/^password$/i), "longenough!");
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    expect(await screen.findByText(/username must be at least 3 characters/i)).toBeInTheDocument();
  });

  it("shows too-short error for passwords below 8 characters", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText(/^email$/i), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/username/i), "ada");
    await userEvent.type(screen.getByLabelText(/^password$/i), "short");
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
  });

  it("submits the signup body when all fields are valid", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ username: "ada", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    const token = `${header}.${body}.sig`;
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "u1", username: "ada", email: "ada@example.com" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token }), { status: 200, headers: { "Content-Type": "application/json" } }),
      );

    renderForm();
    await userEvent.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText(/^email$/i), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/organization/i), "OpenPRA");
    await userEvent.type(screen.getByLabelText(/username/i), "ada");
    await userEvent.type(screen.getByLabelText(/^password$/i), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/signup",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sent).toEqual({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      organization: "OpenPRA",
      username: "ada",
      password: "hunter2hunter2",
    });
  });

  it("surfaces an API rejection as a toast", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Username already taken" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderForm();
    await userEvent.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText(/^email$/i), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/username/i), "ada");
    await userEvent.type(screen.getByLabelText(/^password$/i), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    expect(await screen.findByText(/username already taken/i)).toBeInTheDocument();
  });

  it("invokes onSwitchToLogin when the login link is clicked", async () => {
    const onSwitch = jest.fn();
    renderForm(onSwitch);
    await userEvent.click(screen.getByRole("button", { name: /^log in$/i }));
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });
});
