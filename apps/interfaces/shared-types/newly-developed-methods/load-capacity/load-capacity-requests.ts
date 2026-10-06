import { z } from "zod";
import { WorkbookMethodSchemaVersionSchema, WorkbookRevisionSchema } from "../shared";
import type { WorkbookMethodSchemaVersion, WorkbookRevision } from "../shared";

type LoadCapacitySampling = "MONTE_CARLO" | "LATIN_HYPERCUBE";

interface LoadCapacityRunSettings {
  sampling: LoadCapacitySampling;
  samples: number;
  seed: number;
  curvePoints: number;
}

interface EsqBarrierCellRunRequest {
  schemaVersion: WorkbookMethodSchemaVersion;
  cellId: string;
  workbookRevision: WorkbookRevision;
  settings: LoadCapacityRunSettings;
}

const LoadCapacitySamplingSchema = z.enum(["MONTE_CARLO", "LATIN_HYPERCUBE"]);

const LoadCapacityRunSettingsSchema = z
  .object({
    sampling: LoadCapacitySamplingSchema,
    samples: z.number().int().min(2).max(1_000_000),
    seed: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    curvePoints: z.number().int().min(2).max(1001),
  })
  .strict();

const EsqBarrierCellRunRequestSchema = z
  .object({
    schemaVersion: WorkbookMethodSchemaVersionSchema,
    cellId: z.string().min(1),
    workbookRevision: WorkbookRevisionSchema,
    settings: LoadCapacityRunSettingsSchema,
  })
  .strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertLoadCapacitySampling = Expect<Equal<z.infer<typeof LoadCapacitySamplingSchema>, LoadCapacitySampling>>;
type _AssertLoadCapacityRunSettings = Expect<Equal<z.infer<typeof LoadCapacityRunSettingsSchema>, LoadCapacityRunSettings>>;
type _AssertEsqBarrierCellRunRequest = Expect<Equal<z.infer<typeof EsqBarrierCellRunRequestSchema>, EsqBarrierCellRunRequest>>;

export { LoadCapacitySamplingSchema, LoadCapacityRunSettingsSchema, EsqBarrierCellRunRequestSchema };
export type { LoadCapacitySampling, LoadCapacityRunSettings, EsqBarrierCellRunRequest };
