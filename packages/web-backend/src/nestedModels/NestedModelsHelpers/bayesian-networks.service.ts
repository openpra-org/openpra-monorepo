import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { NestedModelService } from "../nestedModel.service";
import { NestedModelHelperService, TypedModelType } from "../nested-model-helper.service";
import { NestedModel } from "../schemas/templateSchema/nested-model.schema";
import { Label } from "../../schemas/label.schema";
import { BayesianNetwork, BayesianNetworkDocument } from "../schemas/bayesian-network.schema";
@Injectable()
export class BayesianNetworksService {
  constructor(
    @InjectModel(BayesianNetwork.name)
    private readonly bayesianNetworkModel: Model<BayesianNetworkDocument>,
    private readonly nestedModelService: NestedModelService,
    private readonly nestedModelHelperService: NestedModelHelperService,
  ) {}
  async getBayesianNetwork(parentId: number): Promise<BayesianNetwork[]> {
    return this.bayesianNetworkModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }
  async getBayesianNetworkString(parentId: string): Promise<BayesianNetwork[]> {
    return this.bayesianNetworkModel.find({ parentIds: parentId });
  }
  async getSingleBayesianNetwork(modelId: number): Promise<BayesianNetwork> {
    return this.bayesianNetworkModel.findOne({ id: modelId }, { _id: 0 });
  }
  async getSingleBayesianNetworkString(modelId: string): Promise<BayesianNetwork> {
    return this.bayesianNetworkModel.findOne({ _id: modelId });
  }
  async createBayesianNetwork(body: Partial<NestedModel>, typedModel: TypedModelType): Promise<NestedModel> {
    const newBayesianNetwork = new this.bayesianNetworkModel(body);
    newBayesianNetwork.id = await this.nestedModelService.getNextValue("nestedCounter");
    await newBayesianNetwork.save();
    for (const pId of newBayesianNetwork.parentIds) {
      await this.nestedModelHelperService.AddNestedModelToTypedModel(
        typedModel,
        "bayesianNetworks",
        pId.toString(),
        newBayesianNetwork._id as string,
      );
    }
    return newBayesianNetwork;
  }
  async updateBayesianNetworkLabel(id: string, body: Label): Promise<NestedModel> {
    return this.bayesianNetworkModel.findOneAndUpdate({ _id: id }, { label: body }, { new: true });
  }
  async deleteBayesianNetwork(modelId: string, typedModel: TypedModelType): Promise<void> {
    const bayesianNetwork = await this.bayesianNetworkModel.findOne({
      _id: modelId,
    });
    await this.bayesianNetworkModel.findOneAndDelete({ _id: modelId });
    for (const pId of bayesianNetwork.parentIds) {
      await this.nestedModelHelperService.RemoveNestedModelToTypedModel(
        typedModel,
        "bayesianNetworks",
        pId.toString(),
        bayesianNetwork._id as string,
      );
    }
  }
}
