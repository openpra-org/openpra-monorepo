import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const FAULT_TREE_ROOT = resolve(__dirname, "..");
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

describe("canonical fault-tree editor architecture", () => {
  it("has no ReactFlow dependency or legacy renderer modules", () => {
    const reactFlowImports = productionTypeScriptFiles(FAULT_TREE_ROOT)
      .filter((file) => /["']reactflow["']/.test(readFileSync(file, "utf8")))
      .map((file) => relative(SOURCE_ROOT, file));
    const legacyModules = [
      "faultTreeLayout.ts",
      "faultTreeNode.tsx",
      "faultTreeRules.ts",
      "nodeIcons.tsx",
    ].filter((file) => existsSync(join(FAULT_TREE_ROOT, file)));

    expect({ reactFlowImports, legacyModules }).toEqual({
      reactFlowImports: [],
      legacyModules: [],
    });
  });

  it("requires hosts to consume the editor through its public index", () => {
    const internalImports = productionTypeScriptFiles(SOURCE_ROOT)
      .filter((file) => !file.startsWith(FAULT_TREE_ROOT))
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return /from\s+["'][^"']*newly-developed-methods\/fault-tree\/[^"']+["']/.test(source)
          ? [relative(SOURCE_ROOT, file)]
          : [];
      });

    expect(internalImports).toEqual([]);
  });

  it("does not retain the former SY-local fault-tree renderer", () => {
    const syScreens = ["syScreens.tsx", "syScreens2.tsx"]
      .map((file) => join(SOURCE_ROOT, "sy-workbooks", file))
      .filter(existsSync)
      .map((file) => ({ file: relative(SOURCE_ROOT, file), source: readFileSync(file, "utf8") }));
    const duplicates = syScreens.flatMap(({ file, source }) =>
      /function\s+(?:computeFtLayout|FtSymbol|FtBox|FtLegend|FaultTree)\b/.test(source)
        ? [file]
        : [],
    );

    expect(duplicates).toEqual([]);
  });
});
