import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { UsersService } from "../users.service";
import { User } from "../user.schema";
import { Project } from "../../projects/project.schema";

function makeUserDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const save = jest.fn().mockResolvedValue(undefined);
  return {
    username: "ada",
    email: "ada@example.com",
    fullName: "Ada Lovelace",
    organization: "OpenPRA",
    title: "",
    bio: "",
    altEmail: "",
    phone: "",
    linkedin: "",
    createdAt: new Date("2026-03-12T10:00:00Z"),
    save,
    ...overrides,
  };
}

describe("UsersService", () => {
  let service: UsersService;
  let userModelMock: { findOne: jest.Mock };
  let projectModelMock: { countDocuments: jest.Mock };

  beforeEach(async () => {
    userModelMock = { findOne: jest.fn() };
    projectModelMock = { countDocuments: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: userModelMock },
        { provide: getModelToken(Project.name), useValue: projectModelMock },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe("getMyProfile", () => {
    it("returns a DTO with derived initials and memberSince", async () => {
      const doc = makeUserDoc();
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      const out = await service.getMyProfile("ada");

      expect(userModelMock.findOne).toHaveBeenCalledWith({ username: "ada" });
      expect(out.initials).toBe("AL");
      expect(out.memberSince).toMatch(/^March 2026$/);
    });

    it("throws NotFoundException when the user is unknown", async () => {
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.getMyProfile("ghost")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("updateMyProfile", () => {
    it("applies only the provided fields and persists via save()", async () => {
      const doc = makeUserDoc();
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      const out = await service.updateMyProfile("ada", {
        title: "PhD Candidate",
        bio: "Researching PRA at NC State",
        altEmail: "apatel47@gmail.com",
      });

      expect(doc.title).toBe("PhD Candidate");
      expect(doc.bio).toBe("Researching PRA at NC State");
      expect(doc.altEmail).toBe("apatel47@gmail.com");
      expect(doc.organization).toBe("OpenPRA");
      expect((doc.save as jest.Mock)).toHaveBeenCalledTimes(1);
      expect(out.title).toBe("PhD Candidate");
    });

    it("throws NotFoundException when the user is unknown", async () => {
      userModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.updateMyProfile("ghost", { title: "X" })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("getMyProjectCount", () => {
    it("delegates to projectModel.countDocuments filtered by owner", async () => {
      projectModelMock.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(8) });
      const n = await service.getMyProjectCount("ada");
      expect(projectModelMock.countDocuments).toHaveBeenCalledWith({ ownerUsername: "ada" });
      expect(n).toBe(8);
    });
  });
});
