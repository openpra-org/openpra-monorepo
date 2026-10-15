import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import type { Channel, ChannelModel, ConsumeMessage } from "amqplib";
import { hostname } from "node:os";
import { isPraetorJobId } from "interfaces-shared-types/execution/praetor-job";
import { stringifyJson } from "interfaces-shared-types/json";
import { parseNativeResponse, type NativeStructuredError } from "praxis-node/protocol";
import { QueueConfigFactory, QueueService, RabbitMQChannelModelService, type QueueConfig } from "../../shared";
import { PraxisJobStore, type PraxisJobDoneRecord } from "../praxis-job-store";
import { PraxisWorkerError, runPraxisProcess } from "../workers/praxis-worker-runner";

const HEARTBEAT_MS = 10_000;

const TABLE_METHODS: ReadonlySet<string> = new Set(["BAYESIAN_NETWORK", "HYBRID_CAUSAL_LOGIC"]);

function plansBayesianTables(envelope: object): boolean {
  const request = "request" in envelope ? envelope.request : undefined;
  if (typeof request !== "object" || request === null) return true;
  const method = "methodType" in request ? request.methodType : undefined;
  if (typeof method !== "string" || TABLE_METHODS.has(method)) return true;
  return method === "EVENT_TREE" && "mode" in request && request.mode === "HYBRID_CAUSAL_LOGIC";
}

