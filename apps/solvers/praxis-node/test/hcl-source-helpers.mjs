import assert from "node:assert/strict";

const Z95 = 1.6448536269514722;
const SOURCE_EF_QUANTILE = 1.645;
const Z_LIMIT = 5;

export const valued = (unit, law) => ({ node: "VALUE", value: { unit, law } });
export const pointValue = (unit, value) => valued(unit, { family: "POINT", value });
export const probability = (value) => pointValue("PROBABILITY", value);

const sourceLognormal = (median, sigma) => ({
  family: "LOGNORMAL",
  mean: median * Math.exp(0.5 * sigma * sigma),
  errorFactor: Math.exp(Z95 * sigma),
  level: 0.95,
});

function eventLaw(distribution) {
  if (distribution.family === "UNIFORM") return { family: "UNIFORM", lower: distribution.lower, upper: distribution.upper };
  if (distribution.family === "BETA") return { family: "BETA", alpha: distribution.alpha, beta: distribution.beta, lower: 0, upper: 1 };
  throw new Error(`fixture family ${distribution.family} has no direct conversion`);
}

function dirichletRow(prior, states) {
  const concentrations =
    prior.family === "DIRICHLET" ? prior.alpha : states.map((state) => (state === prior.true_state ? prior.alpha : prior.beta));
  return { node: "VALUE", law: { family: "DIRICHLET", concentrations } };
}

function generatorFor(spec) {
  const source = spec.generator;
  const node = { modelId: "BN", entityId: spec.node };
  if (source.type === "seismic_fragility") {
    return {
      kind: "SEISMIC_FRAGILITY",
      bayesianNetworkNode: node,
      pgaParentId: source.pgaParentId,
      trueStateId: source.trueStateId,
      falseStateId: source.falseStateId,
      median:
        source.betaU === 0 ? pointValue("QUANTITY", source.theta) : valued("QUANTITY", sourceLognormal(source.theta, source.betaU)),
      randomness: pointValue("FACTOR", source.betaR),
      demands: source.pgaCenters.map((center) => ({ stateId: center.stateId, demand: center.value })),
    };
  }
  return {
    kind: "SEISMIC_PGA_BINS",
    bayesianNetworkNode: node,
    noneStateId: source.noneStateId,
    missionTime: pointValue("YEARS", source.missionTime),
    conversion: source.frequencyToProbability.toUpperCase(),
    bins: source.bins.map((bin) => ({
      stateId: bin.stateId,
      frequency:
        bin.medianFrequency === 0 ?
          pointValue("PER_YEAR", 0)
        : valued("PER_YEAR", sourceLognormal(bin.medianFrequency, Math.log(bin.errorFactor95) / SOURCE_EF_QUANTILE)),
    })),
  };
}

export function sourceResolvesTails(settings) {
  return settings.cpt_row_distributions.every(
    (row) => row.prior.family !== "DIRICHLET" || row.prior.alpha.every((value) => value === 0 || value >= 0.1),
  );
}

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
  const cptRows = settings.cpt_row_distributions.map((r) => ({
    bayesianNetworkNode: { modelId: "BN", entityId: r.node },
    cptRowId: `${r.node}-${r.row_index}`,
    row: dirichletRow(r.prior, variables.get(r.node).states),
  }));
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
            basicEvents: settings.basic_event_distributions.map((e) => ({
              faultTreeBasicEvent: { entityId: e.event },
              expression: valued("PROBABILITY", eventLaw(e.distribution)),
            })),
            cptRows,
            cptGenerators: (settings.cpt_generators ?? []).map(generatorFor),
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
        basicEvents: events.map((id) => ({ id, expression: probability(0.2) })),
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

function moments(samples) {
  const mean = samples.reduce((sum, x) => sum + x, 0) / samples.length;
  const variance = samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / Math.max(samples.length - 1, 1);
  return { mean, variance };
}

export function checkPopulation(summary, reference, label = "") {
  const n1 = summary.sampleCount;
  const n2 = reference.length;
  assert.equal(Object.hasOwn(summary, "coefficientOfVariation"), false);
  for (const field of ["mean", "standardDeviation", "minimum", "percentile05", "median", "percentile95", "maximum"]) {
    assert.ok(Number.isFinite(summary[field]), `${label} ${field}`);
  }
  assert.ok(
    summary.minimum <= summary.percentile05 && summary.percentile05 <= summary.median
      && summary.median <= summary.percentile95 && summary.percentile95 <= summary.maximum,
    `${label}: summary order`,
  );
  const { mean, variance } = moments(reference);
  const error = Math.sqrt((summary.standardDeviation ** 2) / n1 + variance / n2);
  assert.ok(
    Math.abs(summary.mean - mean) <= Z_LIMIT * error + 1e-12 * Math.max(Math.abs(mean), 1e-300),
    `${label}: mean ${summary.mean} against reference ${mean}, standard error ${error}`,
  );
  for (const [p, value] of [[0.05, summary.percentile05], [0.5, summary.median], [0.95, summary.percentile95]]) {
    const below = reference.filter((x) => x < value).length / n2;
    const atOrBelow = reference.filter((x) => x <= value).length / n2;
    const tolerance = Z_LIMIT * Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2)) + 1 / n1 + 1 / n2;
    assert.ok(
      p >= below - tolerance && p <= atOrBelow + tolerance,
      `${label}: reference fraction around the ${p} quantile ${value} is ${below} to ${atOrBelow}`,
    );
  }
}

export function checkMean(summary, expected, label = "") {
  const error = summary.standardDeviation / Math.sqrt(summary.sampleCount);
  assert.ok(
    Math.abs(summary.mean - expected) <= Z_LIMIT * error + 1e-12 * Math.max(Math.abs(expected), 1e-300),
    `${label}: mean ${summary.mean} against exact ${expected}, standard error ${error}`,
  );
}

export function checkScaled(actual, base, factor, label = "") {
  for (const field of ["mean", "standardDeviation", "minimum", "percentile05", "median", "percentile95", "maximum"]) {
    const expected = base[field] * factor;
    assert.ok(
      Math.abs(actual[field] - expected) <= 1e-12 * Math.abs(expected) + 1e-300,
      `${label} ${field}: ${actual[field]} against ${expected}`,
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
    initiatingEventFrequency: { expression: pointValue("PER_YEAR", 0.01) },
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
