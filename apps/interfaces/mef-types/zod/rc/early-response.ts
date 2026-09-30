import { z } from "zod";
import type { RcEarlyResponseModel } from "../../rc/early-response";

const finite = z.number().finite(), nonnegative = finite.nonnegative(), positive = finite.positive();
const fraction = finite.min(0).max(1), count = z.number().int().positive();
const exposure = z.object({ cloudshineFactor: fraction.optional(), inhalationFactor: fraction.optional(), skinFactor: fraction.optional(),
  groundshineFactor: fraction.optional(), breathingRateCubicMetresPerSecond: positive.optional() });
const cohort = z.object({
  id: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(200), resultWeightFraction: fraction.optional(),
  populationByCell: z.array(z.number().int().nonnegative()).max(100000).optional(), criticalOrgan: z.string().trim().min(1).max(100).optional(),
  evacuation: z.object({
    shape: z.enum(["UNSET", "NONE", "CIRCULAR", "KEYHOLE"]), shelterAndEvacuationOuterBand: count.optional(), movementOuterBand: count.optional(),
    keyhole: z.object({ innerCircularBand: z.number().int().nonnegative().optional(), sectorCount: count.optional() }).optional(),
    referencePoint: z.enum(["ALARM", "ARRIVAL"]).optional(), notificationAfterAccidentSeconds: nonnegative.optional(),
    shelterDelaySecondsByBand: z.array(nonnegative).max(1000).optional(), evacuationDelaySecondsByBand: z.array(nonnegative).max(1000).optional(),
    travelPoint: z.enum(["BOUNDARY", "CENTERPOINT"]).optional(), firstPhaseDurationSeconds: nonnegative.optional(), middlePhaseDurationSeconds: nonnegative.optional(),
    phaseSpeedsMetresPerSecond: z.tuple([positive, positive, positive]).optional(), precipitationMultipliers: z.tuple([fraction, fraction, fraction]).optional(),
    cellSpeedMultipliers: z.array(positive).max(100000).optional(), networkDirectionsByCell: z.array(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.null()])).max(100000).optional(),
    returnAfterEvacuationSeconds: nonnegative.optional(),
  }),
  exposure: z.object({ normal: exposure.optional(), sheltering: exposure.optional(), evacuation: exposure.optional(), projected: exposure.optional() }).optional(),
  iodine: z.object({ fractionOfCohort: fraction, efficacy: fraction, effectiveOrgan: z.string().trim().min(1).max(100),
    affectedOrgans: z.array(z.string().trim().min(1).max(100)).min(1).max(3) }).optional(),
});

/** Structural validation only; grid, weighting and conditional checks live in earlyResponseIssues. */
export const RcEarlyResponseModelSchema: z.ZodType<RcEarlyResponseModel> = z.object({
  revision: count, sourceReference: z.string().max(1000).optional(), earlyPhaseDurationSeconds: positive.optional(),
  originalFile: z.object({ documentId: z.string(), filename: z.string(), size: nonnegative, uploadedAt: z.string(), sha256: z.string() }).optional(),
  unassignedRecords: z.array(z.object({ cohortId: z.string(), card: z.string(), value: z.string() })).max(10000).optional(),
  fineGridAzimuthSubdivisions: z.union([z.literal(3), z.literal(5), z.literal(7)]).optional(),
  population: z.object({
    source: z.enum(["UNSET", "SITE_FILE", "UNIFORM"]), weighting: z.enum(["UNSET", "PEOPLE", "TIME", "SUMPOP"]),
    uniform: z.object({ firstPopulatedBand: count, densityPeoplePerSquareKm: nonnegative, landFraction: fraction }).optional(),
    sumpop: z.object({ allocation: z.enum(["COHORT_ARRAYS", "SPATIAL_DISTRIBUTIONS"]),
      distributions: z.array(z.object({ id: z.string().trim().min(1).max(80), symbol: z.string().length(1), label: z.string().trim().min(1).max(100),
        fractions: z.array(z.object({ cohortId: z.string().trim().min(1).max(80), fraction })).max(100) })).max(90).optional(),
      distributionIdByCell: z.array(z.string().trim().min(1).max(80)).max(100000).optional() }).optional(),
  }),
  movement: z.object({ model: z.enum(["UNSET", "NONE", "RADIAL", "NETWORK"]), keyholeForecastSeconds: nonnegative.optional() }),
  iodineProtection: z.enum(["UNSET", "ON", "OFF"]), cohorts: z.array(cohort).max(100),
  relocation: z.object({ projectionMode: z.enum(["UNSET", "ORIGL", "TOTAL", "AVOIDABLE"]), projectionPeriodSeconds: positive.optional(),
    normal: z.object({ actionDelaySeconds: nonnegative.optional(), thresholdSv: nonnegative.optional() }),
    hotSpot: z.object({ actionDelaySeconds: nonnegative.optional(), thresholdSv: nonnegative.optional() }) }).optional(),
});
