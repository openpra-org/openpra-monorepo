import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { IeWorkbooksService } from "../ie-workbooks.service";
import { ProjectsService } from "../../projects/projects.service";
import { ExampleWorkbooksService } from "../../example-workbooks/example-workbooks.service";
import { IeDocumentsService } from "../ie-documents.service";
import { WorkbookRolesService } from "../../workbooks/workbook-roles.service";
import { createBlankIe } from "../blank-ie";

function query<T>(value: T): { exec: jest.Mock } {
  return { exec: jest.fn().mockResolvedValue(value) };
}

describe("IeWorkbooksService", () => {
  let service: IeWorkbooksService;
  let ieModel: Record<string, jest.Mock>;
  let signoffModel: Record<string, jest.Mock>;
  let projectsService: { resolveAccess: jest.Mock };
  let exampleService: { getIeBundle: jest.Mock };
  let documentsService: { removeAllForWorkbook: jest.Mock };
  let rolesService: { resolveEffectiveRoles: jest.Mock };

  beforeEach(async () => {
    ieModel = { findOne: jest.fn() };
    signoffModel = { deleteMany: jest.fn().mockReturnValue(query(undefined)) };
    projectsService = { resolveAccess: jest.fn().mockResolvedValue({ doc: {}, role: "editor" }) };
    exampleService = { getIeBundle: jest.fn() };
    documentsService = { removeAllForWorkbook: jest.fn().mockResolvedValue(undefined) };
    rolesService = { resolveEffectiveRoles: jest.fn().mockResolvedValue(["preparer"]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        IeWorkbooksService,
        { provide: getModelToken("IeWorkbook"), useValue: ieModel },
        { provide: getModelToken("WorkbookSignoff"), useValue: signoffModel },
        { provide: ProjectsService, useValue: projectsService },
        { provide: ExampleWorkbooksService, useValue: exampleService },
        { provide: IeDocumentsService, useValue: documentsService },
        { provide: WorkbookRolesService, useValue: rolesService },
      ],
    }).compile();

    service = moduleRef.get(IeWorkbooksService);
  });

  it("throws when the workbook does not exist", async () => {
    ieModel.findOne.mockReturnValue(query(null));
    await expect(service.findOne("missing", { username: "alice" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns the workbook with the acting user's roles", async () => {
    const doc = { workbookId: "wb-1", projectId: "p-1", ownerUsername: "alice", mef: createBlankIe("IE", "alice"), previousMefJson: null, linkedPosWorkbookId: null, updatedAt: new Date() };
    ieModel.findOne.mockReturnValue(query(doc));
    const res = await service.findOne("wb-1", { username: "alice" });
    expect(res.myRoles).toEqual(["preparer"]);
    expect(res.linkedPosWorkbookId).toBeNull();
  });

  it("rejects loadExample for a non-preparer", async () => {
    ieModel.findOne.mockReturnValue(query({ workbookId: "wb-1", projectId: "p-1", mef: createBlankIe("IE", "alice") }));
    rolesService.resolveEffectiveRoles.mockResolvedValue(["reviewer"]);
    await expect(service.loadExample("wb-1", { username: "bob" })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("loads the example, replacing contents and clearing signoffs + documents", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const doc = { workbookId: "wb-1", projectId: "p-1", ownerUsername: "alice", mef: createBlankIe("IE", "alice"), previousMefJson: null, save, updatedAt: new Date() };
    ieModel.findOne.mockReturnValue(query(doc));
    exampleService.getIeBundle.mockResolvedValue({ ie: { mef: createBlankIe("Example IE", "alice") }, configurationControl: { mef: {} }, newlyDevelopedMethods: [] });
    await service.loadExample("wb-1", { username: "alice" });
    expect(save).toHaveBeenCalled();
    expect(typeof doc.previousMefJson).toBe("string");
    expect(signoffModel.deleteMany).toHaveBeenCalledWith({ workbookId: "wb-1" });
    expect(documentsService.removeAllForWorkbook).toHaveBeenCalledWith("wb-1");
  });
});
