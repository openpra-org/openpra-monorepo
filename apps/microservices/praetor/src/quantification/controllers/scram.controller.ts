import {
    Body,
    Controller,
    Get,
    InternalServerErrorException,
    NotFoundException,
    Param,
    Post,
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
    ): Promise<{ jobId: string }> {
        try {
            const jobId = await this.producerService.createAndQueueQuant(quantRequest);
            return { jobId };
        }
        catch {
            throw new InternalServerErrorException('Server encountered a problem while queueing SCRAM quantification job.');
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
                };
            };
            return {
                sentAt: result.sentAt,
                receivedAt: result.receivedAt,
                stats: cleanStats(result.stats),
            };
        }
        catch {
            throw new NotFoundException(`Job stats with ID ${id} not found.`);
        }
    }
}
