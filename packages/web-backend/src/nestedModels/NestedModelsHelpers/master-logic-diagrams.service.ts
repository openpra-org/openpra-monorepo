import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { NestedModelService } from "../nestedModel.service";
import { NestedModelHelperService, TypedModelType } from "../nested-model-helper.service";
import { MasterLogicDiagram, MasterLogicDiagramDocument } from "../schemas/master-logic-diagram.schema";
import { NestedModel } from "../schemas/templateSchema/nested-model.schema";
import { Label } from "../../schemas/label.schema";

@Injectable()
export class MasterLogicDiagramsService {
  constructor(
    @InjectModel(MasterLogicDiagram.name)
    private readonly masterLogicDiagramModel: Model<MasterLogicDiagramDocument>,
    private readonly nestedModelService: NestedModelService,
    private readonly nestedModelHelperService: NestedModelHelperService,
  ) {}

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getMasterLogicDiagrams(parentId: number): Promise<MasterLogicDiagram[]> {
    return this.masterLogicDiagramModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getMasterLogicDiagramsString(parentId: string): Promise<MasterLogicDiagram[]> {
    return this.masterLogicDiagramModel.find({ parentIds: parentId });
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId - the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleMasterLogicDiagram(modelId: number): Promise<MasterLogicDiagram> {
    return this.masterLogicDiagramModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleMasterLogicDiagramString(modelId: string): Promise<MasterLogicDiagram> {
    return this.masterLogicDiagramModel.findOne({ _id: modelId });
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createMasterLogicDiagram(body: Partial<NestedModel>, typedModel: TypedModelType): Promise<NestedModel> {
    const newMasterLogicDiagram = new this.masterLogicDiagramModel(body);
    newMasterLogicDiagram.id = await this.nestedModelService.getNextValue("nestedCounter");
    await newMasterLogicDiagram.save();

    for (const pId of newMasterLogicDiagram.parentIds) {
      await this.nestedModelHelperService.AddNestedModelToTypedModel(
        typedModel,
        "masterLogicDiagrams",
        pId.toString(),
        newMasterLogicDiagram._id as string,
      );
    }
    return newMasterLogicDiagram;
  }

  /**
   * updates the label in the nested model
   * @param id - the id of the nested model to be updated
   * @param body - a label with a name and description
   * @returns a promise with the updated model with an updated label
   */
  async updateMasterLogicDiagramLabel(id: string, body: Label): Promise<NestedModel> {
    return this.masterLogicDiagramModel.findOneAndUpdate({ _id: id }, { label: body }, { new: true });
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId - the id of the model we want to delete
   * @param typedModel - is the typed model that this nested model belongs to
   * @returns a promise with the deleted model
   */
  async deleteMasterLogicDiagram(modelId: string, typedModel: TypedModelType): Promise<void> {
    const masterLogicDiagram = await this.masterLogicDiagramModel.findOne({
      _id: modelId,
    });
    await this.masterLogicDiagramModel.findOneAndDelete({ _id: modelId });

    for (const pId of masterLogicDiagram.parentIds) {
      await this.nestedModelHelperService.RemoveNestedModelToTypedModel(
        typedModel,
        "masterLogicDiagrams",
        pId.toString(),
        masterLogicDiagram._id as string,
      );
    }
  }
}
