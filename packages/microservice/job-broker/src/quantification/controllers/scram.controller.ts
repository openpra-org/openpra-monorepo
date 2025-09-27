import { Controller, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { TypedRoute, TypedBody, TypedParam } from "@nestia/core";
import { NodeQuantRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { ProducerService } from "../services/producer.service";
import { StorageService } from "../services/storage.service";
import { JobMetadata } from "../../shared/minio.service";

@Controller()
export class ScramController {
  constructor(
    private readonly producerService: ProducerService,
    private readonly storageService: StorageService,
  ) {}

  @TypedRoute.Post("/scram")
  public async createAndQueueQuant(@TypedBody() quantRequest: NodeQuantRequest): Promise<{ jobId: string }> {
    try {
      const jobId = await this.producerService.createAndQueueQuant(quantRequest);
      return { jobId };
    } catch {
      throw new InternalServerErrorException("Server encountered a problem while queueing SCRAM quantification job.");
    }
  }

  @TypedRoute.Get("/scram")
  public async getQuantifiedReports(): Promise<JobMetadata[]> {
    try {
      return this.storageService.getQuantifiedReports();
    } catch {
      throw new NotFoundException("Server was unable to find the requested list of quantified reports.");
    }
  }

  @TypedRoute.Get("/scram/:jobId")
  public async getJobStatus(@TypedParam("jobId") jobId: string): Promise<JobMetadata> {
    try {
      return this.storageService.getJobStatus(jobId);
    } catch {
      throw new NotFoundException(`Job with ID ${jobId} not found.`);
    }
  }

  @TypedRoute.Get("/scram/input/:inputId")
  public async getInputData(@TypedParam("inputId") inputId: string): Promise<any> {
    try {
      const inputData = await this.storageService.getInputData(inputId);
      return JSON.parse(inputData);
    } catch {
      throw new NotFoundException(`Input data with ID ${inputId} not found.`);
    }
  }

  @TypedRoute.Get("/scram/output/:outputId")
  public async getOutputData(@TypedParam("outputId") outputId: string): Promise<any> {
    try {
      const outputData = await this.storageService.getOutputData(outputId);
      return JSON.parse(outputData);
    } catch {
      throw new NotFoundException(`Output data with ID ${outputId} not found.`);
    }
  }
}