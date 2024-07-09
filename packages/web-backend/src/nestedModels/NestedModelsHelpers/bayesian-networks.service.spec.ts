import { Test, TestingModule } from "@nestjs/testing";
import { BayesianNetworksService } from "./bayesian-networks.service";

describe("BayesianNetworksService", () => {
  let service: BayesianNetworksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BayesianNetworksService],
    }).compile();

    service = module.get<BayesianNetworksService>(BayesianNetworksService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
