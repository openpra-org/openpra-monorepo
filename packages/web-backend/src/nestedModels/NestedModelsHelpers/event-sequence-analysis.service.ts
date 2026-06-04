import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { EventSequenceAnalysis, EventSequenceAnalysisDocument } from "../schemas/event-sequence-analysis.schema";
import { NestedModelService } from "../nestedModel.service";
import { NestedModelHelperService, TypedModelType } from "../nested-model-helper.service";
import { NestedModel } from "../schemas/templateSchema/nested-model.schema";
import { Label } from "../../schemas/label.schema";
@Injectable()
export class EventSequenceAnalysisService {
  constructor(
    @InjectModel(EventSequenceAnalysis.name)
    private readonly eventSequenceAnalysisModel: Model<EventSequenceAnalysisDocument>,
    private readonly nestedModelService: NestedModelService,
    private readonly nestedModelHelperService: NestedModelHelperService,
  ) {}
  async getEventSequenceAnalysis(parentId: number): Promise<EventSequenceAnalysis[]> {
    return this.eventSequenceAnalysisModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }
  async getEventSequenceAnalysisString(parentId: string): Promise<EventSequenceAnalysis[]> {
    return this.eventSequenceAnalysisModel.find({ parentIds: parentId });
  }
  async getSingleEventSequenceAnalysis(modelId: number): Promise<EventSequenceAnalysis> {
    return this.eventSequenceAnalysisModel.findOne({ id: modelId }, { _id: 0 });
  }
  async getSingleEventSequenceAnalysisString(modelId: string): Promise<EventSequenceAnalysis> {
    return this.eventSequenceAnalysisModel.findOne({ _id: modelId });
  }
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
  async updateEventSequenceAnalysisLabel(id: string, body: Label): Promise<NestedModel> {
    return this.eventSequenceAnalysisModel.findOneAndUpdate({ _id: id }, { label: body }, { new: true });
  }
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
