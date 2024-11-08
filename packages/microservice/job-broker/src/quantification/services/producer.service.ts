import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import amqp from "amqplib";
import typia, { TypeGuardError } from "typia";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { EnvVarKeys } from "../../../config/env_vars.config";

@Injectable()
export class ProducerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProducerService.name);

  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private readonly url: string = EnvVarKeys.RABBITMQ_URL;
  private readonly initialJobQ: string = EnvVarKeys.QUANT_JOB_QUEUE_NAME;
  private readonly deadLetterQ: string = EnvVarKeys.DEAD_LETTER_QUEUE_NAME;
  private readonly deadLetterX: string = EnvVarKeys.DEAD_LETTER_EXCHANGE_NAME;

  private async connectWithRetry(url: string, retryCount: number): Promise<amqp.Connection> {
    let attempt = 0;
    while (attempt < retryCount) {
      try {
        const connection = await amqp.connect(url);
        this.logger.log("Quantification-producer successfully connected to the RabbitMQ broker.");
        return connection;
      } catch {
        attempt++;
        this.logger.error(
          `Attempt ${String(
            attempt,
          )}: Failed to connect to RabbitMQ broker from quantification-producer side. Retrying in 10 seconds...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
    throw new Error(
      "Failed to connect to the RabbitMQ broker after several attempts from quantification-producer side.",
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      this.connection = await this.connectWithRetry(this.url, 3);
      this.channel = await this.connection.createChannel();

      await this.setupQueuesAndExchanges();
      this.logger.log("ProducerService initialized and ready to send messages.");
    } catch (error) {
      this.logger.error("Failed to initialize ProducerService:", error);
    }
  }

  private async setupQueuesAndExchanges(): Promise<void> {
    if (!this.channel) {
      this.logger.error("Channel is not available. Cannot set up queues and exchanges.");
      return;
    }

    await this.channel.assertExchange(this.deadLetterX, "direct", { durable: true });
    await this.channel.assertQueue(this.deadLetterQ, { durable: true });
    await this.channel.bindQueue(this.deadLetterQ, this.deadLetterX, "");

    await this.channel.assertQueue(this.initialJobQ, {
      durable: true,
      deadLetterExchange: this.deadLetterX,
      messageTtl: 60000,
      maxLength: 10000,
    });
  }

  public createAndQueueQuant(modelsWithConfigs: QuantifyRequest): void {
    try {
      if (!this.channel) {
        this.logger.error("Channel is not available. Cannot send message.");
        return;
      }

      const modelsData = typia.json.assertStringify<QuantifyRequest>(modelsWithConfigs);
      this.channel.sendToQueue(this.initialJobQ, Buffer.from(modelsData), {
        persistent: true,
      });
    } catch (error) {
      // Handle specific TypeGuardError for validation issues, logging the detailed path and expected type.
      // Log a generic error message for any other types of errors encountered during the process.
      if (error instanceof TypeGuardError) {
        this.logger.error(error);
      } else {
        this.logger.error(error);
      }
    }
  }
}
