import { Test, TestingModule } from '@nestjs/testing';
import { QueueConfigFactory } from './queue-config.factory';
import { ConfigService } from '@nestjs/config';

describe('QueueConfigFactory', () => {
  let factory: QueueConfigFactory;

  const mockConfigService = {
    getOrThrow: vi.fn((key: string) => {
      if (key.includes('DURABLE')) return true;
      if (
        key.includes('TTL') ||
        key.includes('LENGTH') ||
        key.includes('PREFETCH')
      )
        return 100;
      return key; // Return the key itself as the value for strings
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueConfigFactory,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    factory = module.get<QueueConfigFactory>(QueueConfigFactory);
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  describe('createQuantJobQueueConfig', () => {
    it('should return correct config', () => {
      const config = factory.createQuantJobQueueConfig();
      expect(config).toBeDefined();
      expect(config.name).toContain('QUANT_JOB_QUEUE');
      expect(config.durable).toBe(true);
      expect(config.messageTtl).toBe(100);
      expect(config.deadLetter).toBeDefined();
    });
  });

  describe('createDistributedSequencesJobQueueConfig', () => {
    it('should return correct config', () => {
      const config = factory.createDistributedSequencesJobQueueConfig();
      expect(config).toBeDefined();
      expect(config.name).toContain('DISTRIBUTED_SEQUENCES_JOB_QUEUE');
      expect(config.durable).toBe(true);
    });
  });

  describe('createAdaptiveSequencesJobQueueConfig', () => {
    it('should return correct config', () => {
      const config = factory.createAdaptiveSequencesJobQueueConfig();
      expect(config).toBeDefined();
      expect(config.name).toContain('ADAPTIVE_SEQUENCES_JOB_QUEUE');
      expect(config.durable).toBe(true);
    });
  });
});
