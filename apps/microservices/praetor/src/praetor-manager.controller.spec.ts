import { Test, TestingModule } from '@nestjs/testing';
import { PraetorManagerController } from './praetor-manager.controller';
import { PraetorManagerService } from './praetor-manager.service';
import { NotFoundException } from '@nestjs/common';
describe('PraetorManagerController', () => {
    let controller: PraetorManagerController;
    const mockService = {
        getJobTypes: vi.fn(),
        getJobs: vi.fn(),
        getPendingJobs: vi.fn(),
        getRunningJobs: vi.fn(),
        getProcessingJobs: vi.fn(),
        getPartialJobs: vi.fn(),
        getCompletedJobs: vi.fn(),
        getFailedJobs: vi.fn(),
    };
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [PraetorManagerController],
            providers: [
                {
                    provide: PraetorManagerService,
                    useValue: mockService,
                },
            ],
        }).compile();
        controller = module.get<PraetorManagerController>(PraetorManagerController);
    });
    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
    describe('getJobTypes', () => {
        it('should return job types', () => {
            const result = { services: [{ name: 'SCRAM Quantify', endpoint: '/q/scram' }] };
            mockService.getJobTypes.mockReturnValue(result);
            expect(controller.getJobTypes()).toBe(result);
        });
        it('should throw NotFoundException on error', () => {
            mockService.getJobTypes.mockImplementation(() => {
                throw new Error();
            });
            expect(() => controller.getJobTypes()).toThrow(NotFoundException);
        });
    });
    describe('getJobs', () => {
        it('should return jobs by status', async () => {
            const result = { jobs: [] };
            mockService.getJobs.mockResolvedValue(result);
            expect(await controller.getJobs('pending')).toBe(result);
            expect(mockService.getJobs).toHaveBeenCalledWith('pending');
        });
        it('should throw NotFoundException on error', async () => {
            mockService.getJobs.mockRejectedValue(new Error());
            await expect(controller.getJobs('pending')).rejects.toThrow(NotFoundException);
        });
    });
    describe('getPendingJobs', () => {
        it('should return pending jobs', async () => {
            const result = { jobs: [] };
            mockService.getPendingJobs.mockResolvedValue(result);
            expect(await controller.getPendingJobs()).toBe(result);
        });
    });
    describe('getRunningJobs', () => {
        it('should return running jobs', async () => {
            const result = { jobs: [] };
            mockService.getRunningJobs.mockResolvedValue(result);
            expect(await controller.getRunningJobs()).toBe(result);
        });
    });
    describe('getProcessingJobs', () => {
        it('should return processing jobs', async () => {
            const result = { jobs: [] };
            mockService.getProcessingJobs.mockResolvedValue(result);
            expect(await controller.getProcessingJobs()).toBe(result);
        });
    });
    describe('getPartialJobs', () => {
        it('should return partial jobs', async () => {
            const result = { jobs: [] };
            mockService.getPartialJobs.mockResolvedValue(result);
            expect(await controller.getPartialJobs()).toBe(result);
        });
    });
    describe('getCompletedJobs', () => {
        it('should return completed jobs', async () => {
            const result = { jobs: [] };
            mockService.getCompletedJobs.mockResolvedValue(result);
            expect(await controller.getCompletedJobs()).toBe(result);
        });
    });
    describe('getFailedJobs', () => {
        it('should return failed jobs', async () => {
            const result = { jobs: [] };
            mockService.getFailedJobs.mockResolvedValue(result);
            expect(await controller.getFailedJobs()).toBe(result);
        });
    });
});
