import { Test, TestingModule } from "@nestjs/testing";
import { EventSequenceAnalysisService } from "./event-sequence-analysis.service";

describe("EventSequenceAnalysisService", () => {
  let service: EventSequenceAnalysisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventSequenceAnalysisService],
    }).compile();

    service = module.get<EventSequenceAnalysisService>(EventSequenceAnalysisService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
