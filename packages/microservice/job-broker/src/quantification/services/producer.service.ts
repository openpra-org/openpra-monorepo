import { Injectable, UseFilters } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RpcException } from "@nestjs/microservices";
import * as amqp from "amqplib";
import typia from "typia";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { RmqExceptionFilter } from "../../exception-filters/rmq-exception.filter";

@Injectable()
export class ProducerService {
  constructor(private readonly configService: ConfigService) {}

  @UseFilters(new RmqExceptionFilter())
  public async createAndQueueQuant(modelsWithConfigs: QuantifyRequest): Promise<boolean> {
    // Load all the environment variables
    const url = this.configService.get<string>("RABBITMQ_URL");
    const initialJobQ = this.configService.get<string>("QUANT_JOB_QUEUE_NAME");
    if (!url || !initialJobQ) {
      throw new RpcException("Required environment variables for quantification producer service are not set");
    }

    // Connect to the RabbitMQ server, create a channel, and initiate
    // quantification job queue
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(initialJobQ, { durable: true });

    // Send the quantification request to the initial queue
    const modelsData = typia.json.assertStringify<QuantifyRequest>(modelsWithConfigs);
    return channel.sendToQueue(initialJobQ, Buffer.from(modelsData), {
      persistent: true,
    });
  }
}
