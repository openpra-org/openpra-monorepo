import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import amqp from "amqplib";
import typia, { TypeGuardError } from "typia";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { EnvVarKeys } from "../../../config/env_vars.config";

@Injectable()
export class ProducerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProducerService.name);

  private quantifyProducerLatency = 0;
  private quantifyProducerMemoryUsage = 0;
  private quantifyProducerCpuUsage = 0;

  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private readonly url: string = EnvVarKeys.RABBITMQ_URL;
  private readonly initialJobQ: string = EnvVarKeys.QUANT_JOB_QUEUE_NAME;
  private readonly deadLetterQ: string = EnvVarKeys.DEAD_LETTER_QUEUE_NAME;
  private readonly deadLetterX: string = EnvVarKeys.DEAD_LETTER_EXCHANGE_NAME;

  private async connectWithRetry(url: string, retryCount: number): Promise<amqp.Connection> {
    let attempt = 0;
    while (attempt < retryCount) {
      try {
        const connection = await amqp.connect(url);
        this.logger.log("Quantification-producer successfully connected to the RabbitMQ broker.");
        return connection;
      } catch (error) {
        attempt++;
        this.logger.error(
          `Attempt ${attempt.toString()}: Failed to connect to RabbitMQ broker from quantification-producer side. Retrying in 10 seconds...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
    throw new Error(
      "Failed to connect to the RabbitMQ broker after several attempts from quantification-producer side.",
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      this.connection = await this.connectWithRetry(this.url, 3);
      this.channel = await this.connection.createChannel();

      await this.setupQueuesAndExchanges();
      this.logger.log("ProducerService initialized and ready to send messages.");
    } catch (error) {
      this.logger.error("Failed to initialize ProducerService:", error);
    }
  }

  private async setupQueuesAndExchanges(): Promise<void> {
    if (!this.channel) {
      this.logger.error("Channel is not available. Cannot set up queues and exchanges.");
      return;
    }

    await this.channel.assertExchange(this.deadLetterX, "direct", { durable: true });
    await this.channel.assertQueue(this.deadLetterQ, { durable: true });
    await this.channel.bindQueue(this.deadLetterQ, this.deadLetterX, "");

    await this.channel.assertQueue(this.initialJobQ, {
      durable: true,
      deadLetterExchange: this.deadLetterX,
      messageTtl: 60000,
      maxLength: 10000,
    });
  }

  public createAndQueueQuant(modelsWithConfigs: QuantifyRequest): void {
    const startTime = performance.now();
    const startCpuUsage = process.cpuUsage();

    try {
      if (!this.channel) {
        this.logger.error("Channel is not available. Cannot send message.");
        return;
      }

      const modelsData = typia.json.assertStringify<QuantifyRequest>(modelsWithConfigs);
      this.channel.sendToQueue(this.initialJobQ, Buffer.from(modelsData), {
        persistent: true,
      });
    } catch (error) {
      if (error instanceof TypeGuardError) {
        this.logger.error("Validation error:", error);
      } else {
        this.logger.error("Error sending message to queue:", error);
      }
    } finally {
      const endTime = performance.now();
      const endCpuUsage = process.cpuUsage(startCpuUsage);

      const latency = endTime - startTime;
      const cpuUsage = (endCpuUsage.user + endCpuUsage.system) / (latency * 1000);
      const memoryUsage = process.memoryUsage().heapUsed / (1024 * 1024); // in MB

      this.setQuantifyProducerLatency(latency);
      this.setQuantifyProducerCpuUsage(cpuUsage);
      this.setQuantifyProducerMemoryUsage(memoryUsage);
    }
  }

  public getQuantifyProducerLatency(): number {
    return this.quantifyProducerLatency;
  }

  private setQuantifyProducerLatency(latency: number): void {
    this.quantifyProducerLatency = latency;
  }

  public getQuantifyProducerCpuUsage(): number {
    return this.quantifyProducerCpuUsage;
  }

  private setQuantifyProducerCpuUsage(cpuUsage: number): void {
    this.quantifyProducerCpuUsage = cpuUsage;
  }

  public getQuantifyProducerMemoryUsage(): number {
    return this.quantifyProducerMemoryUsage;
  }

  private setQuantifyProducerMemoryUsage(memoryUsage: number): void {
    this.quantifyProducerMemoryUsage = memoryUsage;
  }
}
