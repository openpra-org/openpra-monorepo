import { Body, Controller, Delete, Get, Param, Patch, Post, Query, HttpStatus } from "@nestjs/common";
import { Label } from "../schemas/label.schema";
import { NestedModel } from "./schemas/templateSchema/nested-model.schema";
import { NestedModelService } from "./nestedModel.service";
import { BayesianEstimation } from "./schemas/bayesian-estimation.schema";
import { FaultTree } from "./schemas/fault-tree.schema";
import { HeatBalanceFaultTree } from "./schemas/heat-balance-fault-tree.schema";
import { EventTree } from "./schemas/event-tree.schema";
import { EventSequenceDiagram } from "./schemas/event-sequence-diagram.schema";
import { FunctionalEvent } from "./schemas/functional-event.schema";
import { InitiatingEvent } from "./schemas/initiating-event.schema";
import { MarkovChain } from "./schemas/markov-chain.schema";
import { WeibullAnalysis } from "./schemas/weibull-analysis.schema";
import { OperatingStateAnalysis } from "./schemas/operatingStateAnalysis.schema";
import { EventSequenceAnalysis } from "./schemas/event-sequence-analysis.schema";
import { SystemsAnalysis } from "./schemas/systems-analysis.schema";
import { SuccessCriteria } from "./schemas/success-criteria.schema";
import { HumanReliabilityAnalysis } from "./schemas/human-reliability-analysis.schema";
import { DataAnalysis } from "./schemas/data-analysis.schema";
import { EventSequenceQuantificationDiagram } from "./schemas/event-sequence-quantification-diagram.schema";
import { MechanisticSourceTerm } from "./schemas/mechanistic-source-term.schema";
import { RadiologicalConsequenceAnalysis } from "./schemas/radiological-consequence-analysis.schema";
import { RiskIntegration } from "./schemas/risk-integration.schema";
import { TypedModelType } from "./nested-model-helper.service";
import { InitiatingEventsService } from "./NestedModelsHelpers/initiating-events.service";
import { EventSequenceDiagramService } from "./NestedModelsHelpers/event-sequence-diagram.service";
import { EventSequenceAnalysisService } from "./NestedModelsHelpers/event-sequence-analysis.service";
import { EventTreesService } from "./NestedModelsHelpers/event-trees.service";
import { BayesianNetworksService } from "./NestedModelsHelpers/bayesian-networks.service";
import { FaultTreesService } from "./NestedModelsHelpers/fault-trees.service";

@Controller()
export class NestedModelController {
  constructor(
    private readonly nestedModelService: NestedModelService,
    private readonly initiatingEventsService: InitiatingEventsService,
    private readonly eventSequenceDiagramService: EventSequenceDiagramService,
    private readonly eventSequenceAnalysisService: EventSequenceAnalysisService,
    private readonly eventTreeService: EventTreesService,
    private readonly bayesianNetworkService: BayesianNetworksService,
    private readonly faultTreesService: FaultTreesService,
  ) {}

  //method to get counter value

  @Get()
  public async getCounterPastValue(): Promise<number> {
    return await this.nestedModelService.getValue("nestedCounter");
  }

