import { Body, Controller, Get, Patch, Post, Query } from "@nestjs/common";
import { EventSequenceDiagramGraph } from "../schemas/graphs/event-sequence-diagram-graph.schema";
import { FaultTreeGraph } from "../schemas/graphs/fault-tree-graph.schema";
import { HeatBalanceFaultTreeGraph } from "../schemas/graphs/heat-balance-fault-tree-graph.schema";
import { EventTreeGraph } from "../schemas/graphs/event-tree-graph.schema";
import { BaseGraph } from "../schemas/graphs/base-graph.schema";
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
  ): Promise<boolean> {
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
  ): Promise<boolean> {
    return this.graphModelService.saveFaultTreeGraph(data);
  }

  /**
   * stores/creates a heat balance fault tree diagram graph
   * @param data - takes in a partial of a fault tree diagram model
   * as well as the faultTreeId, if the id is missing - a new graph document will be created.
   * @returns a promise with the newly created graph model
   */
  @Post("/heat-balance-fault-tree-graph")
  async createHeatBalanceFaultTreeGraph(
    @Body() data: Partial<HeatBalanceFaultTreeGraph>,
  ): Promise<boolean> {
    return this.graphModelService.saveHeatBalanceFaultTreeGraph(data);
  }

  /**
   * stores/creates a event tree diagram graph
   * @param data - takes in a partial of a event tree diagram model
   * as well as the eventTreeId, if the id is missing - a new graph document will be created.
   * @returns a promise with the newly created graph model
   */
  @Post("/event-tree-graph")
  async createEventTreeGraph(
    @Body() data: Partial<EventTreeGraph>,
  ): Promise<boolean> {
    return this.graphModelService.saveEventTreeGraph(data);
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

  @Get("/event-sequence-diagram-graph/exists")
  async checkIfEventSequenceDiagramGraphExists(
    @Query("eventSequenceId") eventSequenceId: string,
  ): Promise<boolean> {
    return this.graphModelService.checkIfEventSequenceDiagramGraphExists(
      eventSequenceId,
    );
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

  /**
   * fetches the heat balance fault tree graph model for a particular diagram, based on its id
   * @param heatBalanceFaultTreeId - the id of the fault tree diagram
   * @returns a promise with an object of the fault tree diagram graph
   */
  @Get("/heat-balance-fault-tree-graph/")
  async getHeatBalanceFaultTreeGraph(
    @Query("heatBalanceFaultTreeId") heatBalanceFaultTreeId: string,
  ): Promise<HeatBalanceFaultTreeGraph> {
    return this.graphModelService.getHeatBalanceFaultTreeGraph(
      heatBalanceFaultTreeId,
    );
  }

  /**
   * Update the label of node/edge of a heat balance fault tree
   * @param id - Node/Edge ID
   * @param type - 'node' or 'edge'
   * @param label - New label for the node/edge
   * @returns a promise with boolean confirmation whether update was successful or not
   */
  @Patch("/heat-balance-fault-tree-graph/update-label/")
  async updateHeatBalanceFaultTreeNodeLabel(
    @Body("id") id: string,
    @Body("type") type: string,
    @Body("label") label: string,
  ): Promise<boolean> {
    return this.graphModelService.updateHeatBalanceFaultTreeLabel(
      id,
      type,
      label,
    );
  }

  /**
   * Update the label of node/edge of an event sequence diagram
   * @param id - Node/Edge ID
   * @param type - 'node' or 'edge'
   * @param label - New label for the node/edge
   * @returns a promise with boolean confirmation whether update was successful or not
   */
  @Patch("/event-sequence-diagram-graph/update-label/")
  async updateESNodeLabel(
    @Body("id") id: string,
    @Body("type") type: string,
    @Body("label") label: string,
  ): Promise<boolean> {
    return this.graphModelService.updateESLabel(id, type, label);
  }

  @Patch("/event-sequence-diagram-graph")
  async updateESSubgraph(
    @Body("eventSequenceId") eventSequenceId: string,
    @Body("updated") updatedSubgraph: Partial<BaseGraph>,
    @Body("deleted") deletedSubgraph: Partial<BaseGraph>,
  ): Promise<boolean> {
    return this.graphModelService.updateESSubgraph(
      eventSequenceId,
      updatedSubgraph,
      deletedSubgraph,
    );
  }

  /**
   * fetches the event tree graph model for a particular diagram, based on its id
   * @param eventTreeId - the id of the event tree diagram
   * @returns a promise with an object of the event tree diagram graph
   */
  @Get("/event-tree-graph/")
  async getEventTreeGraph(
    @Query("eventTreeId") eventTreeId: string,
  ): Promise<EventTreeGraph> {
    return this.graphModelService.getEventTreeGraph(eventTreeId);
  }
}
