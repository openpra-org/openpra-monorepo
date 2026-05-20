import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";

interface ProviderConfig {
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  clientIdEnv: string;
  clientSecretEnv: string;
}

interface OAuthProfile {
  providerUserId: string;
  email: string;
  displayName: string;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
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
      access_type: "offline",
      prompt: "consent",
    });
    return `${config.authUrl}?${params.toString()}`;
  }

  async fetchIdentity(provider: string, code: string, codeVerifier: string): Promise<OAuthProfile> {
    const config = PROVIDERS[provider];
    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        client_id: process.env[config.clientIdEnv] as string,
        client_secret: process.env[config.clientSecretEnv] as string,
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: this.redirectUri(provider),
      }).toString(),
    });
    if (!tokenResponse.ok) throw new Error("Token exchange failed");
    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokens.access_token) throw new Error("No access token returned");

    const infoResponse = await fetch(config.userInfoUrl, {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!infoResponse.ok) throw new Error("Userinfo request failed");
    const info = (await infoResponse.json()) as { sub?: string; email?: string; name?: string };
    if (!info.sub || !info.email) throw new Error("Incomplete provider profile");

    return {
      providerUserId: info.sub,
      email: info.email.toLowerCase(),
      displayName: info.name ?? info.email,
    };
  }
}

export type { OAuthProfile };
