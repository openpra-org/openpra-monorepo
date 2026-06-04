import { Injectable, Logger } from '@nestjs/common';
import { MinioService, JobMetadata } from '../../shared/minio.service';
import type { ScramResult, ScramInitiatingEvent } from '../../common/types/scram-result';
export interface ChildJobOutput {
    jobId: string;
    output?: ScramResult | string;
}
export interface JobStatusIds {
    inputId?: string;
    aggregatedOutputJobId: string;
    childJobIds?: string[];
}
export interface JobOutputResponse {
    jobId: string;
    output?: ScramResult | string;
    childOutputs?: ChildJobOutput[];
    aggregatedOutput?: ScramResult;
    failedJobs?: Array<{
        jobId: string;
        error?: string;
    }>;
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
        const parentJobId = metadata.jobId ?? jobId;
        const childJobIds = metadata.childJobs ?? [];
        return {
            inputId: metadata.inputId,
            aggregatedOutputJobId: parentJobId,
            childJobIds: childJobIds.length > 0 ? childJobIds : undefined,
        };
    }
    public async getAggregatedJobOutput(jobId: string): Promise<JobOutputResponse> {
        const metadata = await this.minioService.getJobMetadata(jobId);
        const childOutputsResult = await this.collectChildOutputs(metadata);
        const parentOutput = await this.safeLoadOutput(metadata.outputId);
        const aggregatedOutput = childOutputsResult.sequenceResults.length > 0
            ? this.aggregateSequenceResults(childOutputsResult.sequenceResults)
            : undefined;
        return {
            jobId: metadata.jobId ?? jobId,
            output: parentOutput,
            childOutputs: childOutputsResult.childOutputs.length > 0
                ? childOutputsResult.childOutputs
                : undefined,
            aggregatedOutput,
            failedJobs: childOutputsResult.failedJobs.length > 0
                ? childOutputsResult.failedJobs
                : undefined,
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
        childStats?: Array<{
            jobId: string;
            sentAt?: number;
            receivedAt?: number;
            stats?: JobMetadata['stats'];
        }>;
    }> {
        const metadata = await this.minioService.getJobMetadata(jobId);
        const result: {
            sentAt?: number;
            receivedAt?: number;
            stats?: JobMetadata['stats'];
            childStats?: Array<{
                jobId: string;
                sentAt?: number;
                receivedAt?: number;
                stats?: JobMetadata['stats'];
            }>;
        } = {
            sentAt: metadata.sentAt,
            receivedAt: metadata.receivedAt,
            stats: metadata.stats,
        };
        if (metadata.childJobs && metadata.childJobs.length > 0) {
            const childStats: Array<{
                jobId: string;
                sentAt?: number;
                receivedAt?: number;
                stats?: JobMetadata['stats'];
            }> = [];
            for (const childJobId of metadata.childJobs) {
                try {
                    const childMetadata = await this.minioService.getJobMetadata(childJobId);
                    childStats.push({
                        jobId: childJobId,
                        sentAt: childMetadata.sentAt,
                        receivedAt: childMetadata.receivedAt,
                        stats: childMetadata.stats,
                    });
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.logger.warn(`Could not fetch stats for child job ${childJobId}: ${message}`);
                }
            }
            if (childStats.length > 0) {
                result.childStats = childStats;
            }
        }
        return result;
    }
    private aggregateSequenceResults(sequenceResults: ScramResult[]): ScramResult {
        if (sequenceResults.length === 0) {
            return {
                modelFeatures: {},
                results: { initiatingEvents: [], sumOfProducts: [] },
            };
        }
        const aggregatedResult: ScramResult = {
            modelFeatures: sequenceResults[0]?.modelFeatures ?? {},
            results: {
                initiatingEvents: [],
                sumOfProducts: [],
            },
        };
        const ieMap = new Map<string, ScramInitiatingEvent>();
        for (const res of sequenceResults) {
            for (const ie of res.results.initiatingEvents) {
                if (!ieMap.has(ie.name)) {
                    ieMap.set(ie.name, {
                        name: ie.name,
                        description: ie.description,
                        sequences: [],
                    });
                }
                const entry = ieMap.get(ie.name)!;
                for (const seq of ie.sequences) {
                    if (!entry.sequences.some((existing) => existing.name === seq.name)) {
                        entry.sequences.push(seq);
                    }
                }
            }
        }
        for (const entry of ieMap.values()) {
            entry.sequences.sort((a, b) => {
                const anum = parseInt(a.name.replace(/\D+/g, ''), 10);
                const bnum = parseInt(b.name.replace(/\D+/g, ''), 10);
                if (!Number.isNaN(anum) && !Number.isNaN(bnum)) {
                    return anum - bnum;
                }
                return a.name.localeCompare(b.name);
            });
        }
        aggregatedResult.results.initiatingEvents = Array.from(ieMap.values());
        for (const res of sequenceResults) {
            if ((res.results.sumOfProducts?.length ?? 0) > 0) {
                aggregatedResult.results.sumOfProducts = res.results.sumOfProducts;
                break;
            }
        }
        return aggregatedResult;
    }
    private async collectChildOutputs(metadata: JobMetadata): Promise<{
        childOutputs: ChildJobOutput[];
        failedJobs: Array<{
            jobId: string;
            error?: string;
        }>;
        sequenceResults: ScramResult[];
    }> {
        const childOutputs: ChildJobOutput[] = [];
        const failedJobs: Array<{
            jobId: string;
            error?: string;
        }> = [];
        const sequenceResults: ScramResult[] = [];
        if (!metadata.childJobs || metadata.childJobs.length === 0) {
            return { childOutputs, failedJobs, sequenceResults };
        }
        for (const childJobId of metadata.childJobs) {
            try {
                const childMetadata = await this.minioService.getJobMetadata(childJobId);
                if (childMetadata.status === 'completed' && childMetadata.outputId) {
                    const output = await this.safeLoadOutput(childMetadata.outputId);
                    if (output === undefined) {
                        failedJobs.push({ jobId: childJobId, error: 'Output not available' });
                        continue;
                    }
                    childOutputs.push({ jobId: childJobId, output });
                    if (typeof output !== 'string') {
                        sequenceResults.push(output);
                    }
                }
                else if (childMetadata.status === 'failed') {
                    failedJobs.push({ jobId: childJobId, error: childMetadata.error });
                }
                else {
                    failedJobs.push({
                        jobId: childJobId,
                        error: `Job status ${childMetadata.status ?? 'unknown'} does not have output available`,
                    });
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error(`Failed to load metadata or output for child job ${childJobId}: ${message}`);
                failedJobs.push({ jobId: childJobId, error: message });
            }
        }
        return { childOutputs, failedJobs, sequenceResults };
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
