import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { getModelToken } from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";
import { ProjectsService } from "../../../projects/projects.service";
import { FaultTreeBasicEventCatalogueRecord } from "../fault-tree-basic-event-catalogue-record.schema";
import { FaultTreeBasicEventCataloguesService } from "../fault-tree-basic-event-catalogues.service";

const BASIC_EVENT_ID = "123e4567-e89b-42d3-a456-426614174202";

const basicEvent = {
  id: BASIC_EVENT_ID,
  code: "BE-PUMP-A",
  name: "Pump A fails",
  description: "Pump A fails on demand.",
  probability: { value: 0.1 },
};

function makeCatalogue(revision = 1): Record<string, unknown> {
  return {
    schemaVersion: "1.0.0",
    projectId: "project-1",
    revision,
    createdBy: "ada",
    createdAt: "2026-08-21T12:00:00.000Z",
    updatedBy: "ada",
    updatedAt: "2026-08-21T12:00:00.000Z",
    basicEvents: [basicEvent],
  };
}

describe("FaultTreeBasicEventCataloguesService", () => {
  let service: FaultTreeBasicEventCataloguesService;
  let catalogueModel: {
    create: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    exists: jest.Mock;
  };
  let projectsService: { resolveAccess: jest.Mock };

  beforeEach(async () => {
    catalogueModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      exists: jest.fn(),
    };
    projectsService = {
      resolveAccess: jest.fn().mockResolvedValue({ role: "member" }),
    };
    const module = await Test.createTestingModule({
      providers: [
        FaultTreeBasicEventCataloguesService,
        {
          provide: getModelToken(FaultTreeBasicEventCatalogueRecord.name),
          useValue: catalogueModel,
        },
        { provide: ProjectsService, useValue: projectsService },
      ],
    }).compile();
    service = module.get(FaultTreeBasicEventCataloguesService);
  });

  it("creates the singleton project catalogue at revision one", async () => {
    catalogueModel.create.mockImplementation(async (record: Record<string, unknown>) => record);

    const result = await service.create(
      "project-1",
      {
        schemaVersion: "1.0.0",
        projectId: "project-1",
        createdBy: "ada",
        basicEvents: [basicEvent],
      },
      { username: "ada" },
    );

    expect(result).toMatchObject({ projectId: "project-1", revision: 1, basicEvents: [basicEvent] });
    expect(catalogueModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "project-1", revision: 1 }),
    );
  });

  it("loads a catalogue only after resolving project access", async () => {
    catalogueModel.findOne.mockReturnValue({ exec: () => Promise.resolve({ catalogue: makeCatalogue() }) });

    await expect(service.load("project-1", { username: "ada" })).resolves.toMatchObject({
      projectId: "project-1",
      revision: 1,
    });
    expect(projectsService.resolveAccess).toHaveBeenCalledWith("project-1", { username: "ada" });
  });

  it("patches probabilities atomically using the expected revision", async () => {
    const updated = makeCatalogue(2);
    updated.basicEvents = [{ ...basicEvent, probability: { value: 0.2 } }];
    catalogueModel.findOneAndUpdate.mockReturnValue({
      exec: () => Promise.resolve({ catalogue: updated }),
    });

    const result = await service.patch(
      "project-1",
      {
        schemaVersion: "1.0.0",
        projectId: "project-1",
        expectedRevision: 1,
        updatedBy: "ada",
        basicEvents: [{ ...basicEvent, probability: { value: 0.2 } }],
      },
      { username: "ada" },
    );

    expect(result.revision).toBe(2);
    expect(result.basicEvents[0]?.probability.value).toBe(0.2);
    expect(catalogueModel.findOneAndUpdate).toHaveBeenCalledWith(
      { projectId: "project-1", revision: 1 },
      expect.objectContaining({ $inc: { revision: 1, "catalogue.revision": 1 } }),
      { new: true, runValidators: true },
    );
  });

  it("returns a conflict when an existing catalogue revision is stale", async () => {
    catalogueModel.findOneAndUpdate.mockReturnValue({ exec: () => Promise.resolve(null) });
    catalogueModel.exists.mockResolvedValue({ _id: "catalogue" });

    await expect(
      service.patch(
        "project-1",
        {
          schemaVersion: "1.0.0",
          projectId: "project-1",
          expectedRevision: 1,
          updatedBy: "ada",
          basicEvents: [basicEvent],
        },
        { username: "ada" },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("returns not found when patching a missing catalogue", async () => {
    catalogueModel.findOneAndUpdate.mockReturnValue({ exec: () => Promise.resolve(null) });
    catalogueModel.exists.mockResolvedValue(null);

    await expect(
      service.patch(
        "project-1",
        {
          schemaVersion: "1.0.0",
          projectId: "project-1",
          expectedRevision: 1,
          updatedBy: "ada",
          basicEvents: [basicEvent],
        },
        { username: "ada" },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("blocks viewers from creating or updating the catalogue", async () => {
    projectsService.resolveAccess.mockResolvedValue({ role: "viewer" });
    const create = service.create(
      "project-1",
      {
        schemaVersion: "1.0.0",
        projectId: "project-1",
        createdBy: "ada",
        basicEvents: [],
      },
      { username: "ada" },
    );
    const patch = service.patch(
      "project-1",
      {
        schemaVersion: "1.0.0",
        projectId: "project-1",
        expectedRevision: 1,
        updatedBy: "ada",
        basicEvents: [],
      },
      { username: "ada" },
    );

    await expect(create).rejects.toBeInstanceOf(ForbiddenException);
    await expect(patch).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects route and authenticated-user mismatches", async () => {
    await expect(
      service.create(
        "project-1",
        {
          schemaVersion: "1.0.0",
          projectId: "other-project",
          createdBy: "ada",
          basicEvents: [],
        },
        { username: "ada" },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.patch(
        "project-1",
        {
          schemaVersion: "1.0.0",
          projectId: "project-1",
          expectedRevision: 1,
          updatedBy: "grace",
          basicEvents: [],
        },
        { username: "ada" },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("loads an optional immutable snapshot for validation and execution", async () => {
    catalogueModel.findOne.mockReturnValueOnce({
      exec: () => Promise.resolve({ catalogue: makeCatalogue() }),
    });
    catalogueModel.findOne.mockReturnValueOnce({ exec: () => Promise.resolve(null) });

    await expect(service.loadSnapshot("project-1")).resolves.toMatchObject({ revision: 1 });
    await expect(service.loadSnapshot("missing-project")).resolves.toBeUndefined();
  });
});
