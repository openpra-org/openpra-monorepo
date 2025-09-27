import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { Channel, ChannelModel, ConsumeMessage } from "amqplib";
import typia from "typia";
import { QuantifyModel } from "scram-node";
import { NodeQuantRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { RpcException } from "@nestjs/microservices";
import { QueueService, QueueConfig, QueueConfigFactory, RabbitMQChannelModelService, MinioService } from "../../shared";

@Injectable()
export class ConsumerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ConsumerService.name);
  private readonly queueConfig: QueueConfig;
  private channelModel: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(
    private readonly queueService: QueueService,
    private readonly rabbitmqService: RabbitMQChannelModelService,
    private readonly queueConfigFactory: QueueConfigFactory,
    private readonly minioService: MinioService,
  ) {
    this.queueConfig = this.queueConfigFactory.createQuantJobQueueConfig();
  }

  async onApplicationBootstrap(): Promise<void> {
    this.logger.debug("Connecting to the broker");
    this.channelModel = await this.rabbitmqService.getChannelModel(ConsumerService.name);
    this.channel = await this.rabbitmqService.getChannel(this.channelModel, ConsumerService.name);
    await this.queueService.setupQueue(this.queueConfig, this.channel);
    this.logger.debug("Initialized and consuming messages...");
    await this.consumeQuantJobs();
  }

  private async consumeQuantJobs(): Promise<void> {
    try {
      await this.channel?.checkQueue(this.queueConfig.name);
    } catch (err) {
      throw new RpcException(`Queue: ${this.queueConfig.name} does not exist.`);
    }

    await this.channel?.consume(
      this.queueConfig.name,
      async (msg: ConsumeMessage | null) => {
        if (msg === null) {
          throw new RpcException(
            `${ConsumerService.name} consumed a null message from ${this.queueConfig.name} queue.`,
          );
        }

        const modelsData = ((): NodeQuantRequest => {
          try {
            this.logger.debug("Gets the message body from the Quantification queue");
            return typia.json.assertParse<NodeQuantRequest>(msg.content.toString());
          } catch (err) {
            this.channel?.nack(msg, false, false);
            throw new RpcException(
              `${ConsumerService.name} consumed an invalid message from ${this.queueConfig.name} queue.`,
            );
          }
        })();

        try {
          this.logger.debug(`Running Job: ${String(modelsData._id)}`);
          await this.minioService.updateJobMetadata(String(modelsData._id), {
            status: "running",
          });
          this.logger.debug("Changing the status to <running>");
        } catch (err) {
          this.logger.error(`Failed to update <running> status of: JobID ${String(modelsData._id)}`);
        }

        try {
          const result = await this.performQuantification(modelsData);
          
          const outputDataString = JSON.stringify(result);
          const outputId = await this.minioService.storeOutputData(outputDataString, String(modelsData._id));
          
          await this.minioService.updateJobMetadata(String(modelsData._id), {
            status: "completed",
            outputId: outputId,
          });
          
          this.logger.debug(`Completed Job: ${String(modelsData._id)}`);
        } catch (err: any) {
          this.channel?.nack(msg, false, false);
          
          await this.minioService.updateJobMetadata(String(modelsData._id), {
            status: "failed",
            error: err.message,
          });
          
          this.logger.error(`Failed to quantify: JobID ${String(modelsData._id)}`);
          return;
        }

        this.channel?.ack(msg);
        this.logger.debug(`Acknowledged Job: ${String(modelsData._id)}`);
      },
      { noAck: false },
    );
  }

  public async performQuantification(nodeQuantRequest: NodeQuantRequest): Promise<any> {
    const { _id, ...quantRequest } = nodeQuantRequest;

    try {
      this.logger.debug(`${String(_id)} is running with scram-node`);
      
      const report = await QuantifyModel(quantRequest.settings, quantRequest.model);
      
      this.logger.debug(`${String(_id)} has been quantified using scram-node`);
      
      return report;
    } catch (error) {
      this.logger.error(`Quantification failed for job ${String(_id)}:`, error);
      throw error;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.channel?.deleteQueue(this.queueConfig.name);
      await this.channel?.close();
      await this.channelModel?.close();
    } catch (err) {
      throw new RpcException(`${ConsumerService.name} failed to stop RabbitMQ services.`);
    }
  }
}