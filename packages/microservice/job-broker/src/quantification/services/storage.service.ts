import { Injectable, OnApplicationBootstrap, UseFilters } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import { InjectModel } from "@nestjs/mongoose";
import * as amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import { Model } from "mongoose";
import typia from "typia";
import { QuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";
import { QuantifiedReport } from "../schemas/quantified-report.schema";
import { RmqExceptionFilter } from "../../exception-filters/rmq-exception.filter";

@Injectable()
export class StorageService implements OnApplicationBootstrap {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(QuantifiedReport.name) private readonly quantifiedReportModel: Model<QuantifiedReport>,
  ) {}

  @UseFilters(new RmqExceptionFilter())
  public async onApplicationBootstrap(): Promise<void> {
    // Load all the environment variables
    const url = this.configService.get<string>("RABBITMQ_URL");
    const completedQ = this.configService.get<string>("QUANT_STORAGE_QUEUE_NAME");
    if (!url || !completedQ) {
      throw new RpcException("Required environment variables for quantification storage service are not set");
    }

    // Connect to the RabbitMQ server, create a channel, and connect to
    // the completed job queue to collect the quantification results
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(completedQ, { durable: true });

    // Perform some sort of action on the results (e.g., store them in the database etc.)
    await channel.consume(
      completedQ,
      (msg: ConsumeMessage | null) => {
        if (msg === null) {
          // Handle the case where no message was available
          throw new RpcException("Unable to parse message from quantification storage queue");
        }

        // Convert the quantification report in a JSON object and
        // store this JSON object in the database
        const quantifiedReport: QuantifyReport = typia.json.assertParse<QuantifyReport>(msg.content.toString());
        const report = new this.quantifiedReportModel(quantifiedReport);
        void report.save();
        // Finally, acknowledge the message
        channel.ack(msg);
      },
      {
        // Since we are manually acknowledging the message, turn auto acknowledging off
        noAck: false,
      },
    );
  }
}
