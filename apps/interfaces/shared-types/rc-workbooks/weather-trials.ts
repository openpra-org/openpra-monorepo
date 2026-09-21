import type {
  RcWeatherInputs,
  RcWeatherModel,
  RcWeatherRecord,
  RcWeatherSampling,
  RcWeatherTrial,
  RcWeatherTrialBin,
  RcWeatherTrialSet,
} from "interfaces-mef-types/rc/weather";

export const weatherTreatmentNames: Record<RcWeatherModel["mode"], string> = {
  fixed_start: "Fixed start time",
  uniform_bin: "Uniform weather-bin sampling",
  weighted_bin: "Weighted weather-bin sampling",
  stratified: "Stratified random sampling",
  supplied_sequence: "Supplied 120-hour sequence",
  constant: "Constant weather",
};

export function defaultWeatherModel(data: NonNullable<RcWeatherInputs["data"]>): RcWeatherModel {
  return {
    mode: "fixed_start",
    mixingHeight: data.mixingHeightMode === "per_record" ? "file" : "seasonal_day_only",
    fixedStart: { ...data.first },
    boundary: { enabled: false },
  };
}

interface BinDefinition { id: string; label: string }
const dryBins: BinDefinition[] = [
  ["A/B", "0 < u ≤ 3 m/s"], ["A/B", "u > 3 m/s"],
  ["C/D", "0 < u ≤ 1 m/s"], ["C/D", "1 < u ≤ 2 m/s"], ["C/D", "2 < u ≤ 3 m/s"], ["C/D", "3 < u ≤ 5 m/s"], ["C/D", "5 < u ≤ 7 m/s"], ["C/D", "u > 7 m/s"],
  ["E", "0 < u ≤ 1 m/s"], ["E", "1 < u ≤ 2 m/s"], ["E", "2 < u ≤ 3 m/s"], ["E", "u > 3 m/s"],
  ["F", "0 < u ≤ 1 m/s"], ["F", "1 < u ≤ 2 m/s"], ["F", "2 < u ≤ 3 m/s"], ["F", "u > 3 m/s"],
].map(([stability, speed], index) => ({ id: `W${String(index + 1).padStart(2, "0")}`, label: `${stability}; ${speed}` }));

export function weatherBinDefinitions(sampling?: RcWeatherSampling): BinDefinition[] {
  const rates = sampling?.rainRateBreakpointsMmPerHour ?? [], distances = sampling?.rainDistanceEndpointsKm ?? [];
  const rateBounds = [0, ...rates, Infinity];
  const rain = rateBounds.slice(0, -1).flatMap((_, rate) => distances.map((end, distance) => {
    const lowerRate = rateBounds[rate], upperRate = rateBounds[rate + 1], lowerDistance = distance ? distances[distance - 1] : 0;
    const rateLabel = Number.isFinite(upperRate) ? `${lowerRate} to ${upperRate} mm/h` : `over ${lowerRate} mm/h`;
    return { id: `R${String(rate + 1).padStart(2, "0")}D${String(distance + 1).padStart(2, "0")}`, label: `Rain ${rateLabel}; ${lowerDistance} to ${end} km` };
  }));
  return [...dryBins, ...rain];
}

function dryBin(record: RcWeatherRecord): string {
  const speed = record.windSpeedMetresPerSecond, stability = record.stabilityClass;
  if (stability === "A" || stability === "B") return speed <= 3 ? "W01" : "W02";
  if (stability === "C" || stability === "D") return `W${String(speed <= 1 ? 3 : speed <= 2 ? 4 : speed <= 3 ? 5 : speed <= 5 ? 6 : speed <= 7 ? 7 : 8).padStart(2, "0")}`;
  if (stability === "E") return `W${String(speed <= 1 ? 9 : speed <= 2 ? 10 : speed <= 3 ? 11 : 12).padStart(2, "0")}`;
  if (stability === "F") return `W${String(speed <= 1 ? 13 : speed <= 2 ? 14 : speed <= 3 ? 15 : 16).padStart(2, "0")}`;
  throw new Error("Weather-bin sampling supports stability classes A through F");
}

function rainBin(records: RcWeatherRecord[], start: number, intervalMinutes: number, sampling: RcWeatherSampling): string | undefined {
  const rates = sampling.rainRateBreakpointsMmPerHour!, distances = sampling.rainDistanceEndpointsKm!;
  let distance = 0;
  for (let step = 0; step < records.length && distance <= distances[distances.length - 1]; step++) {
    const record = records[(start + step) % records.length], rain = record.rainMillimetresPerHour ?? 0;
    if (rain > 0) {
      const rate = rates.findIndex(limit => rain <= limit), rateIndex = rate < 0 ? rates.length : rate;
      const distanceIndex = distances.findIndex(limit => distance <= limit);
      return distanceIndex < 0 ? undefined : `R${String(rateIndex + 1).padStart(2, "0")}D${String(distanceIndex + 1).padStart(2, "0")}`;
    }
    distance += record.windSpeedMetresPerSecond * intervalMinutes * 60 / 1000;
  }
  return undefined;
}

