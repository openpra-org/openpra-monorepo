import { Body, Controller, Get, HttpException, HttpStatus, Patch, Post, Query, Delete } from "@nestjs/common";
import { EventSequenceDiagramGraph } from "../schemas/graphs/event-sequence-diagram-graph.schema";
import { FaultTreeGraph } from "../schemas/graphs/fault-tree-graph.schema";
import { EventTreeGraph } from "../schemas/graphs/event-tree-graph.schema";
import { BayesianNetworkGraph } from "../schemas/graphs/bayesian-network-graph.schema";
import { BaseGraph } from "../schemas/graphs/base-graph.schema";
import { GraphModelService } from "./graphModel.service";
import { GraphTypes } from "./graphModel.service";

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
  async createFaultTreeGraph(@Body() data: Partial<FaultTreeGraph>): Promise<boolean> {
    try {
      return this.graphModelService.saveFaultTreeGraph(data);
    } catch (_) {
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
  async createEventTreeGraph(@Body() data: Partial<EventTreeGraph>): Promise<boolean> {
    try {
      return this.graphModelService.saveEventTreeGraph(data);
    } catch (_) {
      throw new HttpException("Something went wrong", HttpStatus.INTERNAL_SERVER_ERROR);
    }
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
  async getFaultTreeGraph(@Query("faultTreeId") faultTreeId: string): Promise<FaultTreeGraph> {
    return this.graphModelService.getFaultTreeGraph(faultTreeId);
  }

  /**
   * fetches the event tree graph model for a particular diagram, based on its id
   * @param eventTreeId - the id of the event tree diagram
   * @returns a promise with an object of the event tree diagram graph
   */
  @Get("/event-tree-graph/")
  async getEventTreeGraph(@Query("eventTreeId") eventTreeId: string): Promise<EventTreeGraph> {
    return this.graphModelService.getEventTreeGraph(eventTreeId);
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
    try {
      return this.graphModelService.updateESLabel(id, type, label);
    } catch (_) {
      throw new HttpException("Something went wrong", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch("/event-sequence-diagram-graph")
  async updateESSubgraph(
    @Body("eventSequenceId") eventSequenceId: string,
    @Body("updated") updatedSubgraph: Partial<BaseGraph>,
    @Body("deleted") deletedSubgraph: Partial<BaseGraph>,
  ): Promise<boolean> {
    try {
      return this.graphModelService.updateESSubgraph(eventSequenceId, updatedSubgraph, deletedSubgraph);
    } catch (_) {
      throw new HttpException("Something went wrong", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  /**
   * fetches the bayesian network graph model for a particular diagram, based on its id
   * @param bayesianNetworkId - the id of the bayesian network diagram
   * @returns a promise with an object of the bayesian network diagram graph
   */
  @Get("/bayesian-network-graph/")
  async getBayesianNetworkGraph(@Query("bayesianNetworkId") bayesianNetworkId: string): Promise<BayesianNetworkGraph> {
    return this.graphModelService.getBayesianNetworkGraph(bayesianNetworkId);
  }

  /**
   * stores/creates a bayesian network diagram graph
   * @param data - takes in a partial of a bayesian network diagram model
   * as well as the bayesianNetworkId, if the id is missing - a new graph document will be created.
   * @returns a promise with the newly created graph model
   */
  @Post("/bayesian-network-graph")
  async createBayesianNetworkGraph(@Body() data: Partial<BayesianNetworkGraph>): Promise<boolean> {
    try {
      return this.graphModelService.saveBayesianNetworkGraph(data);
    } catch (_) {
      throw new HttpException("Something went wrong", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Update the label of node/edge of a bayesian network node diagram
   * @param id - Node/Edge ID
   * @param label - New label for the node/edge
   * @returns a promise with boolean confirmation whether update was successful or not
   */
  @Patch("/bayesian-network-graph/update-node-label")
  async updateBayesianNodeLabel(@Body("nodeId") nodeId: string, @Body("label") label: string): Promise<boolean> {
    try {
      return this.graphModelService.updateBNLabel(nodeId, label);
    } catch (_) {
      throw new HttpException("Something went wrong", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Deletes a node from a Bayesian Network graph.
   *
   * @param bayesianNetworkId - The ID of the Bayesian Network graph from which the node will be deleted.
   * @param nodeId - The ID of the node to be deleted.
   * @returns A promise that resolves to true if the node was successfully deleted, false otherwise.
   * @throws HttpException if an error occurs while deleting the node.
   */
  @Delete("/bayesian-network-graph/delete-node")
  async deleteNodeFromBayesianNetwork(
    @Body("bayesianNetworkId") bayesianNetworkId: string,
    @Body("nodeId") nodeId: string,
  ): Promise<boolean> {
    try {
      return await this.graphModelService.deleteNodeAndReconnect(bayesianNetworkId, nodeId);
    } catch (error) {
      throw new HttpException("Error deleting node", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  /**
   * Adds a new node to a Bayesian network graph.
   * The new node is created as a child of an existing parent node.
   *
   * @param bayesianNetworkId - The ID of the Bayesian network graph.
   * @param parentId - The ID of the parent node to which the new node will be connected.
   * @param newNode - An object containing the properties of the new node:
   * - id: The unique identifier for the new node.
   * - label: (Optional) The label for the new node (defaults to "New Node" if not provided).
   * - position: The position coordinates (x, y) for the new node on the canvas.
   *
   * @returns A promise that resolves to true if the node is successfully added, otherwise false.
   * @throws HttpException - Throws an Internal Server Error if the node cannot be added.
   */
  @Post("/bayesian-network-graph/add-node")
  async addNodeToBayesianNetwork(
    @Body("bayesianNetworkId") bayesianNetworkId: string,
    @Body("parentId") parentId: string,
    @Body("newNode") newNode: { id: string; label?: string; position: { x: number; y: number } },
  ): Promise<boolean> {
    try {
      console.log("Adding Node with data:", newNode);
      // return await this.graphModelService.addNodeFromParent(bayesianNetworkId, parentId, newNode);
      const result = await this.graphModelService.addNodeFromParent(bayesianNetworkId, parentId, newNode);
      console.log("Node added with response:", result);
      return result;
    } catch (error) {
      console.error("Error adding node to Bayesian Network(controller):", error);
      throw new HttpException("Error adding node", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Updates the position of an existing node in the Bayesian network graph.
   * The position of the node is updated based on the new coordinates provided.
   *
   * @param nodeId - The unique ID of the node to be updated.
   * @param position - An object containing the new position coordinates:
   * - x: The new X-coordinate of the node.
   * - y: The new Y-coordinate of the node.
   *
   * @returns A promise that resolves to true if the node's position is successfully updated, otherwise false.
   * @throws HttpException - Throws an Internal Server Error if the position cannot be updated.
   */
  @Patch("/bayesian-network-graph/update-node-position")
  async updateNodePosition(
    @Body("nodeId") nodeId: string,
    @Body("position") position: { x: number; y: number },
  ): Promise<boolean> {
    try {
      return await this.graphModelService.updateNodePosition(nodeId, position);
    } catch (error) {
      throw new HttpException("Error updating node position", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
