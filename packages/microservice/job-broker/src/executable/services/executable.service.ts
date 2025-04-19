import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Channel, Connection } from "amqplib";
import typia, { TypeGuardError } from "typia";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { QueueService, QueueConfig, QueueConfigFactory, RabbitMQConnectionService } from "../../shared";
import { ExecutableJobReport } from "../../middleware/schemas/executable-job.schema";

@Injectable()
export class ExecutableService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExecutableService.name);
  private readonly queueConfig: QueueConfig;
  private connection: Connection | null = null;
  private channel: Channel | null = null;

  constructor(
    @InjectModel(ExecutableJobReport.name) private readonly executableJobModel: Model<ExecutableJobReport>,
    private readonly queueService: QueueService,
    private readonly rabbitmqService: RabbitMQConnectionService,
    private readonly queueConfigFactory: QueueConfigFactory,
  ) {
    this.queueConfig = this.queueConfigFactory.createExecTaskQueueConfig();
  }

  /**
   * Initialize the service when the application bootstraps
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      this.logger.debug("Connecting to the broker");
      this.connection = await this.rabbitmqService.getConnection(ExecutableService.name);
      this.channel = await this.rabbitmqService.getChannel(this.connection);
      await this.queueService.setupQueue(this.queueConfig, this.channel);
      this.logger.debug("Initialized and ready to send messages");
    } catch (error) {
      this.logger.error("Failed to initialize:", error);
    }
  }

  /**
   * Creates and queues an execution task
   *
   * @param task - The execution task to queue
   */
  public async createAndQueueTask(task: ExecutionTask): Promise<void> {
    try {
      if (!this.channel) {
        this.logger.error("Channel is not available. Cannot send message.");
        return;
      }

      const taskData = typia.json.assertStringify<ExecutionTask>(task);
      this.channel.publish(
        this.queueConfig.exchange.name,
        this.queueConfig.exchange.routingKey,
        Buffer.from(taskData),
        {
          persistent: true,
        },
      );

      await this.executableJobModel.findByIdAndUpdate(task._id, { $set: { status: "pending" } });
    } catch (error) {
      if (error instanceof TypeGuardError) {
        this.logger.error("The executable request does not follow the schema: ", error);
      } else {
        this.logger.error(error);
      }
    }
  }
}
