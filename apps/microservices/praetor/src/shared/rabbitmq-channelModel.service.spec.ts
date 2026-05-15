import { Test, TestingModule } from '@nestjs/testing';
import { RabbitMQChannelModelService } from './rabbitmq-channelModel.service';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import amqp from 'amqplib';
import type { ChannelModel } from 'amqplib';
vi.mock('amqplib', () => ({
    default: {
        connect: vi.fn(),
    },
}));
describe('RabbitMQChannelModelService', () => {
    let service: RabbitMQChannelModelService;
    const mockConfigService = {
        getOrThrow: vi.fn(),
        get: vi.fn(),
    };
    const mockChannelModel = {
        createChannel: vi.fn(),
    };
    beforeEach(async () => {
        vi.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RabbitMQChannelModelService,
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();
        service = module.get<RabbitMQChannelModelService>(RabbitMQChannelModelService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('getChannelModel', () => {
        it('should connect to RabbitMQ successfully', async () => {
            mockConfigService.getOrThrow.mockReturnValue('amqp://localhost');
            mockConfigService.get.mockReturnValue('60');
            vi.mocked(amqp.connect).mockResolvedValue(mockChannelModel as ChannelModel);
            const result = await service.getChannelModel('TestService');
            expect(result).toBe(mockChannelModel);
            expect(amqp.connect).toHaveBeenCalledWith('amqp://localhost', {
                heartbeat: 60,
            });
        });
        it('should use default heartbeat if invalid', async () => {
            mockConfigService.getOrThrow.mockReturnValue('amqp://localhost');
            mockConfigService.get.mockReturnValue('invalid');
            vi.mocked(amqp.connect).mockResolvedValue(mockChannelModel as ChannelModel);
            await service.getChannelModel('TestService');
            expect(amqp.connect).toHaveBeenCalledWith('amqp://localhost', {
                heartbeat: 120,
            });
        });
        it('should throw RpcException on connection failure', async () => {
            mockConfigService.getOrThrow.mockReturnValue('amqp://localhost');
            vi.mocked(amqp.connect).mockRejectedValue(new Error('Connection failed'));
            await expect(service.getChannelModel('TestService')).rejects.toThrow(RpcException);
        });
    });
    describe('getChannel', () => {
        it('should create channel successfully', async () => {
            const mockChannel = {};
            mockChannelModel.createChannel.mockResolvedValue(mockChannel);
            const result = await service.getChannel(mockChannelModel as ChannelModel, 'TestService');
            expect(result).toBe(mockChannel);
        });
        it('should throw RpcException on channel creation failure', async () => {
            mockChannelModel.createChannel.mockRejectedValue(new Error('Failed'));
            await expect(service.getChannel(mockChannelModel as ChannelModel, 'TestService')).rejects.toThrow(RpcException);
        });
    });
});
