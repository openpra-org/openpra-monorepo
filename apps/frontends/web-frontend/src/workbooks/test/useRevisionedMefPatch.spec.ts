import { act, renderHook } from "@testing-library/react";
import { useRevisionedMefPatch } from "../useRevisionedMefPatch";

interface TestMef {
  value: string;
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
    const patchWorkbook = jest
      .fn<Promise<TestResponse>, [string, number, TestMef, TestMef]>()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ revision: 3, mef: { value: "second" } });
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

    let firstPatch!: Promise<void>;
    act(() => {
      firstPatch = result.current.patch(() => ({ value: "first" }));
    });
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
      await secondPatch;
    });

    expect(patchWorkbook).toHaveBeenCalledTimes(2);
    expect(patchWorkbook.mock.calls[1]?.[1]).toBe(2);
    expect(onSuccess).toHaveBeenNthCalledWith(1, 2);
    expect(onSuccess).toHaveBeenNthCalledWith(2, 3);
    expect(onError).not.toHaveBeenCalled();
    expect(getWorkbook).not.toHaveBeenCalled();
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
  });
});
