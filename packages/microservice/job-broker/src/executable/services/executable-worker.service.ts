import { execSync, ExecSyncOptionsWithStringEncoding } from "node:child_process";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Channel, ConsumeMessage } from "amqplib";
import typia, { TypeGuardError } from "typia";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { ExecutionResult } from "shared-types/src/openpra-mef/util/execution-result";
import { QueueService, QueueConfig, QueueConfigFactory } from "../../shared";
import { ExecutableJobReport } from "../../middleware/schemas/executable-job.schema";

@Injectable()
export class ExecutableWorkerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExecutableWorkerService.name);
  private readonly taskQueueConfig: QueueConfig;
  private taskChannel: Channel | null = null;

  constructor(
    @InjectModel(ExecutableJobReport.name) private readonly executableJobModel: Model<ExecutableJobReport>,
    private readonly queueService: QueueService,
    private readonly queueConfigFactory: QueueConfigFactory,
  ) {
    this.taskQueueConfig = this.queueConfigFactory.createExecTaskQueueConfig();
  }

  /**
   * Initialize the service when the application bootstraps
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      this.logger.debug("Connecting to the broker");
      this.taskChannel = await this.queueService.setupQueue(ExecutableWorkerService.name, this.taskQueueConfig);
      await this.consumeExecutableTasks();
      this.logger.debug("Initialized and consuming messages");
    } catch (error) {
      this.logger.error("Failed to initialize:", error);
    }
  }

  /**
   * Start consuming tasks from the queue
   */
  private async consumeExecutableTasks(): Promise<void> {
    if (!this.taskChannel) {
      this.logger.error("Task channel is not available. Cannot start consuming.");
      return;
    }

    await this.taskChannel.consume(
      this.taskQueueConfig.name,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (msg: ConsumeMessage | null) => {
        if (msg === null) {
          this.logger.error("Unable to parse message from task queue");
          return;
        }

        try {
          // Parse the task data
          const taskData: ExecutionTask = typia.json.assertParse<ExecutionTask>(msg.content.toString());
          await this.executableJobModel.findByIdAndUpdate(taskData._id, { $set: { status: "running" } });

          // Execute the task and get the result
          const result = this.executeCommand(taskData);

          // Update the job report directly in the database
          await this.executableJobModel.findByIdAndUpdate(taskData._id, {
            $set: {
              status: "completed",
              exit_code: result.exit_code,
              stdout: result.stdout,
              stderr: result.stderr,
            },
          });
          this.logger.debug(`Task ${String(taskData._id)} execution result stored in database`);

          this.taskChannel?.ack(msg);
          this.logger.debug(`Task: ${String(taskData._id)} executed successfully`);
        } catch (error) {
          if (error instanceof TypeGuardError) {
            this.logger.error(error);
            this.taskChannel?.nack(msg, false, false);
          } else {
            this.logger.error(error);
            this.taskChannel?.nack(msg, false, false);
          }
        }
      },
      { noAck: false },
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
