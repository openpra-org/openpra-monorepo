import { parentPort, workerData } from 'node:worker_threads';
import { QuantifyModel } from 'scram-node';
import type { QuantifyModelResult } from '../../common/types/quantify-result';
import type { NodeQuantRequest } from '../../common/types/quantify-request';

interface QuantWorkerData {
  quantRequest: Omit<NodeQuantRequest, '_id'>;
}

const data = workerData as QuantWorkerData;

(async () => {
  try {
    const result: QuantifyModelResult = await Promise.resolve(
      QuantifyModel(data.quantRequest.settings, data.quantRequest.model),
    );
    parentPort?.postMessage({ result });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    parentPort?.postMessage({
      error: error.message,
      stack: error.stack,
    });
  }
})();
