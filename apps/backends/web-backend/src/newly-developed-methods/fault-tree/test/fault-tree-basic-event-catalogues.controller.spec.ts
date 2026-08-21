import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { FaultTreeBasicEventCataloguesController } from "../fault-tree-basic-event-catalogues.controller";
import { FaultTreeBasicEventCataloguesService } from "../fault-tree-basic-event-catalogues.service";

describe("FaultTreeBasicEventCataloguesController", () => {
  let controller: FaultTreeBasicEventCataloguesController;
  let service: { create: jest.Mock; load: jest.Mock; patch: jest.Mock };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ revision: 1 }),
      load: jest.fn().mockResolvedValue({ revision: 1 }),
      patch: jest.fn().mockResolvedValue({ revision: 2 }),
    };
    const module = await Test.createTestingModule({
      controllers: [FaultTreeBasicEventCataloguesController],
      providers: [{ provide: FaultTreeBasicEventCataloguesService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(FaultTreeBasicEventCataloguesController);
  });

  const authenticatedRequest = { user: { username: "ada" } } as never;

  it("forwards create, load, and patch requests with the authenticated username", async () => {
    const createRequest = {
      schemaVersion: "1.0.0" as const,
      projectId: "project-1",
      createdBy: "ada",
      basicEvents: [],
    };
    const patchRequest = {
      schemaVersion: "1.0.0" as const,
      projectId: "project-1",
      expectedRevision: 1,
      updatedBy: "ada",
      basicEvents: [],
    };

    await controller.create("project-1", createRequest, authenticatedRequest);
    await controller.load("project-1", authenticatedRequest);
    await controller.patch("project-1", patchRequest, authenticatedRequest);

    expect(service.create).toHaveBeenCalledWith("project-1", createRequest, { username: "ada" });
    expect(service.load).toHaveBeenCalledWith("project-1", { username: "ada" });
    expect(service.patch).toHaveBeenCalledWith("project-1", patchRequest, { username: "ada" });
  });
});
