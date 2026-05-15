import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { EventSequenceDiagram, EventSequenceDiagramDocument } from "../schemas/event-sequence-diagram.schema";
import { NestedModelHelperService, TypedModelType } from "../nested-model-helper.service";
import { NestedModelService } from "../nestedModel.service";
import { NestedModel } from "../schemas/templateSchema/nested-model.schema";
import { Label } from "../../schemas/label.schema";
import { GraphModelService } from "../../graphModels/graphModel.service";
@Injectable()
export class EventSequenceDiagramService {
  constructor(
    @InjectModel(EventSequenceDiagram.name)
    private readonly eventSequenceDiagramModel: Model<EventSequenceDiagramDocument>,
    private readonly nestedModelService: NestedModelService,
    private readonly nestedModelHelperService: NestedModelHelperService,
    private readonly graphModelService: GraphModelService,
  ) {}
  async getEventSequenceDiagrams(parentId: number): Promise<EventSequenceDiagram[]> {
    return this.eventSequenceDiagramModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }
  async getEventSequenceDiagramsString(parentId: string): Promise<EventSequenceDiagram[]> {
    return this.eventSequenceDiagramModel.find({ parentIds: parentId });
  }
  async getSingleEventSequenceDiagram(modelId: number): Promise<EventSequenceDiagram> {
    return this.eventSequenceDiagramModel.findOne({ id: modelId }, { _id: 0 });
  }
  async getSingleEventSequenceDiagramString(modelId: string): Promise<EventSequenceDiagram> {
    return this.eventSequenceDiagramModel.findOne({ _id: modelId });
  }
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
  async updateEventSequenceDiagramLabel(id: string, body: Label): Promise<NestedModel> {
    return this.eventSequenceDiagramModel.findOneAndUpdate({ _id: id }, { label: body }, { new: true });
  }
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
