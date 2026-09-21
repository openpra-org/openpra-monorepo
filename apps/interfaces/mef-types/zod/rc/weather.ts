import { z } from "zod";
import type { RcWeatherInputs, RcWeatherModel, RcWeatherSettings } from "../../rc/weather";

const finite = z.number().finite(), integer = finite.int();
export const RcWeatherSectorsSchema = z.union([z.literal(16), z.literal(32), z.literal(48), z.literal(64)]);
const interval = z.union([z.literal(15), z.literal(30), z.literal(60)]);
const coordinates = z.object({ latitude: finite.min(-90).max(90), longitude: finite.min(-180).max(180) });
export const RcWeatherDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(`${s}T00:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, "Enter a valid calendar date");
export const RcWeatherDatesSchema = z.object({ start: RcWeatherDateSchema, end: RcWeatherDateSchema }).strict().refine(v => v.start <= v.end, "The end date must follow the start date");
export const RcWeatherSettingsSchema: z.ZodType<RcWeatherSettings> = coordinates.partial().extend({
  year: integer.min(1000).max(9999).optional(), windSectors: RcWeatherSectorsSchema.optional(), nearbySite: coordinates.strict().optional(),
}).strict();
const position = z.object({ day: integer.min(1).max(365), period: integer.min(1).max(96) });
const draftPosition = position.partial().strict();
const stability = z.enum(["A", "B", "C", "D", "E", "F", "G"]);
const increasingList = (minimum: number, maximum: number) => z.array(finite.nonnegative()).min(minimum).max(maximum)
  .refine(values => values.every((value, index) => index === 0 || value > values[index - 1]), "Values must be strictly increasing");
export const RcWeatherModelSchema: z.ZodType<RcWeatherModel> = z.object({
  mode: z.enum(["fixed_start", "uniform_bin", "weighted_bin", "stratified", "supplied_sequence", "constant"]),
  mixingHeight: z.enum(["file", "seasonal_day_only", "seasonal_day_night"]).optional(),
  fixedStart: draftPosition.optional(), suppliedSequenceStart: draftPosition.optional(),
  sampling: z.object({ randomSeed: integer.min(0).max(255).optional(), samplesPerBin: integer.positive().max(35040).optional(), samplesPerDay: integer.positive().max(96).optional(),
    rainRateBreakpointsMmPerHour: increasingList(2, 3).optional(), rainDistanceEndpointsKm: increasingList(4, 6).optional(),
    binSamples: z.record(z.string().regex(/^(W\d{2}|R\d{2}D\d{2})$/), integer.nonnegative().max(35040)).optional() }).strict().optional(),
  constant: z.object({ windSpeedMetresPerSecond: finite.min(.5).max(30).optional(), windDirection: z.enum(["uniform", "fixed"]).optional(), windTowardDegrees: finite.min(0).max(360).optional(),
    stabilityClass: stability.optional(), rainMillimetresPerHour: finite.min(0).max(99).optional(), mixingHeightMetres: finite.min(100).max(10000).optional() }).strict().optional(),
  boundary: z.object({ enabled: z.boolean(), startBand: integer.positive().optional(), windSpeedMetresPerSecond: finite.min(.5).max(30).optional(), stabilityClass: stability.optional(),
    rainMillimetresPerHour: finite.min(0).max(99).optional(), mixingHeightMetres: finite.min(100).max(10000).optional() }).strict().optional(),
}).strict().superRefine((value, ctx) => {
  const required = (condition: boolean, path: (string | number)[], message: string) => { if (!condition) ctx.addIssue({ code: "custom", path, message }); };
  if (value.mode !== "constant") required(value.mixingHeight !== undefined, ["mixingHeight"], "Choose a mixing-height treatment");
  if (value.mode === "fixed_start") required(position.safeParse(value.fixedStart).success, ["fixedStart"], "Choose a valid starting day and period");
  if (value.mode === "supplied_sequence") required(position.safeParse(value.suppliedSequenceStart).success, ["suppliedSequenceStart"], "Choose the start of the 120-hour sequence");
  if (["uniform_bin", "weighted_bin", "stratified"].includes(value.mode)) {
    required(value.sampling?.randomSeed !== undefined, ["sampling", "randomSeed"], "Enter a random seed from 0 to 255");
  }
  if (["uniform_bin", "weighted_bin"].includes(value.mode)) {
    required(Boolean(value.sampling?.rainRateBreakpointsMmPerHour?.length), ["sampling", "rainRateBreakpointsMmPerHour"], "Enter two or three rain-rate breakpoints");
    required((value.sampling?.rainRateBreakpointsMmPerHour?.length ?? 0) >= 2, ["sampling", "rainRateBreakpointsMmPerHour"], "Enter two or three rain-rate breakpoints");
    required(Boolean(value.sampling?.rainDistanceEndpointsKm?.length), ["sampling", "rainDistanceEndpointsKm"], "Enter four to six rain-distance endpoints");
  }
  if (value.mode === "uniform_bin") required(value.sampling?.samplesPerBin !== undefined, ["sampling", "samplesPerBin"], "Enter samples per bin");
  if (value.mode === "weighted_bin") required(Boolean(value.sampling?.binSamples && Object.keys(value.sampling.binSamples).length), ["sampling", "binSamples"], "Enter samples for the weather bins");
  if (value.mode === "stratified") required(value.sampling?.samplesPerDay !== undefined, ["sampling", "samplesPerDay"], "Enter samples per day");
  if (value.mode === "constant") {
    const c = value.constant;
    required(c?.windSpeedMetresPerSecond !== undefined, ["constant", "windSpeedMetresPerSecond"], "Enter constant wind speed");
    required(c?.windDirection !== undefined, ["constant", "windDirection"], "Choose the constant wind-direction treatment");
    required(c?.windDirection !== "fixed" || c.windTowardDegrees !== undefined, ["constant", "windTowardDegrees"], "Enter the wind travel direction");
    required(c?.stabilityClass !== undefined, ["constant", "stabilityClass"], "Choose a stability class");
    required(c?.rainMillimetresPerHour !== undefined, ["constant", "rainMillimetresPerHour"], "Enter the rain rate");
    required(c?.mixingHeightMetres !== undefined, ["constant", "mixingHeightMetres"], "Enter the mixing height");
  }
  if (value.boundary?.enabled) {
    required(value.boundary.startBand !== undefined, ["boundary", "startBand"], "Choose the first outer-grid band");
    required(value.boundary.windSpeedMetresPerSecond !== undefined, ["boundary", "windSpeedMetresPerSecond"], "Enter boundary wind speed");
    required(value.boundary.stabilityClass !== undefined, ["boundary", "stabilityClass"], "Choose boundary stability");
    required(value.boundary.rainMillimetresPerHour !== undefined, ["boundary", "rainMillimetresPerHour"], "Enter boundary rain rate");
    required(value.boundary.mixingHeightMetres !== undefined, ["boundary", "mixingHeightMetres"], "Enter boundary mixing height");
  }
});
const file = z.object({ documentId: z.string().uuid(), filename: z.string().min(1).max(255), sha256: z.string().regex(/^[a-f0-9]{64}$/), size: integer.positive().max(8 * 1024 * 1024), uploadedAt: z.string().datetime() });
const heights = z.array(finite.min(100).max(10000)).length(4);
export const RcWeatherInputsSchema: z.ZodType<RcWeatherInputs> = z.object({
  revision: integer.positive(), settings: RcWeatherSettingsSchema,
  model: RcWeatherModelSchema.optional(),
  trialSet: z.object({ generatedAt: z.string().datetime(), mode: z.enum(["fixed_start", "uniform_bin", "weighted_bin", "stratified", "supplied_sequence", "constant"]),
    trialCount: integer.positive().max(35040), probabilityTotal: finite.min(.999999).max(1.000001),
    bins: z.array(z.object({ id: z.string().min(1).max(20), label: z.string().min(1).max(120), population: integer.nonnegative().max(35040), selected: integer.nonnegative().max(35040), probability: finite.min(0).max(1) }).strict()).max(400),
    windRose: z.array(z.object({ sector: integer.positive().max(64), towardDegrees: finite.min(0).max(360), probability: finite.min(0).max(1) }).strict()).max(64),
    boundary: z.object({ enabled: z.literal(true), startBand: integer.positive(), windSpeedMetresPerSecond: finite.min(.5).max(30), stabilityClass: stability,
      rainMillimetresPerHour: finite.min(0).max(99), mixingHeightMetres: finite.min(100).max(10000) }).strict().optional() }).strict().optional(),
  data: z.object({ recordCount: integer.positive().max(35040), dayCount: integer.positive().max(365), first: position, last: position,
    intervalMinutes: interval, windSectors: RcWeatherSectorsSchema.optional(), utcOffsetHours: integer.min(-23).max(23).optional(),
    mixingHeightMode: z.enum(["per_record", "seasonal", "missing"]), seasonalHeightsMetres: z.array(finite.min(100).max(10000)).length(8).optional(),
    gaps: integer.nonnegative(), missingPeriods: integer.nonnegative(), maxWindSector: integer.min(1).max(64), classGRecords: integer.nonnegative(), traceRainRecords: integer.nonnegative() }).optional(),
  configuration: z.object({ latitude: coordinates.shape.latitude, longitude: coordinates.shape.longitude, dateGroups: z.array(RcWeatherDatesSchema).min(1).max(100),
    dataset: z.string().max(1000), intervalMinutes: interval, windSectors: RcWeatherSectorsSchema, stabilityMethod: z.enum(["TEMPERATURE_GRADIENT", "TURNER", "SRDT"]),
    utcOffsetHours: integer.min(-23).max(23), perRecordMixingHeight: z.boolean(), morningHeightsMetres: heights, afternoonHeightsMetres: heights }).optional(),
  weatherFile: file.optional(), configurationFile: file.optional(),
  review: coordinates.extend({ reviewedAt: z.string().datetime(), reviewedBy: z.string().min(1).max(255) }).optional(),
  collectionRequest: coordinates.extend({ status: z.literal("prepared"), start: RcWeatherDateSchema, end: RcWeatherDateSchema, preparedAt: z.string().datetime() }).optional(),
});
