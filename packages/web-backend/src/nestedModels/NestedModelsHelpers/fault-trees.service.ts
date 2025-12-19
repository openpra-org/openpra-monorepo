import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { NestedModelService } from "../nestedModel.service";
import { NestedModelHelperService, TypedModelType } from "../nested-model-helper.service";
import { NestedModel } from "../schemas/templateSchema/nested-model.schema";
import { Label } from "../../schemas/label.schema";
import { FaultTree, FaultTreeDocument } from "../schemas/fault-tree.schema";

/**
 * Service for Fault Tree nested model operations.
 * Provides collection and single-item retrieval, updates and label helpers.
 */
@Injectable()
export class FaultTreesService {
  /**
   * Construct the service with persistence and helper dependencies.
   * @param FaultTreeModel - Mongoose model for FaultTree collection
   * @param nestedModelService - Service to allocate IDs and shared nested model ops
   * @param nestedModelHelperService - Helper to link/unlink nested models to typed models
   */
  constructor(
    @InjectModel(FaultTree.name)
    private readonly FaultTreeModel: Model<FaultTreeDocument>,
    private readonly nestedModelService: NestedModelService,
    private readonly nestedModelHelperService: NestedModelHelperService,
  ) {}

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId - id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getFaultTree(parentId: number): Promise<FaultTree[]> {
    return this.FaultTreeModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  /**
   * Retrieves Fault Trees by parent id (string form).
   * @param parentId - Parent identifier as a string (ObjectId)
   * @returns Array of Fault Tree documents for the given parent
   */
  async getFaultTreeString(parentId: string): Promise<FaultTree[]> {
    return this.FaultTreeModel.find({ parentIds: parentId });
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId - the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleFaultTree(modelId: number): Promise<FaultTree> {
    return this.FaultTreeModel.findOne({ id: modelId }, { _id: 0 });
  }

  /**
   * Retrieves a single Fault Tree by string id.
   * @param modelId - Document _id as a string (ObjectId)
   * @returns The matching Fault Tree document
   */
  async getSingleFaultTreeString(modelId: string): Promise<FaultTree> {
    return this.FaultTreeModel.findOne({ _id: modelId });
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body - a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @param typedModel - is the typed model to be updated
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createFaultTree(body: Partial<NestedModel>, typedModel: TypedModelType): Promise<NestedModel> {
    const newFaultTree = new this.FaultTreeModel(body);
    newFaultTree.id = await this.nestedModelService.getNextValue("nestedCounter");
    await newFaultTree.save();

    for (const pId of newFaultTree.parentIds) {
      await this.nestedModelHelperService.AddNestedModelToTypedModel(
        typedModel,
        "faultTrees",
        pId.toString(),
        newFaultTree._id as string,
      );
    }
    return newFaultTree;
  }

  /**
   * updates the label in the nested model
   * @param id - the id of the nested model to be updated
   * @param body - a label with a name and description
   * @returns a promise with the updated model with an updated label
   */
  async updateFaultTreeLabel(id: string, body: Label): Promise<NestedModel> {
    return this.FaultTreeModel.findOneAndUpdate({ _id: id }, { label: body }, { new: true });
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId - the id of the model we want to delete
   * @param typedModel - is the typed model that this nested model belongs to
   * @returns a promise with the deleted model
   */
  async deleteFaultTree(modelId: string, typedModel: TypedModelType): Promise<void> {
    const faultTree = await this.FaultTreeModel.findOne({
      _id: modelId,
    });
    await this.FaultTreeModel.findOneAndDelete({ _id: modelId });

    for (const pId of faultTree.parentIds) {
      await this.nestedModelHelperService.RemoveNestedModelToTypedModel(
        typedModel,
        "faultTrees",
        pId.toString(),
        faultTree._id as string,
      );
    }
  }
}
