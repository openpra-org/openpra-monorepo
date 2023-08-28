// import { Module } from '@nestjs/common';
// import { MongooseModule } from '@nestjs/mongoose';
// import { HclController } from './hcl.controller';
// import { HclService } from './hcl.service';
// import { ModelCounter, ModelCounterSchema } from '../schemas/model-counter.schema';
// import { HclModel, HclModelSchema } from './schemas/hcl-model.schema';
// import { GlobalParameterCounter, GlobalParameterCounterSchema } from './schemas/global-parameter-counter.schema';
// import { GlobalParameter, GlobalParameterSchema } from './schemas/global-parameter.schema';
// import { TreeCounter, TreeCounterSchema } from '../schemas/tree-counter.schema';
// import { HclModelTree, HclModelTreeSchema } from './schemas/hcl-model-tree.schema';
// import { FaultTree, FaultTreeSchema } from '../nestedModels/schemas/fault-tree.schema';
// import { EventSequenceDiagram, EventSequenceDiagramSchema } from '../nestedModels/schemas/event-sequence-diagram.schema';
// import { BayesianNetworks, BayesianNetworksSchema } from '../nestedModels/schemas/bayesian-networks.schema';
// import { Action, ActionSchema } from './schemas/action.schema';
// import { OverviewTree, OverviewTreeSchema } from './schemas/overview-tree.schema';
// import { User, UserSchema } from '../collab/schemas/user.schema';
// import { QuantificationResultCounter, QuantificationResultCounterSchema } from './schemas/quantification-result-counter.schema';
// import { QuantificationResult, QuantificationResultSchema } from './schemas/quantification-result.schema';

// @Module({
//   imports: [
//     MongooseModule.forFeature([
//       { name: User.name, schema: UserSchema },
//       { name: ModelCounter.name, schema: ModelCounterSchema },
//       { name: HclModel.name, schema: HclModelSchema },
//       { name: GlobalParameterCounter.name, schema: GlobalParameterCounterSchema },
//       { name: GlobalParameter.name, schema: GlobalParameterSchema },
//       { name: TreeCounter.name, schema: TreeCounterSchema },
//       { name: Action.name, schema: ActionSchema },
//       { 
//         name: HclModelTree.name, schema: HclModelTreeSchema,
//         discriminators: [
//           { name: FaultTree.name, schema: FaultTreeSchema },
//           { name: EventSequenceDiagram.name, schema: EventSequenceDiagramSchema },
//           { name: BayesianNetworks.name, schema: BayesianNetworksSchema }
//         ]
//       },
//       { name: OverviewTree.name, schema: OverviewTreeSchema },
//       { name: QuantificationResultCounter.name, schema: QuantificationResultCounterSchema },
//       { name: QuantificationResult.name, schema: QuantificationResultSchema }
//     ])
//   ],
//   controllers: [HclController],
//   providers: [HclService],
//   exports: [HclService]
// })

// export class HclModule {}