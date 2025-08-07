import { Test, TestingModule } from "@nestjs/testing";
import { ModelFactoryService } from "./modelFactory.service";

describe("ModelFactoryServiceService", () => {
  let service: ModelFactoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ModelFactoryService],
    }).compile();

    service = module.get<ModelFactoryService>(ModelFactoryService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
