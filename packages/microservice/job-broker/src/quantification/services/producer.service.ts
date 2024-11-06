/**
 * Service responsible for producing and queueing quantification jobs in RabbitMQ.
 *
 * This service handles the connection to RabbitMQ, queue setup, and message publishing
 * for quantification requests. It includes robust connection handling with retries and
 * utilizes environment variables for configuration.
 */

// Importing Logger for logging, amqplib for RabbitMQ connection and operations, typia for type validation
// and TypeGuardError for error handling, and shared types for quantification request validation.
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import amqp from "amqplib";
import typia, { TypeGuardError } from "typia";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";

@Injectable()
export class ProducerService {
  // Importing ConfigService for environment variable access.
  private readonly logger = new Logger(ProducerService.name);
  constructor(private readonly configService: ConfigService) {}

  /**
   * Establishes a connection to RabbitMQ with retry logic.
   *
   * Attempts to connect to RabbitMQ using the provided URL and retries upon failure
   * up to the specified retry count. Logs connection attempts and failures.
   *
   * @param url - The RabbitMQ server URL.
   * @param retryCount - The number of connection attempts before failing.
   * @returns A promise that resolves to the RabbitMQ connection.
   * @throws {@link Error} if unable to connect after the specified number of retries.
   */
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

  /**
   * Creates and queues a quantification job in RabbitMQ.
   *
   * Validates and serializes the quantification request, connects to RabbitMQ,
   * sets up the necessary queues and exchange, and publishes the request to the queue.
   * Handles connection retries and logs the process throughout.
   *
   * @param modelsWithConfigs - The model data extracted from the request body.
   * @returns A promise that resolves to void.
   */
  public async createAndQueueQuant(modelsWithConfigs: QuantifyRequest): Promise<void> {
    // Load all the environment variables necessary for RabbitMQ connection and queue configuration.
    // If any of the required environment variables are missing, log an error and exit the function.
    const url = this.configService.get<string>("RABBITMQ_URL");
    const initialJobQ = this.configService.get<string>("QUANT_JOB_QUEUE_NAME");
    const deadLetterQ = this.configService.get<string>("DEAD_LETTER_QUEUE_NAME");
    const deadLetterX = this.configService.get<string>("DEAD_LETTER_EXCHANGE_NAME");
    if (!url || !initialJobQ || !deadLetterQ || !deadLetterX) {
      this.logger.error("Required environment variables for quantification producer service are not set");
      return;
    }

    try {
      // Attempt to connect to the RabbitMQ server with a retry mechanism.
      // On successful connection, create a RabbitMQ channel for placing messages in a queue.
      const connection = await this.connectWithRetry(url, 3);
      const channel = await connection.createChannel();

      // Set up the dead letter exchange and queue, and bind them together.
      // This is used for messages that are either invalid or could not be processed
      // in time.
      await channel.assertExchange(deadLetterX, "direct", { durable: true });
      await channel.assertQueue(deadLetterQ, { durable: true });
      await channel.bindQueue(deadLetterQ, deadLetterX, "");

      // Assert the existence of the initial job queue with specific configurations,
      // including durability, dead letter exchange, time-to-live duration, and maximum queue length.
      await channel.assertQueue(initialJobQ, {
        durable: true,
        deadLetterExchange: deadLetterX,
        messageTtl: 60000,
        maxLength: 10000,
      });

      // Serialize the quantification request data and send it to the initial job queue.
      // Mark the message as persistent to ensure it is not lost in case the broker restarts.
      const modelsData = typia.json.assertStringify<QuantifyRequest>(modelsWithConfigs);
      channel.sendToQueue(initialJobQ, Buffer.from(modelsData), {
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
