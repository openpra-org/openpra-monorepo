/**
 * OpenPSA XML → Event Tree + Fault Tree importer.
 *
 * Parses a single `<define-event-tree>` block and all `<define-fault-tree>` blocks
 * from an OpenPSA MEF XML file, then produces the ReactFlow node/edge array used by
 * the event tree editor.
 *
 * Assumptions:
 *  - Each functional event is linked to at most one fault tree via its collect-formula.
 *  - Cross-tree gate references use dot notation: "FaultTree.gate".
 *  - Path order: first `<path>` = success, second `<path>` = failure.
 *  - Unbalanced event trees are supported (branches may terminate before others).
 */

import type { Edge, Node } from "reactflow";
import type { FaultTreeNode } from "mef-types/lib/systems-analysis/systems-analysis";
import { FaultTreeNodeType } from "mef-types/lib/systems-analysis/systems-analysis";
import { GenerateUUID } from "./treeUtils";
import type { ParsedOpenPsaFaultTree } from "./parseOpenPsaXml";

// ─── Public result types ──────────────────────────────────────────────────────

export interface ParsedFunctionalEvent {
  name: string;
  /** FT name extracted from the failure collect-formula (before the dot) */
  faultTreeName?: string;
}

export interface ParsedEventTreeResult {
  eventTree: {
    name: string;
    functionalEvents: ParsedFunctionalEvent[];
    sequences: string[];
  };
  /** All FTs found in the XML, keyed by FT name */
  faultTrees: Record<string, ParsedOpenPsaFaultTree>;
  /** Parsed fork structure — needed by buildImportedEventTreeGraph */
  parsedFork: ForkNode;
}

// ─── Shared XML helpers ───────────────────────────────────────────────────────

function getParseError(doc: Document): string | null {
  const el = doc.getElementsByTagName("parsererror")[0];
  return el ? (el.textContent?.trim() ?? "unknown XML parse error") : null;
}

/**
 * Extract a probability value from a `<define-basic-event>` element.
 * Supports: `<float value="…">`, `<int value="…">`, `<exponential mean="…">`.
 * Throws for expressions that cannot be reduced to a scalar.
 */
function extractEventProbability(el: Element): number {
  const name = el.getAttribute("name") ?? "?";

  const floatEl = el.querySelector("float");
  if (floatEl) {
    const v = parseFloat(floatEl.getAttribute("value") ?? "");
    if (isNaN(v)) throw new Error(`Basic event "${name}" has a non-numeric <float> value`);
    if (v < 0 || v > 1) throw new Error(`Basic event "${name}" probability ${String(v)} is outside [0, 1]`);
    return v;
  }

  const intEl = el.querySelector("int");
  if (intEl) {
    const v = parseInt(intEl.getAttribute("value") ?? "", 10);
    if (isNaN(v)) throw new Error(`Basic event "${name}" has a non-numeric <int> value`);
    if (v < 0 || v > 1) throw new Error(`Basic event "${name}" probability ${String(v)} is outside [0, 1]`);
    return v;
  }

  // <exponential> — use mean as a scalar approximation (mean ≈ probability for small values)
  const expEl = el.querySelector("exponential");
  if (expEl) {
    const mean = parseFloat(expEl.getAttribute("mean") ?? "");
    if (!isNaN(mean) && mean >= 0) return Math.min(mean, 1);
    throw new Error(`Basic event "${name}" has an unresolvable <exponential> expression`);
  }

  throw new Error(
    `Basic event "${name}" uses an unsupported probability expression. ` +
      `Only <float>, <int>, and <exponential mean="…"> are supported.`,
  );
}

// ─── Fault tree parser ────────────────────────────────────────────────────────

const LOGIC_TAG_TO_NODE_TYPE: Record<string, FaultTreeNodeType> = {
  and: FaultTreeNodeType.AND_GATE,
  or: FaultTreeNodeType.OR_GATE,
  not: FaultTreeNodeType.NOT_GATE,
  inhibit: FaultTreeNodeType.INHIBIT_GATE,
  atleast: FaultTreeNodeType.ATLEAST_GATE,
};

const UNSUPPORTED_GATE_TAGS = new Set(["xor", "iff", "nand", "nor"]);
const INPUT_TAGS = new Set(["gate", "basic-event", "house-event"]);

interface GateDef {
  type: FaultTreeNodeType;
  inputs: string[];
  kValue?: number;
}

interface RawFaultTree {
  gateMap: Map<string, GateDef>;
  referencedGates: Set<string>;
  referencedEvents: Set<string>;
}

