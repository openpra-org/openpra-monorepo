import { Injectable } from "@nestjs/common";
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
  async getInitiatingEvents(parentId: number): Promise<InitiatingEvent[]> {
    return this.initiatingEventModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }
  async getInitiatingEventsString(parentId: string): Promise<InitiatingEvent[]> {
    return this.initiatingEventModel.find({ parentIds: parentId });
  }
  async getSingleInitiatingEvent(modelId: number): Promise<InitiatingEvent> {
    return this.initiatingEventModel.findOne({ id: modelId }, { _id: 0 });
  }
  async getSingleInitiatingEventString(modelId: string): Promise<InitiatingEvent> {
    return this.initiatingEventModel.findOne({ _id: modelId });
  }
  async createInitiatingEvent(body: Partial<NestedModel>, typedModel: TypedModelType): Promise<NestedModel> {
    const newInitiatingEvent = new this.initiatingEventModel(body);
    newInitiatingEvent.id = await this.nestedModelService.getNextValue("nestedCounter");
    await newInitiatingEvent.save();
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
  async updateInitiatingEventLabel(id: string, body: Label): Promise<NestedModel> {
    return this.initiatingEventModel.findOneAndUpdate({ _id: id }, { label: body }, { new: true });
  }
  async deleteInitiatingEvent(modelId: string, typedModel: TypedModelType): Promise<void> {
    const initiatingEvent = await this.initiatingEventModel.findOne({
      _id: modelId,
    });
    await this.initiatingEventModel.findOneAndDelete({ _id: modelId });
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
