import { keyError, valueError } from "./errors";

interface KeyBinding {
  key: string;
  nodeId: string;
}

class Registry {
  private readonly keyToNode = new Map<string, string>();

  private readonly nodeToKey = new Map<string, string>();

  register(key: string, nodeId: string): KeyBinding {
    if (key.length === 0) throw valueError("Canonical key cannot be empty.");
    if (nodeId.length === 0) throw valueError("Node id cannot be empty.");
    const existingNode = this.keyToNode.get(key);
    if (existingNode !== undefined && existingNode !== nodeId) {
      throw valueError(`Key '${key}' already mapped to node '${existingNode}', cannot remap to '${nodeId}'.`);
    }
    const existingKey = this.nodeToKey.get(nodeId);
    if (existingKey !== undefined && existingKey !== key) {
      throw valueError(`Node id '${nodeId}' already bound to key '${existingKey}', cannot bind to '${key}'.`);
    }
    this.keyToNode.set(key, nodeId);
    this.nodeToKey.set(nodeId, key);
    return { key, nodeId };
  }

  hasKey(key: string): boolean {
    return this.keyToNode.has(key);
  }

  nodeId(key: string): string {
    const nodeId = this.keyToNode.get(key);
    if (nodeId === undefined) throw keyError(`Unknown canonical key: '${key}'.`);
    return nodeId;
  }

  key(nodeId: string): string {
    const key = this.nodeToKey.get(nodeId);
    if (key === undefined) throw keyError(`Unknown node id: '${nodeId}'.`);
    return key;
  }
}

export type { KeyBinding };
export { Registry };
