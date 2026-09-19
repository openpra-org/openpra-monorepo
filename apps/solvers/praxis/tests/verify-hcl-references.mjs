import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
export const manifestPath = "apps/solvers/praxis/tests/hcl-reference-manifest.json";

// These are text artifacts. Ignore checkout line-ending conversion, but no
// other byte changes, so Windows and Linux verify the same frozen content.
export const textHash = (bytes) =>
  createHash("sha256").update(bytes.toString("utf8").replace(/\r\n/g, "\n")).digest("hex");

export function verifyReferences(root = repositoryRoot, { requireSources = false, checkGit = false } = {}) {
  const manifest = JSON.parse(readFileSync(resolve(root, manifestPath), "utf8"));
  assert.equal(manifest.version, 1);
  if (checkGit) {
    const visible = new Set(execFileSync("git", [
      "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "apps",
    ], { cwd: root, encoding: "utf8" }).split("\0"));
    for (const path of [manifestPath, ...Object.keys(manifest.files)])
      assert.ok(visible.has(path), `Reference excluded from Git: ${path}`);
  }
  for (const [path, expected] of Object.entries(manifest.files)) {
    assert.equal(textHash(readFileSync(resolve(root, path))), expected, `Reference changed: ${path}`);
  }
  const available = existsSync(resolve(root, "resources/HCL_MH"));
  assert.ok(available || !requireSources, "HCL_MH source checkout is required but missing");
  // Frozen metadata must still point to the recorded original source bytes.
  // When available, also check the actual source checkout (including partial
  // checkouts: a missing individual source file is an error).
  for (const [fixturePath, references] of Object.entries(manifest.sourceReferences)) {
    const fixture = JSON.parse(readFileSync(resolve(root, fixturePath), "utf8"));
    for (const { path, sha256, sha256Lf, metadataKey, copy } of references) {
      const recorded = metadataKey.reduce((value, key) => value[key], fixture);
      assert.equal(recorded, sha256, `Source metadata changed: ${fixturePath}: ${path}`);
      if (copy)
        assert.equal(textHash(readFileSync(resolve(root, copy))), sha256Lf, `Frozen source copy changed: ${copy}`);
      if (available) assert.equal(textHash(readFileSync(resolve(root, path))), sha256Lf, `Source changed: ${path}`);
    }
  }
  for (const { fixture, key, input, sha256, sha256Lf } of manifest.dependencies) {
    const metadata = JSON.parse(readFileSync(resolve(root, fixture), "utf8"));
    assert.equal(metadata.input_fixture_sha256[key], sha256, `Stale input reference: ${fixture}`);
    assert.ok(Object.hasOwn(manifest.files, input), `Unprotected input: ${input}`);
    assert.equal(
      textHash(readFileSync(resolve(root, input))),
      sha256Lf,
      `Input changed without regeneration: ${input}`,
    );
  }
  return {
    frozenFiles: Object.keys(manifest.files).length,
    sourceFiles: new Set(
      Object.values(manifest.sourceReferences)
        .flat()
        .map((row) => row.path),
    ).size,
    sourceCheckout: available ? "verified" : "absent; frozen artifacts and provenance verified",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(
    JSON.stringify(
      verifyReferences(repositoryRoot, {
        requireSources: process.argv.includes("--require-sources"),
        checkGit: process.argv.includes("--check-git"),
      }),
      null,
      2,
    ),
  );
}
