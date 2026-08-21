'use strict';

const { parentPort, threadId, workerData } = require('node:worker_threads');

try {
  const addon = require(workerData.addonPath);
  const resultJson = addon[workerData.operation](workerData.requestJson);

  parentPort?.postMessage({ resultJson, workerThreadId: threadId });
} catch (caught) {
  const error = caught instanceof Error ? caught : new Error(String(caught));
  parentPort?.postMessage({
    error: error.message,
    stack: error.stack,
    workerThreadId: threadId,
  });
}
