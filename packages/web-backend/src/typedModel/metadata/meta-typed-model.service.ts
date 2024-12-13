import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

@Injectable()
export class MetaTypedModelService {
  constructor(
    @InjectModel("InternalEventsMetadata") private readonly internalEventsMetadataModel: Model<any>,
    @InjectModel("InternalHazardsMetadata") private readonly internalHazardsMetadataModel: Model<any>,
    @InjectModel("ExternalHazardsMetadata") private readonly externalHazardsMetadataModel: Model<any>,
    @InjectModel("FullScopeMetadata") private readonly fullScopeMetadataModel: Model<any>,
  ) {}

  private getMetadataModelByType(type: string): Model<any> {
    switch (type) {
      case "internal-events":
        return this.internalEventsMetadataModel;
      case "internal-hazards":
        return this.internalHazardsMetadataModel;
      case "external-hazards":
        return this.externalHazardsMetadataModel;
      case "full-scope":
        return this.fullScopeMetadataModel;
      default:
        throw new Error(`Invalid metadata type: ${type}`);
    }
  }

  async saveMetadata(
    type: string,
    modelId: string,
    userId: number,
    label: { name: string; description?: string },
    users: number[],
  ): Promise<any> {
    const metadataModel = this.getMetadataModelByType(type);
    const newMetadata = new metadataModel({
      id: modelId,
      label,
      users,
    });
    return newMetadata.save();
  }

  async updateMetadata(
    type: string,
    modelId: string,
    updates: Partial<{ label: { name: string; description?: string }; users: number[] }>,
  ): Promise<any> {
    const metadataModel = this.getMetadataModelByType(type);
    return metadataModel.findOneAndUpdate({ id: modelId }, updates, { new: true }).exec();
  }

  async deleteMetadata(type: string, modelId: string, userId: number): Promise<any> {
    const metadataModel = this.getMetadataModelByType(type);
    const document = await metadataModel.findOne({ id: modelId, users: userId }).exec();

    if (!document) return null;

    if (document.users.length === 1) {
      // Delete the entire metadata if no users remain
      return metadataModel.findOneAndDelete({ id: modelId }).exec();
    }

    // Remove user from the list and update the document
    document.users = document.users.filter((user) => user !== userId);
    return document.save();
  }
}
