import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
    Initiator,
    InitiatorSchema
} from "../initiators/schemas/initiator.schema"

import {
    InitiatingEvent,
    InitiatingEventSchema
} from "../nestedModels/schemas/initiating-event.schema"

import {
    ModelViewColumn,
    ModelViewColumnSchema
} from "./schemas/columnsConfig.schema"
import {ModelViewColumnController} from "./modelViewColumn.controller"
import { ModelViewColumnService } from "./modelViewColumn.service";

//import heatbalance fault tree schema

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Initiator.name, schema: InitiatorSchema },
      { name: InitiatingEvent.name, schema: InitiatingEventSchema },
      { name: ModelViewColumn.name, schema: ModelViewColumnSchema },
    ]),
  ],
  controllers: [ModelViewColumnController],
  
  providers: [ModelViewColumnService],
  exports: [ModelViewColumnService],
})
export class ModelViewColumnModule {}
