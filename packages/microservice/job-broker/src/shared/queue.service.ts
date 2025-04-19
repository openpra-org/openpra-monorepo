import { Injectable, Logger } from "@nestjs/common";
import { Channel } from "amqplib";
import { DeadLetterConfig, QueueConfig } from "./queue-config.interfaces";

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  /**
   * Sets up a queue with its associated dead letter exchange
   *
   * @param queueConfig - Configuration for the queue
   * @param channel - The established channel between the RabbitMQ exchange and the client
   * @returns A promise that resolves to the channel when setup is complete
   */
  public async setupQueue(queueConfig: QueueConfig, channel: Channel): Promise<void> {
    // Set up dead letter exchange and queue
    await this.setupDeadLetterQueue(queueConfig.deadLetter, channel);

    // Set up the main exchange
    await channel.assertExchange(queueConfig.exchange.name, queueConfig.exchange.type, {
      durable: queueConfig.exchange.durable,
    });

    // Set up the main queue
    await channel.assertQueue(queueConfig.name, {
      durable: queueConfig.durable,
      messageTtl: queueConfig.messageTtl,
      deadLetterExchange: queueConfig.deadLetter.exchange.name,
      deadLetterRoutingKey: queueConfig.deadLetter.exchange.routingKey,
      maxLength: queueConfig.maxLength,
    });

    // Set prefetch if provided
    if (queueConfig.prefetch) {
      await channel.prefetch(queueConfig.prefetch);
    }

    await channel.bindQueue(queueConfig.name, queueConfig.exchange.name, queueConfig.exchange.bindingKey);

    this.logger.debug(`Queue '${queueConfig.name}' setup complete`);
  }

  /**
   * Sets up a dead letter exchange and queue
   *
   * @param channel - RabbitMQ channel to use
   * @param config - Configuration for the dead letter exchange
   * @returns A promise that resolves when setup is complete
   */
  private async setupDeadLetterQueue(config: DeadLetterConfig, channel: Channel): Promise<void> {
    await channel.assertExchange(config.exchange.name, config.exchange.type, { durable: config.exchange.durable });
    await channel.assertQueue(config.name, { durable: config.durable });
    await channel.bindQueue(config.name, config.exchange.name, config.exchange.bindingKey);
  }
}
