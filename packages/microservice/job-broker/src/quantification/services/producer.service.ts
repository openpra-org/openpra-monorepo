import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import amqp from "amqplib";
import typia, { TypeGuardError } from "typia";
import { QuantifyRequest } from "mef-types/openpra-mef/util/quantify-request";
import { EnvVarKeys } from "../../../config/env_vars.config";

@Injectable()
export class ProducerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProducerService.name);
  private channelModel: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  constructor(private readonly configSvc: ConfigService) {}

  private async connectWithRetry(url: string, retryCount: number): Promise<amqp.ChannelModel> {
    let attempt = 0;
    while (attempt < retryCount) {
      try {
        const channelModel = await amqp.connect(url);
        this.logger.log("Quantification-producer successfully connected to the RabbitMQ broker.");
        return channelModel;
      } catch {
        attempt++;
        this.logger.error(
          `Attempt ${String(
            attempt,
          )}: Failed to connect to RabbitMQ broker from quantification-producer side. Retrying in 10 seconds...`,
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
      console.log("Producer is connecting to the broker");
      const url = this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_RABBITMQ_URL);
      this.channelModel = await this.connectWithRetry(url, 3);
      this.channel = await this.channelModel.createChannel();

      console.log("Producer is initializing the queues");
      await this.setupQueuesAndExchanges();
      this.logger.log("ProducerService initialized and ready to send messages.");
    } catch (error) {
      this.logger.error("Failed to initialize ProducerService:", error);
    }
  }

  private async setupQueuesAndExchanges(): Promise<void> {
    // check for channel
    if (!this.channel) {
      this.logger.error("Channel is not available. Cannot set up queues and exchanges.");
      return;
    }
    // set up dead letter exchange and queue
    const quantJobDeadLetterQ = this.configSvc.getOrThrow<string>(EnvVarKeys.QUANT_JOB_DEAD_LETTER_QUEUE);
    const quantJobDeadLetterX = this.configSvc.getOrThrow<string>(EnvVarKeys.QUANT_JOB_DEAD_LETTER_EXCHANGE);
    const isquantJobDeadLetterQDurable = Boolean(
      this.configSvc.getOrThrow<boolean>(EnvVarKeys.QUANT_JOB_DEAD_LETTER_QUEUE_DURABLE),
    );
    await this.channel.assertExchange(quantJobDeadLetterX, "direct", { durable: isquantJobDeadLetterQDurable });
    await this.channel.assertQueue(quantJobDeadLetterQ, { durable: isquantJobDeadLetterQDurable });
    await this.channel.bindQueue(quantJobDeadLetterQ, quantJobDeadLetterX, "");

    // setup quantification job queue
    const quantJobQ = this.configSvc.getOrThrow<string>(EnvVarKeys.QUANT_JOB_QUEUE);
    const jobTtl = Number(this.configSvc.getOrThrow<number>(EnvVarKeys.QUANT_JOB_MSG_TTL));
    const isJobQDurable = Boolean(this.configSvc.getOrThrow<boolean>(EnvVarKeys.QUANT_JOB_QUEUE_DURABLE));
    const jobQMaxLength = Number(this.configSvc.getOrThrow<number>(EnvVarKeys.QUANT_JOB_QUEUE_MAXLENGTH));
    await this.channel.assertQueue(quantJobQ, {
      durable: isJobQDurable,
      deadLetterExchange: quantJobDeadLetterX,
      messageTtl: jobTtl,
      maxLength: jobQMaxLength,
    });
  }

  public createAndQueueQuant(quantRequest: QuantifyRequest): void {
    try {
      // check for channel
      if (!this.channel) {
        this.logger.error("Channel is not available. Cannot send message.");
        return;
      }

      console.log("Producer gets the request body from the Quantification controller");
      const modelsData = typia.json.assertStringify<QuantifyRequest>(quantRequest);

      const quantJobQ = this.configSvc.getOrThrow<string>(EnvVarKeys.QUANT_JOB_QUEUE);
      console.log("Producer is queueing the quantification job");
      this.channel.sendToQueue(quantJobQ, Buffer.from(modelsData), {
        persistent: true,
      });
      console.log("Producer has queued the quantification job");
    } catch (error) {
      // Handle specific TypeGuardError for validation issues, logging the detailed path and expected type.
      // Log a generic error message for any other types of errors encountered during the process.
      if (error instanceof TypeGuardError) {
        this.logger.error(error);
      } else {
        this.logger.error(error);
      }
    }
  }
}
