import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NestedModelService } from './nestedModel.service';
import { NestedModelController } from './nestedModel.controller';
import { NestedCounter, NestedCounterSchema } from 'src/schemas/tree-counter.schema';
import { BayesianEstimation, BayesianEstimationSchema } from './schemas/bayesian-estimation.schema';
import { EventSequenceDiagram, EventSequenceDiagramSchema } from './schemas/event-sequence-diagram.schema';
import { EventTree, EventTreeSchema } from './schemas/event-tree.schema';
import { FaultTree, FaultTreeSchema } from './schemas/fault-tree.schema';
import { InitiatingEvent, InitiatingEventSchema } from './schemas/initiating-event.schema';
import { MarkovChain, MarkovChainSchema } from './schemas/markov-chain.schema';
import { WeibullAnalysis, WeibullAnalysisSchema } from './schemas/weibull-analysis.schema';
import { BayesianNetwork, BayesianNetworkSchema } from './schemas/bayesian-network.schema';
import { FunctionalEvent, FunctionalEventSchema } from './schemas/functional-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BayesianEstimation.name, schema: BayesianEstimationSchema },
      { name: BayesianNetwork.name, schema: BayesianNetworkSchema },
      { name: EventSequenceDiagram.name, schema: EventSequenceDiagramSchema },
      { name: EventTree.name, schema: EventTreeSchema },
      { name: FaultTree.name, schema: FaultTreeSchema },
      { name: FunctionalEvent.name, schema: FunctionalEventSchema },
      { name: InitiatingEvent.name, schema: InitiatingEventSchema },
      { name: MarkovChain.name, schema: MarkovChainSchema },
      { name: WeibullAnalysis.name, schema: WeibullAnalysisSchema },
      { name: NestedCounter.name, schema: NestedCounterSchema}
    ])
  ],
  controllers: [NestedModelController],
  providers: [NestedModelService],
  exports: [NestedModelService]
})

export class NestedModelModule {}