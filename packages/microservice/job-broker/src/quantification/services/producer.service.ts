import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { Connection, Channel } from "amqplib";
import typia from "typia";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { RpcException } from "@nestjs/microservices";
import { QueueService, RabbitMQConnectionService, QueueConfig, QueueConfigFactory } from "../../shared";
import { QuantificationJobReport } from "../../middleware/schemas/quantification-job.schema";

@Injectable()
export class ProducerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ProducerService.name);
  private readonly queueConfig: QueueConfig;
  private connection: Connection | null = null;
  private channel: Channel | null = null;

  constructor(
    @InjectModel(QuantificationJobReport.name) private readonly quantificationJobModel: Model<QuantificationJobReport>,
    private readonly queueService: QueueService,
    private readonly rabbitmqService: RabbitMQConnectionService,
    private readonly queueConfigFactory: QueueConfigFactory,
  ) {
    this.queueConfig = this.queueConfigFactory.createQuantJobQueueConfig();
  }

  /**
   * Initialize the queue when the application bootstraps
   */
  async onApplicationBootstrap(): Promise<void> {
    this.logger.debug("Connecting to the broker");
    this.connection = await this.rabbitmqService.getConnection(QueueService.name);
    this.channel = await this.rabbitmqService.getChannel(this.connection, QueueService.name);
    await this.queueService.setupQueue(this.queueConfig, this.channel);
    this.logger.debug("Initialized and ready to send messages");
  }

  /**
   * Creates and queues a quantification job
   *
   * @param quantRequest - Request data for the quantification job
   */
  public async createAndQueueQuant(quantRequest: QuantifyRequest): Promise<void> {
    const modelsData = ((): string => {
      try {
        this.logger.debug("Gets the request body from the Quantification controller");
        return typia.json.assertStringify<QuantifyRequest>(quantRequest);
      } catch (err) {
        throw new RpcException(`Invalid schema: JobID <${String(quantRequest._id)}>`);
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
      await this.quantificationJobModel.findByIdAndUpdate(quantRequest._id, {
        $set: { status: "pending" },
      });
    } catch (err) {
      throw new RpcException(`Failed to update <pending> status of: JobID ${String(quantRequest._id)}`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.channel?.deleteExchange(this.queueConfig.exchange.name);
      await this.channel?.close();
      await this.connection?.close();
    } catch (err) {
      throw new RpcException(`${ProducerService.name} failed to stop RabbitMQ services.`);
    }
  }
}
