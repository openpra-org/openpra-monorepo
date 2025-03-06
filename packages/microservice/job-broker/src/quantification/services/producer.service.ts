import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Channel } from "amqplib";
import typia, { TypeGuardError } from "typia";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { QueueService, QueueConfig, QueueConfigFactory } from "../../shared";

@Injectable()
export class ProducerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProducerService.name);
  private readonly queueConfig: QueueConfig;
  private channel: Channel | null = null;

  constructor(
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
      this.logger.log("Connecting to the broker");
      this.channel = await this.queueService.setupQueue(this.queueConfig);
      this.logger.log("Initialized and ready to send messages");
    } catch (error) {
      this.logger.error("Failed to initialize:", error);
    }
  }

  /**
   * Creates and queues a quantification job
   *
   * @param quantRequest - Request data for the quantification job
   */
  public createAndQueueQuant(quantRequest: QuantifyRequest): void {
    try {
      if (!this.channel) {
        this.logger.error("Channel is not available. Cannot send message.");
        return;
      }

      this.logger.log("Gets the request body from the Quantification controller");
      const modelsData = typia.json.assertStringify<QuantifyRequest>(quantRequest);

      this.logger.log("Queueing the quantification job");
      this.channel.sendToQueue(this.queueConfig.name, Buffer.from(modelsData), {
        persistent: true,
      });
      this.logger.log("Quantification job queued");
    } catch (error) {
      if (error instanceof TypeGuardError) {
        this.logger.error(error);
      } else {
        this.logger.error(error);
      }
    }
  }
}
