import assert from "node:assert/strict";
import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { EventSequenceAnalysis, EventTree } from "interfaces-mef-types/es/event-sequence-analysis";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import type { WorkbookBayesianNetwork, WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import type {
  AnalysisRunWorkbookSnapshot,
  WorkbookModelAddress,
} from "interfaces-shared-types/newly-developed-methods/shared";
import type { PraetorAnalysisClient } from "../praetor-analysis.client";

/** Test-only counterparts of main's tests/hcl_equivalence.rs: deterministic
 * unified BN and bounded full-state enumeration. No production FT/ET adapter,
 * BDD, HCL traversal or result-derived sequence formula is used here. */
type Observation = { nodeId: string; stateId: string };
type Top = WorkbookModelAddress & { entityId: string };
type Condition = { top: Top; failure: boolean };
export type OracleSequence = {
  chain: Array<{ modelId: string; entityId: string }>;
  conditions: Condition[];
  endStateId: string;
  initiatingFrequency: number;
};
type Executor = (
  envelope: Parameters<PraetorAnalysisClient["execute"]>[0],
) => ReturnType<PraetorAnalysisClient["execute"]>;

export function assertProbability(actual: number, expected: number, label = "probability", absoluteRoundoff = 0): void {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), `${label}: nonfinite result`);
  if (expected === 0) assert.equal(actual, 0, `${label}: expected exact zero`);
  else {
    assert.ok(actual > 0, `${label}: positive probability was lost`);
    const tolerance = Math.min(1e-3 * Math.abs(expected), 2e-10 * Math.abs(expected) + absoluteRoundoff);
    assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
  }
}

class UnifiedNetwork {
  readonly model: WorkbookBayesianNetwork;
  private deterministic = new Map<string, (values: Map<string, string>) => string>();
  private cache = new Map<string, string>();
  private active = new Set<string>();
  private counter = 0;

  constructor(private readonly source: WorkbookOracle) {
    this.model = structuredClone(source.network);
  }

  private binary(key: string, parents: string[], truth: (states: string[]) => boolean): string {
    const id = `oracle-${this.counter++}`;
    const unique = [...new Set(parents)];
    const cards = unique.map((parent) => this.model.nodes.find((node) => node.id === parent)!.states);
    const count = cards.reduce((n, states) => n * states.length, 1);
    assert.ok(count <= 65536, "Bounded test gate CPT exceeded its limit");
    this.model.nodes.push({
      id,
      kind: "CHANCE_NODE",
      code: id,
      name: key,
      description: "Test oracle",
      states: [
        { id: "false", code: "F", name: "False" },
        { id: "true", code: "T", name: "True" },
      ],
    });
    const evaluate = (assignment: Map<string, string>) =>
      truth(parents.map((parent) => assignment.get(parent)!)) ? "true" : "false";
    this.deterministic.set(id, evaluate);
    this.model.edges.push(
      ...unique.map((parentNodeId) => ({ id: `${id}:${parentNodeId}`, parentNodeId, childNodeId: id })),
    );
    this.model.conditionalProbabilityTables.push({
      nodeId: id,
      parents: unique.map((nodeId, order) => ({ nodeId, order })),
      rows: Array.from({ length: count }, (_, code) => {
        const assignment = new Map<string, string>();
        for (let i = unique.length - 1; i >= 0; i--) {
          const states = cards[i]!;
          assignment.set(unique[i]!, states[code % states.length]!.id);
          code = Math.floor(code / states.length);
        }
        const yes = evaluate(assignment) === "true";
        return {
          id: `${id}:${this.model.conditionalProbabilityTables.length}:${JSON.stringify([...assignment])}`,
          parentStates: [...assignment].map(([parentNodeId, stateId]) => ({ parentNodeId, stateId })),
          values: [
            { stateId: "false", probability: yes ? 0 : 1 },
            { stateId: "true", probability: yes ? 1 : 0 },
          ],
        };
      }),
    });
    return id;
  }

