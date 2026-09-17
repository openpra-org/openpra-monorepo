import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import type { BayesianNetworkVisualSubmodel } from "./bayesianNetworkInterchange";

interface SubmodelViewEntity {
  id: string;
  nodeId?: string;
  group?: BayesianNetworkVisualSubmodel;
}
interface SubmodelViewEdge {
  from: string;
  to: string;
  count: number;
}

/** HCL_MH bn/panel.py:_gv_populate_modular: project edges onto the visible owners. */
function createSubmodelOverview(
  model: BayesianNetworkModel,
  groups: BayesianNetworkVisualSubmodel[],
  scope: string | null,
) {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const focus = scope !== null && byId.has(scope) ? scope : null;
  const membership = new Map(groups.flatMap((group) => group.nodeIds.map((id) => [id, group.id] as const)));
  const children = groups.filter((group) => group.parentId === focus);
  const direct = model.nodes.filter((node) => (membership.get(node.id) ?? null) === focus);
  const entities: SubmodelViewEntity[] = [
    ...children.map((group) => ({ id: `group:${group.id}`, group })),
    ...direct.map((node) => ({ id: `node:${node.id}`, nodeId: node.id })),
  ];
  function owner(nodeId: string): string | null {
    let groupId = membership.get(nodeId) ?? null;
    if (groupId === focus) return `node:${nodeId}`;
    while (groupId !== null) {
      const group = byId.get(groupId);
      if (group === undefined) return null;
      if (group.parentId === focus) return `group:${group.id}`;
      groupId = group.parentId;
    }
    return null;
  }
  const visible = new Set(entities.map((entity) => entity.id));
  const connections = new Map<string, SubmodelViewEdge>();
  for (const edge of model.edges) {
    const from = owner(edge.parentNodeId),
      to = owner(edge.childNodeId);
    if (from === null || to === null || from === to || !visible.has(from) || !visible.has(to)) continue;
    const key = JSON.stringify([from, to]);
    const previous = connections.get(key);
    connections.set(key, { from, to, count: (previous?.count ?? 0) + 1 });
  }
  return { focus, entities, edges: [...connections.values()] };
}

/** Presentation layout also handles cycles introduced by collapsing an acyclic BN. */
function arrangeSubmodelOverview(view: ReturnType<typeof createSubmodelOverview>, heights: Record<string, number>) {
  const pending = new Set(view.entities.map((entity) => entity.id));
  const positions = new Map<string, { x: number; y: number }>();
  let x = 40;
  while (pending.size > 0) {
    const ready = [...pending].filter((id) => !view.edges.some((edge) => edge.to === id && pending.has(edge.from)));
    const batch = ready.length > 0 ? ready : [...pending];
    let y = 40;
    for (const id of batch) {
      const entity = view.entities.find((entry) => entry.id === id)!;
      const key = entity.nodeId ?? entity.id;
      positions.set(key, { x, y });
      y += (heights[key] ?? 84) + 60;
      pending.delete(id);
    }
    x += 270;
  }
  return positions;
}

export { createSubmodelOverview, arrangeSubmodelOverview };
export type { SubmodelViewEntity, SubmodelViewEdge };
