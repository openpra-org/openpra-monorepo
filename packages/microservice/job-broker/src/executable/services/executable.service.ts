import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import amqp from "amqplib";
import typia, { TypeGuardError } from "typia";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";

/**
 * This service provides methods to create and queue executable tasks for various PRA solvers.
 */
@Injectable()
export class ExecutableService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Establishes a connection to the RabbitMQ broker with retry logic.
   *
   * This method attempts to connect to the specified RabbitMQ URL up to a given
   * number of times. If the connection fails, it waits for 10 seconds before
   * retrying. If all attempts fail, an error is thrown.
   *
   * @param url - The RabbitMQ broker URL.
   * @param retryCount - The number of retry attempts if the connection fails.
   * @returns A promise that resolves to an established RabbitMQ connection.
   * @throws {@link Error} An error if the connection fails after the specified number of attempts.
   */
  private async connectWithRetry(url: string, retryCount: number): Promise<amqp.Connection> {
    let attempt = 0;
    while (attempt < retryCount) {
      try {
        const connection = await amqp.connect(url);
        Logger.log("Executable-task-producer successfully connected to the RabbitMQ broker.");
        return connection;
      } catch {
        attempt++;
        Logger.error(
          `Attempt ${String(
            attempt,
          )}: Failed to connect to RabbitMQ broker from executable-task-producer side. Retrying in 10 seconds...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
    throw new Error(
      "Failed to connect to the RabbitMQ broker after several attempts from executable-task-producer side.",
    );
  }

  /**
   * Creates a new executable task and queues it for processing.
   *
   * This method loads necessary environment variables, establishes a connection
   * to RabbitMQ, and sends the task data to the specified task queue. It also sets
   * up a dead letter queue for handling failed messages. If any required environment
   * variables are missing, an error is logged, and the execution process exits.
   *
   * @param task - The task to be executed, represented as an ExecutionTask object.
   * @returns A promise that resolves when the task has been successfully queued.
   * @throws {@link Error} An error if required environment variables are missing or if task validation fails.
   */
  async createAndQueueTask(task: ExecutionTask): Promise<void> {
    // Load all the environment variables and throw error if variables are missing
    const url = this.configService.get<string>("RABBITMQ_URL");
    const queue = this.configService.get<string>("EXECUTABLE_TASK_QUEUE_NAME");
    const deadLetterQ = this.configService.get<string>("DEAD_LETTER_QUEUE_NAME");
    const deadLetterX = this.configService.get<string>("DEAD_LETTER_EXCHANGE_NAME");

    if (!url || !queue || !deadLetterQ || !deadLetterX) {
      Logger.error("Required environment variables for executable service are not set");
      return;
    }

    try {
      // Establish a connection to the RabbitMQ server with retry logic.
      const connection = await this.connectWithRetry(url, 3);
      // Create a communication channel with the RabbitMQ server.
      const channel = await connection.createChannel();

      // Assert the existence of a dead letter exchange (DLX) for routing failed messages.
      await channel.assertExchange(deadLetterX, "direct", { durable: true });
      // Assert the existence of a dead letter queue (DLQ) to hold messages that fail processing.
      await channel.assertQueue(deadLetterQ, { durable: true });
      // Bind the dead letter queue to the dead letter exchange.
      await channel.bindQueue(deadLetterQ, deadLetterX, "");

      // Assert the existence of the main executable task queue.
      // This queue is durable, has a dead letter exchange, a time-to-live duration of 60 seconds,
      // and a maximum length of 10,000 messages.
      await channel.assertQueue(queue, {
        durable: true,
        deadLetterExchange: deadLetterX,
        messageTtl: 60000,
        maxLength: 10000,
      });

      // Validate and serialize the provided task object into a JSON string.
      const taskData = typia.json.assertStringify<ExecutionTask>(task);

      // Send the serialized task data to the main job queue, marking the message as persistent.
      channel.sendToQueue(queue, Buffer.from(taskData), {
        persistent: true,
      });
    } catch (error) {
      // Handle validation errors specifically, logging the path and expected vs actual values.
      if (error instanceof TypeGuardError) {
        Logger.error(
          `Validation failed: ${String(error.path)} is invalid. Expected ${error.expected} but got ${String(
            error.value,
          )}`,
        );
      } else {
        // Log a generic error message for other types of errors.
        Logger.error("Something went wrong in the executable service.");
      }
    }
  }
}
