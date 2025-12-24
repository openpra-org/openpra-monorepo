import { runQuantificationWithWorker } from './quantify-worker-runner';
import { Worker } from 'node:worker_threads';
import { EventEmitter } from 'events';

vi.mock('node:worker_threads', () => {
  return {
    Worker: vi.fn(),
  };
});

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

describe('runQuantificationWithWorker', () => {
  let mockWorker: EventEmitter & { terminate: any; removeAllListeners: any };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorker = new EventEmitter() as any;
    mockWorker.terminate = vi.fn().mockResolvedValue(undefined);
    mockWorker.removeAllListeners = vi.fn();
    (Worker as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      function () {
        return mockWorker;
      },
    );
  });

  it('should resolve with result on message', async () => {
    const promise = runQuantificationWithWorker({} as any);

    mockWorker.emit('message', { result: { success: true } });

    const result = await promise;
    expect(result).toEqual({ success: true });
    expect(mockWorker.terminate).toHaveBeenCalled();
  });

  it('should reject with error on error message', async () => {
    const promise = runQuantificationWithWorker({} as any);

    mockWorker.emit('message', { error: 'Worker failed' });

    await expect(promise).rejects.toThrow('Worker failed');
    expect(mockWorker.terminate).toHaveBeenCalled();
  });

  it('should reject on worker error event', async () => {
    const promise = runQuantificationWithWorker({} as any);

    mockWorker.emit('error', new Error('System error'));

    await expect(promise).rejects.toThrow('System error');
    expect(mockWorker.terminate).toHaveBeenCalled();
  });

  it('should reject on worker exit with code 0 but no result', async () => {
    const promise = runQuantificationWithWorker({} as any);

    mockWorker.emit('exit', 0);

    await expect(promise).rejects.toThrow(
      'SCRAM quantification worker exited before returning a result.',
    );
  });

  it('should reject on worker exit with non-zero code', async () => {
    const promise = runQuantificationWithWorker({} as any);

    mockWorker.emit('exit', 1);

    await expect(promise).rejects.toThrow(
      'SCRAM quantification worker exited with code 1',
    );
  });
});
