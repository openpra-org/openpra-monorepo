"use strict";

const SOLVER_PROTOCOL_VERSION = "1.0.0";
const NATIVE_DEADLINE_HEADER = "x-openrc-deadline";
const ENGINE_NAME = "OPENRC";
const FINGERPRINT_PREFIX = "sha256:";
const FINGERPRINT_DIGITS = "0123456789abcdef";

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function onlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function fingerprint(value) {
  return (
    typeof value === "string" &&
    value.startsWith(FINGERPRINT_PREFIX) &&
    value.length === FINGERPRINT_PREFIX.length + 64 &&
    Array.from(value.slice(FINGERPRINT_PREFIX.length)).every((digit) => FINGERPRINT_DIGITS.includes(digit))
  );
}

function parseNativeResponse(value) {
  if (
    !record(value) ||
    value.schemaVersion !== SOLVER_PROTOCOL_VERSION ||
    !onlyKeys(value, ["schemaVersion", "result", "error", "engine"]) ||
    Object.hasOwn(value, "result") === Object.hasOwn(value, "error")
  ) {
    throw new Error("OpenRC response must contain version 1.0.0 and exactly one of result or error");
  }
  if (
    value.engine !== undefined &&
    (!record(value.engine) ||
      value.engine.name !== ENGINE_NAME ||
      !fingerprint(value.engine.version) ||
      !onlyKeys(value.engine, ["name", "version"]))
  ) {
    throw new Error("OpenRC engine identity must identify the loaded native binary");
  }
  if (Object.hasOwn(value, "result")) {
    if (!record(value.result)) throw new Error("OpenRC result must be an object");
  } else {
    const error = value.error;
    if (
      !record(error) ||
      !text(error.kind) ||
      !text(error.code) ||
      !text(error.message) ||
      !record(error.details) ||
      !onlyKeys(error, ["kind", "code", "message", "details"])
    ) {
      throw new Error("OpenRC error must contain kind, code, message and details");
    }
  }
  return value;
}

function nativeWorkerHeapLimit(value = process.env.PRAETOR_NATIVE_HEAP_MB) {
  if (value === undefined) return undefined;
  const megabytes = Number(value);
  if (!Number.isSafeInteger(megabytes) || megabytes < 1 || megabytes > 2_147_000_000) {
    throw new Error("PRAETOR_NATIVE_HEAP_MB must be a positive integer no greater than 2147000000");
  }
  return megabytes;
}

module.exports = {
  parseNativeResponse,
  nativeWorkerHeapLimit,
  NATIVE_DEADLINE_HEADER,
  SOLVER_PROTOCOL_VERSION,
};
