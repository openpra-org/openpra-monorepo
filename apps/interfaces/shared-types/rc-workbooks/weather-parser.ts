import type { RcWeatherConfiguration, RcWeatherData, RcWeatherRecord } from "interfaces-mef-types/rc/weather";
import { RcWeatherDatesSchema, RcWeatherInputsSchema } from "interfaces-mef-types/zod/rc/weather";
import { rcNumber as parseNumber } from "./source-term-parser";

const rcNumber = (text: string): number => parseNumber(text, "weather value");

const integer = (text: string, field: string): number => {
  if (!/^\s*[+-]?\d+\s*$/.test(text)) throw new Error(`Check the fixed-column ${field} field`);
  return Number(text);
};
const range = (value: number, min: number, max: number, name: string): number => {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Check ${name}: expected ${min} to ${max}`);
  return value;
};

/** MACCS 5.2 User Guide, Appendix B.1, Tables B-2 through B-7. No implicit MACCS clamps are applied. */
export function parseRcWeather(raw: string): { data: RcWeatherData; records: RcWeatherRecord[] } {
  const lines = raw.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
  if (lines.length < 3) throw new Error("Choose a MACCS weather file with two header lines and fixed-column records");
  let intervalMinutes = 60, windSectors: number | undefined, utcOffsetHours: number | undefined, perRecord = false;
  const records: RcWeatherRecord[] = [], headers = new Set<string>();
  let seasonalHeightsMetres: number[] | undefined;
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line.startsWith("/")) {
      const [key, value, extra] = line.trim().split(/\s+/);
      if (records.length || headers.has(key) || extra !== undefined) throw new Error(`Duplicate or misplaced weather header on line ${i + 1}`);
      headers.add(key);
      if (key === "/PERIOD") intervalMinutes = integer(value ?? "", "interval");
      else if (key === "/NUMCOR") windSectors = integer(value ?? "", "sector count");
      else if (key === "/UTCTIM") utcOffsetHours = range(integer(value ?? "", "time offset"), -23, 23, "time offset");
      else if (key === "/MIXHGT" && value === undefined) perRecord = true;
      else throw new Error(`Unrecognized weather header on line ${i + 1}`);
      continue;
    }
    if (![15, 30, 60].includes(intervalMinutes) || windSectors !== undefined && ![16, 32, 48, 64].includes(windSectors)) throw new Error("Check the weather interval and wind-sector count");
    if (seasonalHeightsMetres) throw new Error("Unexpected data after seasonal mixing heights");
    // A seasonal trailer is eight F10.0 fields, not a whitespace-delimited weather row.
    const hasWeatherPrefix = /^\s*\d+\s*$/.test(line.slice(1, 4)) && /^\s*\d+\s*$/.test(line.slice(5, 7)) && !line[0].trim() && !line.slice(4, 5).trim() && !line.slice(7, 8).trim();
    if (!perRecord && records.length && !hasWeatherPrefix && line.length >= 71) {
      if (line.slice(80).trim()) throw new Error("Seasonal mixing heights must use eight 10-column fields");
      seasonalHeightsMetres = Array.from({ length: 8 }, (_, j) => {
        const field = line.padEnd(80).slice(j * 10, (j + 1) * 10).trimStart();
        return range(rcNumber(/[.EeDd]/.test(field) ? field.trim() : field.replace(/ /g, "0")), 1, 100, "seasonal mixing height") * 100;
      });
      continue;
    }
    if (line.slice(0, 1).trim() || line.slice(4, 5).trim() || line.slice(7, 8).trim() || line.length < 17) throw new Error(`Check fixed-column spacing on line ${i + 1}`);
    const day = range(integer(line.slice(1, 4), "day"), 1, 365, "day");
    const period = range(integer(line.slice(5, 7), "period"), 1, 1440 / intervalMinutes, "period");
    const windSector = range(integer(line.slice(8, 10), "direction"), 1, windSectors ?? 64, "wind sector");
    const windSpeedMetresPerSecond = range(integer(line.slice(10, 13), "speed"), 1, 300, "wind-speed code") / 10;
    const stability = range(integer(line.slice(13, 14), "stability"), 1, 7, "stability code");
    const rainCode = range(integer(line.slice(14, 17), "rain"), -1, 999, "rain code");
    if (!perRecord && line.slice(17).trim()) throw new Error(`Extra weather fields on line ${i + 1}; per-record mixing heights need /MIXHGT`);
    const mixingHeightMetres = perRecord ? range(rcNumber(line.slice(17).trim()), 100, 10000, "mixing height") : undefined;
    records.push({ day, period, windSector, windSpeedMetresPerSecond, stabilityClass: "ABCDEFG"[stability - 1] as RcWeatherRecord["stabilityClass"],
      rainCode, rainMillimetresPerHour: rainCode === -1 ? null : rainCode * .254, mixingHeightMetres, original: line });
    if (records.length > 35040) throw new Error("Choose at most one 365-day MACCS weather file");
  }
  if (!records.length) throw new Error("The file contains no weather records");
  let previous = -1, gaps = 0, missingPeriods = 0;
  for (const row of records) {
    const position = (row.day - 1) * (1440 / intervalMinutes) + row.period;
    if (position <= previous) throw new Error("Weather records must be unique and in time order");
    if (previous >= 0 && position > previous + 1) { gaps++; missingPeriods += position - previous - 1; }
    previous = position;
  }
  const position = (r: RcWeatherRecord) => ({ day: r.day, period: r.period });
  const data = { recordCount: records.length, dayCount: new Set(records.map(r => r.day)).size, first: position(records[0]), last: position(records[records.length - 1]),
    intervalMinutes, windSectors, utcOffsetHours, mixingHeightMode: perRecord ? "per_record" : seasonalHeightsMetres ? "seasonal" : "missing",
    seasonalHeightsMetres, gaps, missingPeriods, maxWindSector: records.reduce((n, r) => Math.max(n, r.windSector), 1),
    classGRecords: records.filter(r => r.stabilityClass === "G").length, traceRainRecords: records.filter(r => r.rainCode === -1).length };
  return { data: RcWeatherInputsSchema.parse({ revision: 1, settings: {}, data }).data!, records };
}

/** The published MacMetGen positional configuration; comments and blank prefix/suffix fields are preserved. */
export function parseRcWeatherConfiguration(raw: string): RcWeatherConfiguration {
  const lines = raw.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n").filter(l => !l.trim().startsWith("!"));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  let i = 0;
  const take = () => { if (i >= lines.length) throw new Error("Incomplete MacMetGen configuration"); return lines[i++].trim(); };
  const numbers = () => take().split(/\s+/).map(rcNumber);
  range(integer(take(), "surface-data flag"), 0, 1, "surface-data flag");
  if (!take()) throw new Error("Missing surface-data filename");
  const coords = numbers(); if (coords.length !== 2) throw new Error("Provide two weather source coordinates");
  const groups = range(integer(take(), "date-group count"), 1, 100, "date-group count");
  const dateGroups = Array.from({ length: groups }, () => {
    const dates = take().split(/\s+/); if (dates.length !== 2 || dates.some(d => !/^\d{8}$/.test(d))) throw new Error("Use YYYYMMDD date pairs in the MacMetGen configuration");
    const date = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
    return RcWeatherDatesSchema.parse({ start: date(dates[0]), end: date(dates[1]) });
  });
  const years = new Set(dateGroups.flatMap(g => [g.start.slice(0, 4), g.end.slice(0, 4)]));
  if (years.size !== 1) throw new Error("Use generation settings for one imported weather year");
  const directory = take(); take(); take(); // Prefix and suffix may be empty; paths are metadata only.
  if (!take()) throw new Error("Missing output weather filename");
  const intervalMinutes = integer(take(), "interval"), windSectors = integer(take(), "sector count");
  const method = range(integer(take(), "stability method"), 0, 2, "stability method"), utcOffsetHours = integer(take(), "time offset");
  const perRecordMixingHeight = range(integer(take(), "mixing-height flag"), 0, 1, "mixing-height flag") === 1;
  const morningHeightsMetres = numbers(), afternoonHeightsMetres = numbers();
  if (i !== lines.length) throw new Error("Unexpected entries after MacMetGen mixing heights");
  const configuration = { latitude: coords[0], longitude: coords[1], dateGroups, dataset: directory.split(/[\\/]/).filter(Boolean).pop() ?? "",
    intervalMinutes, windSectors, stabilityMethod: ["TEMPERATURE_GRADIENT", "TURNER", "SRDT"][method], utcOffsetHours, perRecordMixingHeight, morningHeightsMetres, afternoonHeightsMetres };
  return RcWeatherInputsSchema.parse({ revision: 1, settings: {}, configuration }).configuration!;
}
