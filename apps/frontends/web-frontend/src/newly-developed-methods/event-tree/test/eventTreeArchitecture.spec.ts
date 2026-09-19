import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const EVENT_TREE_ROOT = resolve(__dirname, "..");
const SOURCE_ROOT = resolve(__dirname, "../../..");

function productionFiles(root: string, extensions: string[]): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return entry.name === "test" ? [] : productionFiles(path, extensions);
    return extensions.includes(extname(entry.name)) ? [path] : [];
  });
}

describe("canonical event-tree editor architecture", () => {
  it("has exactly one production event-tree renderer family", () => {
    const renderers = productionFiles(SOURCE_ROOT, [".ts", ".tsx"])
      .filter((file) => /function\s+(?:EventTreeEditor|ClassicEventTreeDiagram|EventSequenceDiagram|DynamicEventSequenceDiagram)\b/.test(readFileSync(file, "utf8")))
      .map((file) => relative(SOURCE_ROOT, file).replaceAll("\\", "/"));

    expect([...new Set(renderers)].sort()).toEqual([
      "newly-developed-methods/event-tree/eventTreeEditor.tsx",
      "newly-developed-methods/event-tree/eventTreePresentation.tsx",
    ]);
  });

  it("keeps renderer styles in the canonical event-tree folder", () => {
    const styleOwners = productionFiles(SOURCE_ROOT, [".css"])
      .filter((file) => /\.estree__head|\.esdg__box|\.esdt__node/.test(readFileSync(file, "utf8")))
      .map((file) => relative(SOURCE_ROOT, file).replaceAll("\\", "/"));

    expect(styleOwners).toEqual([
      "newly-developed-methods/event-tree/css/eventTree.css",
    ]);
  });

  it("requires workbook hosts to consume the public event-tree index", () => {
    const internalImports = productionFiles(SOURCE_ROOT, [".ts", ".tsx"])
      .filter((file) => !file.startsWith(EVENT_TREE_ROOT))
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return /from\s+["'][^"']*newly-developed-methods\/event-tree\/[^"']+["']/.test(source)
          ? [relative(SOURCE_ROOT, file)]
          : [];
      });

    expect(internalImports).toEqual([]);
  });
});
