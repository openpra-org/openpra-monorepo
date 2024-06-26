import { Test, TestingModule } from "@nestjs/testing";
import { EventTreesService } from "./event-trees.service";

describe("EventTreesService", () => {
  let service: EventTreesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventTreesService],
    }).compile();

    service = module.get<EventTreesService>(EventTreesService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
