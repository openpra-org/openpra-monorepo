import { Module } from "@nestjs/common";
import { BayesianNetworkModule } from "./bayesian-network/bayesian-network.module";
import { EventTreeModule } from "./event-tree/event-tree.module";
import { FaultTreeModule } from "./fault-tree/fault-tree.module";
import { HybridCausalLogicModule } from "./hybrid-causal-logic/hybrid-causal-logic.module";
import { NewlyDevelopedMethodsSharedModule } from "./shared/newly-developed-methods-shared.module";

@Module({
  imports: [
    NewlyDevelopedMethodsSharedModule,
    FaultTreeModule,
    BayesianNetworkModule,
    EventTreeModule,
    HybridCausalLogicModule,
  ],
})
export class NewlyDevelopedMethodsModule {}
