import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { EventSequenceDiagramGraph } from "../schemas/graphs/event-sequence-diagram-graph.schema";
import { FaultTreeGraph } from "../schemas/graphs/fault-tree-graph.schema";
import { BaseGraphDocument } from "../schemas/graphs/base-graph.schema";
import { GraphModelService } from "./graphModel.service";

@Controller()
export class GraphModelController {
  constructor(private readonly graphModelService: GraphModelService) {}

  /**
   * stores/creates an event sequence diagram graph
   * @param data - takes in a partial of an event sequence diagram model
   * as well as the eventSequenceId, if the id is missing - a new graph document will be created.
   * @returns a promise with the newly created graph model
   */
  @Post("/event-sequence-diagram-graph")
  async saveEventSequenceDiagramGraph(
    @Body() data: Partial<EventSequenceDiagramGraph>,
  ): Promise<BaseGraphDocument> {
    return this.graphModelService.saveEventSequenceDiagramGraph(data);
  }

  /**
   * stores/creates a fault tree diagram graph
   * @param data - takes in a partial of a fault tree diagram model
   * as well as the faultTreeId, if the id is missing - a new graph document will be created.
   * @returns a promise with the newly created graph model
   */
  @Post("/fault-tree-graph")
  async createFaultTreeGraph(
    @Body() data: Partial<FaultTreeGraph>,
  ): Promise<BaseGraphDocument> {
    return this.graphModelService.saveFaultTreeGraph(data);
  }

  /**
   * fetches the event sequence graph model for a particular diagram, based on its id
   * @param eventSequenceId - the id of the event sequence diagram
   * @returns a promise with an object of the event sequence diagram graph
   */
  @Get("/event-sequence-diagram-graph/")
  async getEventSequenceDiagramGraph(
    @Query("eventSequenceId") eventSequenceId: string,
  ): Promise<EventSequenceDiagramGraph> {
    return this.graphModelService.getEventSequenceDiagramGraph(eventSequenceId);
  }

  /**
   * fetches the fault tree graph model for a particular diagram, based on its id
   * @param faultTreeId - the id of the fault tree diagram
   * @returns a promise with an object of the fault tree diagram graph
   */
  @Get("/fault-tree-graph/")
  async getFaultTreeGraph(
    @Query("faultTreeId") faultTreeId: string,
  ): Promise<FaultTreeGraph> {
    return this.graphModelService.getFaultTreeGraph(faultTreeId);
  }
}
