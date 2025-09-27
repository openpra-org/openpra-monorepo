import { execSync, ExecSyncOptionsWithStringEncoding } from "node:child_process";
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Channel, Connection, ConsumeMessage } from "amqplib";
import typia from "typia";
import { ExecutionTask } from "shared-types/src/openpra-mef/util/execution-task";
import { ExecutionResult } from "shared-types/src/openpra-mef/util/execution-result";
import { RpcException } from "@nestjs/microservices";
import { QueueService, QueueConfig, QueueConfigFactory, RabbitMQConnectionService } from "../../shared";
import { ExecutableJobReport } from "../../middleware/schemas/executable-job.schema";

@Injectable()
export class ExecutableWorkerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ExecutableWorkerService.name);
  private readonly queueConfig: QueueConfig;
  private connection: Connection | null = null;
  private channel: Channel | null = null;

  constructor(
    @InjectModel(ExecutableJobReport.name) private readonly executableJobModel: Model<ExecutableJobReport>,
    private readonly queueService: QueueService,
    private readonly rabbitmqService: RabbitMQConnectionService,
    private readonly queueConfigFactory: QueueConfigFactory,
  ) {
    this.queueConfig = this.queueConfigFactory.createExecTaskQueueConfig();
  }

  /**
   * Initialize the service when the application bootstraps
   */
  async onApplicationBootstrap(): Promise<void> {
    this.logger.debug("Connecting to the broker");
    this.connection = await this.rabbitmqService.getConnection(ExecutableWorkerService.name);
    this.channel = await this.rabbitmqService.getChannel(this.connection, ExecutableWorkerService.name);
    await this.queueService.setupQueue(this.queueConfig, this.channel);
    this.logger.debug("Initialized and consuming messages");
    await this.consumeExecutableTasks();
  }

  /**
   * Start consuming tasks from the queue
   */
  private async consumeExecutableTasks(): Promise<void> {
    try {
      await this.channel?.checkQueue(this.queueConfig.name);
    } catch (err) {
      throw new RpcException(`Queue: ${this.queueConfig.name} does not exist.`);
    }

    await this.channel?.consume(
      this.queueConfig.name,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (msg: ConsumeMessage | null) => {
        if (msg === null) {
          throw new RpcException(
            `${ExecutableWorkerService.name} consumed a null message from ${this.queueConfig.name} queue.`,
          );
        }

        const taskData = ((): ExecutionTask => {
          try {
            this.logger.debug("Gets the message body from the Executable queue");
            return typia.json.assertParse<ExecutionTask>(msg.content.toString());
          } catch (err) {
            this.channel?.nack(msg, false, false);
            throw new RpcException(
              `${ExecutableWorkerService.name} consumed an invalid message from ${this.queueConfig.name} queue.`,
            );
          }
        })();

        try {
          this.logger.debug(`Running Task: ${String(taskData._id)}`);
          await this.executableJobModel.findByIdAndUpdate(taskData._id, { $set: { status: "running" } });
          this.logger.debug("Changing the status to <running>");
        } catch (err) {
          throw new RpcException(`Failed to update <running> status of: TaskID ${String(taskData._id)}`);
        }

        const result = ((): ExecutionResult => {
          try {
            return this.executeCommand(taskData);
          } catch (err) {
            this.channel?.nack(msg, false, false);
            throw new RpcException(`Failed to execute: TaskID ${String(taskData._id)}`);
          }
        })();

        try {
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
        } catch (err) {
          throw new RpcException(`Failed to update <completed> status of: TaskID ${String(taskData._id)}`);
        }

        this.channel?.ack(msg);
        this.logger.debug(`Task: ${String(taskData._id)} executed successfully`);
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

    try {
      // Execute the command and capture the standard output.
      const stdout = execSync(command, options).toString();
      return {
        exit_code: 0,
        stderr: "",
        stdout: stdout,
      };
    } catch (err: any) {
      return {
        exit_code: err.status,
        stderr: err.stderr.toString(),
        stdout: "",
      };
    }
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.channel?.deleteQueue(this.queueConfig.name);
      await this.channel?.close();
      await this.connection?.close();
    } catch (err) {
      throw new RpcException(`${ExecutableWorkerService.name} failed to stop RabbitMQ services.`);
    }
  }
}
