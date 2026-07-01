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
    expect(blank.scopeDefinition.initiatingEventIds).toHaveLength(0);
    expect(blank.owner).toBe("alice");
  });

  it("validates the Generic-1 example seed against the ES Zod schema", () => {
    const parsed = EventSequenceAnalysisSchema.safeParse(ES_ANALYSIS);
    expect(parsed.success).toBe(true);
  });

  it("seeds event trees, sequences, and families", () => {
    expect((ES_ANALYSIS.eventTrees ?? []).length).toBe(25);
    expect(ES_ANALYSIS.eventSequences.length).toBe(164);
    expect(ES_ANALYSIS.eventSequenceFamilies.length).toBe(5);
  });
});
