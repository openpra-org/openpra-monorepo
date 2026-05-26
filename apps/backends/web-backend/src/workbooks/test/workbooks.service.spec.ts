import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { WorkbooksService } from "../workbooks.service";
import { Workbook } from "../workbook.schema";
import { User } from "../../users/user.schema";
import { ProjectsService } from "../../projects/projects.service";

function makeWorkbookDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const save = jest.fn().mockResolvedValue(undefined);
  const deleteOne = jest.fn().mockResolvedValue(undefined);
  return {
    _id: new Types.ObjectId().toHexString(),
    projectId: "proj-1",
    elementCode: "ES",
    toolId: "event-tree",
    name: "ET-LOOP",
    status: "draft",
    version: 1,
    ownerUsername: "ada",
    ownerFullName: "Ada Lovelace",
    createdAt: new Date("2026-05-01T12:00:00Z"),
    updatedAt: new Date("2026-05-02T12:00:00Z"),
    save,
    deleteOne,
    ...overrides,
  };
}

describe("WorkbooksService", () => {
  let service: WorkbooksService;
  let workbookModelMock: { find: jest.Mock; findById: jest.Mock; create: jest.Mock };
  let userModelMock: { findOne: jest.Mock };
  let projectsServiceMock: { resolveAccess: jest.Mock };

  beforeEach(async () => {
    workbookModelMock = { find: jest.fn(), findById: jest.fn(), create: jest.fn() };
    userModelMock = { findOne: jest.fn() };
    projectsServiceMock = { resolveAccess: jest.fn().mockResolvedValue({ doc: {}, role: "owner" }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkbooksService,
        { provide: getModelToken(Workbook.name), useValue: workbookModelMock },
        { provide: getModelToken(User.name), useValue: userModelMock },
        { provide: ProjectsService, useValue: projectsServiceMock },
      ],
    }).compile();
    service = moduleRef.get(WorkbooksService);
  });

  describe("listWorkbooks", () => {
    it("returns workbooks scoped to the project, element and tool with computed initials", async () => {
      const exec = jest.fn().mockResolvedValue([makeWorkbookDoc()]);
      workbookModelMock.find.mockReturnValue({ sort: () => ({ exec }) });

      const result = await service.listWorkbooks("proj-1", "ES", "event-tree", { username: "ada" });

      expect(projectsServiceMock.resolveAccess).toHaveBeenCalledWith("proj-1", { username: "ada" });
      expect(workbookModelMock.find).toHaveBeenCalledWith({ projectId: "proj-1", elementCode: "ES", toolId: "event-tree" });
      expect(result.workbooks).toHaveLength(1);
      expect(result.workbooks[0].ownerInitials).toBe("AL");
    });

    it("rejects a tool that does not belong to the element", async () => {
      await expect(
        service.listWorkbooks("proj-1", "SY", "event-tree", { username: "ada" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("createWorkbook", () => {
    it("creates a draft workbook owned by the acting user", async () => {
      userModelMock.findOne.mockReturnValue({ lean: () => Promise.resolve({ username: "ada", fullName: "Ada Lovelace" }) });
      workbookModelMock.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(makeWorkbookDoc({ ...data })),
      );

      const result = await service.createWorkbook(
        "proj-1",
        { elementCode: "SY", toolId: "fault-tree", name: "AFW fault tree" },
        { username: "ada" },
      );

      const created = workbookModelMock.create.mock.calls[0][0] as Record<string, unknown>;
      expect(created.status).toBe("draft");
      expect(created.version).toBe(1);
      expect(created.ownerUsername).toBe("ada");
      expect(result.name).toBe("AFW fault tree");
    });

    it("forbids viewers from creating workbooks", async () => {
      projectsServiceMock.resolveAccess.mockResolvedValue({ doc: {}, role: "viewer" });
      await expect(
        service.createWorkbook("proj-1", { elementCode: "SY", toolId: "fault-tree", name: "X" }, { username: "bob" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects a tool that does not belong to the element", async () => {
      userModelMock.findOne.mockReturnValue({ lean: () => Promise.resolve({ username: "ada", fullName: "Ada Lovelace" }) });
      await expect(
        service.createWorkbook("proj-1", { elementCode: "ES", toolId: "fault-tree", name: "X" }, { username: "ada" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("deleteWorkbook", () => {
    it("throws when the workbook belongs to a different project", async () => {
      const exec = jest.fn().mockResolvedValue(makeWorkbookDoc({ projectId: "other" }));
      workbookModelMock.findById.mockReturnValue({ exec });
      await expect(
        service.deleteWorkbook("proj-1", new Types.ObjectId().toHexString(), { username: "ada" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
