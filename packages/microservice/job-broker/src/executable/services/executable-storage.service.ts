import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import mongoose, { Model } from "mongoose";
import * as amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import typia, { TypeGuardError } from "typia";
import { ExecutionResult } from "shared-types/src/openpra-mef/util/execution-result";
import { ExecutedResult } from "../schemas/executed-result.schema";

@Injectable()
export class ExecutableStorageService implements OnApplicationBootstrap {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(ExecutedResult.name) private readonly executedResultModel: Model<ExecutedResult>,
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    // Load all the environment variables
    const url = this.configService.get<string>("RABBITMQ_URL");
    const storageQ = this.configService.get<string>("EXECUTABLE_STORAGE_QUEUE_NAME");
    if (!url || !storageQ) {
      Logger.error("Required environment variables for executable storage service are not set");
      return;
    }

    // Connect to the RabbitMQ server, create a channel, and connect the
    // database to the executed task result queue
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(storageQ, { durable: true });

    // Consume the task results from the executed task result queue
    await channel.consume(
      storageQ,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (msg: ConsumeMessage | null) => {
        if (msg === null) {
          Logger.error("Executable storage service is unable to parse the consumed message.");
          return;
        }

        try {
          // Convert the results into a JSON object and
          // store these results in the database
          const executedResult: ExecutionResult = typia.json.assertParse<ExecutionResult>(msg.content.toString());
          const result = new this.executedResultModel(executedResult);
          await result.save();
          // Finally acknowledge the message back to the storage queue
          // to let the broker know that the result has been consumed
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
            Logger.error("Something went wrong in the executable storage service.");
          }
        }
      },
      {
        // Since we are manually acknowledging the message, turn auto acknowledging off
        noAck: false,
      },
    );
  }

  async getExecutedTasks(): Promise<ExecutedResult[]> {
    return this.executedResultModel.find();
  }
}
