import * as mongoose from "mongoose";
import { HydratedDocument, Model } from "mongoose";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  EventSequenceDiagramGraph,
  EventSequenceDiagramGraphDocument,
} from "../schemas/graphs/event-sequence-diagram-graph.schema";
import {
  FaultTreeGraph,
  FaultTreeGraphDocument,
} from "../schemas/graphs/fault-tree-graph.schema";
import {
  BaseGraph,
  BaseGraphDocument,
} from "../schemas/graphs/base-graph.schema";
import {
  EventTreeGraph,
  EventTreeGraphDocument,
} from "../schemas/graphs/event-tree-graph.schema";

/**
 * Enum of supported graph types
 */
enum GraphTypes {
  EventSequence = "event-sequence",
  FaultTree = "fault-tree",
  EventTree = "event-tree",
}

@Injectable()
export class GraphModelService {
  constructor(
    @InjectModel(EventSequenceDiagramGraph.name)
    private readonly eventSequenceDiagramGraphModel: Model<EventSequenceDiagramGraphDocument>,
    @InjectModel(FaultTreeGraph.name)
    private readonly faultTreeGraphModel: Model<FaultTreeGraphDocument>,
    @InjectModel(EventTreeGraph.name)
    private readonly eventTreeGraphModel: Model<EventTreeGraphDocument>,
  ) {}

  /**
   * Saves the event sequence diagram graph
   * @param body - The current state of the event sequence diagram graph
   * @returns A promise with an event sequence diagram graph in it
   */
  async saveEventSequenceDiagramGraph(
    body: Partial<EventSequenceDiagramGraph>,
  ): Promise<BaseGraphDocument> {
    const existingGraph = await this.eventSequenceDiagramGraphModel.findOne({
      eventSequenceId: body.eventSequenceId,
    });
    return this.saveGraph(existingGraph, body, GraphTypes.EventSequence);
  }

  /**
   * Sets the event sequence diagram graph for the given event sequence ID
   * @param eventSequenceId - Event sequence ID
   * @returns A promise with the event sequence diagram graph
   */
  async getEventSequenceDiagramGraph(
    eventSequenceId: string,
  ): Promise<EventSequenceDiagramGraph> {
    const result = await this.eventSequenceDiagramGraphModel.findOne(
      { eventSequenceId: eventSequenceId },
      { _id: 0 },
    );
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
   * Saves the fault tree diagram graph
   * @param body - The current state of the fault tree diagram graph
   * @returns A promise with a fault tree diagram graph in it
   */
  async saveFaultTreeGraph(
    body: Partial<FaultTreeGraph>,
  ): Promise<BaseGraphDocument> {
    const existingGraph = await this.faultTreeGraphModel.findOne({
      faultTreeId: body.faultTreeId,
    });
    return this.saveGraph(existingGraph, body, GraphTypes.FaultTree);
  }

  /**
   * Sets the fault tree diagram graph for the given fault tree ID
   * @param faultTreeId - Fault tree ID
   * @returns A promise with the fault tree diagram graph
   */
  async getFaultTreeGraph(faultTreeId: string): Promise<FaultTreeGraph> {
    const result = this.faultTreeGraphModel.findOne(
      { faultTreeId: faultTreeId },
      { _id: 0 },
    );
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
  async saveEventTreeGraph(
    body: Partial<EventTreeGraph>,
  ): Promise<BaseGraphDocument> {
    const existingGraph = await this.eventTreeGraphModel.findOne({
      eventTreeId: body.eventTreeId,
    });
    return this.saveGraph(existingGraph, body, GraphTypes.EventTree);
  }

  /**
   * Sets the event tree diagram graph for the given event tree ID
   * @param eventTreeId - Event tree ID
   * @returns A promise with the event tree diagram graph
   */
  async getEventTreeGraph(eventTreeId: string): Promise<EventTreeGraph> {
    const result = this.eventTreeGraphModel.findOne(
      { eventTreeId: eventTreeId },
      { _id: 0 },
    );
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
   * Updates the label of the node/edge present in the data attribute
   * @param id - Node/Edge ID
   * @param type - 'node' or 'edge'
   * @param label - New label for the node/edge
   * @returns A promise with boolean confirmation of the update operation
   */
  async updateESLabel(
    id: string,
    type: string,
    label: string,
  ): Promise<boolean> {
    // check if type is valid
    if (!["node", "edge"].includes(type)) return false;

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
  }

  /**
   * Save the graph document
   * @param graph - Graph document
   * @param body - Model data
   * @param modelType - Type of graph model
   * @returns Graph document, after saving it in the database
   */
  private async saveGraph(
    graph: BaseGraphDocument,
    body: Partial<BaseGraph>,
    modelType: GraphTypes,
  ): Promise<BaseGraphDocument> {
    if (graph !== null) {
      graph.nodes = body.nodes;
      graph.edges = body.edges;
      await graph.save();
    } else {
      const newGraph = this.getModel(modelType, body);
      newGraph.id =
        new Date().getTime().toString(36) + Math.random().toString(36).slice(2);
      newGraph._id = new mongoose.Types.ObjectId();
      return newGraph.save();
    }
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
  ): HydratedDocument<BaseGraphDocument> {
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
}
