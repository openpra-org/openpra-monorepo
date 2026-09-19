"use strict";

const DEFAULT_NATIVE_TIMEOUT_MS = 300_000;
const NATIVE_TRANSPORT_GRACE_MS = 10_000;
const NATIVE_DEADLINE_HEADER = "x-praxis-deadline";

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** Validate the transport envelope; method-specific result validation stays in the backend. */
function parseNativeResponse(value) {
  if (
    !record(value) ||
    value.schemaVersion !== "1.0.0" ||
    Object.keys(value).some((key) => !["schemaVersion", "result", "error", "engine"].includes(key)) ||
    Object.hasOwn(value, "result") === Object.hasOwn(value, "error")
  ) {
    throw new Error("PRAXIS response must contain version 1.0.0 and exactly one of result or error");
  }
  if (
    value.engine !== undefined &&
    (!record(value.engine) ||
      value.engine.name !== "PRAXIS" ||
      typeof value.engine.version !== "string" ||
      !/^sha256:[a-f0-9]{64}$/.test(value.engine.version) ||
      Object.keys(value.engine).some((key) => !["name", "version"].includes(key)))
  ) {
    throw new Error("PRAXIS engine identity must identify the loaded native binary");
  }
  if (Object.hasOwn(value, "result")) {
    if (!record(value.result)) throw new Error("PRAXIS result must be an object");
  } else {
    const error = value.error;
    if (
      !record(error) ||
      !text(error.kind) ||
      !text(error.code) ||
      !text(error.message) ||
      !record(error.details) ||
      Object.keys(error).some((key) => !["kind", "code", "message", "details"].includes(key))
    ) {
      throw new Error("PRAXIS error must contain kind, code, message and details");
    }
  }
  return value;
}

function nativeExecutionTimeout(value = process.env.PRAETOR_NATIVE_TIMEOUT_MS) {
  if (value === undefined) return DEFAULT_NATIVE_TIMEOUT_MS;
  const timeout = Number(value);
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 2_147_000_000) {
    throw new Error("PRAETOR_NATIVE_TIMEOUT_MS must be a positive integer no greater than 2147000000");
  }
  return timeout;
}

function nativeWorkerHeapLimit(value = process.env.PRAETOR_NATIVE_HEAP_MB) {
  // Leave Node's default/NODE_OPTIONS in effect unless explicitly configured.
  if (value === undefined) return undefined;
  const megabytes = Number(value);
  if (!Number.isSafeInteger(megabytes) || megabytes < 1 || megabytes > 2_147_000_000) {
    throw new Error("PRAETOR_NATIVE_HEAP_MB must be a positive integer no greater than 2147000000");
  }
  return megabytes;
}

/** Enforce a per-table admission limit, before calling native inference. */
function checkCliqueMemory(preflight, value = process.env.PRAETOR_NATIVE_MAX_CLIQUE_MB) {
  const megabytes = value === undefined ? 4096 : Number(value);
  if (!Number.isSafeInteger(megabytes) || megabytes < 1 || megabytes > 2_147_000_000)
    throw new Error("PRAETOR_NATIVE_MAX_CLIQUE_MB must be a positive integer no greater than 2147000000");
  const response = parseNativeResponse(preflight);
  if (response.error) return response;
  const report = response.result;
  if (report.scope !== "CLIQUE_MEMORY_PREFLIGHT") throw new Error("Invalid PRAXIS memory preflight");
  const table = report.largestTable;
  if (table === null) return undefined;
  if (!record(table) || typeof table.bytes !== "string" || !/^[1-9][0-9]*$/.test(table.bytes))
    throw new Error("Invalid PRAXIS clique allocation size");
  const required = BigInt(table.bytes);
  const limit = BigInt(megabytes) * 1024n * 1024n;
  if (required <= limit) return undefined;
  return {
    schemaVersion: "1.0.0",
    error: {
      kind: "EXECUTION_ERROR",
      code: "PRAXIS_RESOURCE_LIMIT",
      message: `TensorBayes's largest planned clique table requires ${required} bytes; the per-table limit is ${limit} bytes. Inference was not started. Review PRAETOR_NATIVE_MAX_CLIQUE_MB and available memory. Total memory needs are higher than one table.`,
      details: {
        stage: "PREFLIGHT",
        component: "TENSORBAYES_CLIQUE_TABLE",
        requiredBytes: table.bytes,
        limitBytes: limit.toString(),
        table,
      },
    },
  };
}

module.exports = {
  checkCliqueMemory,
  parseNativeResponse,
  nativeExecutionTimeout,
  nativeWorkerHeapLimit,
  DEFAULT_NATIVE_TIMEOUT_MS,
  NATIVE_TRANSPORT_GRACE_MS,
  NATIVE_DEADLINE_HEADER,
};
