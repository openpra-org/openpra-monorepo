import type { FaultTreeNode } from "mef-types/lib/systems-analysis/systems-analysis";
import { FaultTreeNodeType } from "mef-types/lib/systems-analysis/systems-analysis";
export interface ParsedOpenPsaFaultTree {
  treeName: string;
  topEventId: string;
  nodes: Record<string, FaultTreeNode>;
}
const LOGIC_TAG_TO_NODE_TYPE: Record<string, FaultTreeNodeType> = {
  and: FaultTreeNodeType.AND_GATE,
  or: FaultTreeNodeType.OR_GATE,
  atleast: FaultTreeNodeType.ATLEAST_GATE,
  not: FaultTreeNodeType.INHIBIT_GATE,
  inhibit: FaultTreeNodeType.INHIBIT_GATE,
  xor: FaultTreeNodeType.OR_GATE,
};
const INPUT_TAGS = new Set(["gate", "basic-event", "house-event"]);
function getParseError(doc: Document): string | null {
  const el = doc.getElementsByTagName("parsererror")[0];
  return el ? (el.textContent?.trim() ?? "unknown XML parse error") : null;
}
function extractEventProbability(el: Element): number {
  const floatEl = el.querySelector("float");
  if (floatEl) {
    const v = parseFloat(floatEl.getAttribute("value") ?? "0");
    return isNaN(v) ? 0 : Math.max(0, Math.min(1, v));
  }
  return 0;
}
export function parseOpenPsaXml(xmlString: string): ParsedOpenPsaFaultTree {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");
  const parseError = getParseError(doc);
  if (parseError) throw new Error(`XML parse error: ${parseError}`);
  const root = doc.documentElement;
  const ftDef = root.querySelector("define-fault-tree");
  if (!ftDef) throw new Error("No <define-fault-tree> element found in XML");
  const treeName = ftDef.getAttribute("name") ?? "imported";
  const eventProbs = new Map<string, number>();
  root.querySelectorAll("model-data > define-basic-event").forEach((el) => {
    const name = el.getAttribute("name");
    if (name) eventProbs.set(name, extractEventProbability(el));
  });
  ftDef.querySelectorAll("define-basic-event").forEach((el) => {
    const name = el.getAttribute("name");
    if (name && !eventProbs.has(name)) {
      eventProbs.set(name, extractEventProbability(el));
    }
  });
  const houseStates = new Map<string, boolean>();
  root.querySelectorAll("model-data > define-house-event").forEach((el) => {
    const name = el.getAttribute("name");
    if (!name) return;
    const constEl = el.querySelector("constant");
    if (constEl) {
      houseStates.set(name, constEl.getAttribute("value") === "true");
    } else {
      houseStates.set(name, false);
    }
  });
  interface GateDef {
    type: FaultTreeNodeType;
    inputs: string[];
    kValue?: number;
  }
  const gateMap = new Map<string, GateDef>();
  const referencedGates = new Set<string>();
  const referencedEvents = new Set<string>();
  ftDef.querySelectorAll("define-gate").forEach((gateDef) => {
    const gateName = gateDef.getAttribute("name");
    if (!gateName) return;
    const logicEl = Array.from(gateDef.children).find(
      (c) => LOGIC_TAG_TO_NODE_TYPE[c.tagName.toLowerCase()] !== undefined,
    );
    if (!logicEl) return;
    const tagLower = logicEl.tagName.toLowerCase();
    const type = LOGIC_TAG_TO_NODE_TYPE[tagLower] ?? FaultTreeNodeType.OR_GATE;
    let kValue: number | undefined;
    if (tagLower === "atleast") {
      const k = parseInt(logicEl.getAttribute("min") ?? "1", 10);
      kValue = isNaN(k) ? 1 : k;
    }
    const inputs: string[] = [];
    Array.from(logicEl.children).forEach((child) => {
      const childTag = child.tagName.toLowerCase();
      const childName = child.getAttribute("name");
      if (!childName || !INPUT_TAGS.has(childTag)) return;
      inputs.push(childName);
      if (childTag === "gate") {
        referencedGates.add(childName);
      } else {
        referencedEvents.add(childName);
      }
    });
    gateMap.set(gateName, { type, inputs, kValue });
  });
  if (gateMap.size === 0) throw new Error("No gates found in the fault tree");
  const allGateIds = new Set(gateMap.keys());
  const topCandidates = [...allGateIds].filter((id) => !referencedGates.has(id));
  if (topCandidates.length === 0) {
    throw new Error(
      "Could not determine top event: every gate is referenced by another gate. " +
        "The fault tree may have a cycle or multiple disconnected roots.",
    );
  }
  const topEventId = topCandidates[0];
  const nodes: Record<string, FaultTreeNode> = {};
  for (const [name, def] of gateMap) {
    const node: FaultTreeNode = {
      uuid: name,
      nodeType: def.type,
      name,
      inputs: def.inputs,
      position: { x: 0, y: 0 },
    };
    if (def.kValue !== undefined) node.kValue = def.kValue;
    nodes[name] = node;
  }
  for (const eventName of referencedEvents) {
    if (nodes[eventName]) continue;
    if (houseStates.has(eventName)) {
      nodes[eventName] = {
        uuid: eventName,
        nodeType: FaultTreeNodeType.HOUSE_EVENT,
        name: eventName,
        houseEventValue: houseStates.get(eventName) ?? false,
        inputs: [],
        position: { x: 0, y: 0 },
      };
    } else {
      nodes[eventName] = {
        uuid: eventName,
        nodeType: FaultTreeNodeType.BASIC_EVENT,
        name: eventName,
        probability: eventProbs.get(eventName) ?? 0,
        probabilityType: "constant",
        inputs: [],
        position: { x: 0, y: 0 },
      };
    }
  }
  return { treeName, topEventId, nodes };
}
