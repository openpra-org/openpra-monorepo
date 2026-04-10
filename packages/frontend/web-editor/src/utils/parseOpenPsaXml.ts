/**
 * OpenPSA XML → OpenPRA MEF fault-tree converter.
 *
 * Accepts the text content of an OpenPSA MEF XML file and returns the MEF
 * `FaultTreeNode` map used by the OpenPRA web editor.
 *
 * Supported constructs:
 *   - `<define-fault-tree>` / `<define-gate>` (and, or, atleast, not, inhibit)
 *   - `<define-basic-event>` with `<float value="..."/>` in `<model-data>`
 *   - `<define-house-event>` with `<constant value="true|false"/>` in `<model-data>`
 *   - Inline `<define-basic-event>` inside the fault tree body
 *   - Shared events (a basic event referenced by more than one gate)
 *
 * Multiple `<define-fault-tree>` blocks: the first one is imported; gates from
 * the remaining trees are ignored (standard single-model workflows only).
 */

import type { FaultTreeNode } from "mef-types/lib/systems-analysis/systems-analysis";
import { FaultTreeNodeType } from "mef-types/lib/systems-analysis/systems-analysis";

// ─── Public result type ───────────────────────────────────────────────────────

export interface ParsedOpenPsaFaultTree {
  /** Name attribute of the <define-fault-tree> element */
  treeName: string;
  /** UUID of the root/top gate */
  topEventId: string;
  /** MEF node map (keyed by node UUID = original OpenPSA name) */
  nodes: Record<string, FaultTreeNode>;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Map OpenPSA gate element tag names to MEF node types. */
const LOGIC_TAG_TO_NODE_TYPE: Record<string, FaultTreeNodeType> = {
  and: FaultTreeNodeType.AND_GATE,
  or: FaultTreeNodeType.OR_GATE,
  atleast: FaultTreeNodeType.ATLEAST_GATE,
  not: FaultTreeNodeType.INHIBIT_GATE,
  inhibit: FaultTreeNodeType.INHIBIT_GATE,
  xor: FaultTreeNodeType.OR_GATE, // XOR → OR is an approximation for the visual editor
};

/** Tags that contribute child inputs to a gate. */
const INPUT_TAGS = new Set(["gate", "basic-event", "house-event"]);

/**
 * Safely read the text of the first `<parsererror>` descendant.
 * DOMParser embeds parse errors in the document when XML is malformed.
 */
function getParseError(doc: Document): string | null {
  const el = doc.getElementsByTagName("parsererror")[0];
  return el ? (el.textContent?.trim() ?? "unknown XML parse error") : null;
}

/**
 * Extract the basic event probability from a `<define-basic-event>` element.
 * Returns 0 if no probability can be determined.
 */
function extractEventProbability(el: Element): number {
  const floatEl = el.querySelector("float");
  if (floatEl) {
    const v = parseFloat(floatEl.getAttribute("value") ?? "0");
    return isNaN(v) ? 0 : Math.max(0, Math.min(1, v));
  }
  // Exponential: <exponential><parameter name="lambda"/><system-mission-time/></exponential>
  // We don't convert rate→probability here; leave probability at 0 for now.
  return 0;
}

// ─── Main converter ───────────────────────────────────────────────────────────

/**
 * Parse an OpenPSA MEF XML string and convert the first fault tree it contains
 * into an OpenPRA MEF `FaultTreeNode` map.
 *
 * @throws {Error} if the XML is malformed, contains no fault tree, or no top
 *   event can be determined.
 */
export function parseOpenPsaXml(xmlString: string): ParsedOpenPsaFaultTree {
  // ── Parse XML ──────────────────────────────────────────────────────────────
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");

  const parseError = getParseError(doc);
  if (parseError) throw new Error(`XML parse error: ${parseError}`);

  const root = doc.documentElement;

  // ── Find the fault tree block ──────────────────────────────────────────────
  const ftDef = root.querySelector("define-fault-tree");
  if (!ftDef) throw new Error("No <define-fault-tree> element found in XML");
  const treeName = ftDef.getAttribute("name") ?? "imported";

  // ── Collect event probabilities from <model-data> ─────────────────────────
  const eventProbs = new Map<string, number>();
  root.querySelectorAll("model-data > define-basic-event").forEach((el) => {
    const name = el.getAttribute("name");
    if (name) eventProbs.set(name, extractEventProbability(el));
  });

  // Inline basic events defined inside the fault tree body
  ftDef.querySelectorAll("define-basic-event").forEach((el) => {
    const name = el.getAttribute("name");
    if (name && !eventProbs.has(name)) {
      eventProbs.set(name, extractEventProbability(el));
    }
  });

  // ── Collect house event states from <model-data> ──────────────────────────
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

  // ── Parse gates ────────────────────────────────────────────────────────────
  interface GateDef {
    type: FaultTreeNodeType;
    inputs: string[];
    kValue?: number;
  }

  const gateMap = new Map<string, GateDef>();
  /** Gate IDs that appear as a child reference inside another gate. */
  const referencedGates = new Set<string>();
  /** Event IDs (basic or house) referenced by gates. */
  const referencedEvents = new Set<string>();

  ftDef.querySelectorAll("define-gate").forEach((gateDef) => {
    const gateName = gateDef.getAttribute("name");
    if (!gateName) return;

    // Find the logic operator element (first element child that is a known tag).
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

  // ── Determine top event ────────────────────────────────────────────────────
  // The top event is the gate that is never used as a child of another gate.
  const allGateIds = new Set(gateMap.keys());
  const topCandidates = [...allGateIds].filter((id) => !referencedGates.has(id));

  if (topCandidates.length === 0) {
    throw new Error(
      "Could not determine top event: every gate is referenced by another gate. " +
        "The fault tree may have a cycle or multiple disconnected roots.",
    );
  }

  // If (unexpectedly) more than one root, take the first — the XML order is preserved
  // because Map iteration follows insertion order and the XML is parsed top-to-bottom.
  const topEventId = topCandidates[0];

  // ── Build MEF node map ─────────────────────────────────────────────────────
  const nodes: Record<string, FaultTreeNode> = {};

  // Gate nodes
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

  // Event nodes (basic + house)
  for (const eventName of referencedEvents) {
    if (nodes[eventName]) continue; // gate with same name (shouldn't happen in valid XML)

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