function parseSingleFaultTree(ftDef: Element): RawFaultTree {
  const gateMap = new Map<string, GateDef>();
  const referencedGates = new Set<string>();
  const referencedEvents = new Set<string>();

  ftDef.querySelectorAll("define-gate").forEach((gateDef) => {
    const gateName = gateDef.getAttribute("name");
    if (!gateName) return;

    const logicEl = Array.from(gateDef.children).find((c) => {
      const tag = c.tagName.toLowerCase();
      return LOGIC_TAG_TO_NODE_TYPE[tag] !== undefined || UNSUPPORTED_GATE_TAGS.has(tag);
    });
    if (!logicEl) return;

    const tagLower = logicEl.tagName.toLowerCase();

    if (UNSUPPORTED_GATE_TAGS.has(tagLower)) {
      throw new Error(
        `Gate "${gateName}" uses unsupported logic type "${tagLower}". ` +
          `Supported types: and, or, not, inhibit, atleast.`,
      );
    }

    const type = LOGIC_TAG_TO_NODE_TYPE[tagLower];
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
      if (childTag === "gate") referencedGates.add(childName);
      else referencedEvents.add(childName);
    });

    gateMap.set(gateName, { type, inputs, kValue });
  });

  return { gateMap, referencedGates, referencedEvents };
}

function parseAllFaultTrees(
  root: Element,
  eventProbs: Map<string, number>,
  houseStates: Map<string, boolean>,
): Record<string, ParsedOpenPsaFaultTree> {
  const rawTrees = new Map<string, RawFaultTree>();
  root.querySelectorAll("define-fault-tree").forEach((ftDef) => {
    const name = ftDef.getAttribute("name");
    if (!name) return;
    rawTrees.set(name, parseSingleFaultTree(ftDef));
  });

  if (rawTrees.size === 0) return {};

  const result: Record<string, ParsedOpenPsaFaultTree> = {};

  for (const [ftName, raw] of rawTrees) {
    const nodes: Record<string, FaultTreeNode> = {};

    const inlineGate = (gateRef: string, visited = new Set<string>()): void => {
      if (nodes[gateRef] || visited.has(gateRef)) return;
      visited.add(gateRef);

      if (gateRef.includes(".")) {
        const dotIdx = gateRef.indexOf(".");
        const foreignFtName = gateRef.slice(0, dotIdx);
        const foreignGateName = gateRef.slice(dotIdx + 1);
        const foreignTree = rawTrees.get(foreignFtName);
        if (!foreignTree) return;
        const gateDef = foreignTree.gateMap.get(foreignGateName);
        if (!gateDef) return;

        nodes[gateRef] = {
          uuid: gateRef,
          nodeType: gateDef.type,
          name: gateRef,
          inputs: gateDef.inputs.map((inp) =>
            inp.includes(".") ? inp
            : foreignTree.gateMap.has(inp) ? `${foreignFtName}.${inp}`
            : inp,
          ),
          position: { x: 0, y: 0 },
          ...(gateDef.kValue !== undefined ? { kValue: gateDef.kValue } : {}),
        };

        for (const inp of gateDef.inputs) {
          const resolved =
            inp.includes(".") ? inp
            : foreignTree.gateMap.has(inp) ? `${foreignFtName}.${inp}`
            : inp;
          inlineGate(resolved, visited);
          if (!nodes[resolved] && !foreignTree.gateMap.has(resolved) && !inp.includes(".")) {
            inlineEvent(inp);
          }
        }
        return;
      }

      const gateDef = raw.gateMap.get(gateRef);
      if (!gateDef) return;

      nodes[gateRef] = {
        uuid: gateRef,
        nodeType: gateDef.type,
        name: gateRef,
        inputs: gateDef.inputs,
        position: { x: 0, y: 0 },
        ...(gateDef.kValue !== undefined ? { kValue: gateDef.kValue } : {}),
      };

      for (const inp of gateDef.inputs) {
        inlineGate(inp, visited);
        inlineEvent(inp);
      }
    };

    const inlineEvent = (eventName: string): void => {
      if (nodes[eventName] || raw.gateMap.has(eventName) || eventName.includes(".")) return;
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
    };

    for (const gateName of raw.gateMap.keys()) {
      inlineGate(gateName);
    }

    const allGateIds = new Set(raw.gateMap.keys());
    const topCandidates = [...allGateIds].filter((id) => !raw.referencedGates.has(id));
    if (topCandidates.length === 0) {
      throw new Error(`Fault tree "${ftName}" has no root gate — all gates are referenced by others (possible cycle).`);
    }
    if (topCandidates.length > 1) {
      throw new Error(
        `Fault tree "${ftName}" has multiple root gate candidates: ${topCandidates.join(", ")}. ` +
          `The tree must have exactly one root gate.`,
      );
    }
    const topEventId = topCandidates[0];

    result[ftName] = { treeName: ftName, topEventId, nodes };
  }

  return result;
}

