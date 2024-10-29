import { execSync, ExecSyncOptionsWithStringEncoding } from "node:child_process";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import typia, { TypeGuardError } from "typia";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { ExecutionResult } from "shared-types/src/openpra-mef/util/execution-result";
import { EnvVarKeys } from "../../../config/env_vars.config";

/**
 * Service for executing tasks received from the initial executable task queue.
 * This service connects to RabbitMQ, consumes tasks, executes them,
 * and sends the results to a specified storage queue.
 */
@Injectable()
export class ExecutableWorkerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExecutableWorkerService.name);

  /**
   * Establishes a connection to the RabbitMQ broker with retry logic.
   *
   * @param url - The RabbitMQ broker URL.
   * @param retryCount - The number of retry attempts if the connection fails.
   * @returns A promise that resolves to the established RabbitMQ connection.
   * @throws {@link Error} An error if the connection fails after the specified number of attempts.
   */
  private async connectWithRetry(url: string, retryCount: number): Promise<amqp.Connection> {
    let attempt = 0;
    while (attempt < retryCount) {
      try {
        const connection = await amqp.connect(url);
        this.logger.log("Executable-task-worker successfully connected to the RabbitMQ broker.");
        return connection;
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
    // Load all the environment variables required for RabbitMQ and task execution.
    const url: string = EnvVarKeys.RABBITMQ_URL;
    const initialJobQ: string = EnvVarKeys.EXECUTABLE_TASK_QUEUE_NAME;
    const storageQ: string = EnvVarKeys.EXECUTABLE_STORAGE_QUEUE_NAME;
    const deadLetterQ: string = EnvVarKeys.DEAD_LETTER_QUEUE_NAME;
    const deadLetterX: string = EnvVarKeys.DEAD_LETTER_EXCHANGE_NAME;

    // Connect to the RabbitMQ server, create a channel, and connect the
    // workers to the initial queue to consume jobs.
    const connection = await this.connectWithRetry(url, 3);
    const channel = await connection.createChannel();

    // Set up the dead letter exchange and queue for handling failed messages.
    await channel.assertExchange(deadLetterX, "direct", { durable: true });
    await channel.assertQueue(deadLetterQ, { durable: true });
    await channel.bindQueue(deadLetterQ, deadLetterX, "");

    // Assert the existence of the main executable task queue.
    // This queue is durable, has a dead letter exchange, a time-to-live duration of 60 seconds,
    // and a maximum length of 10,000 messages.
    await channel.assertQueue(initialJobQ, {
      durable: true,
      deadLetterExchange: deadLetterX,
      messageTtl: 60000,
      maxLength: 10000,
    });

    // Start consuming jobs from the initial queue.
    await channel.consume(
      initialJobQ,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (msg: ConsumeMessage | null) => {
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
          const taskResult = typia.json.assertStringify<ExecutionResult>(result);

          // Assert and configure a durable queue with dead-letter exchange, message TTL, and max length.
          await channel.assertQueue(storageQ, {
            durable: true,
            deadLetterExchange: deadLetterX,
            messageTtl: 60000,
            maxLength: 10000,
          });

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
  public executeCommand(task: ExecutionTask): ExecutionResult {
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
        task,
        exit_code: 0,
        stderr: "",
        stdout,
      };
    } catch (error) {
      // Handle errors that occur during command execution.
      const execError = error as Error & { status?: number; stderr?: Buffer; stdout?: Buffer };
      this.logger.error(execError);

      return {
        task,
        exit_code: execError.status ? execError.status : 1,
        stderr: execError.stderr?.toString() ?? "",
        stdout: execError.stdout?.toString() ?? "",
      };
    }
  }
}
