import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import amqp, { ChannelModel } from "amqplib";
import { EnvVarKeys } from "../../config/env_vars.config";
@Injectable()
export class RabbitMQChannelModelService {
  private readonly logger = new Logger(RabbitMQChannelModelService.name);
  constructor(private readonly configSvc: ConfigService) {}
  public async getChannelModel(serviceName: string): Promise<amqp.ChannelModel> {
    try {
      const url = this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_RABBITMQ_URL);
      const heartbeatConfig = this.configSvc.get<string>(EnvVarKeys.ENV_RABBITMQ_HEARTBEAT);
      const heartbeatValue = Number(heartbeatConfig);
      const channelModel = await amqp.connect(url, {
        heartbeat: Number.isFinite(heartbeatValue) && heartbeatValue > 0 ? heartbeatValue : 120,
      });
      return channelModel;
    } catch (err) {
      throw new RpcException(`${serviceName} failed to connect to RabbitMQ broker.`);
    }
  }
  public async getChannel(channelModel: ChannelModel, serviceName: string): Promise<amqp.Channel> {
    try {
      return await channelModel.createChannel();
    } catch (err) {
      throw new RpcException(`${serviceName} failed to create a RabbitMQ channel.`);
    }
  }
}
