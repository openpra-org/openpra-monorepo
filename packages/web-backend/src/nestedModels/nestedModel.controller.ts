import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Label } from "../schemas/label.schema";
import { NestedModelService } from "./nestedModel.service";
import { FaultTreesService } from "./NestedModelsHelpers/fault-trees.service";
import { FaultTree } from "./schemas/fault-tree.schema";
import { NestedModel } from "./schemas/templateSchema/nested-model.schema";
import { BayesianEstimation } from "./schemas/bayesian-estimation.schema";
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

@Controller()
export class NestedModelController {
  constructor(
    private readonly nestedModelService: NestedModelService,
    private readonly faultTreesService: FaultTreesService,
    private readonly initiatingEventsService: InitiatingEventsService,
    private readonly eventSequenceDiagramService: EventSequenceDiagramService,
    private readonly eventSequenceAnalysisService: EventSequenceAnalysisService,
    private readonly eventTreeService: EventTreesService,
    private readonly bayesianNetworkService: BayesianNetworksService,
  ) {}

  //method to get counter value

  @Get()
  async getCounterPastValue(): Promise<number> {
    return await this.nestedModelService.getValue("nestedCounter");
  }

  //POST methods
  @Post("/bayesian-estimations/")
  async createBayesianEstimation(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createBayesianEstimation(data);
  }

  @Post("/bayesian-networks/")
  async createBayesianNetwork(
    @Body() body: { data: Partial<NestedModel>; typedModel: TypedModelType },
  ): Promise<NestedModel> {
    return this.bayesianNetworkService.createBayesianNetwork(body.data, body.typedModel);
  }

  @Post("/event-sequence-diagrams/")
  async createEventSequenceDiagram(
    @Body() body: { data: Partial<NestedModel>; typedModel: TypedModelType },
  ): Promise<NestedModel> {
    return this.eventSequenceDiagramService.createEventSequenceDiagram(body.data, body.typedModel);
  }

  @Post("/event-trees/")
  async createEventTree(
    @Body() body: { data: Partial<NestedModel>; typedModel: TypedModelType },
  ): Promise<NestedModel> {
    return this.eventTreeService.createEventTree(body.data, body.typedModel);
  }

  // Create a new fault tree
  @Post("/api/fault-trees")
  async createFaultTree(@Body() data: Omit<FaultTree, "id">): Promise<FaultTree> {
    return this.faultTreesService.createFaultTree(data);
  }

  @Post("/heat-balance-fault-trees/")
  async createHeatBalanceFaultTree(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createHeatBalanceFaultTree(data);
  }

  @Post("/functional-events/")
  async createFunctionalEvent(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createFunctionalEvent(data);
  }

  @Post("/initiating-events/")
  async createInitiatingEvent(
    @Body() body: { data: Partial<NestedModel>; typedModel: TypedModelType },
  ): Promise<NestedModel> {
    return this.initiatingEventsService.createInitiatingEvent(body.data, body.typedModel);
  }

  @Post("/markov-chains/")
  async createMarkovChain(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createMarkovChain(data);
  }

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

  // For Event Sequence Analysis
  @Post("/event-sequence-analysis/")
  async createEventSequenceAnalysis(
    @Body() body: { data: Partial<NestedModel>; typedModel: TypedModelType },
  ): Promise<NestedModel> {
    return this.eventSequenceAnalysisService.createEventSequenceAnalysis(body.data, body.typedModel);
  }

