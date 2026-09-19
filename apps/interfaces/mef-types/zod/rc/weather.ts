import { z } from "zod";
import type { RcWeatherInputs, RcWeatherSettings } from "../../rc/weather";

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
const file = z.object({ documentId: z.string().uuid(), filename: z.string().min(1).max(255), sha256: z.string().regex(/^[a-f0-9]{64}$/), size: integer.positive().max(8 * 1024 * 1024), uploadedAt: z.string().datetime() });
const heights = z.array(finite.min(100).max(10000)).length(4);
export const RcWeatherInputsSchema: z.ZodType<RcWeatherInputs> = z.object({
  revision: integer.positive(), settings: RcWeatherSettingsSchema,
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
