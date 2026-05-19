import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { getModelToken } from "@nestjs/mongoose";
import * as argon2 from "argon2";
import { AuthService } from "../auth.service";
import { EmailService } from "../email.service";
import { User } from "../../users/user.schema";

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
  let jwtService: { signAsync: jest.Mock };
  let emailService: { sendPasswordResetEmail: jest.Mock };

  beforeEach(async () => {
    userModelMock = Object.assign(jest.fn(), {
      findOne: jest.fn(),
      create: jest.fn(),
    });
    jwtService = { signAsync: jest.fn().mockResolvedValue("signed.jwt.token") };
    emailService = { sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: userModelMock },
        { provide: JwtService, useValue: jwtService },
        { provide: EmailService, useValue: emailService },
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

      const out = await service.login({ identifier: "ada", password: "correct-password" });

      expect(out).toEqual({ token: "signed.jwt.token" });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ username: "ada", email: "ada@example.com", roles: ["member-role"] }),
      );
    });

    it("issues a JWT when identifier matches email", async () => {
      const hash = await argon2.hash("correct-password");
      userModelMock.findOne.mockResolvedValue(makeUser({ passwordHash: hash }));

      const out = await service.login({ identifier: "ADA@example.com", password: "correct-password" });
      expect(out.token).toBe("signed.jwt.token");
    });

    it("throws UnauthorizedException on wrong password", async () => {
      const hash = await argon2.hash("correct-password");
      userModelMock.findOne.mockResolvedValue(makeUser({ passwordHash: hash }));
      await expect(service.login({ identifier: "ada", password: "wrong" })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException when user is unknown", async () => {
      userModelMock.findOne.mockResolvedValue(null);
      await expect(service.login({ identifier: "nobody", password: "anything" })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
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
