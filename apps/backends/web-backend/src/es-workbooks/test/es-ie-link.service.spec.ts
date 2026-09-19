import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { EsIeLinkService } from "../es-ie-link.service";
import { ExampleWorkbooksService } from "../../example-workbooks/example-workbooks.service";
import { ProjectsService } from "../../projects/projects.service";
import { WorkbookRolesService } from "../../workbooks/workbook-roles.service";

function query<T>(value: T): { exec: jest.Mock } {
  return { exec: jest.fn().mockResolvedValue(value) };
}

const IE_MEF = {
  workflowState: "FINAL",
  initiators: [
    { uuid: "IEG-LOHS", name: "Loss of heat sink", category: "TRANSIENT" },
    { uuid: "IEG-RCB", name: "RCB breach", category: "RCB_BREACH" },
  ],
  initiatingEventGroups: [{ uuid: "G-1" }],
};

describe("EsIeLinkService", () => {
  let service: EsIeLinkService;
  let esModel: Record<string, jest.Mock>;
  let workbookModel: Record<string, jest.Mock>;
  let ieModel: Record<string, jest.Mock>;
  let projectsService: { resolveAccess: jest.Mock };
  let rolesService: { resolveEffectiveRoles: jest.Mock };

  beforeEach(async () => {
    esModel = { findOne: jest.fn(), findOneAndUpdate: jest.fn() };
    workbookModel = { find: jest.fn(), findById: jest.fn() };
    ieModel = { findOne: jest.fn() };
    projectsService = { resolveAccess: jest.fn().mockResolvedValue({ doc: {}, role: "editor" }) };
    rolesService = { resolveEffectiveRoles: jest.fn().mockResolvedValue(["preparer"]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EsIeLinkService,
        { provide: getModelToken("EsWorkbook"), useValue: esModel },
        { provide: getModelToken("Workbook"), useValue: workbookModel },
        { provide: getModelToken("IeWorkbook"), useValue: ieModel },
        { provide: ProjectsService, useValue: projectsService },
        { provide: WorkbookRolesService, useValue: rolesService },
        { provide: ExampleWorkbooksService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(EsIeLinkService);
  });

  it("throws when the ES workbook is missing", async () => {
    esModel.findOne.mockReturnValue(query(null));
    await expect(service.status("missing", { username: "alice" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("links an IE workbook and imports initiator ids into the ES scopeDefinition", async () => {
    const esDoc = { workbookId: "es-1", projectId: "p-1", revision: 1, mef: { scopeDefinition: { plantOperatingStateIds: ["POS-01"], initiatingEventIds: [], radioactiveMaterialSources: [], radionuclideBarriers: [] } }, linkedIeWorkbookId: null };
    esModel.findOne.mockReturnValue(query(esDoc));
    esModel.findOneAndUpdate.mockImplementation((_filter, update) => {
      Object.assign(esDoc, update.$set);
      return query(esDoc);
    });
    ieModel.findOne.mockReturnValue(query({ workbookId: "ie-1", projectId: "p-1", mef: IE_MEF, updatedAt: new Date() }));
    workbookModel.findById.mockReturnValue(query({ id: "ie-1", name: "IE Workbook Example" }));

    const status = await service.link("es-1", "ie-1", { username: "alice" });
    expect(esDoc.linkedIeWorkbookId).toBe("ie-1");
    const scope = (esDoc.mef as { scopeDefinition: { plantOperatingStateIds: string[]; initiatingEventIds: string[] } }).scopeDefinition;
    expect(scope.initiatingEventIds).toEqual(["IEG-LOHS", "IEG-RCB"]);
    expect(scope.plantOperatingStateIds).toEqual(["POS-01"]);
    expect(status.initiators).toHaveLength(2);
    expect(esDoc.revision).toBe(2);
    expect(esModel.findOneAndUpdate).toHaveBeenCalledWith(
      { workbookId: "es-1", $or: [{ revision: 1 }, { revision: { $exists: false } }] },
      expect.objectContaining({ $set: expect.objectContaining({ revision: 2 }) }),
      { new: true, runValidators: true },
    );
  });

  it("rejects a stale IE link without overwriting the ES workbook", async () => {
    const originalMef = { scopeDefinition: { initiatingEventIds: [] } };
    const esDoc = {
      workbookId: "es-1",
      projectId: "p-1",
      revision: 1,
      mef: originalMef,
      linkedIeWorkbookId: null,
    };
    esModel.findOne.mockReturnValue(query(esDoc));
    esModel.findOneAndUpdate.mockReturnValue(query(null));
    ieModel.findOne.mockReturnValue(
      query({ workbookId: "ie-1", projectId: "p-1", mef: IE_MEF }),
    );

    await expect(service.link("es-1", "ie-1", { username: "alice" })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(esDoc).toMatchObject({ revision: 1, mef: originalMef, linkedIeWorkbookId: null });
  });

  it("atomically advances the revision when unlinking an IE workbook", async () => {
    const esDoc = {
      workbookId: "es-1",
      projectId: "p-1",
      revision: 3,
      mef: { scopeDefinition: { initiatingEventIds: ["IEG-LOHS"] } },
      linkedIeWorkbookId: "ie-1",
    };
    esModel.findOne.mockReturnValue(query(esDoc));
    esModel.findOneAndUpdate.mockImplementation((_filter, update) => {
      Object.assign(esDoc, update.$set);
      return query(esDoc);
    });

    await service.unlink("es-1", { username: "alice" });

    expect(esDoc).toMatchObject({ revision: 4, linkedIeWorkbookId: null });
    expect(esModel.findOneAndUpdate).toHaveBeenCalledWith(
      { workbookId: "es-1", revision: 3 },
      expect.objectContaining({ $set: expect.objectContaining({ revision: 4 }) }),
      { new: true, runValidators: true },
    );
  });

  it("rejects link from a non-preparer", async () => {
    esModel.findOne.mockReturnValue(query({ workbookId: "es-1", projectId: "p-1", mef: { scopeDefinition: {} }, linkedIeWorkbookId: null }));
    rolesService.resolveEffectiveRoles.mockResolvedValue(["reviewer"]);
    ieModel.findOne.mockReturnValue(query({ workbookId: "ie-1", projectId: "p-1", mef: IE_MEF }));
    await expect(service.link("es-1", "ie-1", { username: "bob" })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
