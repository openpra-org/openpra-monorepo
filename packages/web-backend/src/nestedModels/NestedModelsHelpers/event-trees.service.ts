import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { NestedModelService } from "../nestedModel.service";
import { NestedModelHelperService, TypedModelType } from "../nested-model-helper.service";
import { EventTree, EventTreeDocument } from "../schemas/event-tree.schema";
import { NestedModel } from "../schemas/templateSchema/nested-model.schema";
import { Label } from "../../schemas/label.schema";
import { EventTreeGraph } from "../../schemas/graphs/event-tree-graph.schema";

@Injectable()
export class EventTreesService {
  constructor(
    @InjectModel(EventTree.name)
    private readonly eventTreeModel: Model<EventTreeDocument>,
    private readonly nestedModelService: NestedModelService,
    private readonly nestedModelHelperService: NestedModelHelperService,
  ) {}

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId - id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getEventTrees(parentId: number): Promise<EventTree[]> {
    return this.eventTreeModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getEventTreesString(parentId: string): Promise<EventTree[]> {
    return this.eventTreeModel.find({ parentIds: parentId });
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId - the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleEventTree(modelId: number): Promise<EventTree> {
    return this.eventTreeModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleEventTreeString(modelId: string): Promise<EventTree> {
    return this.eventTreeModel.findOne({ _id: modelId });
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body - a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @param typedModel - is the typed model to be updated
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createEventTree(body: Partial<NestedModel>, typedModel: TypedModelType): Promise<NestedModel> {
    const newEventTree = new this.eventTreeModel(body);
    newEventTree.id = await this.nestedModelService.getNextValue("nestedCounter");
    await newEventTree.save();
    for (const pId of newEventTree.parentIds) {
      await this.nestedModelHelperService.AddNestedModelToTypedModel(
        typedModel,
        "eventTrees",
        pId.toString(),
        newEventTree._id as string,
      );
    }
    return newEventTree;
  }

  /**
   * updates the label in the nested model
   * @param id - the id of the nested model to be updated
   * @param body - a label with a name and description
   * @returns a promise with the updated model with an updated label
   */
  async updateEventTreeLabel(id: string, body: Label): Promise<NestedModel> {
    return this.eventTreeModel.findOneAndUpdate({ _id: id }, { label: body }, { new: true });
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId - the id of the model we want to delete
   * @param typedModel - is the typed model that this nested model belongs to
   * @returns a promise with the deleted model
   */
  async deleteEventTree(modelId: string, typedModel: TypedModelType): Promise<void> {
    const eventTree = await this.eventTreeModel.findOne({
      _id: modelId,
    });
    await this.eventTreeModel.findOneAndDelete({ _id: modelId });

    for (const pId of eventTree.parentIds) {
      await this.nestedModelHelperService.RemoveNestedModelToTypedModel(
        typedModel,
        "eventTrees",
        pId.toString(),
        eventTree._id as string,
      );
    }
  }
}
