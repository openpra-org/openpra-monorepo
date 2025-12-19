import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import amqp, { ChannelModel } from 'amqplib';
import { EnvVarKeys } from '../../config/env_vars.config';

@Injectable()
export class RabbitMQChannelModelService {
  private readonly logger = new Logger(RabbitMQChannelModelService.name);

  constructor(private readonly configSvc: ConfigService) {}

  /**
   * Attempts to establish a channelModel to the RabbitMQ server with retry logic.
   *
   * @param serviceName - Name of the service attempting channelModel (for logging)
   * @returns A promise that resolves to a RabbitMQ channelModel
   */
  public async getChannelModel(
    serviceName: string,
  ): Promise<amqp.ChannelModel> {
    try {
      const url = this.configSvc.getOrThrow<string>(
        EnvVarKeys.ENV_RABBITMQ_URL,
      );
      const heartbeatConfig = this.configSvc.get<string>(
        EnvVarKeys.ENV_RABBITMQ_HEARTBEAT,
      );
      const heartbeatValue = Number(heartbeatConfig);
      const channelModel = await amqp.connect(url, {
        heartbeat:
          Number.isFinite(heartbeatValue) && heartbeatValue > 0
            ? heartbeatValue
            : 120,
      });
      return channelModel;
    } catch (err) {
      throw new RpcException(
        `${serviceName} failed to connect to RabbitMQ broker.`,
      );
    }
  }

  /**
   * Gets or creates a channel from the channelModel
   *
   * @param channelModel - The established RabbitMQ channelModel between the client and the broker
   * @param serviceName - Name of the service attempting to create the channel (for logging)
   * @returns A promise that resolves to a RabbitMQ channel
   */
  public async getChannel(
    channelModel: ChannelModel,
    serviceName: string,
  ): Promise<amqp.Channel> {
    try {
      return await channelModel.createChannel();
    } catch (err) {
      throw new RpcException(
        `${serviceName} failed to create a RabbitMQ channel.`,
      );
    }
  }
}
