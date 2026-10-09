import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { FrequencyDataSource, InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { IE_ANALYSIS } from "../../../../../../backends/web-backend/src/example-workbooks/seeds/ie-seed";
import { IE_ANALYSIS_SFR } from "../../../../../../backends/web-backend/src/example-workbooks/seeds/ie-seed-sfr";
import { InitiatingEventsAnalysisSchema } from "interfaces-mef-types/zod/ie/initiating-event-analysis";
import { evaluateUncertainty } from "../../shared/uncertaintyApi";
import { peekExpression, requestExpression } from "../../shared/useUncertainty";
import { praxisUncertainty, settledWithPraxis } from "../../shared/test/praxisUncertainty";
import { primarySource, sourceExpression } from "../frequencySources";
import { frequencyQuery } from "../frequencyValues";

jest.mock("../../shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

function source(fields: Partial<FrequencyDataSource> & Pick<FrequencyDataSource, "basis">): FrequencyDataSource {
  return { uuid: "DS-1", label: "Source", perModule: false, sourceReference: "", ...fields };
}

function ready(result: ReturnType<typeof sourceExpression>): UncertainExpression {
  if (result.kind === "MISSING") throw new Error(result.problem);
  return result.expression;
}

async function means(expressions: readonly UncertainExpression[]): Promise<number[]> {
  const queries = expressions.map((expression) => frequencyQuery(expression, new Map()));
  queries.forEach(requestExpression);
  const states = await settledWithPraxis(() => queries.map((query) => peekExpression(query)));
  return states.map((state) => {
    if (state.status !== "ready") throw new Error(state.status === "failed" ? state.error : "PRAXIS gave no answer.");
    return state.value.point;
  });
}

function operatingSources(ie: InitiatingEventsAnalysis): FrequencyDataSource[] {
  return ie.quantifications.flatMap((quantification) => (quantification.dataSources ?? []).filter((candidate) => candidate.basis === "OPERATING_DATA"));
}

describe("IE frequency data sources", () => {
  it("turns operating data into a Jeffreys posterior whose PRAXIS mean is (n + 0.5) / T", async () => {
    const counts = [[0, 5], [2, 5], [9, 15], [90, 20]] as const;
    const expressions = counts.map(([eventCount, exposureModuleYears]) => ready(sourceExpression(source({ basis: "OPERATING_DATA", eventCount, exposureModuleYears }), 1)));
    expect(expressions[1]).toEqual({ node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POSTERIOR", prior: null, evidence: [{ likelihood: "POISSON", failures: 2, exposure: 5 }] } } });
    const got = await means(expressions);
    counts.forEach(([n, exposure], index) => expect(got[index]).toBeCloseTo((n + 0.5) / exposure, 12));
  });

  it("updates a gamma prior built from the prior mean and weight", async () => {
    const expression = ready(sourceExpression(source({ basis: "OPERATING_DATA", eventCount: 3, exposureModuleYears: 10, priorMean: 0.05, priorWeightPseudoEvents: 2 }), 1));
    expect(expression).toEqual({ node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POSTERIOR", prior: { family: "GAMMA", shape: 2, rate: 40 }, evidence: [{ likelihood: "POISSON", failures: 3, exposure: 10 }] } } });
    const [mean] = await means([expression]);
    expect(mean).toBeCloseTo(5 / 50, 12);
  });

  it("scales a per-module source by the module count", async () => {
    const estimate: UncertainExpression = { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: 0.02, errorFactor: 5, level: 0.95 } } };
    const perSite = ready(sourceExpression(source({ basis: "GENERIC_DATA", estimate }), 4));
    const perModule = ready(sourceExpression(source({ basis: "GENERIC_DATA", estimate, perModule: true }), 4));
    const operating = ready(sourceExpression(source({ basis: "OPERATING_DATA", eventCount: 1, exposureModuleYears: 6, perModule: true }), 3));
    expect(perSite).toBe(estimate);
    expect(perModule).toEqual({ node: "OPERATION", operation: "MULTIPLY", operands: [estimate, { node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value: 4 } } }] });
    const [site, module, data] = await means([perSite, perModule, operating]);
    expect(module).toBeCloseTo(4 * (site ?? Number.NaN), 12);
    expect(data).toBeCloseTo(3 * (1.5 / 6), 12);
  });

  it("names what a source is missing instead of guessing", () => {
    expect(sourceExpression(source({ basis: "OPERATING_DATA", exposureModuleYears: 5 }), 1)).toEqual({ kind: "MISSING", problem: "Enter the events observed and the exposure." });
    expect(sourceExpression(source({ basis: "OPERATING_DATA", eventCount: 1, exposureModuleYears: 0 }), 1)).toEqual({ kind: "MISSING", problem: "The exposure must be above zero." });
    expect(sourceExpression(source({ basis: "OPERATING_DATA", eventCount: 1, exposureModuleYears: 5, priorMean: 0.1 }), 1)).toEqual({ kind: "MISSING", problem: "Give both the prior mean and the prior weight, or neither." });
    expect(sourceExpression(source({ basis: "DESIGN_BASED" }), 1)).toEqual({ kind: "MISSING", problem: "Type the estimate." });
    expect(sourceExpression(source({ basis: "FAULT_TREE" }), 1)).toEqual({ kind: "MISSING", problem: "Type the top event frequency." });
    const estimate: UncertainExpression = { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 0.1 } } };
    expect(sourceExpression(source({ basis: "GENERIC_DATA", estimate, perModule: true }), undefined).kind).toBe("MISSING");
  });

  it("picks the stored primary source or the first one", () => {
    const sources = [source({ basis: "GENERIC_DATA", uuid: "DS-1" }), source({ basis: "FAULT_TREE", uuid: "DS-2" })];
    expect(primarySource(sources, "DS-2")?.uuid).toBe("DS-2");
    expect(primarySource(sources, undefined)?.uuid).toBe("DS-1");
    expect(primarySource([], undefined)).toBeUndefined();
  });

  it("gives every example source a value, and the SFR operating data the published (2N + 1) / 2T rates", async () => {
    const all = [...IE_ANALYSIS.quantifications, ...IE_ANALYSIS_SFR.quantifications].flatMap((quantification) => quantification.dataSources ?? []);
    expect(all.length).toBeGreaterThan(50);
    const expressions = all.map((candidate) => ready(sourceExpression(candidate, 1)));
    const got = await means(expressions);
    got.forEach((mean) => expect(mean).toBeGreaterThan(0));
    const operating = operatingSources(IE_ANALYSIS_SFR);
    expect(operating.length).toBeGreaterThan(5);
    const rates = await means(operating.map((candidate) => ready(sourceExpression(candidate, 1))));
    operating.forEach((candidate, index) => expect(rates[index]).toBeCloseTo(((candidate.eventCount ?? Number.NaN) + 0.5) / (candidate.exposureModuleYears ?? Number.NaN), 12));
  });

  it("stores both examples in the contract shape with DA links as parameter references", () => {
    [IE_ANALYSIS, IE_ANALYSIS_SFR].forEach((ie) => {
      const parsed = InitiatingEventsAnalysisSchema.safeParse(ie);
      expect(parsed.success ? [] : parsed.error.issues.slice(0, 3)).toEqual([]);
      ie.initiatingEventGroups.forEach((group) => {
        const link = group.controlledDataSource;
        const quantification = ie.quantifications.find((candidate) => candidate.initiatorOrGroupId === group.uuid);
        expect(group.frequency).toBeDefined();
        expect(quantification?.frequency).toEqual(group.frequency);
        if (link !== undefined) expect(group.frequency?.expression).toEqual({ node: "PARAMETER", reference: link });
      });
    });
    const typed = IE_ANALYSIS_SFR.initiatingEventGroups.filter((group) => group.controlledDataSource === undefined).map((group) => [group.uuid, group.frequency?.expression]);
    expect(typed).toEqual([
      ["HZ-FIRE", { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: 5e-3, errorFactor: 10, level: 0.95 } } }],
      ["HZ-SEIS", { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: 1e-4, errorFactor: 10, level: 0.95 } } }],
    ]);
  });

  it("keeps the published mean of every HTGR group source", async () => {
    const primaries = IE_ANALYSIS.quantifications.map((quantification) => primarySource(quantification.dataSources ?? [], quantification.primaryDataSourceId));
    const expressions = primaries.map((candidate) => {
      if (candidate === undefined) throw new Error("A quantification has no data source.");
      return ready(sourceExpression(candidate, 1));
    });
    const got = await means(expressions);
    expressions.forEach((expression, index) => {
      if (expression.node !== "VALUE" || expression.value.law.family !== "LOGNORMAL") throw new Error("The HTGR group sources are lognormal.");
      const mean = expression.value.law.mean;
      expect(Math.abs((got[index] ?? Number.NaN) - mean) / mean).toBeLessThan(1e-12);
    });
  });
});
