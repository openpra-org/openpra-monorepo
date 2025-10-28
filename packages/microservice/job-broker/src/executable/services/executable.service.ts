import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import amqp from "amqplib";
import typia, { TypeGuardError } from "typia";
import type { ExecutionTask } from "mef-types/openpra-mef/util/execution-task";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ConfigService } from "@nestjs/config";

import { EnvVarKeys } from "../../../config/env_vars.config";
import { ExecutableJobReport } from "../../middleware/schemas/executable-job.schema";

/**
 * Produces executable task messages to RabbitMQ and updates task status.
 *
 * Sets up queues/exchanges and sends validated `ExecutionTask` payloads for workers to execute.
 */
@Injectable()
export class ExecutableService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExecutableService.name);
  private channelModel: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;

  constructor(
    @InjectModel(ExecutableJobReport.name) private readonly executableJobModel: Model<ExecutableJobReport>,
    private readonly configSvc: ConfigService,
  ) {}

  private async connectWithRetry(url: string, retryCount: number): Promise<amqp.ChannelModel> {
    let attempt = 0;
    while (attempt < retryCount) {
      try {
        const channelModel = await amqp.connect(url);
        this.logger.log("Executable-task-producer successfully connected to the RabbitMQ broker.");
        return channelModel;
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
      const url = this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_RABBITMQ_URL);
      this.channelModel = await this.connectWithRetry(url, 3);
      this.channel = await this.channelModel.createChannel();

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

    // set up dead letter exchange and queue
    const execTaskDeadLetterQ = this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_DEAD_LETTER_QUEUE);
    const execTaskDeadLetterX = this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_DEAD_LETTER_EXCHANGE);
    const execTaskDeadLetterDurable = Boolean(
      this.configSvc.getOrThrow<boolean>(EnvVarKeys.EXEC_TASK_DEAD_LETTER_QUEUE_DURABLE),
    );
    await this.channel.assertExchange(execTaskDeadLetterX, "direct", { durable: execTaskDeadLetterDurable });
    await this.channel.assertQueue(execTaskDeadLetterQ, { durable: execTaskDeadLetterDurable });
    await this.channel.bindQueue(execTaskDeadLetterQ, execTaskDeadLetterX, "");

    // setup exec task queue
    const taskQ = this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_QUEUE);
    const taskTtl = Number(this.configSvc.getOrThrow<number>(EnvVarKeys.EXEC_TASK_MSG_TTL));
    const taskQDurable = Boolean(this.configSvc.getOrThrow<boolean>(EnvVarKeys.EXEC_TASK_QUEUE_DURABLE));
    const taskQMaxLength = Number(this.configSvc.getOrThrow<number>(EnvVarKeys.EXEC_TASK_QUEUE_MAXLENGTH));
    await this.channel.assertQueue(taskQ, {
      durable: taskQDurable,
      deadLetterExchange: execTaskDeadLetterX,
      messageTtl: taskTtl,
      maxLength: taskQMaxLength,
    });
  }

  public async createAndQueueTask(task: ExecutionTask): Promise<void> {
    try {
      if (!this.channel) {
        this.logger.error("Channel is not available. Cannot send message.");
        return;
      }

      const taskData = typia.json.assertStringify<ExecutionTask>(task);
      const taskQ = this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_QUEUE);
      this.channel.sendToQueue(taskQ, Buffer.from(taskData), {
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
