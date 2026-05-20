import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { UsersService } from "../users.service";
import { StorageService } from "../storage.service";
import { TwoFactorService } from "../../auth/twoFactor.service";
import { User } from "../user.schema";
import { Project } from "../../projects/project.schema";
import { Team } from "../../teams/team.schema";
import { OrgsService } from "../../orgs/orgs.service";

interface FakeTwoFactor {
  enabled: boolean;
  secret: string | null;
  pendingSecret: string | null;
  backupCodes: string[];
}

interface FakeUser {
  username: string;
  email: string;
  fullName: string;
  organization: string;
  title: string;
  bio: string;
  altEmail: string;
  phone: string;
  linkedin: string;
  passwordHash: string | null;
  roles: string[];
  prefs: {
    notify: { projectShared: boolean; teamInvite: boolean; runFinished: boolean; quantErrors: boolean };
  };
  twoFactor: FakeTwoFactor;
  connectedAccounts: { provider: string; providerUserId: string; displayName: string }[];
  avatarKey: string | null;
  coverKey: string | null;
  createdAt: Date;
  _id: string;
  save: jest.Mock;
  deleteOne: jest.Mock;
  markModified: jest.Mock;
}

function makeUserDoc(overrides: Partial<FakeUser> = {}): FakeUser {
  const save = jest.fn().mockResolvedValue(undefined);
  const deleteOne = jest.fn().mockResolvedValue(undefined);
  const markModified = jest.fn();
  return {
    _id: "user-1",
    username: "ada",
    email: "ada@example.com",
    fullName: "Ada Lovelace",
    organization: "OpenPRA",
    title: "",
    bio: "",
    altEmail: "",
    phone: "",
    linkedin: "",
    passwordHash: "$argon2id$placeholder",
    roles: ["member-role"],
    prefs: {
      notify: { projectShared: true, teamInvite: true, runFinished: true, quantErrors: true },
    },
    twoFactor: { enabled: false, secret: null, pendingSecret: null, backupCodes: [] },
    connectedAccounts: [],
    avatarKey: null,
    coverKey: null,
    createdAt: new Date("2026-03-12T10:00:00Z"),
    save,
    deleteOne,
    markModified,
    ...overrides,
  };
}

