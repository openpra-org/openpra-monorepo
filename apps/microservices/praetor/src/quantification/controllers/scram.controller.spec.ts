import { Test, TestingModule } from '@nestjs/testing';
import { ScramController } from './scram.controller';
import { ProducerService } from '../services/producer.service';
import { StorageService } from '../services/storage.service';
import { InternalServerErrorException, NotFoundException, } from '@nestjs/common';
import type { NodeQuantRequest } from '../../common/types/quantify-request';
describe('ScramController', () => {
    let controller: ScramController;
    const mockProducerService = {
        createAndQueueQuant: vi.fn(),
    };
    const mockStorageService = {
        getInputData: vi.fn(),
        getOutput: vi.fn(),
    };
    beforeEach(async () => {
        vi.clearAllMocks();
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
            const result = await controller.createAndQueueQuant({} as NodeQuantRequest);
            expect(result).toEqual({ jobId });
        });
        it('should throw InternalServerErrorException on error', async () => {
            mockProducerService.createAndQueueQuant.mockRejectedValue(new Error());
            await expect(controller.createAndQueueQuant({} as NodeQuantRequest)).rejects.toThrow(InternalServerErrorException);
        });
    });
    describe('getInputData', () => {
        it('should return the stored request', async () => {
            const request = { _id: 'job-id' };
            mockStorageService.getInputData.mockResolvedValue(JSON.stringify(request));
            expect(await controller.getInputData('job-id')).toEqual(request);
            expect(mockStorageService.getInputData).toHaveBeenCalledWith('job-id');
        });
        it('should throw NotFoundException when the input is missing', async () => {
            mockStorageService.getInputData.mockRejectedValue(new Error());
            await expect(controller.getInputData('job-id')).rejects.toThrow(NotFoundException);
        });
        it('should throw NotFoundException when the stored input is not JSON', async () => {
            mockStorageService.getInputData.mockResolvedValue('not json');
            await expect(controller.getInputData('job-id')).rejects.toThrow(NotFoundException);
        });
    });
    describe('getOutput', () => {
        it('should return the stored output', async () => {
            const output = { results: { initiatingEvents: [], sumOfProducts: [] } };
            mockStorageService.getOutput.mockResolvedValue(output);
            expect(await controller.getOutput('job-id')).toEqual(output);
            expect(mockStorageService.getOutput).toHaveBeenCalledWith('job-id');
        });
        it('should throw NotFoundException on error', async () => {
            mockStorageService.getOutput.mockRejectedValue(new Error());
            await expect(controller.getOutput('job-id')).rejects.toThrow(NotFoundException);
        });
    });
});
