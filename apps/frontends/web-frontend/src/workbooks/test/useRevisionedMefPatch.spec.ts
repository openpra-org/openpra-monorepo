import { act, renderHook } from "@testing-library/react";
import { useRevisionedMefPatch } from "../useRevisionedMefPatch";

interface TestMef {
  value: string;
  detail?: string;
}

interface TestResponse {
  revision: number;
  mef: TestMef;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("revisioned MEF patch queue", () => {
  test("serializes rapid edits and advances the expected revision", async () => {
    const first = deferred<TestResponse>();
    const second = deferred<TestResponse>();
    const patchWorkbook = jest
      .fn<Promise<TestResponse>, [string, number, TestMef, TestMef]>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const getWorkbook = jest.fn<Promise<TestResponse>, [string]>();
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const onResync = jest.fn();
    const { result, rerender } = renderHook(
      ({ current, revision }: { current: TestMef; revision: number }) =>
        useRevisionedMefPatch(
          "workbook-1",
          current,
          revision,
          patchWorkbook,
          getWorkbook,
          onSuccess,
          onError,
          onResync,
        ),
      { initialProps: { current: { value: "initial" }, revision: 1 } },
    );

    expect(result.current.saveStatus).toBe("saved");

    let firstPatch!: Promise<void>;
    act(() => {
      firstPatch = result.current.patch(() => ({ value: "first" }));
    });
    expect(result.current.saveStatus).toBe("saving");
    rerender({ current: { value: "first" }, revision: 1 });
    let secondPatch!: Promise<void>;
    act(() => {
      secondPatch = result.current.patch(() => ({ value: "second" }));
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(patchWorkbook).toHaveBeenCalledTimes(1);
    expect(patchWorkbook.mock.calls[0]?.[1]).toBe(1);

    await act(async () => {
      first.resolve({ revision: 2, mef: { value: "first" } });
      await firstPatch;
    });

    expect(patchWorkbook).toHaveBeenCalledTimes(2);
    expect(patchWorkbook.mock.calls[1]?.[1]).toBe(2);
    expect(onSuccess).toHaveBeenNthCalledWith(1, 2);
    expect(result.current.saveStatus).toBe("saving");

    await act(async () => {
      second.resolve({ revision: 3, mef: { value: "second" } });
      await secondPatch;
    });

    expect(onSuccess).toHaveBeenNthCalledWith(2, 3);
    expect(onError).not.toHaveBeenCalled();
    expect(getWorkbook).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toBe("saved");
  });

  test("drops queued stale edits and resynchronizes after a failed save", async () => {
    const first = deferred<TestResponse>();
    const patchWorkbook = jest
      .fn<Promise<TestResponse>, [string, number, TestMef, TestMef]>()
      .mockImplementationOnce(() => first.promise);
    const latest = { revision: 4, mef: { value: "server" } };
    const getWorkbook = jest.fn<Promise<TestResponse>, [string]>().mockResolvedValue(latest);
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const onResync = jest.fn();
    const { result, rerender } = renderHook(
      ({ current, revision }: { current: TestMef; revision: number }) =>
        useRevisionedMefPatch(
          "workbook-1",
          current,
          revision,
          patchWorkbook,
          getWorkbook,
          onSuccess,
          onError,
          onResync,
        ),
      { initialProps: { current: { value: "initial" }, revision: 1 } },
    );

    let firstPatch!: Promise<void>;
    act(() => {
      firstPatch = result.current.patch(() => ({ value: "first" }));
    });
    rerender({ current: { value: "first" }, revision: 1 });
    let queuedPatch!: Promise<void>;
    act(() => {
      queuedPatch = result.current.patch(() => ({ value: "second" }));
    });

    await act(async () => {
      first.reject(new Error("Workbook revision conflict"));
      await firstPatch;
      await queuedPatch;
    });

    expect(patchWorkbook).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("Workbook revision conflict");
    expect(getWorkbook).toHaveBeenCalledWith("workbook-1");
    expect(onResync).toHaveBeenCalledWith(latest);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toBe("failed");
  });

  test("drops edits made while conflict recovery is reloading the workbook", async () => {
    const first = deferred<TestResponse>();
    const reload = deferred<TestResponse>();
    const patchWorkbook = jest
      .fn<Promise<TestResponse>, [string, number, TestMef, TestMef]>()
      .mockImplementationOnce(() => first.promise);
    const latest = { revision: 4, mef: { value: "server" } };
    const getWorkbook = jest.fn<Promise<TestResponse>, [string]>().mockReturnValue(reload.promise);
    const onResync = jest.fn();
    const { result } = renderHook(() =>
      useRevisionedMefPatch(
        "workbook-1",
        { value: "optimistic" },
        1,
        patchWorkbook,
        getWorkbook,
        jest.fn(),
        jest.fn(),
        onResync,
      ),
    );

    let failedPatch!: Promise<void>;
    act(() => {
      failedPatch = result.current.patch(() => ({ value: "first" }));
    });
    await act(async () => {
      first.reject(new Error("Workbook revision conflict"));
      await Promise.resolve();
    });

    let recoveryEdit!: Promise<void>;
    act(() => {
      recoveryEdit = result.current.patch(() => ({ value: "edited during reload" }));
    });
    await act(async () => {
      reload.resolve(latest);
      await failedPatch;
      await recoveryEdit;
    });

    expect(patchWorkbook).toHaveBeenCalledTimes(1);
    expect(onResync).toHaveBeenCalledWith(latest);
    expect(result.current.saveStatus).toBe("failed");
  });

  test("returns to saving and then saved when an edit is retried after recovery", async () => {
    const latest = { revision: 4, mef: { value: "server" } };
    const retry = deferred<TestResponse>();
    const patchWorkbook = jest
      .fn<Promise<TestResponse>, [string, number, TestMef, TestMef]>()
      .mockRejectedValueOnce(new Error("Workbook revision conflict"))
      .mockImplementationOnce(() => retry.promise);
    const getWorkbook = jest.fn<Promise<TestResponse>, [string]>().mockResolvedValue(latest);
    const { result, rerender } = renderHook(
      ({ current, revision }: { current: TestMef; revision: number }) =>
        useRevisionedMefPatch(
          "workbook-1",
          current,
          revision,
          patchWorkbook,
          getWorkbook,
          jest.fn(),
          jest.fn(),
          jest.fn(),
        ),
      { initialProps: { current: { value: "initial" }, revision: 1 } },
    );

    await act(async () => {
      await result.current.patch(() => ({ value: "conflicting edit" }));
    });
    expect(result.current.saveStatus).toBe("failed");

    rerender({ current: latest.mef, revision: latest.revision });
    let retryPatch!: Promise<void>;
    act(() => {
      retryPatch = result.current.patch(() => ({ value: "retry" }));
    });
    expect(result.current.saveStatus).toBe("saving");
    await act(async () => {
      await Promise.resolve();
    });
    expect(patchWorkbook.mock.calls[1]?.[1]).toBe(4);

    await act(async () => {
      retry.resolve({ revision: 5, mef: { value: "retry" } });
      await retryPatch;
    });
    expect(result.current.saveStatus).toBe("saved");
  });

  test("resynchronizes before retrying after both the save and recovery reload fail", async () => {
    const initial = { revision: 1, mef: { value: "initial", detail: "original" } };
    const latest = {
      revision: 4,
      mef: { value: "server value", detail: "concurrent server change" },
    };
    const saved = {
      revision: 5,
      mef: { value: "retried", detail: "concurrent server change" },
    };
    const patchWorkbook = jest
      .fn<Promise<TestResponse>, [string, number, TestMef, TestMef]>()
      .mockRejectedValueOnce(new Error("Save request failed"))
      .mockResolvedValueOnce(saved);
    const getWorkbook = jest
      .fn<Promise<TestResponse>, [string]>()
      .mockRejectedValueOnce(new Error("Reload failed"))
      .mockResolvedValueOnce(latest);
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const onResync = jest.fn();
    const { result, rerender } = renderHook(
      ({ current, revision }: { current: TestMef; revision: number }) =>
        useRevisionedMefPatch(
          "workbook-1",
          current,
          revision,
          patchWorkbook,
          getWorkbook,
          onSuccess,
          onError,
          onResync,
        ),
      { initialProps: { current: initial.mef, revision: initial.revision } },
    );

    let failedPatch!: Promise<void>;
    act(() => {
      failedPatch = result.current.patch((current) => ({ ...current, value: "first" }));
    });
    rerender({ current: { value: "first", detail: "original" }, revision: 1 });
    await act(async () => {
      await failedPatch;
    });
    expect(result.current.saveStatus).toBe("failed");
    expect(onResync).not.toHaveBeenCalled();

    let resyncAttempt!: Promise<void>;
    act(() => {
      resyncAttempt = result.current.patch((current) => ({ ...current, detail: "local second" }));
    });
    expect(result.current.saveStatus).toBe("saving");
    await act(async () => {
      await resyncAttempt;
    });

    expect(getWorkbook).toHaveBeenCalledTimes(2);
    expect(patchWorkbook).toHaveBeenCalledTimes(1);
    expect(onResync).toHaveBeenCalledWith(latest);
    expect(onError).toHaveBeenLastCalledWith(
      "Workbook reloaded after a save failure. Reapply your changes.",
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toBe("failed");

    rerender({ current: latest.mef, revision: latest.revision });
    await act(async () => {
      await result.current.patch((current) => ({ ...current, value: "retried" }));
    });

    expect(patchWorkbook).toHaveBeenNthCalledWith(
      2,
      "workbook-1",
      4,
      latest.mef,
      saved.mef,
    );
    expect(onSuccess).toHaveBeenCalledWith(5);
    expect(result.current.saveStatus).toBe("saved");
  });
});
