import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model } from "mongoose";
import { ModelCounter, ModelCounterDocument } from "../schemas/model-counter.schema";
import { InternalEvents, InternalEventsDocument } from "./schemas/internal-events.schema";
import { InternalHazards, InternalHazardsDocument } from "./schemas/internal-hazards.schema";
import { ExternalHazards, ExternalHazardsDocument } from "./schemas/external-hazards.schema";
import { FullScope, FullScopeDocument } from "./schemas/full-scope.schema";
import { MetaTypedModelService } from "./metadata/meta-typed-model.service";

@Injectable()
export class TypedModelService {
  constructor(
    @InjectModel(ModelCounter.name)
    private readonly modelCounterModel: Model<ModelCounterDocument>,
    @InjectModel(InternalEvents.name)
    private readonly internalEventsModel: Model<InternalEventsDocument>,
    @InjectModel(InternalHazards.name)
    private readonly internalHazardsModel: Model<InternalHazardsDocument>,
    @InjectModel(ExternalHazards.name)
    private readonly externalHazardsModel: Model<ExternalHazardsDocument>,
    @InjectModel(FullScope.name)
    private readonly fullScopeModel: Model<FullScopeDocument>,
    private readonly metaTypedModelService: MetaTypedModelService,
  ) {}

  private getModelByType(
    type: string,
  ): Model<InternalEventsDocument | InternalHazardsDocument | ExternalHazardsDocument | FullScopeDocument> {
    switch (type) {
      case "internal-events":
        return this.internalEventsModel;
      case "internal-hazards":
        return this.internalHazardsModel;
      case "external-hazards":
        return this.externalHazardsModel;
      case "full-scope":
        return this.fullScopeModel;
      default:
        throw new Error(`Invalid type: ${type}`);
    }
  }

  /**
   * this was copied from elsewhere, its to create a counter, it should probably have the suer counter named something else now but oh well
   * @param name - Name of the counter
   * @remarks Generates an ID for the newly created user in an incremental order of 1.
   * Initially if no user exists, the serial ID starts from 1.
   * @returns ID number
   */

  async getNextModelValue(name: string) {
    const update = { $inc: { seq: 1 } };
    const options = { new: true, upsert: true };
    const result = await this.modelCounterModel.findOneAndUpdate({ _id: name }, update, options);
    return result.seq;
  }

  // Create a model
  async createModel(type: string, modelData: Record<string, any>): Promise<any> {
    const model = this.getModelByType(type);
    const id = await this.getNextModelValue("ModelCounter");
    modelData.id = id;
    const newModel = new model(modelData);
    const savedModel = await newModel.save();

    // // Trigger metadata creation
    if (savedModel.users && savedModel.users.length > 0) {
      await this.metaTypedModelService.saveMetadata(
        type,
        savedModel.id,
        savedModel.users[0],
        savedModel.label,
        savedModel.users,
      );
    }
    return savedModel;
  }

  // Update a model
  async patchModel(type: string, modelId: string, userId: number, modelData: Record<string, any>): Promise<any> {
    const model = this.getModelByType(type);
    const query = { id: Number(modelId), users: userId };

    const updateData = {
      ...modelData,
    };
    const options = { new: true };
    const updatedModel = await model.findOneAndUpdate(query, updateData, options);

    // // Trigger metadata update
    if (updatedModel) {
      await this.metaTypedModelService.updateMetadata(type, modelId, {
        label: updatedModel.label,
        users: updatedModel.users,
      });
    }

    return updatedModel;
  }

  // Fetch all models of a type
  async getModels(type: string, userId: number): Promise<any[]> {
    const model = this.getModelByType(type);
    return model.find({ users: userId });
  }

  // Fetch a single model by ID
  async getModel(type: string, modelId: string, userId: number): Promise<any> {
    const model = this.getModelByType(type);
    return model.findOne({ id: modelId, users: userId });
  }

  // // Delete a model
  async deleteModel(type: string, modelId: string, userId: number): Promise<any> {
    const model = this.getModelByType(type);
    const query = { id: Number(modelId), users: userId };
    const existingModel = await model.findOne(query);

    if (!existingModel) {
      throw new Error(`Model with ID "${modelId}" not found for user "${userId}".`);
    }

    if (existingModel.users.length === 1) {
      const deletedModel = await model.findOneAndDelete(query);
      await this.metaTypedModelService.deleteMetadata(type, modelId, userId);
      return deletedModel;
    }

    const updatedModel = await model.findOneAndUpdate(query, { $pull: { users: userId } }, { new: true });
    await this.metaTypedModelService.updateMetadata(type, modelId, {
      users: updatedModel.users,
    });
    return updatedModel;
  }

  // Add a nested model
  async addNestedModel(type: string, modelId: string, nestedId: number, nestedType: string): Promise<any> {
    const model = this.getModelByType(type);
    const update = { $push: { [nestedType]: nestedId } };
    return model.findOneAndUpdate({ id: modelId }, update, { new: true });
  }

  // Delete a nested model
  async deleteNestedModel(type: string, modelId: string, nestedId: number, nestedType: string): Promise<any> {
    const model = this.getModelByType(type);
    const update = { $pull: { [nestedType]: nestedId } };
    return model.findOneAndUpdate({ id: modelId }, update, { new: true });
  }
}
