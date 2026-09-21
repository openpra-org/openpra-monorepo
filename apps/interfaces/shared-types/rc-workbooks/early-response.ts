import type { RcEarlyResponseModel, RcEarlyResponseExposure } from "interfaces-mef-types/rc/early-response";
import type { RcSiteReceptors } from "interfaces-mef-types/rc/site-receptors";
import { RcEarlyResponseModelSchema } from "interfaces-mef-types/zod/rc/early-response";

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const near = (a: number, b: number, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;
const exposureComplete = (item?: RcEarlyResponseExposure) =>
  Boolean(item && item.cloudshineFactor !== undefined && item.inhalationFactor !== undefined && item.skinFactor !== undefined &&
    item.groundshineFactor !== undefined && item.breathingRateCubicMetresPerSecond !== undefined);

/** Checks whether a prepared response model can be interpreted on the saved site grid. No response or dose is calculated here. */
export function earlyResponseIssues(input: RcEarlyResponseModel, site?: RcSiteReceptors): string[] {
  const parsed = RcEarlyResponseModelSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map(issue => `Step 02 ${issue.path.join(".") || "response model"}: ${issue.message}`);
  const model = parsed.data, issues: string[] = [], grid = site?.geometry;
  const cells = grid?.kind === "cells" ? grid.radiiKm.length * grid.sectors : undefined;
  const bands = grid?.kind === "cells" ? grid.radiiKm.length : undefined;
  const cohortIds = model.cohorts.map(cohort => cohort.id);
  if (grid?.kind !== "cells") issues.push("Step 02 response model requires a radial site grid.");
  if (!model.earlyPhaseDurationSeconds) issues.push("Step 02 response model needs an early-phase duration.");
  if (!model.fineGridAzimuthSubdivisions) issues.push("Step 02 response model needs fine-grid azimuthal subdivisions.");
  if (!model.cohorts.length) issues.push("Step 02 response model needs at least one cohort.");
  if (new Set(cohortIds).size !== cohortIds.length || new Set(model.cohorts.map(cohort => cohort.name)).size !== model.cohorts.length)
    issues.push("Step 02 cohort IDs and names must be unique.");

  const { population } = model;
  if (population.source === "UNSET") issues.push("Step 02 choose a population source.");
  if (population.weighting === "UNSET") issues.push("Step 02 choose how cohort results are weighted.");
  if (model.movement.model === "UNSET") issues.push("Step 02 choose a movement model.");
  if (model.iodineProtection === "UNSET") issues.push("Step 02 choose iodine-protection treatment.");
  const sitePopulation = grid?.kind === "cells" ? grid.populationByCell : undefined;
  if (model.cohorts.some(cohort => cohort.resultWeightFraction === undefined) ||
    !near(sum(model.cohorts.map(cohort => cohort.resultWeightFraction ?? 0)), 1, 0.001))
    issues.push(`Step 02 ${population.weighting} cohort weights must total 1; SUMPOP records them but uses cell populations instead.`);
  if (sitePopulation && cells !== undefined && sitePopulation.length !== cells) issues.push("Step 02 site population must cover every grid cell.");
  if (population.source === "UNIFORM") {
    if (!population.uniform) issues.push("Step 02 uniform population needs a starting band, density and land fraction.");
    else if ((bands !== undefined && population.uniform.firstPopulatedBand > bands) || population.uniform.landFraction <= 0)
      issues.push("Step 02 uniform population settings must fit the site grid and have a positive land fraction.");
  }
  if (population.weighting === "SUMPOP") {
    if (population.source !== "SITE_FILE") issues.push("Step 02 SUMPOP requires site-file population data.");
    if (!population.sumpop) issues.push("Step 02 SUMPOP needs cohort cell arrays or spatial distributions.");
    else if (population.sumpop.allocation === "COHORT_ARRAYS") {
      if (cells !== undefined && model.cohorts.some(cohort => cohort.populationByCell?.length !== cells))
        issues.push("Step 02 each SUMPOP cohort must supply population for every grid cell.");
      else if (cells !== undefined && sitePopulation?.length === cells && Array.from({ length: cells }, (_, i) => i)
        .some(i => sum(model.cohorts.map(cohort => cohort.populationByCell![i])) !== sitePopulation[i]))
        issues.push("Step 02 cohort populations must sum to the site population in every cell.");
    } else {
      const distributions = population.sumpop.distributions ?? [], assignments = population.sumpop.distributionIdByCell;
      if (!sitePopulation || sitePopulation.length !== cells) issues.push("Step 02 spatial distributions need a complete site population grid.");
      if (!distributions.length || new Set(distributions.map(distribution => distribution.id)).size !== distributions.length ||
        new Set(distributions.map(distribution => distribution.symbol)).size !== distributions.length)
        issues.push("Step 02 spatial distributions need unique IDs and symbols.");
      if (cells !== undefined && (assignments?.length !== cells || assignments.some(id => !distributions.some(distribution => distribution.id === id))))
        issues.push("Step 02 assign one known population distribution to every grid cell.");
      if (distributions.some(distribution => distribution.fractions.length !== cohortIds.length ||
        new Set(distribution.fractions.map(entry => entry.cohortId)).size !== cohortIds.length ||
        distribution.fractions.some(entry => !cohortIds.includes(entry.cohortId)) ||
        !near(sum(distribution.fractions.map(entry => entry.fraction)), 1)))
        issues.push("Step 02 each spatial distribution must assign fractions totaling 1 across all cohorts.");
    }
  } else {
    if (population.sumpop) issues.push("Step 02 spatial cohort allocations require SUMPOP weighting.");
    if (population.source === "SITE_FILE" && (!sitePopulation || sitePopulation.length !== cells))
      issues.push("Step 02 file-based population requires counts for every grid cell.");
  }

  const active = model.cohorts.filter(cohort => cohort.evacuation.shape === "CIRCULAR" || cohort.evacuation.shape === "KEYHOLE");
  if (model.movement.model !== "UNSET" && (model.movement.model === "NONE") !== (active.length === 0))
    issues.push("Step 02 movement model must agree with the cohort evacuation choices.");
  if (active.length && model.cohorts[0].evacuation.shape === "NONE")
    issues.push("Step 02 the first cohort must evacuate when another cohort does.");
  if (active.some(cohort => cohort.evacuation.shape === "KEYHOLE") && model.movement.keyholeForecastSeconds === undefined)
    issues.push("Step 02 keyhole evacuation needs a forecast time.");
  const firstZone = model.cohorts[0]?.evacuation;
  for (const cohort of model.cohorts) {
    const evacuation = cohort.evacuation, label = `Step 02 cohort ${cohort.name}`;
    if (evacuation.shape === "UNSET") { issues.push(`${label} needs an evacuation-zone choice.`); continue; }
    if (!exposureComplete(cohort.exposure?.normal)) issues.push(`${label} needs normal-activity exposure factors.`);
    if (model.relocation && (!cohort.criticalOrgan || !exposureComplete(cohort.exposure?.projected)))
      issues.push(`${label} needs a critical organ and projected-dose exposure factors for relocation.`);
    if (model.iodineProtection === "ON" && !cohort.iodine)
      issues.push(`${label} needs iodine uptake and efficacy settings.`);
    if (model.iodineProtection === "ON" && cohort.iodine && new Set(cohort.iodine.affectedOrgans).size !== cohort.iodine.affectedOrgans.length)
      issues.push(`${label} iodine-affected organs must be unique.`);
    if (evacuation.shape === "NONE") continue;
    const outer = evacuation.shelterAndEvacuationOuterBand, movementOuter = evacuation.movementOuterBand;
    if (outer === undefined || movementOuter === undefined || outer > movementOuter || (bands !== undefined && movementOuter > bands))
      issues.push(`${label} needs valid shelter/evacuation and movement outer bands.`);
    if (cohort !== model.cohorts[0] && firstZone?.shape !== "NONE" &&
      ((outer !== undefined && firstZone?.shelterAndEvacuationOuterBand !== undefined && outer > firstZone.shelterAndEvacuationOuterBand) ||
        (movementOuter !== undefined && firstZone?.movementOuterBand !== undefined && movementOuter > firstZone.movementOuterBand)))
      issues.push(`${label} boundaries cannot exceed those of the first cohort.`);
    if (outer !== undefined && (evacuation.shelterDelaySecondsByBand?.length !== outer || evacuation.evacuationDelaySecondsByBand?.length !== outer))
      issues.push(`${label} needs shelter and evacuation delays for every band in its zone.`);
    if (!evacuation.referencePoint || (evacuation.referencePoint === "ALARM" && evacuation.notificationAfterAccidentSeconds === undefined))
      issues.push(`${label} needs a response reference point and, for ALARM, a notification time.`);
    if (!evacuation.travelPoint || evacuation.firstPhaseDurationSeconds === undefined || evacuation.middlePhaseDurationSeconds === undefined ||
      !evacuation.phaseSpeedsMetresPerSecond || !evacuation.precipitationMultipliers)
      issues.push(`${label} needs the three evacuation phases, speeds and rain multipliers.`);
    if (evacuation.travelPoint === "BOUNDARY" && evacuation.phaseSpeedsMetresPerSecond &&
      !evacuation.phaseSpeedsMetresPerSecond.every(speed => speed === evacuation.phaseSpeedsMetresPerSecond![0]))
      issues.push(`${label} must use equal phase speeds with BOUNDARY travel points.`);
    if (evacuation.shape === "KEYHOLE") {
      const keyhole = evacuation.keyhole;
      if (!keyhole || keyhole.innerCircularBand === undefined || keyhole.sectorCount === undefined || outer === undefined || keyhole.innerCircularBand > outer || keyhole.sectorCount % 2 !== 1 ||
        (grid?.kind === "cells" && keyhole.sectorCount > Math.floor(grid.sectors / 2) - 1) || evacuation.referencePoint === "ARRIVAL")
        issues.push(`${label} needs a valid keyhole radius, odd sector count and ALARM reference.`);
    }
    if (cells !== undefined && evacuation.cellSpeedMultipliers && evacuation.cellSpeedMultipliers.length !== cells)
      issues.push(`${label} speed multipliers must cover the whole site grid.`);
    if (model.movement.model === "NETWORK" && cells !== undefined &&
      (evacuation.networkDirectionsByCell?.length !== cells || evacuation.networkDirectionsByCell.some((direction, i) =>
        i % bands! < movementOuter! && direction === null)))
      issues.push(`${label} needs a network direction in every movement-zone cell.`);
    if (!exposureComplete(cohort.exposure?.sheltering) || !exposureComplete(cohort.exposure?.evacuation))
      issues.push(`${label} needs sheltering and evacuation exposure factors.`);
    if (model.earlyPhaseDurationSeconds !== undefined && evacuation.returnAfterEvacuationSeconds !== undefined &&
      evacuation.returnAfterEvacuationSeconds > model.earlyPhaseDurationSeconds)
      issues.push(`${label} return time must fit within the early phase.`);
  }
  const relocation = model.relocation;
  if (!relocation) issues.push("Step 02 response model needs normal and hot-spot relocation decisions.");
  else if (relocation.projectionMode === "UNSET" || relocation.projectionPeriodSeconds === undefined ||
    relocation.normal.actionDelaySeconds === undefined || relocation.normal.thresholdSv === undefined ||
    relocation.hotSpot.actionDelaySeconds === undefined || relocation.hotSpot.thresholdSv === undefined)
    issues.push("Step 02 relocation needs a projection mode, period and both action thresholds and delays.");
  else if (relocation.hotSpot.actionDelaySeconds > relocation.normal.actionDelaySeconds ||
    relocation.normal.thresholdSv > relocation.hotSpot.thresholdSv ||
    (model.earlyPhaseDurationSeconds !== undefined &&
      (relocation.normal.actionDelaySeconds > model.earlyPhaseDurationSeconds ||
        relocation.projectionPeriodSeconds > model.earlyPhaseDurationSeconds)))
    issues.push("Step 02 relocation times and dose thresholds must be ordered and fit the early phase.");
  return issues;
}
