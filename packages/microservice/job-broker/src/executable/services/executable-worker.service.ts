import { execSync, ExecSyncOptionsWithStringEncoding } from "node:child_process";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import typia, { TypeGuardError } from "typia";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { ExecutionResult } from "shared-types/src/openpra-mef/util/execution-result";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ConfigService } from "@nestjs/config";
import { ExecutableJobReport } from "../../middleware/schemas/executable-job.schema";
import { EnvVarKeys } from "../../../config/env_vars.config";

/**
 * Service for executing tasks received from the initial executable task queue.
 * This service connects to RabbitMQ, consumes tasks, executes them,
 * and sends the results to a specified storage queue.
 */
@Injectable()
export class ExecutableWorkerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExecutableWorkerService.name);
  constructor(private readonly configSvc: ConfigService) {}

  /**
   * Establishes a connection to the RabbitMQ broker with retry logic.
   *
   * @param url - The RabbitMQ broker URL.
   * @param retryCount - The number of retry attempts if the connection fails.
   * @returns A promise that resolves to the established RabbitMQ connection.
   * @throws {@link Error} An error if the connection fails after the specified number of attempts.
   */
  private async connectWithRetry(url: string, retryCount: number): Promise<amqp.ChannelModel> {
    let attempt = 0;
    while (attempt < retryCount) {
      try {
        const channelModel = await amqp.connect(url);
        this.logger.log("Executable-task-worker successfully connected to the RabbitMQ broker.");
        return channelModel;
      } catch {
        attempt++;
        this.logger.error(
          `Attempt ${String(
            attempt,
          )}: Failed to connect to RabbitMQ broker from executable-task-worker side. Retrying in 10 seconds...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
    throw new Error(
      "Failed to connect to the RabbitMQ broker after several attempts from executable-task-worker side.",
    );
  }

  /**
   * This method is automatically called when the application is bootstrapped and
   * sets up the RabbitMQ connection and starts consuming executable tasks.
   */
  public async onApplicationBootstrap(): Promise<void> {
    // Connect to the RabbitMQ server, create a channel, and connect the
    // workers to the initial queue to consume jobs.
    const url = this.configSvc.getOrThrow<string>(EnvVarKeys.ENV_RABBITMQ_URL);
    const channelModel = await this.connectWithRetry(url, 3);
    const channel = await channelModel.createChannel();

    // ensure exec task queue is operational
    const taskQ = this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_QUEUE);
    {
      // set up dead letter exchange and queue
      const execTaskDeadLetterQ = this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_DEAD_LETTER_QUEUE);
      const execTaskDeadLetterX = this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_TASK_DEAD_LETTER_EXCHANGE);
      const execTaskDeadLetterDurable = Boolean(
        this.configSvc.getOrThrow<boolean>(EnvVarKeys.EXEC_TASK_DEAD_LETTER_QUEUE_DURABLE),
      );
      await channel.assertExchange(execTaskDeadLetterX, "direct", { durable: execTaskDeadLetterDurable });
      await channel.assertQueue(execTaskDeadLetterQ, { durable: execTaskDeadLetterDurable });
      await channel.bindQueue(execTaskDeadLetterQ, execTaskDeadLetterX, "");
      // setup exec task queue
      const taskTtl = Number(this.configSvc.getOrThrow<number>(EnvVarKeys.EXEC_TASK_MSG_TTL));
      const taskQDurable = Boolean(this.configSvc.getOrThrow<boolean>(EnvVarKeys.EXEC_TASK_QUEUE_DURABLE));
      const taskQMaxLength = Number(this.configSvc.getOrThrow<number>(EnvVarKeys.EXEC_TASK_QUEUE_MAXLENGTH));
      await channel.assertQueue(taskQ, {
        durable: taskQDurable,
        deadLetterExchange: execTaskDeadLetterX,
        messageTtl: taskTtl,
        maxLength: taskQMaxLength,
      });
    }

    // ensure task storage queue is operational
    const storageQ = this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_STORAGE_QUEUE);
    {
      const execStorageDeadLetterQ = this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_STORAGE_DEAD_LETTER_QUEUE);
      const execStorageDeadLetterX = this.configSvc.getOrThrow<string>(EnvVarKeys.EXEC_STORAGE_DEAD_LETTER_EXCHANGE);
      const execStorageDeadLetterDurable = Boolean(
        this.configSvc.getOrThrow<boolean>(EnvVarKeys.EXEC_STORAGE_DEAD_LETTER_QUEUE_DURABLE),
      );
      // Assert the existence of a dead letter exchange (DLX) for routing failed messages.
      await channel.assertExchange(execStorageDeadLetterX, "direct", { durable: execStorageDeadLetterDurable });
      // Assert the existence of a dead letter queue (DLQ) to hold messages that fail processing.
      await channel.assertQueue(execStorageDeadLetterQ, { durable: execStorageDeadLetterDurable });
      // Bind the dead letter queue to the dead letter exchange.
      await channel.bindQueue(execStorageDeadLetterQ, execStorageDeadLetterX, "");

      const storageTtl = Number(this.configSvc.getOrThrow<number>(EnvVarKeys.EXEC_STORAGE_MSG_TTL));
      const storageQDurable = Boolean(this.configSvc.getOrThrow<boolean>(EnvVarKeys.EXEC_STORAGE_QUEUE_DURABLE));
      const storageQMaxLength = Number(this.configSvc.getOrThrow<number>(EnvVarKeys.EXEC_STORAGE_QUEUE_MAXLENGTH));
      // Assert and configure a durable queue with dead-letter exchange, message TTL, and max length.
      await channel.assertQueue(storageQ, {
        durable: storageQDurable,
        deadLetterExchange: execStorageDeadLetterX,
        messageTtl: storageTtl,
        maxLength: storageQMaxLength,
      });
    }

    // next, fetch some exec tasks from queue
    const taskPrefetch = Number(this.configSvc.getOrThrow<number>(EnvVarKeys.EXEC_TASK_MSG_PREFETCH));
    await channel.prefetch(taskPrefetch);

    // Start consuming jobs from the initial queue.
    await channel.consume(
      taskQ,
      (msg: ConsumeMessage | null) => {
        // Check if the consumed message is null, indicating an error in message retrieval.
        if (msg === null) {
          this.logger.error("Executable worker service is unable to parse the consumed message.");
          return;
        }

        try {
          // Convert the message content into a JSON object representing the executable task.
          const taskData: ExecutionTask = typia.json.assertParse<ExecutionTask>(msg.content.toString());

          // Execute the task and get the result.
          const result = this.executeCommand(taskData);
          result._id = taskData._id;
          const taskResult = typia.json.assertStringify<ExecutionResult>(result);

          // Send the executed task results to the storage queue.
          channel.sendToQueue(storageQ, Buffer.from(taskResult), {
            persistent: true,
          });

          // Acknowledge the message back to the initial queue to indicate successful processing.
          channel.ack(msg);
        } catch (error) {
          // Handle validation errors specifically, logging the path and expected vs actual values.
          if (error instanceof TypeGuardError) {
            this.logger.error(error);
            channel.nack(msg, false, false);
          } else {
            // Log a generic error message for other types of errors.
            this.logger.error(error);
            channel.nack(msg, false, false);
          }
        }
      },
      {
        // Since we are manually acknowledging the message, turn auto acknowledging off.
        noAck: false,
      },
    );
  }

  /**
   * Executes a shell command based on the provided task data.
   *
   * @param task - The task containing the command and its arguments to be executed.
   * @returns The result of the execution, including exit code, stdout, and stderr.
   */
  private executeCommand(task: ExecutionTask): ExecutionResult {
    try {
      // Construct the command to be executed, including the provided arguments.
      const command = `${task.executable} ${task.arguments?.join(" ") ?? ""}`;
      const options: ExecSyncOptionsWithStringEncoding = {
        // Set the environment variables for the command execution.
        env: task.env_vars
          ? (Object.fromEntries(task.env_vars.map((envVar) => envVar.split("="))) as NodeJS.ProcessEnv)
          : process.env,
        stdio: "pipe",
        shell: task.tty ? "/bin/bash" : undefined,
        encoding: "utf-8",
      };

      // Execute the command and capture the standard output.
      const stdout = execSync(command, options).toString();

      // Return the execution result with a successful exit code.
      return {
        exit_code: 0,
        stderr: "",
        stdout,
      };
    } catch (error) {
      // Handle errors that occur during command execution.
      const execError = error as Error & { status?: number; stderr?: Buffer; stdout?: Buffer };
      this.logger.error(execError);

      return {
        exit_code: execError.status ? execError.status : 1,
        stderr: execError.stderr?.toString() ?? "",
        stdout: execError.stdout?.toString() ?? "",
      };
    }
  }
}
