import { fireEvent, render, screen, within } from "@testing-library/react";
import type { HclUncertaintySummary } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import type { HclEditorBatchRunResult, HclEditorRunResult } from "../../hybrid-causal-logic/hclBindingTypes";
import type { BayesianNetworkAnalysisResult } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  BayesianNetworkResults,
  BayesianNetworkBatchResults,
  bayesianResultRecords,
  bayesianBatchResultRecords,
} from "../../bayesian-network/bayesianNetworkResults";
import { testBayesianNetworkModel, TEST_ID } from "../../bayesian-network/test/bayesianNetworkTestModel";
import { HclResults } from "../../hybrid-causal-logic/hclResults";
import {
  eventTreeResultRecords,
  faultTreeResultRecords,
  hclBatchResultRecords,
  hclResultRecords,
} from "../probabilityResultExport";

const model = testBayesianNetworkModel();
const common = {
  schemaVersion: "1.0.0" as const,
  runId: "run-1",
  owner: { workbookId: "workbook", modelId: model.modelId, workbookRevision: 7 },
  completedAt: "2026-09-11T00:00:00.000Z",
  validationIssues: [
    {
      code: "SOURCE_WARNING",
      message: "Review the input assumption.",
      severity: "WARNING" as const,
      entityId: TEST_ID.a,
      fieldPath: [],
    },
  ],
};
const summary: HclUncertaintySummary = {
  sampleCount: 100,
  seed: 42,
  mean: 1e-7,
  standardDeviation: 2e-8,
  minimum: 1e-9,
  percentile05: 2e-9,
  median: 8e-8,
  percentile95: 2e-7,
  maximum: 3e-7,
};
const bn: BayesianNetworkAnalysisResult = {
  ...common,
  evidence: { observations: [] },
  marginals: [
    {
      nodeId: TEST_ID.a,
      values: [
        { stateId: TEST_ID.aFalse, probability: 0.9999999 },
        { stateId: TEST_ID.aTrue, probability: 1e-7 },
      ],
    },
  ],
};
const ft: HclEditorRunResult = {
  kind: "FAULT_TREE",
  result: {
    ...common,
    faultTreeTopGate: {
      referenceType: "FAULT_TREE_TOP_EVENT",
      workbookId: "systems",
      modelId: "ft-1",
      entityId: "top-1",
    },
    probability: 0.12345678901234568,
    uncertainty: summary,
    bddNodes: 1,
    bddVariables: 1,
    variableOrder: ["be-1"],
    bridge: {
      quantifications: 1,
      bddContextCacheHits: 0,
      bddContextCacheMisses: 1,
      bnQueryCacheHits: 0,
      bnQueryCacheMisses: 1,
    },
    junctionTree: { numCliques: 1, maxCliqueSize: 1, treewidth: 0, totalTableEntries: 2 },
  },
};
const et: HclEditorRunResult = {
  kind: "EVENT_TREE",
  result: {
    ...common,
    mode: "HYBRID_CAUSAL_LOGIC",
    sequences: Array.from({ length: 27 }, (_, index) => ({
      sequenceId: `seq-${index}`,
      path: [],
      result: { kind: "END_STATE" as const, endStateId: "end" },
      conditionalProbability: 1e-7,
      annualFrequency: 1e-9,
      uncertainty: { conditionalProbability: summary, annualFrequency: { ...summary, mean: 1e-9 } },
    })),
    endStateAggregates: [{ endStateId: "end", annualFrequency: 2.7e-8, uncertainty: summary }],
  },
};
const batch = (results: Array<HclEditorRunResult | null>): HclEditorBatchRunResult => ({
  kind: "FAULT_TREE",
  scenarios: results.map((result, index) => ({
    scenarioId: `scenario-${index}`,
    scenarioCode: `S-${index}`,
    scenarioName: `Scenario ${index}, α`,
    status: result === null ? "FAILED" : "SUCCEEDED",
    failure: result === null ? "Impossible evidence" : null,
    result,
  })),
});
const renderHcl = (
  runResult: HclEditorRunResult | null,
  batchRunResult: HclEditorBatchRunResult | null = null,
  uncertainty = false,
) =>
  render(
    <HclResults
      runResult={runResult}
      batchRunResult={batchRunResult}
      workflow={batchRunResult === null ? "MANUAL" : "BATCH"}
      calculationType={uncertainty ? "UNCERTAINTY" : "PROBABILITY"}
      eventTreeOptions={[]}
      faultTreeOptions={[]}
    />,
  );

