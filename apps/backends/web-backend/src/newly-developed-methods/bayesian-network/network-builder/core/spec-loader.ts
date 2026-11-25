import { domainSpecError } from "./errors";
import { getValue, getValueOr, isMapping, isSequence, strip } from "./spec-values";
import type { SpecMapping, SpecValue } from "./spec-values";

interface DomainSpec {
  schemaVersion: string;
  modelId: string;
  description: string;
  discretization: SpecMapping;
  builders: SpecMapping[];
  couplings: SpecMapping[];
  metadata: SpecMapping;
}

const requireMapping = (value: SpecValue, label: string): SpecMapping => {
  if (!isMapping(value)) throw domainSpecError(`${label} must be a mapping/object.`);
  return value;
};

const requireSequence = (value: SpecValue, label: string): SpecValue[] => {
  if (!isSequence(value)) throw domainSpecError(`${label} must be a list/array.`);
  return value;
};

const requireText = (value: SpecValue, label: string): string => {
  if (typeof value !== "string" || strip(value).length === 0) {
    throw domainSpecError(`${label} must be a non-empty string.`);
  }
  return strip(value);
};

const parseDomainSpec = (raw: SpecValue): DomainSpec => {
  const document = requireMapping(raw, "spec");
  const schemaVersion = requireText(getValue(document, "schema_version"), "schema_version");
  const model = requireMapping(getValue(document, "model"), "model");
  const modelId = requireText(getValue(model, "id"), "model.id");
  const description = requireText(getValue(model, "description"), "model.description");
  const discretization = requireMapping(getValueOr(document, "discretization", {}), "discretization");
  const builders = requireSequence(getValueOr(document, "builders", []), "builders");
  const couplings = requireSequence(getValueOr(document, "couplings", []), "couplings");
  const metadata = requireMapping(getValueOr(document, "metadata", {}), "metadata");
  const parsedBuilders = builders.map((builder, index) => {
    const entry = requireMapping(builder, `builders[${index}]`);
    requireText(getValue(entry, "type"), `builders[${index}].type`);
    return entry;
  });
  const parsedCouplings = couplings.map((coupling, index) => requireMapping(coupling, `couplings[${index}]`));
  return {
    schemaVersion,
    modelId,
    description,
    discretization: { ...discretization },
    builders: parsedBuilders,
    couplings: parsedCouplings,
    metadata: { ...metadata },
  };
};

export type { DomainSpec };
export { parseDomainSpec };
