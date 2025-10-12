import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { InitiatingEventsService } from "./initiating-events.service";
import { InitiatingEvent } from "../schemas/initiating-event.schema";
import { NestedModelService } from "../nestedModel.service";
import { NestedModelHelperService } from "../nested-model-helper.service";

describe("InitiatingEventsService", () => {
  let service: InitiatingEventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InitiatingEventsService,
        { provide: getModelToken(InitiatingEvent.name), useValue: { find: jest.fn(), findOne: jest.fn() } },
        { provide: NestedModelService, useValue: { getNextValue: jest.fn() } },
        {
          provide: NestedModelHelperService,
          useValue: { AddNestedModelToTypedModel: jest.fn(), RemoveNestedModelToTypedModel: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<InitiatingEventsService>(InitiatingEventsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
