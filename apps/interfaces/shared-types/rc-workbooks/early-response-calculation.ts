import type { RcEarlyResponseCohort, RcEarlyResponseExposure, RcEarlyResponseModel } from "interfaces-mef-types/rc/early-response";
import type { RcResponseCalculationInput, RcResponseCalculationResult, RcResponseCohortResult, RcResponseDoseRate, RcResponseInterval } from "interfaces-mef-types/rc/early-response-calculation";
import type { RcSiteReceptors } from "interfaces-mef-types/rc/site-receptors";
import { earlyResponseIssues } from "./early-response";

const finiteNonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const blankDose = (organ: string) => ({ organ, cloudshine: 0, inhalation: 0, groundshine: 0, skin: 0, total: 0 });

function cohortPopulation(model: RcEarlyResponseModel, site: RcSiteReceptors, cohort: RcEarlyResponseCohort, cell: number): number | null {
  const grid = site.geometry;
  if (grid?.kind !== "cells") return null;
  if (model.population.weighting === "SUMPOP") {
    if (model.population.sumpop?.allocation === "COHORT_ARRAYS") return cohort.populationByCell?.[cell] ?? null;
    const id = model.population.sumpop?.distributionIdByCell?.[cell];
    const share = model.population.sumpop?.distributions?.find(item => item.id === id)?.fractions.find(item => item.cohortId === cohort.id)?.fraction;
    return share === undefined ? null : (grid.populationByCell?.[cell] ?? 0) * share;
  }
  const band = cell % grid.radiiKm.length, outer = grid.radiiKm[band], inner = grid.radiiKm[band - 1] ?? 0;
  const uniform = model.population.uniform;
  const total = model.population.source === "UNIFORM" && uniform
    ? band + 1 < uniform.firstPopulatedBand ? 0 : Math.PI * (outer * outer - inner * inner) / grid.sectors * uniform.densityPeoplePerSquareKm * uniform.landFraction
    : grid.populationByCell?.[cell];
  if (total === undefined) return null;
  return model.population.weighting === "PEOPLE" ? total * (cohort.resultWeightFraction ?? 0) : total;
}

function inZone(model: RcEarlyResponseModel, site: RcSiteReceptors, cohort: RcEarlyResponseCohort, cell: number, plumeSector?: number): boolean | null {
  const grid = site.geometry;
  if (grid?.kind !== "cells") return false;
  const zone = cohort.evacuation, band = cell % grid.radiiKm.length + 1;
  if (zone.shape === "NONE" || band > (zone.shelterAndEvacuationOuterBand ?? 0)) return false;
  if (zone.shape === "CIRCULAR") return true;
  if (zone.shape !== "KEYHOLE") return false;
  if (band <= (zone.keyhole?.innerCircularBand ?? 0)) return true;
  if (plumeSector === undefined) return null;
  const sector = Math.floor(cell / grid.radiiKm.length), half = Math.floor((zone.keyhole?.sectorCount ?? 1) / 2);
  const delta = Math.abs(sector - plumeSector);
  return Math.min(delta, grid.sectors - delta) <= half;
}

function nextCell(model: RcEarlyResponseModel, site: RcSiteReceptors, cohort: RcEarlyResponseCohort, cell: number): number | null {
  const grid = site.geometry;
  if (grid?.kind !== "cells") return null;
  const bands = grid.radiiKm.length, band = cell % bands, sector = Math.floor(cell / bands);
  const atOuterBand = band + 1 >= (cohort.evacuation.movementOuterBand ?? 0);
  if (model.movement.model === "RADIAL") return atOuterBand ? null : cell + 1;
  const direction = cohort.evacuation.networkDirectionsByCell?.[cell];
  if (direction === 1) return atOuterBand ? null : cell + 1;
  if (direction === 2) return ((sector + 1) % grid.sectors) * bands + band;
  if (direction === 3) return band ? cell - 1 : null;
  if (direction === 4) return ((sector + grid.sectors - 1) % grid.sectors) * bands + band;
  return null;
}

