import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import typia, { TypeGuardError } from "typia";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";

@Injectable()
export class ProducerService {
  constructor(private readonly configService: ConfigService) {}

  public async createAndQueueQuant(modelsWithConfigs: QuantifyRequest): Promise<void> {
    // Load all the environment variables
    const url = this.configService.get<string>("RABBITMQ_URL");
    const initialJobQ = this.configService.get<string>("QUANT_JOB_QUEUE_NAME");
    if (!url || !initialJobQ) {
      Logger.error("Required environment variables for quantification producer service are not set");
      return;
    }

    try {
      // Connect to the RabbitMQ server, create a channel, and initiate
      // quantification job queue
      const connection = await amqp.connect(url);
      const channel = await connection.createChannel();
      await channel.assertQueue(initialJobQ, { durable: true });

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
