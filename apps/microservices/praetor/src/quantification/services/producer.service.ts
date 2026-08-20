import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, } from '@nestjs/common';
import { ChannelModel, Channel } from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { NodeQuantRequest } from '../../common/types/quantify-request';
import { RpcException } from '@nestjs/microservices';
import { QueueService, RabbitMQChannelModelService, QueueConfig, QueueConfigFactory, MinioService, } from '../../shared';
@Injectable()
export class ProducerService implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(ProducerService.name);
    private readonly quantQueueConfig: QueueConfig;
    private channelModel: ChannelModel | null = null;
    private channel: Channel | null = null;
    constructor(private readonly queueService: QueueService, private readonly rabbitmqService: RabbitMQChannelModelService, private readonly queueConfigFactory: QueueConfigFactory, private readonly minioService: MinioService) {
        this.quantQueueConfig = this.queueConfigFactory.createQuantJobQueueConfig();
    }
    async onApplicationBootstrap(): Promise<void> {
        this.logger.debug('Connecting to the broker');
        this.channelModel = await this.rabbitmqService.getChannelModel(QueueService.name);
        this.channel = await this.rabbitmqService.getChannel(this.channelModel, QueueService.name);
        await this.queueService.setupQueue(this.quantQueueConfig, this.channel);
        this.logger.debug('Initialized quant queue and ready to send messages');
    }
    public async createAndQueueQuant(quantRequest: NodeQuantRequest): Promise<string> {
        const jobId = uuidv4();
        quantRequest._id = jobId;
        await this.minioService.storeInputData(quantRequest, jobId);
        const sentAt = Date.now();
        await this.minioService.createJobMetadata(jobId, { sentAt });
        const modelsData = JSON.stringify(quantRequest);
        try {
            this.logger.debug('Queueing the quantification job');
            await this.channel?.checkExchange(this.quantQueueConfig.exchange.name);
            this.channel?.publish(this.quantQueueConfig.exchange.name, this.quantQueueConfig.exchange.routingKey, Buffer.from(modelsData), {
                persistent: true,
            });
        }
        catch {
            throw new RpcException(`${this.quantQueueConfig.exchange.name} does not exist.`);
        }
        return jobId;
    }
    async onApplicationShutdown(): Promise<void> {
        try {
            await this.channel?.deleteExchange(this.quantQueueConfig.exchange.name);
            await this.channel?.close();
            await this.channelModel?.close();
        }
        catch {
            throw new RpcException(`${ProducerService.name} failed to stop RabbitMQ services.`);
        }
    }
}
