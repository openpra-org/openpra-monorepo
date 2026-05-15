import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { InternalEvents, InternalEventsDocument, InternalEventsMetadata } from "../schemas/internal-events.schema";
@Injectable()
export class MetaTypedModelService {
  constructor(
    @InjectModel(InternalEvents.name)
    private readonly internalEventsModel: Model<InternalEventsDocument>,
  ) {}
  async getInternalEventsMetaData(userId: number): Promise<InternalEventsMetadata[]> {
    const valuesToSelect = ["label", "users"];
    return this.internalEventsModel.find({ users: userId }).select(valuesToSelect);
  }
}
