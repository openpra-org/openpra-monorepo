import { signIn, completeTwoFactor, signUp, forgotPassword, resetPassword } from "../authApi";
import { getToken } from "../authStorage";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("authApi", () => {
  const fetchMock = jest.fn();

  beforeAll(() => {
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, writable: true });
  });

  beforeEach(() => {
    fetchMock.mockReset();
    localStorage.clear();
  });

  describe("signIn", () => {
    it("posts identifier/password to /api/auth/login and stores the token", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { token: "jwt.abc" }));

      const res = await signIn({ identifier: "ada", password: "secret123" });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/auth/login");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({ identifier: "ada", password: "secret123" });
      expect(res.token).toBe("jwt.abc");
      expect(getToken()).toBe("jwt.abc");
    });

    it("throws with the server message when the response is not ok", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: "Invalid credentials" }));
      await expect(signIn({ identifier: "ada", password: "wrong" })).rejects.toThrow(/Invalid credentials/);
      expect(getToken()).toBeNull();
    });

    it("returns a 2FA challenge and does NOT store a token when 2FA is required", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { twoFactorRequired: true, challengeToken: "challenge.jwt" }));

      const res = await signIn({ identifier: "ada", password: "secret123" });

      expect(res).toEqual({ twoFactorRequired: true, challengeToken: "challenge.jwt" });
      expect(getToken()).toBeNull();
    });
  });

  describe("completeTwoFactor", () => {
    it("posts the challenge token and code to /api/auth/login/2fa and stores the returned token", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { token: "jwt.final" }));

      const res = await completeTwoFactor({ challengeToken: "challenge.jwt", code: "123456" });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/auth/login/2fa");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({ challengeToken: "challenge.jwt", code: "123456" });
      expect(res.token).toBe("jwt.final");
      expect(getToken()).toBe("jwt.final");
    });

    it("throws with the server message and stores nothing when the code is rejected", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: "Invalid authentication code" }));
      await expect(completeTwoFactor({ challengeToken: "challenge.jwt", code: "000000" })).rejects.toThrow(/Invalid authentication code/);
      expect(getToken()).toBeNull();
    });
  });

  describe("signUp", () => {
    it("posts the signup body to /api/auth/signup and does not auto-sign-in", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: "u1", username: "ada", email: "ada@example.com" }));

      const res = await signUp({
        fullName: "Ada Lovelace",
        email: "ada@example.com",
        organization: "OpenPRA",
        username: "ada",
        password: "hunter2hunter2",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "/api/auth/signup",
        expect.objectContaining({ method: "POST" }),
      );
      const signupBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(signupBody.username).toBe("ada");
      expect(res).toEqual({ id: "u1", username: "ada", email: "ada@example.com" });
      expect(getToken()).toBeNull();
    });

    it("throws with the server message on signup failure", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(409, { message: "Username already taken" }));
      await expect(
        signUp({
          fullName: "x",
          email: "x@x.com",
          organization: "",
          username: "ada",
          password: "longenough",
        }),
      ).rejects.toThrow(/already taken/);
    });
  });

  describe("forgotPassword", () => {
    it("posts identifier to /api/auth/forgot-password and parses the response", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { detail: "If the account exists..." }));
      const res = await forgotPassword({ identifier: "ada@example.com" });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/forgot-password",
        expect.objectContaining({ method: "POST" }),
      );
      expect(res.detail).toMatch(/account exists/);
    });
  });

  describe("resetPassword", () => {
    it("posts token + newPassword to /api/auth/reset-password", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { detail: "Password updated successfully." }));
      const res = await resetPassword({ token: "raw-token", newPassword: "brand-new" });
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body).toEqual({ token: "raw-token", newPassword: "brand-new" });
      expect(res.detail).toMatch(/updated/i);
    });
  });
});
