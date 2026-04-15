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
import { ComponentParameter } from "./schemas/component-parameter.schema";
import { CreateComponentParameterDto, UpdateComponentParameterDto } from "./dto/component-parameter.dto";
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

  @Get()
  async getCounterPastValue(): Promise<number> {
    return await this.nestedModelService.getValue("nestedCounter");
  }

  @Post("/bayesian-estimations/")
  async createBayesianEstimation(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createBayesianEstimation(data);
  }

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

  async createBayesianNetwowrk(
    body: { data: Partial<NestedModel>; typedModel: TypedModelType } | Partial<NestedModel>,
  ): Promise<NestedModel> {
    return this.createBayesianNetwork(body);
  }

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

  @Post("/fault-trees/")
  async createFaultTree(
    @Body() body: { data: Partial<NestedModel>; typedModel: TypedModelType } | Partial<NestedModel>,
  ): Promise<NestedModel> {
    const hasTypedModel = (v: unknown): v is { data: Partial<NestedModel>; typedModel: TypedModelType } =>
      typeof v === "object" && v !== null && "typedModel" in (v as Record<string, unknown>);
    if (hasTypedModel(body)) {
      return this.faultTreesService.createFaultTree(body.data);
    }
    return this.nestedModelService.createFaultTree(body as Partial<NestedModel>);
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
    @Body() body: { data: Partial<NestedModel>; typedModel: TypedModelType } | Partial<NestedModel>,
  ): Promise<NestedModel> {
    const hasTypedModel = (v: unknown): v is { data: Partial<NestedModel>; typedModel: TypedModelType } =>
      typeof v === "object" && v !== null && "typedModel" in (v as Record<string, unknown>);
    if (hasTypedModel(body)) {
      return this.initiatingEventsService.createInitiatingEvent(body.data, body.typedModel);
    }
    return this.nestedModelService.createInitiatingEvent(body as Partial<NestedModel>);
  }

  @Post("/markov-chains/")
  async createMarkovChain(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createMarkovChain(data);
  }

  @Post("/weibull-analysis/")
  async createWeibullAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createWeibullAnalysis(data);
  }

  @Post("/risk-integration/")
  async createRiskIntegration(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createRiskIntegration(data);
  }

  @Post("/radiological-consequence-analysis/")
  async createRadiologicalConsequenceAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createRadiologicalConsequenceAnalysis(data);
  }

  @Post("/mechanistic-source-term/")
  async createMechanisticSourceTerm(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createMechanisticSourceTerm(data);
  }

  @Post("/event-sequence-quantification-diagram/")
  async createEventSequenceQuantificationDiagram(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createEventSequenceQuantificationDiagram(data);
  }

  @Post("/data-analysis/")
  async createDataAnalysis(
    @Body() body: { data: Partial<NestedModel>; typedModel?: string } | Partial<NestedModel>,
  ): Promise<NestedModel> {
    const hasWrapper = (v: unknown): v is { data: Partial<NestedModel>; typedModel?: string } =>
      typeof v === "object" && v !== null && "data" in (v as Record<string, unknown>);
    const data = hasWrapper(body) ? body.data : body;
    return this.nestedModelService.createDataAnalysis(data);
  }

  @Post("/human-reliability-analysis/")
  async createHumanReliabilityAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createHumanReliabilityAnalysis(data);
  }

  @Post("/systems-analysis/")
  async createSystemsAnalysis(
    @Body() body: { data: Partial<NestedModel>; typedModel?: string } | Partial<NestedModel>,
  ): Promise<NestedModel> {
    const hasWrapper = (v: unknown): v is { data: Partial<NestedModel>; typedModel?: string } =>
      typeof v === "object" && v !== null && "data" in (v as Record<string, unknown>);
    const data = hasWrapper(body) ? body.data : body;
    return this.nestedModelService.createSystemsAnalysis(data);
  }

  @Post("/success-criteria/")
  async createSuccessCriteria(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createSuccessCriteria(data);
  }

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

  @Post("/operating-state-analysis/")
  async createOperatingStateAnalysis(@Body() data: Partial<NestedModel>): Promise<NestedModel> {
    return this.nestedModelService.createOperatingStateAnalysis(data);
  }

  @Get("/bayesian-estimations/")
  async getBayesianEstimations(@Query("id") id: number): Promise<BayesianEstimation[]> {
    return this.nestedModelService.getBayesianEstimations(id);
  }

  @Get("/bayesian-networks/")
  async getBayesianNetworks(@Query("id") id: string): Promise<EventSequenceDiagram[]> {
    const numericId = Number(id);
    if (!isNaN(numericId)) {
      return this.nestedModelService.getBayesianNetworks(numericId);
    }
    return this.bayesianNetworkService.getBayesianNetworkString(id);
  }

  @Get("/event-sequence-diagrams/")
  async getEventSequenceDiagrams(@Query("id") id: string): Promise<EventSequenceDiagram[]> {
    const numericId = Number(id);
    if (!isNaN(numericId)) {
      return this.nestedModelService.getEventSequenceDiagrams(numericId);
    }
    return this.eventSequenceDiagramService.getEventSequenceDiagramsString(id);
  }

  @Get("/event-trees/")
  async getEventTrees(@Query("id") id: string): Promise<EventSequenceDiagram[]> {
    const numericId = Number(id);
    if (!isNaN(numericId)) {
      return this.nestedModelService.getEventTrees(numericId);
    }
    return this.eventTreeService.getEventTreesString(id);
  }

  @Get("/fault-trees/")
  async getFaultTrees(@Query("id") id: string): Promise<FaultTree[]> {
    const numericId = Number(id);
    if (!isNaN(numericId)) {
      return this.nestedModelService.getFaultTrees(numericId);
    }
    return this.faultTreesService.getFaultTreeString(id);
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
  async getInitiatingEvents(@Query("id") id: string): Promise<InitiatingEvent[]> {
    const numericId = Number(id);
    if (!isNaN(numericId)) {
      return this.initiatingEventsService.getInitiatingEvents(numericId);
    }
    return this.initiatingEventsService.getInitiatingEventsString(id);
  }

  @Get("/markov-chains/")
  async getMarkovChains(@Query("id") id: number): Promise<MarkovChain[]> {
    return this.nestedModelService.getMarkovChains(id);
  }

  @Get("/weibull-analysis/")
  async getWeibullAnalysis(@Query("id") id: number): Promise<WeibullAnalysis[]> {
    return this.nestedModelService.getWeibullAnalysis(id);
  }

  @Get("/risk-integration/")
  async getRiskIntegration(@Query("id") id: number): Promise<RiskIntegration[]> {
    return this.nestedModelService.getRiskIntegration(id);
  }

  @Get("/radiological-consequence-analysis/")
  async getRadiologicalConsequenceAnalysis(@Query("id") id: number): Promise<RadiologicalConsequenceAnalysis[]> {
    return this.nestedModelService.getRadiologicalConsequenceAnalysis(id);
  }

  @Get("/mechanistic-source-term/")
  async getMechanisticSourceTerm(@Query("id") id: number): Promise<MechanisticSourceTerm[]> {
    return this.nestedModelService.getMechanisticSourceTerm(id);
  }

  @Get("/event-sequence-quantification-diagram/")
  async getEventSequenceQuantificationDiagram(@Query("id") id: number): Promise<EventSequenceQuantificationDiagram[]> {
    return this.nestedModelService.getEventSequenceQuantificationDiagram(id);
  }

  @Get("/data-analysis/")
  async getDataAnalysis(@Query("id") id: number): Promise<DataAnalysis[]> {
    return this.nestedModelService.getDataAnalysis(id);
  }

  @Get("/human-reliability-analysis/")
  async getHumanReliabilityAnalysis(@Query("id") id: number): Promise<HumanReliabilityAnalysis[]> {
    return this.nestedModelService.getHumanReliabilityAnalysis(id);
  }

  @Get("/systems-analysis/")
  async getSystemsAnalysis(@Query("id") id: number): Promise<SystemsAnalysis[]> {
    return this.nestedModelService.getSystemsAnalysis(id);
  }

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
      return this.nestedModelService.getSingleBayesianNetwork(modelId as number);
    } else {
      return this.bayesianNetworkService.getSingleBayesianNetworkString(modelId);
    }
  }

  @Get("/event-sequence-diagrams/:id")
  async getSingleEventSequenceDiagram(@Param("id") modelId: number | string): Promise<EventSequenceDiagram> {
    if (typeof modelId === "number") {
      return this.nestedModelService.getSingleEventSequenceDiagram(modelId as number);
    } else {
      return this.eventSequenceDiagramService.getSingleEventSequenceDiagramString(modelId);
    }
  }

  @Get("/event-trees/:id")
  async getSingleEventTree(@Param("id") modelId: number | string): Promise<EventTree> {
    if (typeof modelId === "number") {
      return this.nestedModelService.getSingleEventTree(modelId as number);
    } else {
      return this.eventTreeService.getSingleEventTreeString(modelId);
    }
  }

  @Get("/fault-trees/:id")
  async getSingleFaultTree(@Param("id") modelId: number | string): Promise<EventTree> {
    if (typeof modelId === "number") {
      return this.nestedModelService.getSingleFaultTree(modelId as number);
    } else {
      return this.faultTreesService.getSingleFaultTreeString(modelId);
    }
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
    if (typeof modelId === "number") {
      return this.nestedModelService.getSingleInitiatingEvent(modelId as number);
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

  @Get("/risk-integration/:id")
  async getSingleRiskIntegration(@Param("id") modelId: number): Promise<RiskIntegration> {
    return this.nestedModelService.getSingleRiskIntegration(modelId);
  }

  @Get("/radiological-consequence-analysis/:id")
  async getSingleRadiologicalConsequenceAnalysis(
    @Param("id") modelId: number,
  ): Promise<RadiologicalConsequenceAnalysis> {
    return this.nestedModelService.getSingleRadiologicalConsequenceAnalysis(modelId);
  }

  @Get("/mechanistic-source-term/:id")
  async getSingleMechanisticSourceTerm(@Param("id") modelId: number): Promise<MechanisticSourceTerm> {
    return this.nestedModelService.getSingleMechanisticSourceTerm(modelId);
  }

  @Get("/event-sequence-quantification-diagram/:id")
  async getSingleEventSequenceQuantificationDiagram(
    @Param("id") modelId: number,
  ): Promise<EventSequenceQuantificationDiagram> {
    return this.nestedModelService.getSingleEventSequenceQuantificationDiagram(modelId);
  }

  @Get("/data-analysis/:id")
  async getSingleDataAnalysis(@Param("id") modelId: number): Promise<DataAnalysis> {
    return this.nestedModelService.getSingleDataAnalysis(modelId);
  }

  @Get("/human-reliability-analysis/:id")
  async getSingleHumanReliabilityAnalysis(@Param("id") modelId: number): Promise<HumanReliabilityAnalysis> {
    return this.nestedModelService.getSingleHumanReliabilityAnalysis(modelId);
  }

  @Get("/systems-analysis/:id")
  async getSingleSystemsAnalysis(@Param("id") modelId: number): Promise<SystemsAnalysis> {
    return this.nestedModelService.getSingleSystemsAnalysis(modelId);
  }

  @Get("/success-criteria/:id")
  async getSingleSuccessCriteria(@Param("id") modelId: number): Promise<SuccessCriteria> {
    return this.nestedModelService.getSingleSuccessCriteria(modelId);
  }

  @Get("/event-sequence-analysis/:id")
  async getSingleEventSequenceAnalysis(@Param("id") modelId: number): Promise<EventSequenceAnalysis> {
    if (typeof modelId === "number") {
      return this.nestedModelService.getSingleEventSequenceAnalysis(modelId as number);
    } else {
      return this.eventSequenceAnalysisService.getSingleEventSequenceAnalysisString(modelId as unknown as string);
    }
  }

  @Get("/operating-state-analysis/:id")
  async getSingleOperatingStateAnalysis(@Param("id") modelId: number): Promise<OperatingStateAnalysis> {
    return this.nestedModelService.getSingleOperatingStateAnalysis(modelId);
  }

  @Delete("/bayesian-estimations/")
  async deleteBayesianEstimation(@Query("id") id: number): Promise<BayesianEstimation> {
    return this.nestedModelService.deleteBayesianEstimation(id);
  }

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

  @Delete("/event-trees/")
  async deleteEventTree(@Query("id") id: string | number, @Query("type") typedModel?: TypedModelType): Promise<any> {
    if (typeof id === "number") {
      return this.nestedModelService.deleteEventTree(id);
    }
    await this.eventTreeService.deleteEventTree(id, typedModel as TypedModelType);
  }

  @Delete("/fault-trees/")
  async deleteFaultTree(@Query("id") id: string | number): Promise<any> {
    if (typeof id === "number") {
      return this.nestedModelService.deleteFaultTree(id);
    }
    await this.faultTreesService.deleteFaultTree(id as string);
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
  async deleteInitiatingEvent(
    @Query("id") id: string | number,
    @Query("type") typedModel?: TypedModelType,
  ): Promise<any> {
    if (typeof id === "number") {
      return this.nestedModelService.deleteInitiatingEvent(id);
    }
    await this.initiatingEventsService.deleteInitiatingEvent(id, typedModel as TypedModelType);
  }

  @Delete("/markov-chains/")
  async deleteMarkovChain(@Query("id") id: number): Promise<MarkovChain> {
    return this.nestedModelService.deleteMarkovChain(id);
  }

  @Delete("/weibull-analysis/")
  async deleteWeibullAnalysis(@Query("id") id: number): Promise<WeibullAnalysis> {
    return this.nestedModelService.deleteWeibullAnalysis(id);
  }

  @Delete("/risk-integration/")
  async deleteRiskIntegration(@Query("id") id: number): Promise<RiskIntegration> {
    return this.nestedModelService.deleteRiskIntegration(id);
  }

  @Delete("/radiological-consequence-analysis/")
  async deleteRadiologicalConsequenceAnalysis(@Query("id") id: number): Promise<RadiologicalConsequenceAnalysis> {
    return this.nestedModelService.deleteRadiologicalConsequenceAnalysis(id);
  }

  @Delete("/mechanistic-source-term/")
  async deleteMechanisticSourceTerm(@Query("id") id: number): Promise<MechanisticSourceTerm> {
    return this.nestedModelService.deleteMechanisticSourceTerm(id);
  }

  @Delete("/event-sequence-quantification-diagram/")
  async deleteEventSequenceQuantificationDiagram(@Query("id") id: number): Promise<EventSequenceQuantificationDiagram> {
    return this.nestedModelService.deleteEventSequenceQuantificationDiagram(id);
  }

  @Delete("/data-analysis/")
  async deleteDataAnalysis(@Query("id") id: number): Promise<DataAnalysis> {
    return this.nestedModelService.deleteDataAnalysis(id);
  }

  @Delete("/human-reliability-analysis/")
  async deleteHumanReliabilityAnalysis(@Query("id") id: number): Promise<HumanReliabilityAnalysis> {
    return this.nestedModelService.deleteHumanReliabilityAnalysis(id);
  }

  @Delete("/systems-analysis/")
  async deleteSystemsAnalysis(@Query("id") id: number): Promise<SystemsAnalysis> {
    return this.nestedModelService.deleteSystemsAnalysis(id);
  }

  @Delete("/success-criteria/")
  async deleteSuccessCriteria(@Query("id") id: number): Promise<SuccessCriteria> {
    return this.nestedModelService.deleteSuccessCriteria(id);
  }

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

  @Delete("/operating-state-analysis/")
  async deleteOperatingStateAnalysis(@Query("id") id: number): Promise<OperatingStateAnalysis> {
    return this.nestedModelService.deleteOperatingStateAnalysis(id);
  }

  @Patch("/bayesian-estimations/:id")
  async updateBayesianEstimationLabel(@Param("id") id: number, @Body() data: Label): Promise<NestedModel> {
    return this.nestedModelService.updateBayesianEstimationLabel(id, data);
  }

  @Patch("/bayesian-networks/:id")
  async updateBayesianNetworkLabel(@Param("id") id: string | number, @Body() data: Label): Promise<NestedModel> {
    if (typeof id === "number") return this.nestedModelService.updateBayesianNetworkLabelNumber(id, data);
    return this.bayesianNetworkService.updateBayesianNetworkLabel(id, data);
  }

  @Patch("/event-sequence-diagrams/:id")
  async updateEventSequenceDiagramLabel(@Param("id") id: string | number, @Body() data: Label): Promise<NestedModel> {
    if (typeof id === "number") return this.nestedModelService.updateEventSequenceDiagramLabelNumber(id, data);
    return this.eventSequenceDiagramService.updateEventSequenceDiagramLabel(id, data);
  }

  @Patch("/event-trees/:id")
  async updateEventTreeLabel(@Param("id") id: string | number, @Body() data: Label): Promise<NestedModel> {
    if (typeof id === "number") return this.nestedModelService.updateEventTreeLabelNumber(id, data);
    return this.eventTreeService.updateEventTreeLabel(id, data);
  }

  @Patch("/fault-trees/:id")
  async updateFaultTreeLabel(@Param("id") id: string | number, @Body() data: Label): Promise<NestedModel> {
    if (typeof id === "number") return this.nestedModelService.updateFaultTreeLabelNumber(id, data);
    return this.faultTreesService.updateFaultTreeLabel(id, data);
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
  async updateInitiatingEventLabel(@Param("id") id: string | number, @Body() data: Label): Promise<NestedModel> {
    if (typeof id === "number") return this.nestedModelService.updateInitiatingEventLabelNumber(id, data);
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

  @Patch("/risk-integration/:id")
  async updateRiskIntegrationLabel(@Param("id") id: number, @Body() data: Label): Promise<RiskIntegration> {
    return this.nestedModelService.updateRiskIntegrationLabel(id, data);
  }

  @Patch("/radiological-consequence-analysis/:id")
  async updateRadiologicalConsequenceAnalysisLabel(
    @Param("id") id: number,
    @Body() data: Label,
  ): Promise<RadiologicalConsequenceAnalysis> {
    return this.nestedModelService.updateRadiologicalConsequenceAnalysisLabel(id, data);
  }

  @Patch("/mechanistic-source-term/:id")
  async updateMechanisticSourceTermLabel(@Param("id") id: number, @Body() data: Label): Promise<MechanisticSourceTerm> {
    return this.nestedModelService.updateMechanisticSourceTermLabel(id, data);
  }

  @Patch("/event-sequence-quantification-diagram/:id")
  async updateEventSequenceQuantificationDiagramLabel(
    @Param("id") id: number,
    @Body() data: Label,
  ): Promise<EventSequenceQuantificationDiagram> {
    return this.nestedModelService.updateEventSequenceQuantificationDiagramLabel(id, data);
  }

  @Patch("/data-analysis/:id")
  async updateDataAnalysisLabel(@Param("id") id: number, @Body() data: Label): Promise<DataAnalysis> {
    return this.nestedModelService.updateDataAnalysisLabel(id, data);
  }

  @Post("/data-analysis/:dataAnalysisId/parameters")
  async createComponentParameter(
    @Param("dataAnalysisId") dataAnalysisId: number,
    @Body() body: CreateComponentParameterDto,
  ): Promise<ComponentParameter> {
    return this.nestedModelService.createComponentParameter(Number(dataAnalysisId), body);
  }

  @Get("/data-analysis/:dataAnalysisId/parameters")
  async getComponentParameters(@Param("dataAnalysisId") dataAnalysisId: number): Promise<ComponentParameter[]> {
    return this.nestedModelService.getComponentParameters(Number(dataAnalysisId));
  }

  @Patch("/data-analysis/parameters/:paramId")
  async updateComponentParameter(
    @Param("paramId") paramId: number,
    @Body() body: UpdateComponentParameterDto,
  ): Promise<ComponentParameter> {
    return this.nestedModelService.updateComponentParameter(Number(paramId), body);
  }

  @Delete("/data-analysis/parameters/:paramId")
  async deleteComponentParameter(@Param("paramId") paramId: number): Promise<ComponentParameter> {
    return this.nestedModelService.deleteComponentParameter(Number(paramId));
  }

  @Patch("/human-reliability-analysis/:id")
  async updateHumanReliabilityAnalysisLabel(
    @Param("id") id: number,
    @Body() data: Label,
  ): Promise<HumanReliabilityAnalysis> {
    return this.nestedModelService.updateHumanReliabilityAnalysisLabel(id, data);
  }

  @Patch("/systems-analysis/:id")
  async updateSystemsAnalysisLabel(@Param("id") id: number, @Body() data: Label): Promise<SystemsAnalysis> {
    return this.nestedModelService.updateSystemsAnalysisLabel(id, data);
  }

  @Patch("/success-criteria/:id")
  async updateSuccessCriteriaLabel(@Param("id") id: number, @Body() data: Label): Promise<SuccessCriteria> {
    return this.nestedModelService.updateSuccessCriteriaLabel(id, data);
  }

  @Patch("/event-sequence-analysis/:id")
  async updateEventSequenceAnalysisLabel(@Param("id") id: string | number, @Body() data: Label): Promise<NestedModel> {
    if (typeof id === "number") return this.nestedModelService.updateEventSequenceAnalysisLabelNumber(id, data);
    return this.eventSequenceAnalysisService.updateEventSequenceAnalysisLabel(id, data);
  }

  @Patch("/operating-state-analysis/:id")
  async updateOperatingStateAnalysisLabel(
    @Param("id") id: number,
    @Body() data: Label,
  ): Promise<OperatingStateAnalysis> {
    return this.nestedModelService.updateOperatingStateAnalysisLabel(id, data);
  }

  @Delete()
  async removeParentIds(@Query("id") modelId: number | string): Promise<number> {
    const idNum = typeof modelId === "string" ? Number(modelId) : modelId;
    return this.nestedModelService.removeParentModels(idNum);
  }
}
