import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { FaultTreesService } from "./fault-trees.service";
import { FaultTree } from "../schemas/fault-tree.schema";
import { NestedModelService } from "../nestedModel.service";
import { NestedModelHelperService } from "../nested-model-helper.service";

describe("FaultTreesService", () => {
  let service: FaultTreesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaultTreesService,
        { provide: getModelToken(FaultTree.name), useValue: { find: jest.fn(), findOne: jest.fn() } },
        { provide: NestedModelService, useValue: { getNextValue: jest.fn() } },
        {
          provide: NestedModelHelperService,
          useValue: { AddNestedModelToTypedModel: jest.fn(), RemoveNestedModelToTypedModel: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<FaultTreesService>(FaultTreesService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
