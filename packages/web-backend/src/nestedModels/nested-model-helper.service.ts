import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  InternalEvents,
  InternalEventsDocument,
} from '../typedModel/schemas/internal-events.schema';
import {
  InternalHazards,
  InternalHazardsDocument,
} from '../typedModel/schemas/internal-hazards.schema';
import {
  ExternalHazards,
  ExternalHazardsDocument,
} from '../typedModel/schemas/external-hazards.schema';
import {
  FullScope,
  FullScopeDocument,
} from '../typedModel/schemas/full-scope.schema';

/**
 * Union of supported typed model collection names.
 */
export type TypedModelType =
  | 'InternalEvents'
  | 'InternalHazards'
  | 'ExternalHazards'
  | 'FullScope';

/**
 * Union of supported nested model property keys used in typed models.
 */
export type NestedModelType =
  | 'initiatingEvents'
  | 'eventSequenceDiagrams'
  | 'eventSequenceAnalysis'
  | 'functionalEvents'
  | 'eventTrees'
  | 'faultTrees'
  | 'bayesianNetworks'
  | 'markovChains'
  | 'bayesianEstimations'
  | 'weibullAnalysis';

/**
 * Helper service to link nested models to typed models and perform common updates.
 * Used by feature-specific nested model services.
 */
@Injectable()
export class NestedModelHelperService {
  /**
   * Construct the helper with injected typed model collections.
   *
   * @param internalEventsModel - Mongoose model for Internal Events typed models
   * @param internalHazardsModel - Mongoose model for Internal Hazards typed models
   * @param externalHazardsModel - Mongoose model for External Hazards typed models
   * @param fullScopeModel - Mongoose model for Full Scope typed models
   */
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

  /**
   * Link a nested model document into a typed model document by pushing its id into the appropriate array field.
   *
   * @param typedModel - Target typed model collection name
   * @param nestedModel - Nested model property key to update on the typed model
   * @param typedModelId - ID of the typed model document
   * @param nestedModelId - ID of the nested model to link
   */
  async AddNestedModelToTypedModel(
    typedModel: TypedModelType,
    nestedModel: NestedModelType,
    typedModelId: string,
    nestedModelId: string,
  ): Promise<void> {
    switch (typedModel) {
      case 'InternalEvents':
        await this.internalEventsModel.findOneAndUpdate(
          { _id: typedModelId },
          { $push: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case 'InternalHazards':
        await this.internalHazardsModel.findOneAndUpdate(
          { _id: typedModelId },
          { $push: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case 'ExternalHazards':
        await this.externalHazardsModel.findOneAndUpdate(
          { _id: typedModelId },
          { $push: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case 'FullScope':
        await this.fullScopeModel.findOneAndUpdate(
          { _id: typedModelId },
          { $push: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
    }
  }

  /**
   * Unlink a nested model document from a typed model document by pulling its id from the appropriate array field.
   *
   * @param typedModel - Target typed model collection name
   * @param nestedModel - Nested model property key to update on the typed model
   * @param typedModelId - ID of the typed model document
   * @param nestedModelId - ID of the nested model to unlink
   */
  async RemoveNestedModelToTypedModel(
    typedModel: TypedModelType,
    nestedModel: NestedModelType,
    typedModelId: string,
    nestedModelId: string,
  ): Promise<void> {
    switch (typedModel) {
      case 'InternalEvents':
        await this.internalEventsModel.findOneAndUpdate(
          { _id: typedModelId },
          { $pull: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case 'InternalHazards':
        await this.internalHazardsModel.findOneAndUpdate(
          { _id: typedModelId },
          { $pull: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case 'ExternalHazards':
        await this.externalHazardsModel.findOneAndUpdate(
          { _id: typedModelId },
          { $pull: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
      case 'FullScope':
        await this.fullScopeModel.findOneAndUpdate(
          { _id: typedModelId },
          { $pull: { [nestedModel]: nestedModelId } },
          { new: true },
        );
        break;
    }
  }
}
