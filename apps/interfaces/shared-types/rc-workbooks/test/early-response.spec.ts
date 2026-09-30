import type { RcEarlyResponseModel } from "interfaces-mef-types/rc/early-response";
import type { RcSiteReceptors } from "interfaces-mef-types/rc/site-receptors";
import { RcEarlyResponseModelSchema } from "interfaces-mef-types/zod/rc/early-response";
import { earlyResponseIssues } from "../early-response";
import { calculateEarlyResponse } from "../early-response-calculation";
import { responseIssues } from "../protective-response";
import { caseChecks, caseVersions } from "../case-records";
import type { RcCaseData } from "interfaces-mef-types/rc/case-records";

const site: RcSiteReceptors = { revision: 1, settings: { latitude: 35, longitude: -93, receptorHeightMetres: 1.5, cellPoint: "mid" },
  geometry: { kind: "cells", radiiKm: [1, 2], sectors: 2, abridged: false, populationByCell: [10, 20, 30, 40] } };
const exposure = { cloudshineFactor: 0.8, inhalationFactor: 0.7, skinFactor: 0.9, groundshineFactor: 0.6, breathingRateCubicMetresPerSecond: 0.000266 };
function example(): RcEarlyResponseModel {
  return { revision: 1, earlyPhaseDurationSeconds: 86400, fineGridAzimuthSubdivisions: 3, population: { source: "SITE_FILE", weighting: "PEOPLE" }, movement: { model: "RADIAL" }, iodineProtection: "OFF",
    cohorts: [
      { id: "A", name: "Evacuees", resultWeightFraction: 0.6, criticalOrgan: "Effective",
        evacuation: { shape: "CIRCULAR", shelterAndEvacuationOuterBand: 2, movementOuterBand: 2, referencePoint: "ALARM", notificationAfterAccidentSeconds: 1800,
          shelterDelaySecondsByBand: [600, 900], evacuationDelaySecondsByBand: [3600, 4200], travelPoint: "CENTERPOINT", firstPhaseDurationSeconds: 600,
          middlePhaseDurationSeconds: 0, phaseSpeedsMetresPerSecond: [1, 1, 1], precipitationMultipliers: [0.7, 0.7, 0.7] },
        exposure: { normal: { ...exposure }, sheltering: { ...exposure }, evacuation: { ...exposure }, projected: { ...exposure } } },
      { id: "B", name: "Non-evacuees", resultWeightFraction: 0.4, criticalOrgan: "Effective", evacuation: { shape: "NONE" }, exposure: { normal: { ...exposure }, projected: { ...exposure } } },
    ],
    relocation: { projectionMode: "TOTAL", projectionPeriodSeconds: 3600, normal: { actionDelaySeconds: 7200, thresholdSv: 0.02 },
      hotSpot: { actionDelaySeconds: 3600, thresholdSv: 0.05 } },
  };
}

