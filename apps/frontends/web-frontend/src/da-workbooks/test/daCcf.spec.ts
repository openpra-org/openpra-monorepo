import { DistributionType } from "interfaces-mef-types/core/events";
import type { CcfParameterEstimation, DataAnalysis, DaRecordSet, DaSource, DaSourceEntry } from "interfaces-mef-types/da/data-analysis";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { DA_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed";
import { SY_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sy-seed-htgr";
import { SY_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sy-seed";
import { daImportNeeds } from "../daSelectors";
import { ccfComplete, ccfFindings, ccfResult, ccfTemplates, expansionCoefficients, handoffFor, schemeCoefficients, withCcf } from "../daCcf";

function close(actual: number | undefined, expected: number, tolerance = 1e-6): void {
  expect(actual).toBeDefined();
  expect(Math.abs((actual ?? 0) - expected) / Math.abs(expected)).toBeLessThan(tolerance);
}

function row(id: string, a: number, b: number, failureMode: string): DaSourceEntry {
  return { id, component: "Motor-driven pump, all systems", failureMode, quantity: "PROBABILITY", table: "Test table", distribution: { type: DistributionType.BETA, alpha: a, betaParam: b } };
}

const ENTRIES: DaSourceEntry[] = [
  row("PRIOR-C2-A1", 22.4, 0.469, "Fail to start, CCCG 2, alpha 1"),
  row("PRIOR-C2-A2", 0.469, 22.4, "Fail to start, CCCG 2, alpha 2"),
  row("ALL-MDP-FS-C3-A1", 274.7, 2.932, "Fail to start, CCCG 3, alpha 1"),
  row("ALL-MDP-FS-C3-A2", 1.53, 276.1, "Fail to start, CCCG 3, alpha 2"),
  row("ALL-MDP-FS-C3-A3", 1.402, 276.2, "Fail to start, CCCG 3, alpha 3"),
  { id: "ALL-MDP-FS-C3-A2-MLE", component: "Motor-driven pump, all systems", failureMode: "Fail to start, CCCG 3, alpha 2, MLE", quantity: "PROBABILITY", distribution: { type: DistributionType.POINT_ESTIMATE, value: 0.00311 } },
];

const SOURCE: DaSource = { id: "SRC-T", name: "Test factors", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR", covers: "Test", boundaryConvention: "Test", failureCounting: "Test", quality: "Test", reference: "Test", entries: ENTRIES };

const RECORDS: DaRecordSet = {
  id: "RS-T",
  name: "Test records",
  origin: "TECHNOLOGY",
  reference: "Test",
  records: [
    { id: "R-1", date: "1980-01", description: "Shared corrosion on all machines", judgment: "FAILURE", parameterId: "DA-P-1", reason: "Counts" },
    { id: "R-2", date: "1981-01", description: "One machine tripped", judgment: "FAILURE", parameterId: "DA-P-1", reason: "Counts" },
    { id: "R-3", date: "1982-01", description: "Drive outside the boundary on all machines", judgment: "EXCLUDED", parameterId: "DA-P-1", reason: "Outside" },
  ],
};

function estimate(next: Partial<CcfParameterEstimation>): CcfParameterEstimation {
  return {
    uuid: "DA-CCF-1",
    ccfGroupReference: "CCF-T",
    groupSize: 3,
    memberParameterId: "DA-P-1",
    testing: "STAGGERED",
    testingReason: "Plan",
    method: "PRIOR",
    priorSourceId: "SRC-T",
    priorTemplate: "ALL-MDP-FS",
    priorReason: "Same pumps",
    modelType: "MGL",
    parameters: {},
    parameterSource: "GENERIC",
    componentBoundaryConsistencyBasis: "Same boundary",
    implementsSrs: [],
    ...next,
  };
}

function analysis(estimates: CcfParameterEstimation[], next: Partial<DataAnalysis> = {}): DataAnalysis {
  const parameter = { uuid: "DA-P-1", name: "Pump fails to start", parameterType: "PROBABILITY" as const, valueType: "MEAN" as const, value: 0.002, quantificationModel: "DEMAND_PROBABILITY" as const, valueMode: "TYPED" as const, implementsSrs: [] };
  return { ...DA_ANALYSIS_HTGR, parameters: [parameter], sources: [SOURCE], recordSets: [RECORDS], ccfParameterEstimations: estimates, dataNeeds: undefined, ...next };
}

function checks(da: DataAnalysis): string[] {
  return ccfFindings(da).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`);
}

function estimateOf(da: DataAnalysis, id: string): CcfParameterEstimation {
  const found = (da.ccfParameterEstimations ?? []).find((candidate) => candidate.uuid === id);
  if (found === undefined) throw new Error(`${id} is missing`);
  return found;
}

describe("common cause formulas", () => {
  it("reproduces the EPRI staggered walk-through for a group of three", () => {
    const qt = 0.002 / 0.976224;
    const coefficients = schemeCoefficients([0.976224, 0.0142, 0.00961], "STAGGERED");
    close((coefficients[1] ?? 0) * qt, 1.454584193791589e-5, 1e-12);
    close((coefficients[2] ?? 0) * qt, 1.968810436948897e-5, 1e-12);
  });

  it("hands Systems Analysis factors that expand to the same combinations for either testing scheme", () => {
    const sets = [[0.98, 0.02], [0.97, 0.02, 0.01], [0.96, 0.02, 0.015, 0.005], [0.95, 0.02, 0.012, 0.01, 0.008]];
    for (const alphas of sets) {
      for (const testing of ["STAGGERED", "NON_STAGGERED"] as const) {
        const handoff = handoffFor(alphas, testing);
        expect(handoff.modelType).toBe(testing === "STAGGERED" ? "MGL" : "ALPHA_FACTOR");
        const expanded = expansionCoefficients(handoff.modelType, handoff.parameters, alphas.length);
        const expected = schemeCoefficients(alphas, testing);
        expected.forEach((value, index) => close(expanded?.[index], value, 1e-12));
      }
    }
  });

  it("matches the CCF 2020 MGL table when the testing is staggered", () => {
    const da = analysis([estimate({})]);
    const result = ccfResult(da, estimate({}));
    close(result.handoff?.parameters["beta"], 0.010560742277547257, 1e-9);
    close(result.handoff?.parameters["gamma"], 0.4781718963165074, 1e-9);
    close(result.alphas[0]?.mean, 0.9894392577224527, 1e-12);
    close(result.combinations[2]?.each, 0.002 * 0.005049850161364684, 1e-9);
  });

  it("rebuilds the report's own 2006 to 2020 update from the 2015 prior", () => {
    const events = Array.from({ length: 4 }, (_, index) => ({ id: `E-${index + 1}`, impact: [0.4494, 0.3378], included: true, reason: "Coded event" }));
    const updated = estimate({ groupSize: 2, method: "BAYES", testing: "NON_STAGGERED", priorTemplate: "PRIOR", evidence: [{ id: "EV-1", origin: "TECHNOLOGY", population: 4.75, independentFailures: 339.9, events, boundary: "SAME", reason: "Industry data", included: true }] });
    const result = ccfResult(analysis([updated]), updated);
    close(result.posterior?.[0], 167.3133894736842, 1e-9);
    close(result.posterior?.[1], 1.8202, 1e-9);
    close(result.alphas[1]?.mean, 0.010761907233590688, 1e-9);
    close(result.alphas[1]?.p05, 0.0017022971033590142, 1e-4);
    close(result.alphas[1]?.p95, 0.026179147340437053, 1e-4);
    expect(result.handoff?.modelType).toBe("ALPHA_FACTOR");
  });

  it("lists the templates that have every alpha factor for a group size", () => {
    const templates = ccfTemplates("SRC-T", ENTRIES);
    expect(templates.map((template) => [template.code, template.sizes])).toEqual([["PRIOR", [2]], ["ALL-MDP-FS", [3]]]);
    expect(templates[1]?.failureMode).toBe("Fail to start");
  });
});

describe("common cause checks", () => {
  it("stores the hand-off and leaves typed factors alone", () => {
    const typed = estimate({ uuid: "DA-CCF-2", method: "TYPED", modelType: "ALPHA_FACTOR", parameters: { alpha1: 0, alpha2: 0, alpha3: 1 }, estimateReason: "One shared image" });
    const synced = withCcf(analysis([estimate({}), typed]));
    const stored = synced.ccfParameterEstimations?.[0];
    expect(stored?.modelType).toBe("MGL");
    close(stored?.parameters["beta"], 0.010560742277547257, 1e-9);
    expect(synced.ccfParameterEstimations?.[1]).toBe(typed);
    expect(withCcf(synced)).toBe(synced);
    expect(ccfComplete(synced)).toBe(true);
  });

  it("flags exclusions that differ from the independent data and counts that disagree with the records", () => {
    const evidence = {
      id: "EV-1",
      origin: "TECHNOLOGY" as const,
      recordSetId: "RS-T",
      population: 4,
      independentFailures: 1,
      events: [
        { id: "E-1", recordId: "R-1", impact: [0, 0, 1], included: false, reason: "Left out" },
        { id: "E-2", recordId: "R-3", impact: [0, 0, 1], included: true, reason: "Counted" },
      ],
      boundary: "SAME" as const,
      reason: "Same technology",
      included: true,
    };
    const found = checks(analysis([estimate({ method: "BAYES", evidence: [evidence] })]));
    expect(found.filter((line) => line === "warning:Exclusions differ:DA-CCF-1")).toHaveLength(2);
    expect(found).toContain("note:Independent count:DA-CCF-1");
    expect(found).toContain("warning:Exclusions not confirmed:DA-CCF-1");
    const short = { ...evidence, events: [{ id: "E-3", impact: [0, 1], included: true, reason: "Coded" }] };
    expect(checks(analysis([estimate({ method: "BAYES", evidence: [short] })]))).toContain("error:Cannot estimate:DA-CCF-1");
  });

  it("asks for a multi-parameter model on risk-significant groups and for MGL when staggered factors are typed", () => {
    const coarse = estimate({ method: "TYPED", modelType: "BETA_FACTOR", parameters: { beta: 0.05 }, isRiskSignificant: true, estimateReason: "Old value" });
    expect(checks(analysis([coarse]))).toContain("error:Model too coarse:DA-CCF-1");
    const staggered = estimate({ method: "TYPED", modelType: "ALPHA_FACTOR", parameters: { alpha1: 0.98, alpha2: 0.01, alpha3: 0.01 }, estimateReason: "Typed" });
    expect(checks(analysis([staggered]))).toContain("warning:Staggered alphas:DA-CCF-1");
    const unset = estimate({ testing: undefined, testingReason: undefined, priorTemplate: "MISSING" });
    const found = checks(analysis([unset]));
    expect(found).toContain("warning:No testing scheme:DA-CCF-1");
    expect(found).toContain("error:Cannot estimate:DA-CCF-1");
  });

  it("checks the group against what Systems Analysis imports", () => {
    const needs = {
      sources: [],
      basicEvents: [
        { id: "A", code: "A", name: "A", included: true, parameterId: "DA-P-1" },
        { id: "B", code: "B", name: "B", included: true, parameterId: "DA-P-2" },
      ],
      initiators: [],
      humanErrors: [],
      ccfGroups: [
        { id: "CCF-T", name: "Pumps", systemIds: [], memberIds: ["A", "B"], modelType: "BETA_FACTOR", factors: { beta: 0.05 }, included: true },
        { id: "CCF-U", name: "Valves", systemIds: [], memberIds: ["A", "B"], included: true },
      ],
      states: [],
    };
    const found = checks(analysis([estimate({})], { dataNeeds: needs }));
    expect(found).toContain("error:Size differs:DA-CCF-1");
    expect(found).toContain("error:Members differ:DA-CCF-1");
    expect(found).toContain("warning:SY differs:DA-CCF-1");
    expect(found).toContain("error:No estimate:CCF-U");
  });
});

describe("examples", () => {
  it("keeps both examples in step with their common cause inputs and with Systems Analysis", () => {
    const options = { SY: [], IE: [], HRA: [], POS: [], SC: [], ESQ: [] };
    for (const [da, sy] of [[DA_ANALYSIS_HTGR, SY_ANALYSIS_HTGR], [DA_ANALYSIS, SY_ANALYSIS]] as const) {
      expect(withCcf(da)).toBe(da);
      const linked: DataAnalysis = { ...da, dataNeeds: daImportNeeds(da, { options, sy }, "2026-10-04T00:00:00.000Z") };
      expect(checks(linked).filter((line) => !line.startsWith("note:"))).toEqual([]);
      expect(ccfComplete(linked)).toBe(true);
    }
    const trains = estimateOf(DA_ANALYSIS_HTGR, "DA-CCF-08");
    const updated = ccfResult(DA_ANALYSIS_HTGR, trains);
    expect(updated.counts).toEqual([0.5, 1]);
    close(updated.alphas[1]?.prior, 0.004342697675518596, 1e-12);
    close(trains.parameters["beta"], 0.007266701788568117, 1e-12);
    const loops = estimateOf(DA_ANALYSIS, "DA-CCF-12");
    expect(loops.modelType).toBe("MGL");
    close(loops.parameters["gamma"], 0.3964771322620519, 1e-12);
    expect(estimateOf(DA_ANALYSIS, "DA-CCF-21").parameters).toEqual({ alpha1: 0, alpha2: 0, alpha3: 0, alpha4: 1 });
  });
});
