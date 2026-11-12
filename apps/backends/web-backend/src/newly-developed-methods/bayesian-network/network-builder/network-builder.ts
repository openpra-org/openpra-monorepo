import { createBuilder } from "./builders/factory";
import { validateAndWriteNetworkFile } from "./core/compiler";
import { createModelContext } from "./core/context";
import type { ModelContext } from "./core/context";
import { parseCouplingRules } from "./core/coupling";
import { DiscretizationService } from "./core/discretization";
import type { NetworkModel } from "./core/network-model";
import { Orchestrator } from "./core/orchestrator";
import type { BuildRunSummary } from "./core/orchestrator";
import { parseDomainSpec } from "./core/spec-loader";
import type { DomainSpec } from "./core/spec-loader";
import type { SpecValue } from "./core/spec-values";

interface NetworkBuildRun {
  context: ModelContext;
  summary: BuildRunSummary;
}

interface NetworkBuildOptions {
  generatedAt: Date;
  includeLayout?: boolean;
  includeSubmodels?: boolean;
  probabilityTolerance?: number;
}

interface NetworkBuildResult {
  model: NetworkModel;
  fileText: string;
  summary: BuildRunSummary;
}

const runNetworkBuild = (spec: DomainSpec): NetworkBuildRun => {
  const context = createModelContext({
    schemaVersion: spec.schemaVersion,
    modelId: spec.modelId,
    description: spec.description,
    discretization: new DiscretizationService(spec.discretization),
    metadata: spec.metadata,
  });
  const builders = spec.builders.map((config) => createBuilder(config));
  const couplings = parseCouplingRules(spec.couplings);
  const summary = new Orchestrator(builders, couplings).run(context);
  return { context, summary };
};

const buildNetwork = (document: SpecValue, options: NetworkBuildOptions): NetworkBuildResult => {
  const { context, summary } = runNetworkBuild(parseDomainSpec(document));
  const compiled = validateAndWriteNetworkFile(
    context,
    {
      includeLayout: options.includeLayout ?? true,
      includeSubmodels: options.includeSubmodels ?? true,
      generatedAt: options.generatedAt,
    },
    options.probabilityTolerance ?? 1e-9,
  );
  return { model: compiled.model, fileText: compiled.fileText, summary };
};

export type { NetworkBuildOptions, NetworkBuildResult, NetworkBuildRun };
export { buildNetwork, runNetworkBuild };
