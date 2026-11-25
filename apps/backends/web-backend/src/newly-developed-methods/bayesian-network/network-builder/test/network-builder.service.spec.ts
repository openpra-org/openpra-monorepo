import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BadRequestException } from "@nestjs/common";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { BayesianNetworkBuilderResponseSchema } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { BayesianNetworkModule } from "../../bayesian-network.module";
import { parseJsonText } from "../core/spec-text";
import { getValue, isMapping, isSequence, text } from "../core/spec-values";
import type { SpecMapping } from "../core/spec-values";
import { NetworkBuilderController } from "../network-builder.controller";
import { NetworkBuilderService } from "../network-builder.service";
import { compareFileText, createTally } from "./corpus-comparison";

const YAML_SOURCE = `
schema_version: "0.1"
model:
  id: service_case
  description: service case
discretization:
  PGA:
    states: [PGA_1, PGA_2]
    centers: [0.2, 0.6]
builders:
  - type: seismic
    include_none_state: true
    pga_bin_frequencies: [1.0e-3, 1.0e-4]
    sscs:
      - ssc_id: DG_A
        theta: 0.6
        beta: 0.4
couplings: []
`;

const JSON_SOURCE = JSON.stringify({
  schema_version: "0.1",
  model: { id: "service_case", description: "service case" },
  discretization: { PGA: { states: ["PGA_1", "PGA_2"], centers: [0.2, 0.6] } },
  builders: [
    {
      type: "seismic",
      include_none_state: true,
      pga_bin_frequencies: [1.0e-3, 1.0e-4],
      sscs: [{ ssc_id: "DG_A", theta: 0.6, beta: 0.4 }],
    },
  ],
  couplings: [],
});

const withoutComment = (source: string): string => {
  const start = source.indexOf("<comment>");
  const end = source.indexOf("</comment>");
  return start < 0 || end < 0 ? source : source.slice(0, start) + source.slice(end);
};

const referenceCase = (name: string): SpecMapping => {
  const parsed = parseJsonText(readFileSync(join(__dirname, "fixtures", "documents.json"), "utf-8"));
  const cases = isSequence(parsed) ? parsed.filter(isMapping) : [];
  const found = cases.find((entry) => getValue(entry, "name") === name);
  if (found === undefined) throw new Error(`Reference case ${name} is missing.`);
  return found;
};

describe("NetworkBuilderService", () => {
  const service = new NetworkBuilderService();

  it("is registered with its controller in the Bayesian-network module", () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, BayesianNetworkModule)).toEqual([NetworkBuilderController]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, BayesianNetworkModule)).toEqual([NetworkBuilderService]);
    expect(new NetworkBuilderController(service).build({ format: "JSON", source: JSON_SOURCE }).nodeCount).toBe(2);
  });

  it("builds the same network from YAML and JSON text", () => {
    const fromYaml = service.build({ format: "YAML", source: YAML_SOURCE });
    const fromJson = service.build({ format: "JSON", source: JSON_SOURCE });
    expect(BayesianNetworkBuilderResponseSchema.safeParse(fromYaml).success).toBe(true);
    expect(fromYaml.modelId).toBe("service_case");
    expect(fromYaml.nodeCount).toBe(2);
    expect(fromYaml.builderOrder).toEqual(["seismic"]);
    expect(fromYaml.couplingsApplied).toBe(0);
    expect(fromYaml.networkFile.startsWith("<?xml version='1.0' encoding='UTF-8'?>\n<smile ")).toBe(true);
    expect(withoutComment(fromYaml.networkFile)).toBe(withoutComment(fromJson.networkFile));
  });

  it("returns the reference network file for a reference document", () => {
    const entry = referenceCase("base");
    const outcome = getValue(entry, "outcome");
    const response = service.build({ format: "JSON", source: JSON.stringify(getValue(entry, "document")) });
    const tally = createTally();
    compareFileText(
      text(isMapping(outcome) ? getValue(outcome, "file_text") : null),
      response.networkFile,
      "file",
      tally,
    );
    expect(tally.problems).toEqual([]);
    expect(response.nodeCount).toBe(5);
  });

  it("answers a specification error with the reference message", () => {
    const entry = referenceCase("probs_bad_sum");
    const outcome = getValue(entry, "outcome");
    const message = text(isMapping(outcome) ? getValue(outcome, "error_message") : null);
    const build = (): void => {
      service.build({ format: "JSON", source: JSON.stringify(getValue(entry, "document")) });
    };
    expect(build).toThrow(BadRequestException);
    expect(build).toThrow(message);
  });

  it("rejects a malformed request and unreadable text", () => {
    expect(() => service.build({ format: "JSON", source: "" })).toThrow(BadRequestException);
    expect(() => service.build({ format: "JSON", source: "{" })).toThrow(BadRequestException);
    expect(() => service.build({ format: "YAML", source: "a: [1, 2" })).toThrow(BadRequestException);
    expect(() => service.build({ format: "YAML", source: "- not\n- a mapping\n" })).toThrow(
      "spec must be a mapping/object.",
    );
  });
});
