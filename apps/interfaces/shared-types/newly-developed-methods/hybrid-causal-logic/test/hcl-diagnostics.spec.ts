import { HclBatchCompilationStatsSchema } from "..";
import { EventTreeSequenceDiagnosticsSchema } from "../../event-tree";

describe("diagnostic transport", () => {
  it("accepts separate FT and sequence compilation counts, including an all-skipped batch", () => {
    for (const counts of [{ bddCompilations: 1 }, { sequenceBddCompilations: 4 }, { bddCompilations: 0 }]) {
      const value = {
        ...counts,
        junctionTreeCompilations: 1,
        scenarioEvaluations: "bddCompilations" in counts && counts.bddCompilations === 0 ? 0 : 2,
      };
      expect(HclBatchCompilationStatsSchema.parse(value)).toEqual(value);
    }
  });

  it.each([
    { bddCompilations: 1, sequenceBddCompilations: 2, junctionTreeCompilations: 1, scenarioEvaluations: 2 },
    { bddCompilations: -1, junctionTreeCompilations: 1, scenarioEvaluations: 2 },
    { bddCompilations: 1, junctionTreeCompilations: 1.5, scenarioEvaluations: 2 },
    { bddCompilations: 1, junctionTreeCompilations: 1, scenarioEvaluations: Infinity },
    { junctionTreeCompilations: 1, scenarioEvaluations: 2 },
  ])("rejects invalid or ambiguous counters: %j", (value) => {
    expect(HclBatchCompilationStatsSchema.safeParse(value).success).toBe(false);
  });

  it("preserves null diagnostics for a known unconditional/independent sequence", () => {
    const result = { bdd: null, bridge: null, junctionTree: null };
    expect(EventTreeSequenceDiagnosticsSchema.parse(result)).toEqual(result);
    expect(EventTreeSequenceDiagnosticsSchema.safeParse({ bdd: null }).success).toBe(false);
  });

  it("preserves actual variable order and rejects malformed structure data", () => {
    const order = ["10000000-0000-4000-8000-000000000002", "10000000-0000-4000-8000-000000000001"];
    const value = { bdd: { nodes: 3, variables: 2, variableOrder: order }, bridge: null, junctionTree: null };
    expect(EventTreeSequenceDiagnosticsSchema.parse(value).bdd?.variableOrder).toEqual(order);
    expect(EventTreeSequenceDiagnosticsSchema.safeParse({ ...value, bdd: { ...value.bdd, nodes: -1 } }).success).toBe(
      false,
    );
  });
});
