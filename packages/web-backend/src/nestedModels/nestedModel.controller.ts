import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { NestedModel } from './schemas/templateSchema/nested-model.schema';
import { NestedModelService } from './nestedModel.service';
import { BayesianEstimation } from './schemas/bayesian-estimation.schema';
import { FaultTree } from './schemas/fault-tree.schema';
import { EventTree } from './schemas/event-tree.schema';
import { BayesianNetwork } from './schemas/bayesian-network.schema';
import { EventSequenceDiagram } from './schemas/event-sequence-diagram.schema';
import { FunctionalEvent } from './schemas/functional-event.schema';
import { InitiatingEvent } from './schemas/initiating-event.schema';
import { MarkovChain } from './schemas/markov-chain.schema';
import { WeibullAnalysis } from './schemas/weibull-analysis.schema';
import { Label } from 'src/schemas/label.schema';

@Controller()
export class NestedModelController {

	constructor(private nestedModelService: NestedModelService) {}

  //method to get counter value

  @Get()
  async getCounterPastValue(): Promise<number> {
    return await this.nestedModelService.getValue('nestedCounter')
  }

	//post methods

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
	@Post('/bayesian-estimations/')
  async createBayesianEstimation(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createBayesianEstimation(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
	@Post('/bayesian-networks/')
  async createBayesianNetwowrk(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createBayesianNetwork(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
	@Post('/event-sequence-diagrams/')
  async createEventSequenceDiagram(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createEventSequenceDiagram(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
	@Post('/event-trees/')
  async createEventTree(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createEventTree(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
	@Post('/fault-trees/')
  async createFaultTree(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createFaultTree(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
	@Post('/functional-events/')
  async createFunctionalEvent(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createFunctionalEvent(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
	@Post('/initiating-events/')
  async createInitiatingEvent(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createInitiatingEvent(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
	@Post('/markov-chains/')
  async createMarkovChain(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createMarkovChain(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
	@Post('/weibull-analysis/')
  async createWeibullAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createWeibullAnalysis(data);
  }

  //TODO: patch endpoints eventually for when we know what is getting updated, when and where

  //get collection methods

  /**
   * grabs the colleciton of the type of nested model defined by the function call name (Bayesian estimations)
   * @param id the id of the parent model
   * @returns a promise with a list of the model typed defined
   */
  @Get('/bayesian-estimations/')
  async getBayesianEstimations(@Query('id') id: number): Promise<BayesianEstimation[]> {
    return this.nestedModelService.getBayesianEstimations(id)
  }

  /**
   * grabs the colleciton of the type of nested model defined by the function call name (Bayesian networks)
   * @param id the id of the parent model
   * @returns a promise with a list of the model typed defined
   */
  @Get('/bayesian-networks/')
  async getBayesianNetworks(@Query('id') id: number): Promise<BayesianNetwork[]> {
    return this.nestedModelService.getBayesianNetworks(id)
  }

  /**
   * grabs the colleciton of the type of nested model defined by the function call name (Event Sequence Diagrams)
   * @param id the id of the parent model
   * @returns a promise with a list of the model typed defined
   */
  @Get('/event-sequence-diagrams/')
  async getEventSequenceDiagrams(@Query('id') id: number): Promise<EventSequenceDiagram[]> {
    return this.nestedModelService.getEventSequenceDiagrams(id)
  }

  /**
   * grabs the colleciton of the type of nested model defined by the function call name (Event Trees)
   * @param id the id of the parent model
   * @returns a promise with a list of the model typed defined
   */
  @Get('/event-trees/')
  async getEventTrees(@Query('id') id: number): Promise<EventTree[]> {
    return this.nestedModelService.getEventTrees(id)
  }

  /**
   * grabs the colleciton of the type of nested model defined by the function call name (Fault Trees)
   * @param id the id of the parent model
   * @returns a promise with a list of the model typed defined
   */
  @Get('/fault-trees/')
  async getFaultTrees(@Query('id') id: number): Promise<FaultTree[]> {
  return this.nestedModelService.getFaultTrees(id);
  }

  /**
   * grabs the colleciton of the type of nested model defined by the function call name (Functional events)
   * @param id the id of the parent model
   * @returns a promise with a list of the model typed defined
   */
  @Get('/functional-events/')
  async getFunctionalEvents(@Query('id') id: number): Promise<FunctionalEvent[]> {
    return this.nestedModelService.getFunctionalEvents(id)
  }

  /**
   * grabs the colleciton of the type of nested model defined by the function call name (Initiating Events)
   * @param id the id of the parent model
   * @returns a promise with a list of the model typed defined
   */
  @Get('/initiating-events/')
  async getInitiatingEvents(@Query('id') id: number): Promise<InitiatingEvent[]> {
    return this.nestedModelService.getInitiatingEvents(id)
  }

  /**
   * grabs the colleciton of the type of nested model defined by the function call name (Markov Chains)
   * @param id the id of the parent model
   * @returns a promise with a list of the model typed defined
   */
  @Get('/markov-chains/')
  async getMarkovChains(@Query('id') id: number): Promise<MarkovChain[]> {
    return this.nestedModelService.getMarkovChains(id)
  }

  /**
   * grabs the colleciton of the type of nested model defined by the function call name (Weibull Analysis)
   * @param id the id of the parent model
   * @returns a promise with a list of the model typed defined
   */
  @Get('/weibull-analysis/')
  async getWeibullAnalysis(@Query('id') id: number): Promise<WeibullAnalysis[]> {
    return this.nestedModelService.getWeibullAnalysis(id)
  }

  //singular get endpoints

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get('/bayesian-estimations/:id')
  async getSingleBayesianEstimation(@Param('id') modelId: number): Promise<BayesianEstimation> {
    return this.nestedModelService.getSingleBayesianEstimation(modelId);
  }

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get('/bayesian-networks/:id')
  async getSingleBayesianNetwork(@Param('id') modelId: number): Promise<BayesianNetwork> {
    return this.nestedModelService.getSingleBayesianNetwork(modelId);
  }

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get('/event-sequence-diagrams/:id')
  async getSingleEventSequenceDiagram(@Param('id') modelId: number): Promise<EventSequenceDiagram> {
    return this.nestedModelService.getSingleEventSequenceDiagram(modelId);
  }

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get('/event-trees/:id')
  async getSingleEventTree(@Param('id') modelId: number): Promise<EventTree> {
    return this.nestedModelService.getSingleEventTree(modelId);
  }

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get('/fault-trees/:id')
  async getSingleFaultTree(@Param('id') modelId: number): Promise<FaultTree> {
    return this.nestedModelService.getSingleFaultTree(modelId);
  }

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get('/functional-events/:id')
  async getSingleFunctionalEvent(@Param('id') modelId: number): Promise<FunctionalEvent> {
    return this.nestedModelService.getSingleFunctionalEvent(modelId);
  }

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get('/initiating-events/:id')
  async getSingleInitiatingEvent(@Param('id') modelId: number): Promise<InitiatingEvent> {
    return this.nestedModelService.getSingleInitiatingEvent(modelId);
  }

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get('/markov-chains/:id')
  async getSingleMarkovChain(@Param('id') modelId: number): Promise<MarkovChain> {
    return this.nestedModelService.getSingleMarkovChain(modelId);
  }

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get('/weibull-analysis/:id')
  async getSingleWeibullAnalysis(@Param('id') modelId: number): Promise<WeibullAnalysis> {
    return this.nestedModelService.getSingleWeibullAnalysis(modelId);
  }

  //delete endpoints

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @param id the id of the model to be deleted
   * @returns a promise with the deleted model
   */
  @Delete('/bayesian-estimations/')
  async deleteBayesianEstimation(@Query('id') id: number): Promise<BayesianEstimation> {
    return this.nestedModelService.deleteBayesianEstimation(id);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @param id the id of the model to be deleted
   * @returns a promise with the deleted model
   */
  @Delete('/bayesian-networks/')
  async deleteBayesianNetwork(@Query('id') id: number): Promise<BayesianNetwork> {
    return this.nestedModelService.deleteBayesianNetwork(id);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @param id the id of the model to be deleted
   * @returns a promise with the deleted model
   */
  @Delete('/event-sequence-diagrams/')
  async deleteEventSequenceDiagram(@Query('id') id: number): Promise<EventSequenceDiagram> {
    return this.nestedModelService.deleteEventSequenceDiagram(id);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @param id the id of the model to be deleted
   * @returns a promise with the deleted model
   */
  @Delete('/event-trees/')
  async deleteEventTree(@Query('id') id: number): Promise<EventTree> {
    return this.nestedModelService.deleteEventTree(id);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @param id the id of the model to be deleted
   * @returns a promise with the deleted model
   */
  @Delete('/fault-trees/')
  async deleteFaultTree(@Query('id') id: number): Promise<FaultTree> {
    return this.nestedModelService.deleteFaultTree(id);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @param id the id of the model to be deleted
   * @returns a promise with the deleted model
   */
  @Delete('/functional-events/')
  async deleteFunctionalEvent(@Query('id') id: number): Promise<FunctionalEvent> {
    return this.nestedModelService.deleteFunctionalEvent(id);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @param id the id of the model to be deleted
   * @returns a promise with the deleted model
   */
  @Delete('/initiating-events/')
  async deleteInitiatingEvent(@Query('id') id: number): Promise<InitiatingEvent> {
    return this.nestedModelService.deleteInitiatingEvent(id);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @param id the id of the model to be deleted
   * @returns a promise with the deleted model
   */
  @Delete('/markov-chains/')
  async deleteMarkovChain(@Query('id') id: number): Promise<MarkovChain> {
    return this.nestedModelService.deleteMarkovChain(id);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @param id the id of the model to be deleted
   * @returns a promise with the deleted model
   */
  @Delete('/weibull-analysis/')
  async deleteWeibullAnalysis(@Query('id') id: number): Promise<WeibullAnalysis> {
    return this.nestedModelService.deleteWeibullAnalysis(id);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and descrption string
   * @returns the updated moel
   */
  @Patch('/bayesian-estimations/:id')
  async updateBayesianEstimationLabel(@Param('id') id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateBayesianEstimationLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and descrption string
   * @returns the updated moel
   */
  @Patch('/bayesian-networks/:id')
  async updateBayesianNetworkLabel(@Param('id') id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateBayesianNetworkLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and descrption string
   * @returns the updated moel
   */
  @Patch('/event-sequence-diagrams/:id')
  async updateEventSequenceDiagramLabel(@Param('id') id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateEventSqeuenceDiagramLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and descrption string
   * @returns the updated moel
   */
  @Patch('/event-trees/:id')
  async updateEventTreeLabel(@Param('id') id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateEventTreeLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and descrption string
   * @returns the updated moel
   */
  @Patch('/fault-trees/:id')
  async updateFaultTreeLabel(@Param('id') id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateFaultTreeLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and descrption string
   * @returns the updated moel
   */
  @Patch('/functional-events/:id')
  async updateFunctionalEventLabel(@Param('id') id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateFunctionalEventLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and descrption string
   * @returns the updated moel
   */
  @Patch('/initiating-events/:id')
  async updateInitiatingEventLabel(@Param('id') id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateInitiatingEventLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and descrption string
   * @returns the updated moel
   */
  @Patch('/markov-chains/:id')
  async updateMarkovChainLabel(@Param('id') id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateMarkovChainLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and descrption string
   * @returns the updated moel
   */
  @Patch('/weibull-analysis/:id')
  async updateWeibullAnalysisLabel(@Param('id') id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateWeibullAnalysisLabel(id, data);
  }
  /**
   * removes parentId from all nested models. If the model has no parentIds it is removed
   * @param id the parent id to be removed
   * @returns a promise with the number of totally deleted nested models
   */
  @Delete()
  async removeParentIds(@Query('modelId') modelId: number): Promise<Number> {
    return this.nestedModelService.removeParentModels(modelId);
  }
}