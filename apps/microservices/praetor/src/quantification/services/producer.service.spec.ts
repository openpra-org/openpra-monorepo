import { Test, TestingModule } from '@nestjs/testing';
import { ProducerService } from './producer.service';
import { QueueService, RabbitMQChannelModelService, QueueConfigFactory, MinioService, } from '../../shared';
import { RpcException } from '@nestjs/microservices';
import type { NodeQuantRequest } from '../../common/types/quantify-request';
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
    };
    const mockMinioService = {
        storeInputData: vi.fn().mockResolvedValue('input-id'),
        createJobMetadata: vi.fn().mockResolvedValue(undefined),
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
            ],
        }).compile();
        service = module.get<ProducerService>(ProducerService);
        minioService = module.get<MinioService>(MinioService);
        await service.onApplicationBootstrap();
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('createAndQueueQuant', () => {
        it('should create and queue quant job', async () => {
            const quantRequest: NodeQuantRequest = { _id: 'job-id' };
            const jobId = await service.createAndQueueQuant(quantRequest);
            expect(jobId).toBeDefined();
            expect(minioService.storeInputData).toHaveBeenCalled();
            expect(minioService.createJobMetadata).toHaveBeenCalled();
            expect(mockChannel.publish).toHaveBeenCalled();
        });
        it('should throw RpcException if exchange check fails', async () => {
            mockChannel.checkExchange.mockRejectedValueOnce(new Error());
            const quantRequest: NodeQuantRequest = { _id: 'job-id' };
            await expect(service.createAndQueueQuant(quantRequest)).rejects.toThrow(RpcException);
        });
    });
});
