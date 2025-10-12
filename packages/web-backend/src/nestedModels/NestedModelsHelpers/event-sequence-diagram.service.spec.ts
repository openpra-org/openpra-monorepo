import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { EventSequenceDiagramService } from "./event-sequence-diagram.service";
import { EventSequenceDiagram } from "../schemas/event-sequence-diagram.schema";
import { NestedModelService } from "../nestedModel.service";
import { NestedModelHelperService } from "../nested-model-helper.service";
import { GraphModelService } from "../../graphModels/graphModel.service";

describe("EventSequenceDiagramService", () => {
  let service: EventSequenceDiagramService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventSequenceDiagramService,
        { provide: getModelToken(EventSequenceDiagram.name), useValue: { find: jest.fn(), findOne: jest.fn() } },
        { provide: NestedModelService, useValue: { getNextValue: jest.fn() } },
        {
          provide: NestedModelHelperService,
          useValue: { AddNestedModelToTypedModel: jest.fn(), RemoveNestedModelToTypedModel: jest.fn() },
        },
        { provide: GraphModelService, useValue: { saveEventSequenceDiagramGraph: jest.fn() } },
      ],
    }).compile();

    service = module.get<EventSequenceDiagramService>(EventSequenceDiagramService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
