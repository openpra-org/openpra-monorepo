import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NestedCounter, NestedCounterDocument } from 'src/schemas/tree-counter.schema';
import { NestedModel } from './schemas/templateSchema/nested-model.schema';
import { BayesianEstimation, BayesianEstimationDocument } from './schemas/bayesian-estimation.schema';
import { EventSequenceDiagram, EventSequenceDiagramDocument } from './schemas/event-sequence-diagram.schema';
import { EventTree, EventTreeDocument } from './schemas/event-tree.schema';
import { FaultTree, FaultTreeDocument } from './schemas/fault-tree.schema';
import { InitiatingEvent, InitiatingEventDocument } from './schemas/initiating-event.schema';
import { MarkovChain, MarkovChainDocument } from './schemas/markov-chain.schema';
import { WeibullAnalysis, WeibullAnalysisDocument } from './schemas/weibull-analysis.schema';
import { FunctionalEvent, FunctionalEventDocument } from './schemas/functional-event.schema';
import { BayesianNetwork, BayesianNetworkDocument } from './schemas/bayesian-network.schema';
import { Init } from 'v8';
import { number } from 'nestjs-zod/z';

@Injectable()
export class NestedModelService {

  //creating out object links to the database
  constructor(
    @InjectModel(BayesianEstimation.name) private bayesianEstimationModel: Model<BayesianEstimationDocument>,
    @InjectModel(EventSequenceDiagram.name) private eventSequenceDiagramModel: Model<EventSequenceDiagramDocument>,
    @InjectModel(BayesianNetwork.name) private bayesianNetworkModel: Model<BayesianNetworkDocument>,
    @InjectModel(EventTree.name) private eventTreeModel: Model<EventTreeDocument>,
    @InjectModel(FaultTree.name) private faultTreeModel: Model<FaultTreeDocument>,
    @InjectModel(FunctionalEvent.name) private functionalEventsModel: Model<FunctionalEventDocument>,
    @InjectModel(InitiatingEvent.name) private initiatingEventModel: Model<InitiatingEventDocument>,
    @InjectModel(MarkovChain.name) private markovChainModel: Model<MarkovChainDocument>,
    @InjectModel(WeibullAnalysis.name) private weibullAnalysisModel: Model<WeibullAnalysisDocument>,
    @InjectModel(NestedCounter.name) private nestedCounterModel: Model<NestedCounterDocument>,
  ) {}

