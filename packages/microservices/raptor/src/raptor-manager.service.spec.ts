import { Test, TestingModule } from '@nestjs/testing';
import { RaptorManagerService } from './raptor-manager.service';
import { StorageService } from './quantification/services/storage.service';
import { JobMetadata } from './shared/minio.service';

describe('RaptorManagerService', () => {
  let service: RaptorManagerService;

  const mockStorageService = {
    getQuantifiedReports: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RaptorManagerService,
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    service = module.get<RaptorManagerService>(RaptorManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getJobTypes', () => {
    it('should return job types with services array', () => {
      const result = service.getJobTypes();
      expect(result).toHaveProperty('services');
      expect(result.services).toBeInstanceOf(Array);
      expect(result.services.length).toBeGreaterThan(0);
      expect(result.services[0]).toHaveProperty('name');
      expect(result.services[0]).toHaveProperty('endpoint');
    });
  });

  describe('createJob', () => {
    it('should return create job message', () => {
      expect(service.createJob()).toEqual({ message: 'create a new job' });
    });
  });

  describe('getJobs', () => {
    const mockJobs: JobMetadata[] = [
      { jobId: '1', status: 'processing' },
      { jobId: '2', status: 'running' },
      { jobId: '3', status: 'completed' },
      { jobId: '4', status: 'partial' },
      { jobId: '5', status: 'failed' },
    ];

    beforeEach(() => {
      mockStorageService.getQuantifiedReports.mockResolvedValue(mockJobs);
    });

    it('should return processing jobs', async () => {
      const result = await service.getProcessingJobs();
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].jobId).toBe('1');
      expect(result.jobs[0].status).toBe('processing');
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

    it('should return partial jobs', async () => {
      const result = await service.getPartialJobs();
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].jobId).toBe('4');
      expect(result.jobs[0].status).toBe('partial');
    });

    it('should return failed jobs', async () => {
      const result = await service.getFailedJobs();
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].jobId).toBe('5');
      expect(result.jobs[0].status).toBe('failed');
    });
  });
});
