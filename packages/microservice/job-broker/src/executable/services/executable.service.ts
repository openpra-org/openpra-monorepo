import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import amqp from "amqplib";
import typia, { TypeGuardError } from "typia";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { EnvVarKeys } from "../../../config/env_vars.config";

@Injectable()
export class ExecutableService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExecutableService.name);

  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private readonly url: string = EnvVarKeys.RABBITMQ_URL;
  private readonly queue: string = EnvVarKeys.EXECUTABLE_TASK_QUEUE_NAME;
  private readonly deadLetterQ: string = EnvVarKeys.DEAD_LETTER_QUEUE_NAME;
  private readonly deadLetterX: string = EnvVarKeys.DEAD_LETTER_EXCHANGE_NAME;

  private async connectWithRetry(url: string, retryCount: number): Promise<amqp.Connection> {
    let attempt = 0;
    while (attempt < retryCount) {
      try {
        const connection = await amqp.connect(url);
        this.logger.log("Executable-task-producer successfully connected to the RabbitMQ broker.");
        return connection;
      } catch (error) {
        attempt++;
        this.logger.error(
          `Attempt ${attempt.toString()}: Failed to connect to RabbitMQ broker from executable-task-producer side. Retrying in 10 seconds...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
    throw new Error(
      "Failed to connect to the RabbitMQ broker after several attempts from executable-task-producer side.",
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      this.connection = await this.connectWithRetry(this.url, 3);
      this.channel = await this.connection.createChannel();

      await this.setupQueuesAndExchanges();
      this.logger.log("ExecutableService initialized and ready to send messages.");
    } catch (error) {
      this.logger.error("Failed to initialize ExecutableService:", error);
    }
  }

  private async setupQueuesAndExchanges(): Promise<void> {
    if (!this.channel) {
      this.logger.error("Channel is not available. Cannot set up queues and exchanges.");
      return;
    }

    await this.channel.assertExchange(this.deadLetterX, "direct", { durable: true });
    await this.channel.assertQueue(this.deadLetterQ, { durable: true });
    await this.channel.bindQueue(this.deadLetterQ, this.deadLetterX, "");

    await this.channel.assertQueue(this.queue, {
      durable: true,
      deadLetterExchange: this.deadLetterX,
      messageTtl: 60000,
      maxLength: 10000,
    });
  }

  public createAndQueueTask(task: ExecutionTask): void {
    try {
      if (!this.channel) {
        this.logger.error("Channel is not available. Cannot send message.");
        return;
      }

      const taskData = typia.json.assertStringify<ExecutionTask>(task);
      this.channel.sendToQueue(this.queue, Buffer.from(taskData), {
        persistent: true,
      });
    } catch (error) {
      if (error instanceof TypeGuardError) {
        this.logger.error("Validation error:", error);
      } else {
        this.logger.error("Error sending message to queue:", error);
      }
    }
  }
}
