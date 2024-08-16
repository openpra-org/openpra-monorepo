import { execSync, ExecSyncOptionsWithStringEncoding } from "node:child_process";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import typia, { TypeGuardError } from "typia";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { ExecutionResult } from "shared-types/src/openpra-mef/util/execution-result";

@Injectable()
export class ExecutableWorkerService implements OnApplicationBootstrap {
  constructor(private readonly configService: ConfigService) {}

  private async connectWithRetry(url: string, retryCount: number): Promise<amqp.Connection> {
    let attempt = 0;
    while (attempt < retryCount) {
      try {
        const connection = await amqp.connect(url);
        Logger.log("Executable-task-worker successfully connected to the RabbitMQ broker.");
        return connection;
      } catch {
        attempt++;
        Logger.error(
          `Attempt ${attempt}: Failed to connect to RabbitMQ broker from executable-task-worker side. Retrying in 10 seconds...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
    throw new Error(
      "Failed to connect to the RabbitMQ broker after several attempts from executable-task-worker side.",
    );
  }

  public async onApplicationBootstrap(): Promise<void> {
    // Load all the environment variables
    const url = this.configService.get<string>("RABBITMQ_URL");
    const initialJobQ = this.configService.get<string>("EXECUTABLE_TASK_QUEUE_NAME");
    const storageQ = this.configService.get<string>("EXECUTABLE_STORAGE_QUEUE_NAME");
    const deadLetterQ = this.configService.get<string>("DEAD_LETTER_QUEUE_NAME");
    const deadLetterX = this.configService.get<string>("DEAD_LETTER_EXCHANGE_NAME");
    if (!url || !initialJobQ || !storageQ || !deadLetterQ || !deadLetterX) {
      Logger.error("Required environment variables for executable worker service are not set");
      return;
    }

    // Connect to the RabbitMQ server, create a channel, and connect the
    // workers to the initial queue to consume jobs
    const connection = await this.connectWithRetry(url, 3);
    const channel = await connection.createChannel();
    await channel.assertQueue(initialJobQ, { durable: true });

    // Consume the jobs from the initial queue
    await channel.consume(
      initialJobQ,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (msg: ConsumeMessage | null) => {
        if (msg === null) {
          Logger.error("Executable worker service is unable to parse the consumed message.");
          return;
        }

        try {
          // Convert the inputs/data into a JSON object and process
          // the executable task using this JSON object
          const taskData: ExecutionTask = typia.json.assertParse<ExecutionTask>(msg.content.toString());

          // Execute the task and get the result
          const result = this.executeCommand(taskData);
          const taskResult = typia.json.assertStringify<ExecutionResult>(result);

          // Send the executed task results to the completed task queue
          await channel.assertExchange(deadLetterX, "direct", { durable: true });
          await channel.assertQueue(deadLetterQ, { durable: true });
          await channel.bindQueue(deadLetterQ, deadLetterX, "");
          await channel.assertQueue(storageQ, {
            durable: true,
            deadLetterExchange: deadLetterX,
            messageTtl: 60000,
            maxLength: 10000,
          });
          channel.sendToQueue(storageQ, Buffer.from(taskResult), {
            persistent: true,
          });

          // Finally acknowledge the message back to the initial queue
          // to let the broker know that the task has been executed
          channel.ack(msg);
        } catch (error) {
          if (error instanceof TypeGuardError) {
            Logger.error(
              `Validation failed: ${error.path} is invalid. Expected ${error.expected} but got ${error.value}`,
            );
            channel.nack(msg, false, false);
          } else {
            Logger.error("Something went wrong in the executable worker service.");
            channel.nack(msg, false, false);
          }
        }
      },
      {
        // Since we are manually acknowledging the message, turn auto acknowledging off
        noAck: false,
      },
    );
  }

  // Method to execute a shell command
  private executeCommand(task: ExecutionTask): ExecutionResult {
    try {
      const command = `${task.executable} ${task.arguments?.join(" ") ?? ""}`;
      const options: ExecSyncOptionsWithStringEncoding = {
        env: task.env_vars
          ? (Object.fromEntries(task.env_vars.map((envVar) => envVar.split("="))) as NodeJS.ProcessEnv)
          : process.env,
        stdio: "pipe",
        shell: task.tty ? "/bin/bash" : undefined,
        encoding: "utf-8",
      };

      const stdout = execSync(command, options).toString();

      return {
        task,
        exit_code: 0,
        stderr: "",
        stdout,
      };
    } catch (error) {
      if (error instanceof Error && "status" in error) {
        const execError = error as Error & { status?: number; stderr?: Buffer; stdout?: Buffer };
        // TODO: Implement proper exit code and error message.
        return {
          task,
          exit_code: execError.status ? execError.status : 1,
          stderr: execError.stderr?.toString() ?? "",
          stdout: execError.stdout?.toString() ?? "",
        };
      }

      return {
        task,
        exit_code: 1,
        stderr: error instanceof Error ? error.message : "",
        stdout: "",
      };
    }
  }
}
