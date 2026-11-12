import type { DiscretizationService } from "./discretization";
import { WorkingModel } from "./model";
import { Registry } from "./registry";
import type { SpecMapping } from "./spec-values";

interface ModelContext {
  schemaVersion: string;
  modelId: string;
  description: string;
  discretization: DiscretizationService;
  registry: Registry;
  model: WorkingModel;
  metadata: SpecMapping;
}

interface ModelContextInput {
  schemaVersion: string;
  modelId: string;
  description: string;
  discretization: DiscretizationService;
  metadata?: SpecMapping;
}

const createModelContext = (input: ModelContextInput): ModelContext => ({
  schemaVersion: input.schemaVersion,
  modelId: input.modelId,
  description: input.description,
  discretization: input.discretization,
  registry: new Registry(),
  model: new WorkingModel(),
  metadata: { ...(input.metadata ?? {}) },
});

export type { ModelContext, ModelContextInput };
export { createModelContext };
