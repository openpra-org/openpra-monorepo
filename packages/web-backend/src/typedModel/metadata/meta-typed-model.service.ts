import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

@Injectable()
export class MetaTypedModelService {
  /**
   * Constructor to inject metadata models for all supported types.
   * @param internalEventsMetadataModel - Mongoose model for `InternalEventsMetadata`.
   * @param internalHazardsMetadataModel - Mongoose model for `InternalHazardsMetadata`.
   * @param externalHazardsMetadataModel - Mongoose model for `ExternalHazardsMetadata`.
   * @param fullScopeMetadataModel - Mongoose model for `FullScopeMetadata`.
   */
  constructor(
    @InjectModel("InternalEventsMetadata") private readonly internalEventsMetadataModel: Model<any>,
    @InjectModel("InternalHazardsMetadata") private readonly internalHazardsMetadataModel: Model<any>,
    @InjectModel("ExternalHazardsMetadata") private readonly externalHazardsMetadataModel: Model<any>,
    @InjectModel("FullScopeMetadata") private readonly fullScopeMetadataModel: Model<any>,
  ) {}

  /**
   * Retrieves the appropriate metadata model based on the type of the model.
   * @param type - The type of model (e.g., "internal-events", "internal-hazards").
   * @returns The Mongoose model corresponding to the provided type.
   * @throws Error if the provided type is invalid.
   */
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

  /**
   * Saves metadata for a specific model type.
   * @param type - The type of the model (e.g., "internal-events", "external-hazards").
   * @param modelId - The ID of the model for which metadata is being saved.
   * @param userId - The user ID associated with the metadata.
   * @param label - An object containing the label's name and optional description.
   * @param users - A list of users associated with the metadata.
   * @returns The saved metadata document.
   */
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

  /**
   * Updates metadata for a specific model type.
   * @param type - The type of the model (e.g., "internal-events", "external-hazards").
   * @param modelId - The ID of the model for which metadata is being updated.
   * @param updates - Partial updates to be applied to the metadata.
   * @param updates.label - Optional updated label details (name and description).
   * @param updates.users - Optional updated list of users associated with the metadata.
   * @returns The updated metadata document.
   */
  async updateMetadata(
    type: string,
    modelId: string,
    updates: Partial<{ label: { name: string; description?: string }; users: number[] }>,
  ): Promise<any> {
    const metadataModel = this.getMetadataModelByType(type);
    return metadataModel.findOneAndUpdate({ id: modelId }, updates, { new: true }).exec();
  }

  /**
   * Deletes metadata for a specific model type.
   * @param type - The type of the model (e.g., "internal-events", "external-hazards").
   * @param modelId - The ID of the model for which metadata is being deleted.
   * @param userId - The user ID used for validation and deletion.
   * @returns The deleted metadata document or the updated document if the user was removed from the users list.
   * Returns `null` if no metadata is found.
   */
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

  // New function to save metadata
  public async saveInternalEventMetadata(
    userId: number,
    metadata: InternalEventsMetadata,
  ): Promise<InternalEventsDocument> {
    console.log("Received userId:", userId);
    console.log("Received metadata:", metadata);

    try {
      // Check if a document with this metadata and user already exists
      const existingEvent = await this.internalEventsModel.findOne({
        users: userId,
        "label.name": metadata.label.name, // Adjust based on how you identify unique events
      });

      if (existingEvent) {
        console.log("Updating existing metadata document");
        // Update existing document with new metadata
        existingEvent.label = metadata.label;
        existingEvent.users = [userId];

        // If `users` is now empty, delete the metadata document
        if (existingEvent.users.length === 0) {
          console.log("No users left in metadata, deleting document");
          await this.internalEventsModel.findByIdAndDelete(existingEvent._id);
          return null; // Return null to indicate the document was deleted
        }

        console.log("Completed saveInternalEventMetadata successfully");
        return existingEvent.save();
      } else {
        console.log("Creating new metadata document");
        // Create new document if it doesn’t exist
        const event = new this.internalEventsModel({
          ...metadata,
          users: [userId],
        });

        const savedEvent = await event.save();
        console.log("Completed saveInternalEventMetadata successfully");
        return savedEvent;
      }
    } catch (error) {
      console.error("Error saving metadata:", error);
      throw error;
    }
  }
}
