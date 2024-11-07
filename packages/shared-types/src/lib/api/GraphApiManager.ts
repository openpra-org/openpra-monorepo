interface AddNodePayload {
  bayesianNetworkId: string;
  parentNodeId: string;
  newNode: {
    id: string;
    label?: string;
    position: { x: number; y: number };
  };
}

import {
  EventSequenceGraph,
  EventTreeGraph,
  FaultTreeGraph,
  BayesianNetworkGraph,
} from "../types/reactflowGraph/Graph";
import { AuthService } from "./AuthService";

const ApiEndpoint = "/api";
const GraphEndpoint = `${ApiEndpoint}/graph-models`;
const EventSequenceDiagramEndpoint = `${GraphEndpoint}/event-sequence-diagram-graph`;
const FaultTreeGraphEndpoint = `${GraphEndpoint}/fault-tree-graph`;
const EventTreeGraphEndpoint = `${GraphEndpoint}/event-tree-graph`;
const BayesianNetworkGraphEndpoint = `${GraphEndpoint}/bayesian-network-graph`;

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
    return await this.post(FaultTreeGraphEndpoint, data)
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
    return await this.post(EventTreeGraphEndpoint, data)
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
   * Store (create/update) the bayesian network graph based on the latest state of the graph
   * @param data - Current state of bayesian network graph
   * @returns Updated bayesian network graph
   */
  static async storeBayesianNetwork(data: BayesianNetworkGraph): Promise<BayesianNetworkGraph> {
    return await this.post(BayesianNetworkGraphEndpoint, data)
      .then((res) => this.getBayesianNetworkResponse(res, data.bayesianNetworkId))
      .catch((err) => {
        throw err;
      });
  }

  /**
   * Fetch the bayesian network graph based on the bayesian network id
   * @param bayesianNetworkId - Bayesian network id
   * @returns Latest bayesian network graph
   */
  static async getBayesianNetwork(bayesianNetworkId = "-1"): Promise<BayesianNetworkGraph> {
    return await this.get(`${BayesianNetworkGraphEndpoint}/?bayesianNetworkId=${bayesianNetworkId}`)
      .then((res) => this.getBayesianNetworkResponse(res, bayesianNetworkId))
      .catch((error) => {
        throw error;
      });
  }
  /**
   * Updates the label of a node in the bayesian network.
   * @param nodeId - ID of the node to update.
   * @param label - New label for the node.
   * @returns A boolean indicating if the update was successful.
   */
  static async updateBayesianNodeLabel(nodeId: string, label: string): Promise<boolean> {
    const url = `${BayesianNetworkGraphEndpoint}/update-node-label`;
    return await this.patch<{ nodeId: string; label: string }>(url, { nodeId, label })
      .then((res) => res.ok)
      .catch((error) => {
        throw error;
      });
  }
  /**
   * Deletes a node from the bayesian network graph.
   * @param bayesianNetworkId - ID of the bayesian network graph.
   * @param nodeId - ID of the node to delete.
   * @returns A boolean indicating if the deletion was successful.
   */
  static async deleteNodeFromBayesianNetwork(bayesianNetworkId: string, nodeId: string): Promise<boolean> {
    const url = `${BayesianNetworkGraphEndpoint}/delete-node`;
    return await this.delete<{ bayesianNetworkId: string; nodeId: string }>(url, { bayesianNetworkId, nodeId })
      .then((res) => res.ok)
      .catch((error) => {
        throw error;
      });
  }

  /**
   * Adds a new node to the bayesian network graph.
   * @param bayesianNetworkId - ID of the bayesian network graph.
   * @param parentId - ID of the parent node.
   * @param newNode - Object with node details.
   * @returns A boolean indicating if the node was added successfully.
   */
  static async addNodeToBayesianNetwork(
    bayesianNetworkId: string,
    parentId: string,
    newNode: { id: string; label?: string; position: { x: number; y: number } },
  ): Promise<boolean> {
    const url = `${BayesianNetworkGraphEndpoint}/add-node`;
    const payload: AddNodePayload = {
      bayesianNetworkId,
      parentNodeId: parentId,
      newNode,
    };

    return await this.post(url, payload)
      .then((res) => res.ok)
      .catch((error) => {
        throw error;
      });
  }

  /**
   * Updates the position of a node in the bayesian network graph.
   * @param nodeId - ID of the node.
   * @param position - New position for the node.
   * @returns A boolean indicating if the update was successful.
   */
  static async updateNodePosition(nodeId: string, position: { x: number; y: number }): Promise<boolean> {
    const url = `${BayesianNetworkGraphEndpoint}/update-node-position`;
    return await this.patch(url, { nodeId, position })
      .then((res) => res.ok)
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
    }>(EventSequenceDiagramEndpoint, {
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
  private static post(
    url: string,
    data: EventSequenceGraph | FaultTreeGraph | EventTreeGraph | BayesianNetworkGraph | AddNodePayload,
  ): Promise<Response> {
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

  /**
   * Makes a DELETE call to the specified URL with the provided data.
   * @param url - The URL endpoint for the DELETE request.
   * @param data - The data to be sent in the request body.
   * @returns The response from the API.
   */

  private static delete<T>(url: string, data: T): Promise<Response> {
    return fetch(url, this.getRequestInfo("DELETE", JSON.stringify(data)));
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

  /**
   * Read the API response and parse the bayesian network data
   * @param res - Response from API
   * @param bayesianNetworkId - Bayesian Network id
   * @returns BayesianNetwork object, empty object if response is empty
   */
  private static async getBayesianNetworkResponse(
    res: Response,
    bayesianNetworkId: string,
  ): Promise<BayesianNetworkGraph> {
    const response = await res.text();
    return response === ""
      ? ({
          bayesianNetworkId: bayesianNetworkId,
          nodes: [],
          edges: [],
        } as BayesianNetworkGraph)
      : (JSON.parse(response) as BayesianNetworkGraph);
  }
}
