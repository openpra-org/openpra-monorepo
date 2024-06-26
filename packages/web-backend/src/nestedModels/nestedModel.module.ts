import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { NestedCounter, NestedCounterSchema } from "../schemas/tree-counter.schema";
import { GraphModelService } from "../graphModels/graphModel.service";
import {
  EventSequenceDiagramGraph,
  EventSequenceDiagramGraphSchema,
} from "../schemas/graphs/event-sequence-diagram-graph.schema";
import { FaultTreeGraph, FaultTreeGraphSchema } from "../schemas/graphs/fault-tree-graph.schema";
import { EventTreeGraph, EventTreeGraphSchema } from "../schemas/graphs/event-tree-graph.schema";
import { InternalEvents, InternalEventsSchema } from "../typedModel/schemas/internal-events.schema";
import { InternalHazards, InternalHazardsSchema } from "../typedModel/schemas/internal-hazards.schema";
import { ExternalHazards, ExternalHazardsSchema } from "../typedModel/schemas/external-hazards.schema";
import { FullScope, FullScopeSchema } from "../typedModel/schemas/full-scope.schema";
import { ModelCounter, ModelCounterSchema } from "../schemas/model-counter.schema";
import { NestedModelService } from "./nestedModel.service";
import { NestedModelController } from "./nestedModel.controller";
import { BayesianEstimation, BayesianEstimationSchema } from "./schemas/bayesian-estimation.schema";
import { EventSequenceDiagram, EventSequenceDiagramSchema } from "./schemas/event-sequence-diagram.schema";
import { EventTree, EventTreeSchema } from "./schemas/event-tree.schema";
import { FaultTree, FaultTreeSchema } from "./schemas/fault-tree.schema";
import { HeatBalanceFaultTree, HeatBalanceFaultTreeSchema } from "./schemas/heat-balance-fault-tree.schema";
import { InitiatingEvent, InitiatingEventSchema } from "./schemas/initiating-event.schema";
import { MarkovChain, MarkovChainSchema } from "./schemas/markov-chain.schema";
import { WeibullAnalysis, WeibullAnalysisSchema } from "./schemas/weibull-analysis.schema";
import { BayesianNetwork, BayesianNetworkSchema } from "./schemas/bayesian-network.schema";
import { FunctionalEvent, FunctionalEventSchema } from "./schemas/functional-event.schema";
import { RiskIntegration, RiskIntegrationSchema } from "./schemas/risk-integration.schema";
import {
  RadiologicalConsequenceAnalysis,
  RadiologicalConsequenceAnalysisSchema,
} from "./schemas/radiological-consequence-analysis.schema";
import { MechanisticSourceTerm, MechanisticSourceTermSchema } from "./schemas/mechanistic-source-term.schema";
import {
  EventSequenceQuantificationDiagram,
  EventSequenceQuantificationDiagramSchema,
} from "./schemas/event-sequence-quantification-diagram.schema";
import { DataAnalysis, DataAnalysisSchema } from "./schemas/data-analysis.schema";
import { HumanReliabilityAnalysis, HumanReliabilityAnalysisSchema } from "./schemas/human-reliability-analysis.schema";
import { SystemsAnalysis, SystemsAnalysisSchema } from "./schemas/systems-analysis.schema";
import { SuccessCriteria, SuccessCriteriaSchema } from "./schemas/success-criteria.schema";
import { EventSequenceAnalysis, EventSequenceAnalysisSchema } from "./schemas/event-sequence-analysis.schema";
import { OperatingStateAnalysis, OperatingStateAnalysisSchema } from "./schemas/operatingStateAnalysis.schema";
import { NestedModelHelperService } from "./nested-model-helper.service";
import { InitiatingEventsService } from "./NestedModelsHelpers/initiating-events.service";
import { EventSequenceDiagramService } from "./NestedModelsHelpers/event-sequence-diagram.service";
import { EventSequenceAnalysisService } from "./NestedModelsHelpers/event-sequence-analysis.service";
import { EventTreesService } from "./NestedModelsHelpers/event-trees.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BayesianEstimation.name, schema: BayesianEstimationSchema },
      { name: BayesianNetwork.name, schema: BayesianNetworkSchema },
      { name: EventSequenceDiagram.name, schema: EventSequenceDiagramSchema },
      { name: EventTree.name, schema: EventTreeSchema },
      { name: FaultTree.name, schema: FaultTreeSchema },
      { name: HeatBalanceFaultTree.name, schema: HeatBalanceFaultTreeSchema },
      { name: FunctionalEvent.name, schema: FunctionalEventSchema },
      { name: InitiatingEvent.name, schema: InitiatingEventSchema },
      { name: MarkovChain.name, schema: MarkovChainSchema },
      { name: WeibullAnalysis.name, schema: WeibullAnalysisSchema },
      { name: NestedCounter.name, schema: NestedCounterSchema },
      { name: RiskIntegration.name, schema: RiskIntegrationSchema },
      {
        name: RadiologicalConsequenceAnalysis.name,
        schema: RadiologicalConsequenceAnalysisSchema,
      },
      { name: MechanisticSourceTerm.name, schema: MechanisticSourceTermSchema },
      {
        name: EventSequenceQuantificationDiagram.name,
        schema: EventSequenceQuantificationDiagramSchema,
      },
      { name: DataAnalysis.name, schema: DataAnalysisSchema },
      {
        name: HumanReliabilityAnalysis.name,
        schema: HumanReliabilityAnalysisSchema,
      },
      { name: SystemsAnalysis.name, schema: SystemsAnalysisSchema },
      { name: SuccessCriteria.name, schema: SuccessCriteriaSchema },
      { name: EventSequenceAnalysis.name, schema: EventSequenceAnalysisSchema },
      {
        name: OperatingStateAnalysis.name,
        schema: OperatingStateAnalysisSchema,
      },
      {
        name: EventSequenceDiagramGraph.name,
        schema: EventSequenceDiagramGraphSchema,
      },
      { name: FaultTreeGraph.name, schema: FaultTreeGraphSchema },
      { name: EventTreeGraph.name, schema: EventTreeGraphSchema },
      { name: InternalEvents.name, schema: InternalEventsSchema },
      { name: InternalHazards.name, schema: InternalHazardsSchema },
      { name: ExternalHazards.name, schema: ExternalHazardsSchema },
      { name: FullScope.name, schema: FullScopeSchema },
      { name: ModelCounter.name, schema: ModelCounterSchema },
    ]),
  ],
  controllers: [NestedModelController],
  providers: [
    NestedModelService,
    GraphModelService,
    InitiatingEventsService,
    NestedModelHelperService,
    EventSequenceDiagramService,
    EventSequenceAnalysisService,
    EventTreesService,
  ],
  exports: [
    NestedModelService,
    InitiatingEventsService,
    NestedModelHelperService,
    EventSequenceDiagramService,
    EventTreesService,
  ],
})
export class NestedModelModule {}
