import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { InternalEvents, InternalEventsDocument } from "../typedModel/schemas/internal-events.schema";
import { InternalHazards, InternalHazardsDocument } from "../typedModel/schemas/internal-hazards.schema";
import { ExternalHazards, ExternalHazardsDocument } from "../typedModel/schemas/external-hazards.schema";
import { FullScope, FullScopeDocument } from "../typedModel/schemas/full-scope.schema";

export type TypedModelType = "internalEvents" | "internalHazards" | "externalHazards" | "fullScope";

export type NestedModelType =
  | "initiatingEvents"
  | "eventSequenceDiagrams"
  | "functionalEvents"
  | "eventTrees"
  | "faultTrees"
  | "bayesianNetworks"
  | "markovChains"
  | "bayesianEstimations"
  | "weibullAnalysis";

@Injectable()
export class NestedModelHelperService {
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

  async AddNestedModelToTypedModel(
    typedModel: TypedModelType,
    nestedModel: NestedModelType,
    typedModelId: string,
    nestedModelId: string,
  ): Promise<void> {
    switch (typedModel) {
      case "internalEvents":
        await this.internalEventsModel.findOneAndUpdate(
          { _id: typedModelId },
          { $push: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case "internalHazards":
        await this.internalHazardsModel.findOneAndUpdate(
          { _id: typedModelId },
          { $push: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case "externalHazards":
        await this.externalHazardsModel.findOneAndUpdate(
          { _id: typedModelId },
          { $push: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case "fullScope":
        await this.fullScopeModel.findOneAndUpdate(
          { _id: typedModelId },
          { $push: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
    }
  }

  async RemoveNestedModelToTypedModel(
    typedModel: TypedModelType,
    nestedModel: NestedModelType,
    typedModelId: string,
    nestedModelId: string,
  ): Promise<void> {
    switch (typedModel) {
      case "internalEvents":
        await this.internalEventsModel.findOneAndUpdate(
          { _id: typedModelId },
          { $pull: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case "internalHazards":
        await this.internalHazardsModel.findOneAndUpdate(
          { _id: typedModelId },
          { $pull: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case "externalHazards":
        await this.externalHazardsModel.findOneAndUpdate(
          { _id: typedModelId },
          { $pull: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case "fullScope":
        await this.fullScopeModel.findOneAndUpdate(
          { _id: typedModelId },
          { $pull: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
    }
  }
}
