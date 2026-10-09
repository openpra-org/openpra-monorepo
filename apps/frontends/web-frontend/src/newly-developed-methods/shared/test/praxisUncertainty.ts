import { createRequire } from "module";
import path from "path";
import {
  UncertaintyResponseSchema,
  type UncertaintyRequest,
  type UncertaintyResponse,
} from "interfaces-shared-types/newly-developed-methods/shared";
import { uncertaintyIdle } from "../useUncertainty";

interface PraxisNative {
  execute: (requestJson: string) => string;
}

interface NativeAnswer {
  result?: Record<string, number | string | boolean | object | null>;
  error?: { message: string };
}

const ROUNDS = 40;

let native: PraxisNative | undefined;

function praxisNative(): PraxisNative {
  const loaded: PraxisNative = native ?? createRequire(__filename)(path.resolve(__dirname, "../../../../../../solvers/praxis-node/index.js"));
  native = loaded;
  return loaded;
}

function praxisUncertainty(request: UncertaintyRequest): Promise<UncertaintyResponse> {
  const answer: NativeAnswer = JSON.parse(praxisNative().execute(JSON.stringify({
    schemaVersion: "1.0.0",
    request: { schemaVersion: "1.0.0", methodType: "UNCERTAINTY", ...request },
    modelSnapshots: [],
  })));
  if (answer.error !== undefined) return Promise.reject(new Error(answer.error.message));
  const result = { ...(answer.result ?? {}) };
  delete result["methodType"];
  return Promise.resolve(UncertaintyResponseSchema.parse(result));
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function settledWithPraxis<T>(read: () => T): Promise<T> {
  for (let round = 0; round < ROUNDS; round += 1) {
    const value = read();
    if (uncertaintyIdle()) return value;
    while (!uncertaintyIdle()) await nextTask();
  }
  throw new Error("PRAXIS answers did not settle.");
}

export { praxisUncertainty, settledWithPraxis };
