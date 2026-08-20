import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { SeismicPRASchema } from "interfaces-mef-types/zod/seismic/seismic-pra";
import { seismicConformanceItems } from "../seismicPraConformance";

describe("Seismic PRA Step 12 human reliability", () => {
  it.each(["htgr", "sfr"] as const)(
    "populates a realistic seismic HRA package for %s",
    (variant) => {
      const mef = createSeismicPraExample(variant);
      const hra = mef.seismicPlantResponseAnalysis.humanReliabilityModel;
      const model = mef.seismicPlantResponseAnalysis.plantResponseModel;
      const hfeRefs = new Set(hra.humanActions.map((action) =>
        action.humanFailureEventRef));
      const modeledSequences = new Set(model.eventSequenceRefs);
      const recoveryActions = hra.humanActions.filter((action) =>
        action.recoveryAction);

      expect(hra.humanActions).toHaveLength(10);
      expect(hra.relevantInternalEventsHfeRefs.length)
        .toBeGreaterThanOrEqual(7);
      expect(recoveryActions).toHaveLength(2);
      expect(hra.humanActions.some((action) =>
        action.controlRoomOrExControlRoom === "CONTROL_ROOM"
        || action.controlRoomOrExControlRoom === "BOTH")).toBe(true);
      expect(hra.humanActions.some((action) =>
        action.controlRoomOrExControlRoom === "EX_CONTROL_ROOM"
        || action.controlRoomOrExControlRoom === "BOTH")).toBe(true);

      for (const action of hra.humanActions) {
        expect(action.sourceInternalEventsHfeRef).toBeDefined();
        expect(hra.relevantInternalEventsHfeRefs)
          .toContain(action.sourceInternalEventsHfeRef);
        expect(action.eventSequenceRefs.length).toBeGreaterThan(0);
        expect(action.eventSequenceRefs.every((reference) =>
          modeledSequences.has(reference))).toBe(true);
        expect(action.availableTime).toBeGreaterThan(action.requiredTime);
        expect(action.requiredTime).toBeGreaterThan(0);
        expect(action.humanErrorProbability).toBeGreaterThan(0);
        expect(action.humanErrorProbability).toBeLessThan(0.2);
        expect(action.probabilityDistribution?.type).toBe("lognormal");
        expect(action.dependencyRefs.every((reference) =>
          hfeRefs.has(reference))).toBe(true);
        expect(action.feasibilityBasis.length).toBeGreaterThan(90);
        expect(action.seismicSpecificChallenges.trainingAndProcedures.length)
          .toBeGreaterThan(80);
        expect(action.seismicSpecificChallenges.workloadAndStress.length)
          .toBeGreaterThan(70);
        expect(action.seismicSpecificChallenges.mitigationImpact.length)
          .toBeGreaterThan(70);
        expect(action.seismicSpecificChallenges.timingAndAccessibility.length)
          .toBeGreaterThan(55);
        expect(action.seismicSpecificChallenges.physicalHazards.length)
          .toBeGreaterThan(55);
        expect(action.seismicSpecificChallenges.jobAidsAndTraining.length)
          .toBeGreaterThan(55);
        expect(action.implementsSrs.map((reference) => reference.sr))
          .toContain("SPR-D5");
        if (action.recoveryAction) {
          expect(action.dependencyRefs.length).toBeGreaterThan(0);
          expect(action.implementsSrs.map((reference) => reference.sr))
            .toContain("SPR-D4");
        }
      }

      expect(model.humanErrorRefs).toEqual(
        hra.humanActions.map((action) => action.humanFailureEventRef),
      );
      expect(model.newSeismicLogic.find((logic) =>
        logic.logicType === "HUMAN_ACTION")?.modelRefs)
        .toEqual(model.humanErrorRefs);
      expect(hra.responseActionRequirementCompliance.length)
        .toBeGreaterThan(150);
      expect(hra.hfeDefinitionRequirementCompliance.length)
        .toBeGreaterThan(150);
      expect(hra.recoveryRequirementCompliance.length)
        .toBeGreaterThan(150);
      expect(hra.quantificationRequirementCompliance.length)
        .toBeGreaterThan(180);
      expect(hra.seismicInfluenceIntegration.length)
        .toBeGreaterThan(150);
      expect(() => SeismicPRASchema.parse(mef)).not.toThrow();
    },
  );

  it("uses reactor-specific actions", () => {
    const htgr = createSeismicPraExample("htgr")
      .seismicPlantResponseAnalysis.humanReliabilityModel;
    const sfr = createSeismicPraExample("sfr")
      .seismicPlantResponseAnalysis.humanReliabilityModel;

    expect(htgr.humanActions.some((action) =>
      action.name.includes("module"))).toBe(true);
    expect(htgr.humanActions.some((action) =>
      action.name.includes("RCCS"))).toBe(true);
    expect(sfr.humanActions.some((action) =>
      action.name.includes("sodium"))).toBe(true);
    expect(sfr.humanActions.some((action) =>
      action.name.includes("scram"))).toBe(true);
  });
});

describe("Seismic PRA Step 12 conformance", () => {
  it.each(["htgr", "sfr"] as const)(
    "reports complete HLR-SPR-D coverage for %s",
    (variant) => {
      const statuses = Object.fromEntries(
        seismicConformanceItems(createSeismicPraExample(variant))
          .filter((item) => item.id.startsWith("SPR-D"))
          .map((item) => [item.id, item.status]),
      );

      expect(statuses).toEqual({
        "SPR-D1": "ok",
        "SPR-D2": "ok",
        "SPR-D3": "ok",
        "SPR-D4": "ok",
        "SPR-D5": "ok",
      });
    },
  );

  it("detects missing identification, feasibility, and HEP evidence", () => {
    const mef = createSeismicPraExample("htgr");
    const hra = mef.seismicPlantResponseAnalysis.humanReliabilityModel;
    hra.relevantInternalEventsHfeRefs = [];
    hra.humanActions[0]!.seismicSpecificChallenges.physicalHazards = "";
    hra.humanActions[1]!.requiredTime =
      hra.humanActions[1]!.availableTime + 1;
    hra.humanActions[2]!.probabilityDistribution = undefined;

    const statuses = Object.fromEntries(
      seismicConformanceItems(mef)
        .filter((item) => item.id.startsWith("SPR-D"))
        .map((item) => [item.id, item.status]),
    );
    expect(statuses["SPR-D1"]).toBe("warn");
    expect(statuses["SPR-D2"]).toBe("warn");
    expect(statuses["SPR-D3"]).toBe("warn");
    expect(statuses["SPR-D5"]).toBe("warn");
  });

  it("marks recovery treatment not applicable when no recovery is credited", () => {
    const mef = createSeismicPraExample("sfr");
    mef.seismicPlantResponseAnalysis.humanReliabilityModel.humanActions =
      mef.seismicPlantResponseAnalysis.humanReliabilityModel.humanActions
        .filter((action) => !action.recoveryAction);

    expect(seismicConformanceItems(mef).find((item) =>
      item.id === "SPR-D4")?.status).toBe("na");
  });
});
