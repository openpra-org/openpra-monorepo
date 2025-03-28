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
   * @param serviceName - Name of the service (i.e., ProducerService, ExecutableService etc.)
   * @param queueConfig - Configuration for the queue
   * @returns A promise that resolves to the channel when setup is complete
   */
  public async setupQueue(serviceName: string, queueConfig: QueueConfig): Promise<Channel> {
    const channel = await this.connectionSvc.getChannel(serviceName);

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

    this.logger.debug(`Queue '${queueConfig.name}' setup complete`);
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
    await channel.assertQueue(config.name, { durable: config.durable });
    await channel.bindQueue(config.name, config.exchange, "");
  }
}
