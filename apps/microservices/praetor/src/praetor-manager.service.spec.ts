import { Test, TestingModule } from '@nestjs/testing';
import { PraetorManagerService } from './praetor-manager.service';
import { StorageService } from './quantification/services/storage.service';
import { JobMetadata } from './shared/minio.service';
describe('PraetorManagerService', () => {
    let service: PraetorManagerService;
    const mockStorageService = {
        getQuantifiedReports: vi.fn(),
    };
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PraetorManagerService,
                {
                    provide: StorageService,
                    useValue: mockStorageService,
                },
            ],
        }).compile();
        service = module.get<PraetorManagerService>(PraetorManagerService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('getJobTypes', () => {
        it('should return job types message', () => {
            expect(service.getJobTypes()).toEqual({
                message: 'return the types of jobs',
            });
        });
    });
    describe('createJob', () => {
        it('should return create job message', () => {
            expect(service.createJob()).toEqual({ message: 'create a new job' });
        });
    });
    describe('getJobs', () => {
        const mockJobs: JobMetadata[] = [
            { jobId: '1', status: 'pending' },
            { jobId: '2', status: 'running' },
            { jobId: '3', status: 'completed' },
        ];
        beforeEach(() => {
            mockStorageService.getQuantifiedReports.mockResolvedValue(mockJobs);
        });
        it('should return pending jobs', async () => {
            const result = await service.getPendingJobs();
            expect(result.jobs).toHaveLength(1);
            expect(result.jobs[0].jobId).toBe('1');
            expect(result.jobs[0].status).toBe('pending');
        });
        it('should return running jobs', async () => {
            const result = await service.getRunningJobs();
            expect(result.jobs).toHaveLength(1);
            expect(result.jobs[0].jobId).toBe('2');
            expect(result.jobs[0].status).toBe('running');
        });
        it('should return completed jobs', async () => {
            const result = await service.getCompletedJobs();
            expect(result.jobs).toHaveLength(1);
            expect(result.jobs[0].jobId).toBe('3');
            expect(result.jobs[0].status).toBe('completed');
        });
        it('should filter jobs by status generic method', async () => {
            const result = await service.getJobs('pending');
            expect(result.jobs).toHaveLength(1);
            expect(result.jobs[0].status).toBe('pending');
        });
    });
});
