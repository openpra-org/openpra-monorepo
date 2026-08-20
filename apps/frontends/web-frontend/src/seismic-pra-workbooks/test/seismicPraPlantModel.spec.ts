import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { SeismicPRASchema } from "interfaces-mef-types/zod/seismic/seismic-pra";
import { seismicConformanceItems } from "../seismicPraConformance";

describe("Seismic PRA Step 11 initiating events", () => {
  it.each(["htgr", "sfr"] as const)(
    "covers direct, secondary, operating-state, source, and experience inputs for %s",
    (variant) => {
      const mef = createSeismicPraExample(variant);
      const identification =
        mef.seismicPlantResponseAnalysis.initiatingEventIdentification;
      const all = [
        ...identification.directInitiators,
        ...identification.secondaryHazardInitiators,
      ];
      const coveredStates = new Set(
        all.flatMap((initiator) => initiator.plantOperatingStateRefs),
      );
      const hazardRefs = new Set(
        identification.secondaryHazardInitiators
          .map((initiator) => initiator.secondaryHazardRef),
      );

      expect(identification.directInitiators).toHaveLength(4);
      expect(identification.secondaryHazardInitiators).toHaveLength(6);
      expect(coveredStates).toEqual(new Set(["POS-POWER", "POS-SHUTDOWN"]));
      expect(identification.industryExperienceSources.length)
        .toBeGreaterThanOrEqual(6);
      expect(hazardRefs).toContain("SECONDARY-LIQUEFACTION");
      expect(Array.from(hazardRefs).some((reference) =>
        reference?.startsWith("INTERNAL-FLOOD"))).toBe(true);
      expect(Array.from(hazardRefs).some((reference) =>
        reference?.startsWith("INTERNAL-FIRE"))).toBe(true);
      expect(hazardRefs).toContain("SECONDARY-EXTERNAL-FLOODING");

      for (const initiator of all) {
        expect(initiator.description.length).toBeGreaterThan(60);
        expect(initiator.plantOperatingStateRefs.length).toBeGreaterThan(0);
        expect(initiator.reactorUnitRefs.length).toBeGreaterThan(0);
        expect(initiator.radioactiveMaterialSourceRefs.length).toBeGreaterThan(0);
        expect(initiator.industryExperienceRefs.length).toBeGreaterThanOrEqual(3);
        if (initiator.retained) {
          expect(initiator.riskSignificant).toBe(true);
          expect(initiator.eventSequenceRefs.length).toBeGreaterThan(0);
          expect(identification.retainedInitiatingEventRefs)
            .toContain(initiator.uuid);
        } else {
          expect(initiator.screeningOrSubsumingBasis?.length)
            .toBeGreaterThan(80);
        }
      }
    },
  );

  it("uses reactor-specific initiators and multi-unit scope", () => {
    const htgr = createSeismicPraExample("htgr")
      .seismicPlantResponseAnalysis;
    const sfr = createSeismicPraExample("sfr")
      .seismicPlantResponseAnalysis;

    expect(htgr.initiatingEventIdentification.directInitiators.some(
      (initiator) => initiator.name.includes("module"),
    )).toBe(true);
    expect(sfr.initiatingEventIdentification.directInitiators.some(
      (initiator) => initiator.name.includes("sodium"),
    )).toBe(true);
    expect(htgr.plantResponseModel.multiReactorModels[0]?.applicable).toBe(true);
    expect(htgr.plantResponseModel.multiReactorModels[0]?.reactorUnitRefs)
      .toHaveLength(4);
    expect(sfr.plantResponseModel.multiReactorModels[0]?.applicable).toBe(false);
    expect(sfr.plantResponseModel.multiReactorModels[0]?.exclusionBasis)
      .toContain("one reactor unit");
  });
});

