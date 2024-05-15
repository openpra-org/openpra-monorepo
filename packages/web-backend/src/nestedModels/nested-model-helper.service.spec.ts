import { Test, TestingModule } from "@nestjs/testing";
import { NestedModelHelperService } from "./nested-model-helper.service";

describe("NestedModelHelperService", () => {
  let service: NestedModelHelperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NestedModelHelperService],
    }).compile();

    service = module.get<NestedModelHelperService>(NestedModelHelperService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
