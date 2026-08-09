import { z } from "zod";
import type { InternalFloodAnalysisBoundary, InternalFloodArea, InternalFloodAreaBoundarySegment, InternalFloodAreaCoverageCheck, InternalFloodPlantPartitioning } from "../../flpp/internal-flood-plant-partitioning";
import { InternalFloodAnalysisRecordSchema, InternalFloodInvestigationSchema, InternalFloodModelUncertaintySchema, InternalFloodPreOperationalAssumptionSchema, InternalFloodProcessDocumentationSchema } from "../internal-flood/internal-flood-pra-common";

export const InternalFloodAnalysisBoundarySchema = InternalFloodAnalysisRecordSchema.extend({
  plantStructureRefs: z.array(z.string()),
  reactorUnitRefs: z.array(z.string()),
  radioactiveMaterialSourceRefs: z.array(z.string()),
  includedBuildings: z.array(z.string()),
  includedElevationRange: z.object({ lowerMetres: z.number(), upperMetres: z.number(), datum: z.string() }),
  internalExternalHazardInterface: z.string(),
  multiUnitAndSharedSourceBasis: z.string(),
  exclusions: z.array(z.object({ item: z.string(), basis: z.string(), hazardOwner: z.string() })),
});

export const InternalFloodAreaBoundarySegmentSchema = z.object({
  uuid: z.string(),
  segmentType: z.enum(["WALL", "FLOOR", "CEILING", "DOOR", "PENETRATION", "CURB", "OPENING", "OTHER"]),
  description: z.string(),
  creditedAsFloodBarrier: z.boolean(),
  barrierRef: z.string().optional(),
  adjoiningFloodAreaRef: z.string().optional(),
  sillOrThresholdElevationMetres: z.number().optional(),
  normallyOpen: z.boolean(),
  operatingStateDependencies: z.array(z.string()),
  evidenceRefs: z.array(z.string()),
});

export const InternalFloodAreaSchema = InternalFloodAnalysisRecordSchema.extend({
  areaId: z.string(),
  building: z.string(),
  rooms: z.array(z.string()),
  floorElevationMetres: z.number(),
  ceilingElevationMetres: z.number(),
  grossFloorAreaSquareMetres: z.number(),
  netFreeVolumeCubicMetres: z.number(),
  lowPointElevationMetres: z.number(),
  boundarySegments: z.array(InternalFloodAreaBoundarySegmentSchema),
  drainRefs: z.array(z.string()),
  sumpRefs: z.array(z.string()),
  floodSourceRefs: z.array(z.string()),
  creditedSscRefs: z.array(z.string()),
  plantOperatingStateRefs: z.array(z.string()),
  reactorUnitRefs: z.array(z.string()),
  radioactiveMaterialSourceRefs: z.array(z.string()),
  partitioningBasis: z.string(),
  spatialInformationConfirmed: z.boolean(),
  investigationRefs: z.array(z.string()),
});

export const InternalFloodAreaCoverageCheckSchema = InternalFloodAnalysisRecordSchema.extend({
  includedLocationCount: z.number(),
  assignedLocationCount: z.number(),
  unassignedLocations: z.array(z.string()),
  overlappingAreaPairs: z.array(z.array(z.string())),
  sourceFreeAreaRefs: z.array(z.string()),
  propagationOnlyAreaRefs: z.array(z.string()),
  complete: z.boolean(),
  nonOverlapping: z.boolean(),
  verificationMethod: z.string(),
});

export const InternalFloodPlantPartitioningSchema = z.object({
  analysisBoundary: InternalFloodAnalysisBoundarySchema,
  floodAreas: z.array(InternalFloodAreaSchema),
  coverageChecks: z.array(InternalFloodAreaCoverageCheckSchema),
  investigations: z.array(InternalFloodInvestigationSchema),
  modelUncertainties: z.array(InternalFloodModelUncertaintySchema),
  preOperationalAssumptions: z.array(InternalFloodPreOperationalAssumptionSchema),
  documentation: InternalFloodProcessDocumentationSchema,
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _Boundary = Expect<Equal<z.infer<typeof InternalFloodAnalysisBoundarySchema>, InternalFloodAnalysisBoundary>>;
type _Segment = Expect<Equal<z.infer<typeof InternalFloodAreaBoundarySegmentSchema>, InternalFloodAreaBoundarySegment>>;
type _Area = Expect<Equal<z.infer<typeof InternalFloodAreaSchema>, InternalFloodArea>>;
type _Coverage = Expect<Equal<z.infer<typeof InternalFloodAreaCoverageCheckSchema>, InternalFloodAreaCoverageCheck>>;
type _Aggregate = Expect<Equal<z.infer<typeof InternalFloodPlantPartitioningSchema>, InternalFloodPlantPartitioning>>;