  // For Operating State Analysis
  @Post("/operating-state-analysis/")
  async createOperatingStateAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createOperatingStateAnalysis(data);
  }

  //GET collection methods
  @Get("/bayesian-estimations/")
  async getBayesianEstimations(@Query("id") id: number): Promise<BayesianEstimation[]> {
    return this.nestedModelService.getBayesianEstimations(id);
  }

  @Get("/bayesian-networks/")
  async getBayesianNetworks(@Query("id") id: number | string): Promise<EventSequenceDiagram[]> {
    if (typeof id === "number") {
      return this.bayesianNetworkService.getBayesianNetwork(id);
    } else {
      return this.bayesianNetworkService.getBayesianNetworkString(id);
    }
  }

  @Get("/event-sequence-diagrams/")
  async getEventSequenceDiagrams(@Query("id") id: number | string): Promise<EventSequenceDiagram[]> {
    if (typeof id === "number") {
      return this.eventSequenceDiagramService.getEventSequenceDiagrams(id);
    } else {
      return this.eventSequenceDiagramService.getEventSequenceDiagramsString(id);
    }
  }

  @Get("/event-trees/")
  async getEventTrees(@Query("id") id: number | string): Promise<EventSequenceDiagram[]> {
    if (typeof id === "number") {
      return this.eventTreeService.getEventTrees(id);
    } else {
      return this.eventTreeService.getEventTreesString(id);
    }
  }

  // Get all fault trees for a model
  @Get("/api/fault-trees")
  async getFaultTrees(@Query("modelId") modelId: string): Promise<FaultTree[]> {
    return this.faultTreesService.getFaultTreesByModelId(modelId);
  }

  @Get("/heat-balance-fault-trees/")
  async getHeatBalanceFaultTrees(@Query("id") id: number): Promise<HeatBalanceFaultTree[]> {
    return this.nestedModelService.getHeatBalanceFaultTrees(id);
  }

  @Get("/functional-events/")
  async getFunctionalEvents(@Query("id") id: number): Promise<FunctionalEvent[]> {
    return this.nestedModelService.getFunctionalEvents(id);
  }

  @Get("/initiating-events/")
  async getInitiatingEvents(@Query("id") id: number | string): Promise<InitiatingEvent[]> {
    if (typeof id === "number") {
      return this.initiatingEventsService.getInitiatingEvents(id);
    } else {
      return this.initiatingEventsService.getInitiatingEventsString(id);
    }
  }

  @Get("/markov-chains/")
  async getMarkovChains(@Query("id") id: number): Promise<MarkovChain[]> {
    return this.nestedModelService.getMarkovChains(id);
  }

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

  @Get("/event-sequence-analysis/")
  async getEventSequenceAnalysis(@Query("id") id: number): Promise<EventSequenceAnalysis[]> {
    if (typeof id === "number") {
      return this.eventSequenceAnalysisService.getEventSequenceAnalysis(id);
    } else {
      return this.eventSequenceAnalysisService.getEventSequenceAnalysisString(id);
    }
  }

  @Get("/operating-state-analysis/")
  async getOperatingStateAnalysis(@Query("id") id: number): Promise<OperatingStateAnalysis[]> {
    return this.nestedModelService.getOperatingStateAnalysis(id);
  }

  @Get("/bayesian-estimations/:id")
  async getSingleBayesianEstimation(@Param("id") modelId: number): Promise<BayesianEstimation> {
    return this.nestedModelService.getSingleBayesianEstimation(modelId);
  }

  @Get("/bayesian-networks/:id")
  async getSingleBayesianNetwork(@Param("id") modelId: number | string): Promise<EventSequenceDiagram> {
    if (typeof modelId === "number") {
      return this.bayesianNetworkService.getSingleBayesianNetwork(modelId);
    } else {
      return this.bayesianNetworkService.getSingleBayesianNetworkString(modelId);
    }
  }

  @Get("/event-sequence-diagrams/:id")
  async getSingleEventSequenceDiagram(@Param("id") modelId: number | string): Promise<EventSequenceDiagram> {
    if (typeof modelId === "number") {
      return this.eventSequenceDiagramService.getSingleEventSequenceDiagram(modelId);
    } else {
      return this.eventSequenceDiagramService.getSingleEventSequenceDiagramString(modelId);
    }
  }

  @Get("/event-trees/:id")
  async getSingleEventTree(@Param("id") modelId: number | string): Promise<EventTree> {
    if (typeof modelId === "number") {
      return this.eventTreeService.getSingleEventTree(modelId);
    } else {
      return this.eventTreeService.getSingleEventTreeString(modelId);
    }
  }

  // Get a single fault tree by id
  @Get("/api/fault-trees")
  async getFaultTree(@Query("id") id: string): Promise<FaultTree> {
    return this.faultTreesService.getFaultTreeById(id);
  }

  @Get("/heat-balance-fault-trees/:id")
  async getSingleHeatBalanceFaultTree(@Param("id") modelId: number): Promise<HeatBalanceFaultTree> {
    return this.nestedModelService.getSingleHeatBalanceFaultTree(modelId);
  }

  @Get("/functional-events/:id")
  async getSingleFunctionalEvent(@Param("id") modelId: number): Promise<FunctionalEvent> {
    return this.nestedModelService.getSingleFunctionalEvent(modelId);
  }

  @Get("/initiating-events/:id")
  async getSingleInitiatingEvent(@Param("id") modelId: number | string): Promise<InitiatingEvent> {
    console.log(typeof modelId);
    if (typeof modelId === "number") {
      return this.initiatingEventsService.getSingleInitiatingEvent(modelId);
    } else {
      return this.initiatingEventsService.getSingleInitiatingEventString(modelId);
    }
  }

  @Get("/markov-chains/:id")
  async getSingleMarkovChain(@Param("id") modelId: number): Promise<MarkovChain> {
    return this.nestedModelService.getSingleMarkovChain(modelId);
  }

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

  @Get("/event-sequence-analysis/:id")
  async getSingleEventSequenceAnalysis(@Param("id") modelId: number): Promise<EventSequenceAnalysis> {
    if (typeof modelId === "number") {
      return this.eventSequenceAnalysisService.getSingleEventSequenceAnalysis(modelId);
    } else {
      return this.eventSequenceAnalysisService.getSingleEventSequenceAnalysisString(modelId);
    }
  }

  // For Operating State Analysis
  @Get("/operating-state-analysis/:id")
  async getSingleOperatingStateAnalysis(@Param("id") modelId: number): Promise<OperatingStateAnalysis> {
    return this.nestedModelService.getSingleOperatingStateAnalysis(modelId);
  }

  @Delete("/bayesian-estimations/")
  async deleteBayesianEstimation(@Query("id") id: number): Promise<BayesianEstimation> {
    return this.nestedModelService.deleteBayesianEstimation(id);
  }

  @Delete("/bayesian-networks/")
  async deleteBayesianNetwork(@Query("id") id: string, @Query("type") typedModel: TypedModelType): Promise<void> {
    await this.bayesianNetworkService.deleteBayesianNetwork(id, typedModel);
  }

  @Delete("/event-sequence-diagrams/")
  async deleteEventSequenceDiagram(@Query("id") id: string, @Query("type") typedModel: TypedModelType): Promise<void> {
    await this.eventSequenceDiagramService.deleteEventSequenceDiagram(id, typedModel);
  }

  @Delete("/event-trees/")
  async deleteEventTree(@Query("id") id: string, @Query("type") typedModel: TypedModelType): Promise<void> {
    await this.eventTreeService.deleteEventTree(id, typedModel);
  }

  // Delete a fault tree
  @Delete("/api/fault-trees")
  async deleteFaultTree(@Query("id") id: string): Promise<void> {
    return this.faultTreesService.deleteFaultTree(id);
  }

  @Delete("/heat-balance-fault-trees/")
  async deleteHeatBalanceFaultTree(@Query("id") id: number): Promise<HeatBalanceFaultTree> {
    return this.nestedModelService.deleteHeatBalanceFaultTree(id);
  }

  @Delete("/functional-events/")
  async deleteFunctionalEvent(@Query("id") id: number): Promise<FunctionalEvent> {
    return this.nestedModelService.deleteFunctionalEvent(id);
  }

  @Delete("/initiating-events/")
  async deleteInitiatingEvent(@Query("id") id: string, @Query("type") typedModel: TypedModelType): Promise<void> {
    await this.initiatingEventsService.deleteInitiatingEvent(id, typedModel);
  }

  @Delete("/markov-chains/")
  async deleteMarkovChain(@Query("id") id: number): Promise<MarkovChain> {
    return this.nestedModelService.deleteMarkovChain(id);
  }

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

  // For Event Sequence Analysis
  @Delete("/event-sequence-analysis/")
  async deleteEventSequenceAnalysis(@Query("id") id: string, @Query("type") typedModel: TypedModelType): Promise<void> {
    return this.eventSequenceAnalysisService.deleteEventSequenceAnalysis(id, typedModel);
  }

  // For Operating State Analysis
  @Delete("/operating-state-analysis/")
  async deleteOperatingStateAnalysis(@Query("id") id: number): Promise<OperatingStateAnalysis> {
    return this.nestedModelService.deleteOperatingStateAnalysis(id);
  }

  @Patch("/bayesian-estimations/:id")
  async updateBayesianEstimationLabel(@Param("id") id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateBayesianEstimationLabel(id, data);
  }

  @Patch("/bayesian-networks/:id")
  async updateBayesianNetworkLabel(@Param("id") id: string, @Body() data: Label): Promise<NestedModel> {
    return this.bayesianNetworkService.updateBayesianNetworkLabel(id, data);
  }

  @Patch("/event-sequence-diagrams/:id")
  async updateEventSequenceDiagramLabel(@Param("id") id: string, @Body() data: Label): Promise<NestedModel> {
    return this.eventSequenceDiagramService.updateEventSequenceDiagramLabel(id, data);
  }

  @Patch("/event-trees/:id")
  async updateEventTreeLabel(@Param("id") id: string, @Body() data: Label): Promise<NestedModel> {
    return this.eventTreeService.updateEventTreeLabel(id, data);
  }

  // Update fault tree metadata (name, description)
