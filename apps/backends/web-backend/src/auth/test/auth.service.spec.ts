import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { getModelToken } from "@nestjs/mongoose";
import * as argon2 from "argon2";
import { AuthService } from "../auth.service";
import { EmailService } from "../email.service";
import { TwoFactorService } from "../twoFactor.service";
import { OAuthService } from "../oauth.service";
import { SessionsService } from "../../sessions/sessions.service";
import { User } from "../../users/user.schema";
import { OrgsService } from "../../orgs/orgs.service";

const ctx = { userAgent: "jest-agent", ip: "127.0.0.1" };

interface FakeTwoFactor {
  enabled: boolean;
  secret: string | null;
  pendingSecret: string | null;
  backupCodes: string[];
}

interface FakeUser {
  _id: string;
  username: string;
  email: string;
  fullName: string;
  organization: string;
  passwordHash: string;
  roles: string[];
  resetTokenHash: string | null;
  resetTokenExpiresAt: Date | null;
  twoFactor?: FakeTwoFactor;
  connectedAccounts: { provider: string; providerUserId: string; displayName: string }[];
  markModified: jest.Mock;
  save: jest.Mock;
}

function makeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  const base: FakeUser = {
    _id: "507f1f77bcf86cd799439011",
    username: "ada",
    email: "ada@example.com",
    fullName: "Ada Lovelace",
    organization: "OpenPRA",
    passwordHash: "$argon2id$placeholder",
    roles: ["member-role"],
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    connectedAccounts: [],
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  return { ...base, ...overrides };
}

