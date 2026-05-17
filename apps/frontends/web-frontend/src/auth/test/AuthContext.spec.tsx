import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "../AuthContext";

const fetchMock = jest.fn();

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

function Harness(): JSX.Element {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="user">{user ? JSON.stringify(user) : "anon"}</div>
      <button onClick={() => { void login({ identifier: "ada", password: "p" }); }}>do-login</button>
      <button onClick={() => { logout(); }}>do-logout</button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, writable: true });
  });

  beforeEach(() => {
    fetchMock.mockReset();
    localStorage.clear();
  });

  it("starts with user=null when no token is stored", () => {
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    expect(screen.getByTestId("user").textContent).toBe("anon");
  });

  it("hydrates user from a valid stored token on mount", () => {
    const token = makeJwt({
      username: "ada",
      email: "ada@example.com",
      roles: ["member-role"],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    localStorage.setItem("id_token", token);

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    const data = JSON.parse(screen.getByTestId("user").textContent ?? "{}");
    expect(data.username).toBe("ada");
    expect(data.email).toBe("ada@example.com");
  });

  it("calls signIn, stores token, and decodes user on login()", async () => {
    const token = makeJwt({
      username: "ada",
      email: "ada@example.com",
      roles: ["member-role"],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ token }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await userEvent.click(screen.getByText("do-login"));
    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toContain("ada");
    });
    expect(localStorage.getItem("id_token")).toBe(token);
  });

  it("clears the user and token on logout()", async () => {
    const token = makeJwt({
      username: "ada",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    localStorage.setItem("id_token", token);

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    expect(screen.getByTestId("user").textContent).toContain("ada");

    await act(async () => {
      await userEvent.click(screen.getByText("do-logout"));
    });

    expect(screen.getByTestId("user").textContent).toBe("anon");
    expect(localStorage.getItem("id_token")).toBeNull();
  });
});
