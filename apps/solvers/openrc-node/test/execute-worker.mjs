import { createRequire } from "node:module";
import { parentPort, workerData } from "node:worker_threads";

const addon = createRequire(import.meta.url)("..");
const outputs = [];
for (let round = 0; round < workerData.rounds; round += 1) {
  for (const requestJson of workerData.requests) {
    outputs.push(addon.execute(requestJson));
  }
}
parentPort.postMessage(outputs);
