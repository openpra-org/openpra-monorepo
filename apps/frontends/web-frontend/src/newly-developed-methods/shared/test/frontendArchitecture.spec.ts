import { readdirSync, readFileSync } from "fs";
import { extname, join, relative } from "path";

interface SourceViolation {
  file: string;
  rule: string;
}

const SOURCE_ROOT = join(__dirname, "..", "..", "..");
const METHOD_EDITOR_ROOT = join(SOURCE_ROOT, "newly-developed-methods");

function productionTypeScriptFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "test" ? [] : productionTypeScriptFiles(path);
    }
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

function findViolations(
  files: string[],
  rules: readonly { name: string; pattern: RegExp }[],
): SourceViolation[] {
  return files.flatMap((file) => {
    const source = readFileSync(file, "utf8");
    return rules
      .filter(({ pattern }) => pattern.test(source))
      .map(({ name }) => ({ file: relative(SOURCE_ROOT, file), rule: name }));
  });
}

describe("frontend workbook-owned editor architecture", () => {
  it("does not expose a standalone project model library route or API client", () => {
    const projectModelSegment = ["method", "models"].join("-");
    const modelLibrarySegment = ["model", "library"].join("-");
    const violations = findViolations(productionTypeScriptFiles(SOURCE_ROOT), [
      { name: "project method-model endpoint", pattern: new RegExp(projectModelSegment, "i") },
      { name: "standalone model-library route", pattern: new RegExp(modelLibrarySegment, "i") },
      { name: "standalone ModelLibrary component", pattern: /ModelLibrary/ },
    ]);

    expect(violations).toEqual([]);
  });

  it("keeps canonical editor implementations independent of frontend persistence layers", () => {
    const violations = findViolations(productionTypeScriptFiles(METHOD_EDITOR_ROOT), [
      { name: "project persistence import", pattern: /projectApi/ },
      { name: "workbook persistence import", pattern: /workbookApi/ },
      { name: "workbook context import", pattern: /WorkbookContext/ },
    ]);

    expect(violations).toEqual([]);
  });
});
