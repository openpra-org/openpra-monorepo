import * as fs from "node:fs";
import * as path from "node:path";

import { analyzeFaultTreeReadiness, buildReadinessSummary } from "../src/lib/quantum-readiness";
import type { NormalizedFaultTree } from "../src/lib/types";

const outputDir = path.resolve(
  "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/packages/quantum-readiness/tmp"
);

fs.mkdirSync(outputDir, { recursive: true });

const caseOne: NormalizedFaultTree = {
  id: "smoke_case_1",
  name: "Simple OR of AND with direct basic event",
  topNodeId: "TOP",
  sourceFormat: "normalized",
  nodes: {
    TOP: {
      id: "TOP",
      label: "Top Event",
      kind: "gate",
      gateType: "or",
      children: ["G1", "C"]
    },
    G1: {
      id: "G1",
      label: "Intermediate AND Gate",
      kind: "gate",
      gateType: "and",
      children: ["A", "B"]
    },
    A: {
      id: "A",
      label: "Basic Event A",
      kind: "basicEvent"
    },
    B: {
      id: "B",
      label: "Basic Event B",
      kind: "basicEvent"
    },
    C: {
      id: "C",
      label: "Basic Event C",
      kind: "basicEvent"
    }
  }
};

const caseTwo: NormalizedFaultTree = {
  id: "smoke_case_2",
  name: "NOT gate example that should be excluded in v1",
  topNodeId: "TOP",
  sourceFormat: "normalized",
  nodes: {
    TOP: {
      id: "TOP",
      label: "Top Event",
      kind: "gate",
      gateType: "not",
      children: ["A"]
    },
    A: {
      id: "A",
      label: "Basic Event A",
      kind: "basicEvent"
    }
  }
};

const cases: NormalizedFaultTree[] = [caseOne, caseTwo];

for (const faultTree of cases) {
  const report = analyzeFaultTreeReadiness(faultTree);
  const summary = buildReadinessSummary(report);

  const jsonPath = path.join(outputDir, `${faultTree.id}_report.json`);
  const mdPath = path.join(outputDir, `${faultTree.id}_summary.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(mdPath, summary, "utf8");

  console.log("============================================================");
  console.log(`Model: ${faultTree.id}`);
  console.log(`Name: ${faultTree.name}`);
  console.log(`JSON report: ${jsonPath}`);
  console.log(`Markdown summary: ${mdPath}`);
  console.log(`Candidate subtrees: ${report.summary.totalCandidateSubtrees}`);
  console.log(`Quantum tractable candidates: ${report.summary.totalQuantumTractableCandidates}`);

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

console.log("Smoke runner complete.");
