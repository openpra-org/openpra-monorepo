import { Test, TestingModule } from "@nestjs/testing";
import { MetaTypedModelService } from "./meta-typed-model.service";

describe("MetaTypedModelService", () => {
  let service: MetaTypedModelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetaTypedModelService],
    }).compile();

    service = module.get<MetaTypedModelService>(MetaTypedModelService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
