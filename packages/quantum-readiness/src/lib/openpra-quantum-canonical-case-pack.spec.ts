import {
  getOpenPraQuantumCanonicalCaseByLabel,
  getOpenPraQuantumCanonicalCasePackSummary,
} from "./openpra-quantum-canonical-case-pack";

describe("openpra-quantum-canonical-case-pack", () => {
  it("returns the locked WS5 and WS6 canonical cases", () => {
    const summary = getOpenPraQuantumCanonicalCasePackSummary();

    expect(summary.ws5PriorityCases.map((entry) => entry.caseLabel)).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_1037__G_G348",
      "phase2b_row_0905__G_G939",
    ]);

    expect(summary.ws6AcceptanceCases.map((entry) => entry.caseLabel)).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
  });

  it("loads a canonical case by label", () => {
    const entry = getOpenPraQuantumCanonicalCaseByLabel("phase2b_row_0905__G_G939");
    expect(entry.subtreeId).toBe("G:G939");
    expect(entry.topologyClass).toBe("C");
  });
});
