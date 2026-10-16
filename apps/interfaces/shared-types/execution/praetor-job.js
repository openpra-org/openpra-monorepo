"use strict";

const DEFAULT_PRAETOR_JOB_TIMEOUT_MS = 14_400_000;
const PRAETOR_JOB_STATUSES = ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"];
const PRAETOR_JOB_OPERATIONS = ["execute", "validate"];
const PRAETOR_JOB_ID_CHARACTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-";

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function nullableText(value) {
  return value === null || typeof value === "string";
}

function nullableCount(value) {
  return value === null || (Number.isSafeInteger(value) && value >= 0);
}

function isPraetorJobId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    [...value].every((character) => PRAETOR_JOB_ID_CHARACTERS.includes(character))
  );
}

function praetorJobTimeout(value = process.env.PRAETOR_JOB_TIMEOUT_MS) {
  if (value === undefined) return DEFAULT_PRAETOR_JOB_TIMEOUT_MS;
  const timeout = Number(value);
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 2_147_000_000) {
    throw new Error("PRAETOR_JOB_TIMEOUT_MS must be a positive integer no greater than 2147000000");
  }
  return timeout;
}

function parsePraetorJobState(value) {
  if (
    !record(value) ||
    !isPraetorJobId(value.jobId) ||
    !PRAETOR_JOB_OPERATIONS.includes(value.operation) ||
    !PRAETOR_JOB_STATUSES.includes(value.status) ||
    !text(value.submittedAt) ||
    !nullableText(value.startedAt) ||
    !nullableText(value.completedAt) ||
    !nullableText(value.worker) ||
    !Number.isSafeInteger(value.attempts) ||
    value.attempts < 0 ||
    !nullableCount(value.queuedJobs) ||
    !nullableCount(value.workers)
  ) {
    throw new Error("PRAETOR job state is malformed");
  }
  if (value.error !== null) {
    const error = value.error;
    if (!record(error) || !text(error.kind) || !text(error.code) || !text(error.message) || !record(error.details)) {
      throw new Error("PRAETOR job error must contain kind, code, message and details");
    }
  }
  return value;
}

function praetorJobFinished(status) {
  return status === "SUCCEEDED" || status === "FAILED" || status === "CANCELLED";
}

module.exports = {
  PRAETOR_JOB_OPERATIONS,
  isPraetorJobId,
  parsePraetorJobState,
  praetorJobFinished,
  praetorJobTimeout,
};
