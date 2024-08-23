import { execSync, ExecSyncOptionsWithStringEncoding } from "node:child_process";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import typia, { TypeGuardError } from "typia";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { ExecutionResult } from "shared-types/src/openpra-mef/util/execution-result";

/**
 * Service for executing tasks received from the initial executable task queue.
 * This service connects to RabbitMQ, consumes tasks, executes them,
 * and sends the results to a specified storage queue.
 */
@Injectable()
export class ExecutableWorkerService implements OnApplicationBootstrap {
  constructor(private readonly configService: ConfigService) {}

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

  /**
   * This method is automatically called when the application is bootstrapped and
   * sets up the RabbitMQ connection and starts consuming executable tasks.
   */
  public async onApplicationBootstrap(): Promise<void> {
    // Load all the environment variables required for RabbitMQ and task execution.
    const url = this.configService.get<string>("RABBITMQ_URL");
    const initialJobQ = this.configService.get<string>("EXECUTABLE_TASK_QUEUE_NAME");
    const storageQ = this.configService.get<string>("EXECUTABLE_STORAGE_QUEUE_NAME");
    const deadLetterQ = this.configService.get<string>("DEAD_LETTER_QUEUE_NAME");
    const deadLetterX = this.configService.get<string>("DEAD_LETTER_EXCHANGE_NAME");

    // Check if all required environment variables are found. Log an error and exit if that is not the case.
    if (!url || !initialJobQ || !storageQ || !deadLetterQ || !deadLetterX) {
      Logger.error("Required environment variables for executable worker service are not set");
      return;
    }

    // Connect to the RabbitMQ server, create a channel, and connect the
    // workers to the initial queue to consume jobs.
    const connection = await this.connectWithRetry(url, 3);
    const channel = await connection.createChannel();
    await channel.assertQueue(initialJobQ, { durable: true });

    // Start consuming jobs from the initial queue.
    await channel.consume(
      initialJobQ,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (msg: ConsumeMessage | null) => {
        // Check if the consumed message is null, indicating an error in message retrieval.
        if (msg === null) {
          Logger.error("Executable worker service is unable to parse the consumed message.");
          return;
        }

        try {
          // Convert the message content into a JSON object representing the executable task.
          const taskData: ExecutionTask = typia.json.assertParse<ExecutionTask>(msg.content.toString());

          // Execute the task and get the result.
          const result = this.executeCommand(taskData);
          const taskResult = typia.json.assertStringify<ExecutionResult>(result);

          // Set up the dead letter exchange and queue for handling failed messages.
          await channel.assertExchange(deadLetterX, "direct", { durable: true });
          await channel.assertQueue(deadLetterQ, { durable: true });
          await channel.bindQueue(deadLetterQ, deadLetterX, "");
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
            Logger.error(
              `Validation failed: ${error.path} is invalid. Expected ${error.expected} but got ${error.value}`,
            );
            channel.nack(msg, false, false);
          } else {
            // Log a generic error message for other types of errors.
            Logger.error("Something went wrong in the executable worker service.");
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
        task,
        exit_code: 0,
        stderr: "",
        stdout,
      };
    } catch (error) {
      // Handle errors that occur during command execution.
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

      // Return a generic error result if the error does not have an exit code.
      return {
        task,
        exit_code: 1,
        stderr: error instanceof Error ? error.message : "",
        stdout: "",
      };
    }
  }
}