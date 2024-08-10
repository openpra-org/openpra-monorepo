import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import typia, { TypeGuardError } from "typia";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";

@Injectable()
export class ExecutableService {
  constructor(private readonly configService: ConfigService) {}

  async createAndQueueTask(task: ExecutionTask): Promise<void> {
    // Load all the environment variables and throw error if variables are missing
    const url = this.configService.get<string>("RABBITMQ_URL");
    const queue = this.configService.get<string>("EXECUTABLE_TASK_QUEUE_NAME");
    if (!url || !queue) {
      Logger.error("Required environment variables for executable service are not set");
      return;
    }

    try {
      // Connect to the RabbitMQ server, create a channel, and initiate
      // the primary executable job queue
      const connection = await amqp.connect(url);
      const channel = await connection.createChannel();
      await channel.assertQueue(queue, { durable: true });

      // Send the executable task data to the initial job queue
      const taskData = typia.json.assertStringify<ExecutionTask>(task);
      channel.sendToQueue(queue, Buffer.from(taskData), {
        persistent: true,
      });
    } catch (error) {
      if (error instanceof TypeGuardError) {
        Logger.error(`Validation failed: ${error.path} is invalid. Expected ${error.expected} but got ${error.value}`);
      } else {
        Logger.error("Something went wrong in the executable service.");
      }
    }
  }
}
