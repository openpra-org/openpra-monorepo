import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const SRC_ROOT = resolve(__dirname, "../..");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "test" ? [] : sourceFiles(path);
    return [".css", ".html", ".ts", ".tsx"].includes(extname(path)) ? [path] : [];
  });
}

describe("OpenPRA brand system", () => {
  it("ships the canonical OpenPRA design tokens with the application", () => {
    const installed = readFileSync(join(SRC_ROOT, "design-system", "openpra-brand-tokens.css"), "utf8");
    expect(installed).toContain("--op-violet-500: #8F4EC7");
    expect(installed).toContain("--op-ink: #1B1226");
    expect(installed).toContain("--op-teal-500: #12C5B9");
    expect(installed).toContain("--op-ember-500: #DE6A2B");
    expect(installed).toContain("--op-font-ui: 'IBM Plex Sans'");
    expect(installed).toContain("--op-font-display: 'STIX Two Text'");
  });

  it("installs every font family used by the brand typography roles", () => {
    const fontRoot = join(SRC_ROOT, "assets", "brand", "fonts");
    [
      "IBMPlexSans-Regular.ttf",
      "IBMPlexSans-SemiBold.ttf",
      "IBMPlexMono-Regular.ttf",
      "IBMPlexMono-SemiBold.ttf",
      "STIXTwoText-Regular.ttf",
      "STIXTwoText-Bold.ttf",
      "STIXTwoMath-Regular.ttf",
    ].forEach((font) => { expect(existsSync(join(fontRoot, font))).toBe(true); });

    const project = JSON.parse(readFileSync(join(SRC_ROOT, "..", "project.json"), "utf8")) as {
      targets: { build: { options: { assets: Array<{ input?: string; output?: string }> } } };
    };
    const assets = project.targets.build.options.assets;
    expect(assets).toContainEqual(expect.objectContaining({
      input: "apps/frontends/web-frontend/src/assets/brand",
      output: "/assets/brand",
    }));
    expect(assets).toContainEqual(expect.objectContaining({
      input: "apps/frontends/web-frontend/src/design-system",
      output: "/assets/brand",
    }));
    expect(readFileSync(join(SRC_ROOT, "index.html"), "utf8"))
      .toContain('href="/assets/brand/fonts.css"');
  });

  it("keeps the application canvas white for every theme", () => {
    const tokens = readFileSync(join(SRC_ROOT, "design-system", "app-tokens.css"), "utf8");
    const foundation = readFileSync(join(SRC_ROOT, "design-system", "foundation.css"), "utf8");
    const theme = readFileSync(join(SRC_ROOT, "welcome", "useTheme.ts"), "utf8");
    expect(tokens).toMatch(/:root,\s*\[data-theme="light"\],\s*\[data-theme="dark"\]/);
    expect(tokens).toContain("--color-canvas: var(--op-slate-0)");
    expect(foundation).toMatch(/html,\s*body,\s*#root\s*{[\s\S]*background:\s*var\(--color-canvas\)/);
    expect(theme).toContain('style.backgroundColor = "#FFFFFF"');
    expect(theme).toContain('themeColor.content = "#FFFFFF"');
  });

  it("limits theme-specific dark surfaces to the design-system chrome", () => {
    const componentCss = sourceFiles(SRC_ROOT)
      .filter((file) => extname(file) === ".css" && !file.includes(`${join("src", "design-system")}`))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(componentCss).not.toMatch(/\[data-theme\s*=\s*["']dark["']\]/);
    expect(componentCss).not.toMatch(/prefers-color-scheme\s*:\s*dark/);
  });

  it("does not restore legacy logos, fonts, or pre-package violet", () => {
    const source = sourceFiles(SRC_ROOT).map((file) => readFileSync(file, "utf8")).join("\n");
    const legacyFonts = new RegExp([
      `${"Nun"}ito Sans`,
      `${"Lite"}rata`,
      `${"Jet"}Brains Mono`,
      `${"Cav"}eat`,
    ].join("|"));
    const legacyViolets = new RegExp(["#7939", "b1|#6a2f", "a0"].join(""), "i");
    expect(source).not.toMatch(/assets\/(?:OpenPRA|Triplet)\.png/i);
    expect(source).not.toMatch(legacyFonts);
    expect(source).not.toMatch(legacyViolets);
  });
});
