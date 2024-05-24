import { EventSequenceGraph, EventTreeGraph, FaultTreeGraph } from "../types/reactflowGraph/Graph";
import { AuthService } from "./AuthService";

const ApiEndpoint = "/api";
const GraphEndpoint = `${ApiEndpoint}/graph-models`;
const EventSequenceDiagramEndpoint = `${GraphEndpoint}/event-sequence-diagram-graph`;
const FaultTreeGraphEndpoint = `${GraphEndpoint}/fault-tree-graph`;
const EventTreeGraphEndpoint = `${GraphEndpoint}/event-tree-graph`;

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
    return await this.post(`${FaultTreeGraphEndpoint}`, data)
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
    return await this.get(`${FaultTreeGraphEndpoint}/?faultTreeId=${faultTreeId}`)
      .then((res) => this.getFaultTreeResponse(res, faultTreeId))
      .catch((error) => {
        throw error;
      });
  }

  /**
   * Fetch the event sequence graph based on the event sequence id
   * @param eventSequenceId - Event sequence id
   * @returns Latest event sequence graph
   */
  static async getEventSequence(eventSequenceId = "-1"): Promise<EventSequenceGraph> {
    return await this.get(`${EventSequenceDiagramEndpoint}/?eventSequenceId=${eventSequenceId}`)
      .then((res) => this.getEventSequenceResponse(res, eventSequenceId))
      .catch((error) => {
        throw error;
      });
  }

  /**
   * Store (create/update) the event tree graph based on the latest state of the graph
   * @param data - Current state of fault tree graph
   * @returns Updated fault tree graph
   */
  static async storeEventTree(data: EventTreeGraph): Promise<EventTreeGraph> {
    return await this.post(`${EventTreeGraphEndpoint}`, data)
      .then((res) => this.getEventTreeResponse(res, data.eventTreeId))
      .catch((err) => {
        throw err;
      });
  }

  /**
   * Fetch the fault tree graph based on the fault tree id
   * @param eventTreeId - Fault tree id
   * @returns Latest fault tree graph
   */
  static async getEventTree(eventTreeId = "-1"): Promise<EventTreeGraph> {
    return await this.get(`${EventTreeGraphEndpoint}/?eventTreeId=${eventTreeId}`)
      .then((res) => this.getEventTreeResponse(res, eventTreeId))
      .catch((error) => {
        throw error;
      });
  }

  /**
   * Update the label of a node or edge for an event sequence diagram
   * @param id - Node/Edge ID
   * @param label - New label
   * @param type - 'node' or 'edge' for which the label needs to be updated
   * @returns boolean confirmation whether update was successful or not
   */
  static async updateESLabel(id: string, label: string, type: string): Promise<boolean> {
    const url = `${EventSequenceDiagramEndpoint}/update-label/`;
    return await this.patch<{ id: string; type: string; label: string }>(url, {
      id: id,
      type: type,
      label: label,
    })
      .then((res) => this.getEventSequenceBooleanResponse(res))
      .catch((error) => {
        throw error;
      });
  }

  static async updateESSubgraph(
    eventSequenceId: string,
    updatedSubgraph: EventSequenceGraph,
    deletedSubgraph: EventSequenceGraph,
  ): Promise<boolean> {
    return await this.patch<{
      eventSequenceId: string;
      updated: EventSequenceGraph;
      deleted: EventSequenceGraph;
    }>(`${EventSequenceDiagramEndpoint}`, {
      eventSequenceId: eventSequenceId,
      updated: updatedSubgraph,
      deleted: deletedSubgraph,
    })
      .then((res) => this.getEventSequenceBooleanResponse(res))
      .catch((err) => {
        throw err;
      });
  }

  /**
   * Make a POST call
   * @param url - URL endpoint
   * @param data - Graph data
   * @returns Response from API
   */
  private static post(url: string, data: EventSequenceGraph | FaultTreeGraph | EventTreeGraph): Promise<Response> {
    return fetch(url, this.getRequestInfo("POST", JSON.stringify(data)));
  }

  /**
   * Make a GET call
   * @param url - URL endpoint
   * @returns Response from API
   */
  private static get(url: string): Promise<Response> {
    return fetch(url, this.getRequestInfo("GET"));
  }

  /**
   * Make a PATCH call
   * @param url - URL endpoint
   * @param data - Patch data
   * @returns Response from API - boolean
   */
  private static patch<T>(url: string, data: T): Promise<Response> {
    return fetch(url, this.getRequestInfo("PATCH", JSON.stringify(data)));
  }

  private static getRequestInfo(method: "POST" | "GET" | "DELETE" | "PATCH" | "PUT", data?: BodyInit): RequestInit {
    return {
      method: method,
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
      body: data,
    };
  }

  /**
   * Read the API response and parse the event sequence data
   * @param res - Response from API
   * @param eventSequenceId - Event sequence id
   * @returns EventSequenceGraph object, empty object if response is empty
   */
  private static async getEventSequenceResponse(res: Response, eventSequenceId: string): Promise<EventSequenceGraph> {
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
   * Read the API response and return boolean value to indicate successful operation
   * @param res - Response from API
   * @returns boolean, false if response is empty
   */
  private static async getEventSequenceBooleanResponse(res: Response): Promise<boolean> {
    const response = await res.text();
    return response === "true";
  }

  /**
   * Read the API response and parse the fault tree data
   * @param res - Response from API
   * @param faultTreeId - Fault tree id
   * @returns FaultTreeGraph object, empty object if response is empty
   */
  private static async getFaultTreeResponse(res: Response, faultTreeId: string): Promise<FaultTreeGraph> {
    const response = await res.text();
    return response === ""
      ? ({
          faultTreeId: faultTreeId,
          nodes: [],
          edges: [],
        } as FaultTreeGraph)
      : (JSON.parse(response) as FaultTreeGraph);
  }

  /**
   * Read the API response and parse the fault tree data
   * @param res - Response from API
   * @param eventTreeId - Event tree id
   * @returns FaultTreeGraph object, empty object if response is empty
   */
  private static async getEventTreeResponse(res: Response, eventTreeId: string): Promise<EventTreeGraph> {
    const response = await res.text();
    return response === ""
      ? ({
          eventTreeId: eventTreeId,
          nodes: [],
          edges: [],
        } as EventTreeGraph)
      : (JSON.parse(response) as EventTreeGraph);
  }
}
