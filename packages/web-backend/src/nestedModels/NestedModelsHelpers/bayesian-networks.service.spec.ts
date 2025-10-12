import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { BayesianNetworksService } from "./bayesian-networks.service";
import { BayesianNetwork } from "../schemas/bayesian-network.schema";
import { NestedModelService } from "../nestedModel.service";
import { NestedModelHelperService } from "../nested-model-helper.service";

describe("BayesianNetworksService", () => {
  let service: BayesianNetworksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BayesianNetworksService,
        { provide: getModelToken(BayesianNetwork.name), useValue: { find: jest.fn(), findOne: jest.fn() } },
        { provide: NestedModelService, useValue: { getNextValue: jest.fn() } },
        {
          provide: NestedModelHelperService,
          useValue: { AddNestedModelToTypedModel: jest.fn(), RemoveNestedModelToTypedModel: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<BayesianNetworksService>(BayesianNetworksService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
