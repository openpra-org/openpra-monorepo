import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import { QuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";
import { JOB_BROKER_KEY_DEFAULTS, JobBrokerKeys } from "../../job-broker.keys";

@Injectable()
export class StorageService implements OnApplicationBootstrap {
  constructor(private configService: ConfigService) {}

  public async onApplicationBootstrap(): Promise<void> {
    // Load all the environment variables
    const url = this.configService.get<string>(
      JobBrokerKeys.RABBITMQ_URL,
      JOB_BROKER_KEY_DEFAULTS[JobBrokerKeys.RABBITMQ_URL],
    );
    const completedQ = this.configService.get<string>(
      JobBrokerKeys.COMPLETED_JOB_QUEUE,
      JOB_BROKER_KEY_DEFAULTS[JobBrokerKeys.COMPLETED_JOB_QUEUE],
    );

    // Connect to the RabbitMQ server, create a channel, and connect to
    // the completed job queue to collect the quantification results
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(completedQ, { durable: true });

    // Perform some sort of action on the results (e.g., store them in the database etc.)
    // After that, send each result back to their respective local dispatch queues
    await channel.consume(
      completedQ,
      (msg: ConsumeMessage | null) => {
        // Check if the message is not null
        if (msg !== null) {
          const decodedResult: QuantifyReport = JSON.parse(msg.content.toString()) as QuantifyReport;

          // Retrieve the dispatch queue name and correlation ID
          const dispatchQ = String(msg.properties.replyTo);
          const corrId = String(msg.properties.correlationId);

          // Send the result back to its local dispatch queue
          const quantifiedResult = JSON.stringify(decodedResult);
          void channel.assertQueue(dispatchQ, { durable: false });
          channel.sendToQueue(dispatchQ, Buffer.from(quantifiedResult), {
            correlationId: corrId,
          });

          // Finally, acknowledge the message
          channel.ack(msg);
        } else {
          // Handle the case where no message was available
          console.error("No message was received.", msg);
        }
      },
      {
        noAck: false,
      },
    );
  }
}
