import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import typia from "typia";
import { ExecutionTask, ExecutionResult } from "shared-types/src/openpra-mef/util/execution-task";

@Injectable()
export class ExecutableWorkerService implements OnApplicationBootstrap {
  constructor(private readonly configService: ConfigService) {}

  public async onApplicationBootstrap(): Promise<void> {
    // Load all the environment variables
    const url = this.configService.get<string>("RABBITMQ_URL");
    const initialJobQ = this.configService.get<string>("EXECUTABLE_TASK_QUEUE_NAME");
    const storageQ = this.configService.get<string>("EXECUTABLE_STORAGE_QUEUE_NAME");
    if (!url || !initialJobQ || !storageQ) {
      throw new Error("Required environment variables for executable worker service are not set");
    }

    // Connect to the RabbitMQ server, create a channel, and connect the
    // workers to the initial queue to consume jobs
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(initialJobQ, { durable: true });

    // Workers will be able to handle only one job at a time
    await channel.prefetch(1);

    // Consume the jobs from the initial queue
    await channel.consume(
      initialJobQ,
      (msg: ConsumeMessage | null) => {
        if (msg === null) {
          console.error("Unable to parse message", msg);
          return;
        }

        // Convert the inputs/data into a JSON object and process
        // the executable task using this JSON object
        const taskData: ExecutionTask = typia.json.assertParse<ExecutionTask>(msg.content.toString());

        // Instead of executing the task, an instance of executed task result will be created
        const result: ExecutionResult = {
          task: taskData,
          exit_code: 1,
          stderr: "No error",
          stdout: "Quantification Complete",
        };
        const taskResult = typia.json.assertStringify<ExecutionResult>(result);

        // Send the executed task results to the completed task queue
        void channel.assertQueue(storageQ, { durable: true });
        channel.sendToQueue(storageQ, Buffer.from(taskResult), {
          persistent: true,
        });

        // Finally acknowledge the message back to the initial queue
        // to let the broker know that the task has been executed
        channel.ack(msg);
      },
      {
        // Since we are manually acknowledging the message, turn auto acknowledging off
        noAck: false,
      },
    );
  }
}
