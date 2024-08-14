import { Controller, HttpException, HttpStatus } from "@nestjs/common";
import { TypedBody, TypedQuery, TypedRoute } from "@nestia/core";
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
  @TypedRoute.Post("/fault-tree-graph")
  public async createFaultTreeGraph(@TypedBody() data: Partial<FaultTreeGraph>): Promise<boolean> {
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
  @TypedRoute.Post("/event-tree-graph")
  public async createEventTreeGraph(@TypedBody() data: Partial<EventTreeGraph>): Promise<boolean> {
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
  @TypedRoute.Get("/event-sequence-diagram-graph/")
  public async getEventSequenceDiagramGraph(
    @TypedQuery() query: { eventSequenceId: string },
  ): Promise<EventSequenceDiagramGraph> {
    return this.graphModelService.getEventSequenceDiagramGraph(query.eventSequenceId);
  }

  /**
   * fetches the fault tree graph model for a particular diagram, based on its id
   * @returns a promise with an object of the fault tree diagram graph
   * @param query
   */
  @TypedRoute.Get("/fault-tree-graph/")
  public async getFaultTreeGraph(@TypedQuery() query: { faultTreeId: string }): Promise<FaultTreeGraph> {
    return this.graphModelService.getFaultTreeGraph(query.faultTreeId);
  }

  /**
   * Update the label of node/edge of an event sequence diagram
   * @returns a promise with boolean confirmation whether update was successful or not
   * @param body
   */
  @TypedRoute.Patch("/event-sequence-diagram-graph/update-label/")
  public async updateESNodeLabel(@TypedBody() body: { id: string; type: string; label: string }): Promise<boolean> {
    try {
      return this.graphModelService.updateESLabel(body.id, body.type, body.label);
    } catch (_) {
      throw new HttpException("Something went wrong", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @TypedRoute.Patch("/event-sequence-diagram-graph")
  public async updateESSubgraph(
    @TypedBody()
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
  @TypedRoute.Get("/event-tree-graph/")
  public async getEventTreeGraph(@TypedQuery() query: { eventTreeId: string }): Promise<EventTreeGraph> {
    return this.graphModelService.getEventTreeGraph(query.eventTreeId);
  }
}
