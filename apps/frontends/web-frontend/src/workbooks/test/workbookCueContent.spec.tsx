import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { composeWorkbookCue } from "../workbookCueContent";
import { WorkbookCueLabel, WorkbookSectionHeading } from "../workbookSectionHeading";

const WORKBOOK_DIRECTORIES = [
  "pos-workbooks",
  "ie-workbooks",
  "es-workbooks",
  "sc-workbooks",
  "sy-workbooks",
  "hr-workbooks",
  "da-workbooks",
  "esq-workbooks",
  "ms-workbooks",
  "rc-workbooks",
  "ri-workbooks",
  "seismic-pra-workbooks",
  "internal-flood-pra-workbooks",
  "internal-fire-pra-workbooks",
  "other-hazards-pra-workbooks",
];

function tsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return (
      statSync(path).isDirectory() ? tsxFiles(path)
      : path.endsWith(".tsx") ? [path]
      : []
    );
  });
}

describe("workbook cue content", () => {
  it("keeps only the workflow contribution, analyst action, and a realistic example", () => {
    const cue = composeWorkbookCue(
      "FLOOD",
      "Flood-area reference locations",
      "Defines the physical areas used to organize flood sources, propagation paths, exposed SSCs, and scenarios. Record each hydraulically distinct room or connected area. These areas become the location basis for later scenarios. Remember to include drains.",
    );

    expect(cue).toBe(
      "Defines the physical areas used to organize flood sources, propagation paths, exposed SSCs, and scenarios. Record each hydraulically distinct room or connected area. For example, Auxiliary Building, elevation 100 ft, Rooms A-101 and A-102.",
    );
    expect(String(cue)).not.toContain("become the location basis");
    expect(String(cue)).not.toContain("Remember");
  });

  it("generates a concise workbook-specific prompt when a header has no supplied description", () => {
    const cue = String(composeWorkbookCue("IE", "Annual frequencies"));
    expect(cue).toContain("Assigns an annual occurrence frequency");
    expect(cue).toContain("loss of offsite power quantified at 1.1E-2 per reactor-year");
    expect(cue.split(/\s+/).length).toBeLessThanOrEqual(45);
  });

  it("replaces legacy downstream explanations with the section contribution", () => {
    const cue = String(
      composeWorkbookCue(
        "SEISMIC",
        "Ground-motion definition",
        "Use this section to agree on the measurements that every later calculation will use.",
      ),
    );
    expect(cue).toContain("Defines or calculates the ground-motion measures");
    expect(cue).toContain("For example");
    expect(cue).not.toMatch(/later|downstream/i);
  });

  it("keeps both regular and compact subsection cues interactive", async () => {
    render(
      <>
        <WorkbookSectionHeading
          workbook="SC"
          title="Success criteria table"
        />
        <WorkbookCueLabel
          workbook="SC"
          title="Required capacities"
          className="essec"
        />
      </>,
    );

    const sectionCue = screen.getByRole("button", { name: "About Success criteria table" });
    const subsectionCue = screen.getByRole("button", { name: "About Required capacities" });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    await userEvent.click(sectionCue);
    expect(screen.getByRole("note")).toHaveTextContent("two of three DRACS trains");
    await userEvent.click(sectionCue);
    await userEvent.click(subsectionCue);
    expect(screen.getByRole("note")).toHaveTextContent("4.5 MW total heat removal");
  });
});

describe("workbook cue coverage", () => {
  const sourceRoot = resolve(__dirname, "../..");

  it.each(WORKBOOK_DIRECTORIES)("covers analytical headers in %s", (directory) => {
    const sources = tsxFiles(resolve(sourceRoot, directory)).map((path) => readFileSync(path, "utf8"));
    const allSource = sources.join("\n");
    expect(allSource).toMatch(/WorkbookSectionHeading|PosSectionHeading|composeWorkbookCue/);
    expect(allSource).not.toMatch(/<div className="essec">/);

    const rawHeader =
      /<h(?:1|3)\b[^>]*className="(?:posmain__title|poscard__title|posgen__readout-h|sinlineeditor__title|sstructured__section-title)"[^>]*>/g;
    const uncued = sources.flatMap((source) =>
      Array.from(source.matchAll(rawHeader)).filter((match) => {
        const nearby = source.slice(match.index ?? 0, (match.index ?? 0) + 900);
        return !nearby.includes("InfoButton") && !nearby.includes("composeWorkbookCue");
      }),
    );
    expect(uncued).toHaveLength(0);
  });
});
