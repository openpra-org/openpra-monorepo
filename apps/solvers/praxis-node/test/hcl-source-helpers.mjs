import assert from "node:assert/strict";
export function requestFor(c, mixed = false) {
  const variables = new Map(c.variables.map((v) => [v.name, v]));
  const settings = c.settings;
  const events = mixed ? ["A", "B", "E"] : ["A", "E"];
  const linked = mixed ? ["A", "B"] : ["A"];
  const nodeFor = (event) => (mixed ? event : "N");
  const statesFor = (name) => (mixed ? ["True"] : [variables.get(name).states[0]]);
  const gates =
    mixed ?
      [
        ["TOP", "OR"],
        ["AE", "AND"],
        ["NB", "AND"],
        ["NA", "NOT"],
      ]
    : [["TOP", "AND"]];
  const inputs =
    mixed ?
      [
        ["TOP", "AE"],
        ["TOP", "NB"],
        ["AE", "ref-A"],
        ["AE", "ref-E"],
        ["NB", "NA"],
        ["NB", "ref-B"],
        ["NA", "ref-A"],
      ]
    : [
        ["TOP", "ref-A"],
        ["TOP", "ref-E"],
      ];
  const tables = c.variables.map((v) => {
    const width = v.states.length;
    const rows = Array.from({ length: v.probabilities.length / width }, (_, row) => {
      let remainder = row;
      const indices = new Array(v.parents.length);
      for (let i = v.parents.length - 1; i >= 0; i--) {
        const card = variables.get(v.parents[i]).states.length;
        indices[i] = remainder % card;
        remainder = Math.floor(remainder / card);
      }
      return {
        id: `${v.name}-${row}`,
        parentStates: v.parents.map((name, i) => ({
          parentNodeId: name,
          stateId: variables.get(name).states[indices[i]],
        })),
        values: v.states.map((state, i) => ({ stateId: state, probability: v.probabilities[row * width + i] })),
      };
    });
    return { nodeId: v.name, parents: v.parents.map((nodeId, order) => ({ nodeId, order })), rows };
  });
  const priors = settings.cpt_row_distributions.map((r) => {
    const prior = { ...r.prior };
    if (prior.true_state !== undefined) {
      prior.trueStateId = prior.true_state;
      delete prior.true_state;
    }
    return { bayesianNetworkNode: { modelId: "BN", entityId: r.node }, cptRowId: `${r.node}-${r.row_index}`, prior };
  });
  return {
    schemaVersion: "1.0.0",
    request: {
      schemaVersion: "1.0.0",
      methodType: "HYBRID_CAUSAL_LOGIC",
      modelId: "HCL",
      revision: 1,
      requestedBy: "source-test",
      calculationType: "UNCERTAINTY",
      faultTreeTopGate: { modelId: "FT", entityId: "TOP" },
    },
    modelSnapshots: [
      {
        id: "HCL",
        methodType: "HYBRID_CAUSAL_LOGIC",
        revision: 1,
        bayesianNetwork: { modelId: "BN" },
        faultTrees: [{ faultTree: { modelId: "FT" } }],
        bindings: linked.map((event) => ({
          id: `link-${event}`,
          faultTreeBasicEvent: { modelId: "FT", entityId: event },
          bayesianNetworkNode: { modelId: "BN", entityId: nodeFor(event) },
          trueStateIds: statesFor(nodeFor(event)),
        })),
        baseEvidence: { observations: [] },
        solverSettings: {
          variableOrder: events,
          foldConstants: false,
          spliceNullGates: false,
          uncertainty: {
            sampler: settings.sampler,
            sampleCount: settings.sample_count,
            seed: settings.seed,
            cptProbabilityClipEpsilon: settings.cpt_probability_clip_epsilon,
            basicEventDistributions: settings.basic_event_distributions.map((e) => ({
              faultTreeBasicEvent: { entityId: e.event },
              distribution: e.distribution,
            })),
            cptRowDistributions: priors,
            ...(settings.cpt_generators ?
              {
                cptGenerators: settings.cpt_generators.map((g) => ({
                  bayesianNetworkNode: { modelId: "BN", entityId: g.node },
                  generator: g.generator,
                })),
              }
            : {}),
          },
        },
      },
      {
        id: "BN",
        methodType: "BAYESIAN_NETWORK",
        revision: 1,
        nodes: c.variables.map((v) => ({ id: v.name, states: v.states.map((id) => ({ id })) })),
        conditionalProbabilityTables: tables,
      },
      {
        id: "FT",
        projectId: "P",
        methodType: "FAULT_TREE",
        revision: 1,
        topGate: { gateId: "TOP" },
        gates: gates.map(([id, gateType]) => ({ id, kind: "GATE", gateType, code: id, name: id, description: "" })),
        leafNodes: events.map((basicEventId) => ({
          id: `ref-${basicEventId}`,
          kind: "BASIC_EVENT_REFERENCE",
          basicEventId,
        })),
        gateInputs: inputs.map(([gateId, childId], order) => ({ id: `input-${order}`, gateId, childId, order })),
      },
    ],
    resources: {
      faultTreeBasicEventCatalogue: {
        projectId: "P",
        basicEvents: events.map((id) => ({ id, probability: { value: 0.2 } })),
      },
    },
  };
}
export function checkProbability(actual, expected) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected));
  if (expected === 0) assert.equal(actual, 0);
  else {
    assert.ok(actual > 0, "positive probability was lost");
    assert.ok(Math.abs(actual - expected) <= 2e-10 * Math.abs(expected), `${actual} != ${expected}`);
  }
}

