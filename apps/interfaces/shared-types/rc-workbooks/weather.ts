import type { RcSiteSettings } from "interfaces-mef-types/rc/site-receptors";
import type { RcWeatherInputs, RcWeatherRecord } from "interfaces-mef-types/rc/weather";
import { RcWeatherSettingsSchema } from "interfaces-mef-types/zod/rc/weather";

export const weatherSectorCount = (w?: RcWeatherInputs) => w?.data?.windSectors ?? w?.configuration?.windSectors ?? w?.settings.windSectors;
export function weatherSourceDistance(w: RcWeatherInputs | undefined, site: RcSiteSettings): number | undefined {
  const m = w?.settings;
  if (m?.latitude === undefined || m.longitude === undefined || site.latitude === undefined || site.longitude === undefined) return undefined;
  const rad = Math.PI / 180, a = Math.sin((m.latitude - site.latitude) * rad / 2) ** 2 + Math.cos(site.latitude * rad) * Math.cos(m.latitude * rad) * Math.sin((m.longitude - site.longitude) * rad / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
export const sameWeatherSite = (a: Pick<RcSiteSettings, "latitude" | "longitude"> | undefined, b: RcSiteSettings) =>
  a?.latitude !== undefined && a.longitude !== undefined && a.latitude === b.latitude && a.longitude === b.longitude;
export function weatherIssues(w: RcWeatherInputs | undefined, site: RcSiteSettings): string[] {
  const errors: string[] = [], s = w?.settings ?? {}, d = w?.data, c = w?.configuration, sectors = weatherSectorCount(w);
  if (!RcWeatherSettingsSchema.safeParse(s).success) errors.push("Check the weather coordinates, year and wind-sector count.");
  if (!d) errors.push("Import the weather records.");
  if (s.latitude === undefined || s.longitude === undefined) errors.push("Enter the weather source latitude and longitude.");
  if (s.year === undefined) errors.push("Enter the imported data year.");
  if (sectors === undefined) errors.push("Specify the wind-sector count used to encode the file.");
  if (site.latitude === undefined || site.longitude === undefined) errors.push("Set the release coordinates in Step 02.");
  if (d) {
    if (sectors !== undefined && d.maxWindSector > sectors) errors.push("A wind sector exceeds the specified sector count.");
    if (d.mixingHeightMode === "missing") errors.push("The weather file is missing mixing heights.");
    if (d.classGRecords) errors.push("Review class G records before using the A–F weather-trial setup.");
    if (c) {
      if (d.windSectors !== undefined && c.windSectors !== d.windSectors) errors.push("Weather and generation files specify different sector counts.");
      if (d.intervalMinutes !== c.intervalMinutes) errors.push("Weather and generation files specify different record intervals.");
      if ((d.utcOffsetHours ?? 0) !== c.utcOffsetHours) errors.push("Weather and generation files specify different time offsets.");
      if ((d.mixingHeightMode === "per_record") !== c.perRecordMixingHeight) errors.push("Weather and generation files specify different mixing-height modes.");
    }
  }
  const distance = weatherSourceDistance(w, site);
  if (distance !== undefined && distance > .05 && !sameWeatherSite(s.nearbySite, site)) errors.push("Review use of this nearby weather source for the Step 02 site.");
  return errors;
}
export const weatherIsReviewed = (w: RcWeatherInputs | undefined, site: RcSiteSettings): boolean => Boolean(w?.review && sameWeatherSite(w.review, site) && !weatherIssues(w, site).length);
export const windToward = (r: RcWeatherRecord, sectors: number | undefined): number | undefined => sectors === undefined || r.windSector > sectors ? undefined : (r.windSector - 1) * 360 / sectors;
