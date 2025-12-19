import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { createReadStream, promises as fsPromises } from 'fs';
import { Readable } from 'stream';
import typia from 'typia';
import { NodeQuantRequest } from '../../common/types/quantify-request';
import { RpcException } from '@nestjs/microservices';
import {
  QueueService,
  QueueConfig,
  QueueConfigFactory,
  RabbitMQChannelModelService,
  MinioService,
} from '../../shared';
import { runQuantificationWithWorker } from '../workers/quantify-worker-runner';

@Injectable()
export class ConsumerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ConsumerService.name);
  private readonly quantQueueConfig: QueueConfig;
  private readonly distributedSequencesQueueConfig: QueueConfig;
  private readonly adaptiveSequencesQueueConfig: QueueConfig;
  private channelModel: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(
    private readonly queueService: QueueService,
    private readonly rabbitmqService: RabbitMQChannelModelService,
    private readonly queueConfigFactory: QueueConfigFactory,
    private readonly minioService: MinioService,
  ) {
    this.quantQueueConfig = this.queueConfigFactory.createQuantJobQueueConfig();
    this.distributedSequencesQueueConfig =
      this.queueConfigFactory.createDistributedSequencesJobQueueConfig();
    this.adaptiveSequencesQueueConfig =
      this.queueConfigFactory.createAdaptiveSequencesJobQueueConfig();
  }

  async onApplicationBootstrap(): Promise<void> {
    this.logger.debug('Connecting to the broker');
    this.channelModel = await this.rabbitmqService.getChannelModel(
      ConsumerService.name,
    );
    this.channel = await this.rabbitmqService.getChannel(
      this.channelModel,
      ConsumerService.name,
    );
    await this.queueService.setupQueue(this.quantQueueConfig, this.channel);
    await this.queueService.setupQueue(
      this.distributedSequencesQueueConfig,
      this.channel,
    );
    await this.queueService.setupQueue(
      this.adaptiveSequencesQueueConfig,
      this.channel,
    );
    this.logger.debug(
      'Initialized and consuming from quant, distributed sequences, and adaptive sequences queues',
    );
    await this.consumeQuantJobs();
    await this.consumeDistributedSequenceJobs();
    await this.consumeAdaptiveSequenceJobs();
  }

  private async consumeQuantJobs(): Promise<void> {
    try {
      await this.channel?.checkQueue(this.quantQueueConfig.name);
    } catch (err) {
      throw new RpcException(
        `Queue: ${this.quantQueueConfig.name} does not exist.`,
      );
    }

    await this.channel?.consume(
      this.quantQueueConfig.name,
      async (msg: ConsumeMessage | null) => {
        if (msg === null) {
          throw new RpcException(
            `${ConsumerService.name} consumed a null message.`,
          );
        }
        const modelsData = ((): NodeQuantRequest => {
          try {
            return typia.json.assertParse<NodeQuantRequest>(
              msg.content.toString(),
            );
          } catch (err) {
            this.channel?.nack(msg, false, false);
            throw new RpcException(
              `${ConsumerService.name} consumed invalid message.`,
            );
          }
        })();
        try {
          await this.handleRegularJob(modelsData);
        } catch (err: any) {
          this.channel?.nack(msg, false, false);
          const errorMessage = err?.message || String(err);
          await this.minioService.updateJobMetadata(String(modelsData._id), {
            status: 'failed',
            error: errorMessage,
          });
          return;
        }
        this.channel?.ack(msg);
      },
      { noAck: false },
    );
  }

  private async consumeDistributedSequenceJobs(): Promise<void> {
    // (Previous implementation kept as is - calling handleSequenceJob)
    try {
      await this.channel?.checkQueue(this.distributedSequencesQueueConfig.name);
    } catch (err) {
      throw new RpcException(
        `Queue: ${this.distributedSequencesQueueConfig.name} does not exist.`,
      );
    }

    await this.channel?.consume(
      this.distributedSequencesQueueConfig.name,
      async (msg: ConsumeMessage | null) => {
        if (msg === null)
          throw new RpcException(
            `Null message from ${this.distributedSequencesQueueConfig.name}`,
          );
        const modelsData = ((): NodeQuantRequest => {
          try {
            return typia.json.assertParse<NodeQuantRequest>(
              msg.content.toString(),
            );
          } catch (err) {
            this.channel?.nack(msg, false, false);
            throw new RpcException(
              `Invalid message from ${this.distributedSequencesQueueConfig.name}`,
            );
          }
        })();
        try {
          await this.handleSequenceJob(modelsData);
        } catch (err: any) {
          this.channel?.nack(msg, false, false);
          const errorMessage = err?.message || String(err);
          const parentJobId = this.extractParentJobId(String(modelsData._id));
          if (parentJobId) {
            await this.minioService.updateJobMetadata(parentJobId, {
              status: 'failed',
              error: `Sequence job ${modelsData._id} failed: ${errorMessage}`,
            });
          }
          return;
        }
        this.channel?.ack(msg);
      },
      { noAck: false },
    );
  }

  private async handleRegularJob(
    nodeQuantRequest: NodeQuantRequest,
  ): Promise<void> {
    const jobId = String(nodeQuantRequest._id);
    const receivedAt = Date.now();

    let idleTime: number | undefined;
    try {
      const metadata = await this.minioService.getJobMetadata(jobId);
      if (metadata.sentAt) idleTime = (receivedAt - metadata.sentAt) / 1000;
    } catch (err) {}

    this.logger.debug(`Running regular job: ${jobId}`);
    await this.minioService.updateJobMetadata(jobId, {
      status: 'running',
      receivedAt,
    });

    const executionStartTime = Date.now();
    const result = await this.performQuantification(nodeQuantRequest);
    const executionTime = (Date.now() - executionStartTime) / 1000;

    const outputId = await this.storeQuantificationResult(jobId, result);

    // Extract metrics from result
    let analysisSeconds: number | undefined;
    let totalSeconds: number | undefined;
    let probability: number | undefined;
    let products: number | undefined;

    const isFileReference = this.isFileResult(result);
    if (!isFileReference && result && typeof result === 'object') {
      const resultObj = result as Record<string, any>;
      analysisSeconds =
        resultObj.runtimeSummary?.analysisSeconds ||
        resultObj.results?.runtimeSummary?.analysisSeconds;
      totalSeconds =
        resultObj.runtimeSummary?.totalSeconds ||
        resultObj.results?.runtimeSummary?.totalSeconds ||
        analysisSeconds;
      if (resultObj.results?.sumOfProducts?.[0]) {
        probability = resultObj.results.sumOfProducts[0].probability;
        products = resultObj.results.sumOfProducts[0].products;
      } else if (resultObj.results?.initiatingEvents?.[0]?.sequences?.[0]) {
        const seq = resultObj.results.initiatingEvents[0].sequences[0];
        probability = seq.probability;
        products = seq.products;
      }
    }

    await this.minioService.updateJobMetadata(jobId, {
      status: 'completed',
      outputId: outputId,
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

  private async handleSequenceJob(
    nodeQuantRequest: NodeQuantRequest,
  ): Promise<void> {
    const sequenceJobId = String(nodeQuantRequest._id);
    const parentJobId = this.extractParentJobId(sequenceJobId);

    if (!parentJobId) {
      throw new Error(`Invalid sequence job ID format: ${sequenceJobId}`);
    }

    this.logger.debug(
      `Processing sequence job ${sequenceJobId} for parent ${parentJobId}`,
    );

    // Store sequence job input and create proper metadata
    const inputId = await this.minioService.storeInputData(nodeQuantRequest);
    await this.minioService.createJobMetadata(sequenceJobId, inputId);

    const receivedAt = Date.now();
    let idleTime: number | undefined;
    try {
      const metadata = await this.minioService.getJobMetadata(sequenceJobId);
      if (metadata.sentAt) idleTime = (receivedAt - metadata.sentAt) / 1000;
    } catch (err) {}

    // Update sequence job status to running
    await this.minioService.updateJobMetadata(sequenceJobId, {
      status: 'running',
      receivedAt,
    });

    // Perform quantification on sequence
    const executionStartTime = Date.now();
    const result = await this.performQuantification(nodeQuantRequest);
    const executionTime = (Date.now() - executionStartTime) / 1000;

    // Store sequence result in its own metadata
    const outputId = await this.storeQuantificationResult(
      sequenceJobId,
      result,
    );

    // Extract metrics from result
    let probability: number | undefined;
    let products: number | undefined;
    const isFileReference = this.isFileResult(result);
    if (!isFileReference && result && typeof result === 'object') {
      const resultObj = result as Record<string, any>;
      if (resultObj.results?.sumOfProducts?.[0]) {
        probability = resultObj.results.sumOfProducts[0].probability;
        products = resultObj.results.sumOfProducts[0].products;
      } else if (resultObj.results?.initiatingEvents?.[0]?.sequences?.[0]) {
        probability =
          resultObj.results.initiatingEvents[0].sequences[0].probability;
        products = resultObj.results.initiatingEvents[0].sequences[0].products;
      }
    }

    await this.minioService.updateJobMetadata(sequenceJobId, {
      status: 'completed',
      outputId: outputId,
      stats: {
        idleTime,
        executionTime,
        startedAt: executionStartTime,
        endedAt: Date.now(),
        probability,
        products,
      },
    });

    // Mark this sequence as completed in parent
    await this.markSequenceCompleted(parentJobId, sequenceJobId);

    // Check if all sequences are complete
    const allCompleted = await this.checkAllSequencesCompleted(parentJobId);

    if (allCompleted) {
      this.logger.debug(`All sequences completed for parent ${parentJobId}`);
      await this.minioService.updateJobMetadata(parentJobId, {
        status: 'completed',
      });
    } else {
      await this.minioService.updateJobMetadata(parentJobId, {
        status: 'partial',
      });
    }
  }

  private async consumeAdaptiveSequenceJobs(): Promise<void> {
    try {
      await this.channel?.checkQueue(this.adaptiveSequencesQueueConfig.name);
    } catch (err) {
      throw new RpcException(
        `Queue: ${this.adaptiveSequencesQueueConfig.name} does not exist.`,
      );
    }

    await this.channel?.consume(
      this.adaptiveSequencesQueueConfig.name,
      async (msg: ConsumeMessage | null) => {
        if (msg === null)
          throw new RpcException(
            `Null msg from ${this.adaptiveSequencesQueueConfig.name}`,
          );

        const nodeQuantRequest = ((): NodeQuantRequest => {
          try {
            return typia.json.assertParse<NodeQuantRequest>(
              msg.content.toString(),
            );
          } catch (err) {
            this.logger.error('Failed to parse adaptive message');
            throw new RpcException('Parse failure');
          }
        })();

        try {
          await this.handleAdaptiveSequenceJob(nodeQuantRequest);
        } catch (err: any) {
          this.channel?.nack(msg, false, false);
          const errorMessage = err?.message || String(err);
          this.logger.error(
            `Adaptive Job ${String(
              nodeQuantRequest._id,
            )} failed: ${errorMessage}`,
          );
          await this.minioService.updateJobMetadata(
            String(nodeQuantRequest._id),
            {
              status: 'failed',
              error: errorMessage,
            },
          );
          return;
        }

        this.channel?.ack(msg);
        this.logger.debug(
          `Acknowledged adaptive job: ${String(nodeQuantRequest._id)}`,
        );
      },
      { noAck: false },
    );
  }

  private async handleAdaptiveSequenceJob(
    nodeQuantRequest: NodeQuantRequest,
  ): Promise<void> {
    const sequenceJobId = String(nodeQuantRequest._id);
    const parentJobId = this.extractParentJobId(sequenceJobId);
    if (!parentJobId) {
      throw new Error(`Invalid sequence job ID format: ${sequenceJobId}`);
    }

    const receivedAt = Date.now();
    this.logger.debug(`[Adaptive] Processing ${sequenceJobId}`);

    let idleTime: number | undefined;
    try {
      const metadata = await this.minioService.getJobMetadata(sequenceJobId);
      if (metadata.sentAt) {
        idleTime = (receivedAt - metadata.sentAt) / 1000;
      }
    } catch (err) {
      this.logger.debug(
        `Could not calculate idle time for adaptive sequence job ${sequenceJobId}`,
      );
    }

    await this.minioService.updateJobMetadata(sequenceJobId, {
      status: 'running',
      receivedAt,
    });

    const executionStartTime = Date.now();
    const report = await this.performQuantification(nodeQuantRequest);
    const executionTime = (Date.now() - executionStartTime) / 1000;

    // Store sequence result (cut sets and probabilities)
    const outputId = await this.storeQuantificationResult(
      sequenceJobId,
      report,
    );

    // Extract metrics from result
    const metrics = this.extractAdaptiveMetrics(report);
    let analysisSeconds: number | undefined;
    let totalSeconds: number | undefined;
    if (report && typeof report === 'object' && !this.isFileResult(report)) {
      const runtimeSummary =
        (report as any).runtimeSummary ??
        (report as any).results?.runtimeSummary;
      if (runtimeSummary) {
        analysisSeconds = runtimeSummary.analysisSeconds ?? undefined;
        totalSeconds =
          runtimeSummary.totalSeconds ??
          runtimeSummary.analysisSeconds ??
          undefined;
      }
    }

    const stats = {
      idleTime,
      executionTime,
      startedAt: executionStartTime,
      endedAt: Date.now(),
      analysisSeconds,
      totalSeconds,
      originalProducts: metrics.originalProducts,
      products: metrics.products,
      exactProbability: metrics.exactProbability,
      approximateProbability: metrics.approximateProbability,
      relativeError: metrics.relativeError,
    };

    await this.minioService.updateJobMetadata(sequenceJobId, {
      status: 'completed',
      outputId: outputId,
      stats,
    });

    await this.markSequenceCompleted(parentJobId, sequenceJobId);
    const allCompleted = await this.checkAllSequencesCompleted(parentJobId);
    await this.minioService.updateJobMetadata(parentJobId, {
      status: allCompleted ? 'completed' : 'partial',
    });
  }

  private extractAdaptiveMetrics(report: any): {
    originalProducts?: number;
    products?: number;
    exactProbability?: number;
    approximateProbability?: number;
    relativeError?: number;
  } {
    if (!report || typeof report !== 'object' || this.isFileResult(report)) {
      return {};
    }

    const results = (report as Record<string, any>).results ?? {};
    const sumOfProducts =
      Array.isArray(results.sumOfProducts) && results.sumOfProducts.length > 0
        ? results.sumOfProducts[0]
        : undefined;

    const sequence =
      Array.isArray(results.initiatingEvents) &&
      results.initiatingEvents[0]?.sequences
        ? results.initiatingEvents[0].sequences[0]
        : undefined;

    const cutSets = sequence?.cutSets;

    // Original products count
    const rawOriginalProducts =
      sumOfProducts?.originalProducts ?? cutSets?.originalProducts;
    const originalProducts =
      typeof rawOriginalProducts === 'number' ? rawOriginalProducts : undefined;

    // Final products count
    const rawProducts =
      sumOfProducts?.products ?? cutSets?.products ?? sequence?.products;
    const products = typeof rawProducts === 'number' ? rawProducts : undefined;

    // Exact probability (from BDD)
    const rawExact =
      sumOfProducts?.exactProbability ??
      sumOfProducts?.adaptiveTarget ??
      sumOfProducts?.['exact-probability'] ??
      cutSets?.exactProbability ??
      cutSets?.adaptiveTarget ??
      sequence?.exactProbability;
    const exactProbability =
      typeof rawExact === 'number' ? rawExact : undefined;

    // Approximate probability (from truncated analysis)
    const rawApprox =
      sumOfProducts?.approximateProbability ??
      sumOfProducts?.probability ??
      cutSets?.approximateProbability ??
      cutSets?.probability ??
      sequence?.approximateProbability ??
      sequence?.probability ??
      sequence?.value;
    const approximateProbability =
      typeof rawApprox === 'number' ? rawApprox : undefined;

    // Relative error
    const rawRelError =
      sumOfProducts?.relativeError ??
      cutSets?.relativeError ??
      sequence?.relativeError;
    const relativeError =
      typeof rawRelError === 'number' ? rawRelError : undefined;

    return {
      originalProducts,
      products,
      exactProbability,
      approximateProbability,
      relativeError,
    };
  }

  private extractParentJobId(sequenceJobId: string): string | null {
    const parts = sequenceJobId.split('-');
    if (parts.length === 6) return parts.slice(0, 5).join('-');
    return null;
  }

  private async markSequenceCompleted(
    parentJobId: string,
    sequenceJobId: string,
  ): Promise<void> {
    await this.minioService.markSequenceCompleted(parentJobId, sequenceJobId);
  }

  private async checkAllSequencesCompleted(
    parentJobId: string,
  ): Promise<boolean> {
    const parentMetadata = await this.minioService.getJobMetadata(parentJobId);
    if (!parentMetadata.childJobs || parentMetadata.childJobs.length === 0)
      return false;
    const completedCount =
      await this.minioService.getCompletedSequenceCount(parentJobId);
    return completedCount === parentMetadata.childJobs.length;
  }

  public async performQuantification(
    nodeQuantRequest: NodeQuantRequest,
  ): Promise<any> {
    const { _id, ...quantRequest } = nodeQuantRequest;
    try {
      this.logger.debug(`${String(_id)} running scram-node`);
      const report = await runQuantificationWithWorker(quantRequest);
      return report;
    } catch (error: any) {
      this.logger.error(
        `Quantification failed for ${String(_id)}: ${error?.message}`,
      );
      throw new Error(`SCRAM quantification failed: ${error?.message}`);
    }
  }

  private isFileResult(result: any): result is {
    type: 'file';
    path: string;
    size?: number | bigint;
    format?: string;
  } {
    return Boolean(
      result &&
        typeof result === 'object' &&
        (result as Record<string, unknown>).type === 'file' &&
        typeof (result as Record<string, unknown>).path === 'string',
    );
  }

  private async storeQuantificationResult(
    jobId: string,
    result: any,
  ): Promise<string> {
    if (this.isFileResult(result)) {
      const reportPath = result.path;
      try {
        const sizeLabel =
          typeof result.size === 'bigint'
            ? result.size.toString()
            : (result.size ?? 'unknown');
        this.logger.debug(
          `Uploading streamed report for job ${jobId} from ${reportPath} (size=${sizeLabel} bytes)`,
        );
        const stream = createReadStream(reportPath);
        const outputId = await this.minioService.storeOutputData(stream, jobId);
        try {
          await fsPromises.unlink(reportPath);
        } catch (unlinkErr: any) {
          this.logger.warn(
            `Failed to delete temporary report ${reportPath}: ${
              unlinkErr?.message || unlinkErr
            }`,
          );
        }
        return outputId;
      } catch (streamErr) {
        this.logger.error(
          `Unable to stream report file ${reportPath} for job ${jobId}: ${String(
            streamErr,
          )}`,
        );
        throw streamErr;
      }
    }

    const payload = JSON.stringify(result ?? {});
    const outputStream = Readable.from([payload]);
    return this.minioService.storeOutputData(outputStream, jobId);
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.channel?.deleteQueue(this.quantQueueConfig.name);
      await this.channel?.deleteQueue(
        this.distributedSequencesQueueConfig.name,
      );
      await this.channel?.deleteQueue(this.adaptiveSequencesQueueConfig.name);
      await this.channel?.close();
      await this.channelModel?.close();
    } catch (err) {
      throw new RpcException(
        `${ConsumerService.name} failed to stop RabbitMQ services.`,
      );
    }
  }
}
