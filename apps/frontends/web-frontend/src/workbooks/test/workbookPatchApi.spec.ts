import { patchJson } from "../../api/client";
import { patchIeWorkbook } from "../../ie-workbooks/ieWorkbookApi";
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
});
