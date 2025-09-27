import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { ChannelModel, Channel } from "amqplib";
import typia from "typia";
import { v4 as uuidv4 } from "uuid";
import { NodeQuantRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { RpcException } from "@nestjs/microservices";
import { QueueService, RabbitMQChannelModelService, QueueConfig, QueueConfigFactory, MinioService } from "../../shared";

@Injectable()
export class ProducerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ProducerService.name);
  private readonly queueConfig: QueueConfig;
  private channelModel: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(
    private readonly queueService: QueueService,
    private readonly rabbitmqService: RabbitMQChannelModelService,
    private readonly queueConfigFactory: QueueConfigFactory,
    private readonly minioService: MinioService,
  ) {
    this.queueConfig = this.queueConfigFactory.createQuantJobQueueConfig();
  }

  async onApplicationBootstrap(): Promise<void> {
    this.logger.debug("Connecting to the broker");
    this.channelModel = await this.rabbitmqService.getChannelModel(QueueService.name);
    this.channel = await this.rabbitmqService.getChannel(this.channelModel, QueueService.name);
    await this.queueService.setupQueue(this.queueConfig, this.channel);
    this.logger.debug("Initialized and ready to send messages");
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
      await this.channel?.checkExchange(this.queueConfig.exchange.name);
      this.channel?.publish(
        this.queueConfig.exchange.name,
        this.queueConfig.exchange.routingKey,
        Buffer.from(modelsData),
        {
          persistent: true,
        },
      );
    } catch (err) {
      throw new RpcException(`${this.queueConfig.exchange.name} does not exist.`);
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

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.channel?.deleteExchange(this.queueConfig.exchange.name);
      await this.channel?.close();
      await this.channelModel?.close();
    } catch (err) {
      throw new RpcException(`${ProducerService.name} failed to stop RabbitMQ services.`);
    }
  }
}