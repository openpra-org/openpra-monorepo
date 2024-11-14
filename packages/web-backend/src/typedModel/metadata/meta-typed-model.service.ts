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

  //GET functions
  /**
   * function to return all the metadata of the desired model type of a given user
   * @param userId the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getInternalEventsMetaData(userId: number): Promise<InternalEventsMetadata[]> {
    const valuesToSelect = ["label", "users"];

    return this.internalEventsModel.find({ users: userId }).select(valuesToSelect);
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

//GET functions