  event(workbookId: string, eventId: string): string {
    const key = `event:${workbookId}:${eventId}`;
    const existing = this.cache.get(key);
    if (existing) return existing;
    const binding = this.source.configuration.bindings.find(
      (row) => row.faultTreeBasicEvent.workbookId === workbookId && row.faultTreeBasicEvent.entityId === eventId,
    );
    let id: string;
    if (binding) {
      id = this.binary(key, [binding.bayesianNetworkNode.entityId], ([state]) => binding.trueStateIds.includes(state!));
    } else {
      const p = this.source.eventProbability(workbookId, eventId);
      id = this.binary(key, [], () => false);
      this.deterministic.delete(id);
      this.model.conditionalProbabilityTables.at(-1)!.rows[0]!.values = [
        { stateId: "false", probability: 1 - p },
        { stateId: "true", probability: p },
      ];
    }
    this.cache.set(key, id);
    return id;
  }

  top(reference: Top): string {
    const key = JSON.stringify(reference);
    const found = this.cache.get(key);
    if (found) return found;
    assert.ok(!this.active.has(key), "Cycle in test FT inputs");
    this.active.add(key);
    const model = this.source
      .systems(reference.workbookId)
      .systemLogicModels.find((row) => row.uuid === reference.modelId)!;
    assert.ok(model, `Missing source FT ${reference.modelId}`);
    const leaf = model.leafNodes?.find((row) => row.id === reference.entityId);
    let id: string;
    if (leaf?.kind === "BASIC_EVENT_REFERENCE") id = this.event(reference.workbookId, leaf.basicEventId);
    else if (leaf?.kind === "TRANSFER_REFERENCE") id = this.top({ ...reference, ...leaf.target });
    else if (leaf?.kind === "HOUSE_EVENT") id = this.binary(key, [], () => leaf.state);
    else {
      const gate = model.gates?.find((row) => row.id === reference.entityId);
      assert.ok(gate, `Unsupported or missing source gate ${key}`);
      const parents = model
        .gateInputs!.filter((row) => row.gateId === gate.id)
        .sort((a, b) => a.order - b.order)
        .map((row) => this.top({ ...reference, entityId: row.childId }));
      id = this.binary(key, parents, (states) => {
        const values = states.map((state) => state === "true");
        switch (gate.gateType) {
          case "AND":
            return values.every(Boolean);
          case "OR":
            return values.some(Boolean);
          case "NOT":
            assert.equal(values.length, 1);
            return !values[0];
          case "K_OF_N":
            return values.filter(Boolean).length >= gate.k;
        }
      });
    }
    this.active.delete(key);
    this.cache.set(key, id);
    return id;
  }

  sequence(conditions: Condition[]): string {
    // Associative binary ANDs keep deterministic CPTs bounded. This changes
    // only the verification model, never the production sequence BDD.
    const literals = conditions.map((row) => {
      const top = this.top(row.top);
      return row.failure ? top : this.binary("success", [top], ([state]) => state === "false");
    });
    return literals.reduce(
      (left, right) => this.binary("path", [left, right], (states) => states.every((state) => state === "true")),
      this.binary("initial", [], () => true),
    );
  }

  async query(top: string, execute: Executor, observations: Observation[]): Promise<number> {
    const response = await execute({
      schemaVersion: "1.0.0",
      request: {
        schemaVersion: "1.0.0",
        methodType: "BAYESIAN_NETWORK",
        modelId: "oracle",
        revision: 1,
        requestedBy: "independent-test",
        query: { queryNodeIds: [top], evidence: { observations } },
      },
      modelSnapshots: [{ ...this.model, id: "oracle", methodType: "BAYESIAN_NETWORK", revision: 1 }],
      resources: {},
    });
    assert.equal(response.error, undefined, JSON.stringify(response.error));
    const result = response.result as {
      marginals: Array<{ nodeId: string; values: Array<{ stateId: string; probability: number }> }>;
    };
    return result.marginals.find((row) => row.nodeId === top)!.values.find((row) => row.stateId === "true")!
      .probability;
  }

