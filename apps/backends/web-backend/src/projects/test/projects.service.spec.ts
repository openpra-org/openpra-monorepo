import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { elementsForMode } from "interfaces-shared-types";
import { Types } from "mongoose";
import { ProjectsService } from "../projects.service";
import { Project } from "../project.schema";
import { User } from "../../users/user.schema";

function makeProjectDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const save = jest.fn().mockResolvedValue(undefined);
  const deleteOne = jest.fn().mockResolvedValue(undefined);
  return {
    _id: new Types.ObjectId().toHexString(),
    name: "Unit 2 — Internal Events Baseline",
    mode: "internal-events",
    ownerUsername: "ada",
    ownerFullName: "Ada Lovelace",
    collaborators: [],
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
  };

  beforeEach(async () => {
    projectModelMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    userModelMock = { findOne: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getModelToken(Project.name), useValue: projectModelMock },
        { provide: getModelToken(User.name), useValue: userModelMock },
      ],
    }).compile();
    service = moduleRef.get(ProjectsService);
  });

  describe("createProject", () => {
    it("scaffolds status map with not-started for every element in the mode", async () => {
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
      const created = projectModelMock.create.mock.calls[0][0] as { status: Record<string, string>; pinned: boolean; state: string };
      expect(Object.keys(created.status)).toHaveLength(expected.length);
      for (const el of expected) expect(created.status[el.code]).toBe("not-started");
      expect(created.pinned).toBe(false);
      expect(created.state).toBe("active");
      expect(result.modeLabel).toBe("External Hazards");
      expect(result.ownerInitials).toBe("AL");
      expect(result.pinned).toBe(false);
      expect(result.state).toBe("active");
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
    it("returns projects where the user is in the collaborators array", async () => {
      const doc = makeProjectDoc({ ownerUsername: "chen", ownerFullName: "M. Chen", collaborators: ["ada"] });
      const exec = jest.fn().mockResolvedValue([doc]);
      projectModelMock.find.mockReturnValue({ sort: () => ({ exec }) });

      const out = await service.getSharedProjects({ username: "ada" });

      expect(projectModelMock.find).toHaveBeenCalledWith({ collaborators: "ada" });
      expect(out.projects).toHaveLength(1);
      expect(out.projects[0].ownerInitials).toBe("MC");
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
    it("creates a copy with the same mode, owner, and status; name gains ' (copy)' suffix", async () => {
      const doc = makeProjectDoc({ name: "Original" });
      projectModelMock.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      projectModelMock.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(makeProjectDoc({ ...data })),
      );

      const result = await service.duplicateProject(String(doc._id), { username: "ada" });

      const created = projectModelMock.create.mock.calls[0][0] as Record<string, unknown>;
      expect(created.name).toBe("Original (copy)");
      expect(created.mode).toBe(doc.mode);
      expect(created.ownerUsername).toBe(doc.ownerUsername);
      expect(created.collaborators).toEqual([]);
      expect(created.pinned).toBe(false);
      expect(created.state).toBe("active");
      expect(result.name).toBe("Original (copy)");
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
