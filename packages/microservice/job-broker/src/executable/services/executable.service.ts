import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import typia, { TypeGuardError } from "typia";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";

@Injectable()
export class ExecutableService {
  constructor(private readonly configService: ConfigService) {}

  private async connectWithRetry(url: string, retryCount: number): Promise<amqp.Connection> {
    let attempt = 0;
    while (attempt < retryCount) {
      try {
        const connection = await amqp.connect(url);
        Logger.log("Executable-task-producer successfully connected to the RabbitMQ broker.");
        return connection;
      } catch {
        attempt++;
        Logger.error(
          `Attempt ${attempt}: Failed to connect to RabbitMQ broker from executable-task-producer side. Retrying in 10 seconds...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
    throw new Error(
      "Failed to connect to the RabbitMQ broker after several attempts from executable-task-producer side.",
    );
  }

  async createAndQueueTask(task: ExecutionTask): Promise<void> {
    // Load all the environment variables and throw error if variables are missing
    const url = this.configService.get<string>("RABBITMQ_URL");
    const queue = this.configService.get<string>("EXECUTABLE_TASK_QUEUE_NAME");
    const deadLetterQ = this.configService.get<string>("DEAD_LETTER_QUEUE_NAME");
    const deadLetterX = this.configService.get<string>("DEAD_LETTER_EXCHANGE_NAME");
    if (!url || !queue || !deadLetterQ || !deadLetterX) {
      Logger.error("Required environment variables for executable service are not set");
      return;
    }

    try {
      // Connect to the RabbitMQ server, create a channel, and initiate
      // the primary executable job queue
      const connection = await this.connectWithRetry(url, 3);
      const channel = await connection.createChannel();
      await channel.assertExchange(deadLetterX, "direct", { durable: true });
      await channel.assertQueue(deadLetterQ, { durable: true });
      await channel.bindQueue(deadLetterQ, deadLetterX, "");
      await channel.assertQueue(queue, {
        durable: true,
        deadLetterExchange: deadLetterX,
        messageTtl: 60000,
        maxLength: 10000,
      });

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
