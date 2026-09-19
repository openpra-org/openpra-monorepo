import { HclBatchInputSchema, HclHazardSweepSpecSchema } from "..";

const node = "10000000-0000-4000-8000-000000000001";
const state = "10000000-0000-4000-8000-000000000002";
const scenario = {
  id: "10000000-0000-4000-8000-000000000003",
  code: "UP",
  name: "Uploaded",
  enabled: true,
  evidence: { observations: [{ nodeId: node, stateId: state }] },
};

it("accepts temporary rows without requiring a saved hazard grid", () => {
  expect(HclBatchInputSchema.parse({ evidenceScenarios: [scenario] })).toEqual({ evidenceScenarios: [scenario] });
});
it.each([
  { evidenceScenarios: [] },
  { evidenceScenarios: [scenario, scenario] },
  { evidenceScenarios: [scenario, { ...scenario, id: state, code: "up" }] },
  {
    evidenceScenarios: [
      {
        ...scenario,
        evidence: { observations: [scenario.evidence.observations[0], scenario.evidence.observations[0]] },
      },
    ],
  },
  { evidenceScenarios: [scenario], solverSettings: {} },
])("rejects invalid or out-of-scope batch input %#", (value) => {
  expect(HclBatchInputSchema.safeParse(value).success).toBe(false);
});

const dimension = { id: "Earthquake", bnNode: node, states: [state] };
it("accepts source generation options without a mandatory scenario limit", () => {
  const value = { dimensions: [dimension], excludedAssignments: [{ Earthquake: state }] };
  expect(HclHazardSweepSpecSchema.parse(value)).toEqual(value);
});
it.each([
  { dimensions: [] },
  { dimensions: [dimension, dimension] },
  { dimensions: [dimension, { ...dimension, id: "Flood" }] },
  { dimensions: [{ ...dimension, states: [state, state] }] },
  { dimensions: [dimension], excludedAssignments: [{ Unknown: state }] },
  { dimensions: [dimension], excludedAssignments: [{ Earthquake: node }] },
  { dimensions: [dimension], maxScenarios: 0 },
])("rejects invalid generator options %#", (value) => {
  expect(HclHazardSweepSpecSchema.safeParse(value).success).toBe(false);
});