function travelDistanceMetres(site: RcSiteReceptors, cohort: RcEarlyResponseCohort, cell: number, next: number | null, first: boolean): number {
  const grid = site.geometry;
  if (grid?.kind !== "cells") return 0;
  const bands = grid.radiiKm.length, band = cell % bands, inner = grid.radiiKm[band - 1] ?? 0, outer = grid.radiiKm[band];
  if (next !== null && Math.floor(next / bands) !== Math.floor(cell / bands)) {
    const radius = (inner + outer) / 2;
    return 1000 * 2 * Math.PI * radius / grid.sectors;
  }
  if (next !== null && next < cell) return 1000 * (outer - inner);
  if (cohort.evacuation.travelPoint === "BOUNDARY") return 1000 * (outer - inner) * (first ? 0.5 : 1);
  const nextOuter = grid.radiiKm[band + 1];
  return 1000 * (nextOuter === undefined ? (outer - inner) / 2 : (nextOuter - inner) / 2);
}

function doseForIntervals(intervals: RcResponseInterval[], cohort: RcEarlyResponseCohort, model: RcEarlyResponseModel, input: RcResponseCalculationInput): RcResponseCohortResult["doseSv"] {
  if (!input.doseRates) return null;
  const dose = blankDose(input.targetOrgan!), reference = input.referenceBreathingRateCubicMetresPerSecond!;
  for (const interval of intervals) {
    const factors: RcEarlyResponseExposure | undefined = cohort.exposure?.[interval.activity];
    if (!factors) continue;
    for (const rate of input.doseRates) {
      if (rate.cellIndex !== interval.cellIndex || rate.organ !== input.targetOrgan) continue;
      const seconds = Math.max(0, Math.min(interval.endSeconds, rate.endSeconds) - Math.max(interval.startSeconds, rate.startSeconds));
      if (!seconds) continue;
      const iodine = model.iodineProtection === "ON" && cohort.iodine && cohort.iodine.affectedOrgans.includes(rate.organ)
        ? (rate.iodineInhalationSvPerSecond ?? 0) * cohort.iodine.fractionOfCohort * cohort.iodine.efficacy : 0;
      dose.cloudshine += seconds * rate.cloudshineSvPerSecond * (factors.cloudshineFactor ?? 0);
      dose.inhalation += seconds * (rate.inhalationSvPerSecond - iodine) * (factors.inhalationFactor ?? 0) *
        (factors.breathingRateCubicMetresPerSecond ?? 0) / reference;
      dose.groundshine += seconds * rate.groundshineSvPerSecond * (factors.groundshineFactor ?? 0);
      dose.skin += seconds * rate.skinSvPerSecond * (factors.skinFactor ?? 0);
    }
  }
  dose.total = dose.cloudshine + dose.inhalation + dose.groundshine + dose.skin;
  return dose;
}

function hasCompleteRateCoverage(intervals: RcResponseInterval[], rates: RcResponseDoseRate[], organ: string): boolean {
  return intervals.every(interval => {
    const matching = rates.filter(rate => rate.cellIndex === interval.cellIndex && rate.organ === organ &&
      rate.endSeconds > interval.startSeconds && rate.startSeconds < interval.endSeconds).sort((a, b) => a.startSeconds - b.startSeconds);
    let coveredTo = interval.startSeconds;
    for (const rate of matching) {
      if (rate.startSeconds > coveredTo + 1e-9) return false;
      coveredTo = Math.max(coveredTo, rate.endSeconds);
      if (coveredTo >= interval.endSeconds) return true;
    }
    return false;
  });
}

function travelSeconds(distanceMetres: number, startSeconds: number, evacuationStartSeconds: number,
  cohort: RcEarlyResponseCohort, cellMultiplier: number, raining: boolean): number {
  const evacuation = cohort.evacuation;
  const phaseEnd = [evacuationStartSeconds + evacuation.firstPhaseDurationSeconds!,
    evacuationStartSeconds + evacuation.firstPhaseDurationSeconds! + evacuation.middlePhaseDurationSeconds!, Number.POSITIVE_INFINITY];
  let remaining = distanceMetres, now = startSeconds;
  while (remaining > 1e-9) {
    const phase = now < phaseEnd[0] ? 0 : now < phaseEnd[1] ? 1 : 2;
    const speed = evacuation.phaseSpeedsMetresPerSecond![phase] * cellMultiplier *
      (raining ? evacuation.precipitationMultipliers![phase] : 1);
    if (!(speed > 0)) return Number.NaN;
    const available = (phaseEnd[phase] - now) * speed;
    if (remaining <= available) { now += remaining / speed; break; }
    remaining -= available;
    now = phaseEnd[phase];
  }
  return now - startSeconds;
}

