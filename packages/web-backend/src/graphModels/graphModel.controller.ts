import { Body, Controller, Get, HttpException, HttpStatus, Patch, Post, Query } from "@nestjs/common";
import { EventSequenceDiagramGraph } from "../schemas/graphs/event-sequence-diagram-graph.schema";
import { FaultTreeGraph } from "../schemas/graphs/fault-tree-graph.schema";
import { EventTreeGraph } from "../schemas/graphs/event-tree-graph.schema";
import { BaseGraph } from "../schemas/graphs/base-graph.schema";
import { GraphModelService } from "./graphModel.service";

@Controller()
export class GraphModelController {
  constructor(private readonly graphModelService: GraphModelService) {}

  /**
   * stores/creates a fault tree diagram graph
   * @param data - takes in a partial of a fault tree diagram model
   * as well as the faultTreeId, if the id is missing - a new graph document will be created.
   * @returns a promise with the newly created graph model
   */
  @Post("/fault-tree-graph")
  public async createFaultTreeGraph(@Body() data: Partial<FaultTreeGraph>): Promise<boolean> {
    try {
      return this.graphModelService.saveFaultTreeGraph(data);
    } catch {
      throw new HttpException("Something went wrong", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * stores/creates a event tree diagram graph
   * @param data - takes in a partial of a event tree diagram model
   * as well as the eventTreeId, if the id is missing - a new graph document will be created.
   * @returns a promise with the newly created graph model
   */
  @Post("/event-tree-graph")
  public async createEventTreeGraph(@Body() data: Partial<EventTreeGraph>): Promise<boolean> {
    try {
      return this.graphModelService.saveEventTreeGraph(data);
    } catch {
      throw new HttpException("Something went wrong", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * fetches the event sequence graph model for a particular diagram, based on its id
   * @returns a promise with an object of the event sequence diagram graph
   * @param query
   */
  @Get("/event-sequence-diagram-graph/")
  public async getEventSequenceDiagramGraph(
    @Query() query: { eventSequenceId: string },
  ): Promise<EventSequenceDiagramGraph> {
    return this.graphModelService.getEventSequenceDiagramGraph(query.eventSequenceId);
  }

  /**
   * fetches the fault tree graph model for a particular diagram, based on its id
   * @returns a promise with an object of the fault tree diagram graph
   * @param query
   */
  @Get("/fault-tree-graph/")
  public async getFaultTreeGraph(@Query() query: { faultTreeId: string }): Promise<FaultTreeGraph> {
    return this.graphModelService.getFaultTreeGraph(query.faultTreeId);
  }

  /**
   * Update the label of node/edge of an event sequence diagram
   * @returns a promise with boolean confirmation whether update was successful or not
   * @param body
   */
  @Patch("/event-sequence-diagram-graph/update-label/")
  public async updateESNodeLabel(@Body() body: { id: string; type: string; label: string }): Promise<boolean> {
    try {
      return this.graphModelService.updateESLabel(body.id, body.type, body.label);
    } catch (_) {
      throw new HttpException("Something went wrong", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch("/event-sequence-diagram-graph")
  public async updateESSubgraph(
    @Body()
    body: {
      eventSequenceId: string;
      updatedSubgraph: Partial<BaseGraph>;
      deletedSubgraph: Partial<BaseGraph>;
    },
  ): Promise<boolean> {
    try {
      return this.graphModelService.updateESSubgraph(body.eventSequenceId, body.updatedSubgraph, body.deletedSubgraph);
    } catch {
      throw new HttpException("Something went wrong", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * fetches the event tree graph model for a particular diagram, based on its id
   * @returns a promise with an object of the event tree diagram graph
   * @param query
   */
  @Get("/event-tree-graph/")
  public async getEventTreeGraph(@Query() query: { eventTreeId: string }): Promise<EventTreeGraph> {
    return this.graphModelService.getEventTreeGraph(query.eventTreeId);
  }
}
