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

/** Shape of the MEF fault tree graph payload (wire format) */
interface FaultTreeMEFPayload {
  faultTreeId: string;
  topEventId?: string;
  nodes?: Record<string, object>;
}

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
   * Saves the fault tree diagram graph in MEF format.
   * @param body - MEF fault tree payload (faultTreeId, topEventId, nodes)
   * @returns true on success
   */
  async saveFaultTreeGraph(body: FaultTreeMEFPayload): Promise<boolean> {
    try {
      const existing = await this.faultTreeGraphModel.findOne({ faultTreeId: body.faultTreeId });
      if (existing !== null) {
        if (body.topEventId !== undefined) existing.topEventId = body.topEventId;
        if (body.nodes !== undefined) (existing as any).nodes = body.nodes;
        await existing.save();
      } else {
        const defaults = this.getDefaultFaultTreeGraph();
        const doc = new this.faultTreeGraphModel({
          id: this.generateUUID(),
          _id: new mongoose.Types.ObjectId(),
          faultTreeId: body.faultTreeId,
          topEventId: body.topEventId ?? defaults.topEventId,
          nodes: body.nodes ?? defaults.nodes,
        });
        await doc.save();
      }
      return true;
    } catch (exception) {
      const error = exception as Error;
      this.logger.error(error.message, error.stack);
      throw new Error();
    }
  }

  /**
   * Retrieves the fault tree graph in MEF format for the given fault tree ID.
   * Returns an empty MEF graph if no document exists yet.
   * @param faultTreeId - Fault tree ID
   */
  async getFaultTreeGraph(faultTreeId: string): Promise<FaultTreeGraph> {
    const result = await this.faultTreeGraphModel.findOne({ faultTreeId }, { _id: 0 });
    if (result !== null) {
      // Migration guard: old documents stored nodes as an array — treat as empty.
      const nodesIsArray = Array.isArray((result as any).nodes);
      const hasNodes = !nodesIsArray && result.nodes != null && Object.keys(result.nodes).length > 0;
      if (!hasNodes) {
        const defaults = this.getDefaultFaultTreeGraph();
        const hydrated = await this.faultTreeGraphModel.findOne({ faultTreeId });
        if (hydrated) {
          hydrated.topEventId = defaults.topEventId;
          (hydrated as any).nodes = defaults.nodes;
          await hydrated.save();
        }
        return { faultTreeId, topEventId: defaults.topEventId, nodes: defaults.nodes } as unknown as FaultTreeGraph;
      }
      return result as unknown as FaultTreeGraph;
    }
    return { faultTreeId, topEventId: "", nodes: {} } as unknown as FaultTreeGraph;
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

  /**
   * Apply partial updates to an Event Sequence Diagram graph.
   * Removes nodes/edges present in the deleted set, then upserts those in the updated set.
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
   * Save a graph document for event-sequence or event-tree types.
   * Fault tree graphs are handled separately via saveFaultTreeGraph.
   */
  private async saveGraph(graph: BaseGraphDocument, body: Partial<BaseGraph>, modelType: GraphTypes): Promise<boolean> {
    type AnyGraphDocument = EventSequenceDiagramGraphDocument | EventTreeGraphDocument;
    const doc = graph as AnyGraphDocument | null;
    if (doc !== null) {
      if (body.nodes !== undefined) (doc as any).nodes = body.nodes as any;
      if (body.edges !== undefined) (doc as any).edges = body.edges as any;
      await (doc as any).save();
    } else {
      const newGraph = this.getModel(modelType, body);
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
  ): HydratedDocument<EventSequenceDiagramGraphDocument | EventTreeGraphDocument> {
    switch (modelType) {
      case GraphTypes.EventSequence:
        return new this.eventSequenceDiagramGraphModel(body);
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

  /** Default MEF fault tree: one OR gate (id "1") with two basic-event children (id "2", "3"). */
  private getDefaultFaultTreeGraph(): { topEventId: string; nodes: Record<string, object> } {
    return {
      topEventId: "1",
      nodes: {
        "1": {
          uuid: "1",
          nodeType: "OR_GATE",
          name: "OR Gate",
          description: "",
          inputs: ["2", "3"],
          probabilityType: "constant",
          position: { x: 0, y: 0 },
        },
        "2": {
          uuid: "2",
          nodeType: "BASIC_EVENT",
          name: "Basic Event",
          description: "",
          probabilityType: "constant",
          probability: 0,
          position: { x: 0, y: 150 },
        },
        "3": {
          uuid: "3",
          nodeType: "BASIC_EVENT",
          name: "Basic Event",
          description: "",
          probabilityType: "constant",
          probability: 0,
          position: { x: 0, y: 150 },
        },
      },
    };
  }
}
