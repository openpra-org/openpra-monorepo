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
import type { ScramResult } from '../../common/types/scram-result';
import { ProducerService } from '../services/producer.service';
import { StorageService } from '../services/storage.service';
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
    @Get('/scram/output/:outputId')
    public async getOutput(@Param('outputId') outputId: string): Promise<ScramResult | string | undefined> {
        try {
            return await this.storageService.getOutput(outputId);
        }
        catch {
            throw new NotFoundException(`Output data with ID ${outputId} not found.`);
        }
    }
}
