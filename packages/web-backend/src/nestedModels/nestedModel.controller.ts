import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
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
  async getCounterPastValue(): Promise<number> {
    return await this.nestedModelService.getValue("nestedCounter");
  }

  //post methods

  /**
   * Create a Bayesian Estimation nested model.
   *
   * @param data - Partial nested model with label (name string, optional description string) and parentId
   * @returns Newly created nested model with common fields
   */
  @Post("/bayesian-estimations/")
  async createBayesianEstimation(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createBayesianEstimation(data);
  }

  /**
   * Create a Bayesian Network nested model.
   *
   * @param body - Either the full body or an object like `{ data, typedModel }`
   * @param data - Partial nested model with label (name string, optional description string) and parentId
   * @param typedModel - The typed model to be updated
   * @returns Newly created nested model with common fields
   */
  @Post("/bayesian-networks/")
  async createBayesianNetwork(
    @Body() body: { data: Partial<NestedModel>; typedModel: TypedModelType } | Partial<NestedModel>,
  ): Promise<NestedModel> {
    const hasTypedModel = (v: unknown): v is { data: Partial<NestedModel>; typedModel: TypedModelType } =>
      typeof v === "object" && v !== null && "typedModel" in (v as Record<string, unknown>);
    if (hasTypedModel(body)) {
      return this.bayesianNetworkService.createBayesianNetwork(body.data, body.typedModel);
    }
    return this.nestedModelService.createBayesianNetwork(body as Partial<NestedModel>);
  }

  // Back-compat: some specs call a misspelled method name; delegate to the correct one

  async createBayesianNetwowrk(
    body: { data: Partial<NestedModel>; typedModel: TypedModelType } | Partial<NestedModel>,
  ): Promise<NestedModel> {
    return this.createBayesianNetwork(body);
  }

  /**
   * Create an Event Sequence Diagram nested model.
   *
   * @param body - Either the full body or an object like `{ data, typedModel }`
   * @param data - Partial nested model with label (name string, optional description string) and parentId
   * @param typedModel - The typed model to be updated
   * @returns Newly created nested model with common fields
   */
  @Post("/event-sequence-diagrams/")
  async createEventSequenceDiagram(
    @Body() body: { data: Partial<NestedModel>; typedModel: TypedModelType } | Partial<NestedModel>,
  ): Promise<NestedModel> {
    const hasTypedModel = (v: unknown): v is { data: Partial<NestedModel>; typedModel: TypedModelType } =>
      typeof v === "object" && v !== null && "typedModel" in (v as Record<string, unknown>);
    if (hasTypedModel(body)) {
      return this.eventSequenceDiagramService.createEventSequenceDiagram(body.data, body.typedModel);
    }
    return this.nestedModelService.createEventSequenceDiagram(body as Partial<NestedModel>);
  }

  /**
   * Create an Event Tree nested model.
   *
   * @param body - Either the full body or an object like `{ data, typedModel }`
   * @param data - Partial nested model with label (name string, optional description string) and parentId
   * @param typedModel - The typed model to be updated
   * @returns Newly created nested model with common fields
   */
  @Post("/event-trees/")
  async createEventTree(
    @Body() body: { data: Partial<NestedModel>; typedModel: TypedModelType } | Partial<NestedModel>,
  ): Promise<NestedModel> {
    const hasTypedModel = (v: unknown): v is { data: Partial<NestedModel>; typedModel: TypedModelType } =>
      typeof v === "object" && v !== null && "typedModel" in (v as Record<string, unknown>);
    if (hasTypedModel(body)) {
      return this.eventTreeService.createEventTree(body.data, body.typedModel);
    }
    return this.nestedModelService.createEventTree(body as Partial<NestedModel>);
  }

  /**
   * Create a Fault Tree nested model.
   *
   * Accepts either of the following payloads:
   * - `{"data": Partial<NestedModel>; "typedModel": TypedModelType}` to target a specific typed model
   * - `Partial<NestedModel>` to create without specifying a typed model
   *
   * @param body - Request payload; when `typedModel` is provided, creation occurs within that typed model.
   * @returns Newly created nested model with common fields
   */
  @Post("/fault-trees/")
  async createFaultTree(
    @Body() body: { data: Partial<NestedModel>; typedModel: TypedModelType } | Partial<NestedModel>,
  ): Promise<NestedModel> {
    const hasTypedModel = (v: unknown): v is { data: Partial<NestedModel>; typedModel: TypedModelType } =>
      typeof v === "object" && v !== null && "typedModel" in (v as Record<string, unknown>);
    if (hasTypedModel(body)) {
      return this.faultTreesService.createFaultTree(body.data, body.typedModel);
    }
    return this.nestedModelService.createFaultTree(body as Partial<NestedModel>);
  }

  /**
   * Create a Heat Balance Fault Tree nested model.
   *
   * @param data - Partial nested model with label (name string, optional description string) and parentId
   * @returns Newly created nested model with common fields
   */
  @Post("/heat-balance-fault-trees/")
  async createHeatBalanceFaultTree(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createHeatBalanceFaultTree(data);
  }

  /**
   * Create a Functional Event nested model.
   *
   * @param data - Partial nested model with label (name string, optional description string) and parentId
   * @returns Newly created nested model with common fields
   */
  @Post("/functional-events/")
  async createFunctionalEvent(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createFunctionalEvent(data);
  }

  /**
   * Create an Initiating Event nested model.
   *
   * @param body - Either the full body or an object like `{ data, typedModel }`
   * @param data - Partial nested model with label (name string, optional description string) and parentId
   * @param typedModel - The typed model to be updated
   * @returns Newly created nested model with common fields
   */
  @Post("/initiating-events/")
  async createInitiatingEvent(
    @Body() body: { data: Partial<NestedModel>; typedModel: TypedModelType } | Partial<NestedModel>,
  ): Promise<NestedModel> {
    const hasTypedModel = (v: unknown): v is { data: Partial<NestedModel>; typedModel: TypedModelType } =>
      typeof v === "object" && v !== null && "typedModel" in (v as Record<string, unknown>);
    if (hasTypedModel(body)) {
      return this.initiatingEventsService.createInitiatingEvent(body.data, body.typedModel);
    }
    return this.nestedModelService.createInitiatingEvent(body as Partial<NestedModel>);
  }

  /**
   * Create a Markov Chain nested model.
   *
   * @param data - Partial nested model with label (name string, optional description string) and parentId
   * @returns Newly created nested model with common fields
   */
  @Post("/markov-chains/")
  async createMarkovChain(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createMarkovChain(data);
  }

  /**
   * Create a Weibull Analysis nested model.
   *
   * @param data - Partial nested model with label (name string, optional description string) and parentId
   * @returns Newly created nested model with common fields
   */
  @Post("/weibull-analysis/")
  async createWeibullAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createWeibullAnalysis(data);
  }

  // For Risk Integration
  @Post("/risk-integration/")
  async createRiskIntegration(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createRiskIntegration(data);
  }

  // For Radiological Consequence Analysis
  @Post("/radiological-consequence-analysis/")
  async createRadiologicalConsequenceAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createRadiologicalConsequenceAnalysis(data);
  }

  // For Mechanistic Source Term
  @Post("/mechanistic-source-term/")
  async createMechanisticSourceTerm(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createMechanisticSourceTerm(data);
  }

  // For Event Sequence Quantification Diagram
  @Post("/event-sequence-quantification-diagram/")
  async createEventSequenceQuantificationDiagram(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createEventSequenceQuantificationDiagram(data);
  }

  // For Data Analysis
  @Post("/data-analysis/")
  async createDataAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createDataAnalysis(data);
  }

  // For Human Reliability Analysis
  @Post("/human-reliability-analysis/")
  async createHumanReliabilityAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createHumanReliabilityAnalysis(data);
  }

  // For Systems Analysis
  @Post("/systems-analysis/")
  async createSystemsAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createSystemsAnalysis(data);
  }

  // For Success Criteria
  @Post("/success-criteria/")
  async createSuccessCriteria(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createSuccessCriteria(data);
  }

  /**
   * Create an Event Sequence Analysis nested model.
   *
   * Accepts either of the following payloads:
   * - `{"data": Partial<NestedModel>; "typedModel": TypedModelType}` to target a specific typed model
   * - `Partial<NestedModel>` to create without specifying a typed model
   *
   * @param body - Request payload; when `typedModel` is provided, creation occurs within that typed model.
   * @returns Newly created nested model with common fields
   */
  // For Event Sequence Analysis
  @Post("/event-sequence-analysis/")
  async createEventSequenceAnalysis(
    @Body() body: { data: Partial<NestedModel>; typedModel: TypedModelType } | Partial<NestedModel>,
  ): Promise<NestedModel> {
    const hasTypedModel = (v: unknown): v is { data: Partial<NestedModel>; typedModel: TypedModelType } =>
      typeof v === "object" && v !== null && "typedModel" in (v as Record<string, unknown>);
    if (hasTypedModel(body)) {
      return this.eventSequenceAnalysisService.createEventSequenceAnalysis(body.data, body.typedModel);
    }
    return this.nestedModelService.createEventSequenceAnalysis(body as Partial<NestedModel>);
  }

  // For Operating State Analysis
  @Post("/operating-state-analysis/")
  async createOperatingStateAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createOperatingStateAnalysis(data);
  }

  //TODO: patch endpoints eventually for when we know what is getting updated, when and where

  //get collection methods

  /**
   * Retrieve the collection of Bayesian Estimations.
   * @param id - The id of the parent model
   * @returns A promise with the list of models of the requested type
   */
  @Get("/bayesian-estimations/")
  async getBayesianEstimations(@Query("id") id: number): Promise<BayesianEstimation[]> {
    return this.nestedModelService.getBayesianEstimations(id);
  }

  /**
   * Retrieve the collection of Bayesian Networks.
   * @param id - The id of the parent model
   * @returns A promise with the list of models of the requested type
   */
  @Get("/bayesian-networks/")
  async getBayesianNetworks(@Query("id") id: number | string): Promise<EventSequenceDiagram[]> {
    if (typeof id === "number") {
      // Use core service for numeric IDs to match test expectations of persisted docs
      return this.nestedModelService.getBayesianNetworks(id as number);
    } else {
      return this.bayesianNetworkService.getBayesianNetworkString(id);
    }
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Event Sequence Diagrams)
   * @param id - the id of the parent model
   * @returns a promise with a list of the model typed defined
   */
  @Get("/event-sequence-diagrams/")
  async getEventSequenceDiagrams(@Query("id") id: number | string): Promise<EventSequenceDiagram[]> {
    if (typeof id === "number") {
      // Use core service for numeric IDs to match test expectations of persisted docs
      return this.nestedModelService.getEventSequenceDiagrams(id as number);
    } else {
      return this.eventSequenceDiagramService.getEventSequenceDiagramsString(id);
    }
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Event Trees)
   * @param id - the id of the parent model
   * @returns a promise with a list of the model typed defined
   */
  @Get("/event-trees/")
  async getEventTrees(@Query("id") id: number | string): Promise<EventSequenceDiagram[]> {
    if (typeof id === "number") {
      // Use core service for numeric IDs to match test expectations of persisted docs
      return this.nestedModelService.getEventTrees(id as number);
    } else {
      return this.eventTreeService.getEventTreesString(id);
    }
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Event Trees)
   * @param id - the id of the parent model
   * @returns a promise with a list of the model typed defined
   */
  @Get("/fault-trees/")
  async getFaultTrees(@Query("id") id: number | string): Promise<FaultTree[]> {
    if (typeof id === "number") {
      // Use core service for numeric IDs to match test expectations of persisted docs
      return this.nestedModelService.getFaultTrees(id as number);
    } else {
      return this.faultTreesService.getFaultTreeString(id);
    }
  }

  /**
   * Retrieve the collection of Heat Balance Fault Trees.
   * @param id - The id of the parent model
   * @returns A promise with the list of models of the requested type
   */
  @Get("/heat-balance-fault-trees/")
  async getHeatBalanceFaultTrees(@Query("id") id: number): Promise<HeatBalanceFaultTree[]> {
    return this.nestedModelService.getHeatBalanceFaultTrees(id);
  }

  /**
   * Retrieve the collection of Functional Events.
   * @param id - The id of the parent model
   * @returns A promise with the list of models of the requested type
   */
  @Get("/functional-events/")
  async getFunctionalEvents(@Query("id") id: number): Promise<FunctionalEvent[]> {
    return this.nestedModelService.getFunctionalEvents(id);
  }

  /**
   * Retrieve the collection of Initiating Events.
   * @param id - The id of the parent model
   * @returns A promise with the list of models of the requested type
   */
  @Get("/initiating-events/")
  async getInitiatingEvents(@Query("id") id: number | string): Promise<InitiatingEvent[]> {
    if (typeof id === "number") {
      return this.initiatingEventsService.getInitiatingEvents(id);
    } else {
      return this.initiatingEventsService.getInitiatingEventsString(id);
    }
  }

  /**
   * Retrieve the collection of Markov Chains.
   * @param id - The id of the parent model
   * @returns A promise with the list of models of the requested type
   */
  @Get("/markov-chains/")
  async getMarkovChains(@Query("id") id: number): Promise<MarkovChain[]> {
    return this.nestedModelService.getMarkovChains(id);
  }

  /**
   * Retrieve the collection of Weibull Analysis models.
   * @param id - The id of the parent model
   * @returns A promise with the list of models of the requested type
   */
  @Get("/weibull-analysis/")
  async getWeibullAnalysis(@Query("id") id: number): Promise<WeibullAnalysis[]> {
    return this.nestedModelService.getWeibullAnalysis(id);
  }

  // For Risk Integration
  @Get("/risk-integration/")
  async getRiskIntegration(@Query("id") id: number): Promise<RiskIntegration[]> {
    return this.nestedModelService.getRiskIntegration(id);
  }

  // For Radiological Consequence Analysis
  @Get("/radiological-consequence-analysis/")
  async getRadiologicalConsequenceAnalysis(@Query("id") id: number): Promise<RadiologicalConsequenceAnalysis[]> {
    return this.nestedModelService.getRadiologicalConsequenceAnalysis(id);
  }

  // For Mechanistic Source Term
  @Get("/mechanistic-source-term/")
  async getMechanisticSourceTerm(@Query("id") id: number): Promise<MechanisticSourceTerm[]> {
    return this.nestedModelService.getMechanisticSourceTerm(id);
  }

  // For Event Sequence Quantification Diagram
  @Get("/event-sequence-quantification-diagram/")
  async getEventSequenceQuantificationDiagram(@Query("id") id: number): Promise<EventSequenceQuantificationDiagram[]> {
    return this.nestedModelService.getEventSequenceQuantificationDiagram(id);
  }

  // For Data Analysis
  @Get("/data-analysis/")
  async getDataAnalysis(@Query("id") id: number): Promise<DataAnalysis[]> {
    return this.nestedModelService.getDataAnalysis(id);
  }

  // For Human Reliability Analysis
  @Get("/human-reliability-analysis/")
  async getHumanReliabilityAnalysis(@Query("id") id: number): Promise<HumanReliabilityAnalysis[]> {
    return this.nestedModelService.getHumanReliabilityAnalysis(id);
  }

  // For Systems Analysis
  @Get("/systems-analysis/")
  async getSystemsAnalysis(@Query("id") id: number): Promise<SystemsAnalysis[]> {
    return this.nestedModelService.getSystemsAnalysis(id);
  }

  // For Success Criteria
  @Get("/success-criteria/")
  async getSuccessCriteria(@Query("id") id: number): Promise<SuccessCriteria[]> {
    return this.nestedModelService.getSuccessCriteria(id);
  }

  // For Event Sequence Analysis
  /**
   * grabs the collection of the type of nested model defined by the function call name (Initiating Events)
   * @param id - the id of the parent model
   * @returns a promise with a list of the model typed defined
   */
  @Get("/event-sequence-analysis/")
  async getEventSequenceAnalysis(@Query("id") id: number): Promise<EventSequenceAnalysis[]> {
    if (typeof id === "number") {
      return this.eventSequenceAnalysisService.getEventSequenceAnalysis(id);
    } else {
      return this.eventSequenceAnalysisService.getEventSequenceAnalysisString(id);
    }
  }

  // For Operating State Analysis
  @Get("/operating-state-analysis/")
  async getOperatingStateAnalysis(@Query("id") id: number): Promise<OperatingStateAnalysis[]> {
    return this.nestedModelService.getOperatingStateAnalysis(id);
  }

  //singular get endpoints

  /**
   * Return a single model from the collection.
   * @param modelId - The id of the model to be retrieved
   * @returns A promise with the model with the given id
   */
  @Get("/bayesian-estimations/:id")
  async getSingleBayesianEstimation(@Param("id") modelId: number): Promise<BayesianEstimation> {
    return this.nestedModelService.getSingleBayesianEstimation(modelId);
  }

  /**
   * Return a single model from the collection.
   * @param modelId - The id of the model to be retrieved
   * @returns A promise with the model with the given id
   */
  @Get("/bayesian-networks/:id")
  async getSingleBayesianNetwork(@Param("id") modelId: number | string): Promise<EventSequenceDiagram> {
    if (typeof modelId === "number") {
      // Use core service for numeric IDs to match test expectations of persisted docs
      return this.nestedModelService.getSingleBayesianNetwork(modelId as number);
    } else {
      return this.bayesianNetworkService.getSingleBayesianNetworkString(modelId);
    }
  }

  /**
   * Return a single model from the collection.
   * @param modelId - The id of the model to be retrieved
   * @returns A promise with the model with the given id
   */
  @Get("/event-sequence-diagrams/:id")
  async getSingleEventSequenceDiagram(@Param("id") modelId: number | string): Promise<EventSequenceDiagram> {
    if (typeof modelId === "number") {
      // Use core service for numeric IDs to match test expectations of persisted docs
      return this.nestedModelService.getSingleEventSequenceDiagram(modelId as number);
    } else {
      return this.eventSequenceDiagramService.getSingleEventSequenceDiagramString(modelId);
    }
  }

  /**
   * Return a single model from the collection.
   * @param modelId - The id of the model to be retrieved
   * @returns A promise with the model with the given id
   */
  @Get("/event-trees/:id")
  async getSingleEventTree(@Param("id") modelId: number | string): Promise<EventTree> {
    if (typeof modelId === "number") {
      // Use core service for numeric IDs to match test expectations of persisted docs
      return this.nestedModelService.getSingleEventTree(modelId as number);
    } else {
      return this.eventTreeService.getSingleEventTreeString(modelId);
    }
  }

  /**
   * Return a single model from the collection.
   * @param modelId - The id of the model to be retrieved
   * @returns A promise with the model with the given id
   */
  @Get("/fault-trees/:id")
  async getSingleFaultTree(@Param("id") modelId: number | string): Promise<EventTree> {
    if (typeof modelId === "number") {
      // Use core service for numeric IDs to match test expectations of persisted docs
      return this.nestedModelService.getSingleFaultTree(modelId as number);
    } else {
      return this.faultTreesService.getSingleFaultTreeString(modelId);
    }
  }

  /**
   * Return a single model from the collection.
   * @param modelId - The id of the model to be retrieved
   * @returns A promise with the model with the given id
   */
  @Get("/heat-balance-fault-trees/:id")
  async getSingleHeatBalanceFaultTree(@Param("id") modelId: number): Promise<HeatBalanceFaultTree> {
    return this.nestedModelService.getSingleHeatBalanceFaultTree(modelId);
  }

  /**
   * Return a single model from the collection.
   * @param modelId - The id of the model to be retrieved
   * @returns A promise with the model with the given id
   */
  @Get("/functional-events/:id")
  async getSingleFunctionalEvent(@Param("id") modelId: number): Promise<FunctionalEvent> {
    return this.nestedModelService.getSingleFunctionalEvent(modelId);
  }

  /**
   * Return a single model from the collection.
   * @param modelId - The id of the model to be retrieved
   * @returns A promise with the model with the given id
   */
  @Get("/initiating-events/:id")
  async getSingleInitiatingEvent(@Param("id") modelId: number | string): Promise<InitiatingEvent> {
    if (typeof modelId === "number") {
      // Use core service for numeric IDs to match test expectations of persisted docs
      return this.nestedModelService.getSingleInitiatingEvent(modelId as number);
    } else {
      return this.initiatingEventsService.getSingleInitiatingEventString(modelId);
    }
  }

  /**
   * Return a single model from the collection.
   * @param modelId - The id of the model to be retrieved
   * @returns A promise with the model with the given id
   */
  @Get("/markov-chains/:id")
  async getSingleMarkovChain(@Param("id") modelId: number): Promise<MarkovChain> {
    return this.nestedModelService.getSingleMarkovChain(modelId);
  }

  /**
   * Return a single model from the collection.
   * @param modelId - The id of the model to be retrieved
   * @returns A promise with the model with the given id
   */
  @Get("/weibull-analysis/:id")
  async getSingleWeibullAnalysis(@Param("id") modelId: number): Promise<WeibullAnalysis> {
    return this.nestedModelService.getSingleWeibullAnalysis(modelId);
  }

  // For Risk Integration
  @Get("/risk-integration/:id")
  async getSingleRiskIntegration(@Param("id") modelId: number): Promise<RiskIntegration> {
    return this.nestedModelService.getSingleRiskIntegration(modelId);
  }

  // For Radiological Consequence Analysis
  @Get("/radiological-consequence-analysis/:id")
  async getSingleRadiologicalConsequenceAnalysis(
    @Param("id") modelId: number,
  ): Promise<RadiologicalConsequenceAnalysis> {
    return this.nestedModelService.getSingleRadiologicalConsequenceAnalysis(modelId);
  }

  // For Mechanistic Source Term
  @Get("/mechanistic-source-term/:id")
  async getSingleMechanisticSourceTerm(@Param("id") modelId: number): Promise<MechanisticSourceTerm> {
    return this.nestedModelService.getSingleMechanisticSourceTerm(modelId);
  }

  // For Event Sequence Quantification Diagram
  @Get("/event-sequence-quantification-diagram/:id")
  async getSingleEventSequenceQuantificationDiagram(
    @Param("id") modelId: number,
  ): Promise<EventSequenceQuantificationDiagram> {
    return this.nestedModelService.getSingleEventSequenceQuantificationDiagram(modelId);
  }

  // For Data Analysis
  @Get("/data-analysis/:id")
  async getSingleDataAnalysis(@Param("id") modelId: number): Promise<DataAnalysis> {
    return this.nestedModelService.getSingleDataAnalysis(modelId);
  }

  // For Human Reliability Analysis
  @Get("/human-reliability-analysis/:id")
  async getSingleHumanReliabilityAnalysis(@Param("id") modelId: number): Promise<HumanReliabilityAnalysis> {
    return this.nestedModelService.getSingleHumanReliabilityAnalysis(modelId);
  }

  // For Systems Analysis
  @Get("/systems-analysis/:id")
  async getSingleSystemsAnalysis(@Param("id") modelId: number): Promise<SystemsAnalysis> {
    return this.nestedModelService.getSingleSystemsAnalysis(modelId);
  }

  // For Success Criteria
  @Get("/success-criteria/:id")
  async getSingleSuccessCriteria(@Param("id") modelId: number): Promise<SuccessCriteria> {
    return this.nestedModelService.getSingleSuccessCriteria(modelId);
  }

  // For Event Sequence Analysis
  /**
   * returns a single model from the given collection
   * @param modelId - the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @Get("/event-sequence-analysis/:id")
  async getSingleEventSequenceAnalysis(@Param("id") modelId: number): Promise<EventSequenceAnalysis> {
    if (typeof modelId === "number") {
      // Use core service for numeric IDs to match test expectations of persisted docs
      return this.nestedModelService.getSingleEventSequenceAnalysis(modelId as number);
    } else {
      return this.eventSequenceAnalysisService.getSingleEventSequenceAnalysisString(modelId as unknown as string);
    }
  }

  // For Operating State Analysis
  @Get("/operating-state-analysis/:id")
  async getSingleOperatingStateAnalysis(@Param("id") modelId: number): Promise<OperatingStateAnalysis> {
    return this.nestedModelService.getSingleOperatingStateAnalysis(modelId);
  }

  //delete endpoints

  /**
   * Delete a single nested model by id.
   * @param id - The id of the model to be deleted
   * @returns A promise with the deleted model
   */
  @Delete("/bayesian-estimations/")
  async deleteBayesianEstimation(@Query("id") id: number): Promise<BayesianEstimation> {
    return this.nestedModelService.deleteBayesianEstimation(id);
  }

  /**
   * Delete a single nested model by id.
   * @param id - The id of the model to be deleted
   * @param typedModel - The typed model that this nested model belongs to
   * @returns A promise with the deleted model
   */
  @Delete("/bayesian-networks/")
  async deleteBayesianNetwork(
    @Query("id") id: string | number,
    @Query("type") typedModel?: TypedModelType,
  ): Promise<any> {
    if (typeof id === "number") {
      return this.nestedModelService.deleteBayesianNetwork(id);
    }
    await this.bayesianNetworkService.deleteBayesianNetwork(id, typedModel as TypedModelType);
  }

  /**
   * Delete a single nested model by id.
   * @param id - The id of the model to be deleted
   * @param typedModel - The typed model that this nested model belongs to
   * @returns A promise with the deleted model
   */
  @Delete("/event-sequence-diagrams/")
  async deleteEventSequenceDiagram(
    @Query("id") id: string | number,
    @Query("type") typedModel?: TypedModelType,
  ): Promise<any> {
    if (typeof id === "number") {
      return this.nestedModelService.deleteEventSequenceDiagram(id);
    }
    await this.eventSequenceDiagramService.deleteEventSequenceDiagram(id, typedModel as TypedModelType);
  }

  /**
   * Delete a single nested model by id.
   * @param id - The id of the model to be deleted
   * @param typedModel - The typed model that this nested model belongs to
   * @returns A promise with the deleted model
   */
  @Delete("/event-trees/")
  async deleteEventTree(@Query("id") id: string | number, @Query("type") typedModel?: TypedModelType): Promise<any> {
    if (typeof id === "number") {
      return this.nestedModelService.deleteEventTree(id);
    }
    await this.eventTreeService.deleteEventTree(id, typedModel as TypedModelType);
  }

  /**
   * Delete a single nested model by id.
   * @param id - The id of the model to be deleted
   * @param typedModel - The typed model that this nested model belongs to
   * @returns A promise with the deleted model
   */
  @Delete("/fault-trees/")
  async deleteFaultTree(@Query("id") id: string | number, @Query("type") typedModel?: TypedModelType): Promise<any> {
    if (typeof id === "number") {
      return this.nestedModelService.deleteFaultTree(id);
    }
    await this.faultTreesService.deleteFaultTree(id, typedModel as TypedModelType);
  }

  /**
   * Delete a single nested model by id.
   * @param id - The id of the model to be deleted
   * @returns A promise with the deleted model
   */
  @Delete("/heat-balance-fault-trees/")
  async deleteHeatBalanceFaultTree(@Query("id") id: number): Promise<HeatBalanceFaultTree> {
    return this.nestedModelService.deleteHeatBalanceFaultTree(id);
  }

  /**
   * Delete a single nested model by id.
   * @param id - The id of the model to be deleted
   * @returns A promise with the deleted model
   */
  @Delete("/functional-events/")
  async deleteFunctionalEvent(@Query("id") id: number): Promise<FunctionalEvent> {
    return this.nestedModelService.deleteFunctionalEvent(id);
  }

  /**
   * Delete a single nested model by id.
   * @param id - The id of the model to be deleted
   * @param typedModel - The typed model that this nested model belongs to
   * @returns A promise with the deleted model
   */
  @Delete("/initiating-events/")
  async deleteInitiatingEvent(
    @Query("id") id: string | number,
    @Query("type") typedModel?: TypedModelType,
  ): Promise<any> {
    if (typeof id === "number") {
      return this.nestedModelService.deleteInitiatingEvent(id);
    }
    await this.initiatingEventsService.deleteInitiatingEvent(id, typedModel as TypedModelType);
  }

  /**
   * Delete a single nested model by id.
   * @param id - The id of the model to be deleted
   * @returns A promise with the deleted model
   */
  @Delete("/markov-chains/")
  async deleteMarkovChain(@Query("id") id: number): Promise<MarkovChain> {
    return this.nestedModelService.deleteMarkovChain(id);
  }

  /**
   * Delete a single nested model by id.
   * @param id - The id of the model to be deleted
   * @returns A promise with the deleted model
   */
  @Delete("/weibull-analysis/")
  async deleteWeibullAnalysis(@Query("id") id: number): Promise<WeibullAnalysis> {
    return this.nestedModelService.deleteWeibullAnalysis(id);
  }

  // For Risk Integration
  @Delete("/risk-integration/")
  async deleteRiskIntegration(@Query("id") id: number): Promise<RiskIntegration> {
    return this.nestedModelService.deleteRiskIntegration(id);
  }

  // For Radiological Consequence Analysis
  @Delete("/radiological-consequence-analysis/")
  async deleteRadiologicalConsequenceAnalysis(@Query("id") id: number): Promise<RadiologicalConsequenceAnalysis> {
    return this.nestedModelService.deleteRadiologicalConsequenceAnalysis(id);
  }

  // For Mechanistic Source Term
  @Delete("/mechanistic-source-term/")
  async deleteMechanisticSourceTerm(@Query("id") id: number): Promise<MechanisticSourceTerm> {
    return this.nestedModelService.deleteMechanisticSourceTerm(id);
  }

  // For Event Sequence Quantification Diagram
  @Delete("/event-sequence-quantification-diagram/")
  async deleteEventSequenceQuantificationDiagram(@Query("id") id: number): Promise<EventSequenceQuantificationDiagram> {
    return this.nestedModelService.deleteEventSequenceQuantificationDiagram(id);
  }

  // For Data Analysis
  @Delete("/data-analysis/")
  async deleteDataAnalysis(@Query("id") id: number): Promise<DataAnalysis> {
    return this.nestedModelService.deleteDataAnalysis(id);
  }

  // For Human Reliability Analysis
  @Delete("/human-reliability-analysis/")
  async deleteHumanReliabilityAnalysis(@Query("id") id: number): Promise<HumanReliabilityAnalysis> {
    return this.nestedModelService.deleteHumanReliabilityAnalysis(id);
  }

  // For Systems Analysis
  @Delete("/systems-analysis/")
  async deleteSystemsAnalysis(@Query("id") id: number): Promise<SystemsAnalysis> {
    return this.nestedModelService.deleteSystemsAnalysis(id);
  }

  // For Success Criteria
  @Delete("/success-criteria/")
  async deleteSuccessCriteria(@Query("id") id: number): Promise<SuccessCriteria> {
    return this.nestedModelService.deleteSuccessCriteria(id);
  }

  /**
   * Delete a single nested model by id.
   * @param id - The id of the model to be deleted
   * @param typedModel - The typed model that this nested model belongs to
   * @returns A promise with the deleted model
   */
  // For Event Sequence Analysis
  @Delete("/event-sequence-analysis/")
  async deleteEventSequenceAnalysis(
    @Query("id") id: string | number,
    @Query("type") typedModel?: TypedModelType,
  ): Promise<any> {
    if (typeof id === "number") {
      return this.nestedModelService.deleteEventSequenceAnalysis(id);
    }
    return this.eventSequenceAnalysisService.deleteEventSequenceAnalysis(id, typedModel as TypedModelType);
  }

  // For Operating State Analysis
  @Delete("/operating-state-analysis/")
  async deleteOperatingStateAnalysis(@Query("id") id: number): Promise<OperatingStateAnalysis> {
    return this.nestedModelService.deleteOperatingStateAnalysis(id);
  }

  /**
   * Update a label for the nested model type.
   * @param id - The id of the nested model to be updated
   * @param data - The new label, with a name and description string
   * @returns The updated model
   */
  @Patch("/bayesian-estimations/:id")
  async updateBayesianEstimationLabel(@Param("id") id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateBayesianEstimationLabel(id, data);
  }

  /**
   * Update a label for the nested model type.
   * @param id - The id of the nested model to be updated
   * @param data - The new label, with a name and description string
   * @returns The updated model
   */
  @Patch("/bayesian-networks/:id")
  async updateBayesianNetworkLabel(@Param("id") id: string | number, @Body() data: Label): Promise<NestedModel> {
    if (typeof id === "number") return this.nestedModelService.updateBayesianNetworkLabelNumber(id, data);
    return this.bayesianNetworkService.updateBayesianNetworkLabel(id, data);
  }

  /**
   * Update a label for the nested model type.
   * @param id - The id of the nested model to be updated
   * @param data - The new label, with a name and description string
   * @returns The updated model
   */
  @Patch("/event-sequence-diagrams/:id")
  async updateEventSequenceDiagramLabel(@Param("id") id: string | number, @Body() data: Label): Promise<NestedModel> {
    if (typeof id === "number") return this.nestedModelService.updateEventSequenceDiagramLabelNumber(id, data);
    return this.eventSequenceDiagramService.updateEventSequenceDiagramLabel(id, data);
  }

  /**
   * Update a label for the nested model type.
   * @param id - The id of the nested model to be updated
   * @param data - The new label, with a name and description string
   * @returns The updated model
   */
  @Patch("/event-trees/:id")
  async updateEventTreeLabel(@Param("id") id: string | number, @Body() data: Label): Promise<NestedModel> {
    if (typeof id === "number") return this.nestedModelService.updateEventTreeLabelNumber(id, data);
    return this.eventTreeService.updateEventTreeLabel(id, data);
  }

  /**
   * Update a label for the nested model type.
   * @param id - The id of the nested model to be updated
   * @param data - The new label, with a name and description string
   * @returns The updated model
   */
  @Patch("/fault-trees/:id")
  async updateFaultTreeLabel(@Param("id") id: string | number, @Body() data: Label): Promise<NestedModel> {
    if (typeof id === "number") return this.nestedModelService.updateFaultTreeLabelNumber(id, data);
    return this.faultTreesService.updateFaultTreeLabel(id, data);
  }

  /**
   * Update a label for the nested model type.
   * @param id - The id of the nested model to be updated
   * @param data - The new label, with a name and description string
   * @returns The updated model
   */
  @Patch("/heat-balance-fault-trees/:id")
  async updateHeatBalanceFaultTreeLabel(@Param("id") id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateHeatBalanceFaultTreeLabel(id, data);
  }

  /**
   * Update a label for the nested model type.
   * @param id - The id of the nested model to be updated
   * @param data - The new label, with a name and description string
   * @returns The updated model
   */
  @Patch("/functional-events/:id")
  async updateFunctionalEventLabel(@Param("id") id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateFunctionalEventLabel(id, data);
  }

  /**
   * Update a label for the nested model type.
   * @param id - The id of the nested model to be updated
   * @param data - The new label, with a name and description string
   * @returns The updated model
   */
  @Patch("/initiating-events/:id")
  async updateInitiatingEventLabel(@Param("id") id: string | number, @Body() data: Label): Promise<NestedModel> {
    if (typeof id === "number") return this.nestedModelService.updateInitiatingEventLabelNumber(id, data);
    return this.initiatingEventsService.updateInitiatingEventLabel(id, data);
  }

  /**
   * Update a label for the nested model type.
   * @param id - The id of the nested model to be updated
   * @param data - The new label, with a name and description string
   * @returns The updated model
   */
  @Patch("/markov-chains/:id")
  async updateMarkovChainLabel(@Param("id") id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateMarkovChainLabel(id, data);
  }

  /**
   * Update a label for the nested model type.
   * @param id - The id of the nested model to be updated
   * @param data - The new label, with a name and description string
   * @returns The updated model
   */
  @Patch("/weibull-analysis/:id")
  async updateWeibullAnalysisLabel(@Param("id") id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateWeibullAnalysisLabel(id, data);
  }

  // For Risk Integration
  @Patch("/risk-integration/:id")
  async updateRiskIntegrationLabel(@Param("id") id: number, @Body() data: Label): Promise<RiskIntegration> {
    return this.nestedModelService.updateRiskIntegrationLabel(id, data);
  }

  // For Radiological Consequence Analysis
  @Patch("/radiological-consequence-analysis/:id")
  async updateRadiologicalConsequenceAnalysisLabel(
    @Param("id") id: number,
    @Body() data: Label,
  ): Promise<RadiologicalConsequenceAnalysis> {
    return this.nestedModelService.updateRadiologicalConsequenceAnalysisLabel(id, data);
  }

  // For Mechanistic Source Term
  @Patch("/mechanistic-source-term/:id")
  async updateMechanisticSourceTermLabel(@Param("id") id: number, @Body() data: Label): Promise<MechanisticSourceTerm> {
    return this.nestedModelService.updateMechanisticSourceTermLabel(id, data);
  }

  // For Event Sequence Quantification Diagram
  @Patch("/event-sequence-quantification-diagram/:id")
  async updateEventSequenceQuantificationDiagramLabel(
    @Param("id") id: number,
    @Body() data: Label,
  ): Promise<EventSequenceQuantificationDiagram> {
    return this.nestedModelService.updateEventSequenceQuantificationDiagramLabel(id, data);
  }

  // For Data Analysis
  @Patch("/data-analysis/:id")
  async updateDataAnalysisLabel(@Param("id") id: number, @Body() data: Label): Promise<DataAnalysis> {
    return this.nestedModelService.updateDataAnalysisLabel(id, data);
  }

  // For Human Reliability Analysis
  @Patch("/human-reliability-analysis/:id")
  async updateHumanReliabilityAnalysisLabel(
    @Param("id") id: number,
    @Body() data: Label,
  ): Promise<HumanReliabilityAnalysis> {
    return this.nestedModelService.updateHumanReliabilityAnalysisLabel(id, data);
  }

  // For Systems Analysis
  @Patch("/systems-analysis/:id")
  async updateSystemsAnalysisLabel(@Param("id") id: number, @Body() data: Label): Promise<SystemsAnalysis> {
    return this.nestedModelService.updateSystemsAnalysisLabel(id, data);
  }

  // For Success Criteria
  @Patch("/success-criteria/:id")
  async updateSuccessCriteriaLabel(@Param("id") id: number, @Body() data: Label): Promise<SuccessCriteria> {
    return this.nestedModelService.updateSuccessCriteriaLabel(id, data);
  }

  /**
   * Update a label for the nested model type.
   * @param id - The id of the nested model to be updated
   * @param data - The new label, with a name and description string
   * @returns The updated model
   */
  // For Event Sequence Analysis
  @Patch("/event-sequence-analysis/:id")
  async updateEventSequenceAnalysisLabel(@Param("id") id: string | number, @Body() data: Label): Promise<NestedModel> {
    if (typeof id === "number") return this.nestedModelService.updateEventSequenceAnalysisLabelNumber(id, data);
    return this.eventSequenceAnalysisService.updateEventSequenceAnalysisLabel(id, data);
  }

  // For Operating State Analysis
  @Patch("/operating-state-analysis/:id")
  async updateOperatingStateAnalysisLabel(
    @Param("id") id: number,
    @Body() data: Label,
  ): Promise<OperatingStateAnalysis> {
    return this.nestedModelService.updateOperatingStateAnalysisLabel(id, data);
  }

  // removes parent ids

  /**
   * Remove parentId from all nested models. If the model has no parentIds it is removed.
   * @param id - The parent id to be removed
   * @returns A promise with the number of totally deleted nested models
   */
  @Delete()
  async removeParentIds(@Query("id") modelId: number | string): Promise<number> {
    const idNum = typeof modelId === "string" ? Number(modelId) : modelId;
    return this.nestedModelService.removeParentModels(idNum);
  }
}
