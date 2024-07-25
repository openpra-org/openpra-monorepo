import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { JOB_BROKER_KEY_DEFAULTS, JobBrokerKeys } from "../../job-broker.keys";

@Injectable()
export class ProducerService {
  constructor(private configService: ConfigService) {}

  async createQuantifyJobQueue(modelsWithConfigs: QuantifyRequest) {
    // Load all the environment variables
    const url = this.configService.get<string>(
      JobBrokerKeys.RABBITMQ_URL,
      JOB_BROKER_KEY_DEFAULTS[JobBrokerKeys.RABBITMQ_URL],
    );
    const initialJobQ = this.configService.get<string>(
      JobBrokerKeys.INITIAL_JOB_QUEUE,
      JOB_BROKER_KEY_DEFAULTS[JobBrokerKeys.INITIAL_JOB_QUEUE],
    );
    const dispatchQ = this.configService.get<string>(
      JobBrokerKeys.DISPATCH_QUEUE,
      JOB_BROKER_KEY_DEFAULTS[JobBrokerKeys.DISPATCH_QUEUE],
    );
    const corrID = this.configService.get<string>(
      JobBrokerKeys.DISPATCH_QUEUE_CORRELATION_ID,
      JOB_BROKER_KEY_DEFAULTS[JobBrokerKeys.DISPATCH_QUEUE_CORRELATION_ID],
    );

    // Connect to the RabbitMQ server, create a channel, and initiate
    // the primary job queue
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(initialJobQ, { durable: true });

    // Send the request to the initial job queue and attach the
    // local dispatch queue name and correlation ID with it
    const modelsData = JSON.stringify(modelsWithConfigs);
    channel.sendToQueue(initialJobQ, Buffer.from(modelsData), {
      persistent: true,
      correlationId: corrID,
      replyTo: dispatchQ,
    });
  }
}