describe("BN results", () => {
  it("shows node/state identities, rare probability and returned warnings", () => {
    render(
      <BayesianNetworkResults
        result={bn}
        model={model}
      />,
    );
    expect(screen.getByText("A / TRUE")).toBeInTheDocument();
    expect(screen.getByText("1e-7")).toHaveAttribute("title", "1e-7");
    expect(screen.queryByText("0.00%")).not.toBeInTheDocument();
    expect(screen.getByText(/Review the input assumption/)).toBeInTheDocument();
  });

  it("retains raw values, case-sensitive state names and IDs in exports", () => {
    const rows = bayesianResultRecords(bn, model);
    expect(rows[1]).toMatchObject({
      node_id: TEST_ID.a,
      state_id: TEST_ID.aTrue,
      state_code: "TRUE",
      state_name: "True",
      probability: 1e-7,
      workbook_revision: 7,
      run_id: "run-1",
    });
    expect(rows[0]!.validation_issues).toContain("SOURCE_WARNING");
  });

  it("paginates every batch scenario and exports failures with blank probabilities", () => {
    const scenarios = Array.from({ length: 27 }, (_, index) => ({
      scenarioId: `s-${index}`,
      scenarioCode: `C-${index}`,
      scenarioName: `Named scenario ${index}`,
      status: "SUCCEEDED" as const,
      failure: null,
      result: bn,
    }));
    const result = {
      queryNodeId: TEST_ID.a,
      scenarios: [
        ...scenarios,
        {
          scenarioId: "failed",
          scenarioCode: "BAD",
          scenarioName: "Failed scenario",
          status: "FAILED" as const,
          failure: "Impossible evidence",
          result: null,
        },
      ],
    };
    render(
      <BayesianNetworkBatchResults
        batch={result}
        model={model}
      />,
    );
    expect(screen.queryByText("Named scenario 26")).not.toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "BN scenarios pagination" })).getByRole("button", { name: "Next" }),
    );
    expect(screen.getByText("Named scenario 26")).toBeInTheDocument();
    expect(screen.getByText("Impossible evidence")).toBeInTheDocument();
    const rows = bayesianBatchResultRecords(result, model);
    expect(rows).toHaveLength(55);
    expect(rows[54]).toMatchObject({
      status: "FAILED",
      scenario_name: "Failed scenario",
      failure: "Impossible evidence",
    });
    expect(rows[54]).not.toHaveProperty("probability");
  });

  it("paginates states and falls back to returned IDs for missing labels", () => {
    const result = {
      ...bn,
      marginals: Array.from({ length: 30 }, (_, index) => ({
        nodeId: `unknown-${index}`,
        values: bn.marginals[0]!.values,
      })),
    };
    render(
      <BayesianNetworkResults
        result={result}
        model={model}
      />,
    );
    expect(screen.getAllByRole("status")).toHaveLength(25);
    fireEvent.click(screen.getByRole("button", { name: "Last" }));
    expect(screen.getByText(`unknown-29 / ${TEST_ID.aTrue}`)).toBeInTheDocument();
  });
});

