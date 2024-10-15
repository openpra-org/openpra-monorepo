import * as mongoose from "mongoose";
import { HydratedDocument, Model } from "mongoose";
import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { GraphEdge } from "shared-types/src/lib/types/reactflowGraph/GraphEdge";
import { GraphNode } from "shared-types/src/lib/types/reactflowGraph/GraphNode";
import {
  EventSequenceDiagramGraph,
  EventSequenceDiagramGraphDocument,
} from "../schemas/graphs/event-sequence-diagram-graph.schema";
import { FaultTreeGraph, FaultTreeGraphDocument } from "../schemas/graphs/fault-tree-graph.schema";
import { BaseGraph, BaseGraphDocument } from "../schemas/graphs/base-graph.schema";
import { EventTreeGraph, EventTreeGraphDocument } from "../schemas/graphs/event-tree-graph.schema";
import { BayesianNetworkGraph, BayesianNetworkGraphDocument } from "../schemas/graphs/bayesian-network-graph.schema";

/**
 * Enum of supported graph types
 */
export enum GraphTypes {
  EventSequence = "event-sequence",
  FaultTree = "fault-tree",
  EventTree = "event-tree",
  BayesianNetwork = "bayesian-network",
}

@Injectable()
export class GraphModelService {
  private readonly logger = new Logger(GraphModelService.name);
  constructor(
    @InjectModel(EventSequenceDiagramGraph.name)
    private readonly eventSequenceDiagramGraphModel: Model<EventSequenceDiagramGraphDocument>,
    @InjectModel(FaultTreeGraph.name)
    private readonly faultTreeGraphModel: Model<FaultTreeGraphDocument>,
    @InjectModel(EventTreeGraph.name)
    private readonly eventTreeGraphModel: Model<EventTreeGraphDocument>,
    @InjectModel(BayesianNetworkGraph.name)
    private readonly bayesianNetworkGraphModel: Model<BayesianNetworkGraphDocument>,
  ) {}

  /**
   * Sets the event sequence diagram graph for the given event sequence ID
   * @param eventSequenceId - Event sequence ID
   * @returns A promise with the event sequence diagram graph
   */
  async getEventSequenceDiagramGraph(eventSequenceId: string): Promise<EventSequenceDiagramGraph> {
    const result = await this.eventSequenceDiagramGraphModel.findOne({ eventSequenceId: eventSequenceId }, { _id: 0 });
    if (result !== null) {
      return result;
    } else {
      return {
        id: "",
        _id: new mongoose.Types.ObjectId(),
        eventSequenceId: eventSequenceId,
        nodes: [],
        edges: [],
      };
    }
  }

  /**
   * Saves the event sequence diagram graph
   * @param body - The current state of the event sequence diagram graph
   * @returns A promise with an event sequence diagram graph in it
   */
  async saveEventSequenceDiagramGraph(body: Partial<EventSequenceDiagramGraph>): Promise<EventSequenceDiagramGraph> {
    try {
      const newGraph = new this.eventSequenceDiagramGraphModel(body);
      newGraph.eventSequenceId = body.eventSequenceId;
      newGraph.id = this.generateUUID();
      newGraph._id = new mongoose.Types.ObjectId();
      const defaultEventSequenceGraph = this.getDefaultEventSequenceDiagram();
      newGraph.nodes = defaultEventSequenceGraph.nodes;
      newGraph.edges = defaultEventSequenceGraph.edges;
      return newGraph.save();
    } catch (exception) {
      const error = exception as Error;
      this.logger.error(error.message, error.stack);
      throw new Error();
    }
  }

  /**
   * Saves the fault tree diagram graph
   * @param body - The current state of the fault tree diagram graph
   * @returns A promise with a fault tree diagram graph in it
   */
  async saveFaultTreeGraph(body: Partial<FaultTreeGraph>): Promise<boolean> {
    try {
      const existingGraph = await this.faultTreeGraphModel.findOne({
        faultTreeId: body.faultTreeId,
      });
      return this.saveGraph(existingGraph, body, GraphTypes.FaultTree);
    } catch (exception) {
      const error = exception as Error;
      this.logger.error(error.message, error.stack);
      throw new Error();
    }
  }

  /**
   * Sets the fault tree diagram graph for the given fault tree ID
   * @param faultTreeId - Fault tree ID
   * @returns A promise with the fault tree diagram graph
   */
  async getFaultTreeGraph(faultTreeId: string): Promise<FaultTreeGraph> {
    const result = this.faultTreeGraphModel.findOne({ faultTreeId: faultTreeId }, { _id: 0 });
    if (result !== null) {
      return result;
    } else {
      return {
        id: "",
        _id: new mongoose.Types.ObjectId(),
        faultTreeId: faultTreeId,
        nodes: [],
        edges: [],
      };
    }
  }

