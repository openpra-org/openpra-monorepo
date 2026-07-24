import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { RpcException } from '@nestjs/microservices';
import { QueueService, QueueConfig, QueueConfigFactory, RabbitMQChannelModelService, MinioService } from '../../shared';
import { ExecuteJob } from '../../common/types/execute-request';
import { ExecuteResult } from '../../common/types/execute-result';
import { runSolverProcess } from '../workers/solver-process.runner';

const DEFAULT_TIMEOUT_MS = 300000;

@Injectable()
export class ExecuteConsumerService implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(ExecuteConsumerService.name);
    private readonly executeQueueConfig: QueueConfig;
    private channelModel: ChannelModel | null = null;
    private channel: Channel | null = null;
    private readonly timeoutMs: number;
    constructor(
        private readonly queueService: QueueService,
        private readonly rabbitmqService: RabbitMQChannelModelService,
        private readonly queueConfigFactory: QueueConfigFactory,
        private readonly minioService: MinioService,
    ) {
        this.executeQueueConfig = this.queueConfigFactory.createExecuteTaskQueueConfig();
        const configured = Number(process.env['PRAETOR_EXEC_TIMEOUT_MS']);
        this.timeoutMs = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
    }
    async onApplicationBootstrap(): Promise<void> {
        this.logger.debug('Connecting to the broker');
        this.channelModel = await this.rabbitmqService.getChannelModel(ExecuteConsumerService.name);
        this.channel = await this.rabbitmqService.getChannel(this.channelModel, ExecuteConsumerService.name);
        await this.queueService.setupQueue(this.executeQueueConfig, this.channel);
        this.logger.debug('Initialized and consuming from execute task queue');
        await this.consumeExecuteJobs();
    }
    private async consumeExecuteJobs(): Promise<void> {
        try {
            await this.channel?.checkQueue(this.executeQueueConfig.name);
        }
        catch {
            throw new RpcException(`Queue: ${this.executeQueueConfig.name} does not exist.`);
        }
        await this.channel?.consume(this.executeQueueConfig.name, async (msg: ConsumeMessage | null) => {
            if (msg === null) {
                throw new RpcException(`${ExecuteConsumerService.name} consumed a null message.`);
            }
            const job = ((): ExecuteJob => {
                try {
                    return JSON.parse(msg.content.toString()) as ExecuteJob;
                }
                catch {
                    this.channel?.nack(msg, false, false);
                    throw new RpcException(`${ExecuteConsumerService.name} consumed invalid message.`);
                }
            })();
            try {
                await this.handleExecuteJob(job);
            }
            catch (err) {
                this.channel?.nack(msg, false, false);
                const errorMessage = err instanceof Error ? err.message : String(err);
                await this.minioService.updateJobMetadata(job._id, { status: 'failed', error: errorMessage });
                return;
            }
            this.channel?.ack(msg);
        }, { noAck: false });
    }
    private async handleExecuteJob(job: ExecuteJob): Promise<void> {
        const receivedAt = Date.now();
        let idleTime: number | undefined;
        try {
            const metadata = await this.minioService.getJobMetadata(job._id);
            if (metadata.sentAt) idleTime = (receivedAt - metadata.sentAt) / 1000;
        }
        catch { }
        this.logger.debug(`Running execute job: ${job._id} (${job.solver})`);
        await this.minioService.updateJobMetadata(job._id, { status: 'running', receivedAt });
        const startedAt = Date.now();
        const processResult = await runSolverProcess({
            solver: job.solver,
            argv: job.argv,
            input: job.input,
            timeoutMs: this.timeoutMs,
        });
        const executionTime = (Date.now() - startedAt) / 1000;
        const result: ExecuteResult = {
            _id: job._id,
            solver: job.solver,
            exit_code: processResult.exitCode,
            stdout: processResult.stdout,
            stderr: processResult.stderr,
            output: processResult.output,
            outputName: processResult.outputName,
            durationMs: processResult.durationMs,
            timedOut: processResult.timedOut,
        };
        await this.minioService.storeOutputData(JSON.stringify(result), job._id);
        await this.minioService.updateJobMetadata(job._id, {
            status: 'completed',
            stats: {
                idleTime,
                executionTime,
                startedAt,
                endedAt: Date.now(),
            },
        });
        this.logger.debug(`Completed execute job: ${job._id} (exit ${processResult.exitCode})`);
    }
    async onApplicationShutdown(): Promise<void> {
        try {
            await this.channel?.deleteQueue(this.executeQueueConfig.name);
            await this.channel?.close();
            await this.channelModel?.close();
        }
        catch {
            throw new RpcException(`${ExecuteConsumerService.name} failed to stop RabbitMQ services.`);
        }
    }
}
