#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const REPO_ROOT = "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo";
const VALIDATION_ROOT = path.join(
  REPO_ROOT,
  "_work/openpra_phase5_validate_package_recovery_on_real_candidates_v1"
);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function utcNowIso() {
  return new Date().toISOString();
}

function latestValidationRun() {
  const dirs = fs
    .readdirSync(VALIDATION_ROOT)
    .map((name) => path.join(VALIDATION_ROOT, name))
    .filter((p) => fs.statSync(p).isDirectory())
    .sort()
    .reverse();

  if (dirs.length === 0) {
    throw new Error(`No validation runs found under ${VALIDATION_ROOT}`);
  }

  return dirs[0];
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalize(value) {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (isObject(value)) {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (key === "generatedAt" || key === "generated_at") {
        continue;
      }
      out[key] = normalize(value[key]);
    }
    return out;
  }

  return value;
}

function diffValues(left, right, currentPath, diffs) {
  const leftIsArray = Array.isArray(left);
  const rightIsArray = Array.isArray(right);
  const leftIsObject = isObject(left);
  const rightIsObject = isObject(right);

  if (leftIsArray || rightIsArray) {
    if (!(leftIsArray && rightIsArray)) {
      diffs.push({
        path: currentPath,
        kind: "type_mismatch",
        leftType: leftIsArray ? "array" : typeof left,
        rightType: rightIsArray ? "array" : typeof right
      });
      return;
    }

    if (left.length !== right.length) {
      diffs.push({
        path: currentPath,
        kind: "array_length_mismatch",
        leftLength: left.length,
        rightLength: right.length
      });
    }

    const maxLen = Math.max(left.length, right.length);
    for (let i = 0; i < maxLen; i += 1) {
      diffValues(left[i], right[i], `${currentPath}[${i}]`, diffs);
    }
    return;
  }

  if (leftIsObject || rightIsObject) {
    if (!(leftIsObject && rightIsObject)) {
      diffs.push({
        path: currentPath,
        kind: "type_mismatch",
        leftType: leftIsObject ? "object" : typeof left,
        rightType: rightIsObject ? "object" : typeof right
      });
      return;
    }

    const leftKeys = new Set(Object.keys(left));
    const rightKeys = new Set(Object.keys(right));

    for (const key of [...leftKeys].sort()) {
      if (!rightKeys.has(key)) {
        diffs.push({
          path: currentPath ? `${currentPath}.${key}` : key,
          kind: "missing_on_right",
          leftValue: left[key]
        });
      }
    }

    for (const key of [...rightKeys].sort()) {
      if (!leftKeys.has(key)) {
        diffs.push({
          path: currentPath ? `${currentPath}.${key}` : key,
          kind: "missing_on_left",
          rightValue: right[key]
        });
      }
    }

    for (const key of [...leftKeys].sort()) {
      if (rightKeys.has(key)) {
        diffValues(
          left[key],
          right[key],
          currentPath ? `${currentPath}.${key}` : key,
          diffs
        );
      }
    }
    return;
  }

  if (left !== right) {
    diffs.push({
      path: currentPath,
      kind: "value_mismatch",
      leftValue: left,
      rightValue: right
    });
  }
}

function main() {
  const runDir = latestValidationRun();
  const labels = fs
    .readdirSync(runDir)
    .filter((name) => /^[0-9]{4}$/.test(name) || ["1037", "0698", "0905"].includes(name))
    .sort();

  const out = {
    generatedAt: utcNowIso(),
    validationRun: runDir,
    cases: {}
  };

  for (const label of labels) {
    const caseDir = path.join(runDir, label);
    const builtPath = path.join(caseDir, "built_from_package.json");
    const expectedPath = path.join(caseDir, "expected_candidate_artifact.json");

    if (!fs.existsSync(builtPath) || !fs.existsSync(expectedPath)) {
      continue;
    }

    const built = normalize(readJson(builtPath));
    const expected = normalize(readJson(expectedPath));
    const diffs = [];

    diffValues(built, expected, "", diffs);

    out.cases[label] = {
      builtPath,
      expectedPath,
      diffCount: diffs.length,
      firstDiffs: diffs.slice(0, 40)
    };
  }

  const outPath = path.join(runDir, "artifact_diff_summary.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(`VALIDATION_RUN=${runDir}`);
  console.log(`DIFF_SUMMARY=${outPath}`);
}

main();
