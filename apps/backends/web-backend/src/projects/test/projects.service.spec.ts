import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { elementsForMode } from "interfaces-shared-types";
import { Types } from "mongoose";
import { ProjectsService } from "../projects.service";
import { Project } from "../project.schema";
import { User } from "../../users/user.schema";
import { Team } from "../../teams/team.schema";

function makeProjectDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const save = jest.fn().mockResolvedValue(undefined);
  const deleteOne = jest.fn().mockResolvedValue(undefined);
  const markModified = jest.fn();
  return {
    _id: new Types.ObjectId().toHexString(),
    name: "Unit 2 — Internal Events Baseline",
    mode: "internal-events",
    ownerUsername: "ada",
    ownerFullName: "Ada Lovelace",
    sharedTeams: [],
    sharedUsers: [],
    status: {
      POS: "baseline", IE: "baseline", ES: "baseline",
      SC: "not-started", SY: "not-started", HRA: "not-started", DA: "not-started",
      ESQ: "not-started", MS: "not-started", RC: "not-started", RI: "not-started",
    },
    pinned: false,
    state: "active",
    updatedAt: new Date("2026-05-01T12:00:00Z"),
    save,
    deleteOne,
    markModified,
    ...overrides,
  };
}

describe("ProjectsService", () => {
  let service: ProjectsService;
  let projectModelMock: {
    findOne: jest.Mock;
    find: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
  };
  let userModelMock: {
    findOne: jest.Mock;
    find: jest.Mock;
  };
  let teamModelMock: {
    findById: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(async () => {
    projectModelMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    userModelMock = {
      findOne: jest.fn(),
      find: jest.fn().mockReturnValue({ lean: () => Promise.resolve([]) }),
    };
    teamModelMock = {
      findById: jest.fn(),
      find: jest.fn().mockReturnValue({ lean: () => Promise.resolve([]) }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getModelToken(Project.name), useValue: projectModelMock },
        { provide: getModelToken(User.name), useValue: userModelMock },
        { provide: getModelToken(Team.name), useValue: teamModelMock },
      ],
    }).compile();
    service = moduleRef.get(ProjectsService);
  });

  describe("createProject", () => {
    it("scaffolds status map with not-started for every element in the mode and the creator as owner", async () => {
      userModelMock.findOne.mockReturnValue({
        lean: () => Promise.resolve({ username: "ada", fullName: "Ada Lovelace" }),
      });
      projectModelMock.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(makeProjectDoc({ ...data })),
      );

      const result = await service.createProject(
        { name: "External Hazards Study", mode: "external-hazards" },
        { username: "ada" },
      );

      const expected = elementsForMode("external-hazards");
      const created = projectModelMock.create.mock.calls[0][0] as { status: Record<string, string>; sharedTeams: unknown[]; sharedUsers: unknown[]; ownerUsername: string };
      expect(Object.keys(created.status)).toHaveLength(expected.length);
      for (const el of expected) expect(created.status[el.code]).toBe("not-started");
      expect(created.ownerUsername).toBe("ada");
      expect(created.sharedTeams).toEqual([]);
      expect(created.sharedUsers).toEqual([]);
      expect(result.ownerInitials).toBe("AL");
    });

    it("throws NotFoundException when acting user cannot be resolved", async () => {
      userModelMock.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
      await expect(
        service.createProject({ name: "Anything Here", mode: "internal-events" }, { username: "ghost" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("getRecentProject", () => {
    it("returns the most recently updated project owned by the user", async () => {
      const doc = makeProjectDoc();
      const exec = jest.fn().mockResolvedValue(doc);
      const sort = jest.fn().mockReturnValue({ exec });
      projectModelMock.findOne.mockReturnValue({ sort });

      const out = await service.getRecentProject({ username: "ada" });

      expect(projectModelMock.findOne).toHaveBeenCalledWith({ ownerUsername: "ada" });
      expect(sort).toHaveBeenCalledWith({ updatedAt: -1 });
      expect(out.project).not.toBeNull();
      expect(out.project!.name).toBe("Unit 2 — Internal Events Baseline");
      expect(out.project!.progress).toBeCloseTo(3 / 11, 5);
    });

    it("returns null when the user has no projects", async () => {
      const exec = jest.fn().mockResolvedValue(null);
      projectModelMock.findOne.mockReturnValue({ sort: () => ({ exec }) });
      const out = await service.getRecentProject({ username: "ada" });
      expect(out.project).toBeNull();
    });
  });

  describe("getOwnedProjects", () => {
    it("returns every project owned by the user, sorted by updatedAt desc", async () => {
      const docs = [makeProjectDoc({ name: "A" }), makeProjectDoc({ name: "B" })];
      const exec = jest.fn().mockResolvedValue(docs);
      const sort = jest.fn().mockReturnValue({ exec });
      projectModelMock.find.mockReturnValue({ sort });

      const out = await service.getOwnedProjects({ username: "ada" });

      expect(projectModelMock.find).toHaveBeenCalledWith({ ownerUsername: "ada" });
      expect(sort).toHaveBeenCalledWith({ updatedAt: -1 });
      expect(out.projects.map((p) => p.name)).toEqual(["A", "B"]);
    });
  });

  describe("getSharedProjects", () => {
    it("returns projects shared with the user directly or via a team they belong to, tagged with myRole", async () => {
      const teamId = new Types.ObjectId().toHexString();
      teamModelMock.find.mockReturnValueOnce({
        lean: () => Promise.resolve([{ _id: teamId, name: "Risk Group", members: ["chen", "ada"] }]),
      });
      teamModelMock.find.mockReturnValueOnce({
        lean: () => Promise.resolve([{ _id: teamId, name: "Risk Group", members: ["chen", "ada"] }]),
      });
      const sharedViaTeam = makeProjectDoc({
        ownerUsername: "chen",
        ownerFullName: "M. Chen",
        sharedTeams: [{ teamId, role: "editor" }],
      });
      const exec = jest.fn().mockResolvedValue([sharedViaTeam]);
      projectModelMock.find.mockReturnValue({ sort: () => ({ exec }) });

      const out = await service.getSharedProjects({ username: "ada" });

      const filter = projectModelMock.find.mock.calls[0][0] as Record<string, unknown>;
      expect(filter["ownerUsername"]).toEqual({ $ne: "ada" });
      const orClauses = filter["$or"] as Record<string, unknown>[];
      expect(orClauses).toContainEqual({ "sharedUsers.username": "ada" });
      expect(orClauses).toContainEqual({ "sharedTeams.teamId": { $in: [teamId] } });
      expect(out.projects).toHaveLength(1);
      expect(out.projects[0].ownerUsername).toBe("chen");
      expect(out.projects[0].myRole).toBe("editor");
    });
  });

  describe("getProject", () => {
    it("returns the project with myRole='owner' for the owner", async () => {
      const doc = makeProjectDoc();
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.getProject(String(doc._id), { username: "ada" });
      expect(out.myRole).toBe("owner");
    });

    it("returns the project with myRole='editor' for a direct editor share", async () => {
      const doc = makeProjectDoc({
        ownerUsername: "chen",
        sharedUsers: [{ username: "ada", role: "editor" }],
      });
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.getProject(String(doc._id), { username: "ada" });
      expect(out.myRole).toBe("editor");
    });

    it("returns the project with myRole='viewer' for a team-viewer share when the user is in the team", async () => {
      const teamId = new Types.ObjectId().toHexString();
      teamModelMock.find.mockReturnValueOnce({
        lean: () => Promise.resolve([{ _id: teamId, name: "Risk Group", members: ["chen", "ada"] }]),
      });
      const doc = makeProjectDoc({
        ownerUsername: "chen",
        sharedTeams: [{ teamId, role: "viewer" }],
      });
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.getProject(String(doc._id), { username: "ada" });
      expect(out.myRole).toBe("viewer");
    });

    it("promotes role to editor when both a viewer team share AND a direct editor share exist", async () => {
      const teamId = new Types.ObjectId().toHexString();
      teamModelMock.find.mockReturnValueOnce({
        lean: () => Promise.resolve([{ _id: teamId, name: "Risk Group", members: ["chen", "ada"] }]),
      });
      const doc = makeProjectDoc({
        ownerUsername: "chen",
        sharedTeams: [{ teamId, role: "viewer" }],
        sharedUsers: [{ username: "ada", role: "editor" }],
      });
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const out = await service.getProject(String(doc._id), { username: "ada" });
      expect(out.myRole).toBe("editor");
    });

    it("throws NotFoundException when the acting user has no role", async () => {
      const doc = makeProjectDoc({ ownerUsername: "chen" });
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(
        service.getProject(String(doc._id), { username: "ada" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws NotFoundException for an invalid ObjectId", async () => {
      await expect(
        service.getProject("not-an-objectid", { username: "ada" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("updateProject", () => {
    it("applies name, pinned, and state mutations on an owned project", async () => {
      const doc = makeProjectDoc();
      const exec = jest.fn().mockResolvedValue(doc);
      projectModelMock.findById.mockReturnValue({ exec });

      const result = await service.updateProject(
        String(doc._id),
        { name: "Renamed Project", pinned: true, state: "baseline" },
        { username: "ada" },
      );

      expect(doc.name).toBe("Renamed Project");
      expect(doc.pinned).toBe(true);
      expect(doc.state).toBe("baseline");
      expect((doc.save as jest.Mock)).toHaveBeenCalledTimes(1);
      expect(result.pinned).toBe(true);
      expect(result.state).toBe("baseline");
    });

    it("throws NotFoundException when project id does not exist", async () => {
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(
        service.updateProject(new Types.ObjectId().toHexString(), { pinned: true }, { username: "ada" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws NotFoundException when id is not a valid ObjectId", async () => {
      await expect(
        service.updateProject("not-an-objectid", { pinned: true }, { username: "ada" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws ForbiddenException when the acting user is not the owner", async () => {
      const doc = makeProjectDoc({ ownerUsername: "someone-else" });
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(
        service.updateProject(String(doc._id), { pinned: true }, { username: "ada" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("duplicateProject", () => {
    it("creates a copy with the same mode + owner; name gains ' (copy)' suffix; shares are not carried", async () => {
      const doc = makeProjectDoc({ name: "Original", sharedUsers: [{ username: "chen", role: "editor" }] });
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      projectModelMock.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(makeProjectDoc({ ...data })),
      );

      const result = await service.duplicateProject(String(doc._id), { username: "ada" });

      const created = projectModelMock.create.mock.calls[0][0] as Record<string, unknown>;
      expect(created.name).toBe("Original (copy)");
      expect(created.mode).toBe(doc.mode);
      expect(created.ownerUsername).toBe(doc.ownerUsername);
      expect(created.sharedTeams).toEqual([]);
      expect(created.sharedUsers).toEqual([]);
      expect(result.name).toBe("Original (copy)");
    });
  });

  describe("shareWithTeam", () => {
    it("attaches a team share when the user is a member of the team", async () => {
      const doc = makeProjectDoc();
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const teamId = new Types.ObjectId().toHexString();
      teamModelMock.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: teamId,
          name: "Risk Group",
          adminUsername: "chen",
          members: ["chen", "ada"],
        }),
      });
      teamModelMock.find.mockReturnValue({
        lean: () => Promise.resolve([{ _id: teamId, name: "Risk Group", members: ["chen", "ada"] }]),
      });

      const result = await service.shareWithTeam(String(doc._id), teamId, "editor", { username: "ada" });

      expect(doc.sharedTeams).toEqual([{ teamId, role: "editor" }]);
      expect(result.sharedTeams[0].teamId).toBe(teamId);
      expect(result.sharedTeams[0].teamName).toBe("Risk Group");
      expect(result.sharedTeams[0].role).toBe("editor");
    });

    it("throws ConflictException when the team is already a share", async () => {
      const teamId = new Types.ObjectId().toHexString();
      const doc = makeProjectDoc({ sharedTeams: [{ teamId, role: "viewer" }] });
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      teamModelMock.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: teamId,
          adminUsername: "ada",
          members: ["ada"],
        }),
      });
      await expect(
        service.shareWithTeam(String(doc._id), teamId, "editor", { username: "ada" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("throws ForbiddenException when the acting user is not in the team", async () => {
      const doc = makeProjectDoc();
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const teamId = new Types.ObjectId().toHexString();
      teamModelMock.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: teamId,
          adminUsername: "chen",
          members: ["chen"],
        }),
      });
      await expect(
        service.shareWithTeam(String(doc._id), teamId, "viewer", { username: "ada" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("unshareFromTeam", () => {
    it("removes a team share", async () => {
      const teamId = new Types.ObjectId().toHexString();
      const doc = makeProjectDoc({ sharedTeams: [{ teamId, role: "viewer" }] });
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await service.unshareFromTeam(String(doc._id), teamId, { username: "ada" });
      expect(doc.sharedTeams).toEqual([]);
    });

    it("throws NotFoundException when the team isn't a share", async () => {
      const doc = makeProjectDoc();
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(
        service.unshareFromTeam(String(doc._id), new Types.ObjectId().toHexString(), { username: "ada" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("updateTeamShareRole", () => {
    it("updates the share role from viewer to editor", async () => {
      const teamId = new Types.ObjectId().toHexString();
      const doc = makeProjectDoc({ sharedTeams: [{ teamId, role: "viewer" }] });
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const result = await service.updateTeamShareRole(String(doc._id), teamId, "editor", { username: "ada" });
      expect(doc.sharedTeams[0].role).toBe("editor");
      expect(result.sharedTeams[0].role).toBe("editor");
    });
  });

  describe("shareWithUser", () => {
    it("attaches a user share by username", async () => {
      const doc = makeProjectDoc();
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.findOne.mockReturnValue({
        lean: () => Promise.resolve({ username: "chen", fullName: "M. Chen" }),
      });
      userModelMock.find.mockReturnValue({
        lean: () => Promise.resolve([{ username: "chen", fullName: "M. Chen" }]),
      });

      const result = await service.shareWithUser(String(doc._id), "chen", "viewer", { username: "ada" });

      expect(doc.sharedUsers).toEqual([{ username: "chen", role: "viewer" }]);
      expect(result.sharedUsers[0].username).toBe("chen");
      expect(result.sharedUsers[0].fullName).toBe("M. Chen");
      expect(result.sharedUsers[0].role).toBe("viewer");
    });

    it("throws BadRequestException when sharing with the owner themselves", async () => {
      const doc = makeProjectDoc();
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.findOne.mockReturnValue({
        lean: () => Promise.resolve({ username: "ada", fullName: "Ada Lovelace" }),
      });
      await expect(
        service.shareWithUser(String(doc._id), "ada", "editor", { username: "ada" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("throws ConflictException when the user is already a share", async () => {
      const doc = makeProjectDoc({ sharedUsers: [{ username: "chen", role: "viewer" }] });
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.findOne.mockReturnValue({
        lean: () => Promise.resolve({ username: "chen", fullName: "M. Chen" }),
      });
      await expect(
        service.shareWithUser(String(doc._id), "chen", "editor", { username: "ada" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("throws NotFoundException when identifier doesn't resolve", async () => {
      const doc = makeProjectDoc();
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      userModelMock.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
      await expect(
        service.shareWithUser(String(doc._id), "ghost", "viewer", { username: "ada" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("unshareFromUser", () => {
    it("removes a user share", async () => {
      const doc = makeProjectDoc({ sharedUsers: [{ username: "chen", role: "viewer" }] });
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await service.unshareFromUser(String(doc._id), "chen", { username: "ada" });
      expect(doc.sharedUsers).toEqual([]);
    });
  });

  describe("updateUserShareRole", () => {
    it("updates the user share role", async () => {
      const doc = makeProjectDoc({ sharedUsers: [{ username: "chen", role: "viewer" }] });
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      const result = await service.updateUserShareRole(String(doc._id), "chen", "editor", { username: "ada" });
      expect(doc.sharedUsers[0].role).toBe("editor");
      expect(result.sharedUsers[0].role).toBe("editor");
    });
  });

  describe("deleteProject", () => {
    it("calls deleteOne on the owned doc", async () => {
      const doc = makeProjectDoc();
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      await service.deleteProject(String(doc._id), { username: "ada" });

      expect((doc.deleteOne as jest.Mock)).toHaveBeenCalledTimes(1);
    });

    it("throws ForbiddenException when acting user is not the owner", async () => {
      const doc = makeProjectDoc({ ownerUsername: "someone-else" });
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(
        service.deleteProject(String(doc._id), { username: "ada" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
