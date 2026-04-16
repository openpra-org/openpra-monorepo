import { EventSequenceGraph, EventTreeGraph, FaultTreeGraph } from "shared-types/src/lib/types/reactflowGraph/Graph";
import type {
  FaultTreeQuantificationRequest,
  FaultTreeQuantificationResult,
} from "shared-types/src/lib/types/faultTreeQuantification";
import type {
  EventTreeQuantificationRequest,
  EventTreeQuantificationResult,
} from "shared-types/src/lib/types/eventTreeQuantification";
import { AuthService } from "./AuthService";

const ApiEndpoint = "/api";
const GraphEndpoint = `${ApiEndpoint}/graph-models`;
const EventSequenceDiagramEndpoint = `${GraphEndpoint}/event-sequence-diagram-graph`;
const FaultTreeGraphEndpoint = `${GraphEndpoint}/fault-tree-graph`;
const EventTreeGraphEndpoint = `${GraphEndpoint}/event-tree-graph`;

export class GraphApiManager {
  OPTIONS = "no-cache";

  static async storeFaultTree(data: FaultTreeGraph): Promise<FaultTreeGraph> {
    return await this.post(FaultTreeGraphEndpoint, data)
      .then((res) => this.getFaultTreeResponse(res, data.faultTreeId))
      .catch((err) => {
        throw err;
      });
  }

  static async getFaultTree(faultTreeId = "-1"): Promise<FaultTreeGraph> {
    return await this.get(`${FaultTreeGraphEndpoint}/?faultTreeId=${faultTreeId}`)
      .then((res) => this.getFaultTreeResponse(res, faultTreeId))
      .catch((error) => {
        throw error;
      });
  }

  static async getEventSequence(eventSequenceId = "-1"): Promise<EventSequenceGraph> {
    return await this.get(`${EventSequenceDiagramEndpoint}/?eventSequenceId=${eventSequenceId}`)
      .then((res) => this.getEventSequenceResponse(res, eventSequenceId))
      .catch((error) => {
        throw error;
      });
  }

  static async storeEventTree(data: EventTreeGraph): Promise<EventTreeGraph> {
    return await this.post(EventTreeGraphEndpoint, data)
      .then((res) => this.getEventTreeResponse(res, data.eventTreeId))
      .catch((err) => {
        throw err;
      });
  }

  static async getEventTree(eventTreeId = "-1"): Promise<EventTreeGraph> {
    return await this.get(`${EventTreeGraphEndpoint}/?eventTreeId=${eventTreeId}`)
      .then((res) => this.getEventTreeResponse(res, eventTreeId))
      .catch((error) => {
        throw error;
      });
  }

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

  static async quantifyFaultTree(
    faultTreeId: string,
    options: Omit<FaultTreeQuantificationRequest, "graph">,
  ): Promise<FaultTreeQuantificationResult> {
    const url = `${FaultTreeGraphEndpoint}/quantify?faultTreeId=${encodeURIComponent(faultTreeId)}`;
    const res = await fetch(url, this.getRequestInfo("POST", JSON.stringify(options)));
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(msg);
    }
    return res.json() as Promise<FaultTreeQuantificationResult>;
  }

  static async quantifyEventTree(
    eventTreeId: string,
    options: Omit<EventTreeQuantificationRequest, "graph">,
  ): Promise<EventTreeQuantificationResult> {
    const url = `${EventTreeGraphEndpoint}/quantify?eventTreeId=${encodeURIComponent(eventTreeId)}`;
    const res = await fetch(url, this.getRequestInfo("POST", JSON.stringify(options)));
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(msg);
    }
    return res.json() as Promise<EventTreeQuantificationResult>;
  }

  private static post(url: string, data: EventSequenceGraph | FaultTreeGraph | EventTreeGraph): Promise<Response> {
    return fetch(url, this.getRequestInfo("POST", JSON.stringify(data)));
  }

  private static get(url: string): Promise<Response> {
    return fetch(url, this.getRequestInfo("GET"));
  }

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

  private static async getEventSequenceResponse(res: Response, eventSequenceId: string): Promise<EventSequenceGraph> {
    const response = await res.text();
    return response === "" ?
        ({
          eventSequenceId: eventSequenceId,
          nodes: [],
          edges: [],
        } as EventSequenceGraph)
      : (JSON.parse(response) as EventSequenceGraph);
  }

  private static async getEventSequenceBooleanResponse(res: Response): Promise<boolean> {
    const response = await res.text();
    return response === "true";
  }

  private static async getFaultTreeResponse(res: Response, faultTreeId: string): Promise<FaultTreeGraph> {
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      throw new Error(`storeFaultTree/getFaultTree failed [${String(res.status)}]: ${body}`);
    }
    const response = await res.text();
    if (response === "" || response === "true" || response === "false") {
      return { faultTreeId, topEventId: "", nodes: {} } as FaultTreeGraph;
    }
    return JSON.parse(response) as FaultTreeGraph;
  }

  private static async getEventTreeResponse(res: Response, eventTreeId: string): Promise<EventTreeGraph> {
    const response = await res.text();
    return response === "" ?
        ({
          eventTreeId: eventTreeId,
          nodes: [],
          edges: [],
        } as EventTreeGraph)
      : (JSON.parse(response) as EventTreeGraph);
  }
}