  /**
   * Saves the event tree diagram graph
   * @param body - The current state of the event tree diagram graph
   * @returns A promise with a event tree diagram graph in it
   */
  async saveEventTreeGraph(body: Partial<EventTreeGraph>): Promise<boolean> {
    try {
      const existingGraph = await this.eventTreeGraphModel.findOne({
        eventTreeId: body.eventTreeId,
      });
      return this.saveGraph(existingGraph, body, GraphTypes.EventTree);
    } catch (exception) {
      const error = exception as Error;
      this.logger.error(error.message, error.stack);
      throw new Error();
    }
  }

  /**
   * Sets the event tree diagram graph for the given event tree ID
   * @param eventTreeId - Event tree ID
   * @returns A promise with the event tree diagram graph
   */
  async getEventTreeGraph(eventTreeId: string): Promise<EventTreeGraph> {
    const result = this.eventTreeGraphModel.findOne({ eventTreeId: eventTreeId }, { _id: 0 });
    if (result !== null) {
      return result;
    } else {
      return {
        id: "",
        _id: new mongoose.Types.ObjectId(),
        eventTreeId: eventTreeId,
        nodes: [],
        edges: [],
      };
    }
  }

  /**
   * Saves the bayesian network diagram graph
   * @param body - The current state of the bayesian network diagram graph
   * @returns A promise with a bayesian network diagram graph in it
   */
  async saveBayesianNetworkGraph(body: Partial<BayesianNetworkGraph>): Promise<boolean> {
    try {
      const existingGraph = await this.bayesianNetworkGraphModel.findOne({
        bayesianNetworkId: body.bayesianNetworkId,
      });
      return this.saveGraph(existingGraph, body, GraphTypes.BayesianNetwork);
    } catch (exception) {
      const error = exception as Error;
      this.logger.error(error.message, error.stack);
      throw new Error();
    }
  }

  /**
   * Sets the bayesian network diagram graph for the given event tree ID
   * @param bayesianNetworkId - Bayesian network ID
   * @returns A promise with the bayesian network diagram graph
   */
  async getBayesianNetworkGraph(bayesianNetworkId: string): Promise<BayesianNetworkGraph> {
    const result = this.bayesianNetworkGraphModel.findOne({ bayesianNetworkId: bayesianNetworkId }, { _id: 0 });
    if (result !== null) {
      return result;
    } else {
      return {
        id: "",
        _id: new mongoose.Types.ObjectId(),
        bayesianNetworkId: bayesianNetworkId,
        nodes: [],
        edges: [],
      };
    }
  }

  /**
   * Updates the label of the node/edge present in the data attribute
   * @param id - Node/Edge ID
   * @param type - 'node' or 'edge'
   * @param label - New label for the node/edge
   * @returns A promise with boolean confirmation of the update operation
   */
  async updateESLabel(id: string, type: string, label: string): Promise<boolean> {
    try {
      // check if type is valid
      if (!["node", "edge"].includes(type)) {
        this.logger.error(`Invalid type (${type}) provided to update label`);
        return false;
      }

      // attribute filter for node/edge
      const attribute = type === "node" ? "nodes" : "edges";
      const filter = {};
      const set = {};
      filter[`${attribute}.id`] = id;
      set[`${attribute}.$.data.label`] = label;

      const result = await this.eventSequenceDiagramGraphModel.updateOne(filter, {
        $set: set,
      });
      return result.modifiedCount > 0;
    } catch (exception) {
      const error = exception as Error;
      this.logger.error(error.message, error.stack);
      throw new Error();
    }
  }

  async updateESSubgraph(
    eventSequenceId: string,
    updatedSubgraph: Partial<EventSequenceDiagramGraph>,
    deletedSubgraph: Partial<EventSequenceDiagramGraph>,
  ): Promise<boolean> {
    try {
      const existingGraph = await this.eventSequenceDiagramGraphModel.findOne({
        eventSequenceId: eventSequenceId,
      });
      if (existingGraph === null) return false;

      existingGraph.nodes = existingGraph.nodes
        .filter((node) => ![...deletedSubgraph.nodes, ...updatedSubgraph.nodes].some((n) => n.id === node.id))
        .concat(...updatedSubgraph.nodes);
      existingGraph.edges = existingGraph.edges
        .filter((edge) => ![...deletedSubgraph.edges, ...updatedSubgraph.edges].some((e) => e.id === edge.id))
        .concat(...updatedSubgraph.edges);

      await existingGraph.save();
      return true;
    } catch (exception) {
      const error = exception as Error;
      this.logger.error(error.message, error.stack);
      throw new Error();
    }
  }