function positiveSetting(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function structured(code: string, message: string, details: Record<string, string | number | null>): NativeStructuredError {
  return { kind: "EXECUTION_ERROR", code, message, details };
}

@Injectable()
class PraxisJobConsumerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PraxisJobConsumerService.name);
  private readonly config: QueueConfig;
  private readonly cancelExchange: string;
  private readonly worker = `${hostname()}:${process.pid}`;
  private readonly slots = positiveSetting("PRAETOR_WORKER_SLOTS", 1);
  private readonly maxAttempts = positiveSetting("PRAETOR_JOB_MAX_ATTEMPTS", 2);
  private readonly running = new Map<string, AbortController>();
  private channelModel: ChannelModel | null = null;
  private channel: Channel | null = null;
  private consumerTag: string | null = null;

  constructor(
    private readonly queueService: QueueService,
    private readonly rabbitmq: RabbitMQChannelModelService,
    queueConfigFactory: QueueConfigFactory,
    private readonly store: PraxisJobStore,
  ) {
    this.config = queueConfigFactory.createPraxisJobQueueConfig();
    this.cancelExchange = queueConfigFactory.praxisCancelExchange();
  }

  async onApplicationBootstrap(): Promise<void> {
    this.channelModel = await this.rabbitmq.getChannelModel(PraxisJobConsumerService.name);
    const channel = await this.rabbitmq.getChannel(this.channelModel, PraxisJobConsumerService.name);
    this.channel = channel;
    channel.on("close", () => {
      this.logger.error(`${this.worker} lost its PRAXIS job channel; the broker redelivers unfinished jobs to another worker`);
      process.exitCode = 1;
      setTimeout(() => process.exit(1), 1_000).unref();
    });
    await this.queueService.setupQueue(this.config, channel);
    await channel.prefetch(this.slots);
    await channel.assertExchange(this.cancelExchange, "fanout", { durable: true });
    const cancels = await channel.assertQueue("", { exclusive: true, autoDelete: true });
    await channel.bindQueue(cancels.queue, this.cancelExchange, "");
    await channel.consume(
      cancels.queue,
      (message) => {
        if (message === null) return;
        try {
          const { jobId } = JSON.parse(message.content.toString()) as { jobId?: string };
          if (jobId !== undefined) this.running.get(jobId)?.abort();
        } catch (error) {
          this.logger.warn(`Ignored a malformed cancel message: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
      { noAck: true },
    );
    const consumed = await channel.consume(
      this.config.name,
      (message) => {
        if (message !== null) void this.handle(message);
      },
      { noAck: false },
    );
    this.consumerTag = consumed.consumerTag;
    this.logger.log(`${this.worker} takes PRAXIS jobs from ${this.config.name} with ${this.slots} slot(s)`);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.consumerTag !== null) await this.channel?.cancel(this.consumerTag).catch(() => undefined);
    this.running.forEach((controller) => controller.abort());
    await this.channel?.close().catch(() => undefined);
    await this.channelModel?.close().catch(() => undefined);
  }

  private async handle(message: ConsumeMessage): Promise<void> {
    let jobId: string | undefined;
    try {
      const parsed = JSON.parse(message.content.toString()) as { jobId?: string };
      jobId = parsed.jobId;
    } catch (error) {
      this.logger.error(`Dropped a malformed PRAXIS job message: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (jobId === undefined || !isPraetorJobId(jobId)) {
      this.channel?.nack(message, false, false);
      return;
    }
    try {
      await this.process(jobId);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      this.logger.error(`PRAXIS job ${jobId} could not be processed: ${text}`);
      await this.finish(jobId, "FAILED", structured("PRAETOR_WORKER_FAILURE", `The PRAETOR worker could not process this job: ${text}`, { worker: this.worker })).catch(
        (stored: Error) => this.logger.error(`PRAXIS job ${jobId} failure could not be stored: ${stored.message}`),
      );
    } finally {
      this.channel?.ack(message);
    }
  }

  private async finish(jobId: string, status: PraxisJobDoneRecord["status"], error: NativeStructuredError | null): Promise<void> {
    await this.store.putDone(jobId, { status, completedAt: new Date().toISOString(), worker: this.worker, error });
    this.logger.log(`${this.worker} ended PRAXIS job ${jobId} as ${status.toLowerCase()}${error === null ? "" : `: ${error.message}`}`);
  }

  private async process(jobId: string): Promise<void> {
    if ((await this.store.done(jobId)) !== undefined) return;
    if ((await this.store.cancel(jobId)) !== undefined) {
      await this.finish(jobId, "CANCELLED", null);
      return;
    }
    const previous = await this.store.running(jobId);
    const attempts = (previous?.attempts ?? 0) + 1;
    if (attempts > this.maxAttempts) {
      await this.finish(
        jobId,
        "FAILED",
        structured(
          "PRAETOR_WORKER_LOST",
          `PRAXIS stopped ${this.maxAttempts} times while running this job (last on ${previous?.worker ?? "an unknown worker"}). The model may need more memory than a worker has.`,
          { worker: previous?.worker ?? null, attempts: previous?.attempts ?? 0 },
        ),
      );
      return;
    }
    const input = await this.store.input(jobId);
    const requestJson = input === undefined ? undefined : stringifyJson(input.request);
    if (input === undefined || requestJson === undefined) {
      await this.finish(jobId, "FAILED", structured("PRAETOR_INPUT_MISSING", "The job input is missing from PRAETOR storage.", { worker: this.worker }));
      return;
    }
    const startedAt = new Date().toISOString();
    await this.store.putRunning(jobId, { worker: this.worker, startedAt, heartbeatAt: startedAt, attempts });
    this.logger.log(`${this.worker} started PRAXIS job ${jobId} (${input.operation}, attempt ${attempts})`);
    const heartbeat = setInterval(() => {
      void this.store
        .putRunning(jobId, { worker: this.worker, startedAt, heartbeatAt: new Date().toISOString(), attempts })
        .catch((error: Error) => this.logger.warn(`Heartbeat for ${jobId} failed: ${error.message}`));
    }, HEARTBEAT_MS);
    const controller = new AbortController();
    this.running.set(jobId, controller);
    try {
      const { resultJson } = await runPraxisProcess(
        { operation: input.operation, requestJson, preflight: plansBayesianTables(input.request) },
        { timeoutMs: input.timeoutMs, signal: controller.signal },
      );
      let failure: NativeStructuredError | null;
      try {
        failure = parseNativeResponse(JSON.parse(resultJson)).error ?? null;
      } catch (error) {
        await this.finish(jobId, "FAILED", structured("PRAXIS_INVALID_RESPONSE", `PRAXIS returned an invalid response: ${error instanceof Error ? error.message : String(error)}`, { worker: this.worker }));
        return;
      }
      await this.store.putOutput(jobId, resultJson);
      await this.finish(jobId, failure === null ? "SUCCEEDED" : "FAILED", failure);
    } catch (error) {
      const code = error instanceof PraxisWorkerError ? error.code : "PRAXIS_WORKER_FAILURE";
      const text = error instanceof Error ? error.message : String(error);
      if (code === "PRAXIS_CANCELLED") {
        await this.finish(jobId, "CANCELLED", null);
        return;
      }
      await this.finish(jobId, "FAILED", structured(code, text, { worker: this.worker, attempts }));
    } finally {
      clearInterval(heartbeat);
      this.running.delete(jobId);
    }
  }
}

export { PraxisJobConsumerService };
