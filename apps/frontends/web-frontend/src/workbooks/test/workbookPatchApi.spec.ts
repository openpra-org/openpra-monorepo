import { patchJson } from "../../api/client";
import { patchIeWorkbook } from "../../ie-workbooks/ieWorkbookApi";
import { patchSyWorkbook } from "../../sy-workbooks/syWorkbookApi";
import { patchEsWorkbook } from "../../es-workbooks/esWorkbookApi";
import { patchEsqWorkbook } from "../../esq-workbooks/esqWorkbookApi";
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";

jest.mock("../../api/client", () => ({
  deleteJson: jest.fn(),
  fetchJson: jest.fn(),
  patchJson: jest.fn(),
  postJson: jest.fn(),
  postMultipart: jest.fn(),
}));

const mockPatchJson = patchJson as jest.MockedFunction<typeof patchJson>;

describe("workbook patch API payload", () => {
  beforeEach(() => {
    mockPatchJson.mockReset();
  });

  test("sends the changed path and value without unchanged MEF data", async () => {
    const current = {
      name: "Initiating Events",
      initiatingEvents: [{ uuid: "IE-01", name: "Loss of offsite power", frequency: 0.01 }],
    } as unknown as InitiatingEventsAnalysis;
    const next = {
      ...current,
      initiatingEvents: [{ ...current.initiatingEvents[0]!, name: "Loss of preferred power" }],
    };
    mockPatchJson.mockResolvedValue({} as never);

    await patchIeWorkbook("workbook-123", current, next);

    expect(mockPatchJson).toHaveBeenCalledWith("/api/ie-workbooks/workbook-123", {
      operations: [
        { op: "replace", path: ["initiatingEvents", 0, "name"], value: "Loss of preferred power" },
      ],
    });
    expect(JSON.stringify(mockPatchJson.mock.calls[0]![1])).not.toContain("frequency");
  });

  test("includes the expected workbook revision for SY, ES, and ESQ", async () => {
    const current = { name: "Before" };
    const next = { name: "After" };
    const revisionedPatchers = [
      [patchSyWorkbook, "/api/sy-workbooks/sy-123"],
      [patchEsWorkbook, "/api/es-workbooks/es-123"],
      [patchEsqWorkbook, "/api/esq-workbooks/esq-123"],
    ] as const;
    mockPatchJson.mockResolvedValue({ revision: 8, mef: next } as never);

    for (const [patchWorkbook, path] of revisionedPatchers) {
      const workbookId = path.split("/").at(-1)!;
      await (patchWorkbook as unknown as (
        id: string,
        expectedRevision: number,
        before: typeof current,
        after: typeof next,
      ) => Promise<unknown>)(workbookId, 7, current, next);
    }

    revisionedPatchers.forEach(([, path], index) => {
      expect(mockPatchJson).toHaveBeenNthCalledWith(index + 1, path, {
        expectedRevision: 7,
        operations: [{ op: "replace", path: ["name"], value: "After" }],
      });
    });
  });
});
