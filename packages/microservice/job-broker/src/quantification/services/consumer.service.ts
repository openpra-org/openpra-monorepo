import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";

import { JOB_BROKER_KEY_DEFAULTS, JobBrokerKeys } from "../../job-broker.keys";

const fs = require("fs");
const util = require("util");
const tmp = require("tmp");
const scramAddon = require("scram-node/build/Release/scram-node.node");

@Injectable()
export class ConsumerService implements OnApplicationBootstrap {
  constructor(private configService: ConfigService) {}

  public async onApplicationBootstrap(): Promise<void> {
    // Load all the environment variables
    const url = this.configService.get<string>(
      JobBrokerKeys.RABBITMQ_URL,
      JOB_BROKER_KEY_DEFAULTS[JobBrokerKeys.RABBITMQ_URL],
    );
    const initialJobQ = this.configService.get<string>(
      JobBrokerKeys.INITIAL_JOB_QUEUE,
      JOB_BROKER_KEY_DEFAULTS[JobBrokerKeys.INITIAL_JOB_QUEUE],
    );
    const storageQ = this.configService.get<string>(
      JobBrokerKeys.STORAGE_QUEUE,
      JOB_BROKER_KEY_DEFAULTS[JobBrokerKeys.STORAGE_QUEUE],
    );

    // Connect to the RabbitMQ server, create a channel, and connect the
    // workers to the initial queue to consume jobs
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(initialJobQ, { durable: true });

    // Workers will be able to handle only one quantification job at a time
    await channel.prefetch(1);

    // Consume the jobs from the initial queue
    await channel.consume(
      initialJobQ,
      (msg: ConsumeMessage | null) => {
        if (msg === null) {
          console.error("Unable to parse message", msg);
          return;
        }

        // Convert the inputs/data into a JSON object and
        // perform the quantification using this JSON object
        const modelsWithConfigs: QuantifyRequest = JSON.parse(msg.content.toString()) as QuantifyRequest;
        const output = this.performQuantification(modelsWithConfigs);
        const result = JSON.stringify(output);

        // Retrieve the dispatch queue name and correlation ID
        const dispatchQ = String(msg.properties.replyTo);
        const corrID = String(msg.properties.correlationId);

        // Send the quantification results to the storage/completed-job queue
        // Attach the dispatch queue name and correlation ID with the results
        void channel.assertQueue(storageQ, { durable: true });
        channel.sendToQueue(storageQ, Buffer.from(result), {
          persistent: true,
          correlationId: corrID,
          replyTo: dispatchQ,
        });

        // Finally acknowledge the message back to the initial queue
        // to let the broker know that the job has been completed
        channel.ack(msg);
      },
      {
        // Since we are manually acknowledging the message, turn auto acknowledging off
        noAck: false,
      },
    );
  }

  // Using scram-node-addon
  public async performQuantification(modelsWithConfigs: QuantifyRequest) {
    const readFileAsync = util.promisify(fs.readFile);
    const models = modelsWithConfigs.models;

    // Step 1: Write the model data XMLs to a set of files
    const modelFilePaths = await this.writeNodeAddonModelFilesBase64(models);
    modelsWithConfigs.models = modelFilePaths;

    // Step 2: Create the output XML file
    const outputFilePath = String(tmp.fileSync({ prefix: "result", postfix: ".xml" }).name);
    modelsWithConfigs.output = outputFilePath;

    // Convert the scramAddon.RunScramCli to a promise
    const runScramCliAsync = util.promisify(scramAddon.RunScramCli.bind(scramAddon));

    try {
      // Step 3: Pass the arguments to the scram node wrapper and wait for completion
      await runScramCliAsync(modelsWithConfigs);

      // Step 4: Read the output XML file
      const outputContent = await readFileAsync(outputFilePath, "utf8");
      // const output = outputContent.replace(/\n/g, '');

      // Step 5: Construct and return the QuantifyReport object
      return {
        configuration: modelsWithConfigs, // Optionally include the configuration used for the analysis
        results: [outputContent], // Assuming the report content is directly usable
      };
    } catch (error) {
      console.error("Error during SCRAM CLI operation:", error);
      return null; // or handle error more gracefully
    } finally {
      // Step 6: Remove the temporary files (Cleanup)
      modelFilePaths.forEach((filePath) => fs.unlinkSync(filePath));
      fs.unlinkSync(outputFilePath); // Remove the output file after reading
    }
  }

  public async writeNodeAddonModelFilesBase64(models: string[]): Promise<string[]> {
    const files = [];
    const writeFileAsync = util.promisify(fs.writeFile);

    for (const model of models) {
      const tempFile = tmp.fileSync({ prefix: "models-", postfix: ".xml" });

      // Decode the Base64 string to UTF-8
      const modelContent = Buffer.from(model, "base64").toString("utf8");
      await writeFileAsync(tempFile.name, modelContent);
      files.push(tempFile.name);
    }
    return files;
  }
}
