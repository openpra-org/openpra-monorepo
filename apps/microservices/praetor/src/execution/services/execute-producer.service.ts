import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Channel, ChannelModel } from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { RpcException } from '@nestjs/microservices';
import { QueueService, RabbitMQChannelModelService, QueueConfig, QueueConfigFactory, MinioService } from '../../shared';
import { ExecuteRequest, ExecuteJob, ExecuteSolver } from '../../common/types/execute-request';

@Injectable()
export class ExecuteProducerService implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(ExecuteProducerService.name);
    private readonly executeQueueConfig: QueueConfig;
    private channelModel: ChannelModel | null = null;
    private channel: Channel | null = null;
    constructor(
        private readonly queueService: QueueService,
        private readonly rabbitmqService: RabbitMQChannelModelService,
        private readonly queueConfigFactory: QueueConfigFactory,
        private readonly minioService: MinioService,
    ) {
        this.executeQueueConfig = this.queueConfigFactory.createExecuteTaskQueueConfig();
    }
    async onApplicationBootstrap(): Promise<void> {
        this.logger.debug('Connecting to the broker');
        this.channelModel = await this.rabbitmqService.getChannelModel(ExecuteProducerService.name);
        this.channel = await this.rabbitmqService.getChannel(this.channelModel, ExecuteProducerService.name);
        await this.queueService.setupQueue(this.executeQueueConfig, this.channel);
        this.logger.debug('Initialized execute task queue and ready to send messages');
    }
    public async createAndQueueExecute(solver: ExecuteSolver, request: ExecuteRequest): Promise<string> {
        const jobId = uuidv4();
        const job: ExecuteJob = { _id: jobId, solver, argv: request.argv, input: request.input };
        await this.minioService.storeInputData(JSON.stringify({ solver, argv: request.argv, input: request.input }), jobId);
        await this.minioService.createJobMetadata(jobId, { sentAt: Date.now() });
        try {
            await this.channel?.checkExchange(this.executeQueueConfig.exchange.name);
            this.channel?.publish(
                this.executeQueueConfig.exchange.name,
                this.executeQueueConfig.exchange.routingKey,
                Buffer.from(JSON.stringify(job)),
                { persistent: true },
            );
        }
        catch {
            throw new RpcException(`${this.executeQueueConfig.exchange.name} does not exist.`);
        }
        return jobId;
    }
    async onApplicationShutdown(): Promise<void> {
        try {
            await this.channel?.deleteExchange(this.executeQueueConfig.exchange.name);
            await this.channel?.close();
            await this.channelModel?.close();
        }
        catch {
            throw new RpcException(`${ExecuteProducerService.name} failed to stop RabbitMQ services.`);
        }
    }
}
