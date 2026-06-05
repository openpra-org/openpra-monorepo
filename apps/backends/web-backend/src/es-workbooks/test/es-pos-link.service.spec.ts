import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { EsPosLinkService } from "../es-pos-link.service";
import { ExampleWorkbooksService } from "../../example-workbooks/example-workbooks.service";
import { ProjectsService } from "../../projects/projects.service";
import { WorkbookRolesService } from "../../workbooks/workbook-roles.service";

function query<T>(value: T): { exec: jest.Mock } {
  return { exec: jest.fn().mockResolvedValue(value) };
}

const POS_MEF = {
  workflowState: "FINAL",
  plantOperatingStates: [
    { uuid: "POS-01", name: "Full power", operatingMode: "POWER", meanDurationHours: 7000, meanEntryFrequency: 1, radioactiveMaterialSources: [{ uuid: "SRC-1", name: "In-core fuel", location: "IN_CORE", barriers: ["Cladding", "Containment"] }] },
    { uuid: "POS-02", name: "Hot standby", operatingMode: "STARTUP", meanDurationHours: 200, meanEntryFrequency: { value: 0.5 }, radioactiveMaterialSources: [] },
  ],
};

describe("EsPosLinkService", () => {
  let service: EsPosLinkService;
  let esModel: Record<string, jest.Mock>;
  let workbookModel: Record<string, jest.Mock>;
  let posModel: Record<string, jest.Mock>;
  let projectsService: { resolveAccess: jest.Mock };
  let rolesService: { resolveEffectiveRoles: jest.Mock };

  beforeEach(async () => {
    esModel = { findOne: jest.fn() };
    workbookModel = { find: jest.fn(), findById: jest.fn() };
    posModel = { findOne: jest.fn() };
    projectsService = { resolveAccess: jest.fn().mockResolvedValue({ doc: {}, role: "editor" }) };
    rolesService = { resolveEffectiveRoles: jest.fn().mockResolvedValue(["preparer"]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EsPosLinkService,
        { provide: getModelToken("EsWorkbook"), useValue: esModel },
        { provide: getModelToken("Workbook"), useValue: workbookModel },
        { provide: getModelToken("PosWorkbook"), useValue: posModel },
        { provide: ProjectsService, useValue: projectsService },
        { provide: WorkbookRolesService, useValue: rolesService },
        { provide: ExampleWorkbooksService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(EsPosLinkService);
  });

  it("throws when the ES workbook is missing", async () => {
    esModel.findOne.mockReturnValue(query(null));
    await expect(service.status("missing", { username: "alice" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("links a POS workbook and imports its state ids into the ES scopeDefinition", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const esDoc = { workbookId: "es-1", projectId: "p-1", mef: { scopeDefinition: { plantOperatingStateIds: [], initiatingEventIds: ["IE-01"], radioactiveMaterialSources: [], radionuclideBarriers: [] } }, linkedPosWorkbookId: null, save };
    esModel.findOne.mockReturnValue(query(esDoc));
    posModel.findOne.mockReturnValue(query({ workbookId: "pos-1", projectId: "p-1", mef: POS_MEF, updatedAt: new Date() }));
    workbookModel.findById.mockReturnValue(query({ id: "pos-1", name: "POS Workbook Example" }));

    const status = await service.link("es-1", "pos-1", { username: "alice" });
    expect(esDoc.linkedPosWorkbookId).toBe("pos-1");
    const scope = (esDoc.mef as { scopeDefinition: { plantOperatingStateIds: string[]; initiatingEventIds: string[]; radionuclideBarriers: string[] } }).scopeDefinition;
    expect(scope.plantOperatingStateIds).toEqual(["POS-01", "POS-02"]);
    expect(scope.initiatingEventIds).toEqual(["IE-01"]);
    expect(scope.radionuclideBarriers).toEqual(["Cladding", "Containment"]);
    expect(status.states).toHaveLength(2);
    expect(status.sources).toHaveLength(1);
    expect(save).toHaveBeenCalled();
  });

  it("rejects link from a non-preparer", async () => {
    esModel.findOne.mockReturnValue(query({ workbookId: "es-1", projectId: "p-1", mef: { scopeDefinition: {} }, linkedPosWorkbookId: null }));
    rolesService.resolveEffectiveRoles.mockResolvedValue(["reviewer"]);
    posModel.findOne.mockReturnValue(query({ workbookId: "pos-1", projectId: "p-1", mef: POS_MEF }));
    await expect(service.link("es-1", "pos-1", { username: "bob" })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects linking a POS workbook from a different project", async () => {
    esModel.findOne.mockReturnValue(query({ workbookId: "es-1", projectId: "p-1", mef: { scopeDefinition: {} }, linkedPosWorkbookId: null }));
    posModel.findOne.mockReturnValue(query({ workbookId: "pos-2", projectId: "other", mef: POS_MEF }));
    await expect(service.link("es-1", "pos-2", { username: "alice" })).rejects.toThrow();
  });
});
