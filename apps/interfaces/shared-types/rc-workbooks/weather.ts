import type { RcReceptorGeometry, RcSiteSettings } from "interfaces-mef-types/rc/site-receptors";
import type { RcWeatherInputs, RcWeatherRecord } from "interfaces-mef-types/rc/weather";
import type { MeteorologicalDataAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { RcWeatherModelSchema, RcWeatherSettingsSchema } from "interfaces-mef-types/zod/rc/weather";

export const weatherSectorCount = (w?: RcWeatherInputs) => w?.data?.windSectors ?? w?.configuration?.windSectors ?? w?.settings.windSectors;
export function weatherRecoveryPercent(w?: RcWeatherInputs): number | undefined {
  const data = w?.data;
  if (!data) return undefined;
  const periodsPerDay = 1440 / data.intervalMinutes;
  if (w.configuration) {
    const days = new Set<number>();
    for (const group of w.configuration.dateGroups) {
      const start = Date.parse(`${group.start}T00:00:00Z`), end = Date.parse(`${group.end}T00:00:00Z`);
      for (let day = start; day <= end && days.size < 365; day += 86_400_000) days.add(day);
    }
    const expected = days.size * periodsPerDay;
    return expected ? 100 * data.recordCount / expected : undefined;
  }
  const first = (data.first.day - 1) * periodsPerDay + data.first.period;
  const last = (data.last.day - 1) * periodsPerDay + data.last.period;
  const expected = last - first + 1;
  return expected > 0 ? 100 * data.recordCount / expected : undefined;
}
export function weatherSourceDistance(w: RcWeatherInputs | undefined, site: RcSiteSettings): number | undefined {
  const m = w?.settings;
  if (m?.latitude === undefined || m.longitude === undefined || site.latitude === undefined || site.longitude === undefined) return undefined;
  const rad = Math.PI / 180, a = Math.sin((m.latitude - site.latitude) * rad / 2) ** 2 + Math.cos(site.latitude * rad) * Math.cos(m.latitude * rad) * Math.sin((m.longitude - site.longitude) * rad / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
export const sameWeatherSite = (a: Pick<RcSiteSettings, "latitude" | "longitude"> | undefined, b: RcSiteSettings) =>
  a?.latitude !== undefined && a.longitude !== undefined && a.latitude === b.latitude && a.longitude === b.longitude;
export function weatherQualityIssues(analysis: MeteorologicalDataAnalysis): string[] {
  const issues: string[] = [], recovery = analysis.dataRecovery, review = recovery.meteorologistReview;
  const constant = analysis.weatherInputs?.model?.mode === "constant";
  if (!analysis.dataSource.trim()) issues.push("Identify the weather data source.");
  if (!analysis.spatialRepresentativenessJustification.trim()) issues.push("Document why the weather source represents the release site.");
  if (!analysis.periodSelection.periodDescription.trim()) issues.push("Document the selected weather period.");
  if (!constant) {
    if (recovery.combinedRecoveryPercent === undefined) issues.push("Calculate data recovery from the imported records.");
    if ((recovery.combinedRecoveryPercent ?? 100) < 90 && !recovery.lowRecoveryJustification?.trim()) issues.push("Justify data recovery below 90%.");
    if ((recovery.combinedRecoveryPercent ?? 100) < 100 && !recovery.substitutionTechniques?.trim()) issues.push("Document the treatment of missing weather periods.");
    if (review?.performed && (!review.reviewerQualification?.trim() || !review.considerations?.trim())) issues.push("Record the meteorologist's qualification and review considerations.");
    if (!analysis.instrumentationQuality?.calibratedProgram || !analysis.instrumentationQuality.description?.trim()) issues.push("Document the calibrated instrumentation program.");
    if (!analysis.extractedParameters.windSpeedAndDirection10m || !analysis.extractedParameters.stabilityClassMeasurement || !analysis.extractedParameters.precipitation)
      issues.push("Confirm wind, stability class and precipitation in the imported records.");
    if (analysis.stabilityClassificationMethod.approach !== "RECOGNIZED_SOURCE" || !analysis.stabilityClassificationMethod.description.trim()) issues.push("Document the recognized stability-classification method.");
    if (!analysis.timeResolution?.trim()) issues.push("Record the weather time resolution.");
  }
  if (!analysis.temporalChangesAccommodation?.trim()) issues.push("Document how the calculation follows weather changes over time.");
  if (!analysis.accuracyReview.performed || !analysis.accuracyReview.findings?.trim()) issues.push("Complete and record the weather-data accuracy review.");
  if (!analysis.parameterUncertaintyCharacterization?.trim()) issues.push("Characterize meteorological parameter uncertainty.");
  return issues;
}
export function weatherIssues(w: RcWeatherInputs | undefined, site: RcSiteSettings, geometry?: RcReceptorGeometry, requireTrials = true): string[] {
  const errors: string[] = [], s = w?.settings ?? {}, d = w?.data, c = w?.configuration, sectors = weatherSectorCount(w);
  if (!RcWeatherSettingsSchema.safeParse(s).success) errors.push("Check the weather coordinates, year and wind-sector count.");
  const model = RcWeatherModelSchema.safeParse(w?.model);
  if (!w?.model) errors.push("Choose a weather treatment.");
  else if (!model.success) errors.push(...[...new Set(model.error.issues.map(issue => issue.message))]);
  const usesFile = w?.model?.mode !== "constant";
  if (usesFile && !d) errors.push("Import the weather records.");
  if (usesFile && (s.latitude === undefined || s.longitude === undefined)) errors.push("Enter the weather source latitude and longitude.");
  if (usesFile && s.year === undefined) errors.push("Enter the imported data year.");
  if (sectors === undefined) errors.push("Specify the wind-sector count used to encode the file.");
  if (site.latitude === undefined || site.longitude === undefined) errors.push("Set the release coordinates in Step 02.");
  if (d) {
    if (sectors !== undefined && d.maxWindSector > sectors) errors.push("A wind sector exceeds the specified sector count.");
    if (d.gaps && ["uniform_bin", "weighted_bin", "stratified", "supplied_sequence"].includes(w?.model?.mode ?? "")) errors.push("The selected treatment requires consecutive weather records.");
    if (d.classGRecords && ["uniform_bin", "weighted_bin"].includes(w?.model?.mode ?? "")) errors.push("Weather-bin sampling requires stability classes A through F.");
    if (["uniform_bin", "weighted_bin", "stratified"].includes(w?.model?.mode ?? "")) {
      const periods = 1440 / d.intervalMinutes;
      if (d.dayCount !== 365 || d.recordCount !== 365 * periods || d.first.day !== 1 || d.first.period !== 1 || d.last.day !== 365 || d.last.period !== periods || d.gaps)
        errors.push("This sampling treatment requires one complete 365-day weather year.");
    }
    if (w?.model?.mode === "stratified" && w.model.sampling?.samplesPerDay !== undefined) {
      const periods = 1440 / d.intervalMinutes;
      if (w.model.sampling.samplesPerDay > periods) errors.push(`Samples per day cannot exceed ${periods} for ${d.intervalMinutes}-minute records.`);
      else if (periods % w.model.sampling.samplesPerDay !== 0) errors.push(`Samples per day must divide ${periods} evenly.`);
    }
    if (w?.model?.mixingHeight === "file" && d.mixingHeightMode !== "per_record") errors.push("Per-record mixing height is not available in this weather file.");
    if (["seasonal_day_only", "seasonal_day_night"].includes(w?.model?.mixingHeight ?? "") && !d.seasonalHeightsMetres && !c) errors.push("Seasonal morning and afternoon mixing heights are not available.");
    if (w?.model?.mixingHeight === "seasonal_day_night" && s.latitude === undefined) errors.push("Latitude is required for day/night mixing-height treatment.");
    if (c) {
      if (d.windSectors !== undefined && c.windSectors !== d.windSectors) errors.push("Weather and generation files specify different sector counts.");
      if (d.intervalMinutes !== c.intervalMinutes) errors.push("Weather and generation files specify different record intervals.");
      if ((d.utcOffsetHours ?? 0) !== c.utcOffsetHours) errors.push("Weather and generation files specify different time offsets.");
      if ((d.mixingHeightMode === "per_record") !== c.perRecordMixingHeight) errors.push("Weather and generation files specify different mixing-height modes.");
    }
  }
  if (w?.model?.boundary?.enabled) {
    if (!geometry || geometry.kind !== "cells") errors.push("Outer-grid weather requires the Step 02 area grid.");
    else if ((w.model.boundary.startBand ?? 0) > geometry.radiiKm.length) errors.push(`The outer-grid start band cannot exceed ${geometry.radiiKm.length}.`);
  }
  const distance = weatherSourceDistance(w, site);
  if (usesFile && distance !== undefined && distance > .05 && !sameWeatherSite(s.nearbySite, site)) errors.push("Review use of this nearby weather source for the Step 02 site.");
  if (requireTrials && model.success && !w?.trialSet) errors.push("Generate the weather trials.");
  if (requireTrials && w?.trialSet && w.model && w.trialSet.mode !== w.model.mode) errors.push("Regenerate the weather trials for the selected treatment.");
  return errors;
}
export const weatherIsReviewed = (w: RcWeatherInputs | undefined, site: RcSiteSettings, geometry?: RcReceptorGeometry): boolean => Boolean(w?.review && sameWeatherSite(w.review, site) && !weatherIssues(w, site, geometry).length);
export const windToward = (r: RcWeatherRecord, sectors: number | undefined): number | undefined => sectors === undefined || r.windSector > sectors ? undefined : (r.windSector - 1) * 360 / sectors;
