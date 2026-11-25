import { keyError, valueError } from "./errors";
import { getValue, isMapping, isSequence, keysOf, text, toFloat, typeName } from "./spec-values";
import type { SpecMapping, SpecValue } from "./spec-values";

class DiscretizationService {
  private readonly statesByName = new Map<string, string[]>();

  private readonly centersByName = new Map<string, number[]>();

  constructor(spec: SpecMapping | null = null) {
    const raw = spec ?? {};
    for (const name of keysOf(raw)) {
      const value = raw[name];
      let states: SpecValue;
      let centers: SpecValue;
      if (isMapping(value)) {
        states = getValue(value, "states");
        centers = getValue(value, "centers");
      } else {
        states = value;
        centers = null;
      }
      if (!isSequence(states)) {
        throw valueError(`Discretization '${name}' must provide list-like states; got ${typeName(states)}.`);
      }
      const parsed = states.map((state) => text(state));
      if (parsed.length < 2) throw valueError(`Discretization '${name}' must have at least 2 states.`);
      this.statesByName.set(name, parsed);
      if (centers === null) continue;
      if (!isSequence(centers)) {
        throw valueError(`Discretization '${name}' centers must be list-like when provided; got ${typeName(centers)}.`);
      }
      const parsedCenters = centers.map((center) => toFloat(center));
      if (parsedCenters.length !== parsed.length) {
        throw valueError(
          `Discretization '${name}' centers length ${parsedCenters.length} must match state count ${parsed.length}.`,
        );
      }
      this.centersByName.set(name, parsedCenters);
    }
  }

  has(name: string): boolean {
    return this.statesByName.has(name);
  }

  states(name: string): string[] {
    const states = this.statesByName.get(name);
    if (states === undefined) throw keyError(`Unknown discretization set: '${name}'.`);
    return Array.from(states);
  }

  hasCenters(name: string): boolean {
    return this.centersByName.has(name);
  }

  centers(name: string): number[] {
    const centers = this.centersByName.get(name);
    if (centers === undefined) throw keyError(`Discretization set '${name}' has no centers defined.`);
    return Array.from(centers);
  }
}

export { DiscretizationService };
