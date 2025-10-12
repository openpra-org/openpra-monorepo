import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { EventSequenceAnalysisService } from "./event-sequence-analysis.service";
import { EventSequenceAnalysis } from "../schemas/event-sequence-analysis.schema";
import { NestedModelService } from "../nestedModel.service";
import { NestedModelHelperService } from "../nested-model-helper.service";

describe("EventSequenceAnalysisService", () => {
  let service: EventSequenceAnalysisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventSequenceAnalysisService,
        { provide: getModelToken(EventSequenceAnalysis.name), useValue: { find: jest.fn(), findOne: jest.fn() } },
        { provide: NestedModelService, useValue: { getNextValue: jest.fn() } },
        {
          provide: NestedModelHelperService,
          useValue: { AddNestedModelToTypedModel: jest.fn(), RemoveNestedModelToTypedModel: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<EventSequenceAnalysisService>(EventSequenceAnalysisService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
