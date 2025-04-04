import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import amqp from "amqplib";
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
    const url = this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_RABBITMQ_URL);
    const retryCount = 3;

    return await this.connectWithRetry(url, retryCount, serviceName);
  }

  /**
   * Gets or creates a channel from the connection
   *
   * @param serviceName - Name of the service requesting the channel
   * @returns A promise that resolves to a RabbitMQ channel
   */
  public async getChannel(serviceName: string): Promise<amqp.Channel> {
    const connection = await this.getConnection(serviceName);
    return await connection.createChannel();
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
}
