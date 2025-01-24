import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import tmp from "tmp";
import typia, { TypeGuardError } from "typia";
import { RunScramCli } from "scram-node";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { EnvVarKeys } from "../../../config/env_vars.config";
import { QuantificationJobReport } from "../../middleware/schemas/quantification-job.schema";

@Injectable()
export class ConsumerService implements OnModuleInit {
  // Importing ConfigService for accessing environment variables.
  private readonly logger = new Logger(ConsumerService.name);
  constructor(
    @InjectModel(QuantificationJobReport.name) private readonly quantificationJobModel: Model<QuantificationJobReport>,
  ) {}

  /**
   * Attempts to establish a connection to the RabbitMQ server with retry logic.
   *
   * This method tries to connect to the RabbitMQ server using the provided URL. If the connection attempt fails,
   * it retries until the maximum number of attempts (`retryCount`) is reached. Between each retry, it waits for 10 seconds.
   * Logs are generated to indicate the success or failure of each connection attempt.
   *
   * @param url - The URL of the RabbitMQ server.
   * @param retryCount - The maximum number of allowed attempts to connect to the server.
   * @returns A promise that resolves to a RabbitMQ connection.
   * @throws Error if the connection could not be established after the specified number of retries.
   */
  private async connectWithRetry(url: string, retryCount: number): Promise<amqp.Connection> {
    let attempt = 0; // Initialize the attempt counter.
    while (attempt < retryCount) {
      // Continue trying until the retry count is reached.
      try {
        const connection = await amqp.connect(url); // Attempt to connect to RabbitMQ.
        this.logger.log("Quantification-consumer successfully connected to the RabbitMQ broker."); // Log successful connection.
        return connection; // Return the established connection.
      } catch {
        attempt++; // Increase the attempt count upon failure.
        this.logger.error(
          `Attempt ${String(
            attempt,
          )}: Failed to connect to RabbitMQ broker from quantification-consumer side. Retrying in 10 seconds...`, // Log the failure and retry intention.
        );
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait for 10 seconds before retrying.
      }
    }
    // If the loop exits without returning a connection, throw an error indicating failure to connect.
    throw new Error(
      "Failed to connect to the RabbitMQ broker after several attempts from quantification-consumer side.",
    );
  }

  /**
   * Initializes the consumer service and starts consuming messages from RabbitMQ upon module initialization.
   *
   * Sets up the environment by loading necessary env variables, establishing a connection to RabbitMQ,
   * and preparing the service to consume messages from the initial job queue. It ensures that all required environment
   * variables are set, connects to RabbitMQ with retry logic, and sets up message consumption with appropriate error
   * handling and acknowledgment.
   *
   * @returns A promise that resolves when the module initialization process is complete.
   */
  public async onModuleInit(): Promise<void> {
    console.log("Settings environment variables for the Consumer");
    // Verify that all required environment variables are available, logging an error and exiting if any are missing.
    const url: string = EnvVarKeys.RABBITMQ_URL;
    const initialJobQ: string = EnvVarKeys.QUANT_JOB_QUEUE_NAME;
    const deadLetterQ: string = EnvVarKeys.DEAD_LETTER_QUEUE_NAME;
    const deadLetterX: string = EnvVarKeys.DEAD_LETTER_EXCHANGE_NAME;

    // Connect to the RabbitMQ server and create a channel.
    const connection = await this.connectWithRetry(url, 3);
    const channel = await connection.createChannel();
    // Ensure the dead letter exchange and queue are set up for handling failed messages.
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
    await channel.prefetch(1);

    // Consume the jobs from the initial queue
    await channel.consume(
      initialJobQ,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (msg: ConsumeMessage | null) => {
        if (msg === null) {
          this.logger.error("Unable to parse message from initial quantification queue");
          return;
        }

        try {
          const modelsData: QuantifyRequest = typia.json.assertParse<QuantifyRequest>(msg.content.toString());
          const { _id, ...modelsWithConfigs } = modelsData;
          const result: string[] = this.performQuantification(modelsWithConfigs);
          await this.quantificationJobModel.findByIdAndUpdate(_id, { $set: { results: result, status: "completed" } });

          channel.ack(msg);
          console.log(`${String(_id)}: Consumer has acknowledged`);
        } catch (error) {
          // Handle validation errors and other generic exceptions, logging details and negatively
          // acknowledging the message.
          if (error instanceof TypeGuardError) {
            this.logger.error(error);
            channel.nack(msg, false, false);
          } else {
            this.logger.error(error);
            channel.nack(msg, false, false);
          }
        }
      },
      {
        noAck: false, // Disable automatic acknowledgment to allow manual control over message acknowledgment.
      },
    );
  }

  /**
   * Performs quantification by invoking the scram-node-addon with the provided configurations.
   * This method processes quantification requests by writing model data to temporary files,
   * invoking the SCRAM CLI through the scram-node-addon, and reading the results from an output file.
   * It handles the creation and cleanup of all temporary files used during the process.
   *
   * @param modelsWithConfigs - The quantification request containing model data and configurations.
   * @returns A `QuantifyReport` object containing the results of the quantification process.
   */
  public performQuantification(modelsWithConfigs: QuantifyRequest): string[] {
    // Extract model data from the request.
    const models = modelsWithConfigs.models;

    // Write the model data to temporary XML files and store the file paths.
    const modelFilePaths = this.writeNodeAddonModelFilesBase64(models);
    modelsWithConfigs.models = modelFilePaths;

    // Create a temporary file to store the output of the SCRAM CLI.
    const outputFilePath = String(tmp.fileSync({ prefix: "result", postfix: ".xml" }).name);
    modelsWithConfigs.output = outputFilePath;

    try {
      // Invoke the SCRAM CLI with the updated request, which now includes file paths
      // to the input model and output files.
      console.log(`${JSON.stringify(modelsWithConfigs)} is running`);
      RunScramCli(modelsWithConfigs);
      console.log(`${JSON.stringify(modelsWithConfigs)} has been quantified`);

      // Read the quantification results from the output file.
      const outputContent = readFileSync(outputFilePath, "utf8");

      // Construct and return the quantification report along with the configurations.
      return [outputContent]; // The quantification results.
    } catch (error) {
      // In case of an error during quantification, return a report indicating the failure.
      this.logger.error(error);
      return ["Error during scram-cli operation"];
    } finally {
      // Cleanup: Remove all temporary files created during the process.
      modelFilePaths.forEach(unlinkSync); // Remove model data files.
      unlinkSync(outputFilePath); // Remove the output file.
    }
  }

  /**
   * Writes model data, provided as Base64 encoded strings, to temporary XML files.
   *
   * Iterates over an array of model data strings, each encoded in Base64. For each model,
   * it decodes the string into UTF-8 format and writes the resulting content to a temporary file.
   * This is necessary for processing the model data with external tools or libraries that require
   * file input. The temporary files are prefixed with "models-" and suffixed with ".xml" to indicate
   * their content and format.
   *
   * @param models - An array of Base64 encoded strings representing the model data.
   * @returns An array of strings, where each string is the path to a temporary file containing the decoded model data.
   */
  public writeNodeAddonModelFilesBase64(models: string[]): string[] {
    const files: string[] = []; // Initialize an array to hold the paths of the temporary files.

    for (const model of models) {
      // Iterate over each model in the provided array.
      const tempFile = tmp.fileSync({ prefix: "models", postfix: ".xml" }); // Create a temporary file for each model.

      // Decode the Base64 encoded model string to UTF-8.
      const modelContent = Buffer.from(model, "base64").toString("utf8");
      writeFileSync(tempFile.name, modelContent); // Write the decoded content to the temporary file.
      files.push(tempFile.name); // Add the path of the temporary file to the array.
    }
    return files; // Return the array containing the paths of all temporary files created.
  }
}
