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
import { adaptFaultTreeGraphInput } from "../quantumReadiness/openPraFaultTreeGraph.adapter";

/**
 * Enum of supported graph types
 */
enum GraphTypes {
  EventSequence = "event-sequence",
  FaultTree = "fault-tree",
  EventTree = "event-tree",
}

/**
 * Service for graph model persistence and retrieval.
 * Handles create/update/get operations for supported graph types.
 * @public
 */
@Injectable()
export class GraphModelService {
  private readonly logger = new Logger(GraphModelService.name);

  /**
   * Construct the service with Mongoose models for each supported graph type.
   * @param eventSequenceDiagramGraphModel - Mongoose model for event sequence diagram graphs
   * @param faultTreeGraphModel - Mongoose model for fault tree graphs
   * @param eventTreeGraphModel - Mongoose model for event tree graphs
   */
  constructor(
    @InjectModel(EventSequenceDiagramGraph.name)
    private readonly eventSequenceDiagramGraphModel: Model<EventSequenceDiagramGraphDocument>,
    @InjectModel(FaultTreeGraph.name)
    private readonly faultTreeGraphModel: Model<FaultTreeGraphDocument>,
    @InjectModel(EventTreeGraph.name)
    private readonly eventTreeGraphModel: Model<EventTreeGraphDocument>,
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
      } as unknown as EventSequenceDiagramGraph;
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
      newGraph.nodes = defaultEventSequenceGraph.nodes as typeof newGraph.nodes;
      newGraph.edges = defaultEventSequenceGraph.edges as typeof newGraph.edges;
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
      const normalizedBody = adaptFaultTreeGraphInput(body as Record<string, unknown>);
      const existingGraph = await this.faultTreeGraphModel.findOne({
        faultTreeId: normalizedBody.faultTreeId,
      });
      return this.saveGraph(existingGraph, normalizedBody as Partial<BaseGraph>, GraphTypes.FaultTree);
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
    const result = await this.faultTreeGraphModel.findOne({ faultTreeId: faultTreeId }, { _id: 0 });
    if (result !== null) {
      const hasEmptyNodes = !Array.isArray(result.nodes) || result.nodes.length === 0;
      const hasEmptyEdges = !Array.isArray(result.edges) || result.edges.length === 0;

      if (hasEmptyNodes && hasEmptyEdges) {
        const defaults = this.getDefaultFaultTreeGraph();
        const hydrated = await this.faultTreeGraphModel.findOne({ faultTreeId: faultTreeId });

        if (hydrated) {
          hydrated.nodes = defaults.nodes as unknown as typeof hydrated.nodes;
          hydrated.edges = defaults.edges as unknown as typeof hydrated.edges;
          await hydrated.save();

          return {
            faultTreeId,
            nodes: defaults.nodes as unknown as FaultTreeGraph["nodes"],
            edges: defaults.edges as unknown as FaultTreeGraph["edges"],
          } as FaultTreeGraph;
        }
      }

      return result as unknown as FaultTreeGraph;
    } else {
      return {
        id: "",
        _id: new mongoose.Types.ObjectId(),
        faultTreeId: faultTreeId,
        nodes: [],
        edges: [],
      } as unknown as FaultTreeGraph;
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
    const result = await this.eventTreeGraphModel.findOne({ eventTreeId: eventTreeId }, { _id: 0 });
    if (result !== null) {
      return result as unknown as EventTreeGraph;
    } else {
      return {
        id: "",
        _id: new mongoose.Types.ObjectId(),
        eventTreeId: eventTreeId,
        nodes: [],
        edges: [],
      } as unknown as EventTreeGraph;
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
      if (!["node", "edge"].includes(type)) {
        this.logger.error(`Invalid type (${type}) provided to update label`);
        return false;
      }

      const attribute = type === "node" ? "nodes" : "edges";
      const filter: Record<string, unknown> = {};
      const set: Record<string, unknown> = {};

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

  /**
   * Apply partial updates to an Event Sequence Diagram graph.
   *
   * @param eventSequenceId - Event sequence diagram identifier
   * @param updatedSubgraph - Nodes/edges to add or replace
   * @param deletedSubgraph - Nodes/edges to remove
   * @returns True if an existing graph was updated; false if no graph exists for the id
   */
  async updateESSubgraph(
    eventSequenceId: string,
    updatedSubgraph: Partial<EventSequenceDiagramGraph>,
    deletedSubgraph: Partial<EventSequenceDiagramGraph>,
  ): Promise<boolean> {
    try {
      const existingGraph = await this.eventSequenceDiagramGraphModel.findOne({
        eventSequenceId: eventSequenceId,
      });

      if (existingGraph === null) {
        return false;
      }

      const updatedNodes = updatedSubgraph.nodes ?? [];
      const deletedNodes = deletedSubgraph.nodes ?? [];
      const updatedEdges = updatedSubgraph.edges ?? [];
      const deletedEdges = deletedSubgraph.edges ?? [];

      existingGraph.nodes = existingGraph.nodes
        .filter((node) => ![...deletedNodes, ...updatedNodes].some((n) => n.id === node.id))
        .concat(...updatedNodes);

      existingGraph.edges = existingGraph.edges
        .filter((edge) => ![...deletedEdges, ...updatedEdges].some((e) => e.id === edge.id))
        .concat(...updatedEdges);

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
    type AnyGraphDocument = EventSequenceDiagramGraphDocument | FaultTreeGraphDocument | EventTreeGraphDocument;
    const doc = graph as AnyGraphDocument | null;

    if (doc !== null) {
      if (body.nodes !== undefined) {
        (doc as any).nodes = body.nodes as any;
      }

      if (body.edges !== undefined) {
        (doc as any).edges = body.edges as any;
      }

      await (doc as any).save();
    } else {
      const newGraph = this.getModel(modelType, body);

      if (
        modelType === GraphTypes.FaultTree &&
        (body.nodes === undefined || body.nodes.length === 0) &&
        (body.edges === undefined || body.edges.length === 0)
      ) {
        const defaults = this.getDefaultFaultTreeGraph();
        (newGraph as any).nodes = defaults.nodes as any;
        (newGraph as any).edges = defaults.edges as any;
      }

      (newGraph as any).id = new Date().getTime().toString(36) + Math.random().toString(36).slice(2);
      (newGraph as any)._id = new mongoose.Types.ObjectId();
      await (newGraph as any).save();
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
  private getModel(
    modelType: GraphTypes,
    body: Partial<BaseGraph>,
  ): HydratedDocument<EventSequenceDiagramGraphDocument | FaultTreeGraphDocument | EventTreeGraphDocument> {
    switch (modelType) {
      case GraphTypes.EventSequence:
        return new this.eventSequenceDiagramGraphModel(body);
      case GraphTypes.FaultTree:
        return new this.faultTreeGraphModel(body);
      case GraphTypes.EventTree:
        return new this.eventTreeGraphModel(body);
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
        position: { x: 250, y: 0 },
        type: "functional",
      },
      {
        id: firstEndStateId,
        data: {
          label: "End State",
        },
        position: { x: 500, y: -100 },
        type: "endstate",
      },
      {
        id: secondEndStateId,
        data: {
          label: "End State",
        },
        position: { x: 500, y: 100 },
        type: "endstate",
      },
    ];

    const defaultEdges: GraphEdge<object>[] = [
      {
        id: this.generateUUID(),
        source: initiatingEventId,
        target: functionalEventId,
        type: "default",
        animated: false,
        data: { label: "" },
      },
      {
        id: this.generateUUID(),
        source: functionalEventId,
        target: firstEndStateId,
        type: "success",
        animated: false,
        data: { label: "Success" },
      },
      {
        id: this.generateUUID(),
        source: functionalEventId,
        target: secondEndStateId,
        type: "failure",
        animated: false,
        data: { label: "Failure" },
      },
    ];

    return {
      nodes: defaultNodes as unknown as EventSequenceDiagramGraphDocument["nodes"],
      edges: defaultEdges as unknown as EventSequenceDiagramGraphDocument["edges"],
    };
  }

  private getDefaultFaultTreeGraph(): Partial<FaultTreeGraphDocument> {
    const topId = "TOP";
    const basicId = "A";

    const defaultNodes: GraphNode<object>[] = [
      {
        id: topId,
        data: {
          label: { name: "Top Gate" },
          gateType: "OR",
          isTop: true,
        },
        position: { x: 0, y: 0 },
        type: "gate",
      },
      {
        id: basicId,
        data: {
          label: { name: "Basic Event A" },
        },
        position: { x: 0, y: 120 },
        type: "basicEvent",
      },
    ];

    const defaultEdges: GraphEdge<object>[] = [
      {
        id: `${topId}__${basicId}`,
        source: topId,
        target: basicId,
        type: "default",
        animated: false,
        data: { label: "" },
      },
    ];

    return {
      nodes: defaultNodes as unknown as FaultTreeGraphDocument["nodes"],
      edges: defaultEdges as unknown as FaultTreeGraphDocument["edges"],
    };
  }
}
