import type { MechanisticSourceTermAnalysis, SourceInventory, SourceTermDefinition } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import { rcMsBoundingMember, rcMsInventoryIds, rcMsSourceTermFor, rcSourceTermFromMs } from "../ms-source-term";

const inventory = (uuid: string, rows: [string, number, string][]): SourceInventory => ({ uuid, name: uuid, description: "", calculationBasis: "PLANT_SPECIFIC_CALCULATION",
  inventory: rows.map(([radionuclide, quantity, unit]) => ({ radionuclide, quantity, unit })), implementsSrs: [] });
const fraction = (radionuclide: string, quantity: number) => ({ radionuclide, quantity, unit: "fraction", expressedAsReleaseFraction: true });
const core = inventory("SRC-H1", [["Xe-133", 2.8e18, "Bq"], ["Cs-137", 1.5e17, "Bq"]]);
const circuit = inventory("SRC-H2", [["H-3", 2e15, "Bq"], ["Cs-137", 5e14, "Bq"]]);
const definition = (): SourceTermDefinition => ({
  uuid: "ST-3", releaseCategoryReference: "RC-1", sourceTermBasis: "PLANT_SPECIFIC_MECHANISTIC",
  releasePhases: [{ uuid: "p2", name: "Cooldown tail", startTime: 2, endTime: 96, timeUnit: "h" }, { uuid: "p1", name: "Depressurization puff", startTime: 0, endTime: 2, timeUnit: "h" }],
  radionuclideReleases: [
    { phaseId: "p1", quantities: [fraction("Xe-133", 2e-2), fraction("H-3", 1e-1), fraction("Cs-137", 6e-5)] },
    { phaseId: "p2", quantities: [fraction("Xe-133", 1e-2), fraction("H-3", 5e-2), fraction("Cs-137", 3e-5)] },
  ],
  releaseForms: [], releaseElevation: { quantity: 10, unit: "m, ground level" }, implementsSrs: [],
});

describe("Mechanistic source term import", () => {
  it("builds one chemical group per released radionuclide from the selected inventories", () => {
    const result = rcSourceTermFromMs(definition(), [core, circuit]);
    expect(result.issues).toEqual([]);
    expect(result.values?.groups).toEqual([{ id: 1, name: "Xe-133" }, { id: 2, name: "H-3" }, { id: 3, name: "Cs-137" }]);
    expect(result.values?.inventory).toEqual([{ name: "Xe-133", activityBq: 2.8e18, group: 1 }, { name: "H-3", activityBq: 2e15, group: 2 }, { name: "Cs-137", activityBq: 1.505e17, group: 3 }]);
    expect(result.values?.releases).toEqual([
      { id: 1, startSeconds: 0, durationSeconds: 7200, heightMetres: 10, fractions: [2e-2, 1e-1, 6e-5] },
      { id: 2, startSeconds: 7200, durationSeconds: 338400, heightMetres: 10, fractions: [1e-2, 5e-2, 3e-5] },
    ]);
  });
  it("reports released radionuclides that no selected inventory holds", () => {
    const result = rcSourceTermFromMs(definition(), [core]);
    expect(result.issues).toEqual(["H-3 is released but is not in the selected inventories."]);
    expect(result.values?.groups.map((group) => group.name)).toEqual(["Xe-133", "Cs-137"]);
  });
  it("converts curies and absolute releases, and leaves a non-metre height for the analyst", () => {
    const source = definition();
    source.releaseElevation = { quantity: 30, unit: "ft" };
    source.radionuclideReleases[0].quantities[2] = { radionuclide: "Cs-137", quantity: 1.5e13, unit: "Bq" };
    const result = rcSourceTermFromMs(source, [inventory("SRC-C", [["Xe-133", 1e8, "Ci"], ["H-3", 1, "MCi"], ["Cs-137", 1e7, "Ci"]])]);
    expect(result.issues).toEqual(["Release elevation unit ft is not metres. Enter the height in Step 01."]);
    expect(result.values?.inventory.map((row) => row.activityBq)).toEqual([3.7e18, 3.7e16, 3.7e17]);
    expect(result.values?.releases[0].heightMetres).toBeUndefined();
    expect(result.values?.releases[0].fractions[2]).toBeCloseTo(1.5e13 / 3.7e17, 20);
  });
  it("rejects fractions that exceed the whole inventory across phases", () => {
    const source = definition();
    source.radionuclideReleases[1].quantities[1] = fraction("H-3", 0.95);
    const result = rcSourceTermFromMs(source, [core, circuit]);
    expect(result.values).toBeUndefined();
    expect(result.issues.join(" ")).toContain("H-3: fractions across all segments exceed 1");
  });
  it("defaults to the MS source term, inventories and bounding member of the category", () => {
    const ms = {
      sourceTermDefinitions: [definition()], sourceInventories: [core, circuit, inventory("SRC-H3", [["Cs-137", 2e16, "Bq"]])],
      transportBarrierAssessments: [
        { uuid: "BAR-1", name: "Fuel", releaseCategoryReference: "RC-1", sourceInventoryRefs: ["SRC-H1"], description: "", barrierType: "" },
        { uuid: "BAR-2", name: "Circuit", releaseCategoryReference: "RC-1", sourceInventoryRefs: ["SRC-H2", "SRC-H1"], description: "", barrierType: "" },
      ],
      releaseCategories: [{ uuid: "RC-1", name: "Unfiltered", description: "", technicalBasis: "", differentiationBasis: "CONSEQUENCE_METRIC", boundingSequenceReference: " EHP-4 ",
        boundingSequenceJustification: "Worst unfiltered sequence.", releaseTerminationTime: { value: 96, unit: "h", justification: "" }, implementsSrs: [] }],
    } as Pick<MechanisticSourceTermAnalysis, "sourceTermDefinitions" | "sourceInventories" | "transportBarrierAssessments" | "releaseCategories">;
    expect(rcMsSourceTermFor(ms, "RC-1")?.uuid).toBe("ST-3");
    expect(rcMsInventoryIds(ms, "RC-1")).toEqual(["SRC-H1", "SRC-H2"]);
    expect(rcMsInventoryIds(ms, "RC-3")).toEqual(["SRC-H1"]);
    expect(rcMsBoundingMember(ms, "RC-1")).toEqual({ sequenceId: "EHP-4", basis: "Worst unfiltered sequence." });
    expect(rcMsBoundingMember(ms, "RC-2")).toBeUndefined();
  });
});
