import { Injectable, Logger } from '@nestjs/common';
import { MinioService, JobMetadata } from '../../shared/minio.service';
import type { ScramResult } from '../../common/types/scram-result';
export interface JobStatusIds {
    inputId?: string;
    aggregatedOutputJobId: string;
}
export interface JobOutputResponse {
    jobId: string;
    output?: ScramResult | string;
}
@Injectable()
export class StorageService {
    private readonly logger = new Logger(StorageService.name);
    constructor(private readonly minioService: MinioService) { }
    public async getQuantifiedReports(): Promise<JobMetadata[]> {
        return this.minioService.getAllJobMetadata();
    }
    public async getJobMetadata(jobId: string): Promise<JobMetadata> {
        return this.minioService.getJobMetadata(jobId);
    }
    public async getJobStatus(jobId: string): Promise<JobStatusIds> {
        const metadata = await this.minioService.getJobMetadata(jobId);
        return {
            inputId: metadata.inputId,
            aggregatedOutputJobId: metadata.jobId ?? jobId,
        };
    }
    public async getAggregatedJobOutput(jobId: string): Promise<JobOutputResponse> {
        const metadata = await this.minioService.getJobMetadata(jobId);
        const output = await this.safeLoadOutput(metadata.outputId);
        return {
            jobId: metadata.jobId ?? jobId,
            output,
        };
    }
    public async getInputData(inputId: string): Promise<string> {
        return this.minioService.getInputData(inputId);
    }
    public async getOutputData(outputId: string): Promise<string> {
        return this.minioService.getOutputData(outputId);
    }
    public async getJobStats(jobId: string): Promise<{
        sentAt?: number;
        receivedAt?: number;
        stats?: JobMetadata['stats'];
    }> {
        const metadata = await this.minioService.getJobMetadata(jobId);
        return {
            sentAt: metadata.sentAt,
            receivedAt: metadata.receivedAt,
            stats: metadata.stats,
        };
    }
    private async safeLoadOutput(outputId?: string): Promise<ScramResult | string | undefined> {
        if (!outputId) {
            return undefined;
        }
        try {
            const rawOutput = await this.minioService.getOutputData(outputId);
            try {
                return JSON.parse(rawOutput) as ScramResult;
            }
            catch {
                return rawOutput;
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to load output for ID ${outputId}: ${message}`);
            return undefined;
        }
    }
}
