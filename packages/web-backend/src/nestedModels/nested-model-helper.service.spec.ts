import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { NestedModelHelperService } from "./nested-model-helper.service";
import { InternalEvents } from "../typedModel/schemas/internal-events.schema";
import { InternalHazards } from "../typedModel/schemas/internal-hazards.schema";
import { ExternalHazards } from "../typedModel/schemas/external-hazards.schema";
import { FullScope } from "../typedModel/schemas/full-scope.schema";

describe("NestedModelHelperService", () => {
  let service: NestedModelHelperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NestedModelHelperService,
        { provide: getModelToken(InternalEvents.name), useValue: { findOneAndUpdate: jest.fn() } },
        { provide: getModelToken(InternalHazards.name), useValue: { findOneAndUpdate: jest.fn() } },
        { provide: getModelToken(ExternalHazards.name), useValue: { findOneAndUpdate: jest.fn() } },
        { provide: getModelToken(FullScope.name), useValue: { findOneAndUpdate: jest.fn() } },
      ],
    }).compile();

    service = module.get<NestedModelHelperService>(NestedModelHelperService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
