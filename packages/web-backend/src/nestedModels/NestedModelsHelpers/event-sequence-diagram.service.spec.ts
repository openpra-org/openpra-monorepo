import { Test, TestingModule } from "@nestjs/testing";
import { EventSequenceDiagramService } from "./event-sequence-diagram.service";

describe("EventSequenceDiagramService", () => {
  let service: EventSequenceDiagramService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventSequenceDiagramService],
    }).compile();

    service = module.get<EventSequenceDiagramService>(EventSequenceDiagramService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
