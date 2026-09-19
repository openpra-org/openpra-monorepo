import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { manifestPath, repositoryRoot, textHash, verifyReferences } from "./verify-hcl-references.mjs";

const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, manifestPath), "utf8"));
const fixture = Object.keys(manifest.sourceReferences)[0];

function copyGate(t) {
  const root = mkdtempSync(resolve(tmpdir(), "hcl-reference-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of [manifestPath, ...Object.keys(manifest.files)]) {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    writeFileSync(resolve(root, path), readFileSync(resolve(repositoryRoot, path)));
  }
  return root;
}

test("frozen artifacts and provenance are checked without an optional source checkout", (t) => {
  const result = verifyReferences(copyGate(t));
  assert.equal(result.frozenFiles, Object.keys(manifest.files).length);
  assert.match(result.sourceCheckout, /absent/);
});

for (const path of [fixture, "apps/solvers/praxis/tests/fixtures/hcl_mh_cpt/generate.py"]) {
  test(`rejects altered reference or generator: ${path}`, (t) => {
    const root = copyGate(t);
    writeFileSync(resolve(root, path), readFileSync(resolve(root, path), "utf8") + " ");
    assert.throws(() => verifyReferences(root), /Reference changed/);
  });
}

test("source review requires a complete matching checkout", (t) => {
  const root = copyGate(t);
  assert.throws(() => verifyReferences(root, { requireSources: true }), /required but missing/);
  const sources = new Set(
    Object.values(manifest.sourceReferences)
      .flat()
      .map((row) => row.path),
  );
  for (const path of sources) {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    // The test does not depend on the developer's optional checkout.
    writeFileSync(resolve(root, path), "changed source");
  }
  assert.throws(() => verifyReferences(root), /Source changed/);
});

test("changing an input and its file manifest still requires regenerated dependent fixtures", (t) => {
  const root = copyGate(t);
  const changed = structuredClone(manifest);
  const input = changed.dependencies[0].input;
  const bytes = readFileSync(resolve(root, input), "utf8") + " ";
  writeFileSync(resolve(root, input), bytes);
  changed.files[input] = textHash(bytes);
  writeFileSync(resolve(root, manifestPath), JSON.stringify(changed));
  assert.throws(() => verifyReferences(root), /Input changed without regeneration/);
});

test("checkout line endings do not change frozen text hashes", () => {
  assert.equal(textHash("a\nb\n"), textHash("a\r\nb\r\n"));
});

test("Git packaging retains every frozen source fixture", (t) => {
  const root = copyGate(t);
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  writeFileSync(resolve(root, ".gitignore"), "fixtures/\n");
  assert.throws(() => verifyReferences(root, { checkGit: true }), /Reference excluded from Git/);
  writeFileSync(resolve(root, ".gitignore"), readFileSync(resolve(repositoryRoot, ".gitignore")));
  assert.equal(verifyReferences(root, { checkGit: true }).frozenFiles, Object.keys(manifest.files).length);
});