  //post methods

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @Post("/bayesian-estimations/")
  public async createBayesianEstimation(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createBayesianEstimation(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param body is the entire body of the post request
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @param Model is the  model to be updated
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @Post("/bayesian-networks/")
  public async createBayesianNetwork(
    @Body() body: { data: Partial<NestedModel>; Model: TypedModelType },
  ): Promise<NestedModel> {
    return this.bayesianNetworkService.createBayesianNetwork(body.data, body.Model);
  }

  /**
   * posts the nested model defined in the method name
   * @param body is the entire body of the post request
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @param Model is the  model to be updated
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @Post("/event-sequence-diagrams/")
  public async createEventSequenceDiagram(
    @Body() body: { data: Partial<NestedModel>; Model: TypedModelType },
  ): Promise<NestedModel> {
    return this.eventSequenceDiagramService.createEventSequenceDiagram(body.data, body.Model);
  }

  /**
   * posts the nested model defined in the method name
   * @param body is the entire body of the post request
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @param Model is the  model to be updated
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @Post("/event-trees/")
  public async createEventTree(
    @Body() body: { data: Partial<NestedModel>; Model: TypedModelType },
  ): Promise<NestedModel> {
    return this.eventTreeService.createEventTree(body.data, body.Model);
  }

  /**
   * posts the nested model defined in the method name
   * @param body is the entire body of the post request
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @param Model is the  model to be updated
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @Post("/fault-trees/")
  public async createFaultTree(
    @Body() body: { data: Partial<NestedModel>; Model: TypedModelType },
  ): Promise<NestedModel> {
    return this.faultTreesService.createFaultTree(body.data, body.Model);
  }

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @Post("/heat-balance-fault-trees/")
  public async createHeatBalanceFaultTree(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createHeatBalanceFaultTree(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @Post("/functional-events/")
  public async createFunctionalEvent(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createFunctionalEvent(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param body - is the entire body of the post request
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @param Model is the  model to be updated
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @Post("/initiating-events/")
  public async createInitiatingEvent(
    @Body() body: { data: Partial<NestedModel>; Model: TypedModelType },
  ): Promise<NestedModel> {
    return this.initiatingEventsService.createInitiatingEvent(body.data, body.Model);
  }

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @Post("/markov-chains/")
  public async createMarkovChain(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createMarkovChain(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @Post("/weibull-analysis/")
  public async createWeibullAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createWeibullAnalysis(data);
  }

  // For Risk Integration
  @Post("/risk-integration/")
  public async createRiskIntegration(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createRiskIntegration(data);
  }

  // For Radiological Consequence Analysis
  @Post("/radiological-consequence-analysis/")
  public async createRadiologicalConsequenceAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createRadiologicalConsequenceAnalysis(data);
  }

  // For Mechanistic Source Term
  @Post("/mechanistic-source-term/")
  public async createMechanisticSourceTerm(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createMechanisticSourceTerm(data);
  }

  // For Event Sequence Quantification Diagram
  @Post("/event-sequence-quantification-diagram/")
  public async createEventSequenceQuantificationDiagram(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createEventSequenceQuantificationDiagram(data);
  }

  // For Data Analysis
  @Post("/data-analysis/")
  public async createDataAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createDataAnalysis(data);
  }

  // For Human Reliability Analysis
  @Post("/human-reliability-analysis/")
  public async createHumanReliabilityAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createHumanReliabilityAnalysis(data);
  }

  // For Systems Analysis
  @Post("/systems-analysis/")
  public async createSystemsAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createSystemsAnalysis(data);
  }

  // For Success Criteria
  @Post("/success-criteria/")
  public async createSuccessCriteria(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createSuccessCriteria(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param body - is the entire body of the post request
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @param Model is the  model to be updated
   * @returns a promise with the newly created model, with the general nested model fields
   */
  // For Event Sequence Analysis
  @Post("/event-sequence-analysis/")
  public async createEventSequenceAnalysis(
    @Body() body: { data: Partial<NestedModel>; Model: TypedModelType },
  ): Promise<NestedModel> {
    return this.eventSequenceAnalysisService.createEventSequenceAnalysis(body.data, body.Model);
  }

  // For Operating State Analysis
  @Post("/operating-state-analysis/")
  public async createOperatingStateAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createOperatingStateAnalysis(data);
  }

  //TODO: patch endpoints eventually for when we know what is getting updated, when and where

  //get collection methods

  /**
   * grabs the collection of the type of nested model defined by the function call name (Bayesian estimations)
   * @returns a promise with a list of the model  defined
   * @param query
   */
  @Get("/bayesian-estimations/")
  public async getBayesianEstimations(@Query() query: { id: number }): Promise<BayesianEstimation[]> {
    return this.nestedModelService.getBayesianEstimations(query.id);
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Event Sequence Diagrams)
   * @returns a promise with a list of the model  defined
   * @param query
   */
  @Get("/bayesian-networks/")
  public async getBayesianNetworks(@Query() query: { id: number | string }): Promise<EventSequenceDiagram[]> {
    if (typeof query.id === "number") {
      return this.bayesianNetworkService.getBayesianNetwork(query.id);
    } else {
      return this.bayesianNetworkService.getBayesianNetworkString(query.id);
    }
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Event Sequence Diagrams)
   * @returns a promise with a list of the model  defined
   * @param query
   */
  @Get("/event-sequence-diagrams/")
  public async getEventSequenceDiagrams(@Query() query: { id: number | string }): Promise<EventSequenceDiagram[]> {
    if (typeof query.id === "number") {
      return this.eventSequenceDiagramService.getEventSequenceDiagrams(query.id);
    } else {
      return this.eventSequenceDiagramService.getEventSequenceDiagramsString(query.id);
    }
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Event Trees)
   * @returns a promise with a list of the model  defined
   * @param query
   */
  @Get("/event-trees/")
  public async getEventTrees(@Query() query: { id: number | string }): Promise<EventSequenceDiagram[]> {
    if (typeof query.id === "number") {
      return this.eventTreeService.getEventTrees(query.id);
    } else {
      return this.eventTreeService.getEventTreesString(query.id);
    }
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Event Trees)
   * @returns a promise with a list of the model  defined
   * @param query
   */
  @Get("/fault-trees/")
  public async getFaultTrees(@Query() query: { id: number | string }): Promise<FaultTree[]> {
    if (typeof query.id === "number") {
      return this.faultTreesService.getFaultTree(query.id);
    } else {
      return this.faultTreesService.getFaultTreeString(query.id);
    }
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Fault Trees)
   * @returns a promise with a list of the model  defined
   * @param query
   */
  @Get("/heat-balance-fault-trees/")
  public async getHeatBalanceFaultTrees(@Query() query: { id: number }): Promise<HeatBalanceFaultTree[]> {
    return this.nestedModelService.getHeatBalanceFaultTrees(query.id);
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Functional events)
   * @returns a promise with a list of the model  defined
   * @param query
   */
  @Get("/functional-events/")
  public async getFunctionalEvents(@Query() query: { id: number }): Promise<FunctionalEvent[]> {
    return this.nestedModelService.getFunctionalEvents(query.id);
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Initiating Events)
   * @returns a promise with a list of the model  defined
   * @param query
   */
  @Get("/initiating-events/")
  public async getInitiatingEvents(@Query() query: { id: number | string }): Promise<InitiatingEvent[]> {
    if (typeof query.id === "number") {
      return this.initiatingEventsService.getInitiatingEvents(query.id);
    } else {
      return this.initiatingEventsService.getInitiatingEventsString(query.id);
    }
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Markov Chains)
   * @returns a promise with a list of the model  defined
   * @param query
   */
  @Get("/markov-chains/")
  public async getMarkovChains(@Query() query: { id: number }): Promise<MarkovChain[]> {
    return this.nestedModelService.getMarkovChains(query.id);
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Weibull Analysis)
   * @returns a promise with a list of the model  defined
   * @param query
   */
  @Get("/weibull-analysis/")
  public async getWeibullAnalysis(@Query() query: { id: number }): Promise<WeibullAnalysis[]> {
    return this.nestedModelService.getWeibullAnalysis(query.id);
  }

  // For Risk Integration
  @Get("/risk-integration/")
  public async getRiskIntegration(@Query() query: { id: number }): Promise<RiskIntegration[]> {
    return this.nestedModelService.getRiskIntegration(query.id);
  }

  // For Radiological Consequence Analysis
  @Get("/radiological-consequence-analysis/")
  public async getRadiologicalConsequenceAnalysis(
    @Query() query: { id: number },
  ): Promise<RadiologicalConsequenceAnalysis[]> {
    return this.nestedModelService.getRadiologicalConsequenceAnalysis(query.id);
  }

  // For Mechanistic Source Term
  @Get("/mechanistic-source-term/")
  public async getMechanisticSourceTerm(@Query() query: { id: number }): Promise<MechanisticSourceTerm[]> {
    return this.nestedModelService.getMechanisticSourceTerm(query.id);
  }

  // For Event Sequence Quantification Diagram
  @Get("/event-sequence-quantification-diagram/")
  public async getEventSequenceQuantificationDiagram(
    @Query() query: { id: number },
  ): Promise<EventSequenceQuantificationDiagram[]> {
    return this.nestedModelService.getEventSequenceQuantificationDiagram(query.id);
  }

  // For Data Analysis
  @Get("/data-analysis/")
  public async getDataAnalysis(@Query() query: { id: number }): Promise<DataAnalysis[]> {
    return this.nestedModelService.getDataAnalysis(query.id);
  }

  // For Human Reliability Analysis
  @Get("/human-reliability-analysis/")
  public async getHumanReliabilityAnalysis(@Query() query: { id: number }): Promise<HumanReliabilityAnalysis[]> {
    return this.nestedModelService.getHumanReliabilityAnalysis(query.id);
  }

  // For Systems Analysis
  @Get("/systems-analysis/")
  public async getSystemsAnalysis(@Query() query: { id: number }): Promise<SystemsAnalysis[]> {
    return this.nestedModelService.getSystemsAnalysis(query.id);
  }

  // For Success Criteria
  @Get("/success-criteria/")
  public async getSuccessCriteria(@Query() query: { id: number }): Promise<SuccessCriteria[]> {
    return this.nestedModelService.getSuccessCriteria(query.id);
  }

  // For Event Sequence Analysis
  /**
   * grabs the collection of the type of nested model defined by the function call name (Initiating Events)
   * @returns a promise with a list of the model  defined
   * @param query
   */
  @Get("/event-sequence-analysis/")
  public async getEventSequenceAnalysis(@Query() query: { id: number }): Promise<EventSequenceAnalysis[]> {
    if (typeof query.id === "number") {
      return this.eventSequenceAnalysisService.getEventSequenceAnalysis(query.id);
    } else {
      return this.eventSequenceAnalysisService.getEventSequenceAnalysisString(query.id);
    }
  }

  // For Operating State Analysis
  @Get("/operating-state-analysis/")
  public async getOperatingStateAnalysis(@Query() query: { id: number }): Promise<OperatingStateAnalysis[]> {
    return this.nestedModelService.getOperatingStateAnalysis(query.id);
  }

  //singular get endpoints

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get("/bayesian-estimations/:id")
  public async getSingleBayesianEstimation(@Param("id") modelId: number): Promise<BayesianEstimation> {
    return this.nestedModelService.getSingleBayesianEstimation(modelId);
  }

  /**
   * returns a single model from the given collection
   * @param modelId - the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get("/bayesian-networks/:id")
  public async getSingleBayesianNetwork(@Param("id") modelId: number | string): Promise<EventSequenceDiagram> {
    if (typeof modelId === "number") {
      return this.bayesianNetworkService.getSingleBayesianNetwork(modelId);
    } else {
      return this.bayesianNetworkService.getSingleBayesianNetworkString(modelId);
    }
  }

  /**
   * returns a single model from the given collection
   * @param modelId - the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get("/event-sequence-diagrams/:id")
  public async getSingleEventSequenceDiagram(@Param("id") modelId: number | string): Promise<EventSequenceDiagram> {
    if (typeof modelId === "number") {
      return this.eventSequenceDiagramService.getSingleEventSequenceDiagram(modelId);
    } else {
      return this.eventSequenceDiagramService.getSingleEventSequenceDiagramString(modelId);
    }
  }

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get("/event-trees/:id")
  public async getSingleEventTree(@Param("id") modelId: number | string): Promise<EventTree> {
    if (typeof modelId === "number") {
      return this.eventTreeService.getSingleEventTree(modelId);
    } else {
      return this.eventTreeService.getSingleEventTreeString(modelId);
    }
  }

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get("/fault-trees/:id")
  public async getSingleFaultTree(@Param("id") modelId: number | string): Promise<EventTree> {
    if (typeof modelId === "number") {
      return this.faultTreesService.getSingleFaultTree(modelId);
    } else {
      return this.faultTreesService.getSingleFaultTreeString(modelId);
    }
  }

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get("/heat-balance-fault-trees/:id")
  public async getSingleHeatBalanceFaultTree(@Param("id") modelId: number): Promise<HeatBalanceFaultTree> {
    return this.nestedModelService.getSingleHeatBalanceFaultTree(modelId);
  }

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get("/functional-events/:id")
  public async getSingleFunctionalEvent(@Param("id") modelId: number): Promise<FunctionalEvent> {
    return this.nestedModelService.getSingleFunctionalEvent(modelId);
  }

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get("/initiating-events/:id")
  public async getSingleInitiatingEvent(@Param("id") modelId: number | string): Promise<InitiatingEvent> {
    console.log(typeof modelId);
    if (typeof modelId === "number") {
      return this.initiatingEventsService.getSingleInitiatingEvent(modelId);
    } else {
      return this.initiatingEventsService.getSingleInitiatingEventString(modelId);
    }
  }

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get("/markov-chains/:id")
  public async getSingleMarkovChain(@Param("id") modelId: number): Promise<MarkovChain> {
    return this.nestedModelService.getSingleMarkovChain(modelId);
  }

  /**
   * returns a single model from the given collection
   * @param modelId - the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get("/weibull-analysis/:id")
  public async getSingleWeibullAnalysis(@Param("id") modelId: number): Promise<WeibullAnalysis> {
    return this.nestedModelService.getSingleWeibullAnalysis(modelId);
  }

  // For Risk Integration
  @Get("/risk-integration/:id")
  public async getSingleRiskIntegration(@Param("id") modelId: number): Promise<RiskIntegration> {
    return this.nestedModelService.getSingleRiskIntegration(modelId);
  }

  // For Radiological Consequence Analysis
  @Get("/radiological-consequence-analysis/:id")
  public async getSingleRadiologicalConsequenceAnalysis(
    @Param("id") modelId: number,
  ): Promise<RadiologicalConsequenceAnalysis> {
    return this.nestedModelService.getSingleRadiologicalConsequenceAnalysis(modelId);
  }

  // For Mechanistic Source Term
  @Get("/mechanistic-source-term/:id")
  public async getSingleMechanisticSourceTerm(@Param("id") modelId: number): Promise<MechanisticSourceTerm> {
    return this.nestedModelService.getSingleMechanisticSourceTerm(modelId);
  }

  // For Event Sequence Quantification Diagram
  @Get("/event-sequence-quantification-diagram/:id")
  public async getSingleEventSequenceQuantificationDiagram(
    @Param("id") modelId: number,
  ): Promise<EventSequenceQuantificationDiagram> {
    return this.nestedModelService.getSingleEventSequenceQuantificationDiagram(modelId);
  }

  // For Data Analysis
  @Get("/data-analysis/:id")
  public async getSingleDataAnalysis(@Param("id") modelId: number): Promise<DataAnalysis> {
    return this.nestedModelService.getSingleDataAnalysis(modelId);
  }

  // For Human Reliability Analysis
  @Get("/human-reliability-analysis/:id")
  public async getSingleHumanReliabilityAnalysis(@Param("id") modelId: number): Promise<HumanReliabilityAnalysis> {
    return this.nestedModelService.getSingleHumanReliabilityAnalysis(modelId);
  }

  // For Systems Analysis
  @Get("/systems-analysis/:id")
  public async getSingleSystemsAnalysis(@Param("id") modelId: number): Promise<SystemsAnalysis> {
    return this.nestedModelService.getSingleSystemsAnalysis(modelId);
  }

  // For Success Criteria
  @Get("/success-criteria/:id")
  public async getSingleSuccessCriteria(@Param("id") modelId: number): Promise<SuccessCriteria> {
    return this.nestedModelService.getSingleSuccessCriteria(modelId);
  }

  // For Event Sequence Analysis
  /**
   * returns a single model from the given collection
   * @param modelId - the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get("/event-sequence-analysis/:id")
  public async getSingleEventSequenceAnalysis(@Param("id") modelId: number): Promise<EventSequenceAnalysis> {
    if (typeof modelId === "number") {
      return this.eventSequenceAnalysisService.getSingleEventSequenceAnalysis(modelId);
    } else {
      return this.eventSequenceAnalysisService.getSingleEventSequenceAnalysisString(modelId);
    }
  }

  // For Operating State Analysis
  @Get("/operating-state-analysis/:id")
  public async getSingleOperatingStateAnalysis(@Param("id") modelId: number): Promise<OperatingStateAnalysis> {
    return this.nestedModelService.getSingleOperatingStateAnalysis(modelId);
  }

  //delete endpoints

  /**
   * deletes a single nested model from the collection of that  based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @Delete("/bayesian-estimations/")
  public async deleteBayesianEstimation(@Query() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteBayesianEstimation(query.id);
  }

  /**
   * deletes a single nested model from the collection of that  based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @Delete("/bayesian-networks/")
  public async deleteBayesianNetwork(@Query() query: { id: string; Model: TypedModelType }): Promise<void> {
    await this.bayesianNetworkService.deleteBayesianNetwork(query.id, query.Model);
  }

  /**
   * deletes a single nested model from the collection of that  based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @Delete("/event-sequence-diagrams/")
  public async deleteEventSequenceDiagram(@Query() query: { id: string; Model: TypedModelType }): Promise<void> {
    await this.eventSequenceDiagramService.deleteEventSequenceDiagram(query.id, query.Model);
  }

  /**
   * deletes a single nested model from the collection of that  based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @Delete("/event-trees/")
  public async deleteEventTree(@Query() query: { id: string; Model: TypedModelType }): Promise<void> {
    await this.eventTreeService.deleteEventTree(query.id, query.Model);
  }

  /**
   * deletes a single nested model from the collection of that  based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @Delete("/fault-trees/")
  public async deleteFaultTree(@Query() query: { id: string; Model: TypedModelType }): Promise<void> {
    await this.faultTreesService.deleteFaultTree(query.id, query.Model);
  }

  /**
   * deletes a single nested model from the collection of that  based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @Delete("/heat-balance-fault-trees/")
  public async deleteHeatBalanceFaultTree(@Query() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteHeatBalanceFaultTree(query.id);
  }

  /**
   * deletes a single nested model from the collection of that  based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @Delete("/functional-events/")
  public async deleteFunctionalEvent(@Query() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteFunctionalEvent(query.id);
  }

  /**
   * deletes a single nested model from the collection of that  based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @Delete("/initiating-events/")
  public async deleteInitiatingEvent(@Query() query: { id: string; Model: TypedModelType }): Promise<void> {
    await this.initiatingEventsService.deleteInitiatingEvent(query.id, query.Model);
  }

  /**
   * deletes a single nested model from the collection of that  based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @Delete("/markov-chains/")
  public async deleteMarkovChain(@Query() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteMarkovChain(query.id);
  }

  /**
   * deletes a single nested model from the collection of that  based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @Delete("/weibull-analysis/")
  public async deleteWeibullAnalysis(@Query() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteWeibullAnalysis(query.id);
  }

  // For Risk Integration
  @Delete("/risk-integration/")
  public async deleteRiskIntegration(@Query() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteRiskIntegration(query.id);
  }

  // For Radiological Consequence Analysis
  @Delete("/radiological-consequence-analysis/")
  public async deleteRadiologicalConsequenceAnalysis(@Query() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteRadiologicalConsequenceAnalysis(query.id);
  }

  // For Mechanistic Source Term
  @Delete("/mechanistic-source-term/")
  public async deleteMechanisticSourceTerm(@Query() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteMechanisticSourceTerm(query.id);
  }

  // For Event Sequence Quantification Diagram
  @Delete("/event-sequence-quantification-diagram/")
  public async deleteEventSequenceQuantificationDiagram(@Query() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteEventSequenceQuantificationDiagram(query.id);
  }

  // For Data Analysis
  @Delete("/data-analysis/")
  public async deleteDataAnalysis(@Query() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteDataAnalysis(query.id);
  }

  // For Human Reliability Analysis
  @Delete("/human-reliability-analysis/")
  public async deleteHumanReliabilityAnalysis(@Query() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteHumanReliabilityAnalysis(query.id);
  }

  // For Systems Analysis
  @Delete("/systems-analysis/")
  public async deleteSystemsAnalysis(@Query() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteSystemsAnalysis(query.id);
  }

  // For Success Criteria
  @Delete("/success-criteria/")
  public async deleteSuccessCriteria(@Query() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteSuccessCriteria(query.id);
  }

  /**
   * deletes a single nested model from the collection of that  based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  // For Event Sequence Analysis
  @Delete("/event-sequence-analysis/")
  public async deleteEventSequenceAnalysis(@Query() query: { id: string; Model: TypedModelType }): Promise<void> {
    return this.eventSequenceAnalysisService.deleteEventSequenceAnalysis(query.id, query.Model);
  }

  // For Operating State Analysis
  @Delete("/operating-state-analysis/")
  public async deleteOperatingStateAnalysis(@Query() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteOperatingStateAnalysis(query.id);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @Patch("/bayesian-estimations/:id")
  public async updateBayesianEstimationLabel(@Param("id") id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateBayesianEstimationLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @Patch("/bayesian-networks/:id")
  public async updateBayesianNetworkLabel(@Param("id") id: string, @Body() data: Label): Promise<NestedModel> {
    return this.bayesianNetworkService.updateBayesianNetworkLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @Patch("/event-sequence-diagrams/:id")
  public async updateEventSequenceDiagramLabel(@Param("id") id: string, @Body() data: Label): Promise<NestedModel> {
    return this.eventSequenceDiagramService.updateEventSequenceDiagramLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @Patch("/event-trees/:id")
  public async updateEventTreeLabel(@Param("id") id: string, @Body() data: Label): Promise<NestedModel> {
    return this.eventTreeService.updateEventTreeLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @Patch("/fault-trees/:id")
  public async updateFaultTreeLabel(@Param("id") id: string, @Body() data: Label): Promise<NestedModel> {
    return this.faultTreesService.updateFaultTreeLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @Patch("/heat-balance-fault-trees/:id")
  public async updateHeatBalanceFaultTreeLabel(@Param("id") id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateHeatBalanceFaultTreeLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @Patch("/functional-events/:id")
  public async updateFunctionalEventLabel(@Param("id") id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateFunctionalEventLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @Patch("/initiating-events/:id")
  public async updateInitiatingEventLabel(@Param("id") id: string, @Body() data: Label): Promise<NestedModel> {
    return this.initiatingEventsService.updateInitiatingEventLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @Patch("/markov-chains/:id")
  public async updateMarkovChainLabel(@Param("id") id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateMarkovChainLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @Patch("/weibull-analysis/:id")
  public async updateWeibullAnalysisLabel(@Param("id") id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateWeibullAnalysisLabel(id, data);
  }

  // For Risk Integration
  @Patch("/risk-integration/:id")
  public async updateRiskIntegrationLabel(@Param("id") id: number, @Body() data: Label): Promise<RiskIntegration> {
    return this.nestedModelService.updateRiskIntegrationLabel(id, data);
  }

  // For Radiological Consequence Analysis
  @Patch("/radiological-consequence-analysis/:id")
  public async updateRadiologicalConsequenceAnalysisLabel(
    @Param("id") id: number,
    @Body() data: Label,
  ): Promise<RadiologicalConsequenceAnalysis> {
    return this.nestedModelService.updateRadiologicalConsequenceAnalysisLabel(id, data);
  }

  // For Mechanistic Source Term
  @Patch("/mechanistic-source-term/:id")
  public async updateMechanisticSourceTermLabel(
    @Param("id") id: number,
    @Body() data: Label,
  ): Promise<MechanisticSourceTerm> {
    return this.nestedModelService.updateMechanisticSourceTermLabel(id, data);
  }

  // For Event Sequence Quantification Diagram
  @Patch("/event-sequence-quantification-diagram/:id")
  public async updateEventSequenceQuantificationDiagramLabel(
    @Param("id") id: number,
    @Body() data: Label,
  ): Promise<EventSequenceQuantificationDiagram> {
    return this.nestedModelService.updateEventSequenceQuantificationDiagramLabel(id, data);
  }

  // For Data Analysis
  @Patch("/data-analysis/:id")
  public async updateDataAnalysisLabel(@Param("id") id: number, @Body() data: Label): Promise<DataAnalysis> {
    return this.nestedModelService.updateDataAnalysisLabel(id, data);
  }

  // For Human Reliability Analysis
  @Patch("/human-reliability-analysis/:id")
  public async updateHumanReliabilityAnalysisLabel(
    @Param("id") id: number,
    @Body() data: Label,
  ): Promise<HumanReliabilityAnalysis> {
    return this.nestedModelService.updateHumanReliabilityAnalysisLabel(id, data);
  }

  // For Systems Analysis
  @Patch("/systems-analysis/:id")
  public async updateSystemsAnalysisLabel(@Param("id") id: number, @Body() data: Label): Promise<SystemsAnalysis> {
    return this.nestedModelService.updateSystemsAnalysisLabel(id, data);
  }

  // For Success Criteria
  @Patch("/success-criteria/:id")
  public async updateSuccessCriteriaLabel(@Param("id") id: number, @Body() data: Label): Promise<SuccessCriteria> {
    return this.nestedModelService.updateSuccessCriteriaLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  // For Event Sequence Analysis
  @Patch("/event-sequence-analysis/:id")
  public async updateEventSequenceAnalysisLabel(@Param("id") id: string, @Body() data: Label): Promise<NestedModel> {
    return this.eventSequenceAnalysisService.updateEventSequenceAnalysisLabel(id, data);
  }

  // For Operating State Analysis
  @Patch("/operating-state-analysis/:id")
  public async updateOperatingStateAnalysisLabel(
    @Param("id") id: number,
    @Body() data: Label,
  ): Promise<OperatingStateAnalysis> {
    return this.nestedModelService.updateOperatingStateAnalysisLabel(id, data);
  }

  // removes parent ids

  /**
   * removes parentId from all nested models. If the model has no parentIds it is removed
   * @returns a promise with the number of totally deleted nested models
   * @param query
   */
  @Delete()
  public async removeParentIds(@Query() query: { modelId: number }): Promise<number> {
    return this.nestedModelService.removeParentModels(query.modelId);
  }
}