  enumerate(top: string, observations: Observation[]): number {
    const stochastic = this.model.nodes.filter((node) => !this.deterministic.has(node.id));
    const size = stochastic.reduce((n, node) => n * node.states.length, 1);
    assert.ok(size <= 1_000_000, "Full-state oracle is limited to compact cases, as in main");
    let numerator = 0,
      denominator = 0;
    for (let code = 0; code < size; code++) {
      let rest = code;
      const values = new Map<string, string>();
      for (const node of stochastic) {
        values.set(node.id, node.states[rest % node.states.length]!.id);
        rest = Math.floor(rest / node.states.length);
      }
      if (observations.some((row) => values.get(row.nodeId) !== row.stateId)) continue;
      let weight = 1;
      for (const node of stochastic) {
        const table = this.model.conditionalProbabilityTables.find((row) => row.nodeId === node.id)!;
        const row = table.rows.find((row) =>
          row.parentStates.every((parent) => values.get(parent.parentNodeId) === parent.stateId),
        )!;
        weight *= row.values.find((row) => row.stateId === values.get(node.id))!.probability;
      }
      for (const [id, evaluate] of this.deterministic) values.set(id, evaluate(values));
      denominator += weight;
      if (values.get(top) === "true") numerator += weight;
    }
    assert.ok(denominator > 0, "Impossible oracle evidence");
    return numerator / denominator;
  }
}