const hash = (text: string) => [...text].reduce((value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0, 2166136261);
function random(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ next >>> 15, next | 1);
    next ^= next + Math.imul(next ^ next >>> 7, next | 61);
    return ((next ^ next >>> 14) >>> 0) / 4294967296;
  };
}
function selectRandom(indices: number[], count: number, seed: number): number[] {
  const values = [...indices], next = random(seed);
  for (let i = values.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [values[i], values[j]] = [values[j], values[i]]; }
  return values.slice(0, Math.min(count, values.length)).sort((a, b) => a - b);
}

function season(day: number): number { return day >= 80 && day <= 171 ? 1 : day >= 172 && day <= 263 ? 2 : day >= 264 && day <= 355 ? 3 : 0; }
function daylight(day: number, period: number, intervalMinutes: number, latitude: number): boolean {
  const radians = Math.PI / 180, declination = 23.44 * Math.sin(2 * Math.PI * (284 + day) / 365) * radians;
  const cosine = Math.max(-1, Math.min(1, -Math.tan(latitude * radians) * Math.tan(declination)));
  const halfDayHours = Math.acos(cosine) / radians / 15, hour = (period - .5) * intervalMinutes / 60;
  return hour >= 12 - halfDayHours && hour < 12 + halfDayHours;
}
function mixingHeight(weather: RcWeatherInputs, record: RcWeatherRecord): number {
  const model = weather.model!, data = weather.data!;
  if (model.mixingHeight === "file") {
    if (record.mixingHeightMetres === undefined) throw new Error("The selected weather record has no mixing height");
    return record.mixingHeightMetres;
  }
  const seasonal = data.seasonalHeightsMetres ?? (weather.configuration ? [...weather.configuration.morningHeightsMetres, ...weather.configuration.afternoonHeightsMetres] : undefined);
  if (!seasonal) throw new Error("Seasonal mixing heights are not available");
  const index = season(record.day);
  if (model.mixingHeight === "seasonal_day_only") return seasonal[index + 4];
  if (weather.settings.latitude === undefined) throw new Error("Latitude is required for day/night mixing height");
  return seasonal[index + (daylight(record.day, record.period, data.intervalMinutes, weather.settings.latitude) ? 4 : 0)];
}

function recordTrial(weather: RcWeatherInputs, records: RcWeatherRecord[], index: number, probability: number, group: string): RcWeatherTrial {
  const record = records[index], sectors = weather.data?.windSectors ?? weather.configuration?.windSectors ?? weather.settings.windSectors;
  if (!record || !sectors) throw new Error("Weather record or wind-sector count is missing");
  return { id: `D${String(record.day).padStart(3, "0")}P${String(record.period).padStart(2, "0")}`, source: "file", startRecordIndex: index,
    day: record.day, period: record.period, selectionGroup: group, probability, windSpeedMetresPerSecond: record.windSpeedMetresPerSecond,
    windTowardDegrees: (record.windSector - 1) * 360 / sectors, stabilityClass: record.stabilityClass,
    rainMillimetresPerHour: record.rainMillimetresPerHour ?? 0, mixingHeightMetres: mixingHeight(weather, record) };
}

function windRose(trials: RcWeatherTrial[], sectors: number): RcWeatherTrialSet["windRose"] {
  const probabilities = Array.from({ length: sectors }, () => 0), width = 360 / sectors;
  trials.forEach(trial => { const direction = (trial.windTowardDegrees % 360 + 360) % 360; probabilities[Math.floor((direction + width / 2) / width) % sectors] += trial.probability; });
  return probabilities.map((probability, index) => ({ sector: index + 1, towardDegrees: index * width, probability })).filter(item => item.probability > 0);
}

function finish(weather: RcWeatherInputs, trials: RcWeatherTrial[], bins: RcWeatherTrialBin[]): { trials: RcWeatherTrial[]; summary: Omit<RcWeatherTrialSet, "generatedAt"> } {
  const total = trials.reduce((sum, trial) => sum + trial.probability, 0);
  if (!trials.length || Math.abs(total - 1) > 1e-9) throw new Error("Weather-trial probabilities must total 1");
  const sectors = weather.data?.windSectors ?? weather.configuration?.windSectors ?? weather.settings.windSectors;
  if (!sectors) throw new Error("Wind-sector count is required");
  return { trials, summary: { mode: weather.model!.mode, trialCount: trials.length, probabilityTotal: total, bins, windRose: windRose(trials, sectors),
    boundary: weather.model!.boundary?.enabled ? weather.model!.boundary : undefined } };
}

