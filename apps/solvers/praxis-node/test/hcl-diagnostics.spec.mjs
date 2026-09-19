import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import { requestFor, eventTreeRequestFor } from "./hcl-source-helpers.mjs";

const addon = createRequire(import.meta.url)("..");
const fixture = JSON.parse(
  readFileSync(new URL("../../praxis/tests/fixtures/hcl_mh_cpt/reference.json", import.meta.url)),
).mixed[0];
const execute = (request) => {
  const output = JSON.parse(addon.execute(JSON.stringify(request)));
  assert.equal(output.error, undefined, JSON.stringify(output));
  return output.result;
};

for (const kind of ["FT", "ET"])
  test(`${kind} diagnostics retain actual order and isolate each scenario's point counters`, () => {
    const request = kind === "FT" ? requestFor(fixture, true) : eventTreeRequestFor(fixture);
    const settings = request.modelSnapshots.find((s) => s.id === "HCL").solverSettings;
    settings.variableOrder = ["E", "B", "A"];
    settings.uncertainty.sampleCount = 10;
    request.request.calculationType = "PROBABILITY";
    request.request.evidenceBatch = ["False", "True", "False"].map((stateId, i) => ({
      scenarioId: `row-${i}`,
      observations: [{ nodeId: "A", stateId }],
    }));
    const point = execute(request);
    assert.deepEqual(point.compilationReuse, {
      ...(kind === "FT" ? { bddCompilations: 1 } : { sequenceBddCompilations: 2 }),
      junctionTreeCompilations: 1,
      scenarioEvaluations: 3,
    });
    const diagnostics = (row) =>
      kind === "FT" ?
        [
          {
            bdd: { nodes: row.bddNodes, variables: row.bddVariables, variableOrder: row.variableOrder },
            bridge: row.bridge,
            junctionTree: row.junctionTree,
          },
        ]
      : row.sequences.map((s) => s.diagnostics);
    for (const row of point.batchResults)
      for (const data of diagnostics(row)) {
        assert.deepEqual(data.bdd.variableOrder, ["E", "B", "A"]);
        assert.equal(data.bdd.variables, 3);
        assert.ok(data.bdd.nodes > 0);
        assert.equal(data.bridge.quantifications, 1);
        assert.equal(data.junctionTree.treewidth, data.junctionTree.maxCliqueSize - 1);
      }
    assert.deepEqual(diagnostics(point.batchResults[0]), diagnostics(point.batchResults[2]));
    request.request.calculationType = "UNCERTAINTY";
    const uncertain = execute(request);
    assert.deepEqual(uncertain.compilationReuse, point.compilationReuse);
    assert.deepEqual(uncertain.batchResults.map(diagnostics), point.batchResults.map(diagnostics));
    for (let i = 0; i < point.batchResults.length; i++) {
      if (kind === "FT") assert.equal(uncertain.batchResults[i].probability, point.batchResults[i].probability);
      else
        assert.deepEqual(
          uncertain.batchResults[i].sequences.map((s) => s.conditionalProbability),
          point.batchResults[i].sequences.map((s) => s.conditionalProbability),
        );
    }
  });

test("unconditional ET sequences report no BDD or bridge without inventing compilation counts", () => {
  const request = eventTreeRequestFor(fixture);
  request.request.calculationType = "PROBABILITY";
  request.request.evidenceBatch = [{ scenarioId: "row", observations: [] }];
  request.modelSnapshots.find((s) => s.id === "HCL").solverSettings.variableOrder = null;
  const tree = request.modelSnapshots.find((s) => s.id === "ET");
  tree.sequences = [
    {
      id: "BYPASS",
      path: [{ functionalEventId: "FE", outcome: "BYPASSED" }],
      result: { kind: "END_STATE", endStateId: "SAFE" },
    },
  ];
  const result = execute(request);
  assert.equal(result.compilationReuse.sequenceBddCompilations, 0);
  const sequence = result.batchResults[0].sequences[0];
  assert.equal(sequence.conditionalProbability, 1);
  assert.equal(sequence.diagnostics.bdd, null);
  assert.equal(sequence.diagnostics.bridge, null);
  assert.ok(sequence.diagnostics.junctionTree.numCliques > 0);
});
