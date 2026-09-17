import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { repositoryRoot } from "./verify-hcl-references.mjs";
import { vendorPath, verifyVendoredKernels } from "./verify-vendored-kernels.mjs";

const header = `${vendorPath}/include/boost/math/tools/type_traits.hpp`;
function checkout(t) {
  const root = mkdtempSync(resolve(tmpdir(), "praxis-vendor-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(resolve(repositoryRoot, vendorPath), resolve(root, vendorPath), { recursive: true });
  return root;
}

test("all upstream kernels and supporting files are available", (t) => {
  assert.deepEqual(verifyVendoredKernels(checkout(t)), { sourceFiles: 218, requiredFiles: 229, gitChecked: false });
});
test("a missing Boost tools header fails before compilation", (t) => {
  const root = checkout(t);
  rmSync(resolve(root, header));
  assert.throws(() => verifyVendoredKernels(root), /ENOENT/);
});
test("altered upstream numerical code is rejected", (t) => {
  const root = checkout(t);
  writeFileSync(resolve(root, header), readFileSync(resolve(root, header), "utf8") + " ");
  assert.throws(() => verifyVendoredKernels(root), /Vendor source changed/);
});
test("missing license files are rejected", (t) => {
  const root = checkout(t);
  rmSync(resolve(root, vendorPath, "math-LICENSE"));
  assert.throws(() => verifyVendoredKernels(root), /ENOENT/);
});
test("Git packaging check catches locally present ignored headers", (t) => {
  const root = checkout(t);
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  writeFileSync(resolve(root, ".gitignore"), "tools/\n");
  assert.throws(() => verifyVendoredKernels(root, { checkGit: true }), /Vendor file excluded from Git/);
  writeFileSync(resolve(root, ".gitignore"), readFileSync(resolve(repositoryRoot, ".gitignore")));
  assert.equal(verifyVendoredKernels(root, { checkGit: true }).requiredFiles, 229);
});
test("checkout CRLF conversion preserves upstream hashes", (t) => {
  const root = checkout(t);
  writeFileSync(resolve(root, header), readFileSync(resolve(root, header), "utf8").replace(/\r?\n/g, "\r\n"));
  assert.equal(verifyVendoredKernels(root).sourceFiles, 218);
});
