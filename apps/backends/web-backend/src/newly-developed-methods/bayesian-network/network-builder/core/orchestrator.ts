import type { BuilderBase } from "./builder-base";
import type { ModelContext } from "./context";
import { applyAddParentCouplings } from "./coupling";
import type { AddParentRule } from "./coupling";
import { validateCrossLayerContractFromMetadata } from "./cross-layer-contract";
import { valueError } from "./errors";
import { repr, sortedText } from "./spec-values";

interface BuildRunSummary {
  builderOrder: string[];
  couplingsApplied: number;
}

class Orchestrator {
  private readonly builders: BuilderBase[];

  private readonly couplings: AddParentRule[];

  constructor(builders: readonly BuilderBase[], couplings: readonly AddParentRule[]) {
    this.builders = Array.from(builders);
    this.couplings = Array.from(couplings);
  }

  run(context: ModelContext): BuildRunSummary {
    const builderOrder = this.runBuildersInDependencyOrder(context);
    context.model.regenerateDirtyCpds(context);
    const couplingsApplied = applyAddParentCouplings(context, this.couplings);
    if (couplingsApplied > 0) context.model.regenerateDirtyCpds(context);
    validateCrossLayerContractFromMetadata(context);
    return { builderOrder, couplingsApplied };
  }

  private runBuildersInDependencyOrder(context: ModelContext): string[] {
    let pending = Array.from(this.builders);
    const producedKeys = new Set<string>();
    const order: string[] = [];
    while (pending.length > 0) {
      const ready = pending.filter((builder) => Array.from(builder.requires).every((key) => producedKeys.has(key)));
      if (ready.length === 0) {
        const unresolved = pending.map((builder) => {
          const missing = sortedText(Array.from(builder.requires).filter((key) => !producedKeys.has(key)));
          return `${builder.builderType} missing requires=${repr(missing)}`;
        });
        throw valueError(`Cannot resolve builder dependency order. Unresolved builders: ${unresolved.join("; ")}`);
      }
      for (const builder of ready) {
        builder.build(context);
        for (const key of builder.provides) producedKeys.add(key);
        order.push(builder.builderType);
        pending = pending.filter((candidate) => candidate !== builder);
      }
    }
    return order;
  }
}

export type { BuildRunSummary };
export { Orchestrator };
