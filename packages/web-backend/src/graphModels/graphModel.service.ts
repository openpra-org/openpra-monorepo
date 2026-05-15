import * as mongoose from "mongoose";
import { Model } from "mongoose";
import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { GraphEdge } from "shared-types/src/lib/types/reactflowGraph/GraphEdge";
import { GraphNode } from "shared-types/src/lib/types/reactflowGraph/GraphNode";
import type {
  FaultTreeQuantificationRequest,
  FaultTreeQuantificationResult,
  FaultTreeMetadataResult,
} from "shared-types/src/lib/types/faultTreeQuantification";
import type {
  EventTreeQuantificationRequest,
  EventTreeQuantificationResult,
  EventTreeMetadataResult,
} from "shared-types/src/lib/types/eventTreeQuantification";
import {
  EventSequenceDiagramGraph,
  EventSequenceDiagramGraphDocument,
} from "../schemas/graphs/event-sequence-diagram-graph.schema";
import { FaultTreeGraph, FaultTreeGraphDocument } from "../schemas/graphs/fault-tree-graph.schema";
import { EventTreeGraph, EventTreeGraphDocument } from "../schemas/graphs/event-tree-graph.schema";
interface FaultTreeMEFPayload {
  faultTreeId: string;
  topEventId?: string;
  nodes?: Record<string, object>;
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
  ) {}
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
  async saveFaultTreeGraph(body: FaultTreeMEFPayload): Promise<boolean> {
    try {
      const $set: Record<string, unknown> = { faultTreeId: body.faultTreeId };
      if (body.topEventId !== undefined) $set["topEventId"] = body.topEventId;
      if (body.nodes !== undefined) $set["nodes"] = body.nodes;
      const $setOnInsert: Record<string, unknown> = {
        id: this.generateUUID(),
      };
      await this.faultTreeGraphModel.findOneAndUpdate(
        { faultTreeId: body.faultTreeId },
        { $set, $setOnInsert },
        { upsert: true, new: true },
      );
      return true;
    } catch (exception) {
      const error = exception as Error;
      this.logger.error(error.message, error.stack);
      throw new Error();
    }
  }
  async getFaultTreeGraph(faultTreeId: string): Promise<FaultTreeGraph> {
    const result = await this.faultTreeGraphModel.findOne({ faultTreeId }).lean();
    if (result !== null) {
      return result as unknown as FaultTreeGraph;
    }
    return { faultTreeId, topEventId: "", nodes: {} } as unknown as FaultTreeGraph;
  }
  async saveEventTreeGraph(body: Partial<EventTreeGraph>): Promise<boolean> {
    try {
      const existing = await this.eventTreeGraphModel.findOne({ eventTreeId: body.eventTreeId });
      if (existing !== null) {
        if (body.nodes !== undefined) existing.nodes = body.nodes;
        if (body.edges !== undefined) existing.edges = body.edges;
        if (body.initiatingEventId !== undefined) existing.initiatingEventId = body.initiatingEventId;
        if (body.initiatingEventFrequency !== undefined)
          existing.initiatingEventFrequency = body.initiatingEventFrequency;
        if (body.functionalEvents !== undefined) existing.functionalEvents = body.functionalEvents;
        if (body.sequences !== undefined) existing.sequences = body.sequences;
        await existing.save();
      } else {
        const newGraph = new this.eventTreeGraphModel(body);
        newGraph.id = this.generateUUID();
        newGraph._id = new mongoose.Types.ObjectId();
        await newGraph.save();
      }
      return true;
    } catch (exception) {
      const error = exception as Error;
      this.logger.error(error.message, error.stack);
      throw new Error();
    }
  }
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
  async updateESLabel(id: string, type: string, label: string): Promise<boolean> {
    try {
      if (!["node", "edge"].includes(type)) {
        this.logger.error(`Invalid type (${type}) provided to update label`);
        return false;
      }
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
  async analyzeFaultTree(faultTreeId: string): Promise<FaultTreeMetadataResult> {
    const graph = await this.getFaultTreeGraph(faultTreeId);
    const transferTrees = await this.collectTransferTrees(
      graph.nodes as unknown as Record<
        string,
        {
          nodeType: string;
          transferTreeId?: string;
        }
      >,
      new Set<string>([faultTreeId]),
    );
    const request = {
      graph: graph as unknown as FaultTreeQuantificationRequest["graph"],
      transferTrees: transferTrees as unknown as FaultTreeQuantificationRequest["transferTrees"],
    };
    let praxis: {
      getFaultTreeMetadata: (json: string) => string;
    };
    try {
      praxis = require("praxis-node") as typeof praxis;
    } catch {
      throw new Error("praxis-node not available");
    }
    const resultJson = praxis.getFaultTreeMetadata(JSON.stringify(request));
    return JSON.parse(resultJson) as FaultTreeMetadataResult;
  }
  async quantifyFaultTree(
    faultTreeId: string,
    options: Omit<FaultTreeQuantificationRequest, "graph">,
  ): Promise<FaultTreeQuantificationResult> {
    const graph = await this.getFaultTreeGraph(faultTreeId);
    const transferTrees = await this.collectTransferTrees(
      graph.nodes as unknown as Record<
        string,
        {
          nodeType: string;
          transferTreeId?: string;
        }
      >,
      new Set<string>([faultTreeId]),
    );
    const request: FaultTreeQuantificationRequest = {
      graph: graph as unknown as FaultTreeQuantificationRequest["graph"],
      transferTrees: transferTrees as unknown as FaultTreeQuantificationRequest["transferTrees"],
      ...options,
    };
    let praxis: {
      quantifyFaultTree: (json: string) => string;
    };
    try {
      praxis = require("praxis-node") as typeof praxis;
    } catch {
      const hint =
        "The praxis-node native addon is not built. " +
        "Run: cd packages/engine/praxis && cargo build --features napi-rs --release " +
        "&& cp target/release/libpraxis.so praxis.node";
      throw new Error(`praxis-node not available: ${hint}`);
    }
    const resultJson = praxis.quantifyFaultTree(JSON.stringify(request));
    return JSON.parse(resultJson) as FaultTreeQuantificationResult;
  }
  async quantifyEventTree(
    eventTreeId: string,
    options: Omit<EventTreeQuantificationRequest, "graph">,
  ): Promise<EventTreeQuantificationResult> {
    const graph = await this.getEventTreeGraph(eventTreeId);
    const faultTreeIds = new Set<string>();
    for (const node of graph.nodes) {
      if (
        (
          node.data as {
            faultTreeId?: string;
          }
        )?.faultTreeId
      ) {
        faultTreeIds.add(
          (
            node.data as {
              faultTreeId: string;
            }
          ).faultTreeId,
        );
      }
    }
    if (graph.functionalEvents) {
      for (const fe of Object.values(graph.functionalEvents)) {
        if (fe.faultTreeId) faultTreeIds.add(fe.faultTreeId);
      }
    }
    const faultTrees: Record<string, object> = {};
    for (const ftId of faultTreeIds) {
      faultTrees[ftId] = await this.getFaultTreeGraph(ftId);
    }
    const request = {
      graph: graph as unknown as EventTreeQuantificationRequest["graph"],
      faultTrees,
      ...options,
    };
    let praxis: {
      quantifyEventTree: (json: string) => string;
    };
    try {
      praxis = require("praxis-node") as typeof praxis;
    } catch {
      const hint =
        "The praxis-node native addon is not built. " +
        "Run: cd packages/engine/praxis && cargo build --features napi-rs --release " +
        "&& cp target/release/libpraxis.so praxis.node";
      throw new Error(`praxis-node not available: ${hint}`);
    }
    const resultJson = praxis.quantifyEventTree(JSON.stringify(request));
    return JSON.parse(resultJson) as EventTreeQuantificationResult;
  }
  async analyzeEventTree(eventTreeId: string): Promise<EventTreeMetadataResult> {
    const graph = await this.getEventTreeGraph(eventTreeId);
    const faultTreeIds = new Set<string>();
    if (graph.functionalEvents) {
      for (const fe of Object.values(graph.functionalEvents)) {
        if (fe.faultTreeId) faultTreeIds.add(fe.faultTreeId);
      }
    }
    const faultTrees: Record<string, object> = {};
    for (const ftId of faultTreeIds) {
      faultTrees[ftId] = await this.getFaultTreeGraph(ftId);
    }
    const request = {
      graph: graph as unknown as EventTreeQuantificationRequest["graph"],
      faultTrees,
    };
    let praxis: {
      getEventTreeMetadata: (json: string) => string;
    };
    try {
      praxis = require("praxis-node") as typeof praxis;
    } catch {
      throw new Error("praxis-node not available");
    }
    const resultJson = praxis.getEventTreeMetadata(JSON.stringify(request));
    return JSON.parse(resultJson) as EventTreeMetadataResult;
  }
  private async collectTransferTrees(
    nodes: Record<
      string,
      {
        nodeType: string;
        transferTreeId?: string;
      }
    >,
    visited: Set<string>,
  ): Promise<Record<string, object>> {
    const result: Record<string, object> = {};
    for (const node of Object.values(nodes)) {
      if ((node.nodeType === "TRANSFER_OUT" || node.nodeType === "TRANSFER_IN") && node.transferTreeId) {
        const refId = node.transferTreeId;
        if (visited.has(refId)) continue;
        visited.add(refId);
        const refGraph = await this.getFaultTreeGraph(refId);
        result[refId] = refGraph;
        const nested = await this.collectTransferTrees(
          refGraph.nodes as unknown as Record<
            string,
            {
              nodeType: string;
              transferTreeId?: string;
            }
          >,
          visited,
        );
        Object.assign(result, nested);
      }
    }
    return result;
  }
  private getDefaultFaultTreeGraph(): {
    topEventId: string;
    nodes: Record<string, object>;
  } {
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
