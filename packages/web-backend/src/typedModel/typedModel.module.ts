import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  ModelCounter,
  ModelCounterSchema,
} from "../schemas/model-counter.schema";
import { TypedModelController } from "./typedModel.controller";
import { TypedModelService } from "./typedModel.service";
import {
  InternalEvents,
  InternalEventsSchema,
} from "./schemas/internal-events.schema";
import {
  InternalHazards,
  InternalHazardsSchema,
} from "./schemas/internal-hazards.schema";
import {
  ExternalHazards,
  ExternalHazardsSchema,
} from "./schemas/external-hazards.schema";
import { FullScope, FullScopeSchema } from "./schemas/full-scope.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InternalEvents.name, schema: InternalEventsSchema },
      { name: InternalHazards.name, schema: InternalHazardsSchema },
      { name: ExternalHazards.name, schema: ExternalHazardsSchema },
      { name: FullScope.name, schema: FullScopeSchema },
      { name: ModelCounter.name, schema: ModelCounterSchema },
    ]),
  ],
  controllers: [TypedModelController],
  providers: [TypedModelService],
  exports: [TypedModelService],
})
export class TypedModelModule {}
