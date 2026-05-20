import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";

interface ProviderConfig {
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  profileMode: "oidc" | "github";
  extraAuthParams: Record<string, string>;
}

interface OAuthProfile {
  providerUserId: string;
  email: string;
  displayName: string;
}

const USER_AGENT = "OpenPRA";

const PROVIDERS: Record<string, ProviderConfig> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    profileMode: "oidc",
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
  github: {
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    scope: "read:user user:email",
    clientIdEnv: "GITHUB_CLIENT_ID",
    clientSecretEnv: "GITHUB_CLIENT_SECRET",
    profileMode: "github",
    extraAuthParams: {},
  },
};

@Injectable()
export class OAuthService {
  isConfigured(provider: string): boolean {
    const config = PROVIDERS[provider];
    if (config === undefined) return false;
    return Boolean(process.env[config.clientIdEnv]) && Boolean(process.env[config.clientSecretEnv]);
  }

  createCodeVerifier(): string {
    return randomBytes(32).toString("base64url");
  }

  codeChallenge(verifier: string): string {
    return createHash("sha256").update(verifier).digest("base64url");
  }

  redirectUri(provider: string): string {
    const base = process.env["OAUTH_CALLBACK_BASE"] ?? "http://localhost:8000/api";
    return `${base}/auth/oauth/${provider}/callback`;
  }

  buildAuthorizationUrl(provider: string, state: string, challenge: string): string {
    const config = PROVIDERS[provider];
    const params = new URLSearchParams({
      client_id: process.env[config.clientIdEnv] as string,
      redirect_uri: this.redirectUri(provider),
      response_type: "code",
      scope: config.scope,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      ...config.extraAuthParams,
    });
    return `${config.authUrl}?${params.toString()}`;
  }

  async fetchIdentity(provider: string, code: string, codeVerifier: string): Promise<OAuthProfile> {
    const config = PROVIDERS[provider];
    const accessToken = await this.exchangeToken(provider, config, code, codeVerifier);
    if (config.profileMode === "github") return this.fetchGithubProfile(config, accessToken);
    return this.fetchOidcProfile(config, accessToken);
  }

  private async exchangeToken(provider: string, config: ProviderConfig, code: string, codeVerifier: string): Promise<string> {
    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", "user-agent": USER_AGENT },
      body: new URLSearchParams({
        client_id: process.env[config.clientIdEnv] as string,
        client_secret: process.env[config.clientSecretEnv] as string,
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: this.redirectUri(provider),
      }).toString(),
    });
    if (!response.ok) throw new Error("Token exchange failed");
    const tokens = (await response.json()) as { access_token?: string };
    if (!tokens.access_token) throw new Error("No access token returned");
    return tokens.access_token;
  }

  private async fetchOidcProfile(config: ProviderConfig, accessToken: string): Promise<OAuthProfile> {
    const response = await fetch(config.userInfoUrl, {
      headers: { authorization: `Bearer ${accessToken}`, "user-agent": USER_AGENT },
    });
    if (!response.ok) throw new Error("Userinfo request failed");
    const info = (await response.json()) as { sub?: string; email?: string; name?: string };
    if (!info.sub || !info.email) throw new Error("Incomplete provider profile");
    return { providerUserId: info.sub, email: info.email.toLowerCase(), displayName: info.name ?? info.email };
  }

  private async fetchGithubProfile(config: ProviderConfig, accessToken: string): Promise<OAuthProfile> {
    const headers = { authorization: `Bearer ${accessToken}`, accept: "application/vnd.github+json", "user-agent": USER_AGENT };
    const response = await fetch(config.userInfoUrl, { headers });
    if (!response.ok) throw new Error("GitHub user request failed");
    const info = (await response.json()) as { id?: number; login?: string; name?: string; email?: string | null };
    if (info.id === undefined || !info.login) throw new Error("Incomplete GitHub profile");

    let email = info.email ?? null;
    if (email === null) {
      const emailResponse = await fetch(`${config.userInfoUrl}/emails`, { headers });
      if (emailResponse.ok) {
        const emails = (await emailResponse.json()) as { email: string; primary: boolean; verified: boolean }[];
        const chosen = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
        email = chosen?.email ?? null;
      }
    }
    if (email === null) throw new Error("No verified GitHub email");

    return { providerUserId: String(info.id), email: email.toLowerCase(), displayName: info.name ?? info.login };
  }
}

export type { OAuthProfile };