export function generateWeatherTrials(weather: RcWeatherInputs, records: RcWeatherRecord[]): { trials: RcWeatherTrial[]; summary: Omit<RcWeatherTrialSet, "generatedAt"> } {
  const model = weather.model;
  if (!model) throw new Error("Choose a weather treatment");
  if (model.mode === "constant") {
    const constant = model.constant!, sectors = weather.settings.windSectors!;
    const directions = constant.windDirection === "uniform" ? Array.from({ length: sectors }, (_, index) => index * 360 / sectors) : [constant.windTowardDegrees! % 360];
    const probability = 1 / directions.length;
    const trials = directions.map((direction, index): RcWeatherTrial => ({ id: constant.windDirection === "uniform" ? `CONST-S${String(index + 1).padStart(2, "0")}` : "CONST",
      source: "constant", selectionGroup: constant.windDirection === "uniform" ? `Direction ${index + 1}` : "Fixed direction", probability,
      windSpeedMetresPerSecond: constant.windSpeedMetresPerSecond!, windTowardDegrees: direction, stabilityClass: constant.stabilityClass!,
      rainMillimetresPerHour: constant.rainMillimetresPerHour!, mixingHeightMetres: constant.mixingHeightMetres! }));
    return finish(weather, trials, [{ id: "CONSTANT", label: "Constant weather", population: directions.length, selected: directions.length, probability: 1 }]);
  }
  if (!weather.data || !records.length) throw new Error("Import weather records before generating trials");
  const byPosition = (position: { day?: number; period?: number } | undefined) => records.findIndex(record => record.day === position?.day && record.period === position.period);
  if (model.mode === "fixed_start" || model.mode === "supplied_sequence") {
    const index = byPosition(model.mode === "fixed_start" ? model.fixedStart : model.suppliedSequenceStart);
    if (index < 0) throw new Error("The selected starting period is not present in the weather data");
    if (model.mode === "supplied_sequence") {
      const required = 120 * 60 / weather.data.intervalMinutes;
      if (records.length < required) throw new Error(`The supplied sequence requires ${required} consecutive records`);
      for (let step = 1; step < required; step++) {
        const previous = records[(index + step - 1) % records.length], current = records[(index + step) % records.length];
        const periods = 1440 / weather.data.intervalMinutes, expected = (previous.day - 1) * periods + previous.period + 1;
        const actual = (current.day - 1) * periods + current.period;
        if (actual !== expected && !(previous.day === 365 && current.day === 1 && current.period === 1)) throw new Error("The supplied 120-hour sequence contains a missing period");
      }
    }
    const label = model.mode === "fixed_start" ? "Fixed start" : "120-hour sequence";
    return finish(weather, [recordTrial(weather, records, index, 1, label)], [{ id: model.mode === "fixed_start" ? "FIXED" : "SEQUENCE", label, population: 1, selected: 1, probability: 1 }]);
  }
  if (model.mode === "stratified") {
    const count = model.sampling!.samplesPerDay!, seed = model.sampling!.randomSeed!, days = new Map<number, number[]>();
    records.forEach((record, index) => days.set(record.day, [...(days.get(record.day) ?? []), index]));
    const selected: { index: number; group: string }[] = [];
    for (const [day, indices] of days) {
      const next = random(seed ^ day), samples = Math.min(count, indices.length);
      for (let sample = 0; sample < samples; sample++) {
        const from = Math.floor(sample * indices.length / samples), to = Math.floor((sample + 1) * indices.length / samples);
        selected.push({ index: indices[from + Math.floor(next() * Math.max(1, to - from))], group: `Day ${day}` });
      }
    }
    const probability = 1 / selected.length, trials = selected.map(item => recordTrial(weather, records, item.index, probability, item.group));
    const bins = [...days].map(([day, indices]) => ({ id: `DAY${String(day).padStart(3, "0")}`, label: `Day ${day}`, population: indices.length, selected: Math.min(count, indices.length), probability: Math.min(count, indices.length) / selected.length }));
    return finish(weather, trials, bins);
  }
  const sampling = model.sampling!, definitions = weatherBinDefinitions(sampling), labels = new Map(definitions.map(definition => [definition.id, definition.label]));
  const grouped = new Map<string, number[]>();
  records.forEach((record, index) => { const id = rainBin(records, index, weather.data!.intervalMinutes, sampling) ?? dryBin(record); grouped.set(id, [...(grouped.get(id) ?? []), index]); });
  const totalRecords = records.length, selected: { id: string; indices: number[] }[] = [];
  for (const definition of definitions) {
    const indices = grouped.get(definition.id) ?? [];
    if (!indices.length) continue;
    const requested = model.mode === "uniform_bin" ? sampling.samplesPerBin! : sampling.binSamples?.[definition.id];
    if (requested === undefined || requested < 1) throw new Error(`Enter at least one sample for populated bin ${definition.id}`);
    selected.push({ id: definition.id, indices: selectRandom(indices, requested, sampling.randomSeed! ^ hash(definition.id)) });
  }
  const trials = selected.flatMap(group => {
    const population = grouped.get(group.id)!.length, probability = population / totalRecords / group.indices.length;
    return group.indices.map(index => recordTrial(weather, records, index, probability, group.id));
  });
  const bins = definitions.map(definition => { const population = grouped.get(definition.id)?.length ?? 0, sample = selected.find(item => item.id === definition.id);
    return { id: definition.id, label: labels.get(definition.id)!, population, selected: sample?.indices.length ?? 0, probability: population / totalRecords };
  }).filter(bin => bin.population > 0);
  return finish(weather, trials, bins);
}
