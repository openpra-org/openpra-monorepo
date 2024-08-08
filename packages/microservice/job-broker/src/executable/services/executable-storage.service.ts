import { Injectable, OnApplicationBootstrap, UseFilters } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import typia from "typia";
import { ExecutionResult } from "shared-types/src/openpra-mef/util/execution-task";
import { ExecutedResult } from "../schemas/executed-result.schema";
import { RmqExceptionFilter } from "../../exception-filters/rmq-exception.filter";

@Injectable()
export class ExecutableStorageService implements OnApplicationBootstrap {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(ExecutedResult.name) private readonly executedResultModel: Model<ExecutedResult>,
  ) {}

  @UseFilters(new RmqExceptionFilter())
  public async onApplicationBootstrap(): Promise<void> {
    // Load all the environment variables
    const url = this.configService.get<string>("RABBITMQ_URL");
    const storageQ = this.configService.get<string>("EXECUTABLE_STORAGE_QUEUE_NAME");
    if (!url || !storageQ) {
      throw new RpcException("Required environment variables for executable storage service are not set");
    }

    // Connect to the RabbitMQ server, create a channel, and connect the
    // database to the executed task result queue
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(storageQ, { durable: true });

    // Consume the task results from the executed task result queue
    await channel.consume(
      storageQ,
      (msg: ConsumeMessage | null) => {
        if (msg === null) {
          throw new RpcException("Executable storage service is unable to parse the consumed message.");
        }

        // Convert the results into a JSON object and
        // store these results in the database
        const executedResult: ExecutionResult = typia.json.assertParse<ExecutionResult>(msg.content.toString());
        const result = new this.executedResultModel(executedResult);
        void result.save();
        // Finally acknowledge the message back to the storage queue
        // to let the broker know that the result has been consumed
        channel.ack(msg);
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
