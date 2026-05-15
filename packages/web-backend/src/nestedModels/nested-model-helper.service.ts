import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { InternalEvents, InternalEventsDocument } from "../typedModel/schemas/internal-events.schema";
import { InternalHazards, InternalHazardsDocument } from "../typedModel/schemas/internal-hazards.schema";
import { ExternalHazards, ExternalHazardsDocument } from "../typedModel/schemas/external-hazards.schema";
import { FullScope, FullScopeDocument } from "../typedModel/schemas/full-scope.schema";
export type TypedModelType = "InternalEvents" | "InternalHazards" | "ExternalHazards" | "FullScope";
export type NestedModelType =
  | "initiatingEvents"
  | "eventSequenceDiagrams"
  | "eventSequenceAnalysis"
  | "functionalEvents"
  | "eventTrees"
  | "faultTrees"
  | "bayesianNetworks"
  | "markovChains"
  | "bayesianEstimations"
  | "weibullAnalysis";
@Injectable()
export class NestedModelHelperService {
  private readonly logger = new Logger(NestedModelHelperService.name);
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
    const numericId = Number(typedModelId);
    if (isNaN(numericId)) {
      this.logger.warn(
        `AddNestedModelToTypedModel: skipping — cannot convert parentId "${typedModelId}" to a numeric id (${typedModel}.${nestedModel})`,
      );
      return;
    }
    switch (typedModel) {
      case "InternalEvents":
        await this.internalEventsModel.findOneAndUpdate(
          { id: numericId },
          { $push: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case "InternalHazards":
        await this.internalHazardsModel.findOneAndUpdate(
          { id: numericId },
          { $push: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case "ExternalHazards":
        await this.externalHazardsModel.findOneAndUpdate(
          { id: numericId },
          { $push: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case "FullScope":
        await this.fullScopeModel.findOneAndUpdate(
          { id: numericId },
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
    const numericId = Number(typedModelId);
    if (isNaN(numericId)) {
      this.logger.warn(
        `RemoveNestedModelToTypedModel: skipping — cannot convert parentId "${typedModelId}" to a numeric id (${typedModel}.${nestedModel})`,
      );
      return;
    }
    switch (typedModel) {
      case "InternalEvents":
        await this.internalEventsModel.findOneAndUpdate(
          { id: numericId },
          { $pull: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case "InternalHazards":
        await this.internalHazardsModel.findOneAndUpdate(
          { id: numericId },
          { $pull: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case "ExternalHazards":
        await this.externalHazardsModel.findOneAndUpdate(
          { id: numericId },
          { $pull: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case "FullScope":
        await this.fullScopeModel.findOneAndUpdate(
          { id: numericId },
          { $pull: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
    }
  }
}
