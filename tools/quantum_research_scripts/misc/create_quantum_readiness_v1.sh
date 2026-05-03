#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
PKG_ROOT="${REPO_ROOT}/packages/quantum-readiness"

mkdir -p "${PKG_ROOT}/src/lib"

if [ -f "${REPO_ROOT}/packages/shared-types/LICENSE" ]; then
  cp "${REPO_ROOT}/packages/shared-types/LICENSE" "${PKG_ROOT}/LICENSE"
fi

cat > "${PKG_ROOT}/package.json" <<'EOF'
{
  "name": "quantum-readiness",
  "version": "0.0.1",
  "license": "MIT",
  "type": "commonjs",
  "private": true,
  "nx": {
    "tags": [
      "scope:shared"
    ]
  },
  "main": "./src/index.js",
  "typings": "./src/index.d.ts",
  "dependencies": {
    "tslib": "2.5.2"
  },
  "devDependencies": {
    "eslint": "9.14.0",
    "typescript-eslint": "8.14.0",
    "eslint-plugin-tsdoc": "0.2.17",
    "typedoc": "^0.28.1",
    "typedoc-plugin-markdown": "^4.6.0"
  },
  "scripts": {
    "lint:canary": "eslint --config ./eslint.config.mjs .",
    "docs": "typedoc --options typedoc.json",
    "docs:clean": "rm -rf docs",
    "docs:md": "typedoc --options typedoc.md.json",
    "docs:md:clean": "rm -rf docs-md"
  }
}
EOF

cat > "${PKG_ROOT}/project.json" <<'EOF'
{
  "name": "quantum-readiness",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "tags": ["scope:shared"],
  "sourceRoot": "packages/quantum-readiness/src",
  "projectType": "library",
  "targets": {
    "docs": {
      "executor": "nx:run-commands",
      "options": {
        "command": "pnpm --filter quantum-readiness run docs",
        "cwd": "{workspaceRoot}"
      },
      "outputs": ["{projectRoot}/docs"]
    },
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/packages/quantum-readiness",
        "main": "packages/quantum-readiness/src/index.ts",
        "tsConfig": "packages/quantum-readiness/tsconfig.lib.json",
        "assets": ["packages/quantum-readiness/*.md"],
        "transformers": []
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "eslintConfig": "packages/quantum-readiness/eslint.config.mjs",
        "lintFilePatterns": ["{projectRoot}/**/*.ts", "{projectRoot}/**/*.js", "!{projectRoot}/**/*.d.ts"]
      }
    },
    "lint-canary": {
      "executor": "nx:run-commands",
      "options": {
        "command": "pnpm --filter quantum-readiness run lint:canary",
        "cwd": "{workspaceRoot}"
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {
        "jestConfig": "packages/quantum-readiness/jest.config.ts"
      }
    }
  }
}
EOF

cat > "${PKG_ROOT}/tsconfig.json" <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "sourceMap": true,
    "declaration": true,
    "declarationDir": "../../dist/types/quantum-readiness",
    "composite": true
  },
  "references": [
    {
      "path": "./tsconfig.lib.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ]
}
EOF

cat > "${PKG_ROOT}/tsconfig.lib.json" <<'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "types": ["node"]
  },
  "exclude": [
    "jest.config.ts",
    "src/**/*.spec.ts",
    "src/**/*.test.ts"
  ],
  "include": ["src/**/*.ts"]
}
EOF

cat > "${PKG_ROOT}/tsconfig.spec.json" <<'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "module": "commonjs",
    "types": ["jest", "node"]
  },
  "include": [
    "jest.config.ts",
    "src/**/*.spec.ts",
    "src/**/*.test.ts",
    "src/**/*.d.ts"
  ]
}
EOF

cat > "${PKG_ROOT}/tsconfig.eslint.json" <<'EOF'
{
  "extends": "./tsconfig.json",
  "include": [
    "src/**/*.ts",
    "jest.config.ts"
  ]
}
EOF

