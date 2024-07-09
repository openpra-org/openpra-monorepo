import { Test, TestingModule } from "@nestjs/testing";
import { FaultTreesService } from "./fault-trees.service";

describe("FaultTreesService", () => {
  let service: FaultTreesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FaultTreesService],
    }).compile();

    service = module.get<FaultTreesService>(FaultTreesService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
