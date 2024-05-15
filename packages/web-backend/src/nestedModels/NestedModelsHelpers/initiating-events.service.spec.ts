import { Test, TestingModule } from "@nestjs/testing";
import { InitiatingEventsService } from "./initiating-events.service";

describe("InitiatingEventsService", () => {
  let service: InitiatingEventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InitiatingEventsService],
    }).compile();

    service = module.get<InitiatingEventsService>(InitiatingEventsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