cat > "${PKG_ROOT}/eslint.config.mjs" <<'EOF'
import tseslint from 'typescript-eslint';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createTsCanaryConfig } from '../../tools/eslint/flat/presets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  ...createTsCanaryConfig({
    tseslint,
    tsdoc: tsdocPlugin,
    tsconfigRootDir: __dirname,
    projectTsconfigs: ['./tsconfig.eslint.json']
  }),
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: false
        }
      ],
      '@typescript-eslint/unbound-method': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      'tsdoc/syntax': 'error'
    }
  },
  {
    files: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'src/**/*.test.ts', 'src/**/*.e2e.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/unbound-method': 'off',
      'tsdoc/syntax': 'off'
    }
  }
);
EOF

cat > "${PKG_ROOT}/jest.config.ts" <<'EOF'
export default {
  displayName: 'quantum-readiness',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest']
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/packages/quantum-readiness'
};
EOF

cat > "${PKG_ROOT}/typedoc.json" <<'EOF'
{
  "entryPoints": ["src/index.ts"],
  "out": "docs",
  "name": "quantum-readiness",
  "tsconfig": "tsconfig.lib.json"
}
EOF

cat > "${PKG_ROOT}/typedoc.md.json" <<'EOF'
{
  "entryPoints": ["src/index.ts"],
  "out": "docs-md",
  "name": "quantum-readiness",
  "tsconfig": "tsconfig.lib.json",
  "plugin": ["typedoc-plugin-markdown"]
}
EOF

cat > "${PKG_ROOT}/README.md" <<'EOF'
# quantum-readiness

A first-pass OpenPRA library for deterministic quantum readiness screening of normalized fault tree structures.

## Version 1 scope

This package is intentionally narrow.

It provides:
- normalized fault tree input types
- candidate subtree extraction
- simple readiness screening
- deterministic report generation
- human readable summary generation

It does not yet provide:
- OpenPSA XML parsing
- direct OpenPRA database integration
- CL-QUBO export
- Qiskit circuit generation
- hardware execution
- PRA importance measure propagation
EOF

cat > "${PKG_ROOT}/src/index.ts" <<'EOF'
/**
 * OpenPRA Quantum Readiness package.
 *
 * This package provides a small, deterministic analysis layer for screening
 * normalized fault tree structures for follow-on quantum workflow suitability.
 *
 * The package is intentionally conservative in version 1. It does not parse
 * OpenPSA XML directly and does not execute any quantum workflow.
 *
 * @packageDocumentation
 */
export * from "./lib/index";
EOF

cat > "${PKG_ROOT}/src/lib/index.ts" <<'EOF'
/**
 * Public exports for the quantum-readiness package.
 */
export * from "./types";
export * from "./quantum-readiness";
EOF

cat > "${PKG_ROOT}/src/lib/types.ts" <<'EOF'
/**
 * Gate types supported by the normalized readiness analysis layer.
 */
export type NormalizedGateType = "and" | "or" | "not" | "xor" | "atleast" | "nand" | "nor";

/**
 * A normalized fault tree node used by the readiness analyzer.
 *
 * The readiness package works on this neutral structure so that later adapters
 * can convert from OpenPSA XML, MEF technical elements, database records, or
 * graph models without changing the core analysis logic.
 */
export interface NormalizedFaultTreeNode {
  /**
   * Stable node identifier.
   */
  id: string;

  /**
   * Human readable label if available.
   */
  label?: string;

  /**
   * Node kind.
   */
  kind: "gate" | "basicEvent";

  /**
   * Gate type for gate nodes.
   */
  gateType?: NormalizedGateType;

  /**
   * Child node identifiers for gate nodes.
   */
  children?: string[];

  /**
   * Optional extra metadata preserved by adapters.
   */
  metadata?: Record<string, unknown>;
}

/**
 * A normalized fault tree input model.
 */
export interface NormalizedFaultTree {
  /**
   * Stable model identifier.
   */
  id: string;

  /**
   * Human readable model name.
   */
  name: string;

  /**
   * Root or top event node identifier.
   */
  topNodeId: string;

  /**
   * Source format label carried forward by adapters.
   */
  sourceFormat?: "normalized" | "openpsa" | "mef" | "unknown";

