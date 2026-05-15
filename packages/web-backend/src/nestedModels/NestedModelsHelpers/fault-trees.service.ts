import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { NestedModelService } from "../nestedModel.service";
import { NestedModel } from "../schemas/templateSchema/nested-model.schema";
import { Label } from "../../schemas/label.schema";
import { FaultTree, FaultTreeDocument } from "../schemas/fault-tree.schema";
@Injectable()
export class FaultTreesService {
  constructor(
    @InjectModel(FaultTree.name)
    private readonly FaultTreeModel: Model<FaultTreeDocument>,
    private readonly nestedModelService: NestedModelService,
  ) {}
  async getFaultTree(parentId: number): Promise<FaultTree[]> {
    return this.FaultTreeModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }
  async getFaultTreeString(parentId: string): Promise<FaultTree[]> {
    return this.FaultTreeModel.find({ parentIds: parentId });
  }
  async getSingleFaultTree(modelId: number): Promise<FaultTree> {
    return this.FaultTreeModel.findOne({ id: modelId }, { _id: 0 });
  }
  async getSingleFaultTreeString(modelId: string): Promise<FaultTree> {
    return this.FaultTreeModel.findOne({ _id: modelId });
  }
  async createFaultTree(body: Partial<NestedModel>): Promise<NestedModel> {
    const newFaultTree = new this.FaultTreeModel(body);
    newFaultTree.id = await this.nestedModelService.getNextValue("nestedCounter");
    await newFaultTree.save();
    return newFaultTree;
  }
  async updateFaultTreeLabel(id: string, body: Label): Promise<NestedModel> {
    return this.FaultTreeModel.findOneAndUpdate({ _id: id }, { label: body }, { new: true });
  }
  async deleteFaultTree(modelId: string): Promise<void> {
    await this.FaultTreeModel.findOneAndDelete({ _id: modelId });
  }
}
