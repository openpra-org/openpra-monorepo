import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import amqp from "amqplib";
import typia, { TypeGuardError } from "typia";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { EnvVarKeys } from "../../../config/env_vars.config";
import { getRabbitMQConfig } from "../../../config/rabbitmq.config";
import { ExecutableJobReport } from '../../schemas/job-reports.schema';

@Injectable()
export class ExecutableService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExecutableService.name);
  constructor(@InjectModel(ExecutableJobReport.name) private readonly executableJobModel: Model<ExecutableJobReport>) {}

  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private readonly url: string = getRabbitMQConfig()[EnvVarKeys.RABBITMQ_URL];
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
      } catch {
        attempt++;
        this.logger.error(
          `Attempt ${String(
            attempt,
          )}: Failed to connect to RabbitMQ broker from executable-task-producer side. Retrying in 10 seconds...`,
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

  public async createAndQueueTask(task: ExecutionTask): Promise<void> {
    try {
      if (!this.channel) {
        this.logger.error("Channel is not available. Cannot send message.");
        return;
      }

      const taskData = typia.json.assertStringify<ExecutionTask>(task);
      this.channel.sendToQueue(this.queue, Buffer.from(taskData), {
        persistent: true,
      });
      await this.executableJobModel.updateOne({ _id: task._id }, { $set: { status: "queued" } });
    } catch (error) {
      // Handle validation errors specifically, logging the path and expected vs actual values.
      if (error instanceof TypeGuardError) {
        this.logger.error(error);
      } else {
        // Log a generic error message for other types of errors.
        this.logger.error(error);
      }
    }
  }
}
