import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { NestedModelService } from "../nestedModel.service";
import { NestedModelHelperService, TypedModelType } from "../nested-model-helper.service";
import { EventTree, EventTreeDocument } from "../schemas/event-tree.schema";
import { NestedModel } from "../schemas/templateSchema/nested-model.schema";
import { Label } from "../../schemas/label.schema";
@Injectable()
export class EventTreesService {
  constructor(
    @InjectModel(EventTree.name)
    private readonly eventTreeModel: Model<EventTreeDocument>,
    private readonly nestedModelService: NestedModelService,
    private readonly nestedModelHelperService: NestedModelHelperService,
  ) {}
  async getEventTrees(parentId: number): Promise<EventTree[]> {
    return this.eventTreeModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }
  async getEventTreesString(parentId: string): Promise<EventTree[]> {
    return this.eventTreeModel.find({ parentIds: parentId });
  }
  async getSingleEventTree(modelId: number): Promise<EventTree> {
    return this.eventTreeModel.findOne({ id: modelId }, { _id: 0 });
  }
  async getSingleEventTreeString(modelId: string): Promise<EventTree> {
    return this.eventTreeModel.findOne({ _id: modelId });
  }
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
  async updateEventTreeLabel(id: string, body: Label): Promise<NestedModel> {
    return this.eventTreeModel.findOneAndUpdate({ _id: id }, { label: body }, { new: true });
  }
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
