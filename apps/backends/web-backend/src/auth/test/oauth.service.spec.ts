import { OAuthService } from "../oauth.service";

describe("OAuthService", () => {
  let service: OAuthService;
  const realFetch = global.fetch;

  function clearProviderEnv(): void {
    delete process.env["GOOGLE_CLIENT_ID"];
    delete process.env["GOOGLE_CLIENT_SECRET"];
    delete process.env["GITHUB_CLIENT_ID"];
    delete process.env["GITHUB_CLIENT_SECRET"];
    delete process.env["OAUTH_CALLBACK_BASE"];
  }

  beforeEach(() => {
    service = new OAuthService();
    clearProviderEnv();
  });

  afterEach(() => {
    global.fetch = realFetch;
    clearProviderEnv();
  });

  it("reports google unconfigured without credentials and configured with them", () => {
    expect(service.isConfigured("google")).toBe(false);
    process.env["GOOGLE_CLIENT_ID"] = "id";
    process.env["GOOGLE_CLIENT_SECRET"] = "secret";
    expect(service.isConfigured("google")).toBe(true);
    expect(service.isConfigured("github")).toBe(false);
  });

  it("derives a deterministic url-safe S256 challenge", () => {
    const first = service.codeChallenge("a-verifier");
    const second = service.codeChallenge("a-verifier");
    expect(first).toBe(second);
    expect(first).not.toContain("=");
    expect(first).not.toContain("+");
    expect(first).not.toContain("/");
  });

  it("builds an authorization URL carrying PKCE and state", () => {
    process.env["GOOGLE_CLIENT_ID"] = "client-123";
    const url = service.buildAuthorizationUrl("google", "the-state", "the-challenge");
    expect(url.startsWith("https://accounts.google.com/o/oauth2/v2/auth?")).toBe(true);
    expect(url).toContain("client_id=client-123");
    expect(url).toContain("code_challenge=the-challenge");
    expect(url).toContain("code_challenge_method=S256");
    expect(url).toContain("state=the-state");
    expect(url).toContain("scope=openid+email+profile");
  });

  it("exchanges the code then returns the normalized profile", async () => {
    process.env["GOOGLE_CLIENT_ID"] = "id";
    process.env["GOOGLE_CLIENT_SECRET"] = "secret";
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: "at" }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sub: "sub-1", email: "P@E.com", email_verified: true, name: "P" }) }) as unknown as typeof fetch;

    const profile = await service.fetchIdentity("google", "code", "verifier");
    expect(profile).toEqual({ providerUserId: "sub-1", email: "p@e.com", emailVerified: true, displayName: "P" });
  });

  it("marks a google identity without a verified email", async () => {
    process.env["GOOGLE_CLIENT_ID"] = "id";
    process.env["GOOGLE_CLIENT_SECRET"] = "secret";
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: "at" }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sub: "sub-1", email: "p@e.com", email_verified: false }) }) as unknown as typeof fetch;

    await expect(service.fetchIdentity("google", "code", "verifier")).resolves.toEqual({
      providerUserId: "sub-1",
      email: "p@e.com",
      emailVerified: false,
      displayName: "p@e.com",
    });
  });

  it("throws when the token exchange fails", async () => {
    process.env["GOOGLE_CLIENT_ID"] = "id";
    process.env["GOOGLE_CLIENT_SECRET"] = "secret";
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false }) as unknown as typeof fetch;
    await expect(service.fetchIdentity("google", "code", "verifier")).rejects.toThrow();
  });

  describe("github provider", () => {
    it("reports configured only with github credentials", () => {
      expect(service.isConfigured("github")).toBe(false);
      process.env["GITHUB_CLIENT_ID"] = "id";
      process.env["GITHUB_CLIENT_SECRET"] = "secret";
      expect(service.isConfigured("github")).toBe(true);
    });

    it("builds a github authorization URL without google-only params", () => {
      process.env["GITHUB_CLIENT_ID"] = "gh-client";
      const url = service.buildAuthorizationUrl("github", "the-state", "the-challenge");
      expect(url.startsWith("https://github.com/login/oauth/authorize?")).toBe(true);
      expect(url).toContain("client_id=gh-client");
      expect(url).toContain("code_challenge=the-challenge");
      expect(url).not.toContain("access_type");
      expect(url).not.toContain("prompt=");
    });

    it("maps the github profile using its verified primary email", async () => {
      process.env["GITHUB_CLIENT_ID"] = "id";
      process.env["GITHUB_CLIENT_SECRET"] = "secret";
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: "gho_x" }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 4242, login: "octo", name: "Octo Cat" }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ email: "Octo@Example.com", primary: true, verified: true }]) }) as unknown as typeof fetch;

      const profile = await service.fetchIdentity("github", "code", "verifier");
      expect(profile).toEqual({ providerUserId: "4242", email: "octo@example.com", emailVerified: true, displayName: "Octo Cat" });
    });

    it("falls back to another verified github email when the primary email is unverified", async () => {
      process.env["GITHUB_CLIENT_ID"] = "id";
      process.env["GITHUB_CLIENT_SECRET"] = "secret";
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: "gho_x" }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 7, login: "ghuser", name: null }) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            { email: "primary@example.com", primary: true, verified: false },
            { email: "verified@example.com", primary: false, verified: true },
          ]),
        }) as unknown as typeof fetch;

      const profile = await service.fetchIdentity("github", "code", "verifier");
      expect(profile).toEqual({ providerUserId: "7", email: "verified@example.com", emailVerified: true, displayName: "ghuser" });
    });

    it("marks a github identity without a verified email", async () => {
      process.env["GITHUB_CLIENT_ID"] = "id";
      process.env["GITHUB_CLIENT_SECRET"] = "secret";
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: "gho_x" }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 7, login: "ghuser", name: null }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ email: "p@e.com", primary: true, verified: false }]) }) as unknown as typeof fetch;

      await expect(service.fetchIdentity("github", "code", "verifier")).resolves.toEqual({
        providerUserId: "7",
        email: null,
        emailVerified: false,
        displayName: "ghuser",
      });
    });
  });
});
