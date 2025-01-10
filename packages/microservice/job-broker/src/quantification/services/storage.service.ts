import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import * as amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import mongoose, { Model } from "mongoose";
import typia, { TypeGuardError } from "typia";
import { QuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";
import { QuantificationJobReport } from "../../middleware/schemas/quantification-job.schema";
import { EnvVarKeys } from "../../../config/env_vars.config";

/**
 * Service responsible for storing quantification results into a database upon application startup.
 *
 * This service listens to a RabbitMQ queue for completed quantification jobs, processes each message
 * by parsing and validating the quantification report, and then stores the report into a MongoDB collection
 * using Mongoose. It handles connection retries to RabbitMQ and implements error handling for message processing.
 */
@Injectable()
export class StorageService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StorageService.name);
  constructor(
    @InjectModel(QuantificationJobReport.name) private readonly quantificationJobModel: Model<QuantificationJobReport>,
  ) {}

  /**
   * Attempts to establish a connection to the RabbitMQ server with retry logic.
   * Logs each attempt and waits 10 seconds before retrying.
   *
   * @param url - The URL of the RabbitMQ server to connect to.
   * @param retryCount - The maximum number of connection attempts.
   * @returns A promise that resolves to the RabbitMQ connection object upon successful connection.
   * @throws {@link Error} if unable to connect after the specified number of retries.
   */
  private async connectWithRetry(url: string, retryCount: number): Promise<amqp.Connection> {
    let attempt = 0;
    while (attempt < retryCount) {
      try {
        const connection = await amqp.connect(url);
        this.logger.log("Quantification-storage-service successfully connected to the RabbitMQ broker.");
        return connection;
      } catch {
        attempt++;
        this.logger.error(
          `Attempt ${String(
            attempt,
          )}: Failed to connect to RabbitMQ broker from quantification-storage-service side. Retrying in 10 seconds...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
    throw new Error(
      "Failed to connect to the RabbitMQ broker after several attempts from quantification-storage-service side",
    );
  }

  /**
   * Initializes the storage service by setting up RabbitMQ connections and starting to consume messages.
   *
   * This method is automatically called when the application boots up. It ensures that all required environment
   * variables are set, connects to RabbitMQ with retry logic, and sets up message consumption from the completed
   * job queue. Each message is processed to store the quantification report in the database.
   */
  public async onApplicationBootstrap(): Promise<void> {
    // Verify that all required environment variables are available, logging an error and exiting if any are missing.
    const url: string = EnvVarKeys.RABBITMQ_URL;
    const completedQ: string = EnvVarKeys.QUANT_STORAGE_QUEUE_NAME;
    const deadLetterQ: string = EnvVarKeys.DEAD_LETTER_QUEUE_NAME;
    const deadLetterX: string = EnvVarKeys.DEAD_LETTER_EXCHANGE_NAME;

    // Establish a connection to RabbitMQ and create a communication channel.
    const connection = await this.connectWithRetry(url, 3);
    const channel = await connection.createChannel();

    // Ensure the dead letter exchange and queue are set up for handling failed messages.
    await channel.assertExchange(deadLetterX, "direct", { durable: true });
    await channel.assertQueue(deadLetterQ, { durable: true });
    await channel.bindQueue(deadLetterQ, deadLetterX, "");

    // Ensure the completed job queue exists and is durable to prevent message loss.
    await channel.assertQueue(completedQ, {
      durable: true,
      deadLetterExchange: deadLetterX,
      messageTtl: 60000,
      maxLength: 10000,
    });
    await channel.prefetch(1);

    // Begin consuming messages from the completed job queue.
    await channel.consume(
      completedQ,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (msg: ConsumeMessage | null) => {
        // Handle the case where the message is invalid.
        if (msg === null) {
          this.logger.error("Unable to parse message from quantification storage queue");
          return;
        }

        try {
          // Serialize the message content into a QuantifyReport object for processing.
          const quantifiedReport: QuantifyReport = typia.json.assertParse<QuantifyReport>(msg.content.toString());
          // Create a new document from the parsed report and save it to the database.
          await this.quantificationJobModel.updateOne(
            { _id: quantifiedReport._id },
            { $set: { status: "completed", results: quantifiedReport.results } },
          );

          // Acknowledge the original message to indicate successful processing.
          channel.ack(msg);
        } catch (error) {
          // Handle type validation errors, Mongoose validation errors, and other generic exceptions,
          // logging details and negatively acknowledging the message.
          if (error instanceof TypeGuardError) {
            this.logger.error(error);
            channel.nack(msg, false, false);
          } else if (error instanceof mongoose.Error.ValidationError) {
            Object.values(error.errors).forEach((err) => {
              this.logger.error(err.message);
            });
            channel.nack(msg, false, false);
          } else {
            this.logger.error(error);
            channel.nack(msg, false, false);
          }
        }
      },
      {
        // Disable automatic acknowledgment to allow manual control over message acknowledgment.
        noAck: false,
      },
    );
  }

  public async getQuantifiedReports(): Promise<QuantificationJobReport[]> {
    return this.quantificationJobModel.find();
  }
}
