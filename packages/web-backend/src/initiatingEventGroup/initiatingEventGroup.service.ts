import { Inject, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  InitiatingEvent,
  InitiatingEventDocument,
} from "../nestedModels/schemas/initiating-event.schema";
import {
  InitiatingEventGroup,
  InitiatingEventGroupDocument,
} from "./schemas/initiatingEventGroup.schema";

@Injectable()
export class InitiatingEventGroupService {
  constructor(
    @InjectModel(InitiatingEventGroup.name)
    private readonly initiatingEventGroupModel: Model<InitiatingEventGroupDocument>,
    @InjectModel(InitiatingEvent.name)
    private readonly initiatingEventModel: Model<InitiatingEventDocument>,
  ) {}

  async getInitiatingEventGroups(): Promise<InitiatingEventGroup[] | null> {
    return this.initiatingEventGroupModel.find();
  }

  async getInitiatingEventGroupById(
    id: string,
  ): Promise<InitiatingEventGroup | null> {
    return this.initiatingEventGroupModel.findById(id);
  }

  async createInitiatingEventGroup(
    initiatingEventGroup: InitiatingEventGroup,
  ): Promise<InitiatingEventGroup | null> {
    const newInitiatingEventGroup = new this.initiatingEventGroupModel(
      initiatingEventGroup,
    );
    return newInitiatingEventGroup.save();
  }

  async updateInitiatingEventGroup(
    id: string,
    initiatingEventGroup: InitiatingEventGroup,
  ): Promise<InitiatingEventGroup | null> {
    return this.initiatingEventGroupModel.findByIdAndUpdate(
      id,
      initiatingEventGroup,
      { new: true },
    );
  }

  //delete an initiating event group
  //also remove the group id from all initiating events in the group
  async deleteInitiatingEventGroup(
    id: string,
  ): Promise<InitiatingEventGroup | null> {
    const initiatingEvents = await this.initiatingEventModel.find({
      initiatingEventGroup: id,
    });
    for (const event of initiatingEvents) {
      await this.removeInitiatingEventGroupFromEvent(event._id, id);
    }
    return this.initiatingEventGroupModel.findByIdAndDelete(id);
  }

  async getInitiatingEventGroupIdByEventId(
    eventId: string,
  ): Promise<InitiatingEventGroup[] | null> {
    const initiatingEventGroup = await this.initiatingEventGroupModel
      .find({ initiatingEvents: eventId })
      .select("_id");

    return initiatingEventGroup;
  }

  //add a new initiating event to the initiating event group
  //also adds the group id to the initiating event
  async addInitiatingEventToGroup(
    id: string,
    eventId: string,
  ): Promise<InitiatingEventGroup | null> {
    const initiatingEventGroup =
      this.initiatingEventGroupModel.findByIdAndUpdate(
        id,
        { $push: { initiatingEvents: eventId } },
        { new: true },
      );
    await this.initiatingEventModel.findByIdAndUpdate(
      eventId,
      { $push: { initiatingEventGroup: id } },
      { new: true },
    );
    return initiatingEventGroup;
  }

  async removeInitiatingEventGroupFromEvent(
    eventId: string,
    groupId: string,
  ): Promise<InitiatingEvent | null> {
    return await this.initiatingEventModel.findByIdAndUpdate(
      eventId,
      { $pull: { initiatingEventGroup: groupId } },
      { new: true },
    );
  }

  //remove an initiating event from the initiating event group
  //also removes the group id from the initiating event
  async removeInitiatingEventFromGroup(
    id: string,
    eventId: string,
  ): Promise<InitiatingEventGroup | null> {
    this.removeInitiatingEventFromGroup(eventId, id);
    return this.initiatingEventGroupModel.findByIdAndUpdate(
      id,
      { $pull: { initiatingEvents: eventId } },
      { new: true },
    );
  }
}
