import { Test, TestingModule } from '@nestjs/testing';
import { ProducerService } from './producer.service';
import {
  QueueService,
  RabbitMQChannelModelService,
  QueueConfigFactory,
  MinioService,
} from '../../shared';
import { SequenceExtractorService } from './sequence-extractor';
import { RpcException } from '@nestjs/microservices';

// Mock typia
vi.mock('typia', () => ({
  default: {
    json: {
      assertStringify: vi.fn().mockReturnValue('{}'),
    },
  },
}));

describe('ProducerService', () => {
  let service: ProducerService;
  let minioService: MinioService;

  const mockChannel = {
    checkExchange: vi.fn(),
    publish: vi.fn(),
    deleteExchange: vi.fn(),
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
    createQuantJobQueueConfig: vi
      .fn()
      .mockReturnValue({ exchange: { name: 'quant', routingKey: 'key' } }),
    createDistributedSequencesJobQueueConfig: vi
      .fn()
      .mockReturnValue({ exchange: { name: 'dist', routingKey: 'key' } }),
    createAdaptiveSequencesJobQueueConfig: vi
      .fn()
      .mockReturnValue({ exchange: { name: 'adapt', routingKey: 'key' } }),
  };

  const mockMinioService = {
    storeInputData: vi.fn().mockResolvedValue('input-id'),
    createJobMetadata: vi.fn().mockResolvedValue(undefined),
  };

  const mockSequenceExtractorService = {
    extractSequenceRequests: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProducerService,
        { provide: QueueService, useValue: mockQueueService },
        { provide: RabbitMQChannelModelService, useValue: mockRabbitMQService },
        { provide: QueueConfigFactory, useValue: mockQueueConfigFactory },
        { provide: MinioService, useValue: mockMinioService },
        {
          provide: SequenceExtractorService,
          useValue: mockSequenceExtractorService,
        },
      ],
    }).compile();

    service = module.get<ProducerService>(ProducerService);
    minioService = module.get<MinioService>(MinioService);

    // Initialize service (onApplicationBootstrap)
    await service.onApplicationBootstrap();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAndQueueQuant', () => {
    it('should create and queue quant job', async () => {
      const quantRequest = { _id: 'job-id' } as any;
      const jobId = await service.createAndQueueQuant(quantRequest);

      expect(jobId).toBeDefined();
      expect(minioService.storeInputData).toHaveBeenCalled();
      expect(minioService.createJobMetadata).toHaveBeenCalled();
      expect(mockChannel.publish).toHaveBeenCalled();
    });

    it('should throw RpcException if exchange check fails', async () => {
      mockChannel.checkExchange.mockRejectedValueOnce(new Error());
      const quantRequest = { _id: 'job-id' } as any;
      await expect(service.createAndQueueQuant(quantRequest)).rejects.toThrow(
        RpcException,
      );
    });
  });

  describe('createAndQueueSequenceBatch', () => {
    it('should create and queue sequence batch', async () => {
      const quantRequest = { _id: 'job-id' } as any;
      const sequenceRequests = [{ _id: 'seq-1' }, { _id: 'seq-2' }];
      const sequenceJobIds = ['seq-1', 'seq-2'];

      mockSequenceExtractorService.extractSequenceRequests.mockReturnValue({
        sequenceRequests,
        sequenceJobIds,
      });

      const result = await service.createAndQueueSequenceBatch(quantRequest);

      expect(result).toEqual(sequenceJobIds);
      expect(minioService.storeInputData).toHaveBeenCalledTimes(3); // 1 parent + 2 sequences
      expect(mockChannel.publish).toHaveBeenCalledTimes(2);
    });
  });

  describe('createAndQueueAdaptiveSequenceBatch', () => {
    it('should create and queue adaptive sequence batch', async () => {
      const quantRequest = { _id: 'job-id' } as any;
      const sequenceRequests = [{ _id: 'seq-1' }, { _id: 'seq-2' }];
      const sequenceJobIds = ['seq-1', 'seq-2'];

      mockSequenceExtractorService.extractSequenceRequests.mockReturnValue({
        sequenceRequests,
        sequenceJobIds,
      });

      const result =
        await service.createAndQueueAdaptiveSequenceBatch(quantRequest);

      expect(result).toEqual(sequenceJobIds);
      expect(minioService.storeInputData).toHaveBeenCalledTimes(3); // 1 parent + 2 sequences
      expect(mockChannel.publish).toHaveBeenCalledTimes(2);
    });
  });

  describe('onApplicationShutdown', () => {
    it('should cleanup exchanges and close connections', async () => {
      await service.onApplicationShutdown();

      expect(mockChannel.deleteExchange).toHaveBeenCalledTimes(3);
      expect(mockChannel.deleteExchange).toHaveBeenCalledWith('quant');
      expect(mockChannel.deleteExchange).toHaveBeenCalledWith('dist');
      expect(mockChannel.deleteExchange).toHaveBeenCalledWith('adapt');
      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockChannelModel.close).toHaveBeenCalled();
    });

    it('should throw RpcException if cleanup fails', async () => {
      mockChannel.deleteExchange.mockRejectedValueOnce(
        new Error('Cleanup failed'),
      );

      await expect(service.onApplicationShutdown()).rejects.toThrow(
        RpcException,
      );
    });
  });
});
