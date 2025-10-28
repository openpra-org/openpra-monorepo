import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { EventSequenceDiagram, EventSequenceDiagramDocument } from "../schemas/event-sequence-diagram.schema";
import { NestedModelHelperService, TypedModelType } from "../nested-model-helper.service";
import { NestedModelService } from "../nestedModel.service";
import { NestedModel } from "../schemas/templateSchema/nested-model.schema";
import { Label } from "../../schemas/label.schema";
import { GraphModelService } from "../../graphModels/graphModel.service";

/**
 * Service for Event Sequence Diagram nested models.
 * Supports list, single-item retrieval, creation and label updates.
 */
@Injectable()
export class EventSequenceDiagramService {
  constructor(
    @InjectModel(EventSequenceDiagram.name)
    private readonly eventSequenceDiagramModel: Model<EventSequenceDiagramDocument>,
    private readonly nestedModelService: NestedModelService,
    private readonly nestedModelHelperService: NestedModelHelperService,
    private readonly graphModelService: GraphModelService,
  ) {}

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId - id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getEventSequenceDiagrams(parentId: number): Promise<EventSequenceDiagram[]> {
    return this.eventSequenceDiagramModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getEventSequenceDiagramsString(parentId: string): Promise<EventSequenceDiagram[]> {
    return this.eventSequenceDiagramModel.find({ parentIds: parentId });
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId - the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleEventSequenceDiagram(modelId: number): Promise<EventSequenceDiagram> {
    return this.eventSequenceDiagramModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleEventSequenceDiagramString(modelId: string): Promise<EventSequenceDiagram> {
    return this.eventSequenceDiagramModel.findOne({ _id: modelId });
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body - a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @param typedModel - is the typed model to be updated
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createEventSequenceDiagram(body: Partial<NestedModel>, typedModel: TypedModelType): Promise<NestedModel> {
    const newEventSequenceDiagram = new this.eventSequenceDiagramModel(body);
    newEventSequenceDiagram.id = await this.nestedModelService.getNextValue("nestedCounter");
    await newEventSequenceDiagram.save();

    await this.graphModelService.saveEventSequenceDiagramGraph({
      eventSequenceId: newEventSequenceDiagram._id as string,
    });

    for (const pId of newEventSequenceDiagram.parentIds) {
      await this.nestedModelHelperService.AddNestedModelToTypedModel(
        typedModel,
        "eventSequenceDiagrams",
        pId.toString(),
        newEventSequenceDiagram._id as string,
      );
    }
    return newEventSequenceDiagram;
  }

  /**
   * updates the label in the nested model
   * @param id - the id of the nested model to be updated
   * @param body - a label with a name and description
   * @returns a promise with the updated model with an updated label
   */
  async updateEventSequenceDiagramLabel(id: string, body: Label): Promise<NestedModel> {
    return this.eventSequenceDiagramModel.findOneAndUpdate({ _id: id }, { label: body }, { new: true });
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId - the id of the model we want to delete
   * @param typedModel - is the typed model that this nested model belongs to
   * @returns a promise with the deleted model
   */
  async deleteEventSequenceDiagram(modelId: string, typedModel: TypedModelType): Promise<void> {
    const eventSequenceDiagram = await this.eventSequenceDiagramModel.findOne({
      _id: modelId,
    });
    await this.eventSequenceDiagramModel.findOneAndDelete({ _id: modelId });

    for (const pId of eventSequenceDiagram.parentIds) {
      await this.nestedModelHelperService.RemoveNestedModelToTypedModel(
        typedModel,
        "eventSequenceDiagrams",
        pId.toString(),
        eventSequenceDiagram._id as string,
      );
    }
  }
}
