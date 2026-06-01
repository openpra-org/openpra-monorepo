import { InitiatingEventsAnalysisSchema } from "interfaces-mef-types/zod/ie/initiating-event-analysis";
import { createBlankIe } from "../blank-ie";
import { IE_ANALYSIS } from "../../example-workbooks/seeds/ie-seed";

describe("IE MEF builders", () => {
  it("creates a blank IE that conforms to the IE Zod schema", () => {
    const blank = createBlankIe("Test IE", "alice");
    const parsed = InitiatingEventsAnalysisSchema.safeParse(blank);
    expect(parsed.success).toBe(true);
  });

  it("starts a blank IE in DRAFT with empty collections", () => {
    const blank = createBlankIe("Test IE", "alice");
    expect(blank.workflowState).toBe("DRAFT");
    expect(blank.initiators).toHaveLength(0);
    expect(blank.initiatingEventGroups).toHaveLength(0);
    expect(blank.applicablePlantOperatingStates).toHaveLength(0);
    expect(blank.owner).toBe("alice");
  });

  it("validates the Generic-1 example seed against the IE Zod schema", () => {
    const parsed = InitiatingEventsAnalysisSchema.safeParse(IE_ANALYSIS);
    expect(parsed.success).toBe(true);
  });

  it("seeds the example across all seven IE-A5 categories", () => {
    const categories = new Set(IE_ANALYSIS.initiators.map((i) => i.category));
    expect(categories.size).toBe(7);
  });
});