  /** 
  * this was copied from elsewhere, its to create a counter, it should probably have the suer counter named something else now but oh well
  * @param {string} name Name of the counter
  * @description
  * Generates an ID for the newly created user in an incremental order of 1. Initially if no user exists, the serial ID starts from 1.
  * @returns {number} ID number
  */
  async getNextValue(name: string) {
    let record = await this.nestedCounterModel.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true });
    if(!record) {
        let newCounter = new this.nestedCounterModel({ _id: name, seq: 1 });
        await newCounter.save();
        return newCounter.seq;
    }
    return record.seq;
  }

  /** 
  * this was copied from elsewhere, its to create a counter, it should probably have the suer counter named something else now but oh well
  * @param {string} name Name of the counter
  * @description
  * Generates an ID for the newly created user in an incremental order of 1. Initially if no user exists, the serial ID starts from 1.
  * @returns {number} ID number
  */
  async getValue(name: string) : Promise<number> {
    let record = await this.nestedCounterModel.findById(name);
    return (record.seq);
  }

  //method calls for the post methods

  /**
   * creates the type of nestedmodel defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nestmodel in it, which contains the basic data all the nested models have
   */
  async createBayesianEstimation(body: Partial<NestedModel>): Promise<NestedModel> {
    try {
      const newBayesianEstimation = new this.bayesianEstimationModel(body);
      newBayesianEstimation.id = await this.getNextValue('nestedCounter');
      return newBayesianEstimation.save();
    } catch(error) {
      throw new Error(error);
    }
  }

  /**
   * creates the type of nestedmodel defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nestmodel in it, which contains the basic data all the nested models have
   */
  async createBayesianNetwork(body: Partial<NestedModel>): Promise<NestedModel> {
    try {
      const newBayesianNetwork = new this.bayesianNetworkModel(body);
      newBayesianNetwork.id = await this.getNextValue('nestedCounter');
      return newBayesianNetwork.save();
    } catch(error) {
      throw new Error(error);
    }
  }

  /**
   * creates the type of nestedmodel defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nestmodel in it, which contains the basic data all the nested models have
   */
  async createEventSequenceDiagram(body: Partial<NestedModel>): Promise<NestedModel> {
    try {
      const newEventSequenceDiagram = new this.eventSequenceDiagramModel(body);
      newEventSequenceDiagram.id = await this.getNextValue('nestedCounter');
      return newEventSequenceDiagram.save();
    } catch(error) {
      throw new Error(error);
    }
  }

  /**
   * creates the type of nestedmodel defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nestmodel in it, which contains the basic data all the nested models have
   */
  async createEventTree(body: Partial<NestedModel>): Promise<NestedModel> {
    try {
      const newEventTree = new this.eventTreeModel(body);
      newEventTree.id = await this.getNextValue('nestedCounter');
      return newEventTree.save();
    } catch(error) {
      throw new Error(error);
    }
  }

  /**
   * creates the type of nestedmodel defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nestmodel in it, which contains the basic data all the nested models have
   */
  async createFaultTree(body: Partial<NestedModel>): Promise<NestedModel> {
    try {
      const newFaultTree = new this.faultTreeModel(body);
      newFaultTree.id = await this.getNextValue('nestedCounter');
      return newFaultTree.save();
    } catch(error) {
      throw new Error(error);
    }
  }

  /**
   * creates the type of nestedmodel defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nestmodel in it, which contains the basic data all the nested models have
   */
  async createFunctionalEvent(body: Partial<NestedModel>): Promise<NestedModel> {
    try {
      const newFunctionalEvent = new this.functionalEventsModel(body);
      newFunctionalEvent.id = await this.getNextValue('nestedCounter');
      return newFunctionalEvent.save();
    } catch(error) {
      throw new Error(error);
    }
  }

  /**
   * creates the type of nestedmodel defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nestmodel in it, which contains the basic data all the nested models have
   */
  async createInitiatingEvent(body: Partial<NestedModel>): Promise<NestedModel> {
    try {
      const newInitiatingEvent = new this.initiatingEventModel(body);
      newInitiatingEvent.id = await this.getNextValue('nestedCounter');
      return newInitiatingEvent.save();
    } catch(error) {
      throw new Error(error);
    }
  }

  /**
   * creates the type of nestedmodel defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nestmodel in it, which contains the basic data all the nested models have
   */
  async createMarkovChain(body: Partial<NestedModel>): Promise<NestedModel> {
    try {
      const newMarkovChain = new this.markovChainModel(body);
      newMarkovChain.id = await this.getNextValue('nestedCounter');
      return newMarkovChain.save();
    } catch(error) {
      throw new Error(error);
    }
  }

  /**
   * creates the type of nestedmodel defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nestmodel in it, which contains the basic data all the nested models have
   */
  async createWeibullAnalysis(body: Partial<NestedModel>): Promise<NestedModel> {
    try {
      const newWeibullAnalysis = new this.weibullAnalysisModel(body);
      newWeibullAnalysis.id = await this.getNextValue('nestedCounter');
      return newWeibullAnalysis.save();
    } catch(error) {
      throw new Error(error);
    }
  }

  //get collection methods

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getBayesianEstimations(parentId: number): Promise<BayesianEstimation[]> {
    //typecast to a number because for some reason, it isnt a number????
    try {
      return this.bayesianEstimationModel.find({'parentIds': Number(parentId)},{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getBayesianNetworks(parentId: number): Promise<BayesianNetwork[]> {
    //typecast to a number because for some reason, it isnt a number????
    try {
      return this.bayesianNetworkModel.find({'parentIds': Number(parentId)},{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getEventSequenceDiagrams(parentId: number): Promise<EventSequenceDiagram[]> {
    //typecast to a number because for some reason, it isnt a number????
    try {
      return this.eventSequenceDiagramModel.find({'parentIds': Number(parentId)},{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getEventTrees(parentId: number): Promise<EventTree[]> {
    //typecast to a number because for some reason, it isnt a number????
    try {
      return this.eventTreeModel.find({'parentIds': Number(parentId)},{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getFaultTrees(parentId: number): Promise<FaultTree[]> {
    //typecast to a number because for some reason, it isnt a number????
    try {
      return this.faultTreeModel.find({'parentIds': Number(parentId)},{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getFunctionalEvents(parentId: number): Promise<FunctionalEvent[]> {
    //typecast to a number because for some reason, it isnt a number????
    try {
      return this.functionalEventsModel.find({'parentIds': Number(parentId)},{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getInitiatingEvents(parentId: number): Promise<InitiatingEvent[]> {
    //typecast to a number because for some reason, it isnt a number????
    try {
      return this.initiatingEventModel.find({'parentIds': Number(parentId)},{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  async getMarkovChains(parentId: number): Promise<MarkovChain[]> {
    //typecast to a number because for some reason, it isnt a number????
    try {
      return this.markovChainModel.find({'parentIds': Number(parentId)},{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getWeibullAnalysis(parentId: number): Promise<WeibullAnalysis[]> {
    //typecast to a number because for some reason, it isnt a number????
    try {
      return this.weibullAnalysisModel.find({'parentIds': Number(parentId)},{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  //singular get methods

  /**
   * gets a single model from the collection based on the id
   * @param modelId the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleBayesianEstimation(modelId: number): Promise<BayesianEstimation> {
    try {
      return this.bayesianEstimationModel.findOne({ id: modelId },{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleBayesianNetwork(modelId: number): Promise<BayesianNetwork> {
    try {
      return this.bayesianNetworkModel.findOne({ id: modelId },{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleEventSequenceDiagram(modelId: number): Promise<EventSequenceDiagram> {
    try {
      return this.eventSequenceDiagramModel.findOne({ id: modelId },{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleEventTree(modelId: number): Promise<EventTree> {
    try {
      return this.eventTreeModel.findOne({ id: modelId },{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleFaultTree(modelId: number): Promise<FaultTree> {
    try {
      return this.faultTreeModel.findOne({ id: modelId },{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleFunctionalEvent(modelId: number): Promise<FunctionalEvent> {
    try {
      return this.functionalEventsModel.findOne({ id: modelId },{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleInitiatingEvent(modelId: number): Promise<InitiatingEvent> {
    try {
      return this.initiatingEventModel.findOne({ id: modelId },{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleMarkovChain(modelId: number): Promise<MarkovChain> {
    try {
      return this.markovChainModel.findOne({ id: modelId },{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleWeibullAnalysis(modelId: number): Promise<WeibullAnalysis> {
    try {
      return this.weibullAnalysisModel.findOne({ id: modelId },{_id:0})
    } catch (error) {
      throw new Error(error);
    }
  }

  //delete methods

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId the id of the mdoel we want to delete
   * @returns a promise with the deleted model
   */
  async deleteBayesianEstimation (modelId: number): Promise<BayesianEstimation> {
    try {
      return this.bayesianEstimationModel.findOneAndDelete({'id': modelId})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId the id of the mdoel we want to delete
   * @returns a promise with the deleted model
   */
  async deleteBayesianNetwork (modelId: number): Promise<BayesianNetwork> {
    try {
      return this.bayesianNetworkModel.findOneAndDelete({'id': modelId})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId the id of the mdoel we want to delete
   * @returns a promise with the deleted model
   */
  async deleteEventSequenceDiagram (modelId: number): Promise<EventSequenceDiagram> {
    try {
      return this.eventSequenceDiagramModel.findOneAndDelete({'id': modelId})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId the id of the mdoel we want to delete
   * @returns a promise with the deleted model
   */
  async deleteEventTree (modelId: number): Promise<EventTree> {
    try {
      return this.eventTreeModel.findOneAndDelete({'id': modelId})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId the id of the mdoel we want to delete
   * @returns a promise with the deleted model
   */
  async deleteFaultTree (modelId: number): Promise<FaultTree> {
    try {
      return this.faultTreeModel.findOneAndDelete({'id': modelId})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId the id of the mdoel we want to delete
   * @returns a promise with the deleted model
   */
  async deleteFunctionalEvent (modelId: number): Promise<FunctionalEvent> {
    try {
      return this.functionalEventsModel.findOneAndDelete({'id': modelId})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId the id of the mdoel we want to delete
   * @returns a promise with the deleted model
   */
  async deleteInitiatingEvent (modelId: number): Promise<InitiatingEvent> {
    try {
      return this.initiatingEventModel.findOneAndDelete({'id': modelId})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId the id of the mdoel we want to delete
   * @returns a promise with the deleted model
   */
  async deleteMarkovChain (modelId: number): Promise<MarkovChain> {
    try {
      return this.markovChainModel.findOneAndDelete({'id': modelId})
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId the id of the mdoel we want to delete
   * @returns a promise with the deleted model
   */
  async deleteWeibullAnalysis (modelId: number): Promise<WeibullAnalysis> {
    try {
      return this.weibullAnalysisModel.findOneAndDelete({'id': modelId})
    } catch (error) {
      throw new Error(error);
    }
  }

  //method to remove something a single parent from a child given just the parent id

  /**
   * this goes through all the nested models and removes the given parent id from them, and if something is idless, it is removed
   * @param modelId id of the parent model
   */
  async removeParentModels (modelId: number): Promise<number>{
    
    //number of completely removed models which is what will be returned
    let numberRemoved = 0

    //this will be the pull result data and will be used a lot for seeing things form requests to remove properly
    let result

    //query to search based on this field
    const query = {'parentIds': Number(modelId)}

    //to remove the id from the list
    const updateData = {
      $pull: {
        parentIds: Number(modelId)
      }
    }

    //goes through each model type, checks if the id is on any of those
    //then checks if its the *only* one, and either updates and removes or delete it accordingly
    //when a model is permanently removed from thdatabased the removed value does up
    while(result = await this.bayesianEstimationModel.findOne(query)){
      if(result.parentIds.length == 1){
        await this.bayesianEstimationModel.findOneAndDelete(query)
        numberRemoved++
      } else {
        await this.bayesianEstimationModel.findOneAndUpdate(query, updateData)
      }
    }

    while(result = await this.bayesianNetworkModel.findOne(query)){
      if(result.parentIds.length == 1){
        await this.bayesianNetworkModel.findOneAndDelete(query)
        numberRemoved++
      } else {
        await this.bayesianNetworkModel.findOneAndUpdate(query, updateData)
      }
    }

    while(result = await this.initiatingEventModel.findOne(query)){
      if(result.parentIds.length == 1){
        await this.initiatingEventModel.findOneAndDelete(query)
        numberRemoved++
      } else {
        await this.initiatingEventModel.findOneAndUpdate(query, updateData)
      }
    }

    while(result = await this.eventSequenceDiagramModel.findOne(query)){
      if(result.parentIds.length == 1){
        await this.eventSequenceDiagramModel.findOneAndDelete(query)
        numberRemoved++
      } else {
        await this.eventSequenceDiagramModel.findOneAndUpdate(query, updateData)
      }
    }

    while(result = await this.eventTreeModel.findOne(query)){
      if(result.parentIds.length == 1){
        await this.eventTreeModel.findOneAndDelete(query)
        numberRemoved++
      } else {
        await this.eventTreeModel.findOneAndUpdate(query, updateData)
      }
    }

    while(result = await this.faultTreeModel.findOne(query)){
      if(result.parentIds.length == 1){
        await this.faultTreeModel.findOneAndDelete(query)
        numberRemoved++
      } else {
        await this.faultTreeModel.findOneAndUpdate(query, updateData)
      }
    }

    while(result = await this.functionalEventsModel.findOne(query)){
      if(result.parentIds.length == 1){
        await this.functionalEventsModel.findOneAndDelete(query)
        numberRemoved++
      } else {
        await this.functionalEventsModel.findOneAndUpdate(query, updateData)
      }
    }

    while(result = await this.markovChainModel.findOne(query)){
      if(result.parentIds.length == 1){
        await this.markovChainModel.findOneAndDelete(query)
        numberRemoved++
      } else {
        await this.markovChainModel.findOneAndUpdate(query, updateData)
      }
    }

    while(result = await this.weibullAnalysisModel.findOne(query)){
      if(result.parentIds.length == 1){
        await this.weibullAnalysisModel.findOneAndDelete(query)
        numberRemoved++
      } else {
        await this.weibullAnalysisModel.findOneAndUpdate(query, updateData)
      }
    }

    return numberRemoved
  }
}