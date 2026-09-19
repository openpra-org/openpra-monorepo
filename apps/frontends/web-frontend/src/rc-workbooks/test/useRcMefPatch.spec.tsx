import { act, renderHook } from "@testing-library/react";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { useRcMefPatch } from "../useRcMefPatch";
import { patchRcWorkbook } from "../rcWorkbookApi";
jest.mock("../rcWorkbookApi", () => ({ patchRcWorkbook: jest.fn() }));

it("waits for category autosave before starting its source import", async () => {
  let finish!: (value: unknown) => void;
  const events: string[] = [];
  jest.mocked(patchRcWorkbook).mockImplementationOnce(() => new Promise((resolve) => { events.push("category save"); finish = resolve as (value: unknown) => void; }));
  const current = { name: "Before" } as RadiologicalConsequenceAnalysis;
  const { result } = renderHook(() => useRcMefPatch("rc-test", current, jest.fn(), jest.fn()));
  let patch!: Promise<void>, source!: Promise<string>;
  act(() => {
    patch = result.current.patch((rc) => ({ ...rc, name: "After" }));
    source = result.current.enqueue(async () => { events.push("source import"); return "saved"; });
  });
  await act(async () => { await Promise.resolve(); });
  expect(events).toEqual(["category save"]);
  await act(async () => { finish({ mef: { name: "After" } }); await patch; await source; });
  expect(events).toEqual(["category save", "source import"]);
});
