import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { SeismicPRASchema } from "interfaces-mef-types/zod/seismic/seismic-pra";
import { seismicConformanceItems } from "../seismicPraConformance";

describe("Seismic PRA Step 13 quantification", () => {
  it.each(["htgr", "sfr"] as const)(
    "populates a realistic, linked %s quantification package",
    (variant) => {
      const mef = createSeismicPraExample(variant);
      const spr = mef.seismicPlantResponseAnalysis;
      const quant = spr.quantification;
      const discretization = quant.hazardDiscretizations[0]!;
      const familyIds = quant.eventSequenceFamilyQuantifications.map(
        (family) => family.uuid,
      );

      expect(quant.hazardDiscretizations).toHaveLength(1);
      expect(discretization.bins).toHaveLength(8);
      expect(discretization.convergenceStudies).toHaveLength(4);
      expect(discretization.converged).toBe(true);
      expect(discretization.convergenceStudies.at(-1)?.relativeChange)
        .toBeLessThanOrEqual(discretization.convergenceTolerance);
      expect(quant.rareEventApproximationAssessments).toHaveLength(3);
      expect(quant.esqRequirementCompliance).toHaveLength(35);
      expect(quant.eventSequenceFamilyQuantifications).toHaveLength(6);
      expect(quant.modelUncertainties).toHaveLength(8);
      expect(quant.sensitivityStudies).toHaveLength(8);
      expect(quant.riskSignificantContributors).toHaveLength(12);
      expect(quant.outputQualityChecks).toHaveLength(12);
      expect(spr.preOperationalAssumptions).toHaveLength(5);
      expect(spr.documentation.traceability).toHaveLength(6);
      expect(mef.integration.eventSequenceFamilyQuantificationRefs)
        .toEqual(familyIds);

      for (const family of quant.eventSequenceFamilyQuantifications) {
        const reported = family.meanFrequency
          ?? family.pointEstimateFrequency;
        const contributionTotal = family.hazardBinContributions.reduce(
          (sum, contribution) => sum + contribution.frequencyContribution,
          0,
        );
        expect(family.frequencyUnit).toBe("PER_PLANT_YEAR");
        expect(family.meanHazardUsed).toBe(true);
        expect(family.meanFragilitiesUsed).toBe(true);
        expect(family.frequencyDistribution?.type).toBe("lognormal");
        expect(family.frequencyDistribution).toMatchObject({
          median: expect.any(Number),
          errorFactor: expect.any(Number),
        });
        expect(family.hazardBinContributions).toHaveLength(8);
        expect(contributionTotal).toBeCloseTo(reported, 10);
        expect(new Set(family.uncertaintyContributions.map((source) =>
          source.sourceType))).toEqual(
          new Set(["HAZARD", "FRAGILITY", "SYSTEMS"]),
        );
        expect(family.initiatingEventRefs.length).toBeGreaterThan(0);
        expect(family.eventSequenceRefs.length).toBeGreaterThan(0);
        expect(family.quantificationMethod.length).toBeGreaterThan(150);
        expect(family.truncationAndScreeningTreatment.length)
          .toBeGreaterThan(150);
      }

      expect(quant.rareEventApproximationAssessments.every((assessment) =>
        assessment.uncorrectedResult !== undefined
        && assessment.correctedResult !== undefined
        && assessment.uncorrectedResult >= assessment.correctedResult
        && assessment.correctionMethod.length > 100)).toBe(true);
      expect(quant.esqRequirementCompliance.every((record) =>
        record.satisfiedByRefs.length > 0
        && record.evidence.length > 100
        && (record.status === "MET"
          || record.status === "NOT_APPLICABLE"))).toBe(true);
      expect(quant.modelUncertainties.every((uncertainty) =>
        uncertainty.reasonableAlternatives.length >= 3
        && uncertainty.relatedAssumptions.length > 0
        && uncertainty.sensitivityStudyRefs.length > 0)).toBe(true);
      expect(quant.sensitivityStudies.every((study) =>
        study.results !== undefined
        && study.results.length > 30
        && study.insights !== undefined
        && study.insights.length > 40)).toBe(true);
      expect(() => SeismicPRASchema.parse(mef)).not.toThrow();
    },
  );

  it("uses reactor-specific families and risk insights", () => {
    const htgr = createSeismicPraExample("htgr")
      .seismicPlantResponseAnalysis.quantification;
    const sfr = createSeismicPraExample("sfr")
      .seismicPlantResponseAnalysis.quantification;

    expect(htgr.eventSequenceFamilyQuantifications.some((family) =>
      family.name.includes("multi-module"))).toBe(true);
    expect(htgr.eventSequenceFamilyQuantifications.some((family) =>
      family.name.includes("module cooling"))).toBe(true);
    expect(sfr.eventSequenceFamilyQuantifications.some((family) =>
      family.name.includes("sodium-boundary"))).toBe(true);
    expect(sfr.eventSequenceFamilyQuantifications.some((family) =>
      family.name.includes("vessel cooling"))).toBe(true);
    expect(htgr.riskSignificantContributors.some((contributor) =>
      contributor.riskInsight.includes("multi-module"))).toBe(true);
    expect(sfr.riskSignificantContributors.some((contributor) =>
      contributor.riskInsight.includes("sodium"))).toBe(true);
  });
});

