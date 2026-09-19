import { z } from "zod";
import {
  BayesianNetworkModelSchema,
  validateBayesianNetworkModel,
  type BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { createEmptyBayesianNetwork, createUniformCpt, newId } from "./bayesianNetworkOperations";

// Main PRAXIS src/hcl/input.rs: CanonicalBayesianNetwork/CanonicalBayesianVariable.
const CanonicalBayesianNetworkSchema = z
  .object({
    id: z.string().nullable().optional(),
    variables: z
      .array(
        z
          .object({
            name: z.string().trim().min(1),
            states: z.array(z.string().trim().min(1)).min(1),
            parents: z.array(z.string().trim().min(1)).default([]),
            probabilities: z.array(z.number().finite().min(0).max(1)).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

type CanonicalBayesianNetwork = z.infer<typeof CanonicalBayesianNetworkSchema>;

function validateInterchangeModel(input: unknown): BayesianNetworkModel {
  const model = BayesianNetworkModelSchema.parse(input);
  if (model.nodes.length === 0) throw new Error("The Bayesian network must contain at least one node.");
  const errors = validateBayesianNetworkModel(model).filter((issue) => issue.severity === "ERROR");
  if (errors.length > 0) throw new Error(errors.map((issue) => issue.message).join("; "));
  return model;
}

function toCanonicalBayesianNetwork(input: BayesianNetworkModel): CanonicalBayesianNetwork {
  const model = validateInterchangeModel(input);
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const tableById = new Map(model.conditionalProbabilityTables.map((table) => [table.nodeId, table]));
  return {
    id: model.code,
    variables: model.nodes.map((node) => {
      const table = tableById.get(node.id)!;
      const parents = [...table.parents].sort((a, b) => a.order - b.order).map((p) => nodeById.get(p.nodeId)!);
      // TensorBayes graph.rs: axes [parents..., child]; child varies fastest.
      // Same parent-state indexing as praxis-node/src/bayesian_network.rs.
      const rows = new Map(
        table.rows.map((row) => {
          const selections = new Map(row.parentStates.map((p) => [p.parentNodeId, p.stateId]));
          const index = parents.reduce(
            (index, parent) =>
              index * parent.states.length + parent.states.findIndex((state) => state.id === selections.get(parent.id)),
            0,
          );
          return [index, row];
        }),
      );
      return {
        name: node.code,
        states: node.states.map((state) => state.code),
        parents: parents.map((parent) => parent.code),
        probabilities: Array.from({ length: rows.size }, (_, index) => {
          const values = new Map(rows.get(index)!.values.map((value) => [value.stateId, value.probability]));
          return node.states.map((state) => values.get(state.id)!);
        }).flat(),
      };
    }),
  };
}

function fromCanonicalBayesianNetwork(input: unknown, current?: BayesianNetworkModel): BayesianNetworkModel {
  const canonical = CanonicalBayesianNetworkSchema.parse(input);
  const code = canonical.id?.trim() || "BN-IMPORTED";
  const model = createEmptyBayesianNetwork(code);
  model.code = code;
  if (current !== undefined) {
    model.modelId = current.modelId;
    // Templates are self-contained; instances refer to the replaced graph.
    if (current.moduleTemplates !== undefined) model.moduleTemplates = current.moduleTemplates;
  }
  const codes = new Set<string>();
  model.nodes = canonical.variables.map((variable) => {
    if (codes.has(variable.name)) throw new Error(`Bayesian node '${variable.name}' is duplicated.`);
    codes.add(variable.name);
    return {
      id: newId(),
      kind: "CHANCE_NODE",
      code: variable.name,
      name: variable.name,
      description: "",
      states: variable.states.map((code) => ({
        id: newId(),
        code,
        name: code,
      })) as BayesianNetworkModel["nodes"][number]["states"],
    };
  });
  const nodeByCode = new Map(model.nodes.map((node) => [node.code, node]));
  model.nodePositions = model.nodes.map((node, index) => ({
    nodeId: node.id,
    position: { x: 44 + (index % 3) * 250, y: 44 + Math.floor(index / 3) * 140 },
  }));
  model.conditionalProbabilityTables = canonical.variables.map((variable, index) => {
    const node = model.nodes[index]!;
    const parents = variable.parents.map((code, order) => {
      const parent = nodeByCode.get(code);
      if (parent === undefined) throw new Error(`Node '${variable.name}' references missing parent '${code}'.`);
      return { nodeId: parent.id, order };
    });
    model.edges.push(...parents.map((parent) => ({ id: newId(), parentNodeId: parent.nodeId, childNodeId: node.id })));
    const table = createUniformCpt(model, node.id, parents);
    const expected = table.rows.length * node.states.length;
    if (variable.probabilities.length !== expected) {
      throw new Error(`Node '${variable.name}' requires ${String(expected)} probability values.`);
    }
    table.rows.forEach((row, rowIndex) =>
      row.values.forEach((value, stateIndex) => {
        value.probability = variable.probabilities[rowIndex * node.states.length + stateIndex]!;
      }),
    );
    return table;
  });
  return validateInterchangeModel(model);
}

export { fromCanonicalBayesianNetwork, toCanonicalBayesianNetwork, validateInterchangeModel };