describe("Seismic PRA Step 11 plant-response model", () => {
  it.each(["htgr", "sfr"] as const)(
    "provides a complete, technically linked MVP plant model for %s",
    (variant) => {
      const mef = createSeismicPraExample(variant);
      const model = mef.seismicPlantResponseAnalysis.plantResponseModel;
      const equipment =
        mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment
          .equipment;
      const equipmentRefs = new Set(equipment.map((item) => item.uuid));
      const fragilityRefs = new Set(
        mef.seismicFragilityAnalysis.results.fragilityEvaluations
          .map((item) => item.uuid),
      );
      const correlationRefs = new Set(
        mef.seismicFragilityAnalysis.results.correlationGroups
          .map((item) => item.uuid),
      );
      const requirementGroups = new Set(
        model.newSeismicLogic.flatMap((logic) =>
          logic.requirementCompliance.map((item) => item.requirementGroup)),
      );

      expect(model.baseInternalEventsModelRefs.length).toBeGreaterThanOrEqual(6);
      expect(model.baseNonSeismicHazardModelRefs).toHaveLength(2);
      expect(model.peerReviewFindingResolutions).toHaveLength(5);
      expect(model.inducedFailures).toHaveLength(2);
      expect(model.fragilityThresholds).toHaveLength(4);
      expect(model.contactChatterModels).toHaveLength(1);
      expect(model.missionTimeAssessments).toHaveLength(6);
      expect(model.newSeismicLogic).toHaveLength(5);
      expect(model.retainedHazardModels).toHaveLength(2);
      expect(model.multiReactorModels).toHaveLength(1);
      expect(model.modificationsFromBaseModel.length).toBeGreaterThanOrEqual(10);
      expect(model.completenessAndConsistencyReview.length)
        .toBeGreaterThan(250);

      for (const finding of model.peerReviewFindingResolutions) {
        expect(finding.resolutionStatus).toBe("RESOLVED");
        expect(finding.potentialAmplificationInSeismicModel.length)
          .toBeGreaterThan(80);
        expect(finding.resolution.length).toBeGreaterThan(80);
        expect(finding.incorporatedModelRefs.length).toBeGreaterThan(0);
        expect(finding.evidenceRefs.length).toBeGreaterThan(0);
      }

      for (const failure of model.inducedFailures) {
        expect(equipmentRefs.has(failure.sscRef)).toBe(true);
        expect(fragilityRefs.has(failure.fragilityEvaluationRef)).toBe(true);
        expect(failure.correlationGroupRefs.every((reference) =>
          correlationRefs.has(reference))).toBe(true);
        expect(failure.systemsBasicEventRef.length).toBeGreaterThan(5);
        expect(failure.causalDependencyRefs.length).toBeGreaterThan(0);
        expect(failure.eventSequenceRefs.length).toBeGreaterThan(0);
        expect(failure.modelImplementation.length).toBeGreaterThan(100);
      }

      for (const threshold of model.fragilityThresholds) {
        expect(threshold.satisfiesCriterion).toBe(true);
        expect(threshold.integratedAnnualFrequency)
          .toBeLessThanOrEqual(threshold.criterionLimit);
        expect(threshold.cumulativeSscCount).toBeGreaterThan(0);
        expect(threshold.correlationAndGroupingBasis.length)
          .toBeGreaterThan(70);
        expect(threshold.finalModelConfirmation.length).toBeGreaterThan(100);
      }

      expect(requirementGroups).toEqual(new Set([
        "HLR-ES-A",
        "HLR-ES-B",
        "HLR-SC-A",
        "HLR-SC-B",
        "HLR-SY-A",
        "HLR-SY-B",
        "HLR-DA-A",
        "HLR-DA-B",
        "HLR-DA-C",
        "HLR-DA-D",
        "HLR-HR-D",
      ]));
      expect(model.newSeismicLogic.every((logic) =>
        logic.verificationAndValidation.length > 80)).toBe(true);
      expect(model.missionTimeAssessments.every((assessment) =>
        assessment.missionTimeValid
        && assessment.assumedMissionTimeHours > 0
        && assessment.sustainedAccessibilityImpact.length > 80
        && assessment.emergencyResponseCapabilityImpact.length > 80
        && assessment.seismicEnvironmentDuration.length > 80)).toBe(true);
      expect(model.retainedHazardModels[0]?.hazardAnalysisRef)
        .toBe("SECONDARY-LIQUEFACTION");
      expect(model.retainedHazardModels[0]?.requirementCompliance)
        .toHaveLength(2);
      expect(model.retainedHazardModels[1]).toMatchObject({
        hazardAnalysisRef: "SECONDARY-EXTERNAL-FLOODING",
        hazardType: "EXTERNAL_FLOOD",
        initiatingEventRefs: ["INITIATOR-EXTERNAL-FLOOD"],
      });
      expect(model.retainedHazardModels[1]?.requirementCompliance)
        .toHaveLength(7);
      expect(() => SeismicPRASchema.parse(mef)).not.toThrow();
    },
  );
});

describe("Seismic PRA Step 11 conformance", () => {
  it.each(["htgr", "sfr"] as const)(
    "reports the correct HLR-SPR-A/B readiness for %s",
    (variant) => {
      const statuses = Object.fromEntries(
        seismicConformanceItems(createSeismicPraExample(variant))
          .filter((item) =>
            item.id.startsWith("SPR-A") || item.id.startsWith("SPR-B"))
          .map((item) => [item.id, item.status]),
      );

      expect(statuses).toEqual({
        "SPR-A1": "ok",
        "SPR-A2": "ok",
        "SPR-A3": "ok",
        "SPR-A4": "ok",
        "SPR-B1": "ok",
        "SPR-B2": "ok",
        "SPR-B3": "ok",
        "SPR-B4": "ok",
        "SPR-B5": "ok",
        "SPR-B6": "ok",
        "SPR-B7": "ok",
        "SPR-B8": "ok",
        "SPR-B9": "na",
        "SPR-B10": "na",
        "SPR-B11": "ok",
        "SPR-B12": "ok",
        "SPR-B13": variant === "htgr" ? "ok" : "na",
      });
    },
  );

  it("detects missing initiator experience and model-control evidence", () => {
    const mef = createSeismicPraExample("htgr");
    mef.seismicPlantResponseAnalysis.initiatingEventIdentification
      .industryExperienceSources = [];
    mef.seismicPlantResponseAnalysis.plantResponseModel
      .peerReviewFindingResolutions = [];
    mef.seismicPlantResponseAnalysis.plantResponseModel
      .inducedFailures[0]!.correlationGroupRefs = [];
    mef.seismicPlantResponseAnalysis.plantResponseModel
      .fragilityThresholds[0]!.integratedAnnualFrequency = 2e-7;
    mef.seismicPlantResponseAnalysis.plantResponseModel
      .newSeismicLogic[0]!.requirementCompliance = [];

    const statuses = Object.fromEntries(
      seismicConformanceItems(mef).map((item) => [item.id, item.status]),
    );
    expect(statuses["SPR-A3"]).toBe("warn");
    expect(statuses["SPR-B2"]).toBe("warn");
    expect(statuses["SPR-B4"]).toBe("warn");
    expect(statuses["SPR-B5"]).toBe("warn");
    expect(statuses["SPR-B8"]).toBe("warn");
  });
});
