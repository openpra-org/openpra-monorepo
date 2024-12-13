import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ModelCounter, ModelCounterSchema } from "../schemas/model-counter.schema";
import { TypedModelController } from "./typedModel.controller";
import { TypedModelService } from "./typedModel.service";
import { InternalEvents, InternalEventsSchema, InternalEventsMetadata } from "./schemas/internal-events.schema";
import { InternalHazards, InternalHazardsSchema, InternalHazardsMetadata } from "./schemas/internal-hazards.schema";
import { ExternalHazards, ExternalHazardsSchema, ExternalHazardsMetadata } from "./schemas/external-hazards.schema";
import { FullScope, FullScopeSchema, FullScopeMetadata } from "./schemas/full-scope.schema";
import { MetaTypedModelController } from "./metadata/meta-typed-model.controller";
import { MetaTypedModelService } from "./metadata/meta-typed-model.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InternalEvents.name, schema: InternalEventsSchema },
      { name: InternalHazards.name, schema: InternalHazardsSchema },
      { name: ExternalHazards.name, schema: ExternalHazardsSchema },
      { name: FullScope.name, schema: FullScopeSchema },
      { name: ModelCounter.name, schema: ModelCounterSchema },
      { name: InternalEventsMetadata.name, schema: InternalEventsSchema },
      { name: InternalHazardsMetadata.name, schema: InternalHazardsSchema },
      { name: ExternalHazardsMetadata.name, schema: ExternalHazardsSchema },
      { name: FullScopeMetadata.name, schema: FullScopeSchema },
    ]),
  ],
  controllers: [TypedModelController, MetaTypedModelController],
  providers: [TypedModelService, MetaTypedModelService],
  exports: [TypedModelService, MetaTypedModelService],
})
export class TypedModelModule {}
