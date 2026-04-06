import * as fs from "node:fs";
import * as path from "node:path";

import type { GraphEdge } from "shared-types/src/lib/types/reactflowGraph/GraphEdge";
import type { GraphNode } from "shared-types/src/lib/types/reactflowGraph/GraphNode";

import { analyzeFaultTreeReadiness, buildReadinessSummary } from "../src/lib/quantum-readiness";
import { adaptLikelyOpenPraFaultTreeGraphToNormalizedFaultTree } from "../src/lib/openpra-fault-tree-graph-heuristics";

const outputDir = path.resolve(
  "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/packages/quantum-readiness/tmp"
);

fs.mkdirSync(outputDir, { recursive: true });

const graphNodesCaseOne: GraphNode<object>[] = [
  {
    id: "TOP",
    type: "gate",
    position: { x: 0, y: 0 },
    data: {
      label: { name: "Top Gate" },
      gateType: "OR",
      isTop: true
    }
  },
  {
    id: "G1",
    type: "gate",
    position: { x: 0, y: 120 },
    data: {
      label: { name: "Intermediate Gate" },
      gateType: "AND"
    }
  },
  {
    id: "A",
    type: "basicEvent",
    position: { x: -120, y: 240 },
    data: {
      label: { name: "Basic Event A" }
    }
  },
  {
    id: "B",
    type: "basicEvent",
    position: { x: 0, y: 240 },
    data: {
      label: { name: "Basic Event B" }
    }
  },
  {
    id: "C",
    type: "basicEvent",
    position: { x: 120, y: 240 },
    data: {
      label: { name: "Basic Event C" }
    }
  }
];

const graphEdgesCaseOne: GraphEdge<object>[] = [
  {
    id: "e1",
    source: "TOP",
    target: "G1",
    type: "default",
    data: {},
    animated: false
  },
  {
    id: "e2",
    source: "TOP",
    target: "C",
    type: "default",
    data: {},
    animated: false
  },
  {
    id: "e3",
    source: "G1",
    target: "A",
    type: "default",
    data: {},
    animated: false
  },
  {
    id: "e4",
    source: "G1",
    target: "B",
    type: "default",
    data: {},
    animated: false
  }
];

const graphNodesCaseTwo: GraphNode<object>[] = [
  {
    id: "TOP",
    type: "gate",
    position: { x: 0, y: 0 },
    data: {
      label: { name: "Top Gate" },
      gateType: "NOT",
      isTopEvent: true
    }
  },
  {
    id: "A",
    type: "basicEvent",
    position: { x: 0, y: 120 },
    data: {
      label: { name: "Basic Event A" }
    }
  }
];

const graphEdgesCaseTwo: GraphEdge<object>[] = [
  {
    id: "e1",
    source: "TOP",
    target: "A",
    type: "default",
    data: {},
    animated: false
  }
];

const graphCases = [
  {
    id: "openpra_graph_case_1",
    name: "Likely OpenPRA graph with OR and AND gates",
    nodes: graphNodesCaseOne,
    edges: graphEdgesCaseOne
  },
  {
    id: "openpra_graph_case_2",
    name: "Likely OpenPRA graph with NOT gate",
    nodes: graphNodesCaseTwo,
    edges: graphEdgesCaseTwo
  }
];

for (const graphCase of graphCases) {
  const normalized = adaptLikelyOpenPraFaultTreeGraphToNormalizedFaultTree({
    faultTreeId: graphCase.id,
    modelName: graphCase.name,
    nodes: graphCase.nodes,
    edges: graphCase.edges
  });

  const report = analyzeFaultTreeReadiness(normalized);
  const summary = buildReadinessSummary(report);

  const normalizedPath = path.join(outputDir, `${graphCase.id}_normalized.json`);
  const reportPath = path.join(outputDir, `${graphCase.id}_report.json`);
  const summaryPath = path.join(outputDir, `${graphCase.id}_summary.md`);

  fs.writeFileSync(normalizedPath, JSON.stringify(normalized, null, 2), "utf8");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(summaryPath, summary, "utf8");

  console.log("============================================================");
  console.log(`Graph Case: ${graphCase.id}`);
  console.log(`Name: ${graphCase.name}`);
  console.log(`Normalized JSON: ${normalizedPath}`);
  console.log(`Readiness Report JSON: ${reportPath}`);
  console.log(`Readiness Summary MD: ${summaryPath}`);
  console.log(`Top Node: ${normalized.topNodeId}`);
  console.log(`Candidate Subtrees: ${report.summary.totalCandidateSubtrees}`);
  console.log(`Quantum Tractable Candidates: ${report.summary.totalQuantumTractableCandidates}`);

  for (const candidate of report.candidates) {
    console.log("");
    console.log(`  Root: ${candidate.rootNodeId}`);
    console.log(`  Root kind: ${candidate.rootNodeKind}`);
    console.log(`  Root gate type: ${candidate.rootGateType ?? "n/a"}`);
    console.log(`  Basic events: ${candidate.basicEventCount}`);
    console.log(`  Gate count: ${candidate.gateCount}`);
    console.log(`  Max depth: ${candidate.maxDepth}`);
    console.log(`  Quantum tractable: ${candidate.quantumTractable ? "yes" : "no"}`);

    if (candidate.exclusionReasons.length > 0) {
      console.log(`  Exclusion reasons: ${candidate.exclusionReasons.join(" | ")}`);
    }

    if (candidate.issues.length > 0) {
      console.log(`  Issues: ${candidate.issues.join(" | ")}`);
    }
  }

  console.log("");
}

console.log("OpenPRA graph smoke runner complete.");