// ─── Event tree fork parser ───────────────────────────────────────────────────

export interface ForkNode {
  feName: string;
  successBranch?: ForkNode | string; // string = sequence name leaf
  failureBranch?: ForkNode | string;
  bypassBranch?: ForkNode | string; // straight-through; can end at a leaf
}

function parseForkElement(forkEl: Element): ForkNode {
  const feName = forkEl.getAttribute("functional-event") ?? "";
  const paths = Array.from(forkEl.children).filter((c) => c.tagName.toLowerCase() === "path");
  if (paths.length === 0) {
    throw new Error(`Fork for functional event "${feName}" has no paths`);
  }

  const parseBranch = (pathEl: Element): ForkNode | string => {
    const childFork = Array.from(pathEl.children).find((c) => c.tagName.toLowerCase() === "fork");
    if (childFork) return parseForkElement(childFork);
    const seqEl = Array.from(pathEl.children).find((c) => c.tagName.toLowerCase() === "sequence");
    if (seqEl) return seqEl.getAttribute("name") ?? "?";
    throw new Error(`Path in fork "${feName}" has no <fork> or <sequence> child`);
  };

  const result: ForkNode = { feName };

  for (const path of paths) {
    const state = (path.getAttribute("state") ?? "").trim().toLowerCase();
    const branch = parseBranch(path);
    if (state === "success" || state === "w") {
      result.successBranch = branch;
    } else if (state === "failure" || state === "f") {
      result.failureBranch = branch;
    } else if (state === "bypass") {
      result.bypassBranch = branch;
    } else {
      // Unknown state: fill whichever standard slot is still empty.
      if (result.successBranch === undefined) result.successBranch = branch;
      else if (result.failureBranch === undefined) result.failureBranch = branch;
    }
  }

  return result;
}

function extractFtNameFromFailurePath(pathEl: Element): string | undefined {
  const formula = Array.from(pathEl.children).find((c) => c.tagName.toLowerCase() === "collect-formula");
  if (!formula) return undefined;
  const gateEl = formula.querySelector("gate");
  if (!gateEl) return undefined;
  const ref = gateEl.getAttribute("name") ?? "";
  const dotIdx = ref.indexOf(".");
  return dotIdx >= 0 ? ref.slice(0, dotIdx) : undefined;
}

function collectSequences(fork: ForkNode | string | undefined): string[] {
  if (fork === undefined) return [];
  if (typeof fork === "string") return [fork];
  return [
    ...collectSequences(fork.successBranch),
    ...collectSequences(fork.failureBranch),
    ...collectSequences(fork.bypassBranch),
  ];
}

// ─── ReactFlow graph builder (supports unbalanced trees) ─────────────────────

const NODE_WIDTH = 140;

/**
 * Recursively build visible nodes and edges from the fork tree.
 *
 * Each call creates (or terminates at) a visible node and attaches an incoming edge
 * from the parent node. The incoming edge carries:
 *   - `branchState`: "success" | "failure" (the outcome of the parent fork)
 *   - `feId`: column-node ID of the FE resolved by the parent fork
 *
 * For leaf branches (string sequence names), an output node is created directly.
 */
