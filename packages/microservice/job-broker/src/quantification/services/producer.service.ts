import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import amqp from "amqplib";
import typia, { TypeGuardError } from "typia";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { EnvVarKeys } from "../../../config/env_vars.config";

@Injectable()
export class ProducerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProducerService.name);

  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private readonly url: string | undefined;
  private readonly initialJobQ: string | undefined;
  private readonly deadLetterQ: string | undefined;
  private readonly deadLetterX: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.url = this.configService.getOrThrow(EnvVarKeys.RABBITMQ_URL);
    this.initialJobQ = this.configService.getOrThrow(EnvVarKeys.QUANT_JOB_QUEUE_NAME);
    this.deadLetterQ = this.configService.getOrThrow(EnvVarKeys.DEAD_LETTER_QUEUE_NAME);
    this.deadLetterX = this.configService.getOrThrow(EnvVarKeys.DEAD_LETTER_EXCHANGE_NAME);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.url || !this.initialJobQ || !this.deadLetterQ || !this.deadLetterX) {
      this.logger.error("Required environment variables for quantification producer service are not set");
      return;
    }

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
    if (!this.channel || !this.deadLetterX || !this.deadLetterQ || !this.initialJobQ) {
      this.logger.error("Channel or queue names are not available. Cannot set up queues and exchanges.");
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

  private async connectWithRetry(url: string, retryCount: number): Promise<amqp.Connection> {
    let attempt = 0;
    while (attempt < retryCount) {
      try {
        const connection = await amqp.connect(url);
        this.logger.log("Quantification-producer successfully connected to the RabbitMQ broker.");
        return connection;
      } catch (error) {
        attempt++;
        this.logger.error(
          `Attempt ${attempt.toString()}: Failed to connect to RabbitMQ broker from quantification-producer side. Retrying in 10 seconds...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
    throw new Error(
      "Failed to connect to the RabbitMQ broker after several attempts from quantification-producer side.",
    );
  }

  public createAndQueueQuant(modelsWithConfigs: QuantifyRequest): void {
    try {
      if (!this.channel || !this.initialJobQ) {
        this.logger.error("Channel is not available. Cannot send message.");
        return;
      }

      const modelsData = typia.json.assertStringify<QuantifyRequest>(modelsWithConfigs);
      this.channel.sendToQueue(this.initialJobQ, Buffer.from(modelsData), {
        persistent: true,
      });
    } catch (error) {
      if (error instanceof TypeGuardError) {
        this.logger.error("Validation error:", error);
      } else {
        this.logger.error("Error sending message to queue:", error);
      }
    }
  }
}
