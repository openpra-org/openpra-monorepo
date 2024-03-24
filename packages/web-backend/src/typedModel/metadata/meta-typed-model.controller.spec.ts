import { Test, TestingModule } from "@nestjs/testing";
import { MetaTypedModelController } from "./meta-typed-model.controller";

describe("MetaTypedModelController", () => {
  let controller: MetaTypedModelController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetaTypedModelController],
    }).compile();

    controller = module.get<MetaTypedModelController>(MetaTypedModelController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
