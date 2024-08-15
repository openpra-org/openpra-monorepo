import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model } from "mongoose";
import { InternalEventsModel } from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import { InternalHazardsModel } from "shared-types/src/lib/types/modelTypes/largeModels/internalHazardsModel";
import { FullScopeModel } from "shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel";
import { ExternalHazardsModel } from "shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel";
import { ModelCounter, ModelCounterDocument } from "../schemas/model-counter.schema";
import { InternalEvents, InternalEventsDocument } from "./schemas/internal-events.schema";
import { InternalHazards, InternalHazardsDocument } from "./schemas/internal-hazards.schema";
import { ExternalHazards, ExternalHazardsDocument } from "./schemas/external-hazards.schema";
import { FullScope, FullScopeDocument } from "./schemas/full-scope.schema";
import { TypedModel, TypedModelJSON } from "./schemas/templateSchema/typed-model.schema";

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
  ) {}

  /**
   * this was copied from elsewhere, its to create a counter, it should probably have the suer counter named something else now but oh well
   * @param name - Name of the counter
   * @remarks Generates an ID for the newly created user in an incremental order of 1.
   * Initially if no user exists, the serial ID starts from 1.
   * @returns ID number
   */
  async getNextModelValue(name: string) {
    const record = await this.modelCounterModel.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true });
    if (!record) {
      const newCounter = new this.modelCounterModel({ _id: name, seq: 1 });
      await newCounter.save();
      return newCounter.seq;
    }
    return record.seq;
  }
  /**
   * Creates a new model document in the database.
   *
   * @template T - The type of the model, extending the TypedModel interface.
   * @param {Model<T>} modelClass - The Mongoose model class used to create the document.
   * @param {Partial<T>} body - A partial object containing the fields for the new document.
   * @returns {Promise<T>} - A promise that resolves to the created model document.
   *
   * This function performs the following steps:
   * 1. Creates a new instance of the provided `modelClass`, spreading the `body` data into it.
   * 2. Adds `createdAt` and `lastModifiedAt` timestamps, both set to the current time.
   * 3. Generates a new `id` for the model by invoking `getNextModelValue("ModelCounter")`.
   * 4. Saves the newly created model document to the database.
   */
  async createModel<T extends TypedModel>(modelClass: Model<T>, body: Partial<T>): Promise<T> {
    const newModel = new modelClass({
      ...body,
      createdAt: Date.now(),
      lastModifiedAt: Date.now(),
    });
    newModel.id = await this.getNextModelValue("ModelCounter");
    return newModel.save();
  }

  /**
   * Creates a new Internal Event model document in the database.
   *
   * @param {Partial<InternalEvents>} body - A partial object containing the fields for the new Internal Event document.
   * @returns {Promise<TypedModel>} - A promise that resolves to the created Internal Event model document.
   *
   * This function delegates the creation of the document to the `createModel` method, passing in
   * the `internalEventsModel` class and the provided `body` data.
   */
  async createInternalEventModel(body: Partial<InternalEvents>): Promise<TypedModel> {
    return this.createModel(this.internalEventsModel, body);
  }

  /**
   * Creates a new Internal Hazard model document in the database.
   *
   * @param {Partial<InternalHazards>} body - A partial object containing the fields for the new Internal Hazard document.
   * @returns {Promise<TypedModel>} - A promise that resolves to the created Internal Hazard model document.
   *
   * This function delegates the creation of the document to the `createModel` method, passing in
   * the `internalHazardsModel` class and the provided `body` data.
   */
  async createInternalHazardModel(body: Partial<InternalHazards>): Promise<TypedModel> {
    return this.createModel(this.internalHazardsModel, body);
  }

  /**
   * Creates a new External Hazard model document in the database.
   *
   * @param {Partial<ExternalHazards>} body - A partial object containing the fields for the new External Hazard document.
   * @returns {Promise<TypedModel>} - A promise that resolves to the created External Hazard model document.
   *
   * This function delegates the creation of the document to the `createModel` method, passing in
   * the `externalHazardsModel` class and the provided `body` data.
   */
  async createExternalHazardModel(body: Partial<ExternalHazards>): Promise<TypedModel> {
    return this.createModel(this.externalHazardsModel, body);
  }

  /**
   * Creates a new Full Scope model document in the database.
   *
   * @param {Partial<FullScope>} body - A partial object containing the fields for the new Full Scope document.
   * @returns {Promise<TypedModel>} - A promise that resolves to the created Full Scope model document.
   *
   * This function delegates the creation of the document to the `createModel` method, passing in
   * the `fullScopeModel` class and the provided `body` data.
   */
  async createFullScopeModel(body: Partial<FullScope>): Promise<TypedModel> {
    return this.createModel(this.fullScopeModel, body);
  }

  //put functions

  /**
   * Updates a specific model document in the database by applying partial updates.
   *
   * @param {Model<T>} modelClass - The Mongoose model class representing the document to update.
   * @param {string} modelId - The ID of the model document to be updated.
   * @param {number} userId - The ID of the user associated with the model document.
   * @param {Partial<T>} updateData - An object containing the fields to update in the model document.
   * @returns {Promise<T>} - A promise that resolves to the updated model document.
   *
   * This function performs the following actions:
   * 1. Constructs a query to find the document that matches the provided `modelId` and `userId`.
   * 2. Adds a `lastModifiedAt` field to the update data, setting it to the current timestamp.
   * 3. Executes the update operation using `findOneAndUpdate`, which updates the document based on the query.
   * 4. The `new` option ensures that the updated document is returned instead of the original one.
   */
  async patchModel<T extends TypedModel>(
    modelClass: Model<T>,
    modelId: string,
    userId: number,
    updateData: Partial<T>,
  ): Promise<T> {
    // Find the document that matches the provided modelId and userId
    const query = { id: Number(modelId), users: userId };
    // Add modifiedAt to the updateData
    const updatePayload: Partial<T> = {
      ...updateData,
      lastModifiedAt: Date.now(), // Set modifiedAt to the current timestamp
    };
    // The `new` option returns the updated document instead of the original one
    const options = { new: true };
    // Update the document with the provided model data
    return await modelClass.findOneAndUpdate(query, updatePayload, options);
  }

  /**
   * Updates an Internal Event model document in the database.
   *
   * @param {string} modelId - The ID of the Internal Event model document to be updated.
   * @param {number} userId - The ID of the user associated with the model document.
   * @param {Partial<InternalEvents>} model - An object containing the fields to update in the Internal Event model document.
   * @returns {Promise<InternalEvents>} - A promise that resolves to the updated Internal Event model document.
   *
   * This function delegates the update operation to the `patchModel` function for Internal Events.
   */
  async patchInternalEvent(modelId: string, userId: number, model: Partial<InternalEvents>): Promise<InternalEvents> {
    return this.patchModel(this.internalEventsModel, modelId, userId, model);
  }

  /**
   * Updates an Internal Hazard model document in the database.
   *
   * @param {string} modelId - The ID of the Internal Hazard model document to be updated.
   * @param {number} userId - The ID of the user associated with the model document.
   * @param {Partial<InternalHazards>} model - An object containing the fields to update in the Internal Hazard model document.
   * @returns {Promise<InternalHazards>} - A promise that resolves to the updated Internal Hazard model document.
   *
   * This function delegates the update operation to the `patchModel` function for Internal Hazards.
   */
  async patchInternalHazard(
    modelId: string,
    userId: number,
    model: Partial<InternalHazards>,
  ): Promise<InternalHazards> {
    return this.patchModel(this.internalHazardsModel, modelId, userId, model);
  }

  /**
   * Updates an External Hazard model document in the database.
   *
   * @param {string} modelId - The ID of the External Hazard model document to be updated.
   * @param {number} userId - The ID of the user associated with the model document.
   * @param {Partial<ExternalHazards>} model - An object containing the fields to update in the External Hazard model document.
   * @returns {Promise<ExternalHazards>} - A promise that resolves to the updated External Hazard model document.
   *
   * This function delegates the update operation to the `patchModel` function for External Hazards.
   */
  async patchExternalHazard(
    modelId: string,
    userId: number,
    model: Partial<ExternalHazards>,
  ): Promise<ExternalHazards> {
    return this.patchModel(this.externalHazardsModel, modelId, userId, model);
  }

  /**
   * Updates a Full Scope model document in the database.
   *
   * @param {string} modelId - The ID of the Full Scope model document to be updated.
   * @param {number} userId - The ID of the user associated with the model document.
   * @param {Partial<FullScope>} model - An object containing the fields to update in the Full Scope model document.
   * @returns {Promise<FullScope>} - A promise that resolves to the updated Full Scope model document.
   *
   * This function delegates the update operation to the `patchModel` function for Full Scope models.
   */
  async patchFullScope(modelId: string, userId: number, model: Partial<FullScope>): Promise<FullScope> {
    return this.patchModel(this.fullScopeModel, modelId, userId, model);
  }

  //get functions

  /**
   * function to return all of the desired model type of a given user
   * @param userId the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getInternalEvents(userId: number): Promise<InternalEvents[]> {
    //typecast to a number because for some reason, it isn't a number????

    return this.internalEventsModel.find({ users: userId });
  }

  /**
   * function to return all of the desired model type of a given user
   * @param userId the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getInternalHazards(userId: number): Promise<InternalHazards[]> {
    return this.internalHazardsModel.find({ users: userId });
  }

  /**
   * function to return all of the desired model type of a given user
   * @param userId the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getExternalHazards(userId: number): Promise<ExternalHazards[]> {
    return this.externalHazardsModel.find({ users: userId });
  }

  /**
   * function to return all of the desired model type of a given user
   * @param userId the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getFullScopes(userId: number): Promise<FullScope[]> {
    return this.fullScopeModel.find({ users: userId });
  }

  //single get functions

  /**
   * note for all: the id thing is to exclude the _id mongoose stuff from being in the output
   * function to return all of the desired model type of a given user
   * @param userId the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getInternalEvent(modelId: string, userId: number): Promise<InternalEvents> {
    //typecast to a number because for some reason, it isnt a number????

    return this.internalEventsModel.findOne({ id: modelId, users: userId });
  }

  /**
   * function to return all of the desired model type of a given user
   * @param userId the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getInternalHazard(modelId: string, userId: number): Promise<InternalHazards> {
    return this.internalHazardsModel.findOne({ id: modelId, users: userId });
  }

  /**
   * function to return all of the desired model type of a given user
   * @param userId the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getExternalHazard(modelId: string, userId: number): Promise<ExternalHazards> {
    return this.externalHazardsModel.findOne({ id: modelId, users: userId });
  }

  /**
   * function to return all of the desired model type of a given user
   * @param userId the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getFullScope(modelId: string, userId: number): Promise<FullScope> {
    return this.fullScopeModel.findOne({ id: modelId, users: userId });
  }

  //delete functions

  /**
   * deletes an internal event with the given id from a user, and from the database if these is only 1 user
   * @param modelId the id of the internal event to be deleted
   * @param userId the user for which model is to be deleted
   * @returns the deleted model
   */
  async deleteInternalEvent(modelId: number, userId: number): Promise<InternalEventsModel> {
    //this will be the pull result data and will be used a lot for seeing things form requests to remove properly

    //query to search based on this field
    const query = { id: Number(modelId) };

    //to remove the id from the list
    const updateData = {
      $pull: {
        users: Number(userId),
      },
    };

    const result = await this.internalEventsModel.findOne(query);
    if (result.users.length == 1) {
      return await this.internalEventsModel.findOneAndDelete(query);
    } else {
      return await this.internalEventsModel.findOneAndUpdate(query, updateData, { new: true }).lean();
    }
  }

  /**
   * deletes an internal hazard with the given id from a user, and from the database if these is only 1 user
   * @param modelId the id of the internal hazard to be deleted
   * @param userId the user for whom the model is to be deleted
   * @returns the deleted model
   */
  async deleteInternalHazard(modelId: number, userId: number): Promise<InternalHazardsModel> {
    //query to search based on this field
    const query = { id: Number(modelId) };

    //to remove the id from the list
    const updateData = {
      $pull: {
        users: Number(userId),
      },
    };

    const result = await this.internalHazardsModel.findOne(query);
    if (result.users.length == 1) {
      return await this.internalHazardsModel.findOneAndDelete(query, {
        new: true,
      });
    } else {
      result.users = result.users.filter((user) => user != userId);
      return await this.internalHazardsModel.findOneAndUpdate(query, updateData, { new: true }).lean();
    }
  }

  /**
   * deletes an external hazard with the given id from a user, and from the database if these is only 1 user
   * @param modelId the id of the external hazard to be deleted
   * @param userId the id of the user for whom model is to be deleted
   * @returns the deleted model
   */
  async deleteExternalHazard(modelId: number, userId: number): Promise<ExternalHazardsModel> {
    //query to search based on this field
    const query = { id: Number(modelId) };

    //to remove the id from the list
    const updateData = {
      $pull: {
        users: Number(userId),
      },
    };

    const result = await this.externalHazardsModel.findOne(query);
    if (result.users.length == 1) {
      return await this.externalHazardsModel.findOneAndDelete(query);
    } else {
      result.users = result.users.filter((user) => user != userId);
      return await this.externalHazardsModel.findOneAndUpdate(query, updateData, { new: true }).lean();
    }
  }

  /**
   * deletes a full scope with the given id from a user, and from the database if these is only 1 user
   * @param modelId the id of the full scope to be deleted
   * @param userId the user for whom the model is supposed to be deleted
   * @returns the deleted model
   */
  async deleteFullScope(modelId: number, userId: number): Promise<FullScopeModel> {
    //query to search based on this field
    const query = { id: Number(modelId) };

    //to remove the id from the list
    const updateData = {
      $pull: {
        users: Number(userId),
      },
    };

    const result = await this.fullScopeModel.findOne(query);
    if (result.users.length == 1) {
      return await this.fullScopeModel.findOneAndDelete(query);
    } else {
      return await this.fullScopeModel.findOneAndUpdate(query, updateData, {
        new: true,
      });
    }
  }

  /**
   * adds a nested model to a larger model
   * @param modelId id of the typed model
   * @param nestedId id of the nested model
   * @param nestedType string in camelCase of the nested model type
   * @returns a promise with the new typed model
   */
  async addNestedToInternalEvent(modelId: number, nestedId: number, nestedType: string): Promise<TypedModelJSON> {
    // Find the document that matches the provided modelId and userId
    const query = { id: modelId };

    const updateData = {
      $push: {
        [nestedType]: nestedId,
      },
    };

    // The `new` option returns the updated document instead of the original one
    const options = { new: true };

    // Update the document with the provided model data
    return this.internalEventsModel.findOneAndUpdate(query, updateData, options);
  }

  /**
   * adds a nested model to a larger model
   * @param modelId id of the typed model
   * @param nestedId id of the nested model
   * @param nestedType string in camelCase of the nested model type
   * @returns a promise with the new typed model
   */
  async addNestedToInternalHazard(modelId: number, nestedId: number, nestedType: string): Promise<TypedModelJSON> {
    // Find the document that matches the provided modelId and userId
    const query = { id: Number(modelId) };

    const updateData = {
      $push: {
        [nestedType]: Number(nestedId),
      },
    };

    // The `new` option returns the updated document instead of the original one
    const options = { new: true };

    // Update the document with the provided model data
    return this.internalHazardsModel.findOneAndUpdate(query, updateData, options);
  }

  /**
   * adds a nested model to a larger model
   * @param modelId id of the typed model
   * @param nestedId id of the nested model
   * @param nestedType string in camelCase of the nested model type
   * @returns a promise with the new typed model
   */
  async addNestedToExternalHazard(modelId: number, nestedId: number, nestedType: string): Promise<TypedModelJSON> {
    // Find the document that matches the provided modelId and userId
    const query = { id: Number(modelId) };

    const updateData = {
      $push: {
        [nestedType]: Number(nestedId),
      },
    };

    // The `new` option returns the updated document instead of the original one
    const options = { new: true };

    // Update the document with the provided model data
    return this.externalHazardsModel.findOneAndUpdate(query, updateData, options);
  }

  /**
   * adds a nested model to a larger model
   * @param modelId id of the typed model
   * @param nestedId id of the nested model
   * @param nestedType string in camelCase of the nested model type
   * @returns a promise with the new typed model
   */
  async addNestedToFullScope(modelId: number, nestedId: number, nestedType: string): Promise<TypedModelJSON> {
    // Find the document that matches the provided modelId and userId
    const query = { id: Number(modelId) };

    const updateData = {
      $push: {
        [nestedType]: Number(nestedId),
      },
    };

    // The `new` option returns the updated document instead of the original one
    const options = { new: true };

    // Update the document with the provided model data
    return this.fullScopeModel.findOneAndUpdate(query, updateData, options);
  }

  //deleting nested model ids

  /**
   * deletes a nested model to a larger model
   * @param modelId id of the typed model
   * @param nestedId id of the nested model
   * @param nestedType string in camelCase of the nested model type
   * @returns a promise with the new typed model
   */
  async deleteNestedFromInternalEvent(
    modelId: string,
    nestedId: number | string,
    nestedType: string,
  ): Promise<TypedModelJSON> {
    // Find the document that matches the provided modelId and userId
    let query: FilterQuery<InternalEventsDocument>;

    if (typeof nestedId === "string") {
      query = { _id: nestedId };
    } else {
      query = { id: Number(nestedId) };
    }

    const updateData = {
      $pull: {
        [nestedType]: nestedId,
      },
    };

    // The `new` option returns the updated document instead of the original one
    const options = { new: true };

    // Update the document with the provided model data
    return this.internalEventsModel.findOneAndUpdate(query, updateData, options);
  }

  /**
   * deletes a nested model to a larger model
   * @param modelId id of the typed model
   * @param nestedId id of the nested model
   * @param nestedType string in camelCase of the nested model type
   * @returns a promise with the new typed model
   */
  async deleteNestedFromInternalHazard(modelId: string, nestedId: number, nestedType: string): Promise<TypedModelJSON> {
    // Find the document that matches the provided modelId and userId
    const query = { id: Number(modelId) };

    const updateData = {
      $pull: {
        [nestedType]: Number(nestedId),
      },
    };

    // The `new` option returns the updated document instead of the original one
    const options = { new: true };

    // Update the document with the provided model data
    return this.internalHazardsModel.findOneAndUpdate(query, updateData, options);
  }

  /**
   * deletes a nested model to a larger model
   * @param modelId id of the typed model
   * @param nestedId id of the nested model
   * @param nestedType string in camelCase of the nested model type
   * @returns a promise with the new typed model
   */
  async deleteNestedFromExternalHazard(modelId: string, nestedId: number, nestedType: string): Promise<TypedModelJSON> {
    // Find the document that matches the provided modelId and userId
    const query = { id: Number(modelId) };

    const updateData = {
      $pull: {
        [nestedType]: Number(nestedId),
      },
    };

    // The `new` option returns the updated document instead of the original one
    const options = { new: true };

    // Update the document with the provided model data
    return this.externalHazardsModel.findOneAndUpdate(query, updateData, options);
  }

  /**
   * deletes a nested model to a larger model
   * @param modelId id of the typed model
   * @param nestedId id of the nested model
   * @param nestedType string in camelCase of the nested model type
   * @returns a promise with the new typed model
   */
  async deleteNestedFromFullScope(modelId: string, nestedId: number, nestedType: string): Promise<TypedModelJSON> {
    // Find the document that matches the provided modelId and userId
    const query = { id: Number(modelId) };

    const updateData = {
      $pull: {
        [nestedType]: Number(nestedId),
      },
    };

    // The `new` option returns the updated document instead of the original one
    const options = { new: true };

    // Update the document with the provided model data
    return this.fullScopeModel.findOneAndUpdate(query, updateData, options);
  }
}
