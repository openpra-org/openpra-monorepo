import { Injectable, Logger } from "@nestjs/common";
import { Channel } from "amqplib";
import { RpcException } from "@nestjs/microservices";
import { DeadLetterConfig, QueueConfig } from "./queue-config.interfaces";
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  public async setupQueue(queueConfig: QueueConfig, channel: Channel): Promise<void> {
    await this.setupDeadLetterQueue(queueConfig.deadLetter, channel);
    try {
      await channel.assertExchange(queueConfig.exchange.name, queueConfig.exchange.type, {
        durable: queueConfig.exchange.durable,
      });
    } catch (err) {
      throw new RpcException(`Failed to initialize ${queueConfig.exchange.name}.`);
    }
    try {
      await channel.assertQueue(queueConfig.name, {
        durable: queueConfig.durable,
        messageTtl: queueConfig.messageTtl,
        deadLetterExchange: queueConfig.deadLetter.exchange.name,
        deadLetterRoutingKey: queueConfig.deadLetter.exchange.routingKey,
        maxLength: queueConfig.maxLength,
      });
      if (queueConfig.prefetch) {
        await channel.prefetch(queueConfig.prefetch);
      }
    } catch (err) {
      throw new RpcException(`Failed to set up ${queueConfig.name}.`);
    }
    try {
      await channel.bindQueue(queueConfig.name, queueConfig.exchange.name, queueConfig.exchange.bindingKey);
    } catch (err) {
      throw new RpcException(`Failed to bind ${queueConfig.exchange.name} and ${queueConfig.name} queue.`);
    }
    this.logger.debug(`Queue '${queueConfig.name}' setup complete`);
  }
  private async setupDeadLetterQueue(config: DeadLetterConfig, channel: Channel): Promise<void> {
    try {
      await channel.assertExchange(config.exchange.name, config.exchange.type, {
        durable: config.exchange.durable,
      });
      await channel.assertQueue(config.name, { durable: config.durable });
      await channel.bindQueue(config.name, config.exchange.name, config.exchange.bindingKey);
    } catch (err) {
      throw new RpcException(`Failed to set up ${config.name}.`);
    }
  }
}
