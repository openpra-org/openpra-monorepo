import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import amqp, { Connection } from "amqplib";
import { EnvVarKeys } from "../../config/env_vars.config";

@Injectable()
export class RabbitMQConnectionService {
  private readonly logger = new Logger(RabbitMQConnectionService.name);

  constructor(private readonly configSvc: ConfigService) {}

  /**
   * Attempts to establish a connection to the RabbitMQ server with retry logic.
   *
   * @param serviceName - Name of the service attempting connection (for logging)
   * retryCount - Maximum number of retry attempts
   * @returns A promise that resolves to a RabbitMQ connection
   */
  public async getConnection(serviceName: string): Promise<amqp.Connection> {
    try {
      const url = this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_RABBITMQ_URL);
      const connection = await amqp.connect(url);
      this.logger.debug(`${serviceName} successfully connected to the RabbitMQ broker.`);
      return connection;
    } catch (err) {
      throw new RpcException(`${serviceName} failed to connect to RabbitMQ broker.`);
    }
  }

  /**
   * Gets or creates a channel from the connection
   *
   * @param connection - The established RabbitMQ connection between the client and the broker
   * @param serviceName - Name of the service attempting to create the channel (for logging)
   * @returns A promise that resolves to a RabbitMQ channel
   */
  public async getChannel(connection: Connection, serviceName: string): Promise<amqp.Channel> {
    try {
      return await connection.createChannel();
    } catch (err) {
      throw new RpcException(`${serviceName} failed to create a RabbitMQ channel.`);
    }
  }
}
