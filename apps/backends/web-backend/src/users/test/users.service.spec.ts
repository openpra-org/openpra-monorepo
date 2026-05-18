import { ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { UsersService } from "../users.service";
import { User } from "../user.schema";
import { Project } from "../../projects/project.schema";
import { Team } from "../../teams/team.schema";

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
  passwordHash: string;
  roles: string[];
  prefs: {
    notify: { projectShared: boolean; teamInvite: boolean; runFinished: boolean; quantErrors: boolean };
  };
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
    createdAt: new Date("2026-03-12T10:00:00Z"),
    save,
    deleteOne,
    markModified,
    ...overrides,
  };
}

describe("UsersService", () => {
  let service: UsersService;
  let userModelMock: { findOne: jest.Mock };
  let projectModelMock: { countDocuments: jest.Mock; deleteMany: jest.Mock; updateMany: jest.Mock };
  let teamModelMock: { find: jest.Mock; updateMany: jest.Mock };
  let jwtServiceMock: { signAsync: jest.Mock };

  beforeEach(async () => {
    userModelMock = { findOne: jest.fn() };
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
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: userModelMock },
        { provide: getModelToken(Project.name), useValue: projectModelMock },
        { provide: getModelToken(Team.name), useValue: teamModelMock },
        { provide: JwtService, useValue: jwtServiceMock },
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
        { $or: [{ members: "ada" }, { pending: "ada" }, { invited: "ada" }] },
        { $pull: { members: "ada", pending: "ada", invited: "ada" } },
      );
      expect(projectModelMock.deleteMany).toHaveBeenCalledWith({ ownerUsername: "ada" });
      expect(projectModelMock.updateMany).toHaveBeenCalledWith(
        { collaborators: "ada" },
        { $pull: { collaborators: "ada" } },
      );
      expect(doc.deleteOne).toHaveBeenCalledTimes(1);
    });

    it("throws UnauthorizedException when password is wrong", async () => {
      const passwordHash = await argon2.hash("hunter2hunter2");
      const doc = makeUserDoc({ passwordHash });
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.deleteMyAccount("ada", "wrong")).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
