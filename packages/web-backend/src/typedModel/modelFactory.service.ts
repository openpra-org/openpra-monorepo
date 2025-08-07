import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { InternalEvents, InternalEventsDocument } from "./schemas/internal-events.schema";
import { InternalHazards, InternalHazardsDocument } from "./schemas/internal-hazards.schema";
import { ExternalHazards, ExternalHazardsDocument } from "./schemas/external-hazards.schema";
import { FullScope, FullScopeDocument } from "./schemas/full-scope.schema";
import { TYPED_MODEL_NAMES, TypedModelName } from "shared-types/src/openpra-mef-types/api/TypedModelRequest";
import { Model } from "mongoose";

// Factory service to provide the mongoose model based on the typed model name

@Injectable()
export class ModelFactoryService {
  constructor(
    @InjectModel(InternalEvents.name)
    private readonly internalEventsModel: Model<InternalEventsDocument>,

    @InjectModel(InternalHazards.name)
    private readonly internalHazardsModel: Model<InternalHazardsDocument>,

    @InjectModel(ExternalHazards.name)
    private readonly externalHazardsModel: Model<ExternalHazardsDocument>,

    @InjectModel(FullScope.name)
    private readonly fullScopeModel: Model<FullScopeDocument>,
  ) {}

  private readonly modelMap: Record<TypedModelName, Model<any>> = {
    [TYPED_MODEL_NAMES.INTERNAL_EVENTS]: this.internalEventsModel,
    [TYPED_MODEL_NAMES.INTERNAL_HAZARDS]: this.internalHazardsModel,
    [TYPED_MODEL_NAMES.EXTERNAL_HAZARDS]: this.externalHazardsModel,
    [TYPED_MODEL_NAMES.FULL_SCOPE]: this.fullScopeModel,
  };

  // Getter for the service to provide mongoose model based on the typed model name
  getModel(modelName: TypedModelName): Model<any> {
    const model = this.modelMap[modelName];
    if (!model) {
      throw new Error(`Model for name "${modelName}" not found.`);
    }
    return model;
  }
}
