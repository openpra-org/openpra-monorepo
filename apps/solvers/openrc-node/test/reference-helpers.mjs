import { createRequire } from "node:module";

export * from "./reference-data.mjs";

const require = createRequire(import.meta.url);

export const addon = require("..");

export function call(operation, envelope) {
  return JSON.parse(addon[operation](JSON.stringify(envelope)));
}
