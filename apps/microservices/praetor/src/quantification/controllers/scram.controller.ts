import {
    Body,
    Controller,
    Get,
    InternalServerErrorException,
    NotFoundException,
    Param,
    Post,
    Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { NodeQuantRequest } from '../../common/types/quantify-request';
import { ProducerService } from '../services/producer.service';
import { StorageService, JobStatusIds, JobOutputResponse } from '../services/storage.service';
import { JobMetadata } from '../../shared/minio.service';
type JobStatsOutput = Omit<NonNullable<JobMetadata['stats']>, 'totalSeconds' | 'reportWriteTimeMs'>;
@ApiTags('SCRAM Quantification')
@Controller()
export class ScramController {
    constructor(
        private readonly producerService: ProducerService,
        private readonly storageService: StorageService,
    ) {}
    @Post('/scram')
    public async createAndQueueQuant(
        @Body() quantRequest: NodeQuantRequest,
        @Query() query?: { distributedSequences?: string },
    ): Promise<{ parentJobId: string; sequenceJobIds: string[] } | { jobId: string }> {
        try {
            if (query?.distributedSequences === 'yes') {
                const sequenceJobIds = await this.producerService.createAndQueueSequenceBatch(quantRequest);
                const parentJobId = sequenceJobIds[0].split('-').slice(0, -1).join('-');
                return { parentJobId, sequenceJobIds };
            }
            const jobId = await this.producerService.createAndQueueQuant(quantRequest);
            return { jobId };
        }
        catch {
            throw new InternalServerErrorException('Server encountered a problem while queueing SCRAM quantification job.');
        }
    }
    @Post('/scram/adaptive')
    public async createAndQueueAdaptiveQuant(
        @Body() quantRequest: NodeQuantRequest,
        @Query() query?: { distributedSequences?: string },
    ): Promise<{ parentJobId: string; sequenceJobIds: string[] } | { jobId: string }> {
        try {
            if (query?.distributedSequences === 'yes') {
                const sequenceJobIds = await this.producerService.createAndQueueAdaptiveSequenceBatch(quantRequest);
                if (sequenceJobIds.length === 0) {
                    throw new InternalServerErrorException('No sequences were extracted for adaptive quantification.');
                }
                const parentJobId = sequenceJobIds[0].split('-').slice(0, -1).join('-');
                return { parentJobId, sequenceJobIds };
            }
            const jobId = await this.producerService.createAndQueueQuant(quantRequest);
            return { jobId };
        }
        catch (error) {
            if (error instanceof InternalServerErrorException) {
                throw error;
            }
            const message = error instanceof Error ? error.message : String(error);
            throw new InternalServerErrorException(
                message || 'Server encountered a problem while queueing adaptive SCRAM quantification job.',
            );
        }
    }
    @Get('/scram')
    public async getQuantifiedReports(): Promise<JobMetadata[]> {
        try {
            return await this.storageService.getQuantifiedReports();
        }
        catch {
            throw new NotFoundException('Server was unable to find the requested list of quantified reports.');
        }
    }
    @Get('/scram/:jobId')
    public async getJobStatus(@Param('jobId') jobId: string): Promise<JobStatusIds> {
        try {
            return await this.storageService.getJobStatus(jobId);
        }
        catch {
            throw new NotFoundException(`Job with ID ${jobId} not found.`);
        }
    }
    @Get('/scram/input/:inputId')
    public async getInputData(@Param('inputId') inputId: string): Promise<NodeQuantRequest> {
        try {
            const inputData = await this.storageService.getInputData(inputId);
            return JSON.parse(inputData) as NodeQuantRequest;
        }
        catch {
            throw new NotFoundException(`Input data with ID ${inputId} not found.`);
        }
    }
    @Get('/scram/output/:jobId')
    public async getAggregatedOutput(@Param('jobId') jobId: string): Promise<JobOutputResponse> {
        try {
            return await this.storageService.getAggregatedJobOutput(jobId);
        }
        catch {
            throw new NotFoundException(`Job with ID ${jobId} not found.`);
        }
    }
    @Get('/scram/stats/:id')
    public async getJobStats(@Param('id') id: string): Promise<{
        sentAt?: number;
        receivedAt?: number;
        stats?: JobStatsOutput;
        childStats?: Array<{
            jobId: string;
            sentAt?: number;
            receivedAt?: number;
            stats?: JobStatsOutput;
        }>;
    }> {
        try {
            const result = await this.storageService.getJobStats(id);
            const cleanStats = (stats: JobMetadata['stats']): JobStatsOutput | undefined => {
                if (!stats) return undefined;
                return {
                    idleTime: stats.idleTime,
                    executionTime: stats.executionTime,
                    startedAt: stats.startedAt,
                    endedAt: stats.endedAt,
                    analysisSeconds: stats.analysisSeconds ?? stats.totalSeconds,
                    probability: stats.probability,
                    products: stats.products,
                    originalProducts: stats.originalProducts,
                    exactProbability: stats.exactProbability,
                    approximateProbability: stats.approximateProbability,
                    relativeError: stats.relativeError,
                };
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
