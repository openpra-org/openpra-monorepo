import { Injectable } from "@nestjs/common";
import { MinioService, JobMetadata } from "../../shared/minio.service";

@Injectable()
export class StorageService {
  constructor(private readonly minioService: MinioService) {}

  public async getQuantifiedReports(): Promise<JobMetadata[]> {
    return this.minioService.getAllJobMetadata();
  }

  public async getJobStatus(jobId: string): Promise<JobMetadata> {
    return this.minioService.getJobMetadata(jobId);
  }

  public async getInputData(inputId: string): Promise<string> {
    return this.minioService.getInputData(inputId);
  }

  public async getOutputData(outputId: string): Promise<string> {
    return this.minioService.getOutputData(outputId);
  }
}