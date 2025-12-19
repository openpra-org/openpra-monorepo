import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';

describe('QueueService', () => {
  let service: QueueService;

  const mockChannel = {
    assertExchange: vi.fn(),
    assertQueue: vi.fn(),
    bindQueue: vi.fn(),
    prefetch: vi.fn(),
  };

  const mockQueueConfig = {
    name: 'test-queue',
    durable: true,
    messageTtl: 1000,
    maxLength: 100,
    prefetch: 10,
    exchange: {
      name: 'test-exchange',
      type: 'topic',
      durable: true,
      bindingKey: 'key',
      routingKey: 'key',
    },
    deadLetter: {
      name: 'dlq',
      durable: true,
      exchange: {
        name: 'dlx',
        type: 'topic',
        durable: true,
        bindingKey: 'dlk',
        routingKey: 'dlk',
      },
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [QueueService],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setupQueue', () => {
    it('should setup queue and dead letter queue successfully', async () => {
      await service.setupQueue(mockQueueConfig as any, mockChannel as any);

      // Verify Dead Letter Setup
      expect(mockChannel.assertExchange).toHaveBeenCalledWith('dlx', 'topic', {
        durable: true,
      });
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('dlq', {
        durable: true,
      });
      expect(mockChannel.bindQueue).toHaveBeenCalledWith('dlq', 'dlx', 'dlk');

      // Verify Main Queue Setup
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'test-exchange',
        'topic',
        { durable: true },
      );
      expect(mockChannel.assertQueue).toHaveBeenCalledWith(
        'test-queue',
        expect.objectContaining({
          durable: true,
          messageTtl: 1000,
          deadLetterExchange: 'dlx',
          deadLetterRoutingKey: 'dlk',
          maxLength: 100,
        }),
      );
      expect(mockChannel.prefetch).toHaveBeenCalledWith(10);
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        'test-queue',
        'test-exchange',
        'key',
      );
    });

    it('should throw RpcException if exchange assertion fails', async () => {
      // First call is for DLX (succeeds), second call is for main exchange (fails)
      mockChannel.assertExchange.mockResolvedValueOnce(undefined);
      mockChannel.assertExchange.mockRejectedValueOnce(new Error('Failed'));

      await expect(
        service.setupQueue(mockQueueConfig as any, mockChannel as any),
      ).rejects.toThrow(
        `Failed to initialize ${mockQueueConfig.exchange.name}`,
      );
    });

    it('should throw RpcException if queue assertion fails', async () => {
      // First call is for DLQ (succeeds), second call is for main queue (fails)
      mockChannel.assertQueue.mockResolvedValueOnce(undefined);
      mockChannel.assertQueue.mockRejectedValueOnce(new Error('Failed'));

      await expect(
        service.setupQueue(mockQueueConfig as any, mockChannel as any),
      ).rejects.toThrow(`Failed to set up ${mockQueueConfig.name}`);
    });

    it('should throw RpcException if binding fails', async () => {
      // First call is for DLQ binding (succeeds), second call is for main binding (fails)
      mockChannel.bindQueue.mockResolvedValueOnce(undefined);
      mockChannel.bindQueue.mockRejectedValueOnce(new Error('Failed'));

      await expect(
        service.setupQueue(mockQueueConfig as any, mockChannel as any),
      ).rejects.toThrow(
        `Failed to bind ${mockQueueConfig.exchange.name} and ${mockQueueConfig.name} queue`,
      );
    });

    it('should not call prefetch if not provided', async () => {
      const configWithoutPrefetch = { ...mockQueueConfig, prefetch: undefined };

      await service.setupQueue(
        configWithoutPrefetch as any,
        mockChannel as any,
      );

      expect(mockChannel.prefetch).not.toHaveBeenCalled();
    });

    it('should throw RpcException if dead letter setup fails', async () => {
      // Make the dead letter exchange assertion fail
      mockChannel.assertExchange.mockRejectedValueOnce(new Error('DLX Failed'));

      await expect(
        service.setupQueue(mockQueueConfig as any, mockChannel as any),
      ).rejects.toThrow(`Failed to set up ${mockQueueConfig.deadLetter.name}`);
    });
  });
});
