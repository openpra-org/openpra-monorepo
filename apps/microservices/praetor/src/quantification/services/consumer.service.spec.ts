import { Test, TestingModule } from '@nestjs/testing';
import { ConsumerService } from './consumer.service';
import { QueueService, RabbitMQChannelModelService, QueueConfigFactory, MinioService, } from '../../shared';
import { runQuantificationWithWorker } from '../workers/quantify-worker-runner';
import { RpcException } from '@nestjs/microservices';
vi.mock('typia', () => ({
    default: {
        json: {
            assertParse: vi.fn(),
        },
    },
}));
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
        rabbitmqService = module.get<RabbitMQChannelModelService>(RabbitMQChannelModelService);
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
            expect(minioService.updateJobMetadata).toHaveBeenCalledWith('job-id', expect.objectContaining({ status: 'running' }));
            expect(minioService.storeOutputData).toHaveBeenCalled();
            expect(mockChannel.ack).toHaveBeenCalledWith(msg);
        });
        it('should nack and update metadata on worker failure', async () => {
            const msg = { content: Buffer.from('{}') };
            const quantRequest = { _id: 'job-id' };
            const typiaMock = await import('typia');
            (typiaMock.default.json.assertParse as any).mockReturnValue(quantRequest);
            (runQuantificationWithWorker as any).mockRejectedValue(new Error('Worker failed'));
            await consumeCallback(msg);
            expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
            expect(minioService.updateJobMetadata).toHaveBeenCalledWith('job-id', expect.objectContaining({ status: 'failed' }));
        });
        it('should nack on parse error', async () => {
            const msg = { content: Buffer.from('invalid-json') };
            const typiaMock = await import('typia');
            (typiaMock.default.json.assertParse as any).mockImplementation(() => {
                throw new Error('Parse error');
            });
            await expect(consumeCallback(msg)).rejects.toThrow(RpcException);
            expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
        });
    });
});
