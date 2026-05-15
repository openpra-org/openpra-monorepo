import { AuthService } from "./AuthService";
const base64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const makeToken = (payload: Record<string, unknown>) => `header.${base64(payload)}.sig`;
describe("AuthService", () => {
  beforeAll(() => {
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
    const exp = Math.floor(Date.now() / 1000) + 60;
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
    AuthService.logout();
    expect(AuthService.getRole()).toEqual(["member-role"]);
  });
  it("getTokenTimer returns -1 for invalid tokens", () => {
    expect(AuthService.getTokenTimer(null)).toBe(-1);
    expect(AuthService.getTokenTimer("undefined")).toBe(-1);
  });
  it("getTokenTimer returns seconds remaining when valid", () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    const token = makeToken({ exp });
    expect(AuthService.getTokenTimer(token)).toBeGreaterThan(0);
  });
  it("getProfile returns EMPTY_TOKEN on bad token", () => {
    (global as any).localStorage.setItem("id_token", "bad.token");
    const prof = AuthService.getProfile();
    expect(prof.roles).toEqual(["member"]);
  });
  it("getRole falls back to member when exp missing", () => {
    const token = makeToken({ roles: ["admin-role"] });
    AuthService.setEncodedToken(token);
    expect(AuthService.getRole()).toEqual(["member-role"]);
  });
  it("getRole throws when jwtDecode itself throws", () => {
    const realGet = AuthService.getEncodedToken;
    const bad = "header.bad.sig";
    AuthService.setEncodedToken(bad);
    expect(() => AuthService.getRole()).toThrow("The user is not logged in or token expired");
    (global as any).localStorage.removeItem("id_token");
    (AuthService as any).getEncodedToken = realGet;
  });
  it("set/get/remove token cycle", () => {
    AuthService.setEncodedToken("xyz");
    expect(AuthService.getEncodedToken()).toBe("xyz");
    expect(AuthService.logout()).toBe(true);
    expect(AuthService.getEncodedToken()).toBeNull();
  });
  it("hasTokenExpired returns true when jwtDecode throws", () => {
    expect(AuthService.hasTokenExpired("bad.token" as any)).toBe(true);
  });
  it("getEncodedToken returns null when stored value is 'undefined'", () => {
    (global as any).localStorage.setItem("id_token", "undefined");
    expect(AuthService.getEncodedToken()).toBeNull();
  });
});
