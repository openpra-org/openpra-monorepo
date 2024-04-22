import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { InitiatingEventGroup, InitiatingEventGroupDocument } from "./schemas/initiatingEventGroup.schema";

@Injectable()
export class InitiatingEventGroupService {
  constructor(
    @InjectModel(InitiatingEventGroup.name)
    private readonly initiatingEventGroupModel: Model<InitiatingEventGroupDocument>,
  ) {}

  async getInitiatingEventGroups() {
    return this.initiatingEventGroupModel.find()
  }

  async getInitiatingEventGroupById(id: string) {
    return this.initiatingEventGroupModel.findById(id)
  }

  async createInitiatingEventGroup(initiatingEventGroup: InitiatingEventGroup) {
    const newInitiatingEventGroup = new this.initiatingEventGroupModel(initiatingEventGroup);
    return newInitiatingEventGroup.save();
  }

  async updateInitiatingEventGroup(id: string, initiatingEventGroup: InitiatingEventGroup) {
    return this.initiatingEventGroupModel.findByIdAndUpdate(id, initiatingEventGroup, { new: true });
  }

  async deleteInitiatingEventGroup(id: string) {
    return this.initiatingEventGroupModel.findByIdAndDelete(id);
  }

  async getInitiatingEventGroupIdByEventId(eventId: string) {
  const initiatingEventGroup = await this.initiatingEventGroupModel
    .find({ initiatingEvents: eventId })
    .select('_id');

  return initiatingEventGroup
  }

  //add a new initiating event to the initiating event group
  async addInitiatingEventToGroup(id: string, eventId: string) {
    return this.initiatingEventGroupModel
      .findByIdAndUpdate(id, { $push: { initiatingEvents: eventId } }, { new: true });
  }

  //remove an initiating event from the initiating event group
  async removeInitiatingEventFromGroup(id: string, eventId: string) {
    return this.initiatingEventGroupModel
      .findByIdAndUpdate(id, { $pull: { initiatingEvents: eventId } }, { new: true });
  }
}
