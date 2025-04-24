import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Channel, Connection, ConsumeMessage } from "amqplib";
import tmp from "tmp";
import typia from "typia";
import { RunScramCli } from "scram-node";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { RpcException } from "@nestjs/microservices";
import { QueueService, QueueConfig, QueueConfigFactory, RabbitMQConnectionService } from "../../shared";
import { QuantificationJobReport } from "../../middleware/schemas/quantification-job.schema";

@Injectable()
export class ConsumerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ConsumerService.name);
  private readonly queueConfig: QueueConfig;
  private connection: Connection | null = null;
  private channel: Channel | null = null;

  constructor(
    @InjectModel(QuantificationJobReport.name) private readonly quantificationJobModel: Model<QuantificationJobReport>,
    private readonly queueService: QueueService,
    private readonly rabbitmqService: RabbitMQConnectionService,
    private readonly queueConfigFactory: QueueConfigFactory,
  ) {
    this.queueConfig = this.queueConfigFactory.createQuantJobQueueConfig();
  }

  /**
   * Initialize the consumer service when the application bootstraps
   */
  async onApplicationBootstrap(): Promise<void> {
    this.logger.debug("Connecting to the broker");
    this.connection = await this.rabbitmqService.getConnection(ConsumerService.name);
    this.channel = await this.rabbitmqService.getChannel(this.connection, ConsumerService.name);
    await this.queueService.setupQueue(this.queueConfig, this.channel);
    this.logger.debug("Initialized and consuming messages...");
    await this.consumeQuantJobs();
  }

  /**
   * Start consuming messages from the queue
   */
  private async consumeQuantJobs(): Promise<void> {
    try {
      await this.channel?.checkQueue(this.queueConfig.name);
    } catch (err) {
      throw new RpcException(`Queue: ${this.queueConfig.name} does not exist.`);
    }

    await this.channel?.consume(
      this.queueConfig.name,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (msg: ConsumeMessage | null) => {
        if (msg === null) {
          throw new RpcException(
            `${ConsumerService.name} consumed a null message from ${this.queueConfig.name} queue.`,
          );
        }

        const modelsData = ((): QuantifyRequest => {
          try {
            this.logger.debug("Gets the message body from the Quantification queue");
            return typia.json.assertParse<QuantifyRequest>(msg.content.toString());
          } catch (err) {
            this.channel?.nack(msg, false, false);
            throw new RpcException(
              `${ConsumerService.name} consumed an invalid message from ${this.queueConfig.name} queue.`,
            );
          }
        })();

        try {
          this.logger.debug(`Running Job: ${String(modelsData._id)}`);
          await this.quantificationJobModel.findByIdAndUpdate(modelsData._id, {
            $set: { status: "running" },
          });
          this.logger.debug("Changing the status to <running>");
        } catch (err) {
          throw new RpcException(`Failed to update <running> status of: JobID ${String(modelsData._id)}`);
        }

        try {
          this.performQuantification(modelsData);
        } catch (err) {
          this.channel?.nack(msg, false, false);
          throw new RpcException(`Failed to quantify: JobID ${String(modelsData._id)}`);
        }

        try {
          await this.quantificationJobModel.findByIdAndUpdate(modelsData._id, {
            $set: { status: "completed" },
          });
          this.logger.debug(`Completed Job: ${String(modelsData._id)}`);
          /* Right now we are saving only the Job status, not the results.
           * await this.quantificationJobModel.findByIdAndUpdate(modelsData._id, {
           *  $set: { results: result, status: "completed" },
           * });
           */
        } catch (err) {
          throw new RpcException(`Failed to update <completed> status of: JobID ${String(modelsData._id)}`);
        }

        this.channel?.ack(msg);
        this.logger.debug(`Acknowledged Job: ${String(modelsData._id)}`);
      },
      { noAck: false },
    );
  }

  /**
   * Performs quantification by invoking the scram-node-addon with the provided configurations.
   *
   * @param modelsWithConfigs - The quantification request containing model data and configurations.
   * @returns An array of result strings from the quantification process.
   */
  public performQuantification(modelsWithConfigs: QuantifyRequest): string[] {
    // Extract model data from the request.
    const { _id, ...modelConfigs } = modelsWithConfigs;
    const models = modelConfigs.models;

    // Write the model data to temporary XML files and store the file paths.
    const modelFilePaths = this.writeNodeAddonModelFilesBase64(models);
    modelConfigs.models = modelFilePaths;

    // Create a temporary file to store the output of the SCRAM CLI.
    const outputFilePath = String(tmp.fileSync({ prefix: "result", postfix: ".xml" }).name);
    modelConfigs.output = outputFilePath;

    try {
      // Invoke the SCRAM CLI with the updated request
      this.logger.debug(`${String(_id)} is running`);
      RunScramCli(modelConfigs);
      this.logger.debug(`${String(_id)} has been quantified`);

      // Read the quantification results from the output file.
      const outputContent = readFileSync(outputFilePath, "utf8");

      return [outputContent]; // The quantification results.
    } finally {
      // Cleanup: Remove all temporary files created during the process.
      modelFilePaths.forEach(unlinkSync); // Remove model data files.
      unlinkSync(outputFilePath); // Remove the output file.
    }
  }

  /**
   * Writes model data, provided as Base64 encoded strings, to temporary XML files.
   *
   * @param models - An array of Base64 encoded strings representing the model data.
   * @returns An array of file paths containing the decoded model data.
   */
  public writeNodeAddonModelFilesBase64(models: string[]): string[] {
    const files: string[] = [];

    for (const model of models) {
      const tempFile = tmp.fileSync({ prefix: "models", postfix: ".xml" });
      const modelContent = Buffer.from(model, "base64").toString("utf8");
      writeFileSync(tempFile.name, modelContent);
      files.push(tempFile.name);
    }

    return files;
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.channel?.deleteQueue(this.queueConfig.name);
      await this.channel?.close();
      await this.connection?.close();
    } catch (err) {
      throw new RpcException(`${ConsumerService.name} failed to stop RabbitMQ services.`);
    }
  }
}
