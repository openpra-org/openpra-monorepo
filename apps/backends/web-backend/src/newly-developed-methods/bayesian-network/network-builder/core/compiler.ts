import type { ModelContext } from "./context";
import { valueError } from "./errors";
import { assertValidNetworkModel } from "./network-model";
import type { NetworkCpd, NetworkEdge, NetworkModel, NetworkNode } from "./network-model";
import { writeNetworkFile } from "./network-file-writer";
import type { NetworkFileOptions } from "./network-file-writer";
import { sortedText } from "./spec-values";

const compileNetworkModel = (context: ModelContext): NetworkModel => {
  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];
  const cpds: NetworkCpd[] = [];
  for (const nodeId of sortedText(context.model.nodes().keys())) {
    const node = context.model.node(nodeId);
    if (node.cpdTable === null) throw valueError(`Node '${nodeId}' has no generated CPD table.`);
    nodes.push({
      nodeId: node.nodeId,
      kind: "chance_cpt",
      states: Array.from(node.states),
      metadata: { ...node.metadata, canonical_key: node.key },
    });
    cpds.push({ node: node.nodeId, parents: Array.from(node.parents), table: Array.from(node.cpdTable) });
    for (const parent of node.parents) edges.push({ parent, child: node.nodeId });
  }
  return {
    schemaVersion: context.schemaVersion,
    modelId: context.modelId,
    description: context.description,
    nodes,
    edges,
    cpds,
    metadata: { ...context.metadata },
  };
};

interface CompiledNetwork {
  model: NetworkModel;
  fileText: string;
}

const validateAndWriteNetworkFile = (
  context: ModelContext,
  options: NetworkFileOptions,
  probabilityTolerance = 1e-9,
): CompiledNetwork => {
  const model = compileNetworkModel(context);
  assertValidNetworkModel(model, probabilityTolerance);
  return { model, fileText: writeNetworkFile(model, options) };
};

export type { CompiledNetwork };
export { compileNetworkModel, validateAndWriteNetworkFile };
