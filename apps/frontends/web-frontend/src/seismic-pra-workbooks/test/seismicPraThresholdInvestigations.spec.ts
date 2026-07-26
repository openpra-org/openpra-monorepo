import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { SeismicPRASchema } from "interfaces-mef-types/zod/seismic/seismic-pra";
import { seismicConformanceItems } from "../seismicPraConformance";

describe("Seismic PRA Step 09 fragility screening", () => {
  it.each(["htgr", "sfr"] as const)(
    "defines technically complete ruggedness and threshold bases for %s",
    (variant) => {
      const mef = createSeismicPraExample(variant);
      const threshold =
        mef.seismicFragilityAnalysis.thresholdProgram;
      const equipment =
        mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment
          .equipment;
      const screened = equipment.filter((item) =>
        item.disposition !== "ACTIVE");

      expect(threshold.inherentlyRuggedBases).toHaveLength(3);
      expect(threshold.thresholdMethods).toHaveLength(4);
      expect(new Set(threshold.screenedSscRefs))
        .toEqual(new Set(screened.map((item) => item.uuid)));
      expect(threshold.anchorageAndSupportIncluded).toBe(true);
      expect(threshold.screeningConfirmationMethod.length).toBeGreaterThan(100);

      for (const basis of threshold.inherentlyRuggedBases) {
        expect(basis.genericRuggedComponentTypes.length).toBeGreaterThanOrEqual(3);
        expect(basis.guidanceReferences.length).toBeGreaterThanOrEqual(2);
        expect(basis.plantSpecificAdditions.length).toBeGreaterThanOrEqual(1);
        expect(basis.excludedComponentTypes.length).toBeGreaterThanOrEqual(3);
        expect(basis.capacityBeyondRiskSignificantRangeBasis.length)
          .toBeGreaterThan(80);
        expect(basis.hazardIndependentBasis.length).toBeGreaterThan(50);
      }

      for (const method of threshold.thresholdMethods) {
        expect(method.thresholdCapacity).toBeGreaterThan(0);
        expect(method.capacityUnits).toBe("g");
        expect(method.screeningCapacitySources.length).toBeGreaterThanOrEqual(3);
        expect(method.caveatsAndInclusionRules.length).toBeGreaterThanOrEqual(2);
        expect(method.correlationTreatment.length).toBeGreaterThan(70);
        expect(method.comparisonMethod.length).toBeGreaterThan(80);
        expect(method.satisfiesScr2).toBe(true);
      }
    },
  );

  it("uses reactor-specific screening configurations and capacities", () => {
    const htgr = createSeismicPraExample("htgr")
      .seismicFragilityAnalysis.thresholdProgram;
    const sfr = createSeismicPraExample("sfr")
      .seismicFragilityAnalysis.thresholdProgram;

    expect(htgr.inherentlyRuggedBases.some((basis) =>
      basis.plantSpecificAdditions.some((addition) =>
        addition.componentType.includes("Graphite")))).toBe(true);
    expect(sfr.inherentlyRuggedBases.some((basis) =>
      basis.plantSpecificAdditions.some((addition) =>
        addition.componentType.includes("sodium")))).toBe(true);
    expect(htgr.thresholdMethods[0]?.thresholdCapacity)
      .not.toBe(sfr.thresholdMethods[0]?.thresholdCapacity);
  });
});

describe("Seismic PRA Step 09 plant investigations", () => {
  it.each(["htgr", "sfr"] as const)(
    "provides realistic investigation coverage and findings for %s",
    (variant) => {
      const mef = createSeismicPraExample(variant);
      const investigations =
        mef.seismicFragilityAnalysis.plantInvestigations;
      const equipment =
        mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment
          .equipment;
      const screened = equipment.filter((item) =>
        item.disposition !== "ACTIVE");
      const findings = investigations.flatMap((investigation) =>
        investigation.findings);
      const confirmations = new Map(
        investigations.flatMap((investigation) =>
          investigation.fragilityThresholdConfirmations.map((confirmation) =>
            [confirmation.sscRef, confirmation] as const)),
      );

      expect(investigations).toHaveLength(6);
      expect(findings.length).toBeGreaterThanOrEqual(11);
      expect(new Set(investigations.map((investigation) =>
        investigation.investigationType))).toEqual(
          new Set([
            "COMPUTERIZED_WALKDOWN",
            "DESIGN_DOCUMENT_REVIEW",
            "TABLETOP_REVIEW",
            "WALKDOWN",
          ]),
        );

      for (const investigation of investigations) {
        expect(investigation.scope.length).toBeGreaterThan(70);
        expect(investigation.procedures.length).toBeGreaterThan(100);
        expect(investigation.team.length).toBeGreaterThanOrEqual(2);
        expect(investigation.designDocumentRefs.length).toBeGreaterThanOrEqual(3);
        expect(investigation.sscRefsReviewed.length).toBeGreaterThan(0);
        expect(investigation.anchorageAndLoadPathReview.length)
          .toBeGreaterThan(80);
        expect(investigation.observations.length).toBeGreaterThanOrEqual(3);
        expect(investigation.conclusions.length).toBeGreaterThan(90);
      }

      for (const item of screened) {
        const confirmation = confirmations.get(item.uuid);
        expect(confirmation).toBeDefined();
        expect(confirmation?.anchorageConfirmed).toBe(true);
        expect(confirmation?.supportConfirmed).toBe(true);
        expect(confirmation?.thresholdSatisfied).toBe(true);
        expect(confirmation?.basis.length).toBeGreaterThan(80);
      }

      const floodSources = equipment.filter((item) =>
        item.sscType === "FLOOD_SOURCE");
      const fireSources = equipment.filter((item) =>
        item.sscType === "FIRE_SOURCE");
      expect(floodSources.every((source) => findings.some((finding) =>
        finding.sscRef === source.uuid
        && finding.findingType === "FLOOD_SOURCE"))).toBe(true);
      expect(fireSources.every((source) => findings.some((finding) =>
        finding.sscRef === source.uuid
        && finding.findingType === "FIRE_SOURCE"))).toBe(true);
      expect(findings.some((finding) =>
        finding.findingType === "FALLING_HAZARD")).toBe(true);
      expect(findings.some((finding) =>
        finding.findingType === "CLEARANCE")).toBe(true);
      expect(findings.some((finding) =>
        finding.findingType === "INTERNAL_ASSEMBLY")).toBe(true);
      expect(findings.some((finding) =>
        finding.uuid === "FINDING-1"
        && finding.potentiallyRiskSignificant)).toBe(true);
      expect(() => SeismicPRASchema.parse(mef)).not.toThrow();
    },
  );

  it.each(["htgr", "sfr"] as const)(
    "reports HLR-SFR-C and HLR-SFR-D ready for %s",
    (variant) => {
      const statuses = Object.fromEntries(
        seismicConformanceItems(createSeismicPraExample(variant))
          .filter((item) =>
            item.id.startsWith("SFR-C")
            || item.id.startsWith("SFR-D"))
          .map((item) => [item.id, item.status]),
      );

      expect(statuses).toEqual({
        "SFR-C1": "ok",
        "SFR-C2": "ok",
        "SFR-D1": "ok",
        "SFR-D2": "ok",
        "SFR-D3": "na",
        "SFR-D4": "ok",
        "SFR-D5": "ok",
        "SFR-D6": "ok",
        "SFR-D7": "ok",
        "SFR-D8": "ok",
      });
    },
  );
});