  /**
   * All nodes keyed by identifier.
   */
  nodes: Record<string, NormalizedFaultTreeNode>;
}

/**
 * Options controlling the first-pass readiness screen.
 */
export interface AnalyzeFaultTreeReadinessOptions {
  /**
   * Maximum basic-event count allowed for a candidate to be marked tractable.
   *
   * Default: 8
   */
  maxBasicEvents?: number;

  /**
   * Gate types treated as supported by the current screen.
   *
   * Default: ["and", "or"]
   */
  supportedGateTypes?: NormalizedGateType[];

  /**
   * When true, basic event nodes are also treated as candidate roots.
   *
   * Default: false
   */
  includeBasicEventRoots?: boolean;
}

/**
 * A single candidate subtree report row.
 */
export interface QuantumReadinessCandidate {
  /**
   * Candidate root node identifier.
   */
  rootNodeId: string;

  /**
   * Candidate root node label if available.
   */
  rootNodeLabel?: string;

  /**
   * Candidate root kind.
   */
  rootNodeKind: "gate" | "basicEvent";

  /**
   * Gate type at the root when the candidate root is a gate.
   */
  rootGateType?: NormalizedGateType;

  /**
   * All nodes reachable from the candidate root.
   */
  subtreeNodeIds: string[];

  /**
   * Reachable basic event identifiers.
   */
  basicEventIds: string[];

  /**
   * Reachable gate node identifiers.
   */
  gateNodeIds: string[];

  /**
   * Number of reachable basic events.
   */
  basicEventCount: number;

  /**
   * Number of reachable gate nodes.
   */
  gateCount: number;

  /**
   * Maximum depth from the root to a reachable descendant.
   */
  maxDepth: number;

  /**
   * Supported gate types found in the subtree.
   */
  supportedGateTypesFound: NormalizedGateType[];

  /**
   * Unsupported gate types found in the subtree.
   */
  unsupportedGateTypesFound: NormalizedGateType[];

  /**
   * Whether the candidate passes the current first-pass screen.
   */
  quantumTractable: boolean;

  /**
   * Why the candidate failed the screen if it did.
   */
  exclusionReasons: string[];

  /**
   * Additional structural issues found while traversing.
   */
  issues: string[];
}

/**
 * Top level aggregate summary.
 */
export interface QuantumReadinessSummary {
  modelId: string;
  modelName: string;
  sourceFormat: string;
  totalNodes: number;
  totalGateNodes: number;
  totalBasicEventNodes: number;
  totalCandidateSubtrees: number;
  totalQuantumTractableCandidates: number;
  configuredMaxBasicEvents: number;
  configuredSupportedGateTypes: NormalizedGateType[];
  tractableCandidateIds: string[];
}

/**
 * Final deterministic readiness report.
 */
export interface QuantumReadinessReport {
  generatedAt: string;
  moduleVersion: string;
  summary: QuantumReadinessSummary;
  candidates: QuantumReadinessCandidate[];
}
EOF

cat > "${PKG_ROOT}/src/lib/quantum-readiness.ts" <<'EOF'
import type {
  AnalyzeFaultTreeReadinessOptions,
  NormalizedFaultTree,
  NormalizedFaultTreeNode,
  NormalizedGateType,
  QuantumReadinessCandidate,
  QuantumReadinessReport,
  QuantumReadinessSummary
} from "./types";

const MODULE_VERSION = "0.0.1";
const DEFAULT_MAX_BASIC_EVENTS = 8;
const DEFAULT_SUPPORTED_GATE_TYPES: NormalizedGateType[] = ["and", "or"];

interface TraversalResult {
  subtreeNodeIds: Set<string>;
  basicEventIds: Set<string>;
  gateNodeIds: Set<string>;
  supportedGateTypesFound: Set<NormalizedGateType>;
  unsupportedGateTypesFound: Set<NormalizedGateType>;
  issues: string[];
  maxDepth: number;
}

/**
 * Extract candidate subtree rows from a normalized fault tree.
 *
 * Version 1 treats each gate node as a candidate root by default.
 */
