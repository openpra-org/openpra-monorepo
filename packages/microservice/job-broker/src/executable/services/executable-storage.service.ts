import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import mongoose, { Model } from "mongoose";
import * as amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import typia, { TypeGuardError } from "typia";
import { ExecutionResult } from "shared-types/src/openpra-mef/util/execution-result";
import { ExecutedResult } from "../schemas/executed-result.schema";
import { EnvVarKeys } from "../../../config/env_vars.config";
import { getRabbitMQConfig } from "../../../config/rabbitmq.config";

/**
 * Service for storing executed task results in a database.
 * This service connects to RabbitMQ to consume task results and
 * saves them to a MongoDB collection.
 */
@Injectable()
export class ExecutableStorageService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExecutableStorageService.name);
  constructor(@InjectModel(ExecutedResult.name) private readonly executedResultModel: Model<ExecutedResult>) {}

  /**
   * Establishes a connection to the RabbitMQ broker with retry logic.
   *
   * @param url - The RabbitMQ broker URL.
   * @param retryCount - The number of retry attempts if the connection fails.
   * @returns A promise that resolves to the established RabbitMQ connection.
   * @throws {@link Error} An error if the connection fails after the specified number of attempts.
   */
  private async connectWithRetry(url: string, retryCount: number): Promise<amqp.Connection> {
    let attempt = 0;
    while (attempt < retryCount) {
      try {
        const connection = await amqp.connect(url);
        this.logger.log("Executable-task-storage successfully connected to the RabbitMQ broker.");
        return connection;
      } catch {
        attempt++;
        this.logger.error(
          `Attempt ${String(
            attempt,
          )}: Failed to connect to RabbitMQ broker from executable-task-storage side. Retrying in 10 seconds...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
    throw new Error(
      "Failed to connect to the RabbitMQ broker after several attempts from executable-task-storage side",
    );
  }

  /**
   * This method is automatically called when the application is bootstrapped and
   * sets up the RabbitMQ connection and starts consuming task results.
   */
  public async onApplicationBootstrap(): Promise<void> {
    // Load all the environment variables required for RabbitMQ.
    const url: string = getRabbitMQConfig()[EnvVarKeys.RABBITMQ_URL];
    const storageQ: string = EnvVarKeys.EXECUTABLE_STORAGE_QUEUE_NAME;
    const deadLetterQ: string = EnvVarKeys.DEAD_LETTER_QUEUE_NAME;
    const deadLetterX: string = EnvVarKeys.DEAD_LETTER_EXCHANGE_NAME;

    // Check if all required environment variables are set. Log the error and exit otherwise.
    if (!url || !storageQ || !deadLetterQ || !deadLetterX) {
      this.logger.error("Required environment variables for executable storage service are not set");
      return;
    }

    // Connect to the RabbitMQ server, create a channel, and connect the
    // database to the executed task result queue.
    const connection = await this.connectWithRetry(url, 3);
    const channel = await connection.createChannel();

    // Assert the existence of a dead letter exchange (DLX) for routing failed messages.
    await channel.assertExchange(deadLetterX, "direct", { durable: true });
    // Assert the existence of a dead letter queue (DLQ) to hold messages that fail processing.
    await channel.assertQueue(deadLetterQ, { durable: true });
    // Bind the dead letter queue to the dead letter exchange.
    await channel.bindQueue(deadLetterQ, deadLetterX, "");

    // Assert and configure a durable queue with dead-letter exchange, message TTL, and max length.
    await channel.assertQueue(storageQ, {
      durable: true,
      deadLetterExchange: deadLetterX,
      messageTtl: 60000,
      maxLength: 10000,
    });

    // Start consuming task results from the executed task result queue.
    await channel.consume(
      storageQ,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (msg: ConsumeMessage | null) => {
        // Check if the consumed message is null, indicating an error in message retrieval.
        if (msg === null) {
          this.logger.error("Executable storage service is unable to parse the consumed message.");
          return;
        }

        try {
          // Convert the message content into a JSON object representing the execution result.
          const executedResult: ExecutionResult = typia.json.assertParse<ExecutionResult>(msg.content.toString());

          // Create a new instance of the executed result model and save it to the database.
          await this.executedResultModel.create(executedResult);

          // Acknowledge the message back to the completed task queue to indicate successful processing.
          channel.ack(msg);
        } catch (error) {
          // Handle validation errors specifically, logging the path and expected vs actual values.
          if (error instanceof TypeGuardError) {
            this.logger.error(error);
            channel.nack(msg, false, false);
          } else if (error instanceof mongoose.Error.ValidationError) {
            // Log validation errors from Mongoose and negatively acknowledge the message.
            for (const field in error.errors) {
              this.logger.error(error.errors[field].message);
              channel.nack(msg, false, false);
            }
          } else {
            // Log a generic error message for other types of errors.
            this.logger.error(error);
            channel.nack(msg, false, false);
          }
        }
      },
      {
        // Since we are manually acknowledging the message, turn auto acknowledging off.
        noAck: false,
      },
    );
  }

  /**
   * Retrieves all executed tasks from the database.
   *
   * @returns A promise that resolves to an array of executed results.
   */
  async getExecutedTasks(): Promise<ExecutedResult[]> {
    return this.executedResultModel.find();
  }
}
