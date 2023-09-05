import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InternalEvents, InternalEventsDocument } from './schemas/internal-events.schema';
import { InternalHazards, InternalHazardsDocument } from './schemas/internal-hazards.schema';
import { ExternalHazards, ExternalHazardsDocument } from './schemas/external-hazards.schema';
import { FullScope, FullScopeDocument } from './schemas/full-scope.schema';
import { TypedModel, TypedModelJSON } from './schemas/templateSchema/typed-model.schema';
import { ModelCounter, ModelCounterDocument } from '../schemas/model-counter.schema';

@Injectable()
export class TypedModelService {
  constructor(
    @InjectModel(ModelCounter.name) private modelCounterModel: Model<ModelCounterDocument>,
    @InjectModel(InternalEvents.name) private internalEventsModel: Model<InternalEventsDocument>,
    @InjectModel(InternalHazards.name) private internalHazardsModel: Model<InternalHazardsDocument>,
    @InjectModel(ExternalHazards.name) private externalHazardsModel: Model<ExternalHazardsDocument>,
    @InjectModel(FullScope.name) private fullScopeModel: Model<FullScopeDocument>
  ) {}

  /** 
   * this was copied from elsewhere, its to create a counter, it should probably have the suer counter named something else now but oh well
    * @param {string} name Name of the counter
    * @description
    * Generates an ID for the newly created user in an incremental order of 1. Initially if no user exists, the serial ID starts from 1.
    * @returns {number} ID number
    */
  async getNextModelValue(name: string) {
    let record = await this.modelCounterModel.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true });
    if(!record) {
        let newCounter = new this.modelCounterModel({ _id: name, seq: 1 });
        await newCounter.save();
        return newCounter.seq;
    }
    return record.seq;
  }

  //first we are going to put the 4 put requests for each of the 4 types of model

  /**
   * method for creating a new internal evnet model in the database
   * @param body takes in the model type that is requested in the name
   * @returns promise with the model type
   */
  async createInternalEventModel(body: Partial<InternalEvents>): Promise<TypedModel> {
    try {
      const newInternalEvent = new this.internalEventsModel(body);
      newInternalEvent.id = await this.getNextModelValue('ModelCounter');
      return newInternalEvent.save();
    } catch(error) {
      throw new Error(error);
    }
  }

  /**
   * method for creating a new internal evnet model in the database
   * @param body takes in the model type that is requested in the name
   * @returns promise with the model type
   */
  async createInternalHazardModel(body: Partial<InternalHazards>): Promise<TypedModel> {
    try {
      const newInternalHazard = new this.internalHazardsModel(body);
      newInternalHazard.id = await this.getNextModelValue('ModelCounter');
      return newInternalHazard.save()
    } catch(error) {
      throw new Error(error);
    }
  }

  /**
   * method for creating a new internal evnet model in the database
   * @param body takes in the model type that is requested in the name
   * @returns promise with the model type
   */
  async createExternalHazardModel(body: Partial<ExternalHazards>): Promise<TypedModel> {
    try {
      const newExternalHazard = new this.externalHazardsModel(body);
      newExternalHazard.id = await this.getNextModelValue('ModelCounter');
      return newExternalHazard.save();
    } catch(error) {
      throw new Error(error);
    }
  }

  /**
   * method for creating a new internal evnet model in the database
   * @param body takes in the model type that is requested in the name
   * @returns promise with the model type
   */
  async createFullScopeModel(body: Partial<FullScope>): Promise<TypedModel> {
    try {
      const newFullScope = new this.fullScopeModel(body);
      newFullScope.id = await this.getNextModelValue('ModelCounter');
      return newFullScope.save();
    } catch (error) {
      throw new Error(error);
    }
  }

  //put functions

  /**
   * updates a single model at the given id, replacing it with a new one
   * @param modelId the id of the model to be updated
   * @param userId the user who must be on the model
   * @param model the new model we want to put at the id
   * @returns the new InternalEventsModel
   */
  async patchInternalEvent(modelId: string, userId: number, model: Partial<InternalEvents>): Promise<InternalEvents> {
    try {
      // Find the document that matches the provided modelId and userId
      const query = { 'id': Number(modelId), 'users': userId};

      const newInternalEvent = new this.internalEventsModel(model);

      const updateData = {
        users: newInternalEvent.users,
        label: newInternalEvent.label
      }

      // The `new` option returns the updated document instead of the original one
      const options = { new: true };

      // Update the document with the provided model data
      return await this.internalEventsModel.findOneAndUpdate(query, updateData, options);

    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * updates a single model at the given id, replacing it with a new one
   * @param modelId the id of the model to be updated
   * @param userId the user who must be on the model
   * @param model the new model we want to put at the id
   * @returns the new InternalHazardsModel
   */
  async patchInternalHazard(modelId: string, userId: number, model: Partial<InternalHazards>): Promise<InternalHazards> {
    try {
      // Find the document that matches the provided modelId and userId
      const query = { 'id': Number(modelId), 'users': userId};

      const newInternalHazard = new this.internalHazardsModel(model);

      const updateData = {
        users: newInternalHazard.users,
        label: newInternalHazard.label
      }

      // The `new` option returns the updated document instead of the original one
      const options = { new: true };

      // Update the document with the provided model data
      return await this.internalHazardsModel.findOneAndUpdate(query, updateData, options);

    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * updates a single model at the given id, replacing it with a new one
   * @param modelId the id of the model to be updated
   * @param userId the user who must be on the model
   * @param model the new model we want to put at the id
   * @returns the new ExternalHazardsModel
   */
  async patchExternalHazard(modelId: string, userId: number, model: Partial<ExternalHazards>): Promise<ExternalHazards> {
    try {
      // Find the document that matches the provided modelId and userId
      const query = { 'id': Number(modelId), 'users': userId};

      const newExternalHazard = new this.externalHazardsModel(model);

      const updateData = {
        users: newExternalHazard.users,
        label: newExternalHazard.label
      }

      // The `new` option returns the updated document instead of the original one
      const options = { new: true };

      // Update the document with the provided model data
      return await this.externalHazardsModel.findOneAndUpdate(query, updateData, options);

    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * updates a single model at the given id, replacing it with a new one
   * @param modelId the id of the model to be updated
   * @param userId the user who must be on the model
   * @param model the new model we want to put at the id
   * @returns the new FulLScopeModel
   */
  async patchFullScope(modelId: string, userId: number, model: Partial<FullScope>): Promise<FullScope> {
    try {
      // Find the document that matches the provided modelId and userId
      const query = { 'id': Number(modelId), 'users': userId};

      const newFullScope = new this.fullScopeModel(model);

      const updateData = {
        users: newFullScope.users,
        label: newFullScope.label
      }

      // The `new` option returns the updated document instead of the original one
      const options = { new: true };

      // Update the document with the provided model data
      return await this.fullScopeModel.findOneAndUpdate(query, updateData, options);

    } catch (error) {
      throw new Error(error);
    }
  }

  //get functions

  /**
   * function to return all of the desired model type of a given user
   * @param userId the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getInternalEvents(userId: number): Promise<InternalEvents[]> {
    //typecast to a number because for some reason, it isn't a number????
    try {
      return this.internalEventsModel.find({'users': userId})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * function to return all of the desired model type of a given user
   * @param userId the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getInternalHazards(userId: number): Promise<InternalHazards[]> {
    try {
      return this.internalHazardsModel.find({'users': userId})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * function to return all of the desired model type of a given user
   * @param userId the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getExternalHazards(userId: number): Promise<ExternalHazards[]> {
    try {
      return this.externalHazardsModel.find({'users': userId})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * function to return all of the desired model type of a given user
   * @param userId the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getFullScopes(userId: number): Promise<FullScope[]> {
    try {
      return this.fullScopeModel.find({'users': userId})
    } catch (error) {
      throw new Error(error);
    }
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
    try {
      return this.internalEventsModel.findOne({ id: modelId, 'users': userId})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * function to return all of the desired model type of a given user
   * @param userId the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getInternalHazard(modelId: string, userId: number): Promise<InternalHazards> {
    try {
      return this.internalHazardsModel.findOne({ id: modelId, 'users': userId})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * function to return all of the desired model type of a given user
   * @param userId the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getExternalHazard(modelId: string, userId: number): Promise<ExternalHazards> {
    try {
      return this.externalHazardsModel.findOne({ id: modelId, 'users': userId})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * function to return all of the desired model type of a given user
   * @param userId the user who's models are to be loaded
   * @returns the list of models for the type that the user has been assigned to
   */
  async getFullScope(modelId: string, userId: number): Promise<FullScope> {
    try {
      return this.fullScopeModel.findOne({ id: modelId, 'users': userId})
    } catch (error) {
      throw new Error(error);
    }
  }

  //delete functions

  /**
   * deletes an internal event with the given id from a user, and from the database if these is only 1 user
   * @param modelId the id of the internal event to be deleted
   * @returns the deleted model
   */
  async deleteInternalEvent (modelId: number, userId: number): Promise<InternalEventsModel> {
    try {

      //this will be the pull result data and will be used a lot for seeing things form requests to remove properly
      let result
      
      //query to search based on this field
      const query = {'id': Number(modelId)}

      //to remove the id from the list
      const updateData = {
        $pull: {
          users: Number(userId)
        }
      }

      while(result = await this.internalEventsModel.findOne(query)){
        if(result.users.length == 1){
          return await this.internalEventsModel.findOneAndDelete(query)
        } else {
          return await this.internalEventsModel.findOneAndUpdate(query, updateData)
        }
      }

    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * deletes an internal hazard with the given id from a user, and from the database if these is only 1 user
   * @param modelId the id of the internal hazard to be deleted
   * @returns the deleted model
   */
  async deleteInternalHazard (modelId: number, userId: number): Promise<InternalHazardsModel> {
    try {

      //this will be the pull result data and will be used a lot for seeing things form requests to remove properly
      let result
      
      //query to search based on this field
      const query = {'users': Number(modelId)}

      //to remove the id from the list
      const updateData = {
        $pull: {
          users: Number(userId)
        }
      }

      while(result = await this.internalHazardsModel.findOne(query)){
        if(result.parentIds.length == 1){
          return await this.internalHazardsModel.findOneAndDelete(query)
        } else {
          return await this.internalHazardsModel.findOneAndUpdate(query, updateData)
        }
      }

    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * deletes an external hazard with the given id from a user, and from the database if these is only 1 user
   * @param modelId the id of the external hazard to be deleted
   * @returns the deleted model
   */
  async deleteExternalHazard (modelId: number, userId: number): Promise<ExternalHazardsModel> {
    try {
      //this will be the pull result data and will be used a lot for seeing things form requests to remove properly
      let result
      
      //query to search based on this field
      const query = {'users': Number(modelId)}

      //to remove the id from the list
      const updateData = {
        $pull: {
          users: Number(userId)
        }
      }
      while(result = await this.externalHazardsModel.findOne(query)){
        if(result.parentIds.length == 1){
          return await this.externalHazardsModel.findOneAndDelete(query)
        } else {
          return await this.externalHazardsModel.findOneAndUpdate(query, updateData)
        }
      }

    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * deletes a full scope with the given id from a user, and from the database if these is only 1 user
   * @param modelId the id of the full scope to be deleted
   * @returns the deleted model
   */
  async deleteFullScope (modelId: number, userId: number): Promise<FullScopeModel> {
    try {
      //this will be the pull result data and will be used a lot for seeing things form requests to remove properly
      let result
      
      //query to search based on this field
      const query = {'users': Number(modelId)}

      //to remove the id from the list
      const updateData = {
        $pull: {
          users: Number(userId)
        }
      }

      while(result = await this.fullScopeModel.findOne(query)){
        if(result.parentIds.length == 1){
          return await this.fullScopeModel.findOneAndDelete(query)
        } else {
          return await this.fullScopeModel.findOneAndUpdate(query, updateData)
        }
      }

    } catch (error) {
      throw new Error(error);
    }
  }

  //functions to add nested models

  /**
   * adds a nested model to a larger model
   * @param modelId id of the typed model 
   * @param nestedId id of the nested model
   * @param nestedType string in camelCase of the nested model type
   * @returns a promise with the new typed model
   */
  async addNestedToInternalEvent(modelId: number, nestedId: number, nestedType: string): Promise<TypedModelJSON> {
    try {
      // Find the document that matches the provided modelId and userId
      const query = { 'id': modelId };

      const updateData = {
        $push: {
          [nestedType]: nestedId
        }
      };

      // The `new` option returns the updated document instead of the original one
      const options = { new: true };

      // Update the document with the provided model data
      return this.internalEventsModel.findOneAndUpdate(query, updateData, options);
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * adds a nested model to a larger model
   * @param modelId id of the typed model 
   * @param nestedId id of the nested model
   * @param nestedType string in camelCase of the nested model type
   * @returns a promise with the new typed model
   */
  async addNestedToInternalHazard(modelId: number, nestedId: number, nestedType: string ): Promise<TypedModelJSON> {
    try {
      // Find the document that matches the provided modelId and userId
      const query = { 'id': Number(modelId)};

      const updateData = {
        $push: {
          [nestedType]: Number(nestedId)
        }
      }

      // The `new` option returns the updated document instead of the original one
      const options = { new: true };

      // Update the document with the provided model data
      return this.internalHazardsModel.findOneAndUpdate(query, updateData, options);
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * adds a nested model to a larger model
   * @param modelId id of the typed model 
   * @param nestedId id of the nested model
   * @param nestedType string in camelCase of the nested model type
   * @returns a promise with the new typed model
   */
  async addNestedToExternalHazard(modelId: number, nestedId: number, nestedType: string ): Promise<TypedModelJSON> {
    try {
      // Find the document that matches the provided modelId and userId
      const query = { 'id': Number(modelId)};

      const updateData = {
        $push: {
          [nestedType]: Number(nestedId)
        }
      }

      // The `new` option returns the updated document instead of the original one
      const options = { new: true };

      // Update the document with the provided model data
      return this.externalHazardsModel.findOneAndUpdate(query, updateData, options);
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * adds a nested model to a larger model
   * @param modelId id of the typed model 
   * @param nestedId id of the nested model
   * @param nestedType string in camelCase of the nested model type
   * @returns a promise with the new typed model
   */
  async addNestedToFullScope(modelId: number, nestedId: number, nestedType: string ): Promise<TypedModelJSON> {
    try {
      // Find the document that matches the provided modelId and userId
      const query = { 'id': Number(modelId)};

      const updateData = {
        $push: {
          [nestedType]: Number(nestedId)
        }
      }

      // The `new` option returns the updated document instead of the original one
      const options = { new: true };

      // Update the document with the provided model data
      return this.fullScopeModel.findOneAndUpdate(query, updateData, options);
    } catch (error) {
      throw new Error(error);
    }
  }

  //deleting nested model ids

  /**
   * deletes a nested model to a larger model
   * @param modelId id of the typed model 
   * @param nestedId id of the nested model
   * @param nestedType string in camelCase of the nested model type
   * @returns a promise with the new typed model
   */
  async deleteNestedFromInternalEvent(modelId: number, nestedId: number, nestedType: string ): Promise<TypedModelJSON> {
    try {
      // Find the document that matches the provided modelId and userId
      const query = { 'id': Number(modelId)};

      const updateData = {
        $pull: {
          [nestedType]: Number(nestedId)
        }
      }

      // The `new` option returns the updated document instead of the original one
      const options = { new: true };

      // Update the document with the provided model data
      return this.internalEventsModel.findOneAndUpdate(query, updateData, options);
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * deletes a nested model to a larger model
   * @param modelId id of the typed model 
   * @param nestedId id of the nested model
   * @param nestedType string in camelCase of the nested model type
   * @returns a promise with the new typed model
   */
  async deleteNestedFromInternalHazard(modelId: string, nestedId: number, nestedType: string ): Promise<TypedModelJSON> {
    try {
      // Find the document that matches the provided modelId and userId
      const query = { 'id': Number(modelId)};

      const updateData = {
        $pull: {
          [nestedType]: Number(nestedId)
        }
      }

      // The `new` option returns the updated document instead of the original one
      const options = { new: true };

      // Update the document with the provided model data
      return this.internalHazardsModel.findOneAndUpdate(query, updateData, options);
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * deletes a nested model to a larger model
   * @param modelId id of the typed model 
   * @param nestedId id of the nested model
   * @param nestedType string in camelCase of the nested model type
   * @returns a promise with the new typed model
   */
  async deleteNestedFromExternalHazard(modelId: string, nestedId: number, nestedType: string ): Promise<TypedModelJSON> {
    try {
      // Find the document that matches the provided modelId and userId
      const query = { 'id': Number(modelId)};

      const updateData = {
        $pull: {
          [nestedType]: Number(nestedId)
        }
      }

      // The `new` option returns the updated document instead of the original one
      const options = { new: true };

      // Update the document with the provided model data
      return this.externalHazardsModel.findOneAndUpdate(query, updateData, options);
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * deletes a nested model to a larger model
   * @param modelId id of the typed model 
   * @param nestedId id of the nested model
   * @param nestedType string in camelCase of the nested model type
   * @returns a promise with the new typed model
   */
  async deleteNestedFromFullScope(modelId: string, nestedId: number, nestedType: string ): Promise<TypedModelJSON> {
    try {
      // Find the document that matches the provided modelId and userId
      const query = { 'id': Number(modelId)};

      const updateData = {
        $pull: {
          [nestedType]: Number(nestedId)
        }
      }

      // The `new` option returns the updated document instead of the original one
      const options = { new: true };

      // Update the document with the provided model data
      return this.fullScopeModel.findOneAndUpdate(query, updateData, options);
    } catch (error) {
      throw new Error(error);
    }
  }
}