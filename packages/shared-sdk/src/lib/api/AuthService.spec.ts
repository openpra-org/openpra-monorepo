import { AuthService } from "./AuthService";

// Create a simple JWT-like base64 token utility for tests without signing
const base64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const makeToken = (payload: Record<string, unknown>) => `header.${base64(payload)}.sig`;

describe("AuthService", () => {
  beforeAll(() => {
    // minimal localStorage mock
    const store: Record<string, string> = {};
    Object.defineProperty(global, "localStorage", {
      value: {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => void (store[k] = v),
        removeItem: (k: string) => void delete store[k],
      },
      configurable: true,
    });
  });

  it("returns expired for null/undefined token", () => {
    expect(AuthService.hasTokenExpired(null)).toBe(true);
    expect(AuthService.hasTokenExpired("undefined")).toBe(true);
  });

  it("detects non-expired token", () => {
    const exp = Math.floor(Date.now() / 1000) + 60; // +60s
    const token = makeToken({ exp });
    expect(AuthService.hasTokenExpired(token)).toBe(false);
  });

  it("extracts roles from profile", () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const payload = { exp, roles: ["member-role"] };
    const token = makeToken(payload);
    AuthService.setEncodedToken(token);
    expect(AuthService.getRole()).toEqual(["member-role"]);
  });

  it("returns default member role when no token present", () => {
    // clear
    AuthService.logout();
    expect(AuthService.getRole()).toEqual(["member-role"]);
  });

  it("getTokenTimer returns -1 for invalid tokens", () => {
    expect(AuthService.getTokenTimer(null)).toBe(-1);
    expect(AuthService.getTokenTimer("undefined")).toBe(-1);
  });

  it("getTokenTimer returns seconds remaining when valid", () => {
    const exp = Math.floor(Date.now() / 1000) + 120; // +120s
    const token = makeToken({ exp });
    expect(AuthService.getTokenTimer(token)).toBeGreaterThan(0);
  });

  it("getProfile returns EMPTY_TOKEN on bad token", () => {
    // set an invalid token in storage
    (global as any).localStorage.setItem("id_token", "bad.token");
    const prof = AuthService.getProfile();
    // EMPTY_TOKEN contains default roles
    expect(prof.roles).toEqual(["member"]);
  });

  it("getRole falls back to member when exp missing", () => {
    const token = makeToken({ roles: ["admin-role"] });
    AuthService.setEncodedToken(token);
    // exp missing -> fallback to default member-role per implementation
    expect(AuthService.getRole()).toEqual(["member-role"]);
  });

  it("getRole throws when jwtDecode itself throws", () => {
    // Save original
    const realGet = AuthService.getEncodedToken;
    const bad = "header.bad.sig";
    // store an invalid token causes jwt-decode to throw
    AuthService.setEncodedToken(bad);
    expect(() => AuthService.getRole()).toThrow("The user is not logged in or token expired");
    // clean up
    (global as any).localStorage.removeItem("id_token");
    // restore
    (AuthService as any).getEncodedToken = realGet;
  });

  it("set/get/remove token cycle", () => {
    AuthService.setEncodedToken("xyz");
    expect(AuthService.getEncodedToken()).toBe("xyz");
    expect(AuthService.logout()).toBe(true);
    expect(AuthService.getEncodedToken()).toBeNull();
  });

  it("hasTokenExpired returns true when jwtDecode throws", () => {
    // malformed token should cause decode to throw
    expect(AuthService.hasTokenExpired("bad.token" as any)).toBe(true);
  });

  it("getEncodedToken returns null when stored value is 'undefined'", () => {
    (global as any).localStorage.setItem("id_token", "undefined");
    expect(AuthService.getEncodedToken()).toBeNull();
  });
});
