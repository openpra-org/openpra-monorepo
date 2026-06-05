import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, } from '@nestjs/common';
import { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { createReadStream, promises as fsPromises } from 'fs';
import { Readable } from 'stream';
import { NodeQuantRequest } from '../../common/types/quantify-request';
import { RpcException } from '@nestjs/microservices';
import { QueueService, QueueConfig, QueueConfigFactory, RabbitMQChannelModelService, MinioService, } from '../../shared';
import { runQuantificationWithWorker } from '../workers/quantify-worker-runner';
import type { QuantifyModelResult, QuantifyModelFileResult } from '../../common/types/quantify-result';
@Injectable()
export class ConsumerService implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(ConsumerService.name);
    private readonly quantQueueConfig: QueueConfig;
    private channelModel: ChannelModel | null = null;
    private channel: Channel | null = null;
    constructor(private readonly queueService: QueueService, private readonly rabbitmqService: RabbitMQChannelModelService, private readonly queueConfigFactory: QueueConfigFactory, private readonly minioService: MinioService) {
        this.quantQueueConfig = this.queueConfigFactory.createQuantJobQueueConfig();
    }
    async onApplicationBootstrap(): Promise<void> {
        this.logger.debug('Connecting to the broker');
        this.channelModel = await this.rabbitmqService.getChannelModel(ConsumerService.name);
        this.channel = await this.rabbitmqService.getChannel(this.channelModel, ConsumerService.name);
        await this.queueService.setupQueue(this.quantQueueConfig, this.channel);
        this.logger.debug('Initialized and consuming from quant queue');
        await this.consumeQuantJobs();
    }
    private async consumeQuantJobs(): Promise<void> {
        try {
            await this.channel?.checkQueue(this.quantQueueConfig.name);
        }
        catch {
            throw new RpcException(`Queue: ${this.quantQueueConfig.name} does not exist.`);
        }
        await this.channel?.consume(this.quantQueueConfig.name, async (msg: ConsumeMessage | null) => {
            if (msg === null) {
                throw new RpcException(`${ConsumerService.name} consumed a null message.`);
            }
            const modelsData = ((): NodeQuantRequest => {
                try {
                    return JSON.parse(msg.content.toString()) as NodeQuantRequest;
                }
                catch {
                    this.channel?.nack(msg, false, false);
                    throw new RpcException(`${ConsumerService.name} consumed invalid message.`);
                }
            })();
            try {
                await this.handleRegularJob(modelsData);
            }
            catch (err) {
                this.channel?.nack(msg, false, false);
                const errorMessage = err instanceof Error ? err.message : String(err);
                await this.minioService.updateJobMetadata(String(modelsData._id), {
                    status: 'failed',
                    error: errorMessage,
                });
                return;
            }
            this.channel?.ack(msg);
        }, { noAck: false });
    }
    private async handleRegularJob(nodeQuantRequest: NodeQuantRequest): Promise<void> {
        const jobId = String(nodeQuantRequest._id);
        const receivedAt = Date.now();
        let idleTime: number | undefined;
        try {
            const metadata = await this.minioService.getJobMetadata(jobId);
            if (metadata.sentAt) idleTime = (receivedAt - metadata.sentAt) / 1000;
        }
        catch { }
        this.logger.debug(`Running regular job: ${jobId}`);
        await this.minioService.updateJobMetadata(jobId, { status: 'running', receivedAt });
        const executionStartTime = Date.now();
        const result = await this.performQuantification(nodeQuantRequest);
        const executionTime = (Date.now() - executionStartTime) / 1000;
        await this.storeQuantificationResult(jobId, result);
        let analysisSeconds: number | undefined;
        let totalSeconds: number | undefined;
        let probability: number | undefined;
        let products: number | undefined;
        if (!this.isFileResult(result)) {
            analysisSeconds = result.runtimeSummary?.analysisSeconds ?? result.results.runtimeSummary?.analysisSeconds;
            totalSeconds = result.runtimeSummary?.totalSeconds ?? result.results.runtimeSummary?.totalSeconds ?? analysisSeconds;
            const firstSop = result.results.sumOfProducts[0];
            if (firstSop) {
                probability = firstSop.probability;
                products = firstSop.products;
            }
            else {
                const firstSeq = result.results.initiatingEvents[0]?.sequences?.[0];
                if (firstSeq) {
                    probability = firstSeq.probability;
                    products = firstSeq.products;
                }
            }
        }
        await this.minioService.updateJobMetadata(jobId, {
            status: 'completed',
            stats: {
                idleTime,
                executionTime,
                startedAt: executionStartTime,
                endedAt: Date.now(),
                analysisSeconds,
                totalSeconds,
                probability,
                products,
            },
        });
        this.logger.debug(`Completed regular job: ${jobId}`);
    }
    public async performQuantification(nodeQuantRequest: NodeQuantRequest): Promise<QuantifyModelResult> {
        const { _id, ...quantRequest } = nodeQuantRequest;
        try {
            this.logger.debug(`${String(_id)} running scram-node`);
            return await runQuantificationWithWorker(quantRequest);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Quantification failed for ${String(_id)}: ${message}`);
            throw new Error(`SCRAM quantification failed: ${message}`);
        }
    }
    private isFileResult(result: QuantifyModelResult): result is QuantifyModelFileResult {
        return (
            typeof result === 'object' &&
            result !== null &&
            'type' in result &&
            (result as QuantifyModelFileResult).type === 'file' &&
            typeof (result as QuantifyModelFileResult).path === 'string'
        );
    }
    private async storeQuantificationResult(jobId: string, result: QuantifyModelResult): Promise<void> {
        if (this.isFileResult(result)) {
            const reportPath = result.path;
            try {
                const sizeLabel = typeof result.size === 'bigint'
                    ? result.size.toString()
                    : String(result.size ?? 'unknown');
                this.logger.debug(`Uploading streamed report for job ${jobId} from ${reportPath} (size=${sizeLabel} bytes)`);
                const stream = createReadStream(reportPath);
                await this.minioService.storeOutputData(stream, jobId);
                try {
                    await fsPromises.unlink(reportPath);
                }
                catch (unlinkErr) {
                    const unlinkMessage = unlinkErr instanceof Error ? unlinkErr.message : String(unlinkErr);
                    this.logger.warn(`Failed to delete temporary report ${reportPath}: ${unlinkMessage}`);
                }
                return;
            }
            catch (streamErr) {
                this.logger.error(`Unable to stream report file ${reportPath} for job ${jobId}: ${String(streamErr)}`);
                throw streamErr;
            }
        }
        const payload = JSON.stringify(result);
        const outputStream = Readable.from([payload]);
        await this.minioService.storeOutputData(outputStream, jobId);
    }
    async onApplicationShutdown(): Promise<void> {
        try {
            await this.channel?.deleteQueue(this.quantQueueConfig.name);
            await this.channel?.close();
            await this.channelModel?.close();
        }
        catch {
            throw new RpcException(`${ConsumerService.name} failed to stop RabbitMQ services.`);
        }
    }
}
