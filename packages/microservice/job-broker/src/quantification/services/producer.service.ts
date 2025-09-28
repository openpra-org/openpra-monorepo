import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { ChannelModel, Channel } from "amqplib";
import typia from "typia";
import { v4 as uuidv4 } from "uuid";
import { NodeQuantRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { RpcException } from "@nestjs/microservices";
import { QueueService, RabbitMQChannelModelService, QueueConfig, QueueConfigFactory, MinioService } from "../../shared";
import { SequenceExtractorService } from "./sequence-extractor";

@Injectable()
export class ProducerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ProducerService.name);
  private readonly quantQueueConfig: QueueConfig;
  private readonly distributedSequencesQueueConfig: QueueConfig;
  private channelModel: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(
    private readonly queueService: QueueService,
    private readonly rabbitmqService: RabbitMQChannelModelService,
    private readonly queueConfigFactory: QueueConfigFactory,
    private readonly minioService: MinioService,
    private readonly sequenceExtractorService: SequenceExtractorService,
  ) {
    this.quantQueueConfig = this.queueConfigFactory.createQuantJobQueueConfig();
    this.distributedSequencesQueueConfig = this.queueConfigFactory.createDistributedSequencesJobQueueConfig();
  }

  async onApplicationBootstrap(): Promise<void> {
    this.logger.debug("Connecting to the broker");
    this.channelModel = await this.rabbitmqService.getChannelModel(QueueService.name);
    this.channel = await this.rabbitmqService.getChannel(this.channelModel, QueueService.name);
    await this.queueService.setupQueue(this.quantQueueConfig, this.channel);
    await this.queueService.setupQueue(this.distributedSequencesQueueConfig, this.channel);
    this.logger.debug("Initialized quant and distributed sequences queues and ready to send messages");
  }

  public async createAndQueueQuant(quantRequest: NodeQuantRequest): Promise<string> {
    const jobId = uuidv4();
    quantRequest._id = jobId;
    const inputId = await this.minioService.storeInputData(quantRequest);

    await this.minioService.createJobMetadata(jobId, inputId);

    const modelsData = ((): string => {
      try {
        this.logger.debug("Gets the request body from the Quantification controller");
        return typia.json.assertStringify<NodeQuantRequest>(quantRequest);
      } catch (err) {
        throw new RpcException(`Invalid schema: JobID <${jobId}>`);
      }
    })();

    try {
      this.logger.debug("Queueing the quantification job");
      await this.channel?.checkExchange(this.quantQueueConfig.exchange.name);
      this.channel?.publish(
        this.quantQueueConfig.exchange.name,
        this.quantQueueConfig.exchange.routingKey,
        Buffer.from(modelsData),
        {
          persistent: true,
        },
      );
    } catch (err) {
      throw new RpcException(`${this.quantQueueConfig.exchange.name} does not exist.`);
    }

    try {
      await this.minioService.updateJobMetadata(jobId, {
        status: "pending",
      });
    } catch (err) {
      throw new RpcException(`Failed to update <pending> status of: JobID ${jobId}`);
    }

    return jobId;
  }

  public async createAndQueueSequenceBatch(quantRequest: NodeQuantRequest): Promise<string[]> {
    const parentJobId = uuidv4();

    const { sequenceRequests, sequenceJobIds } = this.sequenceExtractorService.extractSequenceRequests(quantRequest, parentJobId);
    this.logger.debug(`Creating batch job ${parentJobId} with ${sequenceRequests.length} sequences`);

    const parentInputId = await this.minioService.storeInputData({ ...quantRequest, _id: parentJobId });
    await this.minioService.createJobMetadata(parentJobId, parentInputId);
    await this.minioService.updateJobMetadata(parentJobId, {
      status: "processing",
      childJobs: sequenceJobIds,
    });

    for (const sequenceRequest of sequenceRequests) {
      const modelsData = ((): string => {
        try {
          this.logger.debug(`Queueing sequence job ${sequenceRequest._id}`);
          return typia.json.assertStringify<NodeQuantRequest>(sequenceRequest);
        } catch (err) {
          throw new RpcException(`Invalid schema: JobID <${sequenceRequest._id}>`);
        }
      })();

      try {
        await this.channel?.checkExchange(this.distributedSequencesQueueConfig.exchange.name);
        this.channel?.publish(
          this.distributedSequencesQueueConfig.exchange.name,
          this.distributedSequencesQueueConfig.exchange.routingKey,
          Buffer.from(modelsData),
          {
            persistent: true,
          },
        );
      } catch (err) {
        this.logger.error(`Failed to queue sequence ${sequenceRequest._id}: ${err}`);
        throw new RpcException(`Failed to queue sequence batch for parent job ${parentJobId}`);
      }
    }

    this.logger.debug(`Successfully queued ${sequenceRequests.length} sequence jobs for parent ${parentJobId}`);
    return sequenceJobIds;
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.channel?.deleteExchange(this.quantQueueConfig.exchange.name);
      await this.channel?.deleteExchange(this.distributedSequencesQueueConfig.exchange.name);
      await this.channel?.close();
      await this.channelModel?.close();
    } catch (err) {
      throw new RpcException(`${ProducerService.name} failed to stop RabbitMQ services.`);
    }
  }
}