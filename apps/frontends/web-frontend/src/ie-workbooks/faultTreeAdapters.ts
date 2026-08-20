import { type MasterLogicDiagram } from "interfaces-mef-types/cross-cutting/methods/master-logic-diagram";
import { type HeatBalanceFaultTree } from "interfaces-mef-types/cross-cutting/methods/heat-balance-fault-tree";
import { type FtInputNode } from "../newly-developed-methods/fault-tree/faultTreeTypes";

function splitTitle(text: string): { label: string; detail: string } {
  const t = text.trim();
  const colon = t.indexOf(": ");
  if (colon > 0 && colon <= 78) return { label: t.slice(0, colon), detail: t.slice(colon + 2) };
  if (t.length <= 78) return { label: t, detail: "" };
  const cut = t.slice(0, 76).lastIndexOf(" ");
  return { label: `${t.slice(0, cut > 0 ? cut : 76)}…`, detail: t };
}

function mldToFaultTree(mld: MasterLogicDiagram): FtInputNode[] {
  const parents = new Set(mld.nodes.filter((n) => n.parentId !== undefined && n.parentId.length > 0).map((n) => n.parentId));
  return mld.nodes.map((n) => {
    const isGate = n.parentId === undefined || n.parentId.length === 0 || parents.has(n.id);
    const { label, detail } = splitTitle(n.description);
    return {
      id: n.id,
      parentId: n.parentId !== undefined && n.parentId.length > 0 ? n.parentId : undefined,
      data: { label, detail, type: isGate ? "GATE" : "BASIC", gate: isGate ? "OR" : undefined, badges: n.derivedInitiatorIds },
    };
  });
}

function hbftToFaultTree(trees: HeatBalanceFaultTree[]): FtInputNode[] {
  const out: FtInputNode[] = [
    { id: "HBFT-ROOT", data: { label: "Heat-balance fault trees", detail: "Loss of the full-power energy balance, decomposed per tree.", type: "GATE", gate: "OR" } },
  ];
  trees.forEach((tree, i) => {
    const tid = `HBFT-T${i + 1}`;
    out.push({
      id: tid,
      parentId: "HBFT-ROOT",
      data: {
        label: splitTitle(tree.name).label,
        detail: tree.imbalances.map((im) => im.description).join("; "),
        type: "GATE",
        gate: "OR",
        badges: tree.identifiedInitiatorIds,
      },
    });
    tree.causes.forEach((cause, j) => {
      const { label, detail } = splitTitle(cause.description);
      out.push({ id: `${tid}-c${j + 1}`, parentId: tid, data: { label, detail, type: "BASIC" } });
    });
  });
  return out;
}

export { mldToFaultTree, hbftToFaultTree };