function buildVisibleSubtree(
  branch: ForkNode | string | undefined,
  parentId: string,
  edgeBranchState: "success" | "failure" | "bypass",
  edgeFeColId: string | undefined,
  nodeDepth: number,
  feColIds: Map<string, string>,
  nodes: Node[],
  edges: Edge[],
): void {
  if (branch === undefined) return;

  const addEdgeToParent = (targetId: string): void => {
    edges.push({
      id: `${parentId}-${targetId}`,
      source: parentId,
      target: targetId,
      type: "custom",
      animated: false,
      data: { branchState: edgeBranchState, feId: edgeFeColId },
    });
  };

  if (typeof branch === "string") {
    // Leaf: create output nodes and connect from parent.
    const seqNodeId = GenerateUUID();
    nodes.push({
      id: seqNodeId,
      type: "outputNode",
      data: { label: branch, width: NODE_WIDTH, isSequenceId: true },
      position: { x: 0, y: 0 },
    });
    addEdgeToParent(seqNodeId);

    const relCatId = GenerateUUID();
    nodes.push({
      id: relCatId,
      type: "outputNode",
      data: { label: "Category A", width: NODE_WIDTH },
      position: { x: 0, y: 0 },
    });
    edges.push({
      id: `${seqNodeId}-${relCatId}`,
      source: seqNodeId,
      target: relCatId,
      type: "custom",
      animated: false,
      data: { hidden: true },
    });
    return;
  }

  // Internal fork: create a visible node and recurse into both branches.
  const nodeId = GenerateUUID();
  nodes.push({
    id: nodeId,
    type: "visibleNode",
    data: { depth: nodeDepth, width: NODE_WIDTH, output: false },
    position: { x: 0, y: 0 },
  });
  addEdgeToParent(nodeId);

  const childFeColId = feColIds.get(branch.feName);
  const childDepth = nodeDepth + 1;

  buildVisibleSubtree(branch.successBranch, nodeId, "success", childFeColId, childDepth, feColIds, nodes, edges);
  buildVisibleSubtree(branch.failureBranch, nodeId, "failure", childFeColId, childDepth, feColIds, nodes, edges);
  // Bypass: straight-through edge from this node — no new visible fork created here.
  buildVisibleSubtree(branch.bypassBranch, nodeId, "bypass", childFeColId, childDepth, feColIds, nodes, edges);
}

