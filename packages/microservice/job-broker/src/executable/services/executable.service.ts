import { Injectable, UseFilters } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import * as amqp from "amqplib";
import typia from "typia";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { RmqExceptionFilter } from "../../exception-filters/rmq-exception.filter";

@Injectable()
export class ExecutableService {
  constructor(private readonly configService: ConfigService) {}

  @UseFilters(new RmqExceptionFilter())
  async createAndQueueTask(task: ExecutionTask): Promise<boolean> {
    // Load all the environment variables and throw error if variables are missing
    const url = this.configService.get<string>("RABBITMQ_URL");
    const queue = this.configService.get<string>("EXECUTABLE_TASK_QUEUE_NAME");
    if (!url || !queue) {
      throw new RpcException("Required environment variables for executable service are not set");
    }

    // Connect to the RabbitMQ server, create a channel, and initiate
    // the primary executable job queue
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(queue, { durable: true });

    // Send the executable task data to the initial job queue
    const taskData = typia.json.assertStringify<ExecutionTask>(task);
    return channel.sendToQueue(queue, Buffer.from(taskData), {
      persistent: true,
    });
  }
}
