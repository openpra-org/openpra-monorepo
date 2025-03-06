import { Injectable, Logger } from "@nestjs/common";
import { Channel } from "amqplib";
import { DeadLetterConfig, QueueConfig } from "./queue-config.interfaces";
import { RabbitMQConnectionService } from "./rabbitmq-connection.service";

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(private readonly connectionSvc: RabbitMQConnectionService) {}

  /**
   * Sets up a queue with its associated dead letter exchange
   *
   * @param queueConfig - Configuration for the queue
   * @param channelKey - Optional key for the channel
   * @returns A promise that resolves to the channel when setup is complete
   */
  public async setupQueue(queueConfig: QueueConfig, channelKey = queueConfig.name): Promise<Channel> {
    const channel = await this.connectionSvc.getChannel(channelKey);

    // Set up dead letter exchange and queue
    await this.setupDeadLetterExchange(channel, queueConfig.deadLetter);

    // Set up the main queue
    await channel.assertQueue(queueConfig.name, {
      durable: queueConfig.durable,
      deadLetterExchange: queueConfig.deadLetter.exchange,
      messageTtl: queueConfig.messageTtl,
      maxLength: queueConfig.maxLength,
    });

    // Set prefetch if provided
    if (queueConfig.prefetch) {
      await channel.prefetch(queueConfig.prefetch);
    }

    this.logger.log(`Queue '${queueConfig.name}' setup complete`);
    return channel;
  }

  /**
   * Sets up a dead letter exchange and queue
   *
   * @param channel - RabbitMQ channel to use
   * @param config - Configuration for the dead letter exchange
   * @returns A promise that resolves when setup is complete
   */
  private async setupDeadLetterExchange(channel: Channel, config: DeadLetterConfig): Promise<void> {
    await channel.assertExchange(config.exchange, "direct", { durable: config.durable });
    await channel.assertQueue(config.queue, { durable: config.durable });
    await channel.bindQueue(config.queue, config.exchange, "");
  }
}