  /**
   * Save the graph document
   * @param graph - Graph document
   * @param body - Model data
   * @param modelType - Type of graph model
   * @returns Graph document, after saving it in the database
   */
  private async saveGraph(graph: BaseGraphDocument, body: Partial<BaseGraph>, modelType: GraphTypes): Promise<boolean> {
    if (graph !== null) {
      graph.nodes = body.nodes;
      graph.edges = body.edges;
      await graph.save();
    } else {
      const newGraph = this.getModel(modelType, body);
      newGraph.id = new Date().getTime().toString(36) + Math.random().toString(36).slice(2);
      newGraph._id = new mongoose.Types.ObjectId();
      await newGraph.save();
    }
    return true;
  }

  /**
   * Get the newly created schema model according to the type of model
   * @param modelType - Graph model type
   * @param body - Model data
   * @returns A hydrated document of the graph document
   * @throws Error If model type is incorrect
   */
  private getModel(modelType: GraphTypes, body: Partial<BaseGraph>): HydratedDocument<BaseGraphDocument> {
    switch (modelType) {
      case GraphTypes.EventSequence:
        return new this.eventSequenceDiagramGraphModel(body);
      case GraphTypes.FaultTree:
        return new this.faultTreeGraphModel(body);
      case GraphTypes.EventTree:
        return new this.eventTreeGraphModel(body);
      case GraphTypes.BayesianNetwork:
        return new this.bayesianNetworkGraphModel(body);
      default:
        throw new Error("model type not found");
    }
  }

  private generateUUID(): string {
    return new Date().getTime().toString(36) + Math.random().toString(36).slice(2);
  }

  private getDefaultEventSequenceDiagram(): Partial<EventSequenceDiagramGraphDocument> {
    const initiatingEventId = this.generateUUID();
    const functionalEventId = this.generateUUID();
    const firstEndStateId = this.generateUUID();
    const secondEndStateId = this.generateUUID();

    const defaultNodes: GraphNode<object>[] = [
      {
        id: initiatingEventId,
        data: {
          label: "Initiating Event",
        },
        position: { x: 0, y: 0 },
        type: "initiating",
      },
      {
        id: functionalEventId,
        data: {
          label: "Functional",
        },
        position: { x: 0, y: 0 },
        type: "functional",
      },
      {
        id: firstEndStateId,
        data: {
          label: "End State",
        },
        position: { x: 0, y: 0 },
        type: "end",
      },
      {
        id: secondEndStateId,
        data: {
          label: "End State",
        },
        position: { x: 0, y: 0 },
        type: "end",
      },
    ];

    const defaultEdges: GraphEdge<object>[] = [
      {
        id: `${initiatingEventId}->${functionalEventId}`,
        source: initiatingEventId,
        target: functionalEventId,
        type: "normal",
        animated: false,
        data: {},
      },
      {
        id: `${functionalEventId}->${firstEndStateId}`,
        source: functionalEventId,
        target: firstEndStateId,
        type: "functional",
        data: { label: "Yes", order: 1 },
        animated: false,
      },
      {
        id: `${functionalEventId}->${secondEndStateId}`,
        source: functionalEventId,
        target: secondEndStateId,
        type: "functional",
        data: { label: "No", order: 2 },
        animated: false,
      },
    ];

    return { nodes: defaultNodes, edges: defaultEdges };
  }
  /**
   * Updates the label of the bayesian node/edge present in the data attribute
   * @param id - Node/Edge ID
   * @param type - 'node' or 'edge'
   * @param label - New label for the node/edge
   * @returns A promise with boolean confirmation of the update operation
   */
  async updateBNLabel(nodeId: string, label: string): Promise<boolean> {
    try {
      const filter = { "nodes.id": nodeId };
      const update = { $set: { "nodes.$.data.label": label } };
      const result = await this.bayesianNetworkGraphModel.updateOne(filter, update);

      return result.modifiedCount > 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to update label for node ${nodeId}: ${errorMessage}`);
      throw new Error();
    }
  }

  /**
   * Adds a new node from a parent in the Bayesian Network
   * @param bayesianNetworkId - The ID of the Bayesian Network
   * @param parentId - The ID of the parent node
   * @param newNode - The new node object
   * @returns A promise with boolean confirmation
   */
  async addNodeFromParent(
    bayesianNetworkId: string,
    parentId: string,
    newNode: { id: string; label?: string; position: { x: number; y: number } },
  ): Promise<boolean> {
    try {
      const graph = await this.bayesianNetworkGraphModel.findOne({ bayesianNetworkId });

      // Explicit null check
      if (graph == null) {
        this.logger.error(`Graph with ID ${bayesianNetworkId} not found`);
        throw new Error(`Graph with ID ${bayesianNetworkId} not found`);
      }

      // Ensure parent exists
      const parentNode = graph.nodes.find((node) => node.id === parentId);
      if (parentNode == null) {
        this.logger.error(`Parent node with ID ${parentId} not found`);
        throw new Error(`Parent node with ID ${parentId} not found`);
      }

      // Default label for the new node inside the `data` field, not directly as `label`
      const newGraphNode: GraphNode<object> = {
        id: newNode.id,
        position: newNode.position,
        data: { label: newNode.label || "New Node" }, // Use the data property for the label
        type: "default", // Assuming this is the node type you're using
      };

      // Add the new node to the graph
      graph.nodes.push(newGraphNode);

      // Create an edge from the parent to the new node
      const newEdge: GraphEdge<object> = {
        id: `${parentId}->${newNode.id}`,
        source: parentId,
        target: newNode.id,
        data: { label: `Edge from ${parentId} to ${newNode.id}` },
        animated: false,
        type: "default",
      };

      // Add the new edge to the graph
      graph.edges.push(newEdge);

      // Save the updated graph
      await graph.save();
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to add node: ${errorMessage}`);
      throw new Error(`Failed to add node: ${errorMessage}`);
    }
  }

  /**
   * Deletes a node and reconnects its children to its parent(s)
   * @param bayesianNetworkId - The ID of the Bayesian Network
   * @param nodeId - The ID of the node to be deleted
   * @returns A promise with boolean confirmation
   */
  async deleteNodeAndReconnect(bayesianNetworkId: string, nodeId: string): Promise<boolean> {
    try {
      const graph = await this.bayesianNetworkGraphModel.findOne({ bayesianNetworkId });

      if (graph == null) {
        this.logger.error(`Graph with ID ${bayesianNetworkId} not found`);
        throw new Error(`Graph with ID ${bayesianNetworkId} not found`);
      }

      // Find the node's parents and children
      const parentEdges = graph.edges.filter((edge) => edge.target === nodeId);
      const childEdges = graph.edges.filter((edge) => edge.source === nodeId);

      if (parentEdges.length === 0 || childEdges.length === 0) {
        this.logger.error(`No parents or children found for node ${nodeId}`);
        throw new Error(`No parents or children found for node ${nodeId}`);
      }

      const parentIds = parentEdges.map((edge) => edge.source);
      const childIds = childEdges.map((edge) => edge.target);

      // Reconnect child nodes to parent nodes
      parentIds.forEach((parentId) => {
        childIds.forEach((childId) => {
          graph.edges.push({
            id: `${parentId}->${childId}`,
            source: parentId,
            target: childId,
            data: { label: `Reconnected ${parentId} to ${childId}` },
            animated: false,
            type: "default",
          });
        });
      });

      // Remove the node and its edges
      graph.nodes = graph.nodes.filter((node) => node.id !== nodeId);
      graph.edges = graph.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);

      await graph.save();
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to delete node and reconnect: ${errorMessage}`);
      throw new Error(`Failed to delete node and reconnect: ${errorMessage}`);
    }
  }

  /**
   * Updates the position of a bayesian node
   * @param nodeId - Node ID
   * @param position - New position of the node
   * @returns A promise with boolean confirmation
   */
  async updateNodePosition(nodeId: string, position: { x: number; y: number }): Promise<boolean> {
    try {
      const graph = await this.bayesianNetworkGraphModel.findOne({ "nodes.id": nodeId });

      if (graph == null) {
        this.logger.error(`Graph with node ${nodeId} not found`);
        throw new Error(`Graph with node ${nodeId} not found`);
      }

      const node = graph.nodes.find((node) => node.id === nodeId);
      if (node == null) {
        this.logger.error(`Node ${nodeId} not found`);
        throw new Error(`Node ${nodeId} not found`);
      }

      // Update the node position
      node.position = position;

      await graph.save();
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to update node position: ${errorMessage}`);
      throw new Error(`Failed to update node position: ${errorMessage}`);
    }
  }
}
