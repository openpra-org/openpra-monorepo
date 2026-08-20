import { InternalFloodAnalysisRecord, InternalFloodInvestigation, InternalFloodModelUncertainty, InternalFloodPreOperationalAssumption, InternalFloodProcessDocumentation, createInternalFloodSrCatalog } from "../internal-flood/internal-flood-pra-common";

export interface InternalFloodAnalysisBoundary extends InternalFloodAnalysisRecord {
  plantStructureRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  includedBuildings: string[];
  includedElevationRange: { lowerMetres: number; upperMetres: number; datum: string };
  internalExternalHazardInterface: string;
  multiUnitAndSharedSourceBasis: string;
  exclusions: { item: string; basis: string; hazardOwner: string }[];
}

export interface InternalFloodAreaBoundarySegment {
  uuid: string;
  segmentType: "WALL" | "FLOOR" | "CEILING" | "DOOR" | "PENETRATION" | "CURB" | "OPENING" | "OTHER";
  description: string;
  creditedAsFloodBarrier: boolean;
  barrierRef?: string;
  adjoiningFloodAreaRef?: string;
  sillOrThresholdElevationMetres?: number;
  normallyOpen: boolean;
  operatingStateDependencies: string[];
  evidenceRefs: string[];
}

export interface InternalFloodArea extends InternalFloodAnalysisRecord {
  areaId: string;
  building: string;
  rooms: string[];
  floorElevationMetres: number;
  ceilingElevationMetres: number;
  grossFloorAreaSquareMetres: number;
  netFreeVolumeCubicMetres: number;
  lowPointElevationMetres: number;
  boundarySegments: InternalFloodAreaBoundarySegment[];
  drainRefs: string[];
  sumpRefs: string[];
  floodSourceRefs: string[];
  creditedSscRefs: string[];
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  partitioningBasis: string;
  spatialInformationConfirmed: boolean;
  investigationRefs: string[];
}

export interface InternalFloodAreaCoverageCheck extends InternalFloodAnalysisRecord {
  includedLocationCount: number;
  assignedLocationCount: number;
  unassignedLocations: string[];
  overlappingAreaPairs: string[][];
  sourceFreeAreaRefs: string[];
  propagationOnlyAreaRefs: string[];
  complete: boolean;
  nonOverlapping: boolean;
  verificationMethod: string;
}

export interface InternalFloodPlantPartitioning {
  analysisBoundary: InternalFloodAnalysisBoundary;
  floodAreas: InternalFloodArea[];
  coverageChecks: InternalFloodAreaCoverageCheck[];
  investigations: InternalFloodInvestigation[];
  modelUncertainties: InternalFloodModelUncertainty[];
  preOperationalAssumptions: InternalFloodPreOperationalAssumption[];
  documentation: InternalFloodProcessDocumentation;
}

export const FLPP_SR_CATALOG = createInternalFloodSrCatalog(
  "FLPP",
  {
    A: [
      "Include every plant location where an internal flood can affect equipment represented in the PRA, including shared and multi-reactor or multi-source locations.",
    ],
    B: [
      "Partition the plant into flood areas using physical separation, credited barriers, hydraulic communication, and plant-operating-state changes.",
      "Resolve flood areas and shared locations that can affect more than one reactor or radioactive-material source.",
      "Use as-built, as-operated flood sources, spatial information, and design features for an operating plant.",
      "Use as-designed and intended flood sources, spatial information, and design features for a pre-operational PRA.",
      "Demonstrate that flood-area coverage is complete and nonoverlapping within the analysis boundary.",
      "Confirm spatial information, design features, and partitioning assumptions through appropriately scoped plant investigations.",
      "Identify partitioning model uncertainty, related assumptions, reasonable alternatives, and potential risk impact.",
      "Identify pre-operational assumptions caused by unavailable as-built and as-operated partitioning information.",
    ],
    C: [
      "Document the partitioning process, inputs, methods, results, analysis boundary, flood areas, exclusions, design features, investigations, and operating-state impacts.",
      "Document partitioning model uncertainty, related assumptions, and reasonable alternatives.",
      "Document pre-operational partitioning assumptions and limitations caused by unavailable as-built and as-operated information.",
    ],
  },
  {
    "FLPP-B3": ["OPERATIONAL"],
    "FLPP-B4": ["PRE_OPERATIONAL"],
    "FLPP-B8": ["PRE_OPERATIONAL"],
    "FLPP-C3": ["PRE_OPERATIONAL"],
  },
);
