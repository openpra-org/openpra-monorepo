import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import mongoose, { Model } from "mongoose";
import * as amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import typia, { TypeGuardError } from "typia";
import { ExecutionResult } from "mef-types/openpra-mef/util/execution-result";
import { ConfigService } from "@nestjs/config";
import { ExecutableJobReport } from "../../middleware/schemas/executable-job.schema";
import { EnvVarKeys } from "../../../config/env_vars.config";

/**
 * Service for storing executed task results in a database.
 * This service connects to RabbitMQ to consume task results and
 * saves them to a MongoDB collection.
 */
@Injectable()
export class ExecutableStorageService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExecutableStorageService.name);
  constructor(
    @InjectModel(ExecutableJobReport.name) private readonly executableJobModel: Model<ExecutableJobReport>,
    private readonly configSvc: ConfigService,
  ) {}

  /**
   * Establishes a connection to the RabbitMQ broker with retry logic.
   *
   * @param url - The RabbitMQ broker URL.
   * @param retryCount - The number of retry attempts if the connection fails.
   * @returns A promise that resolves to the established RabbitMQ connection.
   * @throws {@link Error} An error if the connection fails after the specified number of attempts.
   */
  private async connectWithRetry(url: string, retryCount: number): Promise<amqp.ChannelModel> {
    let attempt = 0;
    while (attempt < retryCount) {
      try {
        const channelModel = await amqp.connect(url);
        this.logger.log("Executable-task-storage successfully connected to the RabbitMQ broker.");
        return channelModel;
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
    // Connect to the RabbitMQ server, create a channel, and connect the
    // database to the executed task result queue.
    const url = this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_RABBITMQ_URL);
    const channelModel = await this.connectWithRetry(url, 3);
    const channel = await channelModel.createChannel();

    const execStorageDeadLetterQ = this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_STORAGE_DEAD_LETTER_QUEUE);
    const execStorageDeadLetterX = this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_STORAGE_DEAD_LETTER_EXCHANGE);
    const execStorageDeadLetterDurable = Boolean(this.configSvc.getOrThrow<boolean>(
      EnvVarKeys.EXEC_STORAGE_DEAD_LETTER_QUEUE_DURABLE,
    ));
    // Assert the existence of a dead letter exchange (DLX) for routing failed messages.
    await channel.assertExchange(execStorageDeadLetterX, "direct", { durable: execStorageDeadLetterDurable });
    // Assert the existence of a dead letter queue (DLQ) to hold messages that fail processing.
    await channel.assertQueue(execStorageDeadLetterQ, { durable: execStorageDeadLetterDurable });
    // Bind the dead letter queue to the dead letter exchange.
    await channel.bindQueue(execStorageDeadLetterQ, execStorageDeadLetterX, "");

    const storageQ = this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_STORAGE_QUEUE);
    const storageTtl = Number(this.configSvc.getOrThrow<number>(EnvVarKeys.EXEC_STORAGE_MSG_TTL));
    const storageQDurable = Boolean(this.configSvc.getOrThrow<boolean>(EnvVarKeys.EXEC_STORAGE_QUEUE_DURABLE));
    const storageQMaxLength = Number(this.configSvc.getOrThrow<number>(EnvVarKeys.EXEC_STORAGE_QUEUE_MAXLENGTH));
    const storagePrefetch = Number(this.configSvc.getOrThrow<number>(EnvVarKeys.EXEC_STORAGE_MSG_PREFETCH));
    // Assert and configure a durable queue with dead-letter exchange, message TTL, and max length.
    await channel.assertQueue(storageQ, {
      durable: storageQDurable,
      deadLetterExchange: execStorageDeadLetterX,
      messageTtl: storageTtl,
      maxLength: storageQMaxLength,
    });
    await channel.prefetch(storagePrefetch);

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
          await this.executableJobModel.updateOne(
            { _id: executedResult._id },
            {
              $set: {
                status: "completed",
                exit_code: executedResult.exit_code,
                stdout: executedResult.stdout,
                stderr: executedResult.stderr,
              },
            },
          );

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
  async getExecutedTasks(): Promise<ExecutableJobReport[]> {
    return this.executableJobModel.find();
  }
}
