import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { EventTreesService } from "./event-trees.service";
import { EventTree } from "../schemas/event-tree.schema";
import { NestedModelService } from "../nestedModel.service";
import { NestedModelHelperService } from "../nested-model-helper.service";

describe("EventTreesService", () => {
  let service: EventTreesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventTreesService,
        { provide: getModelToken(EventTree.name), useValue: { find: jest.fn(), findOne: jest.fn() } },
        { provide: NestedModelService, useValue: { getNextValue: jest.fn() } },
        {
          provide: NestedModelHelperService,
          useValue: { AddNestedModelToTypedModel: jest.fn(), RemoveNestedModelToTypedModel: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<EventTreesService>(EventTreesService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
