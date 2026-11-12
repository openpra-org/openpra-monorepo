import type { ModelContext } from "./context";
import { keyError, valueError } from "./errors";
import { sortedText, text } from "./spec-values";
import type { SpecMapping, SpecValue } from "./spec-values";

type CpdGenerator = (context: ModelContext, node: NodeRecord) => number[];

interface NodeRecord {
  key: string;
  nodeId: string;
  states: string[];
  metadata: SpecMapping;
  parents: string[];
  cpdTable: number[] | null;
  cpdGenerator: CpdGenerator | null;
}

interface AddNodeInput {
  key: string;
  nodeId: string;
  states: readonly SpecValue[];
  metadata?: SpecMapping | null;
  parentIds?: readonly string[] | null;
  cpdGenerator?: CpdGenerator | null;
}

class WorkingModel {
  private readonly records = new Map<string, NodeRecord>();

  private readonly dirtyNodes = new Set<string>();

  addNode(input: AddNodeInput): NodeRecord {
    if (this.records.has(input.nodeId)) {
      throw valueError(`Duplicate node id in working model: '${input.nodeId}'.`);
    }
    const states = input.states.map((state) => text(state));
    if (states.length < 2) {
      throw valueError(`Node '${input.nodeId}' must have at least two states.`);
    }
    const parents = Array.from(input.parentIds ?? []);
    for (const parent of parents) {
      if (!this.records.has(parent)) {
        throw valueError(`Node '${input.nodeId}' declares unknown parent id '${parent}' during add_node.`);
      }
    }
    if (parents.length !== new Set(parents).size) {
      throw valueError(`Node '${input.nodeId}' has duplicate parent ids in add_node.`);
    }
    const node: NodeRecord = {
      key: input.key,
      nodeId: input.nodeId,
      states,
      metadata: { ...(input.metadata ?? {}) },
      parents: sortedText(parents),
      cpdTable: null,
      cpdGenerator: input.cpdGenerator ?? null,
    };
    this.records.set(input.nodeId, node);
    this.markDirty(input.nodeId);
    return node;
  }

  hasNode(nodeId: string): boolean {
    return this.records.has(nodeId);
  }

  node(nodeId: string): NodeRecord {
    const record = this.records.get(nodeId);
    if (record === undefined) throw keyError(`Unknown node id in working model: '${nodeId}'.`);
    return record;
  }

  nodes(): Map<string, NodeRecord> {
    return new Map(this.records);
  }

  markDirty(nodeId: string): void {
    if (!this.records.has(nodeId)) throw keyError(`Cannot mark unknown node '${nodeId}' dirty.`);
    this.dirtyNodes.add(nodeId);
  }

  addParentEdge(parentId: string, childId: string): boolean {
    if (!this.records.has(parentId)) throw keyError(`Cannot add edge: unknown parent node '${parentId}'.`);
    if (!this.records.has(childId)) throw keyError(`Cannot add edge: unknown child node '${childId}'.`);
    if (parentId === childId) throw valueError(`Self loop is not allowed: '${parentId}' -> '${childId}'.`);
    const child = this.node(childId);
    if (child.parents.includes(parentId)) return false;
    child.parents = sortedText([...child.parents, parentId]);
    this.markDirty(childId);
    return true;
  }

  card(nodeId: string): number {
    return this.node(nodeId).states.length;
  }

  parentConfigurationCount(nodeId: string): number {
    let count = 1;
    for (const parent of this.node(nodeId).parents) count *= this.node(parent).states.length;
    return count;
  }

  expectedCpdSize(nodeId: string): number {
    return this.parentConfigurationCount(nodeId) * this.node(nodeId).states.length;
  }

  regenerateDirtyCpds(context: ModelContext): void {
    if (this.dirtyNodes.size === 0) return;
    const order = sortedText(this.dirtyNodes);
    this.dirtyNodes.clear();
    for (const nodeId of order) {
      const node = this.node(nodeId);
      if (node.cpdGenerator === null) {
        throw valueError(
          `Node '${nodeId}' is dirty but has no CPD generator. Add a generator to support CPD regeneration.`,
        );
      }
      const table = Array.from(node.cpdGenerator(context, node));
      const expected = this.expectedCpdSize(nodeId);
      if (table.length !== expected) {
        throw valueError(`CPD generator size mismatch for '${nodeId}': got ${table.length}, expected ${expected}.`);
      }
      node.cpdTable = table;
    }
  }
}

export type { AddNodeInput, CpdGenerator, NodeRecord };
export { WorkingModel };
