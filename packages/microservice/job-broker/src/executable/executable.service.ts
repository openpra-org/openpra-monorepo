import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import typia from "typia";
import * as amqp from "amqplib";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";

import { JOB_BROKER_KEY_DEFAULTS, JobBrokerKeys } from "../job-broker.keys";

@Injectable()
export class ExecutableService {
  constructor(private configService: ConfigService) {}

  async createAndQueueTask(task: ExecutionTask): Promise<boolean> {
    // Load all the environment variables
    const url = this.configService.get<string>(
      JobBrokerKeys.RABBITMQ_URL,
      JOB_BROKER_KEY_DEFAULTS[JobBrokerKeys.RABBITMQ_URL],
    );

    const queue = "execution_task_queue";

    // Connect to the RabbitMQ server, create a channel, and initiate
    // the primary job queue
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(queue, { durable: true });

    // Send the request to the initial job queue and attach the
    // local dispatch queue name and correlation ID with it
    const taskData = typia.json.assertStringify<ExecutionTask>(task);

    return channel.sendToQueue(queue, Buffer.from(taskData), {
      persistent: true,
    });
  }
}
