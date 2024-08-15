import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { Model } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";
import { NestedModel } from "../schemas/templateSchema/nested-model.schema";
import { NestedModelHelperService, TypedModelType } from "../nested-model-helper.service";
import { InitiatingEvent, InitiatingEventDocument } from "../schemas/initiating-event.schema";
import { NestedModelService } from "../nestedModel.service";
import { Label } from "../../schemas/label.schema";

@Injectable()
export class InitiatingEventsService {
  constructor(
    @InjectModel(InitiatingEvent.name)
    private readonly initiatingEventModel: Model<InitiatingEventDocument>,
    private readonly nestedModelService: NestedModelService,
    private readonly nestedModelHelperService: NestedModelHelperService,
  ) {}

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId - id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getInitiatingEvents(parentId: number): Promise<InitiatingEvent[]> {
    return this.initiatingEventModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getInitiatingEventsString(parentId: string): Promise<InitiatingEvent[]> {
    return this.initiatingEventModel.find({ parentIds: parentId });
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId - the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleInitiatingEvent(modelId: number): Promise<InitiatingEvent> {
    const initiatingEvent = await this.initiatingEventModel.findOne({ id: modelId }, { _id: 0 });
    if (!initiatingEvent) {
      throw new InternalServerErrorException("Initiating event cannot be found");
    }

    return initiatingEvent;
  }

  async getSingleInitiatingEventString(modelId: string): Promise<InitiatingEvent> {
    const initiatingEvent = await this.initiatingEventModel.findOne({ _id: modelId });
    if (!initiatingEvent) {
      throw new InternalServerErrorException("Initiating event cannot be found");
    }

    return initiatingEvent;
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body - a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @param typedModel - is the typed model to be updated
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createInitiatingEvent(body: Partial<NestedModel>, typedModel: TypedModelType): Promise<NestedModel> {
    const newInitiatingEvent = new this.initiatingEventModel(body);
    newInitiatingEvent.id = await this.nestedModelService.getNextValue("nestedCounter");
    await newInitiatingEvent.save();
    if (!newInitiatingEvent.parentIds) {
      throw new InternalServerErrorException("Parent IDs of the initiating event cannot be found");
    }

    for (const pId of newInitiatingEvent.parentIds) {
      await this.nestedModelHelperService.AddNestedModelToTypedModel(
        typedModel,
        "initiatingEvents",
        pId.toString(),
        newInitiatingEvent._id as string,
      );
    }
    return newInitiatingEvent;
  }

  /**
   * updates the label in the nested model
   * @param id - the id of the nested model to be updated
   * @param body - a label with a name and description
   * @returns a promise with the updated model with an updated label
   */
  async updateInitiatingEventLabel(id: string, body: Label): Promise<NestedModel> {
    const initiatingEvent = await this.initiatingEventModel.findOneAndUpdate(
      { _id: id },
      { label: body },
      { new: true },
    );
    if (!initiatingEvent) {
      throw new InternalServerErrorException("Initiating event label cannot be updated");
    }

    return initiatingEvent;
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId - the id of the model we want to delete
   * @param typedModel - is the typed model that this nested model belongs to
   * @returns a promise with the deleted model
   */
  async deleteInitiatingEvent(modelId: string, typedModel: TypedModelType): Promise<void> {
    const initiatingEvent = await this.initiatingEventModel.findOne({
      _id: modelId,
    });
    await this.initiatingEventModel.findOneAndDelete({ _id: modelId });
    if (!initiatingEvent || !initiatingEvent.parentIds) {
      throw new InternalServerErrorException("Parent IDs of the initiating events cannot be updated");
    }

    for (const pId of initiatingEvent.parentIds) {
      await this.nestedModelHelperService.RemoveNestedModelToTypedModel(
        typedModel,
        "initiatingEvents",
        pId.toString(),
        initiatingEvent._id as string,
      );
    }
  }
}
