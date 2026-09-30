import type { RcWeatherData, RcWeatherInputs, RcWeatherRecord } from "interfaces-mef-types/rc/weather";
import { generateWeatherTrials, weatherBinDefinitions } from "../weather-trials";

const annualRecords = (rain = 0): RcWeatherRecord[] => Array.from({ length: 365 * 24 }, (_, index) => ({
  day: Math.floor(index / 24) + 1, period: index % 24 + 1, windSector: index % 16 + 1,
  windSpeedMetresPerSecond: 2, stabilityClass: "D", rainCode: rain ? Math.round(rain / .254) : 0,
  rainMillimetresPerHour: rain, mixingHeightMetres: 500, original: String(index),
}));
const data = (records: RcWeatherRecord[]): RcWeatherData => ({ recordCount: records.length, dayCount: new Set(records.map(record => record.day)).size,
  first: { day: records[0].day, period: records[0].period }, last: { day: records.at(-1)!.day, period: records.at(-1)!.period }, intervalMinutes: 60,
  windSectors: 16, mixingHeightMode: "per_record", gaps: 0, missingPeriods: 0, maxWindSector: 16, classGRecords: 0, traceRainRecords: 0 });
const input = (records: RcWeatherRecord[]): RcWeatherInputs => ({ revision: 1, settings: { latitude: 35, longitude: -90, year: 2020, windSectors: 16 }, data: data(records),
  model: { mode: "fixed_start", mixingHeight: "file", fixedStart: { day: 1, period: 1 }, boundary: { enabled: false } } });

describe("weather trial generation", () => {
  it("builds fixed, constant and supplied-sequence trials from their actual inputs", () => {
    const records = annualRecords(), weather = input(records);
    expect(generateWeatherTrials(weather, records).trials[0]).toMatchObject({ id: "D001P01", probability: 1, mixingHeightMetres: 500 });
    weather.model = { mode: "supplied_sequence", mixingHeight: "file", suppliedSequenceStart: { day: 365, period: 1 }, boundary: { enabled: false } };
    expect(generateWeatherTrials(weather, records).trials[0].id).toBe("D365P01");
    weather.model = { mode: "constant", constant: { windSpeedMetresPerSecond: 3, windDirection: "uniform", stabilityClass: "D", rainMillimetresPerHour: 0, mixingHeightMetres: 700 }, boundary: { enabled: false } };
    const constant = generateWeatherTrials(weather, []);
    expect(constant.trials).toHaveLength(16); expect(constant.trials[0].probability).toBeCloseTo(1 / 16); expect(constant.summary.windRose).toHaveLength(16);
  });

  it("samples fixed MACCS dry bins deterministically and preserves bin probability", () => {
    const records = annualRecords(), weather = input(records);
    weather.model = { mode: "uniform_bin", mixingHeight: "file", sampling: { randomSeed: 17, samplesPerBin: 3, rainRateBreakpointsMmPerHour: [.5, 2.5], rainDistanceEndpointsKm: [10, 16, 24, 32] }, boundary: { enabled: false } };
    const first = generateWeatherTrials(weather, records), second = generateWeatherTrials(weather, records);
    expect(first.trials.map(trial => trial.id)).toEqual(second.trials.map(trial => trial.id));
    expect(first.trials).toHaveLength(3); expect(first.summary.bins).toEqual([{ id: "W04", label: "C/D; 1 < u ≤ 2 m/s", population: 8760, selected: 3, probability: 1 }]);
    expect(first.trials.reduce((sum, trial) => sum + trial.probability, 0)).toBeCloseTo(1);
  });

  it("uses rain intensity and first-rain distance bins and weighted sample counts", () => {
    const records = annualRecords(1), weather = input(records), sampling = { randomSeed: 9, rainRateBreakpointsMmPerHour: [.5, 2.5], rainDistanceEndpointsKm: [10, 16, 24, 32] };
    weather.model = { mode: "weighted_bin", mixingHeight: "file", sampling: { ...sampling, binSamples: { R02D01: 2 } }, boundary: { enabled: false } };
    const generated = generateWeatherTrials(weather, records);
    expect(generated.trials).toHaveLength(2); expect(generated.summary.bins[0]).toMatchObject({ id: "R02D01", population: 8760, selected: 2, probability: 1 });
    expect(weatherBinDefinitions(sampling)).toHaveLength(28);
  });

  it("selects an equal number of deterministic strata from every day", () => {
    const records = annualRecords(), weather = input(records);
    weather.model = { mode: "stratified", mixingHeight: "file", sampling: { randomSeed: 4, samplesPerDay: 4 }, boundary: { enabled: false } };
    const generated = generateWeatherTrials(weather, records);
    expect(generated.trials).toHaveLength(1460); expect(generated.summary.bins).toHaveLength(365);
    expect(new Set(generated.trials.map(trial => trial.probability))).toEqual(new Set([1 / 1460]));
  });
});
