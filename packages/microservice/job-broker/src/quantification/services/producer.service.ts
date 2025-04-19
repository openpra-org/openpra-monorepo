import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Connection, Channel } from "amqplib";
import typia, { TypeGuardError } from "typia";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { QueueService, RabbitMQConnectionService, QueueConfig, QueueConfigFactory } from "../../shared";
import { QuantificationJobReport } from "../../middleware/schemas/quantification-job.schema";

@Injectable()
export class ProducerService implements OnApplicationBootstrap {
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
    try {
      this.logger.debug("Connecting to the broker");
      this.connection = await this.rabbitmqService.getConnection(QueueService.name);
      this.channel = await this.rabbitmqService.getChannel(this.connection);
      await this.queueService.setupQueue(this.queueConfig, this.channel);
      this.logger.debug("Initialized and ready to send messages");
    } catch (error) {
      this.logger.error("Failed to initialize:", error);
    }
  }

  /**
   * Creates and queues a quantification job
   *
   * @param quantRequest - Request data for the quantification job
   */
  public async createAndQueueQuant(quantRequest: QuantifyRequest): Promise<void> {
    try {
      if (!this.channel) {
        this.logger.error("Channel is not available. Cannot send message.");
        return;
      }

      this.logger.debug("Gets the request body from the Quantification controller");
      const modelsData = typia.json.assertStringify<QuantifyRequest>(quantRequest);

      this.logger.debug("Queueing the quantification job");
      this.channel.publish(
        this.queueConfig.exchange.name,
        this.queueConfig.exchange.routingKey,
        Buffer.from(modelsData),
        {
          persistent: true,
        },
      );

      await this.quantificationJobModel.findByIdAndUpdate(quantRequest._id, {
        $set: { status: "pending" },
      });
    } catch (error) {
      if (error instanceof TypeGuardError) {
        this.logger.error("The quant request does not follow the schema: ", error);
      } else {
        this.logger.error(error);
      }
    }
  }
}
