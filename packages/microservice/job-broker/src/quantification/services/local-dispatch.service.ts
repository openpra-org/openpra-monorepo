import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import { QuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";
import { JOB_BROKER_KEY_DEFAULTS, JobBrokerKeys } from "../../job-broker.keys";

@Injectable()
export class LocalDispatchService implements OnApplicationBootstrap {
  constructor(private configService: ConfigService) {}

  public async onApplicationBootstrap(): Promise<void> {
    const url = this.configService.get<string>(
      JobBrokerKeys.RABBITMQ_URL,
      JOB_BROKER_KEY_DEFAULTS[JobBrokerKeys.RABBITMQ_URL],
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
    // the local dispatch queue
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(dispatchQ, { durable: false });

    // Verify the correlation ID
    // If the ID matches then retrieve the quantification result
    await channel.consume(
      dispatchQ,
      (msg: ConsumeMessage | null) => {
        if (msg === null) {
          // Handle the case where no message was available
          console.error("No message was received.", msg);
          return;
        }
        if (msg.properties.correlationId === corrID) {
          const decodedResult: QuantifyReport = JSON.parse(msg.content.toString()) as QuantifyReport;
          console.log(decodedResult);
          void connection.close();
        }
      },
      {
        noAck: true,
      },
    );
  }
}
