import type { ModelContext } from "./context";
import type { SpecMapping } from "./spec-values";

abstract class BuilderBase {
  readonly config: SpecMapping;

  constructor(config: SpecMapping) {
    this.config = { ...config };
  }

  abstract get builderType(): string;

  abstract get requires(): Set<string>;

  abstract get provides(): Set<string>;

  abstract build(context: ModelContext): void;
}

export { BuilderBase };
