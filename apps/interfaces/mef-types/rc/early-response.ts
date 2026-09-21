/** Prepared early-response inputs. Times are seconds; cell arrays are sector-major, then radial band. */
import type { RcSourceTerm } from "./source-term";

export interface RcEarlyResponseModel {
  revision: number;
  sourceReference?: string;
  originalFile?: NonNullable<RcSourceTerm["originalFile"]>;
  /** Cards retained for review when their interpretation needs more input. */
  unassignedRecords?: { cohortId: string; card: string; value: string }[];
  earlyPhaseDurationSeconds?: number;
  /** MACCS NUMFIN: azimuthal subdivisions used for early dose and nonlinear effects. */
  fineGridAzimuthSubdivisions?: 3 | 5 | 7;
  population: {
    source: "UNSET" | "SITE_FILE" | "UNIFORM";
    weighting: "UNSET" | "PEOPLE" | "TIME" | "SUMPOP";
    uniform?: { firstPopulatedBand: number; densityPeoplePerSquareKm: number; landFraction: number };
    sumpop?: {
      allocation: "COHORT_ARRAYS" | "SPATIAL_DISTRIBUTIONS";
      distributions?: { id: string; symbol: string; label: string; fractions: { cohortId: string; fraction: number }[] }[];
      distributionIdByCell?: string[];
    };
  };
  movement: { model: "UNSET" | "NONE" | "RADIAL" | "NETWORK"; keyholeForecastSeconds?: number };
  iodineProtection: "UNSET" | "ON" | "OFF";
  cohorts: RcEarlyResponseCohort[];
  relocation?: {
    projectionMode: "UNSET" | "ORIGL" | "TOTAL" | "AVOIDABLE";
    projectionPeriodSeconds?: number;
    /** TIMNRM/TIMHOT; the selected projection model governs their reference time. */
    normal: { actionDelaySeconds?: number; thresholdSv?: number };
    hotSpot: { actionDelaySeconds?: number; thresholdSv?: number };
  };
}

export interface RcEarlyResponseExposure {
  cloudshineFactor?: number;
  inhalationFactor?: number;
  skinFactor?: number;
  groundshineFactor?: number;
  breathingRateCubicMetresPerSecond?: number;
}

export interface RcEarlyResponseCohort {
  id: string;
  name: string;
  /** WTFRAC: people fraction under PEOPLE; scenario probability under TIME; unused under SUMPOP. */
  resultWeightFraction?: number;
  /** COHORT_POP: people in each cell under SUMPOP/COHORT_ARRAYS. */
  populationByCell?: number[];
  criticalOrgan?: string;
  evacuation: {
    shape: "UNSET" | "NONE" | "CIRCULAR" | "KEYHOLE";
    shelterAndEvacuationOuterBand?: number;
    movementOuterBand?: number;
    keyhole?: { innerCircularBand?: number; sectorCount?: number };
    referencePoint?: "ALARM" | "ARRIVAL";
    notificationAfterAccidentSeconds?: number;
    shelterDelaySecondsByBand?: number[];
    evacuationDelaySecondsByBand?: number[];
    travelPoint?: "BOUNDARY" | "CENTERPOINT";
    firstPhaseDurationSeconds?: number;
    middlePhaseDurationSeconds?: number;
    phaseSpeedsMetresPerSecond?: [number, number, number];
    precipitationMultipliers?: [number, number, number];
    /** ESPGRD_RAD / ESPGRD_NET, covering the full sector-major site grid. Omit for unity. */
    cellSpeedMultipliers?: number[];
    /** IDIREC: outward, clockwise, inward, counterclockwise. Null outside the movement zone. */
    networkDirectionsByCell?: (1 | 2 | 3 | 4 | null)[];
    returnAfterEvacuationSeconds?: number;
  };
  exposure?: {
    normal?: RcEarlyResponseExposure;
    sheltering?: RcEarlyResponseExposure;
    evacuation?: RcEarlyResponseExposure;
    projected?: RcEarlyResponseExposure;
  };
  iodine?: { fractionOfCohort: number; efficacy: number; effectiveOrgan: string; affectedOrgans: string[] };
}
