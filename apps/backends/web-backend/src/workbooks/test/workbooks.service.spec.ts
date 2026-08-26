import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { WorkbooksService } from "../workbooks.service";
import { Workbook } from "../workbook.schema";
import { User } from "../../users/user.schema";
import { ProjectsService } from "../../projects/projects.service";
import { WorkbookElementRegistry } from "../workbook-element-registry";
import { WorkbookRolesService } from "../workbook-roles.service";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";

function makeWorkbookDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const save = jest.fn().mockResolvedValue(undefined);
  const deleteOne = jest.fn().mockResolvedValue(undefined);
  return {
    _id: new Types.ObjectId().toHexString(),
    projectId: "proj-1",
    elementCode: "POS",
    name: "Aurora-1 POS analysis",
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
  let workbookModelMock: { find: jest.Mock; findById: jest.Mock; findOne: jest.Mock; create: jest.Mock };
  let userModelMock: { findOne: jest.Mock };
  let projectsServiceMock: { resolveAccess: jest.Mock };
  let elementRegistryMock: { tryGet: jest.Mock; list: jest.Mock };
  let rolesServiceMock: { createInitialPreparer: jest.Mock };
  let posAdapterMock: { elementCode: string; createBlank: jest.Mock };

  beforeEach(async () => {
    workbookModelMock = { find: jest.fn(), findById: jest.fn(), findOne: jest.fn(), create: jest.fn() };
    userModelMock = { findOne: jest.fn() };
    projectsServiceMock = { resolveAccess: jest.fn().mockResolvedValue({ doc: {}, role: "owner" }) };
    posAdapterMock = { elementCode: "POS", createBlank: jest.fn().mockResolvedValue(undefined) };
    elementRegistryMock = { tryGet: jest.fn().mockReturnValue(posAdapterMock), list: jest.fn().mockReturnValue([]) };
    rolesServiceMock = { createInitialPreparer: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkbooksService,
        { provide: getModelToken(Workbook.name), useValue: workbookModelMock },
        { provide: getModelToken(User.name), useValue: userModelMock },
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: WorkbookElementRegistry, useValue: elementRegistryMock },
        { provide: WorkbookRolesService, useValue: rolesServiceMock },
      ],
    }).compile();
    service = moduleRef.get(WorkbooksService);
  });

  describe("listWorkbooks", () => {
    it("returns workbooks scoped to the project and element with computed initials", async () => {
      const exec = jest.fn().mockResolvedValue([makeWorkbookDoc()]);
      workbookModelMock.find.mockReturnValue({ sort: () => ({ exec }) });

      const result = await service.listWorkbooks("proj-1", "POS", { username: "ada" });

      expect(projectsServiceMock.resolveAccess).toHaveBeenCalledWith("proj-1", { username: "ada" });
      expect(workbookModelMock.find).toHaveBeenCalledWith({ projectId: "proj-1", elementCode: "POS" });
      expect(result.workbooks).toHaveLength(1);
      expect(result.workbooks[0].ownerInitials).toBe("AL");
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
        { elementCode: "POS", name: "Aurora-1 POS analysis" },
        { username: "ada" },
      );

      const created = workbookModelMock.create.mock.calls[0][0] as Record<string, unknown>;
      expect(created.status).toBe("draft");
      expect(created.version).toBe(1);
      expect(created.ownerUsername).toBe("ada");
      expect(result.name).toBe("Aurora-1 POS analysis");
      expect(elementRegistryMock.tryGet).toHaveBeenCalledWith("POS");
      expect(posAdapterMock.createBlank).toHaveBeenCalled();
      expect(rolesServiceMock.createInitialPreparer).toHaveBeenCalled();
    });

    it("forbids viewers from creating workbooks", async () => {
      projectsServiceMock.resolveAccess.mockResolvedValue({ doc: {}, role: "viewer" });
      await expect(
        service.createWorkbook("proj-1", { elementCode: "POS", name: "X" }, { username: "bob" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
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

  describe("generateExamples", () => {
    it("reconciles generated DA and HRA values into the matching SY basic events", async () => {
      let syRevision = 1;
      let syMef = {
        systemBasicEvents: [{
          uuid: "be-1",
          code: "BE-1",
          name: "Pump fails",
          eventType: "BASIC",
          probability: 0.9,
          implementsSrs: [],
        }, {
          uuid: "be-hfe",
          code: "HFE-1",
          name: "Operator fails",
          eventType: "BASIC",
          failureMode: "HUMAN_ERROR",
          probability: 0.9,
          attributes: [{ name: "hfeReference", value: "hfe-1" }],
          implementsSrs: [],
        }],
        humanFailureEventIntegrations: [{
          uuid: "integration-1",
          hfeReference: "hfe-1",
          hfeType: "POST_INITIATOR",
          taskName: "Align cooling",
          integratedIntoModels: [],
          implementsSrs: [],
        }],
      } as unknown as SystemsAnalysis;
      const daMef = {
        parameters: [{
          uuid: "parameter-1",
          name: "Pump failure probability",
          parameterType: "PROBABILITY",
          value: 0.025,
          valueType: "POINT_ESTIMATE",
          basicEventRef: "be-1",
          implementsSrs: [],
        }],
      };
      const syAdapter = {
        elementCode: "SY",
        exampleVariants: () => [{ exampleId: "hcl", label: "Dissertation source", workbookName: "HCL SY" }],
        loadExample: jest.fn().mockResolvedValue(undefined),
        load: jest.fn(async () => ({ projectId: "proj-1", ownerUsername: "ada", mef: syMef, revision: syRevision })),
        save: jest.fn(async (_workbookId: string, mef: typeof syMef) => {
          syMef = mef;
          syRevision += 1;
          return mef;
        }),
      };
      const daAdapter = {
        elementCode: "DA",
        exampleVariants: () => [{ exampleId: "hcl", label: "Dissertation source", workbookName: "HCL DA" }],
        loadExample: jest.fn().mockResolvedValue(undefined),
        load: jest.fn().mockResolvedValue({ projectId: "proj-1", ownerUsername: "ada", mef: daMef, revision: 1 }),
      };
      const hrMef = {
        humanFailureEvents: [{ uuid: "hfe-1" }],
        hepQuantifications: [{ uuid: "hep-1", hfeId: "hfe-1", methodology: "THERP", meanHep: 0.037 }],
        recoveryActions: [],
      };
      const hrAdapter = {
        elementCode: "HRA",
        exampleVariants: () => [{ exampleId: "hcl", label: "Dissertation source", workbookName: "HCL HRA" }],
        loadExample: jest.fn().mockResolvedValue(undefined),
        load: jest.fn().mockResolvedValue({ projectId: "proj-1", ownerUsername: "ada", mef: hrMef, revision: 1 }),
      };
      elementRegistryMock.list.mockReturnValue([syAdapter, daAdapter, hrAdapter]);
      elementRegistryMock.tryGet.mockImplementation((elementCode: string) =>
        elementCode === "SY"
          ? syAdapter
          : elementCode === "DA"
            ? daAdapter
            : elementCode === "HRA"
              ? hrAdapter
              : undefined,
      );
      workbookModelMock.findOne.mockImplementation(({ elementCode }: { elementCode: string }) => ({
        exec: () => Promise.resolve({
          _id: elementCode === "SY"
            ? "sy-workbook"
            : elementCode === "DA"
              ? "da-workbook"
              : "hr-workbook",
        }),
      }));

      const result = await service.generateExamples("proj-1", "hcl", { username: "ada" });

      expect(result.generated).toEqual([
        expect.objectContaining({ elementCode: "SY", workbookId: "sy-workbook", action: "repopulated" }),
        expect.objectContaining({ elementCode: "DA", workbookId: "da-workbook", action: "repopulated" }),
        expect.objectContaining({ elementCode: "HRA", workbookId: "hr-workbook", action: "repopulated" }),
      ]);
      expect(syAdapter.save).toHaveBeenCalledWith(
        "sy-workbook",
        expect.objectContaining({
          systemBasicEvents: expect.arrayContaining([expect.objectContaining({
            probability: 0.025,
            controlledDataSource: {
              referenceType: "WORKBOOK_PARAMETER",
              workbookId: "da-workbook",
              entityId: "parameter-1",
            },
          })]),
        }),
        1,
      );
      expect(syAdapter.save).toHaveBeenNthCalledWith(
        2,
        "sy-workbook",
        expect.objectContaining({
          systemBasicEvents: expect.arrayContaining([
            expect.objectContaining({
              uuid: "be-hfe",
              probability: 0.037,
              controlledDataSource: {
                referenceType: "HUMAN_FAILURE_EVENT",
                workbookId: "hr-workbook",
                entityId: "hfe-1",
                quantificationId: "hep-1",
              },
            }),
          ]),
          humanFailureEventIntegrations: [expect.objectContaining({
            hfeSource: {
              referenceType: "HUMAN_FAILURE_EVENT",
              workbookId: "hr-workbook",
              entityId: "hfe-1",
              quantificationId: "hep-1",
            },
          })],
        }),
        2,
      );
    });
  });
});
