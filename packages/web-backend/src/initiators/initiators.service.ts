import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  HeatBalanceFaultTree,
  HeatBalanceFaultTreeDocument,
} from "../nestedModels/schemas/heat-balance-fault-tree.schema";
import { Initiator, InitiatorDocument } from "./schemas/initiator.schema";

@Injectable()
export class InitiatorService {
  constructor(
    @InjectModel(Initiator.name)
    private readonly initiatorModel: Model<InitiatorDocument>,
    @InjectModel(HeatBalanceFaultTree.name)
    private readonly heatBalanceFaultTreeModel: Model<HeatBalanceFaultTreeDocument>,
  ) {}

  async getAllInitiators(): Promise<Initiator[]> {
    const initiators = await this.initiatorModel.find();
    return initiators;
  }

  async getInitiatorById(id: string): Promise<Initiator | null> {
    const initiator = await this.initiatorModel.findById(id);
    return initiator;
  }

  async createInitiator(initiator: Initiator): Promise<Initiator> {
    const newInitiator = new this.initiatorModel(initiator);
    return newInitiator.save();
  }

  async updateInitiator(
    id: string,
    initiator: Initiator,
  ): Promise<Initiator | null> {
    const updatedInitiator = await this.initiatorModel.findByIdAndUpdate(
      id,
      initiator,
      { new: true },
    );
    return updatedInitiator;
  }

  async deleteInitiator(id: string): Promise<Initiator | null> {
    const deletedInitiator = await this.initiatorModel.findByIdAndDelete(id);
    const heatBalanceFaultTrees =
      await this.getHeatBalanceFaultTreesByInitiatorId(id);
    for (const heatBalanceFaultTree of heatBalanceFaultTrees) {
      await this.removeInitiatorFromHeatBalanceFaultTree(
        id,
        String(heatBalanceFaultTree.id), // Cast _id to string
      );
    }
    return deletedInitiator;
  }

  async getHeatBalanceFaultTreesByInitiatorId(
    id: string,
  ): Promise<HeatBalanceFaultTree[]> {
    const heatBalanceFaultTrees = await this.heatBalanceFaultTreeModel.find({
      initiators: id,
    });
    return heatBalanceFaultTrees;
  }

  async addInitiatorToHeatBalanceFaultTree(
    initiatorId: string,
    heatBalanceFaultTreeId: string,
  ): Promise<HeatBalanceFaultTree | null> {
    return await this.heatBalanceFaultTreeModel.findByIdAndUpdate(
      heatBalanceFaultTreeId,
      { $push: { initiators: initiatorId } },
      { new: true },
    );
  }

  async removeInitiatorFromHeatBalanceFaultTree(
    initiatorId: string,
    heatBalanceFaultTreeId: string,
  ): Promise<HeatBalanceFaultTree | null> {
    return await this.heatBalanceFaultTreeModel.findByIdAndUpdate(
      heatBalanceFaultTreeId,
      { $pull: { initiators: initiatorId } },
      { new: true },
    );
  }

  /**
   * @param initiatorId - id of the initiator
   * @param sourceId - id of the model that is the source of the initiator
   * @returns the updated initiator
   */
  async addSourceToInitiator(
    initiatorId: string,
    sourceId: string,
  ): Promise<Initiator | null> {
    const initiator = await this.initiatorModel.findByIdAndUpdate(
      initiatorId,
      { $push: { sources: sourceId } },
      { new: true },
    );
    return initiator;
  }

  /**
   * @param initiatorId - id of the initiator
   * @param sourceId - id of the model that is the source of the initiator
   * @returns the updated initiator
   */
  async removeSourceFromInitiator(
    initiatorId: string,
    sourceId: string,
  ): Promise<Initiator | null> {
    const initiator = await this.initiatorModel.findByIdAndUpdate(
      initiatorId,
      { $pull: { sources: sourceId } },
      { new: true },
    );
    return initiator;
  }

  /**
   * @param sourceId - id of the model that is the source of the initiator
   * @returns list of initiators that have the given source as a source
   */
  async findInitiatorsBySourceId(sourceId: string): Promise<Initiator[]> {
    const initiators = await this.initiatorModel.find({ sources: sourceId });
    return initiators;
  }

  async findSource(sourceId: string): Promise<any> {
    let source;
    source = await this.heatBalanceFaultTreeModel.findById(sourceId);
    if (source) {
      return source;
    }
    //add code more models here if needed
    return null;
  }
}