describe("Seismic PRA Step 13 conformance", () => {
  it.each(["htgr", "sfr"] as const)(
    "reports complete HLR-SPR-E coverage for %s",
    (variant) => {
      const statuses = Object.fromEntries(
        seismicConformanceItems(createSeismicPraExample(variant))
          .filter((item) => item.id.startsWith("SPR-E"))
          .map((item) => [item.id, item.status]),
      );

      expect(statuses).toEqual({
        "SPR-E1": "ok",
        "SPR-E2": "ok",
        "SPR-E3": "ok",
        "SPR-E4": "ok",
        "SPR-E5": "ok",
        "SPR-E6": "ok",
        "SPR-E7": "ok",
        "SPR-E8": "ok",
      });
    },
  );

  it.each([
    ["SPR-E1", (mef: ReturnType<typeof createSeismicPraExample>) => {
      mef.seismicPlantResponseAnalysis.quantification
        .eventSequenceFamilyQuantifications[0]!.hazardBinContributions = [];
    }],
    ["SPR-E2", (mef: ReturnType<typeof createSeismicPraExample>) => {
      mef.seismicPlantResponseAnalysis.quantification
        .rareEventApproximationAssessments = [];
    }],
    ["SPR-E3", (mef: ReturnType<typeof createSeismicPraExample>) => {
      mef.seismicPlantResponseAnalysis.quantification
        .hazardDiscretizations[0]!.converged = false;
    }],
    ["SPR-E4", (mef: ReturnType<typeof createSeismicPraExample>) => {
      mef.seismicPlantResponseAnalysis.quantification
        .esqRequirementCompliance.pop();
    }],
    ["SPR-E5", (mef: ReturnType<typeof createSeismicPraExample>) => {
      mef.seismicPlantResponseAnalysis.quantification
        .eventSequenceFamilyQuantifications[0]!.frequencyDistribution =
          undefined;
    }],
    ["SPR-E6", (mef: ReturnType<typeof createSeismicPraExample>) => {
      mef.seismicPlantResponseAnalysis.quantification
        .modelUncertainties[0]!.reasonableAlternatives = [];
    }],
    ["SPR-E7", (mef: ReturnType<typeof createSeismicPraExample>) => {
      mef.seismicPlantResponseAnalysis.preOperationalAssumptions = [];
    }],
    ["SPR-E8", (mef: ReturnType<typeof createSeismicPraExample>) => {
      mef.seismicPlantResponseAnalysis.quantification
        .sensitivityStudies[0]!.results = "";
    }],
  ] as const)(
    "detects missing %s evidence",
    (requirement, mutate) => {
      const mef = createSeismicPraExample("htgr");
      mutate(mef);

      expect(seismicConformanceItems(mef).find((item) =>
        item.id === requirement)?.status).toBe("warn");
    },
  );
});
