import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import tmp from "tmp";
import typia, { TypeGuardError } from "typia";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { QuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";
import { ScramAddonType } from "shared-types/src/openpra-mef/util/scram-addon-type";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const scramAddon: ScramAddonType = require("scram-node/build/Release/scram-node.node") as ScramAddonType;

@Injectable()
export class ConsumerService implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  public async onModuleInit(): Promise<void> {
    // Load all the environment variables
    const url = this.configService.get<string>("RABBITMQ_URL");
    const initialJobQ = this.configService.get<string>("QUANT_JOB_QUEUE_NAME");
    const storageQ = this.configService.get<string>("QUANT_STORAGE_QUEUE_NAME");
    if (!url || !initialJobQ || !storageQ) {
      Logger.error("Required environment variables for quantification consumer service are not set");
      return;
    }

    // Connect to the RabbitMQ server, create a channel, and connect the
    // workers to the initial queue to consume quantification jobs
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(initialJobQ, { durable: true });

    // Workers will be able to handle only one quantification job at a time
    await channel.prefetch(1);

    // Consume the jobs from the initial queue
    await channel.consume(
      initialJobQ,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (msg: ConsumeMessage | null) => {
        if (msg === null) {
          Logger.error("Unable to parse message from initial quantification queue");
          return;
        }

        try {
          // Convert the inputs/data into a JSON object and perform
          // the quantification using this JSON object
          const modelsWithConfigs: QuantifyRequest = typia.json.assertParse<QuantifyRequest>(msg.content.toString());
          const result: QuantifyReport = this.performQuantification(modelsWithConfigs);
          const report = typia.json.assertStringify<QuantifyReport>(result);
          // Send the quantification results to the completed-job queue
          await channel.assertQueue(storageQ, { durable: true });
          channel.sendToQueue(storageQ, Buffer.from(report), {
            persistent: true,
          });

          // Finally acknowledge the message back to the initial queue
          // to let the broker know that the job has been completed
          channel.ack(msg);
        } catch (error) {
          if (error instanceof TypeGuardError) {
            Logger.error(
              `Validation failed: ${error.path} is invalid. Expected ${error.expected} but got ${error.value}`,
            );
            channel.nack(msg);
          } else {
            Logger.error("Something went wrong in the quantification consumer service.");
            channel.nack(msg);
          }
        }
      },
      {
        // Since we are manually acknowledging the message, turn auto acknowledging off
        noAck: false,
      },
    );
  }

  // Using scram-node-addon
  public performQuantification(modelsWithConfigs: QuantifyRequest): QuantifyReport {
    const models = modelsWithConfigs.models;

    // Step 1: Write the model data XMLs to a set of files
    const modelFilePaths = this.writeNodeAddonModelFilesBase64(models);
    modelsWithConfigs.models = modelFilePaths;

    // Step 2: Create the output XML file
    const outputFilePath = String(tmp.fileSync({ prefix: "result", postfix: ".xml" }).name);
    modelsWithConfigs.output = outputFilePath;

    try {
      // Step 3: Pass the arguments to the scram node wrapper and wait for completion
      scramAddon.RunScramCli(modelsWithConfigs);

      // Step 4: Read the output XML file
      const outputContent = readFileSync(outputFilePath, "utf8");

      // Step 5: Construct and return the QuantifyReport object
      return {
        configuration: modelsWithConfigs, // Optionally include the configuration used for the analysis
        results: [outputContent], // Assuming the report content is directly usable
      };
    } catch (error) {
      return {
        configuration: modelsWithConfigs,
        results: ["Error during SCRAM CLI operation"],
      };
    } finally {
      // Step 6: Remove the temporary files (Cleanup)
      modelFilePaths.forEach((filePath) => {
        unlinkSync(filePath);
      });
      unlinkSync(outputFilePath); // Remove the output file after reading
    }
  }

  public writeNodeAddonModelFilesBase64(models: string[]): string[] {
    const files: string[] = [];

    for (const model of models) {
      const tempFile = tmp.fileSync({ prefix: "models-", postfix: ".xml" });

      // Decode the Base64 string to UTF-8
      const modelContent = Buffer.from(model, "base64").toString("utf8");
      writeFileSync(tempFile.name, modelContent);
      files.push(tempFile.name);
    }
    return files;
  }
}
