import { EventSequenceAnalysisSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { createBlankEs } from "../blank-es";
import { ES_ANALYSIS } from "../../example-workbooks/seeds/es-seed";

describe("ES MEF builders", () => {
  it("creates a blank ES that conforms to the ES Zod schema", () => {
    const blank = createBlankEs("Test ES", "alice");
    const parsed = EventSequenceAnalysisSchema.safeParse(blank);
    expect(parsed.success).toBe(true);
  });

  it("starts a blank ES in DRAFT with empty collections", () => {
    const blank = createBlankEs("Test ES", "alice");
    expect(blank.workflowState).toBe("DRAFT");
    expect(blank.eventSequences).toHaveLength(0);
    expect(blank.eventSequenceFamilies).toHaveLength(0);
    expect(blank.screeningRecords).toHaveLength(0);
    expect(blank.owner).toBe("alice");
  });

  it("validates the Generic-1 example seed against the ES Zod schema", () => {
    const parsed = EventSequenceAnalysisSchema.safeParse(ES_ANALYSIS);
    expect(parsed.success).toBe(true);
  });

  it("seeds the example with 8 event trees and 5 sequence families", () => {
    expect(ES_ANALYSIS.eventTrees).toHaveLength(8);
    expect(ES_ANALYSIS.eventSequenceFamilies).toHaveLength(5);
  });
});
