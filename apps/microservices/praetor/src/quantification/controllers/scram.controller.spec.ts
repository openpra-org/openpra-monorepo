import { Test, TestingModule } from '@nestjs/testing';
import { ScramController } from './scram.controller';
import { ProducerService } from '../services/producer.service';
import { StorageService } from '../services/storage.service';
import { InternalServerErrorException, NotFoundException, } from '@nestjs/common';
vi.mock('@nestia/core', async () => {
    const common = await import('@nestjs/common');
    return {
        TypedRoute: {
            Post: common.Post,
            Get: common.Get,
        },
        TypedBody: common.Body,
        TypedQuery: common.Query,
        TypedParam: common.Param,
    };
});
describe('ScramController', () => {
    let controller: ScramController;
    const mockProducerService = {
        createAndQueueQuant: vi.fn(),
        createAndQueueSequenceBatch: vi.fn(),
        createAndQueueAdaptiveSequenceBatch: vi.fn(),
    };
    const mockStorageService = {
        getJobStatus: vi.fn(),
        getAggregatedJobOutput: vi.fn(),
    };
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ScramController],
            providers: [
                {
                    provide: ProducerService,
                    useValue: mockProducerService,
                },
                {
                    provide: StorageService,
                    useValue: mockStorageService,
                },
            ],
        }).compile();
        controller = module.get<ScramController>(ScramController);
    });
    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
    describe('createAndQueueQuant', () => {
        it('should queue quant job', async () => {
            const jobId = 'job-id';
            mockProducerService.createAndQueueQuant.mockResolvedValue(jobId);
            const result = await controller.createAndQueueQuant({} as any);
            expect(result).toEqual({ jobId });
        });
        it('should queue sequence batch job', async () => {
            const sequenceJobIds = ['job-1-seq1', 'job-1-seq2'];
            mockProducerService.createAndQueueSequenceBatch.mockResolvedValue(sequenceJobIds);
            const result = await controller.createAndQueueQuant({} as any, {
                distributedSequences: 'yes',
            });
            expect(result).toEqual({ parentJobId: 'job-1', sequenceJobIds });
        });
        it('should throw InternalServerErrorException on error', async () => {
            mockProducerService.createAndQueueQuant.mockRejectedValue(new Error());
            await expect(controller.createAndQueueQuant({} as any)).rejects.toThrow(InternalServerErrorException);
        });
    });
    describe('createAndQueueAdaptiveQuant', () => {
        it('should queue adaptive quant job', async () => {
            const jobId = 'job-id';
            mockProducerService.createAndQueueQuant.mockResolvedValue(jobId);
            const result = await controller.createAndQueueAdaptiveQuant({} as any);
            expect(result).toEqual({ jobId });
        });
        it('should queue adaptive sequence batch job', async () => {
            const sequenceJobIds = ['job-1-seq1', 'job-1-seq2'];
            mockProducerService.createAndQueueAdaptiveSequenceBatch.mockResolvedValue(sequenceJobIds);
            const result = await controller.createAndQueueAdaptiveQuant({} as any, {
                distributedSequences: 'yes',
            });
            expect(result).toEqual({ parentJobId: 'job-1', sequenceJobIds });
        });
        it('should throw InternalServerErrorException if no sequences extracted', async () => {
            mockProducerService.createAndQueueAdaptiveSequenceBatch.mockResolvedValue([]);
            await expect(controller.createAndQueueAdaptiveQuant({} as any, {
                distributedSequences: 'yes',
            })).rejects.toThrow(InternalServerErrorException);
        });
        it('should throw InternalServerErrorException on error', async () => {
            mockProducerService.createAndQueueQuant.mockRejectedValue(new Error());
            await expect(controller.createAndQueueAdaptiveQuant({} as any)).rejects.toThrow(InternalServerErrorException);
        });
    });
    describe('getJobStatus', () => {
        it('should return job status', async () => {
            const status = { aggregatedOutputJobId: 'job-id' };
            mockStorageService.getJobStatus.mockResolvedValue(status);
            const result = await controller.getJobStatus('job-id');
            expect(result).toEqual(status);
        });
        it('should throw NotFoundException on error', async () => {
            mockStorageService.getJobStatus.mockRejectedValue(new Error());
            await expect(controller.getJobStatus('job-id')).rejects.toThrow(NotFoundException);
        });
    });
    describe('getAggregatedOutput', () => {
        it('should return job output', async () => {
            const output = { jobId: 'job-id', output: {} };
            mockStorageService.getAggregatedJobOutput.mockResolvedValue(output);
            const result = await controller.getAggregatedOutput('job-id');
            expect(result).toEqual(output);
        });
        it('should throw NotFoundException on error', async () => {
            mockStorageService.getAggregatedJobOutput.mockRejectedValue(new Error());
            await expect(controller.getAggregatedOutput('job-id')).rejects.toThrow(NotFoundException);
        });
    });
});
