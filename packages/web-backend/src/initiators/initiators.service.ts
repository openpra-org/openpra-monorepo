import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as argon2 from "argon2";
import * as dot from "dot-object";
import { UpdateOneModel } from "mongodb";
import { MemberResult } from "shared-types/src/lib/api/Members";
import { Initiator, InitiatorDocument } from "./schemas/initiator.schema";

@Injectable()
export class InitiatorService {
  constructor(
    @InjectModel(Initiator.name)
    private readonly initiatorModel: Model<InitiatorDocument>,
  ) {}

  
  async getAllInitiators(): Promise<Initiator[]> {
    const initiators = await this.initiatorModel.find()
    return initiators;
  };

  async getInitiatorById(id: string): Promise<Initiator | null> {
    const initiator = await this.initiatorModel.findById(id);
    return initiator;
  }

  async createInitiator(initiator: Initiator): Promise<Initiator> {
    const newInitiator = new this.initiatorModel(initiator);
    return newInitiator.save();
  }

  async updateInitiator(id: string, initiator: Initiator): Promise<Initiator | null> {
    const updatedInitiator = await this.initiatorModel
      .findByIdAndUpdate(id, initiator, { new: true });
    return updatedInitiator;
  }

  async deleteInitiator(id: string): Promise<Initiator | null> {
    const deletedInitiator = await this.initiatorModel.findByIdAndDelete(id);
    return deletedInitiator;
  }
}
