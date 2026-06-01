import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { IePosLinkService } from "../ie-pos-link.service";
import { ProjectsService } from "../../projects/projects.service";
import { WorkbookRolesService } from "../../workbooks/workbook-roles.service";

function query<T>(value: T): { exec: jest.Mock } {
  return { exec: jest.fn().mockResolvedValue(value) };
}

const POS_MEF = {
  workflowState: "FINAL",
  plantOperatingStates: [
    { uuid: "POS-01", name: "Full power", operatingMode: "POWER", meanDurationHours: 7000, meanEntryFrequency: 1, radioactiveMaterialSources: [{ uuid: "SRC-1", name: "In-core fuel", location: "IN_CORE", barriers: ["Cladding"] }] },
    { uuid: "POS-02", name: "Hot standby", operatingMode: "STARTUP", meanDurationHours: 200, meanEntryFrequency: { value: 0.5 }, radioactiveMaterialSources: [] },
  ],
};

describe("IePosLinkService", () => {
  let service: IePosLinkService;
  let ieModel: Record<string, jest.Mock>;
  let workbookModel: Record<string, jest.Mock>;
  let posModel: Record<string, jest.Mock>;
  let projectsService: { resolveAccess: jest.Mock };
  let rolesService: { resolveEffectiveRoles: jest.Mock };

  beforeEach(async () => {
    ieModel = { findOne: jest.fn() };
    workbookModel = { find: jest.fn(), findById: jest.fn() };
    posModel = { findOne: jest.fn() };
    projectsService = { resolveAccess: jest.fn().mockResolvedValue({ doc: {}, role: "editor" }) };
    rolesService = { resolveEffectiveRoles: jest.fn().mockResolvedValue(["preparer"]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        IePosLinkService,
        { provide: getModelToken("IeWorkbook"), useValue: ieModel },
        { provide: getModelToken("Workbook"), useValue: workbookModel },
        { provide: getModelToken("PosWorkbook"), useValue: posModel },
        { provide: ProjectsService, useValue: projectsService },
        { provide: WorkbookRolesService, useValue: rolesService },
      ],
    }).compile();

    service = moduleRef.get(IePosLinkService);
  });

  it("throws when the IE workbook is missing", async () => {
    ieModel.findOne.mockReturnValue(query(null));
    await expect(service.status("missing", { username: "alice" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns an unlinked status when nothing is linked", async () => {
    ieModel.findOne.mockReturnValue(query({ workbookId: "ie-1", projectId: "p-1", linkedPosWorkbookId: null }));
    const status = await service.status("ie-1", { username: "alice" });
    expect(status.linkedPosWorkbookId).toBeNull();
    expect(status.states).toHaveLength(0);
  });

  it("links a POS workbook and imports its operating-state ids into the IE mef", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const ieDoc = { workbookId: "ie-1", projectId: "p-1", mef: { applicablePlantOperatingStates: [] }, linkedPosWorkbookId: null, save };
    ieModel.findOne.mockReturnValue(query(ieDoc));
    posModel.findOne.mockReturnValue(query({ workbookId: "pos-1", projectId: "p-1", mef: POS_MEF, updatedAt: new Date() }));
    workbookModel.findById.mockReturnValue(query({ id: "pos-1", name: "POS Workbook Example" }));

    const status = await service.link("ie-1", "pos-1", { username: "alice" });
    expect(ieDoc.linkedPosWorkbookId).toBe("pos-1");
    expect((ieDoc.mef as { applicablePlantOperatingStates: string[] }).applicablePlantOperatingStates).toEqual(["POS-01", "POS-02"]);
    expect(status.states).toHaveLength(2);
    expect(status.sources).toHaveLength(1);
    expect(save).toHaveBeenCalled();
  });

  it("rejects link from a non-preparer", async () => {
    ieModel.findOne.mockReturnValue(query({ workbookId: "ie-1", projectId: "p-1", mef: {}, linkedPosWorkbookId: null }));
    rolesService.resolveEffectiveRoles.mockResolvedValue(["reviewer"]);
    posModel.findOne.mockReturnValue(query({ workbookId: "pos-1", projectId: "p-1", mef: POS_MEF }));
    await expect(service.link("ie-1", "pos-1", { username: "bob" })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects linking a POS workbook from a different project", async () => {
    ieModel.findOne.mockReturnValue(query({ workbookId: "ie-1", projectId: "p-1", mef: {}, linkedPosWorkbookId: null }));
    posModel.findOne.mockReturnValue(query({ workbookId: "pos-2", projectId: "other", mef: POS_MEF }));
    await expect(service.link("ie-1", "pos-2", { username: "alice" })).rejects.toThrow();
  });
});
