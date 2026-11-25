import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { PraxisJobStore } from "../src/execution/praxis-job-store";
import { PraxisJobConsumerService } from "../src/execution/services/praxis-job-consumer.service";
import { PraxisJobsService } from "../src/execution/services/praxis-jobs.service";
import { MinioService, QueueConfigFactory, QueueService, RabbitMQChannelModelService } from "../src/shared";
import { FakeBroker, FakeRabbitMQ } from "./fake-broker";
import { FakeMinio } from "./fake-minio";

class FakeConfig {
  constructor(private readonly values: Record<string, string> = {}) {}

  get(key: string): string | undefined {
    return this.values[key];
  }

  getOrThrow(key: string): string {
    const value = this.values[key];
    if (value === undefined) throw new Error(`Configuration key "${key}" does not exist`);
    return value;
  }
}

interface PraxisManagerSide {
  module: TestingModule;
  jobs: PraxisJobsService;
  store: PraxisJobStore;
  rabbit: FakeRabbitMQ;
}

interface PraxisEngineSide {
  module: TestingModule;
  consumer: PraxisJobConsumerService;
  store: PraxisJobStore;
  rabbit: FakeRabbitMQ;
}

function shared(broker: FakeBroker, minio: FakeMinio, settings: Record<string, string>, rabbit: FakeRabbitMQ) {
  return [
    PraxisJobStore,
    QueueService,
    QueueConfigFactory,
    { provide: ConfigService, useValue: new FakeConfig(settings) },
    { provide: RabbitMQChannelModelService, useValue: rabbit },
    { provide: MinioService, useValue: minio },
  ];
}

async function praxisManagerSide(
  broker: FakeBroker,
  minio: FakeMinio,
  settings: Record<string, string> = {},
  prepare: (rabbit: FakeRabbitMQ) => void = () => undefined,
): Promise<PraxisManagerSide> {
  const rabbit = new FakeRabbitMQ(broker);
  prepare(rabbit);
  const module = await Test.createTestingModule({
    providers: [PraxisJobsService, ...shared(broker, minio, settings, rabbit)],
  }).compile();
  await module.init();
  return { module, jobs: module.get(PraxisJobsService), store: module.get(PraxisJobStore), rabbit };
}

async function praxisEngineSide(
  broker: FakeBroker,
  minio: FakeMinio,
  settings: Record<string, string> = {},
  prepare: (rabbit: FakeRabbitMQ) => void = () => undefined,
): Promise<PraxisEngineSide> {
  const rabbit = new FakeRabbitMQ(broker);
  prepare(rabbit);
  const module = await Test.createTestingModule({
    providers: [PraxisJobConsumerService, ...shared(broker, minio, settings, rabbit)],
  }).compile();
  await module.init();
  return { module, consumer: module.get(PraxisJobConsumerService), store: module.get(PraxisJobStore), rabbit };
}

function until(condition: () => boolean | Promise<boolean>, limitMs = 10_000, what = "the expected state"): Promise<void> {
  const deadline = Date.now() + limitMs;
  return new Promise((done, failed) => {
    const check = async (): Promise<void> => {
      try {
        if (await condition()) {
          done();
          return;
        }
      } catch (error) {
        failed(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      if (Date.now() >= deadline) {
        failed(new Error(`${what} was not reached within ${limitMs} ms`));
        return;
      }
      setTimeout(() => void check(), 5);
    };
    void check();
  });
}

interface ExitStub {
  codes: (number | string | null | undefined)[];
  clearExitCode: () => void;
  restore: () => Promise<void>;
}

const EXIT_DELAY_MS = 1_000;

function stubProcessExit(): ExitStub {
  const original = Object.getOwnPropertyDescriptor(process, "exit");
  const previousCode = process.exitCode;
  const codes: (number | string | null | undefined)[] = [];
  Object.defineProperty(process, "exit", {
    configurable: true,
    writable: true,
    value: (code?: number | string | null) => {
      codes.push(code);
    },
  });
  return {
    codes,
    clearExitCode: () => {
      process.exitCode = previousCode;
    },
    restore: async () => {
      await new Promise((wake) => setTimeout(wake, EXIT_DELAY_MS + 100));
      if (original === undefined) Reflect.deleteProperty(process, "exit");
      else Object.defineProperty(process, "exit", original);
      process.exitCode = previousCode;
    },
  };
}

interface RejectionWatch {
  seen: string[];
  stop: () => Promise<string[]>;
}

function watchUnhandledRejections(): RejectionWatch {
  const seen: string[] = [];
  const record = (reason: Error | string): void => {
    seen.push(reason instanceof Error ? reason.message : String(reason));
  };
  process.on("unhandledRejection", record);
  return {
    seen,
    stop: async () => {
      await new Promise((wake) => setTimeout(wake, 25));
      process.off("unhandledRejection", record);
      return seen;
    },
  };
}

export { FakeConfig, praxisEngineSide, praxisManagerSide, stubProcessExit, until, watchUnhandledRejections };
export type { ExitStub, PraxisEngineSide, PraxisManagerSide, RejectionWatch };