describe("probability and uncertainty result fidelity", () => {
  it("exports ordinary FT probability exactly, without retired calculations", () => {
    const rows = faultTreeResultRecords({
      ...common,
      topGateId: "top",
      topEventProbability: 1e-15,
      basicEventQuantifications: [],
    });
    expect(rows[0]).toMatchObject({ value: 1e-15, quantity: "top_event_probability", unit: "probability" });
    expect(JSON.stringify(rows)).not.toMatch(/cut.?set|importance/i);
  });

  it("shows all seven UQ statistics and their exact values", () => {
    renderHcl(ft, null, true);
    const region = within(screen.getByLabelText("Uncertainty results"));
    expect(region.getByText("Minimum")).toBeInTheDocument();
    expect(region.getByText("Maximum")).toBeInTheDocument();
    expect(region.getByTitle("1e-9")).toHaveTextContent("1.00E-09");
    expect(region.getByTitle("3e-7")).toHaveTextContent("3.00E-07");
    expect(region.getAllByRole("definition")).toHaveLength(7);
    expect(screen.getByText(/Review the input assumption/)).toBeInTheDocument();
  });

  it("exports every returned statistic and preserves the input result", () => {
    const before = JSON.stringify(ft);
    expect(hclResultRecords(ft, () => undefined)[0]).toMatchObject({
      value: ft.result.probability,
      sample_count: 100,
      seed: 42,
      mean: 1e-7,
      standard_deviation: 2e-8,
      minimum: 1e-9,
      percentile_05: 2e-9,
      median: 8e-8,
      percentile_95: 2e-7,
      maximum: 3e-7,
    });
    expect(JSON.stringify(ft)).toBe(before);
  });

  it("paginates HCL sequences and exports both quantities plus returned end states", () => {
    renderHcl(et);
    expect(screen.queryByText("seq-26")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("seq-26")).toBeInTheDocument();
    const rows = eventTreeResultRecords(et.result, () => undefined);
    expect(rows).toHaveLength(55);
    expect(rows[0]).toMatchObject({
      quantity: "conditional_probability",
      value: 1e-7,
      mean: 1e-7,
      unit: "probability",
    });
    expect(rows[1]).toMatchObject({ quantity: "annual_frequency", value: 1e-9, mean: 1e-9, unit: "/yr" });
    expect(rows[54]).toMatchObject({ row_type: "END_STATE", end_state_id: "end", value: 2.7e-8 });
  });

  it("shows both sequence UQ quantities and pages nested batch sequences", () => {
    renderHcl(null, batch([et]), true);
    expect(screen.getByLabelText("seq-0 conditional probability uncertainty results")).toHaveTextContent("1.00E-07");
    expect(screen.getByLabelText("seq-0 uncertainty results")).toHaveTextContent("1.00E-09/yr");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("seq-26 uncertainty results")).toBeInTheDocument();
  });

  it("does not mistake tiny probability differences for no variation", () => {
    renderHcl(
      null,
      batch([
        { ...ft, result: { ...ft.result, probability: 1e-15 } },
        { ...ft, result: { ...ft.result, probability: 2e-15 } },
      ]),
    );
    expect(screen.queryByText(/No variation/)).not.toBeInTheDocument();
  });

  it("compares UQ summaries when describing uncertainty variation", () => {
    renderHcl(null, batch([ft, { ...ft, result: { ...ft.result, uncertainty: { ...summary, maximum: 4e-7 } } }]), true);
    expect(screen.queryByText(/No variation/)).not.toBeInTheDocument();
  });

  it("paginates batch results and preserves failed and skipped rows", () => {
    const result = batch([...Array.from({ length: 26 }, () => ft), null, null]);
    result.scenarios[27]!.status = "SKIPPED";
    result.scenarios[27]!.failure = null;
    renderHcl(null, result);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Impossible evidence")).toBeInTheDocument();
    expect(screen.getByText("Skipped: zero hazard weight")).toBeInTheDocument();
    const rows = hclBatchResultRecords(result, () => undefined);
    expect(rows).toHaveLength(28);
    expect(rows[27]).toMatchObject({ status: "SKIPPED" });
    expect(rows[27]).not.toHaveProperty("value");
  });

  it("resolves transferred sequence names within their own model", () => {
    const result = {
      ...et,
      result: {
        ...et.result,
        sequences: [
          {
            ...et.result.sequences[0]!,
            sequenceChain: [
              { modelId: "tree-a", entityId: "same" },
              { modelId: "tree-b", entityId: "same" },
            ],
          },
        ],
      },
    };
    const rows = hclResultRecords(result, (tree) => (tree === "tree-a" ? "First tree" : "Second tree"));
    expect(rows[0]!.sequence_label).toBe("First tree → Second tree");
  });

  it("exports FT hazard values and zero-weight skips without replacing missing probabilities with zero", () => {
    const result = batch([ft, null]);
    result.scenarios[1]!.status = "SKIPPED";
    result.scenarios[1]!.failure = null;
    result.hazardConvolution = {
      targetKind: "FAULT_TREE",
      gridName: "PGA, α",
      normalizeWeights: false,
      annualFrequencyScale: { value: 2, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8760 } },
      annualizedFrequencyScale: 2,
      rawWeightSum: 0.3,
      convolutionWeightSum: 0.3,
      convolvedProbability: 0.0000000370370367037037,
      integratedAnnualFrequency: 0.0000000740740734074074,
      rows: [
        {
          scenarioId: "scenario-0",
          status: "ok",
          rawWeight: 0.3,
          normalizedWeight: 1,
          convolutionWeight: 0.3,
          annualFrequency: 0.6,
          conditionalProbability: 0.00000012345678901234568,
          probabilityContribution: 0.0000000370370367037037,
          annualContribution: 0.0000000740740734074074,
        },
        {
          scenarioId: "scenario-1",
          status: "skipped_zero_weight",
          rawWeight: 0,
          normalizedWeight: 0,
          convolutionWeight: 0,
          annualFrequency: 0,
          conditionalProbability: null,
          probabilityContribution: 0,
          annualContribution: 0,
        },
      ],
    };
    const before = JSON.stringify(result);
    const rows = hclBatchResultRecords(result, () => undefined);
    expect(rows).toHaveLength(5);
    expect(rows[2]).toMatchObject({
      grid_name: "PGA, α",
      raw_weight: 0.3,
      convolution_weight: 0.3,
      conditional_probability: 0.00000012345678901234568,
      annual_contribution: 0.0000000740740734074074,
    });
    expect(rows[3]).toMatchObject({
      status: "skipped_zero_weight",
      conditional_probability: null,
      annual_contribution: 0,
    });
    expect(rows[4]).toMatchObject({
      row_type: "INTEGRATED",
      integrated_annual_frequency: result.hazardConvolution.integratedAnnualFrequency,
    });
    expect(JSON.stringify(result)).toBe(before);
  });

  it("exports ET hazard contributions and each returned aggregate without calculating new totals", () => {
    const result = batch([et]);
    result.kind = "EVENT_TREE";
    result.hazardConvolution = {
      targetKind: "EVENT_TREE",
      gridName: "Hazard",
      normalizeWeights: true,
      annualFrequencyScale: { value: 1, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8760 } },
      annualizedFrequencyScale: 1,
      rawWeightSum: 0.3,
      convolutionWeightSum: 1,
      rows: [
        {
          scenarioId: "scenario-0",
          status: "ok",
          rawWeight: 0.3,
          normalizedWeight: 1,
          convolutionWeight: 1,
          annualFrequency: 1,
          sequences: [
            {
              sequenceId: "seq-0",
              conditionalProbability: 1e-7,
              probabilityContribution: 1e-7,
              annualContribution: 1e-7,
            },
          ],
        },
      ],
      sequences: [{ sequenceId: "seq-0", convolvedProbability: 1e-7, integratedAnnualFrequency: 1e-7 }],
      endStateAggregates: [{ endStateId: "end", convolvedProbability: 1e-7, integratedAnnualFrequency: 1e-7 }],
    };
    const rows = hclBatchResultRecords(result, () => undefined);
    expect(rows).toHaveLength(58);
    expect(rows[55]).toMatchObject({
      row_type: "HAZARD_BIN_SEQUENCE",
      sequence_id: "seq-0",
      annual_contribution: 1e-7,
    });
    expect(rows[56]).toMatchObject({ row_type: "INTEGRATED_SEQUENCE", integrated_annual_frequency: 1e-7 });
    expect(rows[57]).toMatchObject({
      row_type: "INTEGRATED_END_STATE",
      end_state_id: "end",
      integrated_annual_frequency: 1e-7,
    });
  });
});
