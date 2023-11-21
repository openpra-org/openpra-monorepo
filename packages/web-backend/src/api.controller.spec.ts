import { Test, TestingModule } from "@nestjs/testing";
import { ApiController } from "./api.controller";
import { ApiService } from "./api.service";

describe("apiController", () => {
  let apiController: ApiController;

  beforeEach(async () => {
    const api: TestingModule = await Test.createTestingModule({
      controllers: [ApiController],
      providers: [ApiService],
    }).compile();

    apiController = api.get<ApiController>(ApiController);
  });

  describe("root", () => {
    it('should return "Hello World!"', () => {
      expect(apiController.getHello()).toBe("Hello World!");
    });
  });
});
