import { MODULE_METADATA } from "@nestjs/common/constants";
import { BayesianNetworkModule } from "../bayesian-network/bayesian-network.module";
import { EventTreeModule } from "../event-tree/event-tree.module";
import { FaultTreeModule } from "../fault-tree/fault-tree.module";
import { HybridCausalLogicModule } from "../hybrid-causal-logic/hybrid-causal-logic.module";
import { NewlyDevelopedMethodsModule } from "../newly-developed-methods.module";
import { NewlyDevelopedMethodsSharedModule } from "../shared/newly-developed-methods-shared.module";

describe("NewlyDevelopedMethodsModule", () => {
  it("composes a separate backend module for every planned method area", () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, NewlyDevelopedMethodsModule)).toEqual([
      NewlyDevelopedMethodsSharedModule,
      FaultTreeModule,
      BayesianNetworkModule,
      EventTreeModule,
      HybridCausalLogicModule,
    ]);
  });
});
