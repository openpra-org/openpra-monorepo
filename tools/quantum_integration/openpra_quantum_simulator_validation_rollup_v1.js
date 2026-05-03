#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const SCRIPT_VERSION = "openpra-quantum-simulator-validation-rollup-v1";

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputRoot = path.resolve(args.inputRoot);
  const outputRoot = path.resolve(args.outputRoot ?? inputRoot);

  ensureDir(outputRoot);

  const summaryPaths = findFilesByName(inputRoot, "openpra_quantum_validation_case_summary_v1.json").sort();
  if (summaryPaths.length === 0) {
    throw new Error(`No validation case summaries found under: ${inputRoot}`);
  }

  const summaries = summaryPaths.map((filePath) => readJson(filePath));
  const rollup = buildRollup(inputRoot, summaries, summaryPaths);

  const rollupJsonPath = path.join(outputRoot, "openpra_quantum_simulator_validation_rollup_v1.json");
  const rollupMdPath = path.join(outputRoot, "openpra_quantum_simulator_validation_rollup_v1.md");

  writeJson(rollupJsonPath, rollup);
  fs.writeFileSync(rollupMdPath, buildMarkdownSummary(rollup), "utf8");

  process.stdout.write(`${rollupJsonPath}\n${rollupMdPath}\n`);
}

function parseArgs(argv) {
  const out = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }

    const key = token.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for argument --${key}`);
    }

    i += 1;

    if (key === "input-root") {
      out.inputRoot = value;
      continue;
    }

    if (key === "output-root") {
      out.outputRoot = value;
      continue;
    }

    throw new Error(`Unknown argument: --${key}`);
  }

  if (!out.inputRoot) {
    throw new Error("--input-root is required");
  }

  return out;
}

function buildRollup(inputRoot, summaries, summaryPaths) {
  const topologyCounts = {};
  const primaryModeCounts = {};
  const caseRows = [];

  let exactRecoveryCount = 0;
  let operatorAttentionCount = 0;
  let allExact = true;

  for (const summary of summaries) {
    const topologyClass = summary.topologyClass ?? "unknown";
    const primaryMode = summary.recovery?.primaryMode ?? "unknown";
    const requiresOperatorAttention = Boolean(summary.recovery?.requiresOperatorAttention);
    const unionAllRecovered = Boolean(summary.recovery?.unionAllRecovered);

    topologyCounts[topologyClass] = (topologyCounts[topologyClass] ?? 0) + 1;
    primaryModeCounts[primaryMode] = (primaryModeCounts[primaryMode] ?? 0) + 1;

    if (primaryMode === "exact_hardware_recovery") {
      exactRecoveryCount += 1;
    } else {
      allExact = false;
    }

    if (requiresOperatorAttention) {
      operatorAttentionCount += 1;
    }

    caseRows.push({
      caseLabel: summary.caseLabel,
      modelId: summary.modelId,
      subtreeId: summary.subtreeId,
      rootGateId: summary.rootGateId,
      topologyClass,
      shots: summary.shots,
      samplingMode: summary.simulator?.samplingMode ?? null,
      supportCount: summary.simulator?.supportCount ?? null,
      primaryMode,
      requiresOperatorAttention,
      tier1RecoveredExactCutSetCount: summary.recovery?.tier1RecoveredExactCutSetCount ?? null,
      tier1ReferenceCount: summary.recovery?.tier1ReferenceCount ?? null,
      unionRecoveredCount: summary.recovery?.unionRecoveredCount ?? null,
      unionReferenceCount: summary.recovery?.unionReferenceCount ?? null,
      unionAllRecovered,
      summaryPath:
        summary.references?.recoveryArtifactPath ?
          path.join(
            path.dirname(path.dirname(summary.references.recoveryArtifactPath)),
            "40_summary",
            "openpra_quantum_validation_case_summary_v1.json",
          )
        : null,
    });
  }

  return {
    schemaVersion: "1.0.0",
    artifactType: "validation_rollup",
    generatedAtUtc: new Date().toISOString(),
    scriptVersion: SCRIPT_VERSION,
    inputRoot: path.resolve(inputRoot),
    summaryFileCount: summaryPaths.length,
    counts: {
      totalCases: summaries.length,
      topologyCounts: sortObject(topologyCounts),
      primaryModeCounts: sortObject(primaryModeCounts),
      exactRecoveryCount,
      operatorAttentionCount,
      allExact,
    },
    caseRows: caseRows.sort((a, b) => a.caseLabel.localeCompare(b.caseLabel)),
    acceptanceStyleChecks: {
      anyCasesFound: summaries.length > 0,
      syntheticRecoveryAllExact: allExact,
      operatorAttentionCount,
      topologyClassCoverageCount: Object.keys(topologyCounts).length,
    },
  };
}

function buildMarkdownSummary(rollup) {
  const lines = [];
  lines.push("# OpenPRA Quantum Simulator Validation Rollup v1");
  lines.push("");
  lines.push(`Generated at UTC: ${rollup.generatedAtUtc}`);
  lines.push(`Input root: ${rollup.inputRoot}`);
  lines.push(`Case count: ${rollup.counts.totalCases}`);
  lines.push("");
  lines.push("## Aggregate counts");
  lines.push("");
  lines.push(`Exact recovery count: ${rollup.counts.exactRecoveryCount}`);
  lines.push(`Operator attention count: ${rollup.counts.operatorAttentionCount}`);
  lines.push(`All exact: ${rollup.counts.allExact}`);
  lines.push("");
  lines.push("### Topology counts");
  lines.push("");

  for (const [key, value] of Object.entries(rollup.counts.topologyCounts)) {
    lines.push(`- ${key}: ${value}`);
  }

  lines.push("");
  lines.push("### Primary mode counts");
  lines.push("");

  for (const [key, value] of Object.entries(rollup.counts.primaryModeCounts)) {
    lines.push(`- ${key}: ${value}`);
  }

  lines.push("");
  lines.push("## Case rows");
  lines.push("");
  lines.push("| Case | Topology | Primary mode | Tier 1 | Union | Attention |");
  lines.push("|---|---|---|---:|---:|---|");

  for (const row of rollup.caseRows) {
    const tier1 = `${row.tier1RecoveredExactCutSetCount ?? "na"}/${row.tier1ReferenceCount ?? "na"}`;
    const union = `${row.unionRecoveredCount ?? "na"}/${row.unionReferenceCount ?? "na"}`;
    lines.push(
      `| ${row.caseLabel} | ${row.topologyClass} | ${row.primaryMode} | ${tier1} | ${union} | ${row.requiresOperatorAttention ? "yes" : "no"} |`,
    );
  }

  lines.push("");
  return lines.join("\n") + "\n";
}

function findFilesByName(rootDir, fileName) {
  const results = [];
  walk(rootDir, (entryPath, stats) => {
    if (stats.isFile() && path.basename(entryPath) === fileName) {
      results.push(entryPath);
    }
  });
  return results;
}

function walk(rootDir, visitor) {
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath, visitor);
      continue;
    }
    if (entry.isFile()) {
      visitor(entryPath, fs.statSync(entryPath));
    }
  }
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

main();
