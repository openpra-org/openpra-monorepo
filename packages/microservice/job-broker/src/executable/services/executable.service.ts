import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Channel, ChannelModel } from "amqplib";
import typia from "typia";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { RpcException } from "@nestjs/microservices";
import { QueueService, QueueConfig, QueueConfigFactory, RabbitMQChannelModelService } from "../../shared";
import { ExecutableJobReport } from "../../middleware/schemas/executable-job.schema";

@Injectable()
export class ExecutableService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ExecutableService.name);
  private readonly queueConfig: QueueConfig;
  private channelModel: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(
    @InjectModel(ExecutableJobReport.name) private readonly executableJobModel: Model<ExecutableJobReport>,
    private readonly queueService: QueueService,
    private readonly rabbitmqService: RabbitMQChannelModelService,
    private readonly queueConfigFactory: QueueConfigFactory,
  ) {
    this.queueConfig = this.queueConfigFactory.createExecTaskQueueConfig();
  }

  /**
   * Initialize the service when the application bootstraps
   */
  async onApplicationBootstrap(): Promise<void> {
    this.logger.debug("Connecting to the broker");
    this.channelModel = await this.rabbitmqService.getChannelModel(ExecutableService.name);
    this.channel = await this.rabbitmqService.getChannel(this.channelModel, ExecutableService.name);
    await this.queueService.setupQueue(this.queueConfig, this.channel);
    this.logger.debug("Initialized and ready to send messages");
  }

  /**
   * Creates and queues an execution task
   *
   * @param task - The execution task to queue
   */
  public async createAndQueueTask(task: ExecutionTask): Promise<void> {
    const taskData = ((): string => {
      try {
        this.logger.debug("Gets the request body from the Executable controller");
        return typia.json.assertStringify<ExecutionTask>(task);
      } catch (err) {
        throw new RpcException(`Invalid schema: TaskID <${String(task._id)}>`);
      }
    })();

    try {
      this.logger.debug("Queueing the executable task");
      await this.channel?.checkExchange(this.queueConfig.exchange.name);
      this.channel?.publish(
        this.queueConfig.exchange.name,
        this.queueConfig.exchange.routingKey,
        Buffer.from(taskData),
        {
          persistent: true,
        },
      );
    } catch (err) {
      throw new RpcException(`${this.queueConfig.exchange.name} does not exist.`);
    }

    try {
      await this.executableJobModel.findByIdAndUpdate(task._id, { $set: { status: "pending" } });
    } catch (err) {
      throw new RpcException(`Failed to update <pending> status of: TaskID ${String(task._id)}`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.channel?.deleteExchange(this.queueConfig.exchange.name);
      await this.channel?.close();
      await this.channelModel?.close();
    } catch (err) {
      throw new RpcException(`${ExecutableService.name} failed to stop RabbitMQ services.`);
    }
  }
}
