import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import * as amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import mongoose, { Model } from "mongoose";
import typia, { TypeGuardError } from "typia";
import { QuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";
import { QuantifiedReport } from "../schemas/quantified-report.schema";

@Injectable()
export class StorageService implements OnApplicationBootstrap {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(QuantifiedReport.name) private readonly quantifiedReportModel: Model<QuantifiedReport>,
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    // Load all the environment variables
    const url = this.configService.get<string>("RABBITMQ_URL");
    const completedQ = this.configService.get<string>("QUANT_STORAGE_QUEUE_NAME");
    if (!url || !completedQ) {
      Logger.error("Required environment variables for quantification storage service are not set");
      return;
    }

    // Connect to the RabbitMQ server, create a channel, and connect to
    // the completed job queue to collect the quantification results
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(completedQ, { durable: true });

    // Perform some sort of action on the results (e.g., store them in the database etc.)
    await channel.consume(
      completedQ,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (msg: ConsumeMessage | null) => {
        if (msg === null) {
          // Handle the case where no message was available
          Logger.error("Unable to parse message from quantification storage queue");
          return;
        }

        try {
          // Convert the quantification report in a JSON object and
          // store this JSON object in the database
          const quantifiedReport: QuantifyReport = typia.json.assertParse<QuantifyReport>(msg.content.toString());
          const report = new this.quantifiedReportModel(quantifiedReport);
          await report.save();
          // Finally, acknowledge the message
          channel.ack(msg);
        } catch (error) {
          if (error instanceof TypeGuardError) {
            Logger.error(
              `Validation failed: ${error.path} is invalid. Expected ${error.expected} but got ${error.value}`,
            );
          } else if (error instanceof mongoose.Error.ValidationError) {
            for (const field in error.errors) {
              Logger.error(error.errors[field].message);
            }
          } else {
            Logger.error("Something went wrong in the quantification storage service.");
          }
        }
      },
      {
        // Since we are manually acknowledging the message, turn auto acknowledging off
        noAck: false,
      },
    );
  }
}
