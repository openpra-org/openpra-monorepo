import { z } from "zod";
import type { AleatoryVariable, UncertainParameter, UncertainVectorParameter } from "interfaces-mef-types/core/uncertainty";
import {
  AleatoryVariableSchema,
  UncertainParameterSchema,
  UncertainVectorParameterSchema,
} from "interfaces-mef-types/zod/core/uncertainty";
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

interface LoadCapacityModelSnapshot {
  id: string;
  methodType: "LOAD_CAPACITY";
  revision: number;
  load: AleatoryVariable;
  capacity: AleatoryVariable;
  unit?: string;
  uncertaintyParameters: UncertainParameter[];
  uncertaintyVectors: UncertainVectorParameter[];
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

const LoadCapacityModelSnapshotSchema = z
  .object({
    id: z.string().min(1),
    methodType: z.literal("LOAD_CAPACITY"),
    revision: z.number().int().nonnegative(),
    load: AleatoryVariableSchema,
    capacity: AleatoryVariableSchema,
    unit: z.string().optional(),
    uncertaintyParameters: z.array(UncertainParameterSchema),
    uncertaintyVectors: z.array(UncertainVectorParameterSchema),
  })
  .strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertLoadCapacitySampling = Expect<Equal<z.infer<typeof LoadCapacitySamplingSchema>, LoadCapacitySampling>>;
type _AssertLoadCapacityRunSettings = Expect<Equal<z.infer<typeof LoadCapacityRunSettingsSchema>, LoadCapacityRunSettings>>;
type _AssertEsqBarrierCellRunRequest = Expect<Equal<z.infer<typeof EsqBarrierCellRunRequestSchema>, EsqBarrierCellRunRequest>>;
type _AssertLoadCapacityModelSnapshot = Expect<Equal<z.infer<typeof LoadCapacityModelSnapshotSchema>, LoadCapacityModelSnapshot>>;

export {
  LoadCapacitySamplingSchema,
  LoadCapacityRunSettingsSchema,
  EsqBarrierCellRunRequestSchema,
  LoadCapacityModelSnapshotSchema,
};
export type { LoadCapacitySampling, LoadCapacityRunSettings, EsqBarrierCellRunRequest, LoadCapacityModelSnapshot };
