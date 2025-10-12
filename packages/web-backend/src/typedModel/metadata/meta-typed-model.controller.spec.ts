import { Test, TestingModule } from "@nestjs/testing";
import { MongooseModule } from "@nestjs/mongoose";
import { MetaTypedModelController } from "./meta-typed-model.controller";
import { MetaTypedModelService } from "./meta-typed-model.service";
import { InternalEvents, InternalEventsSchema } from "../schemas/internal-events.schema";

describe("MetaTypedModelController", () => {
  let controller: MetaTypedModelController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(process.env.MONGO_URI as string),
        MongooseModule.forFeature([{ name: InternalEvents.name, schema: InternalEventsSchema }]),
      ],
      controllers: [MetaTypedModelController],
      providers: [MetaTypedModelService],
    }).compile();

    controller = module.get<MetaTypedModelController>(MetaTypedModelController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
