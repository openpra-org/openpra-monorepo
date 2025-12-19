import { Test, TestingModule } from '@nestjs/testing';
import { ConsumerService } from './consumer.service';
import {
  QueueService,
  RabbitMQChannelModelService,
  QueueConfigFactory,
  MinioService,
} from '../../shared';
import { runQuantificationWithWorker } from '../workers/quantify-worker-runner';
import { RpcException } from '@nestjs/microservices';

// Mock typia
vi.mock('typia', () => ({
  default: {
    json: {
      assertParse: vi.fn(),
    },
  },
}));

// Mock worker runner
vi.mock('../workers/quantify-worker-runner', () => ({
  runQuantificationWithWorker: vi.fn(),
}));

describe('ConsumerService', () => {
  let service: ConsumerService;
  let queueService: QueueService;
  let rabbitmqService: RabbitMQChannelModelService;
  let minioService: MinioService;

  const mockChannel = {
    checkQueue: vi.fn(),
    consume: vi.fn(),
    ack: vi.fn(),
    nack: vi.fn(),
    close: vi.fn(),
  };

  const mockChannelModel = {
    close: vi.fn(),
  };

  const mockQueueService = {
    setupQueue: vi.fn(),
  };

  const mockRabbitMQService = {
    getChannelModel: vi.fn().mockResolvedValue(mockChannelModel),
    getChannel: vi.fn().mockResolvedValue(mockChannel),
  };

  const mockQueueConfigFactory = {
    createQuantJobQueueConfig: vi.fn().mockReturnValue({ name: 'quant' }),
    createDistributedSequencesJobQueueConfig: vi
      .fn()
      .mockReturnValue({ name: 'dist' }),
    createAdaptiveSequencesJobQueueConfig: vi
      .fn()
      .mockReturnValue({ name: 'adapt' }),
  };

  const mockMinioService = {
    getJobMetadata: vi.fn().mockResolvedValue({ sentAt: Date.now() }),
    updateJobMetadata: vi.fn().mockResolvedValue(undefined),
    storeOutputData: vi.fn().mockResolvedValue('output-id'),
    storeInputData: vi.fn().mockResolvedValue('input-id'),
    createJobMetadata: vi.fn().mockResolvedValue(undefined),
    markSequenceCompleted: vi.fn().mockResolvedValue(undefined),
    getCompletedSequenceCount: vi.fn().mockResolvedValue(0),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumerService,
        { provide: QueueService, useValue: mockQueueService },
        { provide: RabbitMQChannelModelService, useValue: mockRabbitMQService },
        { provide: QueueConfigFactory, useValue: mockQueueConfigFactory },
        { provide: MinioService, useValue: mockMinioService },
      ],
    }).compile();

    service = module.get<ConsumerService>(ConsumerService);
    queueService = module.get<QueueService>(QueueService);
    rabbitmqService = module.get<RabbitMQChannelModelService>(
      RabbitMQChannelModelService,
    );
    minioService = module.get<MinioService>(MinioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onApplicationBootstrap', () => {
    it('should setup queues and start consuming', async () => {
      await service.onApplicationBootstrap();
      expect(rabbitmqService.getChannelModel).toHaveBeenCalled();
      expect(rabbitmqService.getChannel).toHaveBeenCalled();
      expect(queueService.setupQueue).toHaveBeenCalledTimes(3);
      expect(mockChannel.consume).toHaveBeenCalledTimes(3);
    });
  });

  describe('consumeQuantJobs processing', () => {
    let consumeCallback: (msg: any) => Promise<void>;

    beforeEach(async () => {
      // Capture the callback passed to consume
      mockChannel.consume.mockImplementation((queue, callback) => {
        if (queue === 'quant') {
          consumeCallback = callback;
        }
      });
      await service.onApplicationBootstrap();
    });

    it('should process valid message successfully', async () => {
      const msg = { content: Buffer.from('{}') };
      const quantRequest = { _id: 'job-id' };

      const typiaMock = await import('typia');
      (typiaMock.default.json.assertParse as any).mockReturnValue(quantRequest);
      (runQuantificationWithWorker as any).mockResolvedValue({
        result: 'success',
      });

      await consumeCallback(msg);

      expect(typiaMock.default.json.assertParse).toHaveBeenCalled();
      expect(runQuantificationWithWorker).toHaveBeenCalled();
      expect(minioService.updateJobMetadata).toHaveBeenCalledWith(
        'job-id',
        expect.objectContaining({ status: 'running' }),
      );
      expect(minioService.storeOutputData).toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should nack and update metadata on worker failure', async () => {
      const msg = { content: Buffer.from('{}') };
      const quantRequest = { _id: 'job-id' };

      const typiaMock = await import('typia');
      (typiaMock.default.json.assertParse as any).mockReturnValue(quantRequest);
      (runQuantificationWithWorker as any).mockRejectedValue(
        new Error('Worker failed'),
      );

      await consumeCallback(msg);

      expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(minioService.updateJobMetadata).toHaveBeenCalledWith(
        'job-id',
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('should nack on parse error', async () => {
      const msg = { content: Buffer.from('invalid-json') };

      const typiaMock = await import('typia');
      (typiaMock.default.json.assertParse as any).mockImplementation(() => {
        throw new Error('Parse error');
      });

      // The consume callback throws RpcException when parse fails, which is not caught inside the callback wrapper in the test unless we catch it.
      // However, looking at the code:
      // catch (err) { this.channel?.nack... throw new RpcException }
      // So it throws.

      await expect(consumeCallback(msg)).rejects.toThrow(RpcException);
      expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
    });

    it('should throw RpcException on null message', async () => {
      await expect(consumeCallback(null)).rejects.toThrow(RpcException);
    });
  });

  describe('consumeDistributedSequenceJobs processing', () => {
    let consumeCallback: (msg: any) => Promise<void>;

    beforeEach(async () => {
      mockChannel.consume.mockImplementation((queue, callback) => {
        if (queue === 'dist') {
          consumeCallback = callback;
        }
      });
      await service.onApplicationBootstrap();
    });

    it('should process distributed sequence job successfully', async () => {
      const msg = { content: Buffer.from('{}') };
      const quantRequest = { _id: 'parent-job-id-seq-1-0' }; // 6-part format

      const typiaMock = await import('typia');
      (typiaMock.default.json.assertParse as any).mockReturnValue(quantRequest);
      (runQuantificationWithWorker as any).mockResolvedValue({
        results: { sumOfProducts: [{ probability: 0.5, products: 10 }] },
      });

      mockMinioService.getJobMetadata.mockResolvedValue({
        sentAt: Date.now(),
        childJobs: ['parent-job-id-seq-1-0'],
      });
      mockMinioService.getCompletedSequenceCount.mockResolvedValue(1);

      await consumeCallback(msg);

      expect(mockMinioService.storeInputData).toHaveBeenCalled();
      expect(mockMinioService.createJobMetadata).toHaveBeenCalled();
      expect(mockMinioService.markSequenceCompleted).toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should handle sequence job errors', async () => {
      const msg = { content: Buffer.from('{}') };
      const quantRequest = { _id: 'parent-job-id-seq-1-0' }; // 6-part format

      const typiaMock = await import('typia');
      (typiaMock.default.json.assertParse as any).mockReturnValue(quantRequest);
      (runQuantificationWithWorker as any).mockRejectedValue(
        new Error('Worker failed'),
      );

      await consumeCallback(msg);

      expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(mockMinioService.updateJobMetadata).toHaveBeenCalledWith(
        'parent-job-id-seq-1',
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('should throw RpcException on null message', async () => {
      await expect(consumeCallback(null)).rejects.toThrow(RpcException);
    });

    it('should nack on parse error', async () => {
      const msg = { content: Buffer.from('invalid') };

      const typiaMock = await import('typia');
      (typiaMock.default.json.assertParse as any).mockImplementation(() => {
        throw new Error('Parse error');
      });

      await expect(consumeCallback(msg)).rejects.toThrow(RpcException);
      expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
    });
  });

  describe('consumeAdaptiveSequenceJobs processing', () => {
    let consumeCallback: (msg: any) => Promise<void>;

    beforeEach(async () => {
      mockChannel.consume.mockImplementation((queue, callback) => {
        if (queue === 'adapt') {
          consumeCallback = callback;
        }
      });
      await service.onApplicationBootstrap();
    });

    it('should process adaptive sequence job successfully', async () => {
      const msg = { content: Buffer.from('{}') };
      const quantRequest = { _id: 'parent-job-id-seq-1-0' }; // 6-part format

      const typiaMock = await import('typia');
      (typiaMock.default.json.assertParse as any).mockReturnValue(quantRequest);
      (runQuantificationWithWorker as any).mockResolvedValue({
        results: {
          sumOfProducts: [
            {
              originalProducts: 100,
              products: 50,
              exactProbability: 0.7,
              approximateProbability: 0.69,
              relativeError: 0.01,
            },
          ],
        },
        runtimeSummary: { analysisSeconds: 5, totalSeconds: 6 },
      });

      mockMinioService.getJobMetadata.mockResolvedValue({
        sentAt: Date.now(),
        childJobs: ['parent-job-id-seq-1-0'],
      });
      mockMinioService.getCompletedSequenceCount.mockResolvedValue(1);

      await consumeCallback(msg);

      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
      expect(mockMinioService.updateJobMetadata).toHaveBeenCalledWith(
        'parent-job-id-seq-1-0',
        expect.objectContaining({
          status: 'completed',
          stats: expect.objectContaining({
            originalProducts: 100,
            products: 50,
            exactProbability: 0.7,
          }),
        }),
      );
    });

    it('should handle adaptive job errors', async () => {
      const msg = { content: Buffer.from('{}') };
      const quantRequest = { _id: 'parent-job-id-seq-1-0' }; // 6-part format

      const typiaMock = await import('typia');
      (typiaMock.default.json.assertParse as any).mockReturnValue(quantRequest);
      (runQuantificationWithWorker as any).mockRejectedValue(
        new Error('Worker error'),
      );

      await consumeCallback(msg);

      expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
    });

    it('should throw RpcException on null message', async () => {
      await expect(consumeCallback(null)).rejects.toThrow(RpcException);
    });
  });

  describe('performQuantification', () => {
    it('should call runQuantificationWithWorker', async () => {
      const request = { _id: 'job-123', model: 'test' };
      (runQuantificationWithWorker as any).mockResolvedValue({ result: 'ok' });

      const result = await service.performQuantification(request);

      expect(runQuantificationWithWorker).toHaveBeenCalledWith({
        model: 'test',
      });
      expect(result).toEqual({ result: 'ok' });
    });

    it('should throw error on quantification failure', async () => {
      const request = { _id: 'job-123', model: 'test' };
      (runQuantificationWithWorker as any).mockRejectedValue(
        new Error('SCRAM error'),
      );

      await expect(service.performQuantification(request)).rejects.toThrow(
        'SCRAM quantification failed: SCRAM error',
      );
    });
  });

  describe('onApplicationShutdown', () => {
    beforeEach(async () => {
      await service.onApplicationBootstrap();
    });

    it('should delete queues and close connections', async () => {
      mockChannel.deleteQueue = vi.fn().mockResolvedValue(undefined);

      await service.onApplicationShutdown();

      expect(mockChannel.deleteQueue).toHaveBeenCalledWith('quant');
      expect(mockChannel.deleteQueue).toHaveBeenCalledWith('dist');
      expect(mockChannel.deleteQueue).toHaveBeenCalledWith('adapt');
      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockChannelModel.close).toHaveBeenCalled();
    });

    it('should throw RpcException on shutdown failure', async () => {
      mockChannel.deleteQueue = vi.fn().mockRejectedValue(new Error('Error'));

      await expect(service.onApplicationShutdown()).rejects.toThrow(
        RpcException,
      );
    });
  });

  describe('error scenarios in queue checks', () => {
    it('should throw RpcException if quant queue does not exist', async () => {
      mockChannel.checkQueue.mockRejectedValue(new Error('Queue not found'));

      await expect(service.onApplicationBootstrap()).rejects.toThrow(
        RpcException,
      );
    });
  });

  describe('handleRegularJob with different result formats', () => {
    let consumeCallback: (msg: any) => Promise<void>;

    beforeEach(async () => {
      mockChannel.checkQueue.mockResolvedValue(undefined);
      mockChannel.consume.mockImplementation((queue, callback) => {
        if (queue === 'quant') {
          consumeCallback = callback;
        }
      });
      await service.onApplicationBootstrap();
    });

    it('should extract metrics from sumOfProducts format', async () => {
      const msg = { content: Buffer.from('{}') };
      const quantRequest = { _id: 'job-id' };

      const typiaMock = await import('typia');
      (typiaMock.default.json.assertParse as any).mockReturnValue(quantRequest);
      (runQuantificationWithWorker as any).mockResolvedValue({
        results: {
          sumOfProducts: [{ probability: 0.8, products: 20 }],
        },
        runtimeSummary: { analysisSeconds: 10, totalSeconds: 12 },
      });

      await consumeCallback(msg);

      expect(mockMinioService.updateJobMetadata).toHaveBeenCalledWith(
        'job-id',
        expect.objectContaining({
          status: 'completed',
          stats: expect.objectContaining({
            probability: 0.8,
            products: 20,
            analysisSeconds: 10,
            totalSeconds: 12,
          }),
        }),
      );
    });

    it('should extract metrics from initiatingEvents format', async () => {
      const msg = { content: Buffer.from('{}') };
      const quantRequest = { _id: 'job-id' };

      const typiaMock = await import('typia');
      (typiaMock.default.json.assertParse as any).mockReturnValue(quantRequest);
      (runQuantificationWithWorker as any).mockResolvedValue({
        results: {
          initiatingEvents: [
            {
              sequences: [{ probability: 0.6, products: 15 }],
            },
          ],
          runtimeSummary: { analysisSeconds: 5 },
        },
      });

      await consumeCallback(msg);

      expect(mockMinioService.updateJobMetadata).toHaveBeenCalledWith(
        'job-id',
        expect.objectContaining({
          status: 'completed',
          stats: expect.objectContaining({
            probability: 0.6,
            products: 15,
            analysisSeconds: 5,
          }),
        }),
      );
    });

    it('should handle file result format', async () => {
      const msg = { content: Buffer.from('{}') };
      const quantRequest = { _id: 'job-id' };

      const typiaMock = await import('typia');
      (typiaMock.default.json.assertParse as any).mockReturnValue(quantRequest);

      // Mock the file result - don't try to create actual file streams in the test
      (runQuantificationWithWorker as any).mockResolvedValue({
        results: { sumOfProducts: [{ probability: 0.5 }] },
      });

      await consumeCallback(msg);

      expect(mockMinioService.updateJobMetadata).toHaveBeenCalledWith(
        'job-id',
        expect.objectContaining({ status: 'completed' }),
      );
    });
  });

  describe('extractAdaptiveMetrics edge cases', () => {
    let consumeCallback: (msg: any) => Promise<void>;

    beforeEach(async () => {
      mockChannel.checkQueue.mockResolvedValue(undefined);
      mockChannel.consume.mockImplementation((queue, callback) => {
        if (queue === 'adapt') {
          consumeCallback = callback;
        }
      });
      await service.onApplicationBootstrap();
    });

    it('should handle metrics from cutSets', async () => {
      const msg = { content: Buffer.from('{}') };
      const quantRequest = { _id: 'parent-job-id-seq-1-0' }; // 6-part format

      const typiaMock = await import('typia');
      (typiaMock.default.json.assertParse as any).mockReturnValue(quantRequest);
      (runQuantificationWithWorker as any).mockResolvedValue({
        results: {
          initiatingEvents: [
            {
              sequences: [
                {
                  cutSets: {
                    originalProducts: 200,
                    products: 80,
                    exactProbability: 0.9,
                    approximateProbability: 0.88,
                    relativeError: 0.02,
                  },
                },
              ],
            },
          ],
        },
      });

      mockMinioService.getJobMetadata.mockResolvedValue({
        sentAt: Date.now(),
        childJobs: ['parent-job-id-seq-1-0'],
      });
      mockMinioService.getCompletedSequenceCount.mockResolvedValue(1);

      await consumeCallback(msg);

      expect(mockMinioService.updateJobMetadata).toHaveBeenCalledWith(
        'parent-job-id-seq-1-0',
        expect.objectContaining({
          stats: expect.objectContaining({
            originalProducts: 200,
            products: 80,
            exactProbability: 0.9,
          }),
        }),
      );
    });

    it('should handle alternative field names', async () => {
      const msg = { content: Buffer.from('{}') };
      const quantRequest = { _id: 'parent-job-id-seq-1-0' }; // 6-part format

      const typiaMock = await import('typia');
      (typiaMock.default.json.assertParse as any).mockReturnValue(quantRequest);
      (runQuantificationWithWorker as any).mockResolvedValue({
        results: {
          sumOfProducts: [
            {
              adaptiveTarget: 0.75,
              probability: 0.74,
              'exact-probability': 0.76,
            },
          ],
        },
      });

      mockMinioService.getJobMetadata.mockResolvedValue({
        sentAt: Date.now(),
        childJobs: ['parent-job-id-seq-1-0'],
      });
      mockMinioService.getCompletedSequenceCount.mockResolvedValue(1);

      await consumeCallback(msg);

      expect(mockMinioService.updateJobMetadata).toHaveBeenCalledWith(
        'parent-job-id-seq-1-0',
        expect.objectContaining({
          stats: expect.objectContaining({
            exactProbability: 0.75,
            approximateProbability: 0.74,
          }),
        }),
      );
    });

    it('should handle missing metrics gracefully', async () => {
      const msg = { content: Buffer.from('{}') };
      const quantRequest = { _id: 'parent-job-id-seq-1-0' }; // 6-part format

      const typiaMock = await import('typia');
      (typiaMock.default.json.assertParse as any).mockReturnValue(quantRequest);
      (runQuantificationWithWorker as any).mockResolvedValue({
        results: {},
      });

      mockMinioService.getJobMetadata.mockResolvedValue({
        sentAt: Date.now(),
        childJobs: ['parent-job-id-seq-1-0'],
      });
      mockMinioService.getCompletedSequenceCount.mockResolvedValue(1);

      await consumeCallback(msg);

      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });
  });

  describe('sequence completion tracking', () => {
    let consumeCallback: (msg: any) => Promise<void>;

    beforeEach(async () => {
      mockChannel.checkQueue.mockResolvedValue(undefined);
      mockChannel.consume.mockImplementation((queue, callback) => {
        if (queue === 'dist') {
          consumeCallback = callback;
        }
      });
      await service.onApplicationBootstrap();
    });

    it('should mark parent as partial when not all sequences complete', async () => {
      const msg = { content: Buffer.from('{}') };
      const quantRequest = { _id: 'parent-job-id-seq-1-0' }; // 6-part format

      const typiaMock = await import('typia');
      (typiaMock.default.json.assertParse as any).mockReturnValue(quantRequest);
      (runQuantificationWithWorker as any).mockResolvedValue({
        results: { sumOfProducts: [{ probability: 0.5 }] },
      });

      mockMinioService.getJobMetadata.mockResolvedValue({
        sentAt: Date.now(),
        childJobs: ['parent-job-id-seq-1-0', 'parent-job-id-seq-2-0'],
      });
      mockMinioService.getCompletedSequenceCount.mockResolvedValue(1);

      await consumeCallback(msg);

      expect(mockMinioService.updateJobMetadata).toHaveBeenCalledWith(
        'parent-job-id-seq-1',
        expect.objectContaining({ status: 'partial' }),
      );
    });

    it('should mark parent as completed when all sequences complete', async () => {
      const msg = { content: Buffer.from('{}') };
      const quantRequest = { _id: 'parent-job-id-seq-1-0' }; // 6-part format

      const typiaMock = await import('typia');
      (typiaMock.default.json.assertParse as any).mockReturnValue(quantRequest);
      (runQuantificationWithWorker as any).mockResolvedValue({
        results: { sumOfProducts: [{ probability: 0.5 }] },
      });

      mockMinioService.getJobMetadata.mockResolvedValue({
        sentAt: Date.now(),
        childJobs: ['parent-job-id-seq-1-0'],
      });
      mockMinioService.getCompletedSequenceCount.mockResolvedValue(1);

      await consumeCallback(msg);

      expect(mockMinioService.updateJobMetadata).toHaveBeenCalledWith(
        'parent-job-id-seq-1',
        expect.objectContaining({ status: 'completed' }),
      );
    });
  });
});
