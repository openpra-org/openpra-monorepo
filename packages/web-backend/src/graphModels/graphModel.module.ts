import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  EventSequenceDiagramGraph,
  EventSequenceDiagramGraphSchema,
} from "../schemas/graphs/event-sequence-diagram-graph.schema";
import { FaultTreeGraph, FaultTreeGraphSchema } from "../schemas/graphs/fault-tree-graph.schema";

import { EventTreeGraph, EventTreeGraphSchema } from "../schemas/graphs/event-tree-graph.schema";

import { GraphModelController } from "./graphModel.controller";
import { GraphModelService } from "./graphModel.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: EventSequenceDiagramGraph.name,
        schema: EventSequenceDiagramGraphSchema,
      },
      { name: FaultTreeGraph.name, schema: FaultTreeGraphSchema },
      { name: EventTreeGraph.name, schema: EventTreeGraphSchema },
    ]),
  ],
  controllers: [GraphModelController],
  providers: [GraphModelService],
  exports: [GraphModelService],
})
export class GraphModelModule {}
