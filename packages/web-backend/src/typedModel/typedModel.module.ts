import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Action } from 'rxjs/internal/scheduler/Action';
import { User, UserSchema } from 'src/collab/schemas/user.schema';
import { ActionSchema } from 'src/hcl/schemas/action.schema';
import { BayesianNetworks, BayesianNetworksSchema } from 'src/hcl/schemas/bayesian-networks.schema';
import { EventSequenceDiagram, EventSequenceDiagramSchema } from 'src/hcl/schemas/event-sequence-diagram.schema';
import { FaultTree, FaultTreeSchema } from 'src/hcl/schemas/fault-tree.schema';
import { GlobalParameterCounter, GlobalParameterCounterSchema } from 'src/hcl/schemas/global-parameter-counter.schema';
import { GlobalParameter, GlobalParameterSchema } from 'src/hcl/schemas/global-parameter.schema';
import { HclModelTree, HclModelTreeSchema } from 'src/hcl/schemas/hcl-model-tree.schema';
import { HclModel, HclModelSchema } from 'src/hcl/schemas/hcl-model.schema';
import { ModelCounter, ModelCounterSchema } from 'src/hcl/schemas/model-counter.schema';
import { OverviewTree, OverviewTreeSchema } from 'src/hcl/schemas/overview-tree.schema';
import { QuantificationResultCounter, QuantificationResultCounterSchema } from 'src/hcl/schemas/quantification-result-counter.schema';
import { QuantificationResult, QuantificationResultSchema } from 'src/hcl/schemas/quantification-result.schema';
import { TreeCounter, TreeCounterSchema } from 'src/hcl/schemas/tree-counter.schema';
import { TypedModelController } from './typedModel.controller';
import { TypedModelService } from './typedModel.service';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ModelCounter.name, schema: ModelCounterSchema },
      { name: HclModel.name, schema: HclModelSchema },
      { name: GlobalParameterCounter.name, schema: GlobalParameterCounterSchema },
      { name: GlobalParameter.name, schema: GlobalParameterSchema },
      { name: TreeCounter.name, schema: TreeCounterSchema },
      { name: Action.name, schema: ActionSchema },
      { 
        name: HclModelTree.name, schema: HclModelTreeSchema,
        discriminators: [
          { name: FaultTree.name, schema: FaultTreeSchema },
          { name: EventSequenceDiagram.name, schema: EventSequenceDiagramSchema },
          { name: BayesianNetworks.name, schema: BayesianNetworksSchema }
        ]
      },
      { name: OverviewTree.name, schema: OverviewTreeSchema },
      { name: QuantificationResultCounter.name, schema: QuantificationResultCounterSchema },
      { name: QuantificationResult.name, schema: QuantificationResultSchema }
    ])
  ],
  controllers: [TypedModelController],
  providers: [TypedModelService],
  exports: [TypedModelService]
})

export class HclModule {}