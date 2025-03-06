import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Channel, ConsumeMessage } from "amqplib";
import tmp from "tmp";
import typia, { TypeGuardError } from "typia";
import { RunScramCli } from "scram-node";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { QueueService, QueueConfig, QueueConfigFactory } from "../../shared";
import { QuantificationJobReport } from "../../middleware/schemas/quantification-job.schema";

@Injectable()
export class ConsumerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ConsumerService.name);
  private readonly queueConfig: QueueConfig;
  private channel: Channel | null = null;

  constructor(
    @InjectModel(QuantificationJobReport.name) private readonly quantificationJobModel: Model<QuantificationJobReport>,
    private readonly queueService: QueueService,
    private readonly queueConfigFactory: QueueConfigFactory,
  ) {
    this.queueConfig = this.queueConfigFactory.createQuantJobQueueConfig();
  }

  /**
   * Initialize the consumer service when the application bootstraps
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      this.logger.log("Connecting to the broker");
      this.channel = await this.queueService.setupQueue(this.queueConfig);
      await this.consumeQuantJobs();
      this.logger.log("Initialized and consuming messages");
    } catch (error) {
      this.logger.error("Failed to initialize:", error);
    }
  }

  /**
   * Start consuming messages from the queue
   */
  private async consumeQuantJobs(): Promise<void> {
    if (!this.channel) {
      this.logger.error("Channel is not available. Cannot start consuming.");
      return;
    }

    await this.channel.consume(
      this.queueConfig.name,
      async (msg: ConsumeMessage | null) => {
        if (msg === null) {
          this.logger.error("Unable to parse message from quantification queue");
          return;
        }

        try {
          const modelsData: QuantifyRequest = typia.json.assertParse<QuantifyRequest>(msg.content.toString());
          const { _id, ...modelsWithConfigs } = modelsData;
          const result: string[] = this.performQuantification(modelsWithConfigs);
          await this.quantificationJobModel.findByIdAndUpdate(_id, { $set: { results: result, status: "completed" } });

          this.channel?.ack(msg);
          this.logger.log(`${String(_id)}: Acknowledged`);
        } catch (error) {
          if (error instanceof TypeGuardError) {
            this.logger.error(error);
            this.channel?.nack(msg, false, false);
          } else {
            this.logger.error(error);
            this.channel?.nack(msg, false, false);
          }
        }
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
    const models = modelsWithConfigs.models;

    // Write the model data to temporary XML files and store the file paths.
    const modelFilePaths = this.writeNodeAddonModelFilesBase64(models);
    modelsWithConfigs.models = modelFilePaths;

    // Create a temporary file to store the output of the SCRAM CLI.
    const outputFilePath = String(tmp.fileSync({ prefix: "result", postfix: ".xml" }).name);
    modelsWithConfigs.output = outputFilePath;

    try {
      // Invoke the SCRAM CLI with the updated request
      this.logger.log(`${JSON.stringify(modelsWithConfigs)} is running`);
      RunScramCli(modelsWithConfigs);
      this.logger.log(`${JSON.stringify(modelsWithConfigs)} has been quantified`);

      // Read the quantification results from the output file.
      const outputContent = readFileSync(outputFilePath, "utf8");

      return [outputContent]; // The quantification results.
    } catch (error) {
      this.logger.error("Error during quantification:", error);
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
}
