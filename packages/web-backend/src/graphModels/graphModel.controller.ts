import { Body, Controller, Get, HttpException, HttpStatus, Patch, Post, Query } from "@nestjs/common";
import { EventSequenceDiagramGraph } from "../schemas/graphs/event-sequence-diagram-graph.schema";
import { FaultTreeGraph } from "../schemas/graphs/fault-tree-graph.schema";
import { EventTreeGraph } from "../schemas/graphs/event-tree-graph.schema";
import { BaseGraph } from "../schemas/graphs/base-graph.schema";
import { GraphModelService } from "./graphModel.service";
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
@Controller()
export class GraphModelController {
  constructor(private readonly graphModelService: GraphModelService) {}
  @Post("/fault-tree-graph")
  async createFaultTreeGraph(
    @Body()
    data: FaultTreeGraph,
  ): Promise<boolean> {
    try {
      return this.graphModelService.saveFaultTreeGraph(data);
    } catch {
      throw new HttpException("Something went wrong", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  @Post("/event-tree-graph")
  async createEventTreeGraph(
    @Body()
    data: Partial<EventTreeGraph>,
  ): Promise<boolean> {
    try {
      return this.graphModelService.saveEventTreeGraph(data);
    } catch {
      throw new HttpException("Something went wrong", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  @Get("/event-sequence-diagram-graph/")
  async getEventSequenceDiagramGraph(
    @Query("eventSequenceId")
    eventSequenceId: string,
  ): Promise<EventSequenceDiagramGraph> {
    return this.graphModelService.getEventSequenceDiagramGraph(eventSequenceId);
  }
  @Get("/fault-tree-graph/")
  async getFaultTreeGraph(
    @Query("faultTreeId")
    faultTreeId: string,
  ): Promise<FaultTreeGraph> {
    return this.graphModelService.getFaultTreeGraph(faultTreeId);
  }
  @Patch("/event-sequence-diagram-graph/update-label/")
  async updateESNodeLabel(
    @Body("id")
    id: string,
    @Body("type")
    type: string,
    @Body("label")
    label: string,
  ): Promise<boolean> {
    try {
      return this.graphModelService.updateESLabel(id, type, label);
    } catch {
      throw new HttpException("Something went wrong", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  @Patch("/event-sequence-diagram-graph")
  async updateESSubgraph(
    @Body("eventSequenceId")
    eventSequenceId: string,
    @Body("updated")
    updatedSubgraph: Partial<BaseGraph>,
    @Body("deleted")
    deletedSubgraph: Partial<BaseGraph>,
  ): Promise<boolean> {
    try {
      return this.graphModelService.updateESSubgraph(eventSequenceId, updatedSubgraph, deletedSubgraph);
    } catch {
      throw new HttpException("Something went wrong", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  @Get("/event-tree-graph/")
  async getEventTreeGraph(
    @Query("eventTreeId")
    eventTreeId: string,
  ): Promise<EventTreeGraph> {
    return this.graphModelService.getEventTreeGraph(eventTreeId);
  }
  @Post("/fault-tree-graph/quantify")
  async quantifyFaultTree(
    @Query("faultTreeId")
    faultTreeId: string,
    @Body()
    body: Omit<FaultTreeQuantificationRequest, "graph">,
  ): Promise<FaultTreeQuantificationResult> {
    try {
      return await this.graphModelService.quantifyFaultTree(faultTreeId, body);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Quantification failed";
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  @Post("/fault-tree-graph/analyze")
  async analyzeFaultTree(
    @Query("faultTreeId")
    faultTreeId: string,
  ): Promise<FaultTreeMetadataResult> {
    try {
      return await this.graphModelService.analyzeFaultTree(faultTreeId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  @Post("/event-tree-graph/analyze")
  async analyzeEventTree(
    @Query("eventTreeId")
    eventTreeId: string,
  ): Promise<EventTreeMetadataResult> {
    try {
      return await this.graphModelService.analyzeEventTree(eventTreeId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  @Post("/event-tree-graph/quantify")
  async quantifyEventTree(
    @Query("eventTreeId")
    eventTreeId: string,
    @Body()
    body: Omit<EventTreeQuantificationRequest, "graph">,
  ): Promise<EventTreeQuantificationResult> {
    try {
      return await this.graphModelService.quantifyEventTree(eventTreeId, body);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Quantification failed";
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
