import { type MasterLogicDiagram } from "interfaces-mef-types/cross-cutting/methods/master-logic-diagram";
import { type HeatBalanceFaultTree } from "interfaces-mef-types/cross-cutting/methods/heat-balance-fault-tree";
import {
  type FaultTreeEditorCatalogue,
  type FaultTreeEditorModel,
} from "../newly-developed-methods/fault-tree";

interface FaultTreeAdapterSnapshot {
  model: FaultTreeEditorModel;
  catalogue: FaultTreeEditorCatalogue;
}

const DEFAULT_LAYOUT: FaultTreeEditorModel["layout"] = {
  viewport: { x: 0, y: 0, zoom: 1 },
  mode: "AUTOMATIC",
  direction: "TOP_TO_BOTTOM",
};

function splitTitle(text: string): { label: string; detail: string } {
  const t = text.trim();
  const colon = t.indexOf(": ");
  if (colon > 0 && colon <= 78) return { label: t.slice(0, colon), detail: t.slice(colon + 2) };
  if (t.length <= 78) return { label: t, detail: "" };
  const cut = t.slice(0, 76).lastIndexOf(" ");
  return { label: `${t.slice(0, cut > 0 ? cut : 76)}…`, detail: t };
}

function withTraceability(detail: string, ids: readonly string[]): string {
  const traceability = ids.length === 0 ? "" : `Derived initiators: ${ids.join(", ")}`;
  return [detail, traceability].filter((part) => part.length > 0).join("\n\n");
}

function mldToFaultTree(mld: MasterLogicDiagram): FaultTreeAdapterSnapshot {
  const nodeIds = new Set(mld.nodes.map(({ id }) => id));
  const parentIds = new Set(
    mld.nodes.flatMap(({ parentId }) =>
      parentId !== undefined && nodeIds.has(parentId) ? [parentId] : [],
    ),
  );
  const gateNodes = mld.nodes.filter(
    (node) =>
      parentIds.has(node.id) ||
      node.parentId === undefined ||
      !nodeIds.has(node.parentId),
  );
  const leafNodes = mld.nodes.filter((node) => !gateNodes.includes(node));
  const gateIds = new Set(gateNodes.map(({ id }) => id));
  const inputOrder = new Map<string, number>();

  const gates: FaultTreeEditorModel["gates"] = gateNodes.map((node) => {
    const { label, detail } = splitTitle(node.description);
    return {
      id: node.id,
      kind: "GATE",
      gateType: "OR",
      code: node.id,
      name: label,
      description: withTraceability(detail, node.derivedInitiatorIds),
    };
  });
  const leaves: FaultTreeEditorModel["leafNodes"] = leafNodes.map((node) => ({
    id: node.id,
    kind: "BASIC_EVENT_REFERENCE",
    basicEventId: `IE-MLD-BE:${node.id}`,
  }));
  const gateInputs: FaultTreeEditorModel["gateInputs"] = mld.nodes.flatMap((node, index) => {
    if (node.parentId === undefined || !gateIds.has(node.parentId)) return [];
    const order = inputOrder.get(node.parentId) ?? 0;
    inputOrder.set(node.parentId, order + 1);
    return [{
      id: `IE-MLD-IN:${index}`,
      gateId: node.parentId,
      childId: node.id,
      order,
    }];
  });
  const catalogue: FaultTreeEditorCatalogue = {
    basicEvents: leafNodes.map((node) => {
      const { label, detail } = splitTitle(node.description);
      return {
        id: `IE-MLD-BE:${node.id}`,
        code: node.id,
        name: label,
        description: withTraceability(detail, node.derivedInitiatorIds),
        probability: { value: 0 },
      };
    }),
    presentations: leafNodes.flatMap((node) =>
      node.derivedInitiatorIds.length === 0
        ? []
        : [{
            basicEventId: `IE-MLD-BE:${node.id}`,
            failureModeLabel: node.derivedInitiatorIds.join(", "),
            failureModeShort: node.derivedInitiatorIds.join(", "),
          }],
    ),
  };
  const topGate =
    gateNodes.find(
      (node) => node.parentId === undefined || !nodeIds.has(node.parentId),
    ) ?? gateNodes[0];

  return {
    model: {
      modelId: mld.uuid,
      code: mld.uuid,
      name: mld.name,
      description: mld.description ?? "",
      topGate: topGate === undefined ? null : { gateId: topGate.id },
      gates,
      leafNodes: leaves,
      gateInputs,
      nodePositions: [],
      layout: { ...DEFAULT_LAYOUT, viewport: { ...DEFAULT_LAYOUT.viewport } },
    },
    catalogue,
  };
}

function hbftToFaultTree(trees: HeatBalanceFaultTree[]): FaultTreeAdapterSnapshot {
  const rootId = "IE-HBFT-ROOT";
  const gates: FaultTreeEditorModel["gates"] = [
    {
      id: rootId,
      kind: "GATE",
      gateType: "OR",
      code: "HBFT",
      name: "Heat-balance fault trees",
      description: "Loss of the full-power energy balance, decomposed per tree.",
    },
  ];
  const leafNodes: FaultTreeEditorModel["leafNodes"] = [];
  const gateInputs: FaultTreeEditorModel["gateInputs"] = [];
  const catalogue: FaultTreeEditorCatalogue = { basicEvents: [], presentations: [] };

  trees.forEach((tree, treeIndex) => {
    const treeGateId = `IE-HBFT-GATE:${tree.uuid}`;
    const { label } = splitTitle(tree.name);
    gates.push({
      id: treeGateId,
      kind: "GATE",
      gateType: "OR",
      code: tree.uuid,
      name: label,
      description: withTraceability(
        tree.imbalances.map(({ description }) => description).join("; "),
        tree.identifiedInitiatorIds,
      ),
    });
    gateInputs.push({
      id: `IE-HBFT-IN:TREE:${treeIndex}`,
      gateId: rootId,
      childId: treeGateId,
      order: treeIndex,
    });

    tree.causes.forEach((cause, causeIndex) => {
      const leafId = `IE-HBFT-LEAF:${tree.uuid}:${cause.id}`;
      const basicEventId = `IE-HBFT-BE:${tree.uuid}:${cause.id}`;
      const { label: causeLabel, detail } = splitTitle(cause.description);
      leafNodes.push({ id: leafId, kind: "BASIC_EVENT_REFERENCE", basicEventId });
      catalogue.basicEvents.push({
        id: basicEventId,
        code: cause.id,
        name: causeLabel,
        description: detail,
        probability: { value: cause.probability ?? 0 },
      });
      gateInputs.push({
        id: `IE-HBFT-IN:CAUSE:${treeIndex}:${causeIndex}`,
        gateId: treeGateId,
        childId: leafId,
        order: causeIndex,
      });
    });
  });

  return {
    model: {
      modelId: "IE-HBFT",
      code: "HBFT",
      name: "Heat-balance fault trees",
      description: "Loss of the full-power energy balance, decomposed per tree.",
      topGate: { gateId: rootId },
      gates,
      leafNodes,
      gateInputs,
      nodePositions: [],
      layout: { ...DEFAULT_LAYOUT, viewport: { ...DEFAULT_LAYOUT.viewport } },
    },
    catalogue,
  };
}

export { mldToFaultTree, hbftToFaultTree };
export type { FaultTreeAdapterSnapshot };
