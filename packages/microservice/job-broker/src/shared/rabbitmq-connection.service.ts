import { Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import amqp from "amqplib";
import { EnvVarKeys } from "../../config/env_vars.config";

@Injectable()
export class RabbitMQConnectionService implements OnApplicationShutdown {
  private readonly logger = new Logger(RabbitMQConnectionService.name);
  private connection: amqp.Connection | null = null;
  private readonly channels = new Map<string, amqp.Channel>();

  constructor(private readonly configSvc: ConfigService) {}

  /**
   * Attempts to establish a connection to the RabbitMQ server with retry logic.
   *
   * @param serviceName - Name of the service attempting connection (for logging)
   * @param retryCount - Maximum number of retry attempts
   * @returns A promise that resolves to a RabbitMQ connection
   */
  public async getConnection(serviceName: string, retryCount = 3): Promise<amqp.Connection> {
    if (this.connection) {
      return this.connection;
    }

    const url = this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_RABBITMQ_URL);
    this.connection = await this.connectWithRetry(url, retryCount, serviceName);
    return this.connection;
  }

  /**
   * Gets or creates a channel from the connection
   *
   * @param serviceName - Name of the service requesting the channel
   * @param channelKey - Unique identifier for the channel
   * @returns A promise that resolves to a RabbitMQ channel
   */
  public async getChannel(serviceName: string, channelKey = "default"): Promise<amqp.Channel> {
    const existingChannel = this.channels.get(channelKey);
    if (existingChannel) {
      return existingChannel;
    }

    const connection = await this.getConnection(serviceName);
    const channel = await connection.createChannel();
    this.channels.set(channelKey, channel);
    return channel;
  }

  /**
   * Attempts to establish a connection to the RabbitMQ server with retry logic.
   *
   * @param url - The RabbitMQ server URL
   * @param retryCount - Maximum number of allowed attempts
   * @param serviceName - Name of the service attempting connection (for logging)
   * @returns A promise that resolves to a RabbitMQ connection
   * @throws Error if connection fails after specified retries
   */
  private async connectWithRetry(url: string, retryCount: number, serviceName: string): Promise<amqp.Connection> {
    let attempt = 0;
    while (attempt < retryCount) {
      try {
        const connection = await amqp.connect(url);
        this.logger.debug(`${serviceName} successfully connected to the RabbitMQ broker.`);
        return connection;
      } catch {
        attempt++;
        this.logger.error(
          `Attempt ${String(attempt)}: Failed to connect to RabbitMQ broker from ${serviceName}. ` +
            `Retrying in 10 seconds...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
    throw new Error(`Failed to connect to RabbitMQ broker after ${String(retryCount)} attempts from ${serviceName}.`);
  }

  /**
   * Closes the connection and all channels
   */
  public async onApplicationShutdown(): Promise<void> {
    for (const [key, channel] of this.channels.entries()) {
      try {
        await channel.close();
        this.channels.delete(key);
      } catch (error) {
        this.logger.error(`Error closing channel ${key}:`, error);
      }
    }

    if (this.connection) {
      try {
        await this.connection.close();
        this.connection = null;
      } catch (error) {
        this.logger.error("Error closing connection:", error);
      }
    }
  }
}