/** Applies saved Step 02 response rules to one origin cell and Step 05 unprotected dose-rate intervals. */
export function calculateEarlyResponse(model: RcEarlyResponseModel, site: RcSiteReceptors, input: RcResponseCalculationInput): RcResponseCalculationResult {
  const issues = earlyResponseIssues(model, site), grid = site.geometry;
  const result: RcResponseCalculationResult = { modelRevision: model.revision, siteRevision: site.revision, originCellIndex: input.originCellIndex,
    targetOrgan: input.targetOrgan, issues, cohorts: [] };
  if (grid?.kind !== "cells" || issues.length) return result;
  const cells = grid.radiiKm.length * grid.sectors, band = input.originCellIndex % grid.radiiKm.length;
  if (!Number.isSafeInteger(input.originCellIndex) || input.originCellIndex < 0 || input.originCellIndex >= cells) issues.push("Choose an origin cell in the site grid.");
  if (input.plumeArrivalSecondsByCell && (input.plumeArrivalSecondsByCell.length !== cells || input.plumeArrivalSecondsByCell.some(v => !finiteNonnegative(v))))
    issues.push("Plume-arrival times must cover every cell in seconds from accident initiation.");
  if (input.plumeSector !== undefined && (!Number.isSafeInteger(input.plumeSector) || input.plumeSector < 0 || input.plumeSector >= grid.sectors))
    issues.push("Plume sector must be in the site grid.");
  if (input.rainingByCell && (input.rainingByCell.length !== cells || input.rainingByCell.some(v => typeof v !== "boolean")))
    issues.push("Precipitation state must cover every site cell.");
  if (input.doseRates) {
    if (!input.targetOrgan?.trim()) issues.push("Choose the organ represented by the unprotected dose rates.");
    if (!finiteNonnegative(input.integrationSeconds) || !input.integrationSeconds || !finiteNonnegative(input.referenceBreathingRateCubicMetresPerSecond) || !input.referenceBreathingRateCubicMetresPerSecond)
      issues.push("Step 05 integration time and the dose-rate reference breathing rate must be positive.");
    if (!input.plumeArrivalSecondsByCell) issues.push("Plume-arrival times are required to bound early-phase dose.");
    if (input.doseRates.some((r: RcResponseDoseRate) => !Number.isSafeInteger(r.cellIndex) || r.cellIndex < 0 || r.cellIndex >= cells ||
      !finiteNonnegative(r.startSeconds) || !finiteNonnegative(r.endSeconds) || r.endSeconds <= r.startSeconds || !r.organ || r.organ !== input.targetOrgan ||
      [r.cloudshineSvPerSecond, r.inhalationSvPerSecond, r.groundshineSvPerSecond, r.skinSvPerSecond, r.iodineInhalationSvPerSecond ?? 0]
        .some(v => !finiteNonnegative(v)) || (r.iodineInhalationSvPerSecond ?? 0) > r.inhalationSvPerSecond))
      issues.push("Dose-rate intervals need valid cell, time, selected organ and nonnegative Sv/s values; iodine must be part of inhalation.");
    const grouped = new Map<number, RcResponseDoseRate[]>();
    for (const rate of input.doseRates) {
      const group = grouped.get(rate.cellIndex) ?? [];
      group.push(rate);
      grouped.set(rate.cellIndex, group);
    }
    if ([...grouped.values()].some(group => group.sort((a, b) => a.startSeconds - b.startSeconds).some((rate, index) =>
      index > 0 && rate.startSeconds < group[index - 1].endSeconds)))
      issues.push("Dose-rate intervals for one cell and organ must not overlap.");
  }
  if (issues.length) return result;
  const arrival = input.plumeArrivalSecondsByCell?.[input.originCellIndex];
  const end = arrival === undefined ? null : Math.min(input.integrationSeconds ?? Number.POSITIVE_INFINITY, arrival + model.earlyPhaseDurationSeconds!);
  for (const cohort of model.cohorts) {
    const zone = inZone(model, site, cohort, input.originCellIndex, input.plumeSector);
    const row: RcResponseCohortResult = { cohortId: cohort.id, cohortName: cohort.name,
      population: cohortPopulation(model, site, cohort, input.originCellIndex), resultWeightFraction: cohort.resultWeightFraction ?? null,
      shelterStartsSeconds: null, evacuationStartsSeconds: null, relocationSeconds: null, intervals: [], doseSv: null };
    result.cohorts.push(row);
    if (zone === null) { issues.push(`${cohort.name}: plume sector is needed to place the keyhole.`); continue; }
    const evac = cohort.evacuation;
    const reference = evac.referencePoint === "ALARM" ? evac.notificationAfterAccidentSeconds : arrival;
    if (zone && reference === undefined) { issues.push(`${cohort.name}: plume arrival is needed for the ARRIVAL response reference.`); continue; }
    if (zone) {
      row.shelterStartsSeconds = reference! + evac.shelterDelaySecondsByBand![band];
      row.evacuationStartsSeconds = row.shelterStartsSeconds + evac.evacuationDelaySecondsByBand![band];
    }
    if (end === null) continue;
    if (model.relocation && !zone) {
      const projected = input.projectedDoseSvByCohort?.[cohort.id];
      if (!finiteNonnegative(projected)) { issues.push(`${cohort.name}: projected critical-organ dose is needed for relocation.`); continue; }
      const rule = projected > model.relocation.hotSpot.thresholdSv! ? model.relocation.hotSpot
        : projected > model.relocation.normal.thresholdSv! ? model.relocation.normal : undefined;
      if (rule) row.relocationSeconds = arrival! + rule.actionDelaySeconds!;
    }
    const add = (activity: RcResponseInterval["activity"], cellIndex: number, startSeconds: number, endSeconds: number) => {
      const start = Math.max(0, startSeconds), stop = Math.min(end, endSeconds, row.relocationSeconds ?? end);
      if (stop > start) row.intervals.push({ activity, cellIndex, startSeconds: start, endSeconds: stop });
    };
    if (!zone) add("normal", input.originCellIndex, 0, end);
    else {
      add("normal", input.originCellIndex, 0, row.shelterStartsSeconds!);
      add("sheltering", input.originCellIndex, row.shelterStartsSeconds!, row.evacuationStartsSeconds!);
      if (row.evacuationStartsSeconds! < end) {
        if (!input.rainingByCell) { issues.push(`${cohort.name}: cell precipitation is needed for evacuation speed.`); continue; }
        let cell = input.originCellIndex, time = row.evacuationStartsSeconds!, hops = 0, exited = false, routeIssue = false;
        const visited = new Set<number>();
        while (time < end && hops++ < cells && !visited.has(cell)) {
          visited.add(cell);
          if (model.movement.model === "NETWORK" && evac.networkDirectionsByCell?.[cell] === 3 && cell % grid.radiiKm.length === 0) {
            issues.push(`${cohort.name}: network route points inward from the innermost band.`);
            routeIssue = true;
            break;
          }
          const next = nextCell(model, site, cohort, cell);
          const distance = travelDistanceMetres(site, cohort, cell, next, hops === 1);
          const duration = travelSeconds(distance, time, row.evacuationStartsSeconds!, cohort,
            evac.cellSpeedMultipliers?.[cell] ?? 1, input.rainingByCell[cell]);
          if (!(duration > 0)) { issues.push(`${cohort.name}: evacuation route has no travel distance in cell ${cell}.`); routeIssue = true; break; }
          add("evacuation", cell, time, time + duration);
          time += duration;
          if (next === null) { exited = true; break; }
          cell = next;
        }
        if (time < end && !exited && !routeIssue)
          issues.push(`${cohort.name}: evacuation route loops before leaving the movement zone.`);
      }
    }
    if (input.doseRates && !issues.length) {
      if (!hasCompleteRateCoverage(row.intervals, input.doseRates, input.targetOrgan!))
        issues.push(`${cohort.name}: dose-rate intervals do not cover every occupied cell and time; supply explicit zero-rate intervals where appropriate.`);
      else row.doseSv = doseForIntervals(row.intervals, cohort, model, input);
    }
  }
  if (issues.length) for (const row of result.cohorts) row.doseSv = null;
  return result;
}
