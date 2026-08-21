import { parentPort, threadId, workerData } from 'node:worker_threads';

interface PraxisAddon {
    validate(requestJson: string): string;
    execute(requestJson: string): string;
}

interface PraxisWorkerData {
    operation: keyof PraxisAddon;
    requestJson: string;
    addonPath: string;
}

const data = workerData as PraxisWorkerData;

try {
    const addon = require(data.addonPath) as PraxisAddon;
    const resultJson = addon[data.operation](data.requestJson);

    parentPort?.postMessage({ resultJson, workerThreadId: threadId });
}
catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught));
    parentPort?.postMessage({
        error: error.message,
        stack: error.stack,
        workerThreadId: threadId,
    });
}
