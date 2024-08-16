import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import typia, { TypeGuardError } from "typia";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";

@Injectable()
export class ProducerService {
  constructor(private readonly configService: ConfigService) {}

  private async connectWithRetry(url: string, retryCount: number): Promise<amqp.Connection> {
    let attempt = 0;
    while (attempt < retryCount) {
      try {
        const connection = await amqp.connect(url);
        Logger.log("Successfully connected to the RabbitMQ broker.");
        return connection;
      } catch {
        attempt++;
        Logger.error(`Attemp ${attempt}: Failed to connect to RabbitMQ broker. Retrying in 10 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
    throw new Error("Failed to connect to the RabbitMQ broker after several attempts");
  }

  public async createAndQueueQuant(modelsWithConfigs: QuantifyRequest): Promise<void> {
    // Load all the environment variables
    const url = this.configService.get<string>("RABBITMQ_URL");
    const initialJobQ = this.configService.get<string>("QUANT_JOB_QUEUE_NAME");
    const deadLetterQ = this.configService.get<string>("DEAD_LETTER_QUEUE_NAME");
    const deadLetterX = this.configService.get<string>("DEAD_LETTER_EXCHANGE_NAME");
    if (!url || !initialJobQ || !deadLetterQ || !deadLetterX) {
      Logger.error("Required environment variables for quantification producer service are not set");
      return;
    }

    try {
      // Connect to the RabbitMQ server, create a channel, and initiate
      // quantification job queue
      const connection = await this.connectWithRetry(url, 3);
      const channel = await connection.createChannel();

      await channel.assertExchange(deadLetterX, "direct", { durable: true });
      await channel.assertQueue(deadLetterQ, { durable: true });
      await channel.bindQueue(deadLetterQ, deadLetterX, "");
      await channel.assertQueue(initialJobQ, {
        durable: true,
        deadLetterExchange: deadLetterX,
        messageTtl: 60000,
        maxLength: 10000,
      });

      // Send the quantification request to the initial queue
      const modelsData = typia.json.assertStringify<QuantifyRequest>(modelsWithConfigs);
      channel.sendToQueue(initialJobQ, Buffer.from(modelsData), {
        persistent: true,
      });
    } catch (error) {
      if (error instanceof TypeGuardError) {
        Logger.error(`Validation failed: ${error.path} is invalid. Expected ${error.expected} but got ${error.value}`);
      } else {
        Logger.error("Something went wrong in quantification producer service.");
      }
    }
  }
}
