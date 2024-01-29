import {
  EventSequenceGraph,
  FaultTreeGraph,
} from "../types/reactflowGraph/Graph";
import AuthService from "./AuthService";

const API_ENDPOINT = "/api";
const GRAPH_ENDPOINT = `${API_ENDPOINT}/graph-models`;
const EVENT_SEQUENCE_DIAGRAMS_ENDPOINT = `${GRAPH_ENDPOINT}/event-sequence-diagram-graph`;
const FAULT_TREE_GRAPH_ENDPOINT = `${GRAPH_ENDPOINT}/fault-tree-graph`;

/**
 * Manager class to manage API calls of graph related endpoints
 */
export class GraphApiManager {
  OPTIONS = "no-cache";

  /**
   * Store (create/update) the fault tree graph based on the latest state of the graph
   * @param data - Current state of fault tree graph
   * @returns Updated fault tree graph
   */
  static async storeFaultTree(data: FaultTreeGraph): Promise<FaultTreeGraph> {
    return await this.post(`${FAULT_TREE_GRAPH_ENDPOINT}`, data)
      .then((res) => this.getFaultTreeResponse(res, data.faultTreeId))
      .catch((err) => {
        throw err;
      });
  }

  /**
   * Fetch the fault tree graph based on the fault tree id
   * @param faultTreeId - Fault tree id
   * @returns Latest fault tree graph
   */
  static async getFaultTree(faultTreeId = "-1"): Promise<FaultTreeGraph> {
    return await this.get(
      `${FAULT_TREE_GRAPH_ENDPOINT}/?faultTreeId=${faultTreeId}`,
    )
      .then((res) => this.getFaultTreeResponse(res, faultTreeId))
      .catch((error) => {
        throw error;
      });
  }

  /**
   * Store (create/update) the event sequence graph based on the latest state of the graph
   * @param data - Current state of event sequence graph
   * @returns Updated event sequence graph
   */
  static async storeEventSequence(
    data: EventSequenceGraph,
  ): Promise<EventSequenceGraph> {
    return await this.post(`${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}`, data)
      .then((res) => this.getEventSequenceResponse(res, data.eventSequenceId))
      .catch((err) => {
        throw err;
      });
  }

  /**
   * Fetch the event sequence graph based on the event sequence id
   * @param eventSequenceId - Event sequence id
   * @returns Latest event sequence graph
   */
  static async getEventSequence(
    eventSequenceId = "-1",
  ): Promise<EventSequenceGraph> {
    return await this.get(
      `${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}/?eventSequenceId=${eventSequenceId}`,
    )
      .then((res) => this.getEventSequenceResponse(res, eventSequenceId))
      .catch((error) => {
        throw error;
      });
  }

  /**
   * Make a POST call
   * @param url - URL endpoint
   * @param data - Graph data
   * @returns Response from API
   */
  private static post(
    url: string,
    data: EventSequenceGraph | FaultTreeGraph,
  ): Promise<Response> {
    return fetch(url, {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
      body: JSON.stringify(data),
    });
  }

  /**
   * Make a GET call
   * @param url - URL endpoint
   * @returns Response from API
   */
  private static get(url: string): Promise<Response> {
    return fetch(url, {
      method: "GET",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
    });
  }

  /**
   * Read the API response and parse the event sequence data
   * @param res - Response from API
   * @param eventSequenceId - Event sequence id
   * @returns EventSequenceGraph object, empty object if response is empty
   */
  private static async getEventSequenceResponse(
    res: Response,
    eventSequenceId: string,
  ): Promise<EventSequenceGraph> {
    const response = await res.text();
    return response === ""
      ? ({
          eventSequenceId: eventSequenceId,
          nodes: [],
          edges: [],
        } as EventSequenceGraph)
      : (JSON.parse(response) as EventSequenceGraph);
  }

  /**
   * Read the API response and parse the fault tree data
   * @param res - Response from API
   * @param faultTreeId - Fault tree id
   * @returns FaultTreeGraph object, empty object if response is empty
   */
  private static async getFaultTreeResponse(
    res: Response,
    faultTreeId: string,
  ): Promise<FaultTreeGraph> {
    const response = await res.text();
    return response === ""
      ? ({
          faultTreeId: faultTreeId,
          nodes: [],
          edges: [],
        } as FaultTreeGraph)
      : (JSON.parse(response) as FaultTreeGraph);
  }
}