@Patch("/api/fault-trees/metadata")
async updateFaultTreeMetadata(
  @Query("id") id: string,
  @Body() data: Partial<Pick<FaultTree, "name" | "description">>
): Promise<FaultTree> {
  return this.faultTreesService.updateFaultTreeMetadata(id, data);
}

// Update fault tree graph
@Patch("/api/fault-trees/graph")
async updateFaultTreeGraph(
  @Query("id") id: string,
  @Body("graph") graph: FaultTree["graph"]
): Promise<FaultTree> {
  return this.faultTreesService.updateFaultTreeGraph(id, graph);
}

  @Patch("/heat-balance-fault-trees/:id")
  async updateHeatBalanceFaultTreeLabel(@Param("id") id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateHeatBalanceFaultTreeLabel(id, data);
  }

  @Patch("/functional-events/:id")
  async updateFunctionalEventLabel(@Param("id") id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateFunctionalEventLabel(id, data);
  }

  @Patch("/initiating-events/:id")
  async updateInitiatingEventLabel(@Param("id") id: string, @Body() data: Label): Promise<NestedModel> {
    return this.initiatingEventsService.updateInitiatingEventLabel(id, data);
  }

  @Patch("/markov-chains/:id")
  async updateMarkovChainLabel(@Param("id") id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateMarkovChainLabel(id, data);
  }

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

  // For Event Sequence Analysis
  @Patch("/event-sequence-analysis/:id")
  async updateEventSequenceAnalysisLabel(@Param("id") id: string, @Body() data: Label): Promise<NestedModel> {
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

  @Delete()
  async removeParentIds(@Query("modelId") modelId: number): Promise<number> {
    return this.nestedModelService.removeParentModels(modelId);
  }
}
