import { SeismicPRASchema } from "interfaces-mef-types/zod/seismic/seismic-pra";
import { SEISMIC_PRA_ANALYSIS_HTGR } from "../../example-workbooks/seeds/seismic-pra-seed-htgr";
import { SEISMIC_PRA_ANALYSIS } from "../../example-workbooks/seeds/seismic-pra-seed";
import { createBlankSeismicPra } from "../blank-seismic-pra";

describe("Seismic PRA MEF documents", () => {
  it("creates a schema-valid blank workbook with all 109 supporting requirements", () => {
    const mef = createBlankSeismicPra("Seismic PRA", "preparer");
    expect(SeismicPRASchema.safeParse(mef).success).toBe(true);
    expect(mef.conformanceMatrix).toHaveLength(109);
    expect(mef.conformanceMatrix.filter((row) => row.sr.startsWith("SHA-"))).toHaveLength(40);
    expect(mef.conformanceMatrix.filter((row) => row.sr.startsWith("SFR-"))).toHaveLength(28);
    expect(mef.conformanceMatrix.filter((row) => row.sr.startsWith("SPR-"))).toHaveLength(41);
  });

  it.each([
    ["SFR", SEISMIC_PRA_ANALYSIS],
    ["HTGR", SEISMIC_PRA_ANALYSIS_HTGR],
  ])("provides a schema-valid, fully linked %s example", (_name, mef) => {
    const result = SeismicPRASchema.safeParse(mef);
    expect(result.success).toBe(true);
    expect(mef.conformanceMatrix).toHaveLength(109);
    expect(mef.conformanceMatrix.every((row) => row.status === "MET" && row.evidence.length > 0)).toBe(true);
    expect(mef.seismicHazardAnalysis.hazardQuantification.hazardCurves.length).toBeGreaterThan(0);
    expect(mef.seismicFragilityAnalysis.results.fragilityEvaluations.length).toBeGreaterThan(0);
    expect(mef.seismicPlantResponseAnalysis.quantification.eventSequenceFamilyQuantifications.length).toBeGreaterThan(0);
    expect(mef.integration.interfaces).toHaveLength(3);
    expect(mef.integration.unresolvedInterfaces).toHaveLength(0);
  });
});