describe("MACCS-style Step 02 model and checks", () => {
  it("accepts a complete cohort model and includes it in the case version", () => {
    const model = example();
    expect(RcEarlyResponseModelSchema.safeParse(model).success).toBe(true);
    expect(earlyResponseIssues(model, site)).toEqual([]);
    const c: RcCaseData = { schemaVersion: 1, categoryId: "RC-1", site, response: { protectiveActionsIncluded: [], cohortModeling: { approach: "SINGLE_COHORT" }, earlyResponseModel: model } };
    expect(caseChecks(c).find(check => check.key === "site")!.items).toEqual([]);
    const version = caseVersions(c);
    model.cohorts[0].evacuation.shelterDelaySecondsByBand![0] = 900;
    expect(caseVersions(c)).not.toBe(version);
  });

  it("keeps PEOPLE and TIME weights distinct from SUMPOP cell allocations", () => {
    const model = example();
    model.cohorts[1].resultWeightFraction = 0.3;
    expect(earlyResponseIssues(model, site).join(" ")).toContain("weights must total 1");
    model.cohorts[1].resultWeightFraction = 0.4;
    model.population.weighting = "TIME";
    expect(earlyResponseIssues(model, site)).toEqual([]);
    model.population.weighting = "SUMPOP";
    model.population.sumpop = { allocation: "COHORT_ARRAYS" };
    model.cohorts[0].populationByCell = [6, 12, 18, 24];
    model.cohorts[1].populationByCell = [4, 8, 12, 16];
    expect(earlyResponseIssues(model, site)).toEqual([]);
    model.cohorts[1].populationByCell![0] = 5;
    expect(earlyResponseIssues(model, site).join(" ")).toContain("sum to the site population");
    model.cohorts[1].populationByCell![0] = 4;
    model.population.sumpop = { allocation: "SPATIAL_DISTRIBUTIONS", distributions: [{ id: "D1", symbol: "A", label: "All cells", fractions: [
      { cohortId: "A", fraction: 0.6 }, { cohortId: "B", fraction: 0.4 },
    ] }], distributionIdByCell: ["D1", "D1", "D1", "D1"] };
    expect(earlyResponseIssues(model, site)).toEqual([]);
    model.population.sumpop.distributions![0].fractions[0].fraction = 0.5;
    expect(earlyResponseIssues(model, site).join(" ")).toContain("fractions totaling 1");
  });

  it("checks band delays, movement routes, protection and relocation ordering", () => {
    const model = example(), evacuation = model.cohorts[0].evacuation;
    evacuation.shelterDelaySecondsByBand = [600];
    evacuation.travelPoint = "BOUNDARY";
    evacuation.phaseSpeedsMetresPerSecond = [1, 2, 1];
    model.movement.model = "NETWORK";
    model.iodineProtection = "ON";
    model.relocation!.hotSpot.actionDelaySeconds = 8000;
    const issues = earlyResponseIssues(model, site).join(" ");
    for (const expected of ["every band", "equal phase speeds", "network direction", "iodine", "relocation times"]) expect(issues).toContain(expected);
  });

  it("checks keyhole settings and preserves the legacy response path when the new model is absent", () => {
    const model = example(), evacuation = model.cohorts[0].evacuation;
    evacuation.shape = "KEYHOLE";
    evacuation.keyhole = { innerCircularBand: 3, sectorCount: 2 };
    evacuation.referencePoint = "ARRIVAL";
    expect(earlyResponseIssues(model, site).join(" ")).toContain("keyhole radius");
    expect(responseIssues({ protectiveActionsIncluded: [{ action: "SHELTERING", included: true, applicabilityJustification: "Study" }],
      cohortModeling: { approach: "SINGLE_COHORT", cohorts: [{ name: "Residents", description: "", populationPercent: 100, compliancePercent: 100 }] },
      responseTiming: { declarationAfterAccidentMinutes: 5, shelterStartMinutes: 10 } }, site)).toEqual([]);
  });

  it("requires source-compatible population settings and rejects invalid physical values", () => {
    const model = example();
    model.population.source = "UNIFORM";
    expect(earlyResponseIssues(model, site).join(" ")).toContain("uniform population needs");
    model.population.uniform = { firstPopulatedBand: 1, densityPeoplePerSquareKm: 100, landFraction: 0.8 };
    expect(earlyResponseIssues(model, site)).toEqual([]);
    model.population.weighting = "SUMPOP";
    expect(earlyResponseIssues(model, site).join(" ")).toContain("SUMPOP requires site-file");
    model.population.weighting = "PEOPLE";
    model.cohorts[0].exposure!.normal!.cloudshineFactor = 1.2;
    expect(earlyResponseIssues(model, site).join(" ")).toContain("cloudshineFactor");
  });
});