export function extractCandidateSubtrees(
  faultTree: NormalizedFaultTree,
  options: AnalyzeFaultTreeReadinessOptions = {}
): QuantumReadinessCandidate[] {
  const normalizedOptions = normalizeOptions(options);

  const candidates = Object.values(faultTree.nodes)
    .filter((node) => shouldTreatAsCandidateRoot(node, normalizedOptions.includeBasicEventRoots))
    .map((node) => buildCandidate(faultTree, node, normalizedOptions))
    .sort((left, right) => left.rootNodeId.localeCompare(right.rootNodeId));

  return candidates;
}

/**
 * Analyze a normalized fault tree and return a deterministic readiness report.
 */
export function analyzeFaultTreeReadiness(
  faultTree: NormalizedFaultTree,
  options: AnalyzeFaultTreeReadinessOptions = {}
): QuantumReadinessReport {
  const normalizedOptions = normalizeOptions(options);
  const candidates = extractCandidateSubtrees(faultTree, normalizedOptions);

  const summary: QuantumReadinessSummary = {
    modelId: faultTree.id,
    modelName: faultTree.name,
    sourceFormat: faultTree.sourceFormat ?? "unknown",
    totalNodes: Object.keys(faultTree.nodes).length,
    totalGateNodes: Object.values(faultTree.nodes).filter((node) => node.kind === "gate").length,
    totalBasicEventNodes: Object.values(faultTree.nodes).filter((node) => node.kind === "basicEvent").length,
    totalCandidateSubtrees: candidates.length,
    totalQuantumTractableCandidates: candidates.filter((candidate) => candidate.quantumTractable).length,
    configuredMaxBasicEvents: normalizedOptions.maxBasicEvents,
    configuredSupportedGateTypes: [...normalizedOptions.supportedGateTypes],
    tractableCandidateIds: candidates
      .filter((candidate) => candidate.quantumTractable)
      .map((candidate) => candidate.rootNodeId)
  };

  return {
    generatedAt: new Date().toISOString(),
    moduleVersion: MODULE_VERSION,
    summary,
    candidates
  };
}

/**
 * Build a human readable markdown summary from a readiness report.
 */
