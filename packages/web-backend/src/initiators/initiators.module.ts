import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  HeatBalanceFaultTree,
  HeatBalanceFaultTreeSchema,
} from "../nestedModels/schemas/heat-balance-fault-tree.schema";
import { InitiatorService } from "./initiators.service";
import { InitiatorController } from "./initiators.controller";
import { Initiator, InitiatorSchema } from "./schemas/initiator.schema";
//import heatbalance fault tree schema

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Initiator.name, schema: InitiatorSchema },
      { name: HeatBalanceFaultTree.name, schema: HeatBalanceFaultTreeSchema },
    ]),
  ],
  controllers: [InitiatorController],
  providers: [InitiatorService],
  exports: [InitiatorService],
})
export class InitiatorModule {}
