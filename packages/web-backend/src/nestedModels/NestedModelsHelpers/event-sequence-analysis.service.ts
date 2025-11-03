import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { EventSequenceAnalysis, EventSequenceAnalysisDocument } from "../schemas/event-sequence-analysis.schema";
import { NestedModelService } from "../nestedModel.service";
import { NestedModelHelperService, TypedModelType } from "../nested-model-helper.service";
import { NestedModel } from "../schemas/templateSchema/nested-model.schema";
import { Label } from "../../schemas/label.schema";

/**
 * Service for Event Sequence Analysis nested models.
 * Supports listing and single-item retrieval.
 */
@Injectable()
export class EventSequenceAnalysisService {
  /**
   * Construct the service with persistence and helper dependencies.
   * @param eventSequenceAnalysisModel - Mongoose model for EventSequenceAnalysis collection
   * @param nestedModelService - Service to allocate IDs and shared nested model ops
   * @param nestedModelHelperService - Helper to link/unlink nested models to typed models
   */
  constructor(
    @InjectModel(EventSequenceAnalysis.name)
    private readonly eventSequenceAnalysisModel: Model<EventSequenceAnalysisDocument>,
    private readonly nestedModelService: NestedModelService,
    private readonly nestedModelHelperService: NestedModelHelperService,
  ) {}

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId - id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getEventSequenceAnalysis(parentId: number): Promise<EventSequenceAnalysis[]> {
    return this.eventSequenceAnalysisModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  /**
   * Retrieves Event Sequence Analysis items by parent id (string form).
   * @param parentId - Parent identifier as a string (ObjectId)
   * @returns Array of Event Sequence Analysis documents for the given parent
   */
  async getEventSequenceAnalysisString(parentId: string): Promise<EventSequenceAnalysis[]> {
    return this.eventSequenceAnalysisModel.find({ parentIds: parentId });
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId - the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleEventSequenceAnalysis(modelId: number): Promise<EventSequenceAnalysis> {
    return this.eventSequenceAnalysisModel.findOne({ id: modelId }, { _id: 0 });
  }

  /**
   * Retrieves a single Event Sequence Analysis by string id.
   * @param modelId - Document _id as a string (ObjectId)
   * @returns The matching Event Sequence Analysis document
   */
  async getSingleEventSequenceAnalysisString(modelId: string): Promise<EventSequenceAnalysis> {
    return this.eventSequenceAnalysisModel.findOne({ _id: modelId });
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body - a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @param typedModel - is the typed model to be updated
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createEventSequenceAnalysis(body: Partial<NestedModel>, typedModel: TypedModelType): Promise<NestedModel> {
    const newEventSequenceAnalysis = new this.eventSequenceAnalysisModel(body);
    newEventSequenceAnalysis.id = await this.nestedModelService.getNextValue("nestedCounter");
    await newEventSequenceAnalysis.save();

    for (const pId of newEventSequenceAnalysis.parentIds) {
      await this.nestedModelHelperService.AddNestedModelToTypedModel(
        typedModel,
        "eventSequenceAnalysis",
        pId.toString(),
        newEventSequenceAnalysis._id as string,
      );
    }
    return newEventSequenceAnalysis;
  }

  /**
   * updates the label in the nested model
   * @param id - the id of the nested model to be updated
   * @param body - a label with a name and description
   * @returns a promise with the updated model with an updated label
   */
  async updateEventSequenceAnalysisLabel(id: string, body: Label): Promise<NestedModel> {
    return this.eventSequenceAnalysisModel.findOneAndUpdate({ _id: id }, { label: body }, { new: true });
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId - the id of the model we want to delete
   * @param typedModel - is the typed model that this nested model belongs to
   * @returns a promise with the deleted model
   */
  async deleteEventSequenceAnalysis(modelId: string, typedModel: TypedModelType): Promise<void> {
    const eventSequenceAnalysis = await this.eventSequenceAnalysisModel.findOne({
      _id: modelId,
    });
    await this.eventSequenceAnalysisModel.findOneAndDelete({ _id: modelId });

    for (const pId of eventSequenceAnalysis.parentIds) {
      await this.nestedModelHelperService.RemoveNestedModelToTypedModel(
        typedModel,
        "eventSequenceAnalysis",
        pId.toString(),
        eventSequenceAnalysis._id as string,
      );
    }
  }
}
