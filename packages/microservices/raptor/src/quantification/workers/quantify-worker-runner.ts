import { Worker } from 'node:worker_threads';
import { existsSync } from 'fs';
import { join } from 'path';
import type { NodeQuantRequest } from '../../common/types/quantify-request';
import type { QuantifyModelResult } from '../../common/types/quantify-result';

interface QuantWorkerMessage {
  result?: QuantifyModelResult;
  error?: string;
  stack?: string;
}

const workerPath = (() => {
  const candidates = [
    join(__dirname, 'quantify.worker.js'),
    join(__dirname, 'workers', 'quantify.worker.js'),
    join(__dirname, 'quantification', 'workers', 'quantify.worker.js'),
    join(process.cwd(), 'quantification', 'workers', 'quantify.worker.js'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Unable to locate quantify.worker.js for SCRAM quantification.',
  );
})();

export function runQuantificationWithWorker(
  quantRequest: Omit<NodeQuantRequest, '_id'>,
): Promise<QuantifyModelResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, {
      workerData: { quantRequest },
    });

    let settled = false;

    const finalize = () => {
      settled = true;
      worker.removeAllListeners();
    };

    const terminateSafely = async () => {
      try {
        await worker.terminate();
      } catch {
        // Worker may have already stopped; ignore cleanup errors.
      }
    };

    worker.once('message', async (message: QuantWorkerMessage) => {
      if (settled) {
        return;
      }

      finalize();

      if (message?.error) {
        const err = new Error(message.error);
        if (message.stack) {
          err.stack = message.stack;
        }
        await terminateSafely();
        reject(err);
        return;
      }

      await terminateSafely();
      if (!message?.result) {
        reject(new Error('SCRAM quantification worker returned no result.'));
        return;
      }
      resolve(message.result);
    });

    worker.once('error', async (error: unknown) => {
      if (settled) {
        return;
      }

      finalize();
      await terminateSafely();
      reject(error);
    });

    worker.once('exit', (code: number) => {
      if (settled) {
        return;
      }

      finalize();
      if (code === 0) {
        reject(
          new Error(
            'SCRAM quantification worker exited before returning a result.',
          ),
        );
      } else {
        reject(
          new Error(`SCRAM quantification worker exited with code ${code}`),
        );
      }
    });
  });
}
