import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { elementsForMode } from "interfaces-shared-types";
import { ProjectService } from "../project.service";
import { Project } from "../project.schema";
import { User } from "../../auth/user.schema";

function makeProjectDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _id: "proj-1",
    name: "Unit 2 — Internal Events Baseline",
    mode: "internal-events",
    ownerUsername: "ada",
    ownerFullName: "Ada Lovelace",
    collaborators: [],
    status: { POS: "baseline", IE: "baseline", ES: "baseline", SC: "not-started", SY: "not-started", HRA: "not-started", DA: "not-started", ESQ: "not-started", MS: "not-started", RC: "not-started", RI: "not-started" },
    updatedAt: new Date("2026-05-01T12:00:00Z"),
    ...overrides,
  };
}

describe("ProjectService", () => {
  let service: ProjectService;
  let projectModelMock: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
  };
  let userModelMock: {
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    projectModelMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
    };
    userModelMock = { findOne: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: getModelToken(Project.name), useValue: projectModelMock },
        { provide: getModelToken(User.name), useValue: userModelMock },
      ],
    }).compile();
    service = moduleRef.get(ProjectService);
  });

  describe("createProject", () => {
    it("scaffolds status map with not-started entries for every element in the mode", async () => {
      userModelMock.findOne.mockReturnValue({
        lean: () => Promise.resolve({ username: "ada", fullName: "Ada Lovelace" }),
      });
      projectModelMock.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(makeProjectDoc({ ...data, _id: "new-proj" })),
      );

      const result = await service.createProject(
        { name: "External Hazards Study", mode: "external-hazards" },
        { username: "ada" },
      );

      const expected = elementsForMode("external-hazards");
      const created = projectModelMock.create.mock.calls[0][0] as { status: Record<string, string> };
      expect(Object.keys(created.status)).toHaveLength(expected.length);
      for (const el of expected) expect(created.status[el.code]).toBe("not-started");
      expect(result.modeLabel).toBe("External Hazards");
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
});
