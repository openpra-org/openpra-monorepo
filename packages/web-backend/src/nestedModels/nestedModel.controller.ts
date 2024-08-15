import { Controller, HttpStatus } from "@nestjs/common";
import { TypedBody, TypedParam, TypedQuery, TypedRoute } from "@nestia/core";
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

  @TypedRoute.Get()
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
  @TypedRoute.Post("/bayesian-estimations/")
  public async createBayesianEstimation(@TypedBody() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createBayesianEstimation(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param body is the entire body of the post request
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @param typedModel is the typed model to be updated
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @TypedRoute.Post("/bayesian-networks/")
  public async createBayesianNetwork(
    @TypedBody() body: { data: Partial<NestedModel>; typedModel: TypedModelType },
  ): Promise<NestedModel> {
    return this.bayesianNetworkService.createBayesianNetwork(body.data, body.typedModel);
  }

  /**
   * posts the nested model defined in the method name
   * @param body is the entire body of the post request
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @param typedModel is the typed model to be updated
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @TypedRoute.Post("/event-sequence-diagrams/")
  public async createEventSequenceDiagram(
    @TypedBody() body: { data: Partial<NestedModel>; typedModel: TypedModelType },
  ): Promise<NestedModel> {
    return this.eventSequenceDiagramService.createEventSequenceDiagram(body.data, body.typedModel);
  }

  /**
   * posts the nested model defined in the method name
   * @param body is the entire body of the post request
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @param typedModel is the typed model to be updated
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @TypedRoute.Post("/event-trees/")
  public async createEventTree(
    @TypedBody() body: { data: Partial<NestedModel>; typedModel: TypedModelType },
  ): Promise<NestedModel> {
    return this.eventTreeService.createEventTree(body.data, body.typedModel);
  }

  /**
   * posts the nested model defined in the method name
   * @param body is the entire body of the post request
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @param typedModel is the typed model to be updated
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @TypedRoute.Post("/fault-trees/")
  public async createFaultTree(
    @TypedBody() body: { data: Partial<NestedModel>; typedModel: TypedModelType },
  ): Promise<NestedModel> {
    return this.faultTreesService.createFaultTree(body.data, body.typedModel);
  }

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @TypedRoute.Post("/heat-balance-fault-trees/")
  public async createHeatBalanceFaultTree(@TypedBody() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createHeatBalanceFaultTree(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @TypedRoute.Post("/functional-events/")
  public async createFunctionalEvent(@TypedBody() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createFunctionalEvent(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param body - is the entire body of the post request
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @param typedModel is the typed model to be updated
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @TypedRoute.Post("/initiating-events/")
  public async createInitiatingEvent(
    @TypedBody() body: { data: Partial<NestedModel>; typedModel: TypedModelType },
  ): Promise<NestedModel> {
    return this.initiatingEventsService.createInitiatingEvent(body.data, body.typedModel);
  }

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @TypedRoute.Post("/markov-chains/")
  public async createMarkovChain(@TypedBody() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createMarkovChain(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @returns a promise with the newly created model, with the general nested model fields
   */
  @TypedRoute.Post("/weibull-analysis/")
  public async createWeibullAnalysis(@TypedBody() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createWeibullAnalysis(data);
  }

  // For Risk Integration
  @TypedRoute.Post("/risk-integration/")
  public async createRiskIntegration(@TypedBody() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createRiskIntegration(data);
  }

  // For Radiological Consequence Analysis
  @TypedRoute.Post("/radiological-consequence-analysis/")
  public async createRadiologicalConsequenceAnalysis(@TypedBody() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createRadiologicalConsequenceAnalysis(data);
  }

  // For Mechanistic Source Term
  @TypedRoute.Post("/mechanistic-source-term/")
  public async createMechanisticSourceTerm(@TypedBody() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createMechanisticSourceTerm(data);
  }

  // For Event Sequence Quantification Diagram
  @TypedRoute.Post("/event-sequence-quantification-diagram/")
  public async createEventSequenceQuantificationDiagram(@TypedBody() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createEventSequenceQuantificationDiagram(data);
  }

  // For Data Analysis
  @TypedRoute.Post("/data-analysis/")
  public async createDataAnalysis(@TypedBody() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createDataAnalysis(data);
  }

  // For Human Reliability Analysis
  @TypedRoute.Post("/human-reliability-analysis/")
  public async createHumanReliabilityAnalysis(@TypedBody() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createHumanReliabilityAnalysis(data);
  }

  // For Systems Analysis
  @TypedRoute.Post("/systems-analysis/")
  public async createSystemsAnalysis(@TypedBody() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createSystemsAnalysis(data);
  }

  // For Success Criteria
  @TypedRoute.Post("/success-criteria/")
  public async createSuccessCriteria(@TypedBody() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createSuccessCriteria(data);
  }

  /**
   * posts the nested model defined in the method name
   * @param body - is the entire body of the post request
   * @param data takes in a partial of a nested model with a label, which has a name string and optional description string
   * as well as the parentId which is a number. It should take these fields at a minimum, the id is overridden
   * @param typedModel is the typed model to be updated
   * @returns a promise with the newly created model, with the general nested model fields
   */
  // For Event Sequence Analysis
  @TypedRoute.Post("/event-sequence-analysis/")
  public async createEventSequenceAnalysis(
    @TypedBody() body: { data: Partial<NestedModel>; typedModel: TypedModelType },
  ): Promise<NestedModel> {
    return this.eventSequenceAnalysisService.createEventSequenceAnalysis(body.data, body.typedModel);
  }

  // For Operating State Analysis
  @TypedRoute.Post("/operating-state-analysis/")
  public async createOperatingStateAnalysis(@TypedBody() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createOperatingStateAnalysis(data);
  }

  //TODO: patch endpoints eventually for when we know what is getting updated, when and where

  //get collection methods

  /**
   * grabs the collection of the type of nested model defined by the function call name (Bayesian estimations)
   * @returns a promise with a list of the model typed defined
   * @param query
   */
  @TypedRoute.Get("/bayesian-estimations/")
  public async getBayesianEstimations(@TypedQuery() query: { id: number }): Promise<BayesianEstimation[]> {
    return this.nestedModelService.getBayesianEstimations(query.id);
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Event Sequence Diagrams)
   * @returns a promise with a list of the model typed defined
   * @param query
   */
  @TypedRoute.Get("/bayesian-networks/")
  public async getBayesianNetworks(@TypedQuery() query: { id: number | string }): Promise<EventSequenceDiagram[]> {
    if (typeof query.id === "number") {
      return this.bayesianNetworkService.getBayesianNetwork(query.id);
    } else {
      return this.bayesianNetworkService.getBayesianNetworkString(query.id);
    }
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Event Sequence Diagrams)
   * @returns a promise with a list of the model typed defined
   * @param query
   */
  @TypedRoute.Get("/event-sequence-diagrams/")
  public async getEventSequenceDiagrams(@TypedQuery() query: { id: number | string }): Promise<EventSequenceDiagram[]> {
    if (typeof query.id === "number") {
      return this.eventSequenceDiagramService.getEventSequenceDiagrams(query.id);
    } else {
      return this.eventSequenceDiagramService.getEventSequenceDiagramsString(query.id);
    }
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Event Trees)
   * @returns a promise with a list of the model typed defined
   * @param query
   */
  @TypedRoute.Get("/event-trees/")
  public async getEventTrees(@TypedQuery() query: { id: number | string }): Promise<EventSequenceDiagram[]> {
    if (typeof query.id === "number") {
      return this.eventTreeService.getEventTrees(query.id);
    } else {
      return this.eventTreeService.getEventTreesString(query.id);
    }
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Event Trees)
   * @returns a promise with a list of the model typed defined
   * @param query
   */
  @TypedRoute.Get("/fault-trees/")
  public async getFaultTrees(@TypedQuery() query: { id: number | string }): Promise<FaultTree[]> {
    if (typeof query.id === "number") {
      return this.faultTreesService.getFaultTree(query.id);
    } else {
      return this.faultTreesService.getFaultTreeString(query.id);
    }
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Fault Trees)
   * @returns a promise with a list of the model typed defined
   * @param query
   */
  @TypedRoute.Get("/heat-balance-fault-trees/")
  public async getHeatBalanceFaultTrees(@TypedQuery() query: { id: number }): Promise<HeatBalanceFaultTree[]> {
    return this.nestedModelService.getHeatBalanceFaultTrees(query.id);
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Functional events)
   * @returns a promise with a list of the model typed defined
   * @param query
   */
  @TypedRoute.Get("/functional-events/")
  public async getFunctionalEvents(@TypedQuery() query: { id: number }): Promise<FunctionalEvent[]> {
    return this.nestedModelService.getFunctionalEvents(query.id);
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Initiating Events)
   * @returns a promise with a list of the model typed defined
   * @param query
   */
  @TypedRoute.Get("/initiating-events/")
  public async getInitiatingEvents(@TypedQuery() query: { id: number | string }): Promise<InitiatingEvent[]> {
    if (typeof query.id === "number") {
      return this.initiatingEventsService.getInitiatingEvents(query.id);
    } else {
      return this.initiatingEventsService.getInitiatingEventsString(query.id);
    }
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Markov Chains)
   * @returns a promise with a list of the model typed defined
   * @param query
   */
  @TypedRoute.Get("/markov-chains/")
  public async getMarkovChains(@TypedQuery() query: { id: number }): Promise<MarkovChain[]> {
    return this.nestedModelService.getMarkovChains(query.id);
  }

  /**
   * grabs the collection of the type of nested model defined by the function call name (Weibull Analysis)
   * @returns a promise with a list of the model typed defined
   * @param query
   */
  @TypedRoute.Get("/weibull-analysis/")
  public async getWeibullAnalysis(@TypedQuery() query: { id: number }): Promise<WeibullAnalysis[]> {
    return this.nestedModelService.getWeibullAnalysis(query.id);
  }

  // For Risk Integration
  @TypedRoute.Get("/risk-integration/")
  public async getRiskIntegration(@TypedQuery() query: { id: number }): Promise<RiskIntegration[]> {
    return this.nestedModelService.getRiskIntegration(query.id);
  }

  // For Radiological Consequence Analysis
  @TypedRoute.Get("/radiological-consequence-analysis/")
  public async getRadiologicalConsequenceAnalysis(
    @TypedQuery() query: { id: number },
  ): Promise<RadiologicalConsequenceAnalysis[]> {
    return this.nestedModelService.getRadiologicalConsequenceAnalysis(query.id);
  }

  // For Mechanistic Source Term
  @TypedRoute.Get("/mechanistic-source-term/")
  public async getMechanisticSourceTerm(@TypedQuery() query: { id: number }): Promise<MechanisticSourceTerm[]> {
    return this.nestedModelService.getMechanisticSourceTerm(query.id);
  }

  // For Event Sequence Quantification Diagram
  @TypedRoute.Get("/event-sequence-quantification-diagram/")
  public async getEventSequenceQuantificationDiagram(
    @TypedQuery() query: { id: number },
  ): Promise<EventSequenceQuantificationDiagram[]> {
    return this.nestedModelService.getEventSequenceQuantificationDiagram(query.id);
  }

  // For Data Analysis
  @TypedRoute.Get("/data-analysis/")
  public async getDataAnalysis(@TypedQuery() query: { id: number }): Promise<DataAnalysis[]> {
    return this.nestedModelService.getDataAnalysis(query.id);
  }

  // For Human Reliability Analysis
  @TypedRoute.Get("/human-reliability-analysis/")
  public async getHumanReliabilityAnalysis(@TypedQuery() query: { id: number }): Promise<HumanReliabilityAnalysis[]> {
    return this.nestedModelService.getHumanReliabilityAnalysis(query.id);
  }

  // For Systems Analysis
  @TypedRoute.Get("/systems-analysis/")
  public async getSystemsAnalysis(@TypedQuery() query: { id: number }): Promise<SystemsAnalysis[]> {
    return this.nestedModelService.getSystemsAnalysis(query.id);
  }

  // For Success Criteria
  @TypedRoute.Get("/success-criteria/")
  public async getSuccessCriteria(@TypedQuery() query: { id: number }): Promise<SuccessCriteria[]> {
    return this.nestedModelService.getSuccessCriteria(query.id);
  }

  // For Event Sequence Analysis
  /**
   * grabs the collection of the type of nested model defined by the function call name (Initiating Events)
   * @returns a promise with a list of the model typed defined
   * @param query
   */
  @TypedRoute.Get("/event-sequence-analysis/")
  public async getEventSequenceAnalysis(@TypedQuery() query: { id: number }): Promise<EventSequenceAnalysis[]> {
    if (typeof query.id === "number") {
      return this.eventSequenceAnalysisService.getEventSequenceAnalysis(query.id);
    } else {
      return this.eventSequenceAnalysisService.getEventSequenceAnalysisString(query.id);
    }
  }

  // For Operating State Analysis
  @TypedRoute.Get("/operating-state-analysis/")
  public async getOperatingStateAnalysis(@TypedQuery() query: { id: number }): Promise<OperatingStateAnalysis[]> {
    return this.nestedModelService.getOperatingStateAnalysis(query.id);
  }

  //singular get endpoints

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @TypedRoute.Get("/bayesian-estimations/:id")
  public async getSingleBayesianEstimation(@TypedParam("id") modelId: number): Promise<BayesianEstimation> {
    return this.nestedModelService.getSingleBayesianEstimation(modelId);
  }

  /**
   * returns a single model from the given collection
   * @param modelId - the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @TypedRoute.Get("/bayesian-networks/:id")
  public async getSingleBayesianNetwork(@TypedParam("id") modelId: number | string): Promise<EventSequenceDiagram> {
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
  @TypedRoute.Get("/event-sequence-diagrams/:id")
  public async getSingleEventSequenceDiagram(
    @TypedParam("id") modelId: number | string,
  ): Promise<EventSequenceDiagram> {
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
  @TypedRoute.Get("/event-trees/:id")
  public async getSingleEventTree(@TypedParam("id") modelId: number | string): Promise<EventTree> {
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
  @TypedRoute.Get("/fault-trees/:id")
  public async getSingleFaultTree(@TypedParam("id") modelId: number | string): Promise<EventTree> {
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
  @TypedRoute.Get("/heat-balance-fault-trees/:id")
  public async getSingleHeatBalanceFaultTree(@TypedParam("id") modelId: number): Promise<HeatBalanceFaultTree> {
    return this.nestedModelService.getSingleHeatBalanceFaultTree(modelId);
  }

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @TypedRoute.Get("/functional-events/:id")
  public async getSingleFunctionalEvent(@TypedParam("id") modelId: number): Promise<FunctionalEvent> {
    return this.nestedModelService.getSingleFunctionalEvent(modelId);
  }

  /**
   * returns a single model from the given collection
   * @param modelId the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @TypedRoute.Get("/initiating-events/:id")
  public async getSingleInitiatingEvent(@TypedParam("id") modelId: number | string): Promise<InitiatingEvent> {
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
  @TypedRoute.Get("/markov-chains/:id")
  public async getSingleMarkovChain(@TypedParam("id") modelId: number): Promise<MarkovChain> {
    return this.nestedModelService.getSingleMarkovChain(modelId);
  }

  /**
   * returns a single model from the given collection
   * @param modelId - the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @TypedRoute.Get("/weibull-analysis/:id")
  public async getSingleWeibullAnalysis(@TypedParam("id") modelId: number): Promise<WeibullAnalysis> {
    return this.nestedModelService.getSingleWeibullAnalysis(modelId);
  }

  // For Risk Integration
  @TypedRoute.Get("/risk-integration/:id")
  public async getSingleRiskIntegration(@TypedParam("id") modelId: number): Promise<RiskIntegration> {
    return this.nestedModelService.getSingleRiskIntegration(modelId);
  }

  // For Radiological Consequence Analysis
  @TypedRoute.Get("/radiological-consequence-analysis/:id")
  public async getSingleRadiologicalConsequenceAnalysis(
    @TypedParam("id") modelId: number,
  ): Promise<RadiologicalConsequenceAnalysis> {
    return this.nestedModelService.getSingleRadiologicalConsequenceAnalysis(modelId);
  }

  // For Mechanistic Source Term
  @TypedRoute.Get("/mechanistic-source-term/:id")
  public async getSingleMechanisticSourceTerm(@TypedParam("id") modelId: number): Promise<MechanisticSourceTerm> {
    return this.nestedModelService.getSingleMechanisticSourceTerm(modelId);
  }

  // For Event Sequence Quantification Diagram
  @TypedRoute.Get("/event-sequence-quantification-diagram/:id")
  public async getSingleEventSequenceQuantificationDiagram(
    @TypedParam("id") modelId: number,
  ): Promise<EventSequenceQuantificationDiagram> {
    return this.nestedModelService.getSingleEventSequenceQuantificationDiagram(modelId);
  }

  // For Data Analysis
  @TypedRoute.Get("/data-analysis/:id")
  public async getSingleDataAnalysis(@TypedParam("id") modelId: number): Promise<DataAnalysis> {
    return this.nestedModelService.getSingleDataAnalysis(modelId);
  }

  // For Human Reliability Analysis
  @TypedRoute.Get("/human-reliability-analysis/:id")
  public async getSingleHumanReliabilityAnalysis(@TypedParam("id") modelId: number): Promise<HumanReliabilityAnalysis> {
    return this.nestedModelService.getSingleHumanReliabilityAnalysis(modelId);
  }

  // For Systems Analysis
  @TypedRoute.Get("/systems-analysis/:id")
  public async getSingleSystemsAnalysis(@TypedParam("id") modelId: number): Promise<SystemsAnalysis> {
    return this.nestedModelService.getSingleSystemsAnalysis(modelId);
  }

  // For Success Criteria
  @TypedRoute.Get("/success-criteria/:id")
  public async getSingleSuccessCriteria(@TypedParam("id") modelId: number): Promise<SuccessCriteria> {
    return this.nestedModelService.getSingleSuccessCriteria(modelId);
  }

  // For Event Sequence Analysis
  /**
   * returns a single model from the given collection
   * @param modelId - the id of the model to be retrieved
   * @returns a promise with the model with the given id
   */
  @TypedRoute.Get("/event-sequence-analysis/:id")
  public async getSingleEventSequenceAnalysis(@TypedParam("id") modelId: number): Promise<EventSequenceAnalysis> {
    if (typeof modelId === "number") {
      return this.eventSequenceAnalysisService.getSingleEventSequenceAnalysis(modelId);
    } else {
      return this.eventSequenceAnalysisService.getSingleEventSequenceAnalysisString(modelId);
    }
  }

  // For Operating State Analysis
  @TypedRoute.Get("/operating-state-analysis/:id")
  public async getSingleOperatingStateAnalysis(@TypedParam("id") modelId: number): Promise<OperatingStateAnalysis> {
    return this.nestedModelService.getSingleOperatingStateAnalysis(modelId);
  }

  //delete endpoints

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @TypedRoute.Delete("/bayesian-estimations/")
  public async deleteBayesianEstimation(@TypedQuery() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteBayesianEstimation(query.id);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @TypedRoute.Delete("/bayesian-networks/")
  public async deleteBayesianNetwork(@TypedQuery() query: { id: string; typedModel: TypedModelType }): Promise<void> {
    await this.bayesianNetworkService.deleteBayesianNetwork(query.id, query.typedModel);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @TypedRoute.Delete("/event-sequence-diagrams/")
  public async deleteEventSequenceDiagram(
    @TypedQuery() query: { id: string; typedModel: TypedModelType },
  ): Promise<void> {
    await this.eventSequenceDiagramService.deleteEventSequenceDiagram(query.id, query.typedModel);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @TypedRoute.Delete("/event-trees/")
  public async deleteEventTree(@TypedQuery() query: { id: string; typedModel: TypedModelType }): Promise<void> {
    await this.eventTreeService.deleteEventTree(query.id, query.typedModel);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @TypedRoute.Delete("/fault-trees/")
  public async deleteFaultTree(@TypedQuery() query: { id: string; typedModel: TypedModelType }): Promise<void> {
    await this.faultTreesService.deleteFaultTree(query.id, query.typedModel);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @TypedRoute.Delete("/heat-balance-fault-trees/")
  public async deleteHeatBalanceFaultTree(@TypedQuery() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteHeatBalanceFaultTree(query.id);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @TypedRoute.Delete("/functional-events/")
  public async deleteFunctionalEvent(@TypedQuery() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteFunctionalEvent(query.id);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @TypedRoute.Delete("/initiating-events/")
  public async deleteInitiatingEvent(@TypedQuery() query: { id: string; typedModel: TypedModelType }): Promise<void> {
    await this.initiatingEventsService.deleteInitiatingEvent(query.id, query.typedModel);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @TypedRoute.Delete("/markov-chains/")
  public async deleteMarkovChain(@TypedQuery() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteMarkovChain(query.id);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  @TypedRoute.Delete("/weibull-analysis/")
  public async deleteWeibullAnalysis(@TypedQuery() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteWeibullAnalysis(query.id);
  }

  // For Risk Integration
  @TypedRoute.Delete("/risk-integration/")
  public async deleteRiskIntegration(@TypedQuery() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteRiskIntegration(query.id);
  }

  // For Radiological Consequence Analysis
  @TypedRoute.Delete("/radiological-consequence-analysis/")
  public async deleteRadiologicalConsequenceAnalysis(@TypedQuery() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteRadiologicalConsequenceAnalysis(query.id);
  }

  // For Mechanistic Source Term
  @TypedRoute.Delete("/mechanistic-source-term/")
  public async deleteMechanisticSourceTerm(@TypedQuery() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteMechanisticSourceTerm(query.id);
  }

  // For Event Sequence Quantification Diagram
  @TypedRoute.Delete("/event-sequence-quantification-diagram/")
  public async deleteEventSequenceQuantificationDiagram(@TypedQuery() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteEventSequenceQuantificationDiagram(query.id);
  }

  // For Data Analysis
  @TypedRoute.Delete("/data-analysis/")
  public async deleteDataAnalysis(@TypedQuery() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteDataAnalysis(query.id);
  }

  // For Human Reliability Analysis
  @TypedRoute.Delete("/human-reliability-analysis/")
  public async deleteHumanReliabilityAnalysis(@TypedQuery() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteHumanReliabilityAnalysis(query.id);
  }

  // For Systems Analysis
  @TypedRoute.Delete("/systems-analysis/")
  public async deleteSystemsAnalysis(@TypedQuery() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteSystemsAnalysis(query.id);
  }

  // For Success Criteria
  @TypedRoute.Delete("/success-criteria/")
  public async deleteSuccessCriteria(@TypedQuery() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteSuccessCriteria(query.id);
  }

  /**
   * deletes a single nested model from the collection of that typed based on an id
   * @returns a promise with the deleted model
   * @param query
   */
  // For Event Sequence Analysis
  @TypedRoute.Delete("/event-sequence-analysis/")
  public async deleteEventSequenceAnalysis(
    @TypedQuery() query: { id: string; typedModel: TypedModelType },
  ): Promise<void> {
    return this.eventSequenceAnalysisService.deleteEventSequenceAnalysis(query.id, query.typedModel);
  }

  // For Operating State Analysis
  @TypedRoute.Delete("/operating-state-analysis/")
  public async deleteOperatingStateAnalysis(@TypedQuery() query: { id: number }): Promise<HttpStatus> {
    return this.nestedModelService.deleteOperatingStateAnalysis(query.id);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @TypedRoute.Patch("/bayesian-estimations/:id")
  public async updateBayesianEstimationLabel(
    @TypedParam("id") id: number,
    @TypedBody() data: Label,
  ): Promise<NestedModel> {
    return this.nestedModelService.updateBayesianEstimationLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @TypedRoute.Patch("/bayesian-networks/:id")
  public async updateBayesianNetworkLabel(
    @TypedParam("id") id: string,
    @TypedBody() data: Label,
  ): Promise<NestedModel> {
    return this.bayesianNetworkService.updateBayesianNetworkLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @TypedRoute.Patch("/event-sequence-diagrams/:id")
  public async updateEventSequenceDiagramLabel(
    @TypedParam("id") id: string,
    @TypedBody() data: Label,
  ): Promise<NestedModel> {
    return this.eventSequenceDiagramService.updateEventSequenceDiagramLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @TypedRoute.Patch("/event-trees/:id")
  public async updateEventTreeLabel(@TypedParam("id") id: string, @TypedBody() data: Label): Promise<NestedModel> {
    return this.eventTreeService.updateEventTreeLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @TypedRoute.Patch("/fault-trees/:id")
  public async updateFaultTreeLabel(@TypedParam("id") id: string, @TypedBody() data: Label): Promise<NestedModel> {
    return this.faultTreesService.updateFaultTreeLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @TypedRoute.Patch("/heat-balance-fault-trees/:id")
  public async updateHeatBalanceFaultTreeLabel(
    @TypedParam("id") id: number,
    @TypedBody() data: Label,
  ): Promise<NestedModel> {
    return this.nestedModelService.updateHeatBalanceFaultTreeLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @TypedRoute.Patch("/functional-events/:id")
  public async updateFunctionalEventLabel(
    @TypedParam("id") id: number,
    @TypedBody() data: Label,
  ): Promise<NestedModel> {
    return this.nestedModelService.updateFunctionalEventLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @TypedRoute.Patch("/initiating-events/:id")
  public async updateInitiatingEventLabel(
    @TypedParam("id") id: string,
    @TypedBody() data: Label,
  ): Promise<NestedModel> {
    return this.initiatingEventsService.updateInitiatingEventLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @TypedRoute.Patch("/markov-chains/:id")
  public async updateMarkovChainLabel(@TypedParam("id") id: number, @TypedBody() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateMarkovChainLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  @TypedRoute.Patch("/weibull-analysis/:id")
  public async updateWeibullAnalysisLabel(
    @TypedParam("id") id: number,
    @TypedBody() data: Label,
  ): Promise<NestedModel> {
    return this.nestedModelService.updateWeibullAnalysisLabel(id, data);
  }

  // For Risk Integration
  @TypedRoute.Patch("/risk-integration/:id")
  public async updateRiskIntegrationLabel(
    @TypedParam("id") id: number,
    @TypedBody() data: Label,
  ): Promise<RiskIntegration> {
    return this.nestedModelService.updateRiskIntegrationLabel(id, data);
  }

  // For Radiological Consequence Analysis
  @TypedRoute.Patch("/radiological-consequence-analysis/:id")
  public async updateRadiologicalConsequenceAnalysisLabel(
    @TypedParam("id") id: number,
    @TypedBody() data: Label,
  ): Promise<RadiologicalConsequenceAnalysis> {
    return this.nestedModelService.updateRadiologicalConsequenceAnalysisLabel(id, data);
  }

  // For Mechanistic Source Term
  @TypedRoute.Patch("/mechanistic-source-term/:id")
  public async updateMechanisticSourceTermLabel(
    @TypedParam("id") id: number,
    @TypedBody() data: Label,
  ): Promise<MechanisticSourceTerm> {
    return this.nestedModelService.updateMechanisticSourceTermLabel(id, data);
  }

  // For Event Sequence Quantification Diagram
  @TypedRoute.Patch("/event-sequence-quantification-diagram/:id")
  public async updateEventSequenceQuantificationDiagramLabel(
    @TypedParam("id") id: number,
    @TypedBody() data: Label,
  ): Promise<EventSequenceQuantificationDiagram> {
    return this.nestedModelService.updateEventSequenceQuantificationDiagramLabel(id, data);
  }

  // For Data Analysis
  @TypedRoute.Patch("/data-analysis/:id")
  public async updateDataAnalysisLabel(@TypedParam("id") id: number, @TypedBody() data: Label): Promise<DataAnalysis> {
    return this.nestedModelService.updateDataAnalysisLabel(id, data);
  }

  // For Human Reliability Analysis
  @TypedRoute.Patch("/human-reliability-analysis/:id")
  public async updateHumanReliabilityAnalysisLabel(
    @TypedParam("id") id: number,
    @TypedBody() data: Label,
  ): Promise<HumanReliabilityAnalysis> {
    return this.nestedModelService.updateHumanReliabilityAnalysisLabel(id, data);
  }

  // For Systems Analysis
  @TypedRoute.Patch("/systems-analysis/:id")
  public async updateSystemsAnalysisLabel(
    @TypedParam("id") id: number,
    @TypedBody() data: Label,
  ): Promise<SystemsAnalysis> {
    return this.nestedModelService.updateSystemsAnalysisLabel(id, data);
  }

  // For Success Criteria
  @TypedRoute.Patch("/success-criteria/:id")
  public async updateSuccessCriteriaLabel(
    @TypedParam("id") id: number,
    @TypedBody() data: Label,
  ): Promise<SuccessCriteria> {
    return this.nestedModelService.updateSuccessCriteriaLabel(id, data);
  }

  /**
   * updates a label for the nested model type
   * @param id the id of the nested model to be updated
   * @param data the new label, with a name and description string
   * @returns the updated model
   */
  // For Event Sequence Analysis
  @TypedRoute.Patch("/event-sequence-analysis/:id")
  public async updateEventSequenceAnalysisLabel(
    @TypedParam("id") id: string,
    @TypedBody() data: Label,
  ): Promise<NestedModel> {
    return this.eventSequenceAnalysisService.updateEventSequenceAnalysisLabel(id, data);
  }

  // For Operating State Analysis
  @TypedRoute.Patch("/operating-state-analysis/:id")
  public async updateOperatingStateAnalysisLabel(
    @TypedParam("id") id: number,
    @TypedBody() data: Label,
  ): Promise<OperatingStateAnalysis> {
    return this.nestedModelService.updateOperatingStateAnalysisLabel(id, data);
  }

  // removes parent ids

  /**
   * removes parentId from all nested models. If the model has no parentIds it is removed
   * @returns a promise with the number of totally deleted nested models
   * @param query
   */
  @TypedRoute.Delete()
  public async removeParentIds(@TypedQuery() query: { modelId: number }): Promise<number> {
    return this.nestedModelService.removeParentModels(query.modelId);
  }
}
