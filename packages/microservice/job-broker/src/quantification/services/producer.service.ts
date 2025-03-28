import { Injectable, InternalServerErrorException, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Channel } from "amqplib";
import typia, { TypeGuardError } from "typia";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { QueueService, QueueConfig, QueueConfigFactory } from "../../shared";
import { QuantificationJobReport } from "../../middleware/schemas/quantification-job.schema";

@Injectable()
export class ProducerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProducerService.name);
  private readonly queueConfig: QueueConfig;
  private channel: Channel | null = null;

  constructor(
    @InjectModel(QuantificationJobReport.name) private readonly quantificationJobModel: Model<QuantificationJobReport>,
    private readonly queueService: QueueService,
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
      this.channel = await this.queueService.setupQueue(QueueService.name, this.queueConfig);
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
  public async createAndQueueQuant(quantRequest: QuantifyRequest): Promise<string | InternalServerErrorException> {
    try {
      if (!this.channel) {
        this.logger.error("Channel is not available. Cannot send message.");
        return new InternalServerErrorException();
      }

      this.logger.debug("Gets the request body from the Quantification controller");
      const modelsData = typia.json.assertStringify<QuantifyRequest>(quantRequest);

      this.logger.debug("Queueing the quantification job");
      this.channel.sendToQueue(this.queueConfig.name, Buffer.from(modelsData), {
        persistent: true,
      });

      await this.quantificationJobModel.findByIdAndUpdate(quantRequest._id, {
        $set: { status: "pending" },
      });
      return `Job: ${String(quantRequest._id)} has been queued to <${String(this.queueConfig.name)}>`;
    } catch (error) {
      if (error instanceof TypeGuardError) {
        this.logger.error(error);
        throw new InternalServerErrorException();
      } else {
        this.logger.error(error);
        throw new InternalServerErrorException();
      }
    }
  }
}
