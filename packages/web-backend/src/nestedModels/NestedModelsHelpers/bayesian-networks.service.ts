import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { NestedModelService } from "../nestedModel.service";
import { NestedModelHelperService, TypedModelType } from "../nested-model-helper.service";
import { NestedModel } from "../schemas/templateSchema/nested-model.schema";
import { Label } from "../../schemas/label.schema";
import { BayesianNetwork, BayesianNetworkDocument } from "../schemas/bayesian-network.schema";

/**
 * Service for Bayesian Network nested models.
 * Supports listing, single retrieval, creation and label updates.
 */
@Injectable()
export class BayesianNetworksService {
  constructor(
    @InjectModel(BayesianNetwork.name)
    private readonly bayesianNetworkModel: Model<BayesianNetworkDocument>,
    private readonly nestedModelService: NestedModelService,
    private readonly nestedModelHelperService: NestedModelHelperService,
  ) {}

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId - id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getBayesianNetwork(parentId: number): Promise<BayesianNetwork[]> {
    return this.bayesianNetworkModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getBayesianNetworkString(parentId: string): Promise<BayesianNetwork[]> {
    return this.bayesianNetworkModel.find({ parentIds: parentId });
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId - the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleBayesianNetwork(modelId: number): Promise<BayesianNetwork> {
    return this.bayesianNetworkModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleBayesianNetworkString(modelId: string): Promise<BayesianNetwork> {
    return this.bayesianNetworkModel.findOne({ _id: modelId });
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body - a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @param typedModel - is the typed model to be updated
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
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

  /**
   * updates the label in the nested model
   * @param id - the id of the nested model to be updated
   * @param body - a label with a name and description
   * @returns a promise with the updated model with an updated label
   */
  async updateBayesianNetworkLabel(id: string, body: Label): Promise<NestedModel> {
    return this.bayesianNetworkModel.findOneAndUpdate({ _id: id }, { label: body }, { new: true });
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId - the id of the model we want to delete
   * @param typedModel - is the typed model that this nested model belongs to
   * @returns a promise with the deleted model
   */
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