describe("AuthService", () => {
  let service: AuthService;
  let userModelMock: {
    findOne: jest.Mock;
    create: jest.Mock;
  } & ((...args: unknown[]) => unknown);
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let emailService: { sendPasswordResetEmail: jest.Mock };
  let twoFactorService: { decrypt: jest.Mock; verifyTotp: jest.Mock; findBackupCodeIndex: jest.Mock };
  let oauthService: { isConfigured: jest.Mock; createCodeVerifier: jest.Mock; codeChallenge: jest.Mock; buildAuthorizationUrl: jest.Mock; fetchIdentity: jest.Mock };
  let sessionsService: { create: jest.Mock; revokeByJti: jest.Mock };
  let orgsService: { findOrCreate: jest.Mock };

  beforeEach(async () => {
    userModelMock = Object.assign(jest.fn(), {
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    });
    jwtService = {
      signAsync: jest.fn().mockResolvedValue("signed.jwt.token"),
      verifyAsync: jest.fn(),
    };
    emailService = { sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined) };
    twoFactorService = {
      decrypt: jest.fn(),
      verifyTotp: jest.fn(),
      findBackupCodeIndex: jest.fn().mockResolvedValue(-1),
    };
    oauthService = {
      isConfigured: jest.fn().mockReturnValue(true),
      createCodeVerifier: jest.fn().mockReturnValue("verifier"),
      codeChallenge: jest.fn().mockReturnValue("challenge"),
      buildAuthorizationUrl: jest.fn().mockReturnValue("https://provider/auth"),
      fetchIdentity: jest.fn(),
    };
    sessionsService = {
      create: jest.fn().mockResolvedValue(undefined),
      revokeByJti: jest.fn().mockResolvedValue(undefined),
    };
    orgsService = {
      findOrCreate: jest.fn().mockImplementation((name: string) =>
        Promise.resolve(name.trim() === "" ? null : { id: "org-id", name: name.trim() }),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: userModelMock },
        { provide: JwtService, useValue: jwtService },
        { provide: EmailService, useValue: emailService },
        { provide: TwoFactorService, useValue: twoFactorService },
        { provide: OAuthService, useValue: oauthService },
        { provide: SessionsService, useValue: sessionsService },
        { provide: OrgsService, useValue: orgsService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe("signup", () => {
    it("persists a new user with an argon2-hashed password", async () => {
      userModelMock.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
      userModelMock.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve({ ...makeUser(data as Partial<FakeUser>), _id: "abc123" }),
      );

      const result = await service.signup({
        fullName: "Ada Lovelace",
        email: "ADA@example.com",
        organization: "OpenPRA",
        username: "ada",
        password: "hunter2hunter2",
      });

      expect(userModelMock.create).toHaveBeenCalledTimes(1);
      const created = userModelMock.create.mock.calls[0][0] as { email: string; passwordHash: string; roles: string[] };
      expect(created.email).toBe("ada@example.com");
      expect(created.passwordHash).not.toBe("hunter2hunter2");
      expect(created.passwordHash.startsWith("$argon2")).toBe(true);
      expect(created.roles).toEqual(["member-role"]);
      await expect(argon2.verify(created.passwordHash, "hunter2hunter2")).resolves.toBe(true);
      expect(result).toEqual({ id: "abc123", username: "ada", email: "ada@example.com" });
    });

    it("rejects when the username is already taken", async () => {
      userModelMock.findOne.mockReturnValue({
        lean: () => Promise.resolve({ username: "ada", email: "other@example.com" }),
      });
      await expect(
        service.signup({
          fullName: "Another",
          email: "new@example.com",
          organization: "",
          username: "ada",
          password: "longenough!",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects when the email is already registered (case-insensitive)", async () => {
      userModelMock.findOne.mockReturnValue({
        lean: () => Promise.resolve({ username: "other", email: "ada@example.com" }),
      });
      await expect(
        service.signup({
          fullName: "Another",
          email: "ADA@example.com",
          organization: "",
          username: "newuser",
          password: "longenough!",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("login", () => {
    it("issues a JWT when identifier matches username and password is correct", async () => {
      const hash = await argon2.hash("correct-password");
      userModelMock.findOne.mockResolvedValue(makeUser({ passwordHash: hash }));

      const out = await service.login({ identifier: "ada", password: "correct-password" }, ctx);

      expect(out).toEqual({ token: "signed.jwt.token" });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ username: "ada", email: "ada@example.com", roles: ["member-role"] }),
      );
    });

    it("issues a JWT when identifier matches email", async () => {
      const hash = await argon2.hash("correct-password");
      userModelMock.findOne.mockResolvedValue(makeUser({ passwordHash: hash }));

      const out = await service.login({ identifier: "ADA@example.com", password: "correct-password" }, ctx);
      expect(out.token).toBe("signed.jwt.token");
    });

    it("throws UnauthorizedException on wrong password", async () => {
      const hash = await argon2.hash("correct-password");
      userModelMock.findOne.mockResolvedValue(makeUser({ passwordHash: hash }));
      await expect(service.login({ identifier: "ada", password: "wrong" }, ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException when user is unknown", async () => {
      userModelMock.findOne.mockResolvedValue(null);
      await expect(service.login({ identifier: "nobody", password: "anything" }, ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("returns a 2FA challenge instead of a token when 2FA is enabled", async () => {
      const hash = await argon2.hash("correct-password");
      userModelMock.findOne.mockResolvedValue(
        makeUser({
          passwordHash: hash,
          twoFactor: { enabled: true, secret: "enc-secret", pendingSecret: null, backupCodes: [] },
        }),
      );
      jwtService.signAsync.mockResolvedValueOnce("challenge.jwt");

      const out = await service.login({ identifier: "ada", password: "correct-password" }, ctx);

      expect(out).toEqual({ twoFactorRequired: true, challengeToken: "challenge.jwt" });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: "507f1f77bcf86cd799439011", tfaPending: true }),
        expect.objectContaining({ expiresIn: "5m" }),
      );
    });
  });

  describe("loginTwoFactor", () => {
    it("issues a full token when the TOTP code is valid", async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: "507f1f77bcf86cd799439011", tfaPending: true });
      userModelMock.findById.mockResolvedValue(
        makeUser({ twoFactor: { enabled: true, secret: "enc-secret", pendingSecret: null, backupCodes: ["hashA"] } }),
      );
      twoFactorService.decrypt.mockReturnValue("PLAINSECRET");
      twoFactorService.verifyTotp.mockResolvedValue(true);

      const out = await service.loginTwoFactor({ challengeToken: "challenge.jwt", code: "123456" }, ctx);

      expect(out).toEqual({ token: "signed.jwt.token" });
      expect(twoFactorService.verifyTotp).toHaveBeenCalledWith("PLAINSECRET", "123456");
    });

    it("consumes a backup code when the TOTP fails but a backup matches", async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: "507f1f77bcf86cd799439011", tfaPending: true });
      const user = makeUser({
        twoFactor: { enabled: true, secret: "enc-secret", pendingSecret: null, backupCodes: ["hashA", "hashB"] },
      });
      userModelMock.findById.mockResolvedValue(user);
      twoFactorService.decrypt.mockReturnValue("PLAINSECRET");
      twoFactorService.verifyTotp.mockResolvedValue(false);
      twoFactorService.findBackupCodeIndex.mockResolvedValue(1);

      const out = await service.loginTwoFactor({ challengeToken: "challenge.jwt", code: "backupcode" }, ctx);

      expect(out).toEqual({ token: "signed.jwt.token" });
      expect(user.twoFactor?.backupCodes).toEqual(["hashA"]);
      expect(user.save).toHaveBeenCalledTimes(1);
    });

    it("rejects when neither the TOTP nor a backup code matches", async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: "507f1f77bcf86cd799439011", tfaPending: true });
      userModelMock.findById.mockResolvedValue(
        makeUser({ twoFactor: { enabled: true, secret: "enc-secret", pendingSecret: null, backupCodes: [] } }),
      );
      twoFactorService.decrypt.mockReturnValue("PLAINSECRET");
      twoFactorService.verifyTotp.mockResolvedValue(false);
      twoFactorService.findBackupCodeIndex.mockResolvedValue(-1);

      await expect(
        service.loginTwoFactor({ challengeToken: "challenge.jwt", code: "000000" }, ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects when the challenge token is not a pending 2FA token", async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: "507f1f77bcf86cd799439011" });

      await expect(
        service.loginTwoFactor({ challengeToken: "full.jwt", code: "123456" }, ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects when the challenge token fails verification", async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error("expired"));

      await expect(
        service.loginTwoFactor({ challengeToken: "bad.jwt", code: "123456" }, ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("oauthCallback", () => {
    const profile = { providerUserId: "sub-1", email: "person@example.com", emailVerified: true, displayName: "A Person" };

    it("logs in when the provider account is already linked", async () => {
      jwtService.verifyAsync.mockResolvedValue({ oauth: true, provider: "google", intent: "login", verifier: "v" });
      oauthService.fetchIdentity.mockResolvedValue(profile);
      userModelMock.findOne.mockResolvedValueOnce(makeUser({}));

      const out = await service.oauthCallback("google", "code", "state", ctx);
      expect(out).toEqual({ kind: "token", token: "signed.jwt.token" });
    });

    it("does not require an email again when the provider identity is already linked", async () => {
      jwtService.verifyAsync.mockResolvedValue({ oauth: true, provider: "github", intent: "login", verifier: "v" });
      oauthService.fetchIdentity.mockResolvedValue({ ...profile, email: null, emailVerified: false });
      userModelMock.findOne.mockResolvedValueOnce(makeUser({}));

      const out = await service.oauthCallback("github", "code", "state", ctx);
      expect(out).toEqual({ kind: "token", token: "signed.jwt.token" });
    });

    it("returns a 2FA challenge when the linked account has 2FA enabled", async () => {
      jwtService.verifyAsync.mockResolvedValue({ oauth: true, provider: "google", intent: "login", verifier: "v" });
      oauthService.fetchIdentity.mockResolvedValue(profile);
      userModelMock.findOne.mockResolvedValueOnce(
        makeUser({ twoFactor: { enabled: true, secret: "enc", pendingSecret: null, backupCodes: [] } }),
      );

      const out = await service.oauthCallback("google", "code", "state", ctx);
      expect(out).toEqual({ kind: "twofa", challengeToken: "signed.jwt.token" });
    });

    it("creates an account on signup when the provider account is new", async () => {
      jwtService.verifyAsync.mockResolvedValue({ oauth: true, provider: "google", intent: "signup", verifier: "v" });
      oauthService.fetchIdentity.mockResolvedValue({ providerUserId: "sub-9", email: "new@example.com", emailVerified: true, displayName: "New Person" });
      userModelMock.findOne
        .mockResolvedValueOnce(null)
        .mockReturnValueOnce({ lean: () => Promise.resolve(null) })
        .mockReturnValueOnce({ lean: () => Promise.resolve(null) });
      userModelMock.create.mockResolvedValue(makeUser({ _id: "new-id", username: "new" }));

      const out = await service.oauthCallback("google", "code", "state", ctx);
      expect(out).toEqual({ kind: "token", token: "signed.jwt.token" });
      const created = userModelMock.create.mock.calls[0][0] as { passwordHash: string | null; connectedAccounts: { providerUserId: string }[] };
      expect(created.passwordHash).toBeNull();
      expect(created.connectedAccounts[0].providerUserId).toBe("sub-9");
    });

    it("rejects signup when the email already exists", async () => {
      jwtService.verifyAsync.mockResolvedValue({ oauth: true, provider: "google", intent: "signup", verifier: "v" });
      oauthService.fetchIdentity.mockResolvedValue({ providerUserId: "sub-10", email: "taken@example.com", emailVerified: true, displayName: "X" });
      userModelMock.findOne
        .mockResolvedValueOnce(null)
        .mockReturnValueOnce({ lean: () => Promise.resolve({ email: "taken@example.com" }) });

      const out = await service.oauthCallback("google", "code", "state", ctx);
      expect(out).toEqual({ kind: "error", error: "email_exists" });
    });

    it("creates and signs in an account on login when the verified provider identity is new", async () => {
      jwtService.verifyAsync.mockResolvedValue({ oauth: true, provider: "google", intent: "login", verifier: "v" });
      oauthService.fetchIdentity.mockResolvedValue(profile);
      userModelMock.findOne
        .mockResolvedValueOnce(null)
        .mockReturnValueOnce({ lean: () => Promise.resolve(null) })
        .mockReturnValueOnce({ lean: () => Promise.resolve(null) });
      userModelMock.create.mockResolvedValue(makeUser({ _id: "new-id", username: "person", email: profile.email }));

      const out = await service.oauthCallback("google", "code", "state", ctx);
      expect(out).toEqual({ kind: "token", token: "signed.jwt.token" });
      expect(userModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "person@example.com",
          passwordHash: null,
          connectedAccounts: [{ provider: "google", providerUserId: "sub-1", displayName: "A Person" }],
        }),
      );
    });

    it("does not merge a new provider identity into an existing account with the same email", async () => {
      jwtService.verifyAsync.mockResolvedValue({ oauth: true, provider: "google", intent: "login", verifier: "v" });
      oauthService.fetchIdentity.mockResolvedValue(profile);
      userModelMock.findOne
        .mockResolvedValueOnce(null)
        .mockReturnValueOnce({ lean: () => Promise.resolve({ email: profile.email }) });

      const out = await service.oauthCallback("google", "code", "state", ctx);
      expect(out).toEqual({ kind: "error", error: "email_exists" });
      expect(userModelMock.create).not.toHaveBeenCalled();
    });

    it("returns a targeted error when the provider email is not verified", async () => {
      jwtService.verifyAsync.mockResolvedValue({ oauth: true, provider: "google", intent: "login", verifier: "v" });
      oauthService.fetchIdentity.mockResolvedValue({ ...profile, emailVerified: false });

      const out = await service.oauthCallback("google", "code", "state", ctx);
      expect(out).toEqual({ kind: "error", error: "email_unverified" });
      expect(userModelMock.findOne).toHaveBeenCalledTimes(1);
    });

    it("recovers when a simultaneous callback has already created the same provider account", async () => {
      jwtService.verifyAsync.mockResolvedValue({ oauth: true, provider: "google", intent: "login", verifier: "v" });
      oauthService.fetchIdentity.mockResolvedValue(profile);
      const concurrentlyCreated = makeUser({
        _id: "concurrent-id",
        email: profile.email,
        connectedAccounts: [{ provider: "google", providerUserId: profile.providerUserId, displayName: profile.displayName }],
      });
      userModelMock.findOne
        .mockResolvedValueOnce(null)
        .mockReturnValueOnce({ lean: () => Promise.resolve(null) })
        .mockReturnValueOnce({ lean: () => Promise.resolve(null) })
        .mockResolvedValueOnce(concurrentlyCreated);
      userModelMock.create.mockRejectedValue({ code: 11000 });

      const out = await service.oauthCallback("google", "code", "state", ctx);
      expect(out).toEqual({ kind: "token", token: "signed.jwt.token" });
      expect(sessionsService.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "concurrent-id" }));
    });

    it("links the provider to the current user on intent=link", async () => {
      jwtService.verifyAsync.mockResolvedValue({ oauth: true, provider: "google", intent: "link", uid: "u-1", verifier: "v" });
      oauthService.fetchIdentity.mockResolvedValue({ providerUserId: "sub-42", email: "ada@example.com", emailVerified: true, displayName: "Ada G" });
      userModelMock.findOne.mockResolvedValueOnce(null);
      const linkUser = makeUser({ _id: "u-1", connectedAccounts: [] });
      userModelMock.findById.mockResolvedValue(linkUser);

      const out = await service.oauthCallback("google", "code", "state", ctx);
      expect(out).toEqual({ kind: "linked", provider: "google" });
      expect(linkUser.connectedAccounts).toHaveLength(1);
      expect(linkUser.connectedAccounts[0].providerUserId).toBe("sub-42");
      expect(linkUser.save).toHaveBeenCalledTimes(1);
    });

    it("returns an error when the state token is invalid", async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error("bad state"));
      const out = await service.oauthCallback("google", "code", "state", ctx);
      expect(out).toEqual({ kind: "error", error: "expired" });
    });
  });

  describe("forgotPassword", () => {
    it("writes a reset token and triggers email when the user exists", async () => {
      const user = makeUser();
      userModelMock.findOne.mockResolvedValue(user);
      const before = Date.now();

      const out = await service.forgotPassword({ identifier: "ada" });

      expect(user.resetTokenHash).not.toBeNull();
      expect(user.resetTokenHash).toHaveLength(64);
      expect(user.resetTokenExpiresAt).not.toBeNull();
      expect((user.resetTokenExpiresAt as Date).getTime()).toBeGreaterThan(before);
      expect(user.save).toHaveBeenCalledTimes(1);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      const [emailArg, urlArg] = emailService.sendPasswordResetEmail.mock.calls[0];
      expect(emailArg).toBe("ada@example.com");
      expect(urlArg).toMatch(/reset-password\?token=[a-f0-9]{64}/);
      expect(out.detail).toMatch(/reset link/i);
    });

    it("returns the generic response without sending email when user is unknown (no existence leak)", async () => {
      userModelMock.findOne.mockResolvedValue(null);
      const out = await service.forgotPassword({ identifier: "ghost" });
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(out.detail).toMatch(/reset link/i);
    });
  });

  describe("resetPassword", () => {
    it("updates the password and clears the reset token when token is valid and unexpired", async () => {
      const { createHash, randomBytes } = await import("crypto");
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const user = makeUser({
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: new Date(Date.now() + 60_000),
      });
      userModelMock.findOne.mockResolvedValue(user);

      const out = await service.resetPassword({ token: rawToken, newPassword: "brand-new-strong" });

      expect(user.resetTokenHash).toBeNull();
      expect(user.resetTokenExpiresAt).toBeNull();
      await expect(argon2.verify(user.passwordHash, "brand-new-strong")).resolves.toBe(true);
      expect(out.detail).toMatch(/updated/i);
    });

    it("rejects when the token has expired", async () => {
      userModelMock.findOne.mockResolvedValue(null);
      await expect(
        service.resetPassword({ token: "anything", newPassword: "brand-new-strong" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects when the token does not match any user", async () => {
      userModelMock.findOne.mockResolvedValue(null);
      await expect(
        service.resetPassword({ token: "garbage-token", newPassword: "brand-new-strong" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("checkAvailability", () => {
    it("returns usernameAvailable=true when no user matches", async () => {
      userModelMock.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
      const out = await service.checkAvailability("free-name");
      expect(userModelMock.findOne).toHaveBeenCalledWith({ username: "free-name" });
      expect(out).toEqual({ usernameAvailable: true });
    });

    it("returns usernameAvailable=false when a user is found", async () => {
      userModelMock.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(makeUser()) });
      const out = await service.checkAvailability("ada");
      expect(out).toEqual({ usernameAvailable: false });
    });

    it("lowercases the email lookup", async () => {
      userModelMock.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
      const out = await service.checkAvailability(undefined, "Ada@example.com");
      expect(userModelMock.findOne).toHaveBeenCalledWith({ email: "ada@example.com" });
      expect(out).toEqual({ emailAvailable: true });
    });

    it("returns both flags when both fields are queried", async () => {
      userModelMock.findOne
        .mockReturnValueOnce({ lean: () => Promise.resolve(null) })
        .mockReturnValueOnce({ lean: () => Promise.resolve(makeUser()) });
      const out = await service.checkAvailability("free", "taken@example.com");
      expect(out).toEqual({ usernameAvailable: true, emailAvailable: false });
    });

    it("returns an empty object when both inputs are empty / undefined", async () => {
      const out = await service.checkAvailability("   ", "");
      expect(out).toEqual({});
      expect(userModelMock.findOne).not.toHaveBeenCalled();
    });
  });
});
