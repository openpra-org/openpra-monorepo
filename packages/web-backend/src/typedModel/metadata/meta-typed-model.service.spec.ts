import { Test, TestingModule } from "@nestjs/testing";
import { MongooseModule } from "@nestjs/mongoose";
import { MetaTypedModelService } from "./meta-typed-model.service";
import { InternalEvents, InternalEventsSchema } from "../schemas/internal-events.schema";

describe("MetaTypedModelService", () => {
  let service: MetaTypedModelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(process.env.MONGO_URI as string),
        MongooseModule.forFeature([{ name: InternalEvents.name, schema: InternalEventsSchema }]),
      ],
      providers: [MetaTypedModelService],
    }).compile();

    service = module.get<MetaTypedModelService>(MetaTypedModelService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
