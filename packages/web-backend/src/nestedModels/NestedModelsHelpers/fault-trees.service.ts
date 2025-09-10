import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { FaultTree, FaultTreeDocument } from "../schemas/fault-tree.schema";

@Injectable()
export class FaultTreesService {
  constructor(
    @InjectModel(FaultTree.name)
    private readonly FaultTreeModel: Model<FaultTreeDocument>,
  ) {}

  async getFaultTreesByModelId(modelId: string): Promise<FaultTree[]> {
    return this.FaultTreeModel.find({ modelId }).lean();
  }

  async getFaultTreeById(id: string): Promise<FaultTree> {
    return this.FaultTreeModel.findById(id).lean();
  }

  async createFaultTree(data: Omit<FaultTree, "id">): Promise<FaultTree> {
    const created = new this.FaultTreeModel(data);
    await created.save();
    return created.toObject();
  }

  async updateFaultTreeMetadata(
    id: string,
    data: Partial<Pick<FaultTree, "name" | "description">>
  ): Promise<FaultTree> {
    return this.FaultTreeModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    ).lean();
  }

  async updateFaultTreeGraph(
    id: string,
    graph: FaultTree["graph"]
  ): Promise<FaultTree> {
    return this.FaultTreeModel.findByIdAndUpdate(
      id,
      { $set: { graph } },
      { new: true }
    ).lean();
  }

  async deleteFaultTree(id: string): Promise<void> {
    await this.FaultTreeModel.findByIdAndDelete(id);
  }
}