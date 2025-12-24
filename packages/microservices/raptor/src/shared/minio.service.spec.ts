import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MinioService } from './minio.service';
import { EnvVarKeys } from '../../config/env_vars.config';

const mockMinioClient = {
  bucketExists: vi.fn(),
  makeBucket: vi.fn(),
  listObjects: vi.fn(),
  getObject: vi.fn(),
  putObject: vi.fn(),
};

// Mock Minio Client
vi.mock('minio', () => {
  return {
    Client: class {
      constructor() {
        return mockMinioClient;
      }
    },
  };
});

describe('MinioService', () => {
  let service: MinioService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let minioClient: any;

  const mockConfigService = {
    getOrThrow: vi.fn((key: string) => {
      switch (key) {
        case EnvVarKeys.ENV_MINIO_INPUT_BUCKET:
          return 'input-bucket';
        case EnvVarKeys.ENV_MINIO_OUTPUT_BUCKET:
          return 'output-bucket';
        case EnvVarKeys.ENV_MINIO_JOBS_BUCKET:
          return 'jobs-bucket';
        case EnvVarKeys.ENV_MINIO_ENDPOINT:
          return 'localhost';
        case EnvVarKeys.ENV_MINIO_PORT:
          return 9000;
        case EnvVarKeys.ENV_MINIO_ACCESS_KEY:
          return 'minio';
        case EnvVarKeys.ENV_MINIO_SECRET_KEY:
          return 'minio123';
        default:
          return null;
      }
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinioService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MinioService>(MinioService);
    minioClient = mockMinioClient;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize buckets if they do not exist', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false);

      await service.onModuleInit();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledTimes(3);
      expect(mockMinioClient.makeBucket).toHaveBeenCalledTimes(3);
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('input-bucket');
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('output-bucket');
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('jobs-bucket');
    });

    it('should not create buckets if they already exist', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true);

      await service.onModuleInit();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledTimes(3);
      expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
    });
  });

  describe('getCompletedSequenceCount', () => {
    it('should return count of completed sequences', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { name: 'obj1' };
          yield { name: 'obj2' };
        },
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);

      const count = await service.getCompletedSequenceCount('parent-job-id');
      expect(count).toBe(2);
      expect(mockMinioClient.listObjects).toHaveBeenCalledWith(
        'jobs-bucket',
        'job-parent-job-id/completed/',
        true,
      );
    });

    it('should return 0 if stream is empty', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {},
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);

      const count = await service.getCompletedSequenceCount('parent-job-id');
      expect(count).toBe(0);
    });
  });

  describe('storeInputData', () => {
    it('should store input data and return inputId', async () => {
      mockMinioClient.putObject.mockResolvedValue(undefined);

      const inputData = { model: 'test-model' };
      const inputId = await service.storeInputData(inputData);

      expect(inputId).toBeDefined();
      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'input-bucket',
        expect.stringContaining('input-'),
        expect.any(Buffer),
        expect.any(Number),
        expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Input-ID': inputId,
        }),
      );
    });

    it('should handle string input data', async () => {
      mockMinioClient.putObject.mockResolvedValue(undefined);

      const inputData = '{"model": "test-model"}';
      const inputId = await service.storeInputData(inputData);

      expect(inputId).toBeDefined();
      expect(mockMinioClient.putObject).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      mockMinioClient.putObject.mockRejectedValue(new Error('Storage error'));

      await expect(service.storeInputData({ data: 'test' })).rejects.toThrow(
        'Failed to store input data: Storage error',
      );
    });
  });

  describe('getInputData', () => {
    it('should retrieve input data', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { name: 'input-test-id-123.json' };
        },
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);

      const mockDataStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('{"data": "test"}');
        },
      };
      mockMinioClient.getObject.mockResolvedValue(mockDataStream);

      const data = await service.getInputData('test-id');
      expect(data).toBe('{"data": "test"}');
      expect(mockMinioClient.listObjects).toHaveBeenCalledWith(
        'input-bucket',
        'input-test-id-',
        true,
      );
    });

    it('should throw error if no input found', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {},
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);

      await expect(service.getInputData('nonexistent')).rejects.toThrow(
        'No input data found for ID: nonexistent',
      );
    });

    it('should throw error on retrieval failure', async () => {
      mockMinioClient.listObjects.mockImplementation(() => {
        throw new Error('List error');
      });

      await expect(service.getInputData('test-id')).rejects.toThrow(
        'Failed to retrieve input data: List error',
      );
    });
  });

  describe('storeOutputData', () => {
    it('should store output data as string', async () => {
      mockMinioClient.putObject.mockResolvedValue(undefined);

      const outputData = '{"result": "success"}';
      const outputId = await service.storeOutputData(outputData, 'input-id');

      expect(outputId).toBeDefined();
      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'output-bucket',
        expect.stringContaining('output-'),
        expect.any(Object),
        undefined,
        expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Output-ID': outputId,
          'X-Input-ID': 'input-id',
        }),
      );
    });

    it('should store output data as stream', async () => {
      const { Readable } = await import('stream');
      mockMinioClient.putObject.mockResolvedValue(undefined);

      const outputData = Readable.from(['{"result": "success"}']);
      const outputId = await service.storeOutputData(outputData, 'input-id');

      expect(outputId).toBeDefined();
      expect(mockMinioClient.putObject).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      mockMinioClient.putObject.mockRejectedValue(new Error('Storage error'));

      await expect(service.storeOutputData('data', 'input-id')).rejects.toThrow(
        'Failed to store output data: Storage error',
      );
    });
  });

  describe('getOutputData', () => {
    it('should retrieve output data', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { name: 'output-test-id-123.json' };
        },
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);

      const mockDataStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('{"result": "data"}');
        },
      };
      mockMinioClient.getObject.mockResolvedValue(mockDataStream);

      const data = await service.getOutputData('test-id');
      expect(data).toBe('{"result": "data"}');
    });

    it('should throw error if no output found', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {},
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);

      await expect(service.getOutputData('nonexistent')).rejects.toThrow(
        'No output data found for ID: nonexistent',
      );
    });
  });

  describe('createJobMetadata', () => {
    it('should create job metadata with default status', async () => {
      mockMinioClient.putObject.mockResolvedValue(undefined);

      await service.createJobMetadata('job-123', 'input-123');

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'jobs-bucket',
        'job-job-123.json',
        expect.any(Buffer),
        undefined,
        expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Job-ID': 'job-123',
        }),
      );
    });

    it('should create job metadata with initial data', async () => {
      mockMinioClient.putObject.mockResolvedValue(undefined);

      await service.createJobMetadata('job-123', 'input-123', {
        status: 'running',
        childJobs: ['child-1'],
      });

      expect(mockMinioClient.putObject).toHaveBeenCalled();
      const callArgs = mockMinioClient.putObject.mock.calls[0];
      const buffer = callArgs[2];
      const metadata = JSON.parse(buffer.toString());
      expect(metadata.status).toBe('running');
      expect(metadata.childJobs).toEqual(['child-1']);
    });

    it('should throw error on failure', async () => {
      mockMinioClient.putObject.mockRejectedValue(new Error('Create error'));

      await expect(
        service.createJobMetadata('job-123', 'input-123'),
      ).rejects.toThrow('Failed to create job metadata: Create error');
    });
  });

  describe('getJobMetadata', () => {
    it('should retrieve job metadata', async () => {
      const metadata = {
        jobId: 'job-123',
        inputId: 'input-123',
        status: 'completed',
      };

      const mockDataStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from(JSON.stringify(metadata));
        },
      };
      mockMinioClient.getObject.mockResolvedValue(mockDataStream);

      const result = await service.getJobMetadata('job-123');
      expect(result).toEqual(metadata);
    });

    it('should throw error on retrieval failure', async () => {
      mockMinioClient.getObject.mockRejectedValue(new Error('Get error'));

      await expect(service.getJobMetadata('job-123')).rejects.toThrow(
        'Failed to retrieve job metadata: Get error',
      );
    });
  });

  describe('updateJobMetadata', () => {
    it('should update job metadata', async () => {
      const existingMetadata = {
        jobId: 'job-123',
        inputId: 'input-123',
        status: 'pending',
      };

      const mockDataStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from(JSON.stringify(existingMetadata));
        },
      };
      mockMinioClient.getObject.mockResolvedValue(mockDataStream);
      mockMinioClient.putObject.mockResolvedValue(undefined);

      await service.updateJobMetadata('job-123', { status: 'running' });

      expect(mockMinioClient.putObject).toHaveBeenCalled();
      const callArgs = mockMinioClient.putObject.mock.calls[0];
      const buffer = callArgs[2];
      const metadata = JSON.parse(buffer.toString());
      expect(metadata.status).toBe('running');
    });

    it('should deep merge stats', async () => {
      const existingMetadata = {
        jobId: 'job-123',
        inputId: 'input-123',
        stats: { idleTime: 5, executionTime: 10 },
      };

      const mockDataStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from(JSON.stringify(existingMetadata));
        },
      };
      mockMinioClient.getObject.mockResolvedValue(mockDataStream);
      mockMinioClient.putObject.mockResolvedValue(undefined);

      await service.updateJobMetadata('job-123', {
        stats: { executionTime: 15, probability: 0.5 },
      });

      const callArgs = mockMinioClient.putObject.mock.calls[0];
      const buffer = callArgs[2];
      const metadata = JSON.parse(buffer.toString());
      expect(metadata.stats.idleTime).toBe(5);
      expect(metadata.stats.executionTime).toBe(15);
      expect(metadata.stats.probability).toBe(0.5);
    });

    it('should throw error on failure', async () => {
      mockMinioClient.getObject.mockRejectedValue(new Error('Get error'));

      await expect(
        service.updateJobMetadata('job-123', { status: 'running' }),
      ).rejects.toThrow('Failed to update job metadata');
    });
  });

  describe('markSequenceCompleted', () => {
    it('should mark sequence as completed', async () => {
      mockMinioClient.putObject.mockResolvedValue(undefined);

      await service.markSequenceCompleted('parent-123', 'seq-456');

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'jobs-bucket',
        'job-parent-123/completed/seq-456.marker',
        expect.any(Buffer),
        undefined,
        expect.objectContaining({
          'Content-Type': 'text/plain',
          'X-Parent-Job-ID': 'parent-123',
          'X-Sequence-Job-ID': 'seq-456',
        }),
      );
    });

    it('should throw error on failure', async () => {
      mockMinioClient.putObject.mockRejectedValue(new Error('Mark error'));

      await expect(
        service.markSequenceCompleted('parent-123', 'seq-456'),
      ).rejects.toThrow('Failed to mark sequence completion: Mark error');
    });
  });

  describe('listCompletedSequences', () => {
    it('should list completed sequence IDs', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { name: 'job-parent/completed/seq-1.marker' };
          yield { name: 'job-parent/completed/seq-2.marker' };
        },
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);

      const sequences = await service.listCompletedSequences('parent');
      expect(sequences).toEqual(['seq-1', 'seq-2']);
    });

    it('should handle empty list', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {},
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);

      const sequences = await service.listCompletedSequences('parent');
      expect(sequences).toEqual([]);
    });

    it('should throw error on failure', async () => {
      mockMinioClient.listObjects.mockImplementation(() => {
        throw new Error('List error');
      });

      await expect(service.listCompletedSequences('parent')).rejects.toThrow(
        'Failed to list completed sequences: List error',
      );
    });
  });

  describe('getAllJobMetadata', () => {
    it('should retrieve all job metadata', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { name: 'job-1.json' };
          yield { name: 'job-2.json' };
        },
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);

      const mockDataStream1 = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from(JSON.stringify({ jobId: 'job-1' }));
        },
      };
      const mockDataStream2 = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from(JSON.stringify({ jobId: 'job-2' }));
        },
      };
      mockMinioClient.getObject
        .mockResolvedValueOnce(mockDataStream1)
        .mockResolvedValueOnce(mockDataStream2);

      const jobs = await service.getAllJobMetadata();
      expect(jobs).toHaveLength(2);
      expect(jobs[0].jobId).toBe('job-1');
      expect(jobs[1].jobId).toBe('job-2');
    });

    it('should skip invalid metadata', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { name: 'job-1.json' };
          yield { name: 'job-2.json' };
        },
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);

      const mockDataStream1 = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('invalid json');
        },
      };
      const mockDataStream2 = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from(JSON.stringify({ jobId: 'job-2' }));
        },
      };
      mockMinioClient.getObject
        .mockResolvedValueOnce(mockDataStream1)
        .mockResolvedValueOnce(mockDataStream2);

      const jobs = await service.getAllJobMetadata();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].jobId).toBe('job-2');
    });

    it('should throw error on failure', async () => {
      mockMinioClient.listObjects.mockImplementation(() => {
        throw new Error('List error');
      });

      await expect(service.getAllJobMetadata()).rejects.toThrow(
        'Failed to retrieve all job metadata: List error',
      );
    });
  });

  describe('deleteInputData', () => {
    it('should delete input data', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { name: 'input-test-1.json' };
          yield { name: 'input-test-2.json' };
        },
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);
      mockMinioClient.removeObject = vi.fn().mockResolvedValue(undefined);

      await service.deleteInputData('test');

      expect(mockMinioClient.removeObject).toHaveBeenCalledTimes(2);
      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        'input-bucket',
        'input-test-1.json',
      );
    });

    it('should throw error on failure', async () => {
      mockMinioClient.listObjects.mockImplementation(() => {
        throw new Error('List error');
      });

      await expect(service.deleteInputData('test')).rejects.toThrow(
        'Failed to delete input data: List error',
      );
    });
  });

  describe('deleteOutputData', () => {
    it('should delete output data', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { name: 'output-test-1.json' };
        },
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);
      mockMinioClient.removeObject = vi.fn().mockResolvedValue(undefined);

      await service.deleteOutputData('test');

      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        'output-bucket',
        'output-test-1.json',
      );
    });

    it('should throw error on failure', async () => {
      mockMinioClient.listObjects.mockImplementation(() => {
        throw new Error('List error');
      });

      await expect(service.deleteOutputData('test')).rejects.toThrow(
        'Failed to delete output data: List error',
      );
    });
  });

  describe('isHealthy', () => {
    it('should return true when healthy', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true);

      const result = await service.isHealthy();
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockMinioClient.bucketExists.mockRejectedValue(new Error('Error'));

      const result = await service.isHealthy();
      expect(result).toBe(false);
    });
  });

  describe('cleanupOldFiles', () => {
    it('should cleanup old files from all buckets', async () => {
      const oldDate = new Date('2020-01-01');
      const recentDate = new Date();

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { name: 'old-file.json', lastModified: oldDate };
          yield { name: 'recent-file.json', lastModified: recentDate };
        },
      };
      mockMinioClient.listObjects.mockReturnValue(mockStream);
      mockMinioClient.removeObject = vi.fn().mockResolvedValue(undefined);

      await service.cleanupOldFiles(7);

      // Should be called 3 times for each bucket, removing only old files
      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        expect.any(String),
        'old-file.json',
      );
      expect(mockMinioClient.removeObject).not.toHaveBeenCalledWith(
        expect.any(String),
        'recent-file.json',
      );
    });

    it('should throw error on failure', async () => {
      mockMinioClient.listObjects.mockImplementation(() => {
        throw new Error('Cleanup error');
      });

      await expect(service.cleanupOldFiles(7)).rejects.toThrow(
        'Cleanup failed: Cleanup error',
      );
    });
  });

  describe('onModuleInit - error handling', () => {
    it('should handle race condition when bucket already exists', async () => {
      mockMinioClient.bucketExists
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      const raceError = new Error('BucketAlreadyExists');
      (raceError as any).code = 'BucketAlreadyExists';
      mockMinioClient.makeBucket.mockRejectedValue(raceError);
      mockMinioClient.bucketExists.mockResolvedValue(true);

      await service.onModuleInit();

      expect(mockMinioClient.makeBucket).toHaveBeenCalled();
    });

    it('should handle BucketAlreadyOwnedByYou error', async () => {
      // First 3 calls for initial bucket checks
      mockMinioClient.bucketExists
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      const error = new Error('BucketAlreadyOwnedByYou');
      (error as any).code = 'BucketAlreadyOwnedByYou';
      mockMinioClient.makeBucket
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      // Follow-up checks after error
      mockMinioClient.bucketExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await service.onModuleInit();

      expect(mockMinioClient.makeBucket).toHaveBeenCalled();
    });

    it('should handle 409 status code error', async () => {
      mockMinioClient.bucketExists
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      const error = new Error('Conflict');
      (error as any).statusCode = 409;
      mockMinioClient.makeBucket
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      mockMinioClient.bucketExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await service.onModuleInit();

      expect(mockMinioClient.makeBucket).toHaveBeenCalled();
    });

    it('should handle message with "already exists" pattern', async () => {
      mockMinioClient.bucketExists
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      const error = new Error('Bucket already exists');
      mockMinioClient.makeBucket
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      mockMinioClient.bucketExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await service.onModuleInit();

      expect(mockMinioClient.makeBucket).toHaveBeenCalled();
    });
  });

  describe('getCompletedSequenceCount edge cases', () => {
    it('should throw error when stream fails', async () => {
      mockMinioClient.listObjects.mockImplementation(() => {
        throw new Error('Stream error');
      });

      await expect(service.getCompletedSequenceCount('parent')).rejects.toThrow(
        'Failed to count completed sequences: Stream error',
      );
    });
  });
});