export function checkSummary(actual, samples) {
  const mean = samples.reduce((sum, x) => sum + x, 0) / samples.length;
  assert.equal(actual.sampleCount, samples.length);
  checkProbability(actual.mean, mean);
  checkProbability(actual.minimum, Math.min(...samples));
  checkProbability(actual.maximum, Math.max(...samples));
  assert.equal(Object.hasOwn(actual, "coefficientOfVariation"), false);
}

export function checkSourceSummary(actual, expected, sampleCount, seed) {
  assert.equal(actual.sampleCount, sampleCount);
  assert.equal(actual.seed, seed);
  assert.equal(Object.hasOwn(actual, "coefficientOfVariation"), false);
  for (const [field, value] of Object.entries(expected)) {
    assert.ok(Number.isFinite(actual[field]), field);
    // A constant total such as P(success)+P(failure) has only floating-point
    // noise in its SD. Bound that noise by the total's scale, not relative SD.
    const sdRoundoff = 8 * Number.EPSILON * Math.abs(expected.mean);
    if (field === "standardDeviation" && value <= sdRoundoff) {
      assert.ok(Math.abs(actual[field] - value) <= sdRoundoff, field);
      continue;
    }
    if (value !== 0) assert.ok(actual[field] > 0, `${field}: positive value was lost`);
    assert.ok(
      Math.abs(actual[field] - value) <=
        (value === 0 ? 0 : Math.min(1e-3 * Math.abs(value), 5e-16 + 2e-14 * Math.abs(value))),
      `${field}: native ${actual[field]} != source ${value}`,
    );
  }
}

export function eventTreeRequestFor(c, combinedEndState = false) {
  return withEventTree(requestFor(c, true), combinedEndState);
}

export function withEventTree(request, combinedEndState = false) {
  request.request = {
    schemaVersion: "1.0.0",
    methodType: "EVENT_TREE",
    modelId: "ET",
    revision: 1,
    mode: "HYBRID_CAUSAL_LOGIC",
    requestedBy: "source-test",
    calculationType: request.request.calculationType,
  };
  request.modelSnapshots.push({
    id: "ET",
    methodType: "EVENT_TREE",
    revision: 1,
    initiatingEvent: { target: { modelId: "IE", entityId: "IE-1" } },
    initiatingEventFrequency: { value: 0.01 },
    functionalEvents: [{ id: "FE", name: "System", order: 0 }],
    functionalEventFaultTreeLinks: [{ functionalEventId: "FE", faultTreeTopGate: { modelId: "FT", entityId: "TOP" } }],
    endStates: combinedEndState ? [{ id: "ALL" }] : [{ id: "SAFE" }, { id: "RELEASE" }],
    sequences: ["SUCCESS", "FAILURE"].map((outcome, i) => ({
      id: outcome,
      path: [{ functionalEventId: "FE", outcome }],
      result: {
        kind: "END_STATE",
        endStateId:
          combinedEndState ? "ALL"
          : i ? "RELEASE"
          : "SAFE",
      },
    })),
    hclConfiguration: { configuration: { modelId: "HCL" } },
  });
  return request;
}