describe("UsersService", () => {
  let service: UsersService;
  let userModelMock: { findOne: jest.Mock; find: jest.Mock };
  let projectModelMock: { countDocuments: jest.Mock; deleteMany: jest.Mock; updateMany: jest.Mock };
  let teamModelMock: { find: jest.Mock; updateMany: jest.Mock };
  let jwtServiceMock: { signAsync: jest.Mock };
  let storageMock: { isAllowedMime: jest.Mock; uploadImage: jest.Mock; deleteByKey: jest.Mock; urlForKey: jest.Mock };
  let twoFactorServiceMock: {
    createSecret: jest.Mock;
    encrypt: jest.Mock;
    decrypt: jest.Mock;
    buildUri: jest.Mock;
    verifyTotp: jest.Mock;
    generateBackupCodes: jest.Mock;
    hashBackupCodes: jest.Mock;
    findBackupCodeIndex: jest.Mock;
  };
  let orgsServiceMock: { findOrCreate: jest.Mock };

  beforeEach(async () => {
    userModelMock = { findOne: jest.fn(), find: jest.fn() };
    projectModelMock = {
      countDocuments: jest.fn(),
      deleteMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(undefined) }),
      updateMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(undefined) }),
    };
    teamModelMock = {
      find: jest.fn(),
      updateMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(undefined) }),
    };
    jwtServiceMock = { signAsync: jest.fn().mockResolvedValue("signed.jwt.token") };
    storageMock = {
      isAllowedMime: jest.fn().mockReturnValue(true),
      uploadImage: jest.fn().mockResolvedValue("uploaded/key.png"),
      deleteByKey: jest.fn().mockResolvedValue(undefined),
      urlForKey: jest.fn().mockImplementation((key: string | null) => (key === null ? null : `https://cdn.example.com/openpra-web/${key}`)),
    };
    twoFactorServiceMock = {
      createSecret: jest.fn().mockReturnValue("PLAINSECRET"),
      encrypt: jest.fn().mockImplementation((v: string) => `enc(${v})`),
      decrypt: jest.fn().mockImplementation((v: string) => v.replace("enc(", "").replace(")", "")),
      buildUri: jest.fn().mockReturnValue("otpauth://totp/OpenPRA:ada@example.com?secret=PLAINSECRET"),
      verifyTotp: jest.fn(),
      generateBackupCodes: jest.fn().mockReturnValue(["aaaaa11111", "bbbbb22222"]),
      hashBackupCodes: jest.fn().mockResolvedValue(["hashA", "hashB"]),
      findBackupCodeIndex: jest.fn().mockResolvedValue(-1),
    };
    orgsServiceMock = {
      findOrCreate: jest.fn().mockImplementation((name: string) =>
        Promise.resolve(name.trim() === "" ? null : { id: "org-id", name: name.trim() }),
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: userModelMock },
        { provide: getModelToken(Project.name), useValue: projectModelMock },
        { provide: getModelToken(Team.name), useValue: teamModelMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: StorageService, useValue: storageMock },
        { provide: TwoFactorService, useValue: twoFactorServiceMock },
        { provide: OrgsService, useValue: orgsServiceMock },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe("getMyProfile", () => {
    it("returns a DTO with derived initials and memberSince", async () => {
      const doc = makeUserDoc();
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.getMyProfile("ada");
      expect(out.initials).toBe("AL");
      expect(out.memberSince).toBe("March 2026");
    });
  });

  describe("getPublicProfile", () => {
    it("omits private fields (email, altEmail, phone)", async () => {
      const doc = makeUserDoc({ email: "private@example.com", altEmail: "alt@example.com", phone: "+1-555-0100" });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.getPublicProfile("ada");
      expect(out.username).toBe("ada");
      expect(out.fullName).toBe("Ada Lovelace");
      expect(out.initials).toBe("AL");
      expect(out).not.toHaveProperty("email");
      expect(out).not.toHaveProperty("altEmail");
      expect(out).not.toHaveProperty("phone");
    });

    it("throws NotFoundException when the user is unknown", async () => {
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.getPublicProfile("ghost")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("searchUsers", () => {
    it("returns up to 20 matching users excluding the acting user, with case-insensitive match", async () => {
      const exec = jest.fn().mockResolvedValue([
        makeUserDoc({ username: "chen", fullName: "M. Chen" }),
        makeUserDoc({ username: "bob", fullName: "Bob Q" }),
      ]);
      const limit = jest.fn().mockReturnValue({ exec });
      const sort = jest.fn().mockReturnValue({ limit });
      userModelMock.find.mockReturnValue({ sort });

      const out = await service.searchUsers("ch", "ada");

      const filter = userModelMock.find.mock.calls[0][0] as Record<string, unknown>;
      expect(filter["username"]).toEqual({ $ne: "ada" });
      const orClauses = filter["$or"] as { username?: RegExp; fullName?: RegExp }[];
      expect(orClauses[0].username?.test("CHEN")).toBe(true);
      expect(orClauses[1].fullName?.test("chen")).toBe(true);
      expect(limit).toHaveBeenCalledWith(20);
      expect(out.users.map((u) => u.username)).toEqual(["chen", "bob"]);
    });

    it("returns empty results when the query is shorter than 2 chars", async () => {
      const out = await service.searchUsers("a", "ada");
      expect(out.users).toEqual([]);
      expect(userModelMock.find).not.toHaveBeenCalled();
    });
  });

  describe("updateMyProfile", () => {
    it("applies only the provided fields and persists via save()", async () => {
      const doc = makeUserDoc();
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.updateMyProfile("ada", { title: "PhD Candidate", bio: "x" });
      expect(doc.title).toBe("PhD Candidate");
      expect(doc.bio).toBe("x");
      expect(out.title).toBe("PhD Candidate");
      expect(doc.save).toHaveBeenCalledTimes(1);
    });
  });

  describe("changeEmail", () => {
    it("updates the email when the current password verifies", async () => {
      const passwordHash = await argon2.hash("hunter2hunter2");
      const doc = makeUserDoc({ passwordHash });
      userModelMock.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(doc) })
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(null) });
      const out = await service.changeEmail("ada", { newEmail: "Ada2@example.com", currentPassword: "hunter2hunter2" });
      expect(doc.email).toBe("ada2@example.com");
      expect(out.profile.email).toBe("ada2@example.com");
      expect(out.token).toBe("signed.jwt.token");
    });

    it("throws UnauthorizedException when current password is wrong", async () => {
      const passwordHash = await argon2.hash("hunter2hunter2");
      const doc = makeUserDoc({ passwordHash });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.changeEmail("ada", { newEmail: "x@y.z", currentPassword: "wrong" })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("throws ConflictException when the new email is already in use", async () => {
      const passwordHash = await argon2.hash("hunter2hunter2");
      const doc = makeUserDoc({ passwordHash });
      userModelMock.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(doc) })
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ email: "taken@example.com" }) });
      await expect(service.changeEmail("ada", { newEmail: "Taken@example.com", currentPassword: "hunter2hunter2" })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("changeUsername", () => {
    it("renames the user, signs a fresh token, returns the updated profile", async () => {
      const doc = makeUserDoc();
      userModelMock.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(doc) })
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(null) });
      const out = await service.changeUsername("ada", { newUsername: "ada-v2" });
      expect(doc.username).toBe("ada-v2");
      expect(out.profile.username).toBe("ada-v2");
      expect(out.token).toBe("signed.jwt.token");
    });

    it("rejects usernames with disallowed characters without using regex", async () => {
      const doc = makeUserDoc();
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.changeUsername("ada", { newUsername: "has space" })).rejects.toBeInstanceOf(ConflictException);
    });

    it("throws ConflictException when the new username is taken", async () => {
      const doc = makeUserDoc();
      userModelMock.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(doc) })
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ username: "taken" }) });
      await expect(service.changeUsername("ada", { newUsername: "taken" })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("changePassword", () => {
    it("re-hashes the password when the current password verifies", async () => {
      const passwordHash = await argon2.hash("hunter2hunter2");
      const doc = makeUserDoc({ passwordHash });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await service.changePassword("ada", { currentPassword: "hunter2hunter2", newPassword: "brand-new-strong" });
      await expect(argon2.verify(doc.passwordHash, "brand-new-strong")).resolves.toBe(true);
      expect(doc.save).toHaveBeenCalledTimes(1);
    });

    it("rejects when new password is the same as current", async () => {
      const passwordHash = await argon2.hash("samepassword");
      const doc = makeUserDoc({ passwordHash });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.changePassword("ada", { currentPassword: "samepassword", newPassword: "samepassword" })).rejects.toBeInstanceOf(ConflictException);
    });

    it("throws UnauthorizedException when current password is wrong", async () => {
      const passwordHash = await argon2.hash("hunter2hunter2");
      const doc = makeUserDoc({ passwordHash });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.changePassword("ada", { currentPassword: "wrong", newPassword: "brand-new-strong" })).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("two-factor authentication", () => {
    it("beginTwoFactorSetup stores an encrypted pending secret and returns the otpauth URI", async () => {
      const doc = makeUserDoc();
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.beginTwoFactorSetup("ada");
      expect(twoFactorServiceMock.createSecret).toHaveBeenCalledTimes(1);
      expect(doc.twoFactor.pendingSecret).toBe("enc(PLAINSECRET)");
      expect(doc.twoFactor.enabled).toBe(false);
      expect(out.secret).toBe("PLAINSECRET");
      expect(out.otpauthUri).toContain("otpauth://");
      expect(doc.save).toHaveBeenCalledTimes(1);
    });

    it("beginTwoFactorSetup rejects when 2FA is already enabled", async () => {
      const doc = makeUserDoc({ twoFactor: { enabled: true, secret: "enc(x)", pendingSecret: null, backupCodes: [] } });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.beginTwoFactorSetup("ada")).rejects.toBeInstanceOf(ConflictException);
    });

    it("enableTwoFactor verifies the pending secret, promotes it, and returns backup codes", async () => {
      const doc = makeUserDoc({ twoFactor: { enabled: false, secret: null, pendingSecret: "enc(PLAINSECRET)", backupCodes: [] } });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      twoFactorServiceMock.verifyTotp.mockResolvedValue(true);

      const out = await service.enableTwoFactor("ada", "123456");

      expect(twoFactorServiceMock.decrypt).toHaveBeenCalledWith("enc(PLAINSECRET)");
      expect(twoFactorServiceMock.verifyTotp).toHaveBeenCalledWith("PLAINSECRET", "123456");
      expect(doc.twoFactor.enabled).toBe(true);
      expect(doc.twoFactor.secret).toBe("enc(PLAINSECRET)");
      expect(doc.twoFactor.pendingSecret).toBe(null);
      expect(doc.twoFactor.backupCodes).toEqual(["hashA", "hashB"]);
      expect(out.backupCodes).toEqual(["aaaaa11111", "bbbbb22222"]);
    });

    it("enableTwoFactor throws BadRequest when setup was never started", async () => {
      const doc = makeUserDoc();
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.enableTwoFactor("ada", "123456")).rejects.toBeInstanceOf(BadRequestException);
    });

    it("enableTwoFactor throws Unauthorized when the code is wrong", async () => {
      const doc = makeUserDoc({ twoFactor: { enabled: false, secret: null, pendingSecret: "enc(PLAINSECRET)", backupCodes: [] } });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      twoFactorServiceMock.verifyTotp.mockResolvedValue(false);
      await expect(service.enableTwoFactor("ada", "000000")).rejects.toBeInstanceOf(UnauthorizedException);
      expect(doc.twoFactor.enabled).toBe(false);
    });

    it("disableTwoFactor wipes secret and backup codes when the code verifies", async () => {
      const doc = makeUserDoc({ twoFactor: { enabled: true, secret: "enc(PLAINSECRET)", pendingSecret: null, backupCodes: ["hashA"] } });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      twoFactorServiceMock.verifyTotp.mockResolvedValue(true);

      const out = await service.disableTwoFactor("ada", "123456");

      expect(doc.twoFactor.enabled).toBe(false);
      expect(doc.twoFactor.secret).toBe(null);
      expect(doc.twoFactor.backupCodes).toEqual([]);
      expect(out.detail).toMatch(/disabled/i);
    });

    it("disableTwoFactor throws Conflict when 2FA is not enabled", async () => {
      const doc = makeUserDoc();
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.disableTwoFactor("ada", "123456")).rejects.toBeInstanceOf(ConflictException);
    });

    it("disableTwoFactor throws Unauthorized when neither code nor backup matches", async () => {
      const doc = makeUserDoc({ twoFactor: { enabled: true, secret: "enc(PLAINSECRET)", pendingSecret: null, backupCodes: ["hashA"] } });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      twoFactorServiceMock.verifyTotp.mockResolvedValue(false);
      twoFactorServiceMock.findBackupCodeIndex.mockResolvedValue(-1);
      await expect(service.disableTwoFactor("ada", "000000")).rejects.toBeInstanceOf(UnauthorizedException);
      expect(doc.twoFactor.enabled).toBe(true);
    });
  });

  describe("disconnectProvider", () => {
    it("removes a connected provider and returns the updated profile", async () => {
      const doc = makeUserDoc({ connectedAccounts: [{ provider: "google", providerUserId: "sub-1", displayName: "g" }] });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.disconnectProvider("ada", "google");
      expect(doc.connectedAccounts).toEqual([]);
      expect(doc.save).toHaveBeenCalledTimes(1);
      expect(out.connectedAccounts).toEqual([]);
    });

    it("throws Conflict when the provider is not linked", async () => {
      const doc = makeUserDoc();
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.disconnectProvider("ada", "google")).rejects.toBeInstanceOf(ConflictException);
    });

    it("refuses to remove the only sign-in method when there is no password", async () => {
      const doc = makeUserDoc({ passwordHash: null, connectedAccounts: [{ provider: "google", providerUserId: "sub-1", displayName: "g" }] });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.disconnectProvider("ada", "google")).rejects.toBeInstanceOf(ConflictException);
      expect(doc.connectedAccounts).toHaveLength(1);
    });
  });

  describe("notification prefs", () => {
    it("returns the current notify subdoc", async () => {
      const doc = makeUserDoc();
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.getNotificationPrefs("ada");
      expect(out.projectShared).toBe(true);
    });

    it("applies partial updates and persists via save()", async () => {
      const doc = makeUserDoc();
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.updateNotificationPrefs("ada", { projectShared: false, quantErrors: false });
      expect(out.projectShared).toBe(false);
      expect(out.teamInvite).toBe(true);
      expect(out.quantErrors).toBe(false);
      expect(doc.markModified).toHaveBeenCalledWith("prefs");
      expect(doc.save).toHaveBeenCalledTimes(1);
    });

    it("throws NotFoundException when the user is unknown", async () => {
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.updateNotificationPrefs("ghost", { projectShared: false })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("deleteMyAccount", () => {
    it("cascades to admin teams + projects + memberships + collaborators", async () => {
      const passwordHash = await argon2.hash("hunter2hunter2");
      const doc = makeUserDoc({ passwordHash });
      const adminTeam = { deleteOne: jest.fn().mockResolvedValue(undefined) };
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      teamModelMock.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([adminTeam, adminTeam]) });

      await service.deleteMyAccount("ada", "hunter2hunter2");

      expect(adminTeam.deleteOne).toHaveBeenCalledTimes(2);
      expect(teamModelMock.updateMany).toHaveBeenCalledWith(
        { $or: [{ members: "ada" }, { leads: "ada" }, { "invites.username": "ada" }] },
        { $pull: { members: "ada", leads: "ada", invites: { username: "ada" } } },
      );
      expect(projectModelMock.deleteMany).toHaveBeenCalledWith({ ownerUsername: "ada" });
      expect(projectModelMock.updateMany).toHaveBeenCalledWith(
        { "sharedUsers.username": "ada" },
        { $pull: { sharedUsers: { username: "ada" } } },
      );
      expect(doc.deleteOne).toHaveBeenCalledTimes(1);
    });

    it("throws UnauthorizedException when password is wrong", async () => {
      const passwordHash = await argon2.hash("hunter2hunter2");
      const doc = makeUserDoc({ passwordHash });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.deleteMyAccount("ada", "wrong")).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("also deletes the user's avatar + cover objects from storage", async () => {
      const passwordHash = await argon2.hash("hunter2hunter2");
      const doc = makeUserDoc({ passwordHash, avatarKey: "avatars/ada/a.png", coverKey: "covers/ada/b.jpg" });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      teamModelMock.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
      await service.deleteMyAccount("ada", "hunter2hunter2");
      expect(storageMock.deleteByKey).toHaveBeenCalledWith("avatars/ada/a.png");
      expect(storageMock.deleteByKey).toHaveBeenCalledWith("covers/ada/b.jpg");
    });
  });

  describe("setAvatar", () => {
    it("uploads the file, persists the key, and deletes the previous key", async () => {
      const doc = makeUserDoc({ avatarKey: "avatars/ada/old.png" });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      storageMock.uploadImage.mockResolvedValueOnce("avatars/ada/new.png");

      const out = await service.setAvatar("ada", {
        buffer: Buffer.from([1, 2, 3]),
        mimetype: "image/png",
        size: 3,
        originalname: "a.png",
      });

      expect(storageMock.uploadImage).toHaveBeenCalledWith(
        "avatars",
        "ada",
        expect.objectContaining({ mimeType: "image/png", size: 3, originalName: "a.png" }),
      );
      expect(doc.avatarKey).toBe("avatars/ada/new.png");
      expect(doc.save).toHaveBeenCalledTimes(1);
      expect(storageMock.deleteByKey).toHaveBeenCalledWith("avatars/ada/old.png");
      expect(out.avatarUrl).toBe("https://cdn.example.com/openpra-web/avatars/ada/new.png");
    });

    it("rejects unsupported MIME types with BadRequestException", async () => {
      const doc = makeUserDoc();
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      storageMock.isAllowedMime.mockReturnValueOnce(false);
      await expect(
        service.setAvatar("ada", { buffer: Buffer.from([]), mimetype: "image/gif", size: 0, originalname: "x.gif" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storageMock.uploadImage).not.toHaveBeenCalled();
    });
  });

  describe("clearAvatar", () => {
    it("nulls the key and removes the previous object", async () => {
      const doc = makeUserDoc({ avatarKey: "avatars/ada/x.png" });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.clearAvatar("ada");
      expect(doc.avatarKey).toBe(null);
      expect(storageMock.deleteByKey).toHaveBeenCalledWith("avatars/ada/x.png");
      expect(out.avatarUrl).toBe(null);
    });
  });

  describe("setCover / clearCover", () => {
    it("setCover stores under the covers/ folder", async () => {
      const doc = makeUserDoc();
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      storageMock.uploadImage.mockResolvedValueOnce("covers/ada/c.webp");
      await service.setCover("ada", { buffer: Buffer.from([]), mimetype: "image/webp", size: 0, originalname: "c.webp" });
      expect(storageMock.uploadImage).toHaveBeenCalledWith("covers", "ada", expect.any(Object));
      expect(doc.coverKey).toBe("covers/ada/c.webp");
    });

    it("clearCover removes the previous object", async () => {
      const doc = makeUserDoc({ coverKey: "covers/ada/old.png" });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await service.clearCover("ada");
      expect(doc.coverKey).toBe(null);
      expect(storageMock.deleteByKey).toHaveBeenCalledWith("covers/ada/old.png");
    });
  });
});