describe("Step 02 response calculation for Step 05", () => {
  const rates = [0, 1].map(cellIndex => ({ cellIndex, startSeconds: 0, endSeconds: 10000, organ: "Effective",
    cloudshineSvPerSecond: cellIndex ? 2e-6 : 1e-6, inhalationSvPerSecond: 0,
    groundshineSvPerSecond: 0, skinSvPerSecond: 0 }));
  const scenario = { originCellIndex: 0, targetOrgan: "Effective", plumeArrivalSecondsByCell: [1000, 1000, 1000, 1000],
    rainingByCell: [false, false, false, false], projectedDoseSvByCohort: { B: 0.03 }, doseRates: rates,
    referenceBreathingRateCubicMetresPerSecond: 0.000266, integrationSeconds: 10000 };

  it("uses response delays, population weights, radial movement and relocation when integrating organ dose", () => {
    const result = calculateEarlyResponse(example(), site, scenario);
    expect(result.issues).toEqual([]);
    const evac = result.cohorts[0], stays = result.cohorts[1];
    expect(evac.population).toBe(6);
    expect(evac.shelterStartsSeconds).toBe(2400);
    expect(evac.evacuationStartsSeconds).toBe(6000);
    expect(evac.intervals.map(interval => [interval.activity, interval.cellIndex, interval.startSeconds, interval.endSeconds])).toEqual([
      ["normal", 0, 0, 2400], ["sheltering", 0, 2400, 6000], ["evacuation", 0, 6000, 7000], ["evacuation", 1, 7000, 7500],
    ]);
    expect(evac.doseSv?.cloudshine).toBeCloseTo(0.0064);
    expect(stays.population).toBe(4);
    expect(stays.relocationSeconds).toBe(8200);
    expect(stays.doseSv?.cloudshine).toBeCloseTo(0.00656);
  });

  it("does not report a dose when an occupied cell has no dose-rate coverage", () => {
    const result = calculateEarlyResponse(example(), site, { ...scenario, doseRates: rates.slice(0, 1) });
    expect(result.issues.join(" ")).toContain("do not cover every occupied cell");
    expect(result.cohorts.every(cohort => cohort.doseSv === null)).toBe(true);
  });

  it("requires plume arrival before calculating an arrival-referenced action", () => {
    const model = example();
    model.cohorts[0].evacuation.referencePoint = "ARRIVAL";
    const result = calculateEarlyResponse(model, site, { originCellIndex: 0 });
    expect(result.issues.join(" ")).toContain("plume arrival is needed");
    expect(result.cohorts[0].shelterStartsSeconds).toBeNull();
  });

  it("applies iodine protection only to the iodine part of inhalation for affected organs", () => {
    const model = example();
    model.iodineProtection = "ON";
    for (const cohort of model.cohorts) cohort.iodine = { fractionOfCohort: 0.5, efficacy: 0.8,
      effectiveOrgan: "Thyroid", affectedOrgans: ["Thyroid"] };
    const result = calculateEarlyResponse(model, site, { ...scenario, targetOrgan: "Thyroid",
      doseRates: [0, 1].map(cellIndex => ({ cellIndex, startSeconds: 0, endSeconds: 10000, organ: "Thyroid",
        cloudshineSvPerSecond: 0, inhalationSvPerSecond: 2e-6, iodineInhalationSvPerSecond: 1e-6,
        groundshineSvPerSecond: 0, skinSvPerSecond: 0 })) });
    expect(result.issues).toEqual([]);
    expect(result.cohorts[1].doseSv?.inhalation).toBeCloseTo(8200 * 1.6e-6 * 0.7);
  });

  it("uses precipitation to change evacuation travel time", () => {
    const result = calculateEarlyResponse(example(), site, { ...scenario, rainingByCell: [true, true, false, false] });
    expect(result.issues).toEqual([]);
    expect(result.cohorts[0].intervals.at(-1)?.endSeconds).toBeCloseTo(6000 + 1500 / 0.7);
  });

  it("follows network directions through an outer-band cell before exiting", () => {
    const model = example();
    model.movement.model = "NETWORK";
    model.cohorts[0].evacuation.networkDirectionsByCell = [1, 2, 1, 1];
    model.cohorts[0].evacuation.phaseSpeedsMetresPerSecond = [10, 10, 10];
    const result = calculateEarlyResponse(model, site, { originCellIndex: 0,
      plumeArrivalSecondsByCell: [1000, 1000, 1000, 1000], rainingByCell: [false, false, false, false],
      projectedDoseSvByCohort: { B: 0 } });
    expect(result.issues).toEqual([]);
    expect(result.cohorts[0].intervals.filter(interval => interval.activity === "evacuation").map(interval => interval.cellIndex)).toEqual([0, 1, 3]);
  });

  it("does not mistake an exit at the last grid cell for a route loop", () => {
    const oneSectorSite: RcSiteReceptors = { ...site, geometry: { kind: "cells", radiiKm: [1, 2], sectors: 1,
      abridged: false, populationByCell: [10, 20] } };
    const result = calculateEarlyResponse(example(), oneSectorSite, { originCellIndex: 0,
      plumeArrivalSecondsByCell: [1000, 1000], rainingByCell: [false, false], projectedDoseSvByCohort: { B: 0 } });
    expect(result.issues).toEqual([]);
  });
});
