import { Test, TestingModule } from '@nestjs/testing';
import { ScramController } from './scram.controller';
import { ProducerService } from '../services/producer.service';
import { StorageService } from '../services/storage.service';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

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
    getQuantifiedReports: vi.fn(),
    getInputData: vi.fn(),
    getJobStats: vi.fn(),
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
      mockProducerService.createAndQueueSequenceBatch.mockResolvedValue(
        sequenceJobIds,
      );
      const result = await controller.createAndQueueQuant({} as any, {
        distributedSequences: 'yes',
      });
      expect(result).toEqual({ parentJobId: 'job-1', sequenceJobIds });
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockProducerService.createAndQueueQuant.mockRejectedValue(new Error());
      await expect(controller.createAndQueueQuant({} as any)).rejects.toThrow(
        InternalServerErrorException,
      );
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
      mockProducerService.createAndQueueAdaptiveSequenceBatch.mockResolvedValue(
        sequenceJobIds,
      );
      const result = await controller.createAndQueueAdaptiveQuant({} as any, {
        distributedSequences: 'yes',
      });
      expect(result).toEqual({ parentJobId: 'job-1', sequenceJobIds });
    });

    it('should throw InternalServerErrorException if no sequences extracted', async () => {
      mockProducerService.createAndQueueAdaptiveSequenceBatch.mockResolvedValue(
        [],
      );
      await expect(
        controller.createAndQueueAdaptiveQuant({} as any, {
          distributedSequences: 'yes',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockProducerService.createAndQueueQuant.mockRejectedValue(new Error());
      await expect(
        controller.createAndQueueAdaptiveQuant({} as any),
      ).rejects.toThrow(InternalServerErrorException);
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
      await expect(controller.getJobStatus('job-id')).rejects.toThrow(
        NotFoundException,
      );
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
      await expect(controller.getAggregatedOutput('job-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getQuantifiedReports', () => {
    it('should return all quantified reports', async () => {
      const reports = [{ jobId: 'job-1' }, { jobId: 'job-2' }];
      mockStorageService.getQuantifiedReports.mockResolvedValue(reports);
      const result = await controller.getQuantifiedReports();
      expect(result).toEqual(['job-1', 'job-2']);
    });

    it('should throw NotFoundException on error', async () => {
      mockStorageService.getQuantifiedReports.mockRejectedValue(new Error());
      await expect(controller.getQuantifiedReports()).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getInputData', () => {
    it('should return parsed input data', async () => {
      const inputData = '{"model": "test"}';
      mockStorageService.getInputData.mockResolvedValue(inputData);
      const result = await controller.getInputData('input-123');
      expect(result).toEqual({ model: 'test' });
    });

    it('should throw NotFoundException on error', async () => {
      mockStorageService.getInputData.mockRejectedValue(new Error());
      await expect(controller.getInputData('input-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getJobStats', () => {
    it('should return cleaned job stats', async () => {
      const stats = {
        sentAt: 1000,
        receivedAt: 2000,
        stats: {
          idleTime: 1,
          executionTime: 10,
          analysisSeconds: 8,
          totalSeconds: 10,
          reportWriteTimeMs: 500,
          probability: 0.5,
        },
      };
      mockStorageService.getJobStats.mockResolvedValue(stats);
      const result = await controller.getJobStats('job-123');

      expect(result.stats).toBeDefined();
      expect(result.stats?.totalSeconds).toBeUndefined();
      expect(result.stats?.reportWriteTimeMs).toBeUndefined();
      expect(result.stats?.analysisSeconds).toBe(8);
    });

    it('should use totalSeconds as analysisSeconds when analysisSeconds missing', async () => {
      const stats = {
        stats: {
          totalSeconds: 12,
          reportWriteTimeMs: 500,
        },
      };
      mockStorageService.getJobStats.mockResolvedValue(stats);
      const result = await controller.getJobStats('job-123');

      expect(result.stats?.analysisSeconds).toBe(12);
      expect(result.stats?.totalSeconds).toBeUndefined();
    });

    it('should clean childStats', async () => {
      const stats = {
        sentAt: 1000,
        stats: { analysisSeconds: 5 },
        childStats: [
          {
            jobId: 'child-1',
            stats: {
              analysisSeconds: 3,
              totalSeconds: 4,
              reportWriteTimeMs: 200,
            },
          },
        ],
      };
      mockStorageService.getJobStats.mockResolvedValue(stats);
      const result = await controller.getJobStats('job-123');

      expect(result.childStats?.[0].stats?.totalSeconds).toBeUndefined();
      expect(result.childStats?.[0].stats?.reportWriteTimeMs).toBeUndefined();
      expect(result.childStats?.[0].stats?.analysisSeconds).toBe(3);
    });

    it('should throw NotFoundException on error', async () => {
      mockStorageService.getJobStats.mockRejectedValue(new Error());
      await expect(controller.getJobStats('job-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
