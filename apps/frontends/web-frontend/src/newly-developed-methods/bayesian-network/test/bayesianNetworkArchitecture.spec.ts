import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const BAYESIAN_NETWORK_ROOT = resolve(__dirname, "..");
const SOURCE_ROOT = resolve(__dirname, "../../..");

function productionTypeScriptFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "test" ? [] : productionTypeScriptFiles(path);
    }
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

describe("canonical Bayesian-network editor architecture", () => {
  it("has exactly one production Bayesian-network renderer", () => {
    const renderers = productionTypeScriptFiles(SOURCE_ROOT)
      .filter((file) => /function\s+BayesianNetworkEditor\b/.test(readFileSync(file, "utf8")))
      .map((file) => relative(SOURCE_ROOT, file).replaceAll("\\", "/"));

    expect(renderers).toEqual([
      "newly-developed-methods/bayesian-network/bayesianNetworkEditor.tsx",
    ]);
  });

  it("requires hosts to consume the editor through its public index", () => {
    const internalImports = productionTypeScriptFiles(SOURCE_ROOT)
      .filter((file) => !file.startsWith(BAYESIAN_NETWORK_ROOT))
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return /from\s+["'][^"']*newly-developed-methods\/bayesian-network\/[^"']+["']/.test(source)
          ? [relative(SOURCE_ROOT, file)]
          : [];
      });

    expect(internalImports).toEqual([]);
  });

  it("keeps the canonical editor independent of workbook persistence", () => {
    const violations = productionTypeScriptFiles(BAYESIAN_NETWORK_ROOT)
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return /(?:workbookApi|WorkbookContext|patchJson|postJson)/.test(source)
          ? [relative(SOURCE_ROOT, file)]
          : [];
      });

    expect(violations).toEqual([]);
  });
});
