import { Controller, InternalServerErrorException, NotFoundException, } from '@nestjs/common';
import { TypedRoute, TypedQuery, TypedParam, TypedBody } from '@nestia/core';
import type { NodeQuantRequest } from '../../common/types/quantify-request';
import { ProducerService } from '../services/producer.service';
import { StorageService, JobStatusIds, JobOutputResponse, } from '../services/storage.service';
import { JobMetadata } from '../../shared/minio.service';
@Controller()
export class ScramController {
    constructor(private readonly producerService: ProducerService, private readonly storageService: StorageService) { }
    @TypedRoute.Post('/scram')
    public async createAndQueueQuant(
    @TypedBody()
    quantRequest: NodeQuantRequest, 
    @TypedQuery()
    query?: {
        distributedSequences?: string;
    }): Promise<{
        parentJobId: string;
        sequenceJobIds: string[];
    } | {
        jobId: string;
    }> {
        try {
            if (query?.distributedSequences === 'yes') {
                const sequenceJobIds = await this.producerService.createAndQueueSequenceBatch(quantRequest);
                const parentJobId = sequenceJobIds[0].split('-').slice(0, -1).join('-');
                return { parentJobId, sequenceJobIds };
            }
            else {
                const jobId = await this.producerService.createAndQueueQuant(quantRequest);
                return { jobId };
            }
        }
        catch {
            throw new InternalServerErrorException('Server encountered a problem while queueing SCRAM quantification job.');
        }
    }
    @TypedRoute.Post('/scram/adaptive')
    public async createAndQueueAdaptiveQuant(
    @TypedBody()
    quantRequest: NodeQuantRequest, 
    @TypedQuery()
    query?: {
        distributedSequences?: string;
    }): Promise<{
        parentJobId: string;
        sequenceJobIds: string[];
    } | {
        jobId: string;
    }> {
        try {
            if (query?.distributedSequences === 'yes') {
                const sequenceJobIds = await this.producerService.createAndQueueAdaptiveSequenceBatch(quantRequest);
                if (sequenceJobIds.length === 0) {
                    throw new InternalServerErrorException('No sequences were extracted for adaptive quantification.');
                }
                const parentJobId = sequenceJobIds[0].split('-').slice(0, -1).join('-');
                return {
                    parentJobId,
                    sequenceJobIds,
                };
            }
            else {
                const jobId = await this.producerService.createAndQueueQuant(quantRequest);
                return { jobId };
            }
        }
        catch (error: any) {
            throw new InternalServerErrorException(error.message ||
                'Server encountered a problem while queueing adaptive SCRAM quantification job.');
        }
    }
    @TypedRoute.Get('/scram')
    public async getQuantifiedReports(): Promise<JobMetadata[]> {
        try {
            return await this.storageService.getQuantifiedReports();
        }
        catch {
            throw new NotFoundException('Server was unable to find the requested list of quantified reports.');
        }
    }
    @TypedRoute.Get('/scram/:jobId')
    public async getJobStatus(
    @TypedParam('jobId')
    jobId: string): Promise<JobStatusIds> {
        try {
            return await this.storageService.getJobStatus(jobId);
        }
        catch {
            throw new NotFoundException(`Job with ID ${jobId} not found.`);
        }
    }
    @TypedRoute.Get('/scram/input/:inputId')
    public async getInputData(
    @TypedParam('inputId')
    inputId: string): Promise<any> {
        try {
            const inputData = await this.storageService.getInputData(inputId);
            return JSON.parse(inputData);
        }
        catch {
            throw new NotFoundException(`Input data with ID ${inputId} not found.`);
        }
    }
    @TypedRoute.Get('/scram/output/:jobId')
    public async getAggregatedOutput(
    @TypedParam('jobId')
    jobId: string): Promise<JobOutputResponse> {
        try {
            return await this.storageService.getAggregatedJobOutput(jobId);
        }
        catch {
            throw new NotFoundException(`Job with ID ${jobId} not found.`);
        }
    }
    @TypedRoute.Get('/scram/stats/:id')
    public async getJobStats(
    @TypedParam('id')
    id: string): Promise<{
        sentAt?: number;
        receivedAt?: number;
        stats?: {
            idleTime?: number;
            executionTime?: number;
            startedAt?: number;
            endedAt?: number;
            analysisSeconds?: number;
            probability?: number;
            products?: number;
            originalProducts?: number;
            exactProbability?: number;
            approximateProbability?: number;
            relativeError?: number;
        };
        childStats?: Array<{
            jobId: string;
            sentAt?: number;
            receivedAt?: number;
            stats?: {
                idleTime?: number;
                executionTime?: number;
                startedAt?: number;
                endedAt?: number;
                analysisSeconds?: number;
                probability?: number;
                products?: number;
                originalProducts?: number;
                exactProbability?: number;
                approximateProbability?: number;
                relativeError?: number;
            };
        }>;
    }> {
        try {
            const result = await this.storageService.getJobStats(id);
            const cleanStats = (stats: any) => {
                if (!stats)
                    return undefined;
                const analysisSeconds = stats.analysisSeconds ?? stats.totalSeconds;
                const { totalSeconds, reportWriteTimeMs, ...rest } = stats;
                return { ...rest, analysisSeconds };
            };
            return {
                ...result,
                stats: cleanStats(result.stats),
                childStats: result.childStats?.map((child) => ({
                    ...child,
                    stats: cleanStats(child.stats),
                })),
            };
        }
        catch {
            throw new NotFoundException(`Job stats with ID ${id} not found.`);
        }
    }
}
