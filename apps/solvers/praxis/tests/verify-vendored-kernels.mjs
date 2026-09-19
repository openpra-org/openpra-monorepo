import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { repositoryRoot } from "./verify-hcl-references.mjs";

export const vendorPath = "apps/solvers/praxis/vendor/scipy-quantiles";
const supportingFiles = [
  "bridge.cpp", "windows_math.h", "README.md", "manifest.json",
  "math-LICENSE", "math-revision.json", "scipy-LICENSE.txt",
  "xsf-LICENSE", "xsf-LICENSES_bundled.txt", "xsf-revision.json",
  "reference/mingw/manifest.json",
];
// Latin-1 preserves every byte, including legacy comments in the MinGW source.
const sourceHash = (bytes) => createHash("sha256")
  .update(bytes.toString("latin1").replace(/\r\n/g, "\n"), "latin1").digest("hex");

// Keep the existing upstream manifests authoritative. Line-ending conversion
// during checkout is allowed; numerical source changes are not.
export function verifyVendoredKernels(root = repositoryRoot, { checkGit = false } = {}) {
  const required = supportingFiles.map((name) => `${vendorPath}/${name}`);
  let sourceFiles = 0;
  for (const [manifest, directory] of [
    ["manifest.json", "include"],
    ["reference/mingw/manifest.json", "reference/mingw"],
  ]) {
    const entries = JSON.parse(readFileSync(resolve(root, vendorPath, manifest), "utf8"));
    for (const [name, expected] of Object.entries(entries)) {
      const path = `${vendorPath}/${directory}/${name}`;
      assert.equal(sourceHash(readFileSync(resolve(root, path))), expected, `Vendor source changed: ${path}`);
      required.push(path);
      sourceFiles++;
    }
  }
  for (const path of required) assert.ok(readFileSync(resolve(root, path)).length, `Empty vendor file: ${path}`);
  if (checkGit) {
    // Include unstaged additions so this also detects ignored-but-present files
    // in a developer checkout, before they disappear from a clean CI checkout.
    const visible = new Set(execFileSync("git", [
      "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", vendorPath,
    ], { cwd: root, encoding: "utf8" }).split("\0"));
    for (const path of required) assert.ok(visible.has(path), `Vendor file excluded from Git: ${path}`);
  }
  return { sourceFiles, requiredFiles: required.length, gitChecked: checkGit };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(verifyVendoredKernels(repositoryRoot, {
    checkGit: process.argv.includes("--check-git"),
  }), null, 2));
}