export function buildReadinessSummary(report: QuantumReadinessReport): string {
  const lines: string[] = [];

  lines.push("# Quantum Readiness Summary");
  lines.push("");
  lines.push(`Model ID: ${report.summary.modelId}`);
  lines.push(`Model Name: ${report.summary.modelName}`);
  lines.push(`Source Format: ${report.summary.sourceFormat}`);
  lines.push(`Generated At: ${report.generatedAt}`);
  lines.push(`Module Version: ${report.moduleVersion}`);
  lines.push("");
  lines.push("## Aggregate Counts");
  lines.push("");
  lines.push(`Total Nodes: ${report.summary.totalNodes}`);
  lines.push(`Total Gate Nodes: ${report.summary.totalGateNodes}`);
  lines.push(`Total Basic Event Nodes: ${report.summary.totalBasicEventNodes}`);
  lines.push(`Total Candidate Subtrees: ${report.summary.totalCandidateSubtrees}`);
  lines.push(`Quantum Tractable Candidates: ${report.summary.totalQuantumTractableCandidates}`);
  lines.push(`Configured Max Basic Events: ${report.summary.configuredMaxBasicEvents}`);
  lines.push(
    `Configured Supported Gate Types: ${report.summary.configuredSupportedGateTypes.length > 0 ? report.summary.configuredSupportedGateTypes.join(", ") : "none"}`
  );
  lines.push("");
  lines.push("## Candidate Overview");
  lines.push("");

  if (report.candidates.length === 0) {
    lines.push("No candidates were identified.");
    return lines.join("\n");
  }

  for (const candidate of report.candidates) {
    lines.push(`### ${candidate.rootNodeId}`);
    lines.push(`Root Kind: ${candidate.rootNodeKind}`);
    lines.push(`Root Gate Type: ${candidate.rootGateType ?? "n/a"}`);
    lines.push(`Basic Event Count: ${candidate.basicEventCount}`);
    lines.push(`Gate Count: ${candidate.gateCount}`);
    lines.push(`Max Depth: ${candidate.maxDepth}`);
    lines.push(`Quantum Tractable: ${candidate.quantumTractable ? "yes" : "no"}`);

    if (candidate.exclusionReasons.length > 0) {
      lines.push(`Exclusion Reasons: ${candidate.exclusionReasons.join("; ")}`);
    }

    if (candidate.issues.length > 0) {
      lines.push(`Issues: ${candidate.issues.join("; ")}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

function normalizeOptions(options: AnalyzeFaultTreeReadinessOptions): Required<AnalyzeFaultTreeReadinessOptions> {
  return {
    maxBasicEvents: options.maxBasicEvents ?? DEFAULT_MAX_BASIC_EVENTS,
    supportedGateTypes: [...(options.supportedGateTypes ?? DEFAULT_SUPPORTED_GATE_TYPES)],
    includeBasicEventRoots: options.includeBasicEventRoots ?? false
  };
}

function shouldTreatAsCandidateRoot(
  node: NormalizedFaultTreeNode,
  includeBasicEventRoots: boolean
): boolean {
  if (node.kind === "gate") {
    return true;
  }

  return includeBasicEventRoots;
}

function buildCandidate(
  faultTree: NormalizedFaultTree,
  rootNode: NormalizedFaultTreeNode,
  options: Required<AnalyzeFaultTreeReadinessOptions>
): QuantumReadinessCandidate {
  const traversal = traverseSubtree(faultTree, rootNode.id, options.supportedGateTypes);

  const exclusionReasons: string[] = [];

  if (traversal.basicEventIds.size === 0) {
    exclusionReasons.push("No reachable basic events were found.");
  }

  if (traversal.basicEventIds.size > options.maxBasicEvents) {
    exclusionReasons.push(
      `Basic event count ${traversal.basicEventIds.size} exceeds configured limit ${options.maxBasicEvents}.`
    );
  }

  if (traversal.unsupportedGateTypesFound.size > 0) {
    exclusionReasons.push(
      `Unsupported gate types present: ${[...traversal.unsupportedGateTypesFound].sort().join(", ")}.`
    );
  }

  if (traversal.issues.length > 0) {
    exclusionReasons.push("Traversal issues were detected.");
  }

  return {
    rootNodeId: rootNode.id,
    rootNodeLabel: rootNode.label,
    rootNodeKind: rootNode.kind,
    rootGateType: rootNode.gateType,
    subtreeNodeIds: [...traversal.subtreeNodeIds].sort(),
    basicEventIds: [...traversal.basicEventIds].sort(),
    gateNodeIds: [...traversal.gateNodeIds].sort(),
    basicEventCount: traversal.basicEventIds.size,
    gateCount: traversal.gateNodeIds.size,
    maxDepth: traversal.maxDepth,
    supportedGateTypesFound: [...traversal.supportedGateTypesFound].sort(),
    unsupportedGateTypesFound: [...traversal.unsupportedGateTypesFound].sort(),
    quantumTractable: exclusionReasons.length === 0,
    exclusionReasons,
    issues: traversal.issues
  };
}

function traverseSubtree(
  faultTree: NormalizedFaultTree,
  rootNodeId: string,
  supportedGateTypes: NormalizedGateType[]
): TraversalResult {
  const subtreeNodeIds = new Set<string>();
  const basicEventIds = new Set<string>();
  const gateNodeIds = new Set<string>();
  const supportedGateTypesFound = new Set<NormalizedGateType>();
  const unsupportedGateTypesFound = new Set<NormalizedGateType>();
  const issues: string[] = [];
  const supportedGateTypeSet = new Set<NormalizedGateType>(supportedGateTypes);

  let maxDepth = 0;

  const visit = (nodeId: string, depth: number, activePath: Set<string>): void => {
    if (activePath.has(nodeId)) {
      issues.push(`Cycle detected at node ${nodeId}.`);
      return;
    }

    const node = faultTree.nodes[nodeId];
    if (!node) {
      issues.push(`Missing node reference: ${nodeId}.`);
      return;
    }

    subtreeNodeIds.add(nodeId);
    if (depth > maxDepth) {
      maxDepth = depth;
    }

    if (node.kind === "basicEvent") {
      basicEventIds.add(nodeId);
      return;
    }

    gateNodeIds.add(nodeId);

    if (!node.gateType) {
      issues.push(`Gate node ${nodeId} is missing gateType.`);
    } else if (supportedGateTypeSet.has(node.gateType)) {
      supportedGateTypesFound.add(node.gateType);
    } else {
      unsupportedGateTypesFound.add(node.gateType);
    }

    const children = node.children ?? [];
    if (children.length === 0) {
      issues.push(`Gate node ${nodeId} has no children.`);
    }

    const nextPath = new Set(activePath);
    nextPath.add(nodeId);

    for (const childId of children) {
      visit(childId, depth + 1, nextPath);
    }
  };

  visit(rootNodeId, 0, new Set<string>());

  return {
    subtreeNodeIds,
    basicEventIds,
    gateNodeIds,
    supportedGateTypesFound,
    unsupportedGateTypesFound,
    issues: uniqueSortedStrings(issues),
    maxDepth
  };
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
EOF

cat > "${PKG_ROOT}/src/lib/quantum-readiness.spec.ts" <<'EOF'
import {
  analyzeFaultTreeReadiness,
  buildReadinessSummary,
  extractCandidateSubtrees
} from "./quantum-readiness";
import type { NormalizedFaultTree } from "./types";

describe("quantum-readiness", () => {
  it("identifies gate rooted candidates in a simple OR of AND structure", () => {
    const tree: NormalizedFaultTree = {
      id: "ft-simple",
      name: "Simple Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "or",
          children: ["G1", "C"]
        },
        G1: {
          id: "G1",
          kind: "gate",
          gateType: "and",
          children: ["A", "B"]
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" },
        C: { id: "C", kind: "basicEvent" }
      }
    };

    const candidates = extractCandidateSubtrees(tree);

    expect(candidates).toHaveLength(2);

    const topCandidate = candidates.find((candidate) => candidate.rootNodeId === "TOP");
    const g1Candidate = candidates.find((candidate) => candidate.rootNodeId === "G1");

    expect(topCandidate).toBeDefined();
    expect(g1Candidate).toBeDefined();

    expect(topCandidate?.basicEventCount).toBe(3);
    expect(topCandidate?.quantumTractable).toBe(true);

    expect(g1Candidate?.basicEventCount).toBe(2);
    expect(g1Candidate?.quantumTractable).toBe(true);
  });

  it("flags unsupported gate types as excluded in version 1", () => {
    const tree: NormalizedFaultTree = {
      id: "ft-not",
      name: "NOT Gate Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "not",
          children: ["A"]
        },
        A: { id: "A", kind: "basicEvent" }
      }
    };

    const report = analyzeFaultTreeReadiness(tree);

    expect(report.summary.totalCandidateSubtrees).toBe(1);
    expect(report.summary.totalQuantumTractableCandidates).toBe(0);
    expect(report.candidates[0]?.unsupportedGateTypesFound).toContain("not");
    expect(report.candidates[0]?.quantumTractable).toBe(false);
  });

  it("builds a readable summary string", () => {
    const tree: NormalizedFaultTree = {
      id: "ft-summary",
      name: "Summary Fault Tree",
      topNodeId: "TOP",
      sourceFormat: "normalized",
      nodes: {
        TOP: {
          id: "TOP",
          kind: "gate",
          gateType: "or",
          children: ["A", "B"]
        },
        A: { id: "A", kind: "basicEvent" },
        B: { id: "B", kind: "basicEvent" }
      }
    };

    const report = analyzeFaultTreeReadiness(tree);
    const summary = buildReadinessSummary(report);

    expect(summary).toContain("# Quantum Readiness Summary");
    expect(summary).toContain("Model ID: ft-summary");
    expect(summary).toContain("Quantum Tractable Candidates: 1");
  });
});
EOF

echo "Created packages/quantum-readiness"
find "${PKG_ROOT}" -maxdepth 3 -type f | sort
