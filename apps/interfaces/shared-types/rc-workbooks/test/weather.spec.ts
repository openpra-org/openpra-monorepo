import { readFileSync } from "fs";
import { resolve } from "path";
import { parseRcWeather, parseRcWeatherConfiguration } from "../weather-parser";
import { sameWeatherSite, weatherIsReviewed, weatherIssues, weatherQualityIssues, weatherRecoveryPercent, weatherSourceDistance, windToward } from "../weather";
import { defaultWeatherModel, generateWeatherTrials } from "../weather-trials";
import type { RcWeatherInputs } from "interfaces-mef-types/rc/weather";

const fixture = (name: string) => readFileSync(resolve(__dirname, "fixtures", name), "utf8");
const weather = fixture("MacMetGen-Noah-published-day.MET"), config = fixture("MacMetGen-Noah-published-config.inp");
describe("MACCS weather and MacMetGen configuration", () => {
  it("decodes the published fixed columns without splitting the joined speed/stability fields", () => {
    const { data, records } = parseRcWeather(weather);
    expect(data).toMatchObject({ recordCount: 24, dayCount: 1, intervalMinutes: 60, utcOffsetHours: -5, mixingHeightMode: "per_record", first: { day: 1, period: 1 }, last: { day: 1, period: 24 }, gaps: 0 });
    expect(data.windSectors).toBeUndefined();
    expect(records[0]).toMatchObject({ windSector: 16, windSpeedMetresPerSecond: 2.2, stabilityClass: "E", rainMillimetresPerHour: 0, mixingHeightMetres: 140 });
    expect(records[23]).toMatchObject({ windSpeedMetresPerSecond: 3.7, stabilityClass: "D", mixingHeightMetres: 843 });
    expect(windToward(records[0], 64)).toBe(84.375); expect(windToward(records[0], undefined)).toBeUndefined();
    expect(records[0].original).toBe(weather.split("\n")[5]);
  });
  it("keeps requested dates separate from the actual day-long coverage and preserves blank prefix fields", () => {
    const c = parseRcWeatherConfiguration(config);
    expect(c).toMatchObject({ latitude: 35.2989, longitude: -93.2422, dateGroups: [{ start: "2020-01-01", end: "2020-12-31" }], dataset: "NAM12_2020", windSectors: 64, intervalMinutes: 60, stabilityMethod: "SRDT", utcOffsetHours: -5, perRecordMixingHeight: true });
    expect(c.morningHeightsMetres).toEqual([590, 530, 430, 500]);
    expect(() => parseRcWeatherConfiguration(config.replace("20200101", "20200230"))).toThrow();
    expect(() => parseRcWeatherConfiguration(config.replace("20201231", "20191231"))).toThrow();
    expect(() => parseRcWeatherConfiguration(config.replace("20201231", "20211231"))).toThrow(/one imported/);
  });
  it("calculates recovery against the requested period when generation settings are available", () => {
    const data = parseRcWeather(weather).data, configuration = parseRcWeatherConfiguration(config);
    expect(weatherRecoveryPercent({ revision: 1, settings: {}, data })).toBe(100);
    expect(weatherRecoveryPercent({ revision: 1, settings: {}, data, configuration })).toBeCloseTo(24 / (365 * 24) * 100);
  });
  it("reads a seasonal trailer in 100-metre units and retains trace rain, low wind and class G", () => {
    const lines = weather.split("\n");
    const line = lines[5].slice(0, 10) + "  1" + "7" + " -1";
    const seasonal = ["12.", "1.2E1", "10", "11", "12", "13", "14", "15"].map(s => s.padStart(10)).join("");
    const { data, records } = parseRcWeather([lines[0], lines[1], "/NUMCOR 64", line.padEnd(80), seasonal].join("\n"));
    expect(data).toMatchObject({ intervalMinutes: 60, mixingHeightMode: "seasonal", seasonalHeightsMetres: [1200, 1200, 1000, 1100, 1200, 1300, 1400, 1500], classGRecords: 1, traceRainRecords: 1 });
    expect(records[0]).toMatchObject({ rainMillimetresPerHour: null, stabilityClass: "G", windSpeedMetresPerSecond: .1 });
    expect(parseRcWeather([lines[0], lines[1], line].join("\n")).data.mixingHeightMode).toBe("missing");
  });
  it("rejects malformed, duplicate and misencoded records and counts missing periods", () => {
    const lines = weather.trimEnd().split("\n");
    expect(() => parseRcWeather([...lines, lines[5]].join("\n"))).toThrow(/unique/);
    expect(() => parseRcWeather(weather.replace("/PERIOD 60", "/PERIOD 60\n/PERIOD 30"))).toThrow(/Duplicate/);
    expect(() => parseRcWeather(weather.replace("/PERIOD 60", "/PERIOD 60\n/NUMCOR 16"))).toThrow(/sector/);
    expect(() => parseRcWeather(weather.replace("/PERIOD 60", "/PERIOD 20"))).toThrow();
    expect(() => parseRcWeather(weather.replace("140.", "99."))).toThrow(/mixing height/);
    expect(parseRcWeather(lines.filter((_, i) => i !== 6).join("\n")).data).toMatchObject({ gaps: 1, missingPeriods: 1 });
    expect(parseRcWeather(weather.replace("/PERIOD 60", "/PERIOD 15")).data.intervalMinutes).toBe(15);
  });
  it("requires location review and invalidates it when the shared site moves", () => {
    const c = parseRcWeatherConfiguration(config), site = { latitude: 35.31028, longitude: -93.23194 }, parsed = parseRcWeather(weather);
    const w: RcWeatherInputs = { revision: 1, settings: { latitude: c.latitude, longitude: c.longitude, year: 2020, windSectors: 64 }, data: parsed.data, configuration: c, model: defaultWeatherModel(parsed.data) };
    w.trialSet = { ...generateWeatherTrials(w, parsed.records).summary, generatedAt: "2026-09-11T12:00:00Z" };
    expect(weatherSourceDistance(w, site)).toBeGreaterThan(1); expect(weatherIssues(w, site).join()).toContain("nearby");
    w.settings.nearbySite = site; expect(weatherIssues(w, site)).toEqual([]);
    w.review = { ...site, reviewedAt: "2026-09-11T12:00:00Z", reviewedBy: "analyst" };
    expect(weatherIsReviewed(w, site)).toBe(true); expect(weatherIsReviewed(w, { ...site, latitude: 36 })).toBe(false);
    expect(sameWeatherSite({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })).toBe(true);
    expect(weatherIssues({ ...w, data: { ...w.data!, windSectors: 32 } }, site).join()).toContain("different sector counts");
  });
  it("uses every quality field to decide whether the meteorology basis is complete", () => {
    const analysis = { dataSource: "site tower", spatialRepresentativenessJustification: "At the release site",
      periodSelection: { approach: "REPRESENTATIVE_SINGLE_YEAR" as const, periodDescription: "Calendar year 2020" },
      dataRecovery: { combinedRecoveryPercent: 100, meetsNinetyPercent: true },
      instrumentationQuality: { calibratedProgram: true, description: "Annual calibration program" },
      extractedParameters: { windSpeedAndDirection10m: true, stabilityClassMeasurement: true, precipitation: true },
      stabilityClassificationMethod: { approach: "RECOGNIZED_SOURCE" as const, description: "SRDT" }, accuracyReview: { performed: true, findings: "Accepted" },
      temporalChangesAccommodation: "Hourly records", timeResolution: "60 min", parameterUncertaintyCharacterization: "Sensitivity cases",
      modelUncertainty: { sources: [], assumptions: [], alternatives: [] }, implementsSrs: [] };
    expect(weatherQualityIssues(analysis)).toEqual([]);
    expect(weatherQualityIssues({ ...analysis, instrumentationQuality: { calibratedProgram: false } }).join()).toContain("instrumentation");
    const constant = { ...analysis, weatherInputs: { revision: 1, settings: { windSectors: 16 as const }, model: { mode: "constant" as const,
      constant: { windSpeedMetresPerSecond: 2, windDirection: "uniform" as const, stabilityClass: "D" as const, rainMillimetresPerHour: 0, mixingHeightMetres: 1000 } } },
      dataRecovery: {}, instrumentationQuality: undefined, extractedParameters: { windSpeedAndDirection10m: false, stabilityClassMeasurement: false },
      stabilityClassificationMethod: { approach: "SIMPLIFIED" as const, description: "" }, timeResolution: undefined };
    expect(weatherQualityIssues(constant)).toEqual([]);
  });
});
