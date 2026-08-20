import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SignUpForm } from "../signUpForm";
import { ToastProvider } from "../../toast/toastProvider";
import { ToastContainer } from "../../toast/toastContainer";
import { RoleContext } from "../../role/roleProvider";
import { DefaultRole } from "../../role/role";
import { AuthProvider } from "../AuthContext";

const fetchMock = jest.fn();

type Reply = { url: string; init?: RequestInit };
let fetchCalls: Reply[];

interface Routes {
  signup?: () => Response;
  login?: () => Response;
  availability?: (url: string) => Response;
}

function installRoutes(routes: Routes): void {
  const defaultAvailability = (): Response =>
    new Response(JSON.stringify({ usernameAvailable: true, emailAvailable: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    fetchCalls.push({ url, init });
    if (url.includes("/availability")) {
      return Promise.resolve((routes.availability ?? defaultAvailability)(url));
    }
    if (url.includes("/signup")) {
      if (!routes.signup) return Promise.reject(new Error(`No signup route mocked for ${url}`));
      return Promise.resolve(routes.signup());
    }
    if (url.includes("/login")) {
      if (!routes.login) return Promise.reject(new Error(`No login route mocked for ${url}`));
      return Promise.resolve(routes.login());
    }
    return Promise.reject(new Error(`Unmocked URL: ${url}`));
  });
}

function renderForm(onSwitch?: () => void): void {
  render(
    <MemoryRouter>
      <ToastProvider>
        <AuthProvider>
          <RoleContext.Provider value={DefaultRole()}>
            <SignUpForm onSwitchToLogin={onSwitch} />
            <ToastContainer />
          </RoleContext.Provider>
        </AuthProvider>
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
    fetchCalls = [];
    localStorage.clear();
    installRoutes({});
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
    await userEvent.click(screen.getByRole("button", { name: /^sign up$/i }));
    expect(await screen.findByText(/full name is required/i)).toBeInTheDocument();
    expect(fetchCalls.some((c) => c.url.includes("/signup"))).toBe(false);
  });

  it("shows invalid-email error for malformed email", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText(/^email$/i), "not-an-email");
    await userEvent.type(screen.getByLabelText(/username/i), "ada");
    await userEvent.type(screen.getByLabelText(/^password$/i), "longenough!");
    await userEvent.click(screen.getByRole("button", { name: /^sign up$/i }));
    expect(await screen.findByText(/invalid email format/i)).toBeInTheDocument();
    expect(fetchCalls.some((c) => c.url.includes("/signup"))).toBe(false);
  });

  it("shows too-short error for usernames below 3 characters", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText(/^email$/i), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/username/i), "ad");
    await userEvent.type(screen.getByLabelText(/^password$/i), "longenough!");
    await userEvent.click(screen.getByRole("button", { name: /^sign up$/i }));
    expect(await screen.findByText(/username must be at least 3 characters/i)).toBeInTheDocument();
  });

  it("shows too-short error for passwords below 8 characters", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText(/^email$/i), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/username/i), "ada");
    await userEvent.type(screen.getByLabelText(/^password$/i), "short");
    await userEvent.click(screen.getByRole("button", { name: /^sign up$/i }));
    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
  });

  it("submits the signup body when all fields are valid", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ username: "ada", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    const token = `${header}.${body}.sig`;
    installRoutes({
      signup: () => new Response(JSON.stringify({ id: "u1", username: "ada", email: "ada@example.com" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
      login: () => new Response(JSON.stringify({ token }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    });

    renderForm();
    await userEvent.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText(/^email$/i), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/organization/i), "OpenPRA");
    await userEvent.type(screen.getByLabelText(/username/i), "ada");
    await userEvent.type(screen.getByLabelText(/^password$/i), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: /^sign up$/i }));

    await waitFor(() => {
      expect(fetchCalls.some((c) => c.url.includes("/signup") && c.init?.method === "POST")).toBe(true);
    });
    const signupCall = fetchCalls.find((c) => c.url.includes("/signup"))!;
    const sent = JSON.parse(signupCall.init!.body as string);
    expect(sent).toEqual({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      organization: "OpenPRA",
      username: "ada",
      password: "hunter2hunter2",
    });
  });

  it("surfaces an API rejection as a toast", async () => {
    installRoutes({
      signup: () => new Response(JSON.stringify({ message: "Username already taken" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    });

    renderForm();
    await userEvent.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText(/^email$/i), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/username/i), "ada");
    await userEvent.type(screen.getByLabelText(/^password$/i), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: /^sign up$/i }));

    expect(await screen.findByText(/username already taken/i)).toBeInTheDocument();
  });

  it("invokes onSwitchToLogin when the login link is clicked", async () => {
    const onSwitch = jest.fn();
    renderForm(onSwitch);
    await userEvent.click(screen.getByRole("button", { name: /^log in$/i }));
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it("shows an inline 'Username already taken' error after the debounce fires", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate", "queueMicrotask"] });
    installRoutes({
      availability: (url) => {
        const taken = url.includes("username=taken-name");
        return new Response(JSON.stringify({ usernameAvailable: !taken }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    renderForm();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.type(screen.getByLabelText(/username/i), "taken-name");
    await act(async () => { jest.advanceTimersByTime(500); });
    await waitFor(() => {
      expect(screen.getByText(/username already taken/i)).toBeInTheDocument();
    });
    jest.useRealTimers();
  });

  it("shows an inline 'Email already registered' error after the debounce fires", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate", "queueMicrotask"] });
    installRoutes({
      availability: (url) => {
        const taken = url.includes("email=") && url.includes("taken%40example.com");
        return new Response(JSON.stringify({ emailAvailable: !taken }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    renderForm();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.type(screen.getByLabelText(/^email$/i), "taken@example.com");
    await act(async () => { jest.advanceTimersByTime(500); });
    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument();
    });
    jest.useRealTimers();
  });

  it("does not query availability for usernames shorter than 3 characters", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate", "queueMicrotask"] });
    renderForm();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.type(screen.getByLabelText(/username/i), "ab");
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(fetchCalls.some((c) => c.url.includes("/availability"))).toBe(false);
    jest.useRealTimers();
  });
});