export class WorkbookOracle {
  readonly configuration: WorkbookHclConfiguration;
  readonly network: WorkbookBayesianNetwork;
  constructor(
    private readonly snapshots: AnalysisRunWorkbookSnapshot[],
    configuration: WorkbookModelAddress,
  ) {
    const mef = this.mef(configuration.workbookId);
    const configurations = (mef["dependencyHclConfigurations"] ??
      mef["hclConfigurations"]) as WorkbookHclConfiguration[];
    this.configuration = configurations.find((row) => row.modelId === configuration.modelId)!;
    assert.ok(this.configuration, "Missing original HCL configuration");
    const owner = this.mef(this.configuration.bayesianNetwork.workbookId);
    this.network = (
      (owner["dependencyBayesianNetworks"] ?? owner["bayesianNetworks"]) as WorkbookBayesianNetwork[]
    ).find((row) => row.modelId === this.configuration.bayesianNetwork.modelId)!;
    assert.ok(this.network, "Missing original BN");
  }
  private mef(id: string): Record<string, unknown> {
    const source = this.snapshots.find((row) => row.identity.workbookId === id);
    assert.ok(source, `Missing original workbook ${id}`);
    return source.mef;
  }
  systems(id: string): SystemsAnalysis {
    return this.mef(id) as unknown as SystemsAnalysis;
  }
  private evidence(overrides: Observation[]): Observation[] {
    return [
      ...new Map(
        [...(this.configuration.baseEvidence?.observations ?? []), ...overrides].map((row) => [row.nodeId, row]),
      ).values(),
    ];
  }
  eventProbability(workbookId: string, id: string): number {
    const event = this.systems(workbookId).systemBasicEvents.find((row) => row.uuid === id)!;
    assert.ok(event, `Missing original event ${id}`);
    const ref = event.controlledDataSource;
    let value = event.probability;
    if (ref?.referenceType === "WORKBOOK_PARAMETER") {
      const parameter = (this.mef(ref.workbookId) as unknown as DataAnalysis).parameters.find(
        (row) => row.uuid === ref.entityId,
      )!;
      assert.ok(
        ["PROBABILITY", "UNAVAILABILITY", "HUMAN_ERROR_PROBABILITY"].includes(parameter.parameterType),
        "This oracle fixture requires probability-valued DA inputs",
      );
      value = parameter.value;
    } else if (ref?.referenceType === "HUMAN_FAILURE_EVENT") {
      const quantification = (this.mef(ref.workbookId) as unknown as HumanReliabilityAnalysis).hepQuantifications.find(
        (row) => row.uuid === ref.quantificationId && row.hfeId === ref.entityId,
      )!;
      value = quantification.meanHep ?? quantification.pointEstimateHep;
    }
    assert.ok(typeof value === "number" && value >= 0 && value <= 1, "Invalid oracle event probability");
    return value;
  }
  sequences(reference: WorkbookModelAddress): OracleSequence[] {
    const trees = (this.mef(reference.workbookId) as unknown as EventSequenceAnalysis).eventTrees ?? [];
    const root = trees.find((row) => row.uuid === reference.modelId)!;
    assert.ok(root);
    const walk = (tree: EventTree, chain: OracleSequence["chain"], conditions: Condition[]): OracleSequence[] => {
      assert.ok(!chain.some((row) => row.modelId === tree.uuid), "Cycle in source ET transfers");
      return Object.values(tree.sequences).flatMap((sequence) => {
        const next = [...chain, { modelId: tree.uuid, entityId: sequence.uuid }];
        const combined = [
          ...conditions,
          ...Object.entries(sequence.functionalEventStates ?? {}).flatMap(([id, state]) => {
            if (state === "BYPASSED") return [];
            const event = Object.values(tree.functionalEvents).find((row) => row.uuid === id)!;
            assert.ok(event?.faultTreeTopEvent);
            return [{ top: event.faultTreeTopEvent, failure: state === "FAILURE" }];
          }),
        ];
        const transfer = tree.transfers?.[sequence.uuid];
        if (transfer) {
          const target = trees.find((row) => row.uuid === transfer.targetEventTreeId)!;
          assert.ok(target);
          return walk(target, next, combined);
        }
        const endStateId = sequence.endState === undefined ? undefined : tree.endStateIds?.[sequence.endState];
        assert.ok(endStateId);
        return [
          { chain: next, conditions: combined, endStateId, initiatingFrequency: root.initiatingEventFrequency!.value },
        ];
      });
    };
    return walk(root, [], []);
  }
  async verifyEventTree(
    reference: WorkbookModelAddress,
    result: EventTreeAnalysisResult,
    execute: Executor,
    observations: Observation[] = [],
    fullState = false,
    absoluteRoundoff = 0,
  ): Promise<void> {
    const sequences = this.sequences(reference);
    assert.equal(result.sequences.length, sequences.length);
    const aggregates = new Map<string, number>();
    for (const sequence of sequences) {
      const actual = result.sequences.find(
        (row) =>
          JSON.stringify(row.sequenceChain ?? [{ modelId: reference.modelId, entityId: row.sequenceId }]) ===
          JSON.stringify(sequence.chain),
      );
      assert.ok(actual, `Missing sequence chain ${JSON.stringify(sequence.chain)}`);
      assert.equal(actual.result.kind, "END_STATE");
      if (actual.result.kind === "END_STATE") assert.equal(actual.result.endStateId, sequence.endStateId);
      const expected = await this.sequence(sequence, execute, observations);
      if (fullState) assertProbability(expected, this.enumerate(sequence, observations), "Unified BN vs enumeration");
      assertProbability(actual.conditionalProbability, expected, `Sequence ${actual.sequenceId}`, absoluteRoundoff);
      const frequency = expected * sequence.initiatingFrequency;
      assertProbability(
        actual.annualFrequency,
        frequency,
        `Sequence frequency ${actual.sequenceId}`,
        absoluteRoundoff * sequence.initiatingFrequency,
      );
      aggregates.set(sequence.endStateId, (aggregates.get(sequence.endStateId) ?? 0) + frequency);
    }
    assert.equal(result.endStateAggregates.length, aggregates.size);
    for (const [id, expected] of aggregates) {
      const actual = result.endStateAggregates.find((row) => row.endStateId === id);
      assert.ok(actual, `Missing end state ${id}`);
      assertProbability(actual.annualFrequency, expected, `End state ${id}`, absoluteRoundoff);
    }
  }
  async faultTree(top: Top, execute: Executor, observations: Observation[] = []): Promise<number> {
    const bn = new UnifiedNetwork(this);
    return bn.query(bn.top(top), execute, this.evidence(observations));
  }
  async sequence(sequence: OracleSequence, execute: Executor, observations: Observation[] = []): Promise<number> {
    const bn = new UnifiedNetwork(this);
    return bn.query(bn.sequence(sequence.conditions), execute, this.evidence(observations));
  }
  enumerate(sequence: OracleSequence, observations: Observation[] = []): number {
    const bn = new UnifiedNetwork(this);
    return bn.enumerate(bn.sequence(sequence.conditions), this.evidence(observations));
  }
}
