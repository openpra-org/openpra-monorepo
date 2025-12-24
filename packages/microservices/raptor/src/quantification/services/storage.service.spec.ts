import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { MinioService } from '../../shared/minio.service';

describe('StorageService', () => {
  let service: StorageService;

  const mockMinioService = {
    getAllJobMetadata: vi.fn(),
    getJobMetadata: vi.fn(),
    getInputData: vi.fn(),
    getOutputData: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: MinioService, useValue: mockMinioService },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getQuantifiedReports', () => {
    it('should return all job metadata', async () => {
      const reports = [{ jobId: '1' }];
      mockMinioService.getAllJobMetadata.mockResolvedValue(reports);
      expect(await service.getQuantifiedReports()).toEqual(reports);
    });
  });

  describe('getJobMetadata', () => {
    it('should return job metadata', async () => {
      const metadata = { jobId: '1' };
      mockMinioService.getJobMetadata.mockResolvedValue(metadata);
      expect(await service.getJobMetadata('1')).toEqual(metadata);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status for single job', async () => {
      const metadata = { jobId: '1', inputId: 'input-1' };
      mockMinioService.getJobMetadata.mockResolvedValue(metadata);

      const result = await service.getJobStatus('1');
      expect(result).toEqual({
        inputId: 'input-1',
        aggregatedOutputJobId: '1',
        childJobIds: undefined,
      });
    });

    it('should return job status for parent job', async () => {
      const metadata = {
        jobId: '1',
        inputId: 'input-1',
        childJobs: ['2', '3'],
      };
      mockMinioService.getJobMetadata.mockResolvedValue(metadata);

      const result = await service.getJobStatus('1');
      expect(result).toEqual({
        inputId: 'input-1',
        aggregatedOutputJobId: '1',
        childJobIds: ['2', '3'],
      });
    });
  });

  describe('getInputData', () => {
    it('should return input data', async () => {
      const data = 'some-data';
      mockMinioService.getInputData.mockResolvedValue(data);
      expect(await service.getInputData('input-1')).toEqual(data);
    });
  });

  describe('getOutputData', () => {
    it('should return output data', async () => {
      const data = 'some-data';
      mockMinioService.getOutputData.mockResolvedValue(data);
      expect(await service.getOutputData('output-1')).toEqual(data);
    });
  });

  describe('getJobStats', () => {
    it('should return stats for single job', async () => {
      const metadata = {
        jobId: '1',
        sentAt: 100,
        receivedAt: 200,
        stats: { executionTime: 10 },
      };
      mockMinioService.getJobMetadata.mockResolvedValue(metadata);

      const result = await service.getJobStats('1');
      expect(result).toEqual({
        sentAt: 100,
        receivedAt: 200,
        stats: { executionTime: 10 },
      });
    });

    it('should return stats for parent and child jobs', async () => {
      const parentMetadata = {
        jobId: '1',
        childJobs: ['2'],
        sentAt: 100,
      };
      const childMetadata = {
        jobId: '2',
        sentAt: 150,
        receivedAt: 250,
        stats: { executionTime: 5 },
      };

      mockMinioService.getJobMetadata
        .mockResolvedValueOnce(parentMetadata)
        .mockResolvedValueOnce(childMetadata);

      const result = await service.getJobStats('1');
      expect(result.childStats).toHaveLength(1);
      expect(result.childStats![0]).toEqual({
        jobId: '2',
        sentAt: 150,
        receivedAt: 250,
        stats: { executionTime: 5 },
      });
    });

    it('should handle errors when fetching child stats', async () => {
      const parentMetadata = {
        jobId: '1',
        childJobs: ['2'],
        sentAt: 100,
      };

      mockMinioService.getJobMetadata
        .mockResolvedValueOnce(parentMetadata)
        .mockRejectedValueOnce(new Error('Failed'));

      const result = await service.getJobStats('1');
      expect(result.childStats).toBeUndefined();
    });
  });

  describe('getAggregatedJobOutput', () => {
    it('should return output for single job', async () => {
      const metadata = { jobId: '1', outputId: 'out-1' };
      const output = { result: 'success' };

      mockMinioService.getJobMetadata.mockResolvedValue(metadata);
      mockMinioService.getOutputData.mockResolvedValue(JSON.stringify(output));

      const result = await service.getAggregatedJobOutput('1');
      expect(result.output).toEqual(output);
      expect(result.aggregatedOutput).toBeUndefined();
    });

    it('should aggregate results for parent job', async () => {
      const parentMetadata = {
        jobId: '1',
        outputId: 'out-1',
        childJobs: ['2'],
      };
      const childMetadata = {
        jobId: '2',
        status: 'completed',
        outputId: 'out-2',
      };
      const childOutput = {
        results: {
          initiatingEvents: [{ name: 'IE1', sequences: [{ name: 'SEQ1' }] }],
        },
      };

      mockMinioService.getJobMetadata
        .mockResolvedValueOnce(parentMetadata)
        .mockResolvedValueOnce(childMetadata);

      mockMinioService.getOutputData
        .mockResolvedValueOnce(JSON.stringify(childOutput)) // child output (called first via collectChildOutputs)
        .mockResolvedValueOnce('{}'); // parent output (called second)

      const result = await service.getAggregatedJobOutput('1');

      expect(result.childOutputs).toHaveLength(1);
      expect(result.aggregatedOutput).toBeDefined();
      expect(result.aggregatedOutput.results.initiatingEvents).toHaveLength(1);
    });

    it('should handle failed child jobs', async () => {
      const parentMetadata = { jobId: '1', childJobs: ['2'] };
      const childMetadata = {
        jobId: '2',
        status: 'failed',
        error: 'Some error',
      };

      mockMinioService.getJobMetadata
        .mockResolvedValueOnce(parentMetadata)
        .mockResolvedValueOnce(childMetadata);

      mockMinioService.getOutputData.mockResolvedValue('{}');

      const result = await service.getAggregatedJobOutput('1');

      expect(result.failedJobs).toHaveLength(1);
      expect(result.failedJobs![0]).toEqual({
        jobId: '2',
        error: 'Some error',
      });
    });

    it('should handle missing output for completed child job', async () => {
      const parentMetadata = { jobId: '1', childJobs: ['2'] };
      const childMetadata = {
        jobId: '2',
        status: 'completed',
        outputId: 'out-2',
      };

      mockMinioService.getJobMetadata
        .mockResolvedValueOnce(parentMetadata)
        .mockResolvedValueOnce(childMetadata);

      mockMinioService.getOutputData
        .mockRejectedValueOnce(new Error('Not found')) // child output (called first)
        .mockResolvedValueOnce('{}'); // parent output (called second)

      const result = await service.getAggregatedJobOutput('1');

      expect(result.failedJobs).toHaveLength(1);
      expect(result.failedJobs![0].error).toBe('Output not available');
    });
  });
});