function buildEventTreeGraph(
  functionalEvents: ParsedFunctionalEvent[],
  parsedFork: ForkNode,
  sequences: string[],
  ftNameToId: Record<string, string>,
  ieName: string,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const feColIds = new Map<string, string>();

  const addColEdge = (fromId: string, toId: string): void => {
    edges.push({
      id: `${fromId}--${toId}`,
      source: fromId,
      target: toId,
      type: "custom",
      animated: false,
      data: { hidden: true },
    });
  };

  // ── Column nodes ─────────────────────────────────────────────────────────────

  const ieColId = GenerateUUID();
  nodes.push({
    id: ieColId,
    type: "columnNode",
    data: { label: ieName, width: NODE_WIDTH, depth: 1, output: false, allowAdd: false },
    position: { x: 0, y: 0 },
  });
  let prevColId = ieColId;

  functionalEvents.forEach((fe, idx) => {
    const feColId = GenerateUUID();
    feColIds.set(fe.name, feColId);
    const ftId = fe.faultTreeName ? ftNameToId[fe.faultTreeName] : undefined;
    nodes.push({
      id: feColId,
      type: "columnNode",
      data: {
        label: fe.name,
        width: NODE_WIDTH,
        depth: idx + 2,
        output: false,
        allowAdd: true,
        allowDelete: true,
        ...(ftId ? { faultTreeId: ftId, faultTreeLabel: fe.faultTreeName } : {}),
      },
      position: { x: 0, y: 0 },
    });
    addColEdge(prevColId, feColId);
    prevColId = feColId;
  });

  const actionsId = GenerateUUID();
  nodes.push({
    id: actionsId,
    type: "columnActionsNode",
    data: { width: NODE_WIDTH, label: "" },
    position: { x: 0, y: 0 },
  });
  addColEdge(prevColId, actionsId);
  prevColId = actionsId;

  const inputLevels = functionalEvents.length + 1;
  ["Sequence ID", "Release Category"].forEach((label, i) => {
    const outColId = GenerateUUID();
    nodes.push({
      id: outColId,
      type: "columnNode",
      data: { label, width: NODE_WIDTH, depth: inputLevels + 1 + i, output: true, allowAdd: false },
      position: { x: 0, y: 0 },
    });
    addColEdge(prevColId, outColId);
    prevColId = outColId;
  });

  // ── Root visible node ─────────────────────────────────────────────────────────

  const rootId = GenerateUUID();
  nodes.push({
    id: rootId,
    type: "visibleNode",
    data: {
      label: ieName.slice(0, 3).toUpperCase(),
      depth: 1,
      width: NODE_WIDTH,
      inputDepth: inputLevels,
      outputDepth: 2,
      index: 1,
    },
    position: { x: 0, y: 0 },
  });

  // ── Recurse from root through the fork tree ───────────────────────────────────
  // The root resolves parsedFork.feName — that FE's column ID goes on the outgoing edges.
  const rootFeColId = feColIds.get(parsedFork.feName);
  const childDepth = 2;

  buildVisibleSubtree(parsedFork.successBranch, rootId, "success", rootFeColId, childDepth, feColIds, nodes, edges);
  buildVisibleSubtree(parsedFork.failureBranch, rootId, "failure", rootFeColId, childDepth, feColIds, nodes, edges);
  buildVisibleSubtree(parsedFork.bypassBranch, rootId, "bypass", rootFeColId, childDepth, feColIds, nodes, edges);

  void sequences; // sequences are embedded as output-node labels via the fork tree

  return { nodes, edges };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Parse an OpenPSA MEF XML file containing a single event tree plus
 * all its linked fault trees. Supports unbalanced binary event trees.
 *
 * @throws {Error} if the XML is malformed, has no event tree, uses unsupported
 *   gate types, or has probability expressions that cannot be reduced to scalars.
 */
export function parseOpenPsaEventTreeXml(xmlString: string): ParsedEventTreeResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");
  const parseError = getParseError(doc);
  if (parseError) throw new Error(`XML parse error: ${parseError}`);
  const root = doc.documentElement;

  // ── Collect basic-event probabilities and house-event states ─────────────────
  const eventProbs = new Map<string, number>();
  root.querySelectorAll("model-data > define-basic-event").forEach((el) => {
    const name = el.getAttribute("name");
    if (name) eventProbs.set(name, extractEventProbability(el));
  });

  const houseStates = new Map<string, boolean>();
  root.querySelectorAll("model-data > define-house-event").forEach((el) => {
    const name = el.getAttribute("name");
    if (!name) return;
    const constEl = el.querySelector("constant");
    houseStates.set(name, constEl ? constEl.getAttribute("value") === "true" : false);
  });

  const faultTrees = parseAllFaultTrees(root, eventProbs, houseStates);

  // ── Parse event tree ──────────────────────────────────────────────────────────
  const etDef = root.querySelector("define-event-tree");
  if (!etDef) throw new Error("No <define-event-tree> element found in XML");
  const etName = etDef.getAttribute("name") ?? "imported";

  const feNames: string[] = [];
  etDef.querySelectorAll("define-functional-event").forEach((el) => {
    const name = el.getAttribute("name");
    if (name) feNames.push(name);
  });
  if (feNames.length === 0) throw new Error("Event tree has no functional events");

  // Extract FE → FT mapping from failure-path collect-formulas
  const feToFtName: Record<string, string> = {};
  const collectFtMappings = (el: Element): void => {
    Array.from(el.children).forEach((child) => {
      const tag = child.tagName.toLowerCase();
      if (tag === "fork") {
        const feName = child.getAttribute("functional-event") ?? "";
        const paths = Array.from(child.children).filter((c) => c.tagName.toLowerCase() === "path");
        if (paths.length >= 1 && !feToFtName[feName]) {
          // Prefer the explicit failure path; bypass paths have no collect-formula.
          const failurePath =
            paths.find((p) => {
              const s = (p.getAttribute("state") ?? "").trim().toLowerCase();
              return s === "failure" || s === "f";
            }) ??
            paths.find((p) => {
              const s = (p.getAttribute("state") ?? "").trim().toLowerCase();
              return s !== "bypass";
            });
          const ftName = failurePath ? extractFtNameFromFailurePath(failurePath) : undefined;
          if (ftName) feToFtName[feName] = ftName;
        }
        collectFtMappings(child);
      } else if (tag === "path") {
        collectFtMappings(child);
      }
    });
  };

  const initialState = Array.from(etDef.children).find((c) => c.tagName.toLowerCase() === "initial-state");
  if (!initialState) throw new Error("Event tree has no <initial-state>");
  collectFtMappings(initialState);

  const rootForkEl = Array.from(initialState.children).find((c) => c.tagName.toLowerCase() === "fork");
  if (!rootForkEl) throw new Error("Event tree <initial-state> has no <fork>");
  const parsedFork = parseForkElement(rootForkEl);
  const sequences = collectSequences(parsedFork);

  const functionalEvents: ParsedFunctionalEvent[] = feNames.map((name) => ({
    name,
    faultTreeName: feToFtName[name],
  }));

  return {
    eventTree: { name: etName, functionalEvents, sequences },
    faultTrees,
    parsedFork,
  };
}

/**
 * Build the ReactFlow nodes and edges for an imported event tree.
 * Must be called after fault trees have been created (so their DB IDs are known).
 *
 * @param parsed     - Result from `parseOpenPsaEventTreeXml`
 * @param ftNameToId - Map from FT name (as in XML) → NestedModel `_id` string
 */
export function buildImportedEventTreeGraph(
  parsed: ParsedEventTreeResult,
  ftNameToId: Record<string, string>,
): { nodes: Node[]; edges: Edge[] } {
  const { eventTree, parsedFork } = parsed;
  return buildEventTreeGraph(eventTree.functionalEvents, parsedFork, eventTree.sequences, ftNameToId, eventTree.name);
}
