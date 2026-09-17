import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type {
  HclEventTreeHazardConvolutionResult,
  HclUncertaintySummary,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import type { HclEditorBatchRunResult, HclEventTreeOption } from "../hclBindingTypes";

export const endStateUq: HclUncertaintySummary = {
  sampleCount: 100,
  seed: 42,
  mean: 0.001,
  standardDeviation: 0.0002,
  minimum: 0.0001,
  percentile05: 0.0003,
  median: 0.0009,
  percentile95: 0.0019,
  maximum: 0.002,
};

export function eventResult(runId = "run-1"): EventTreeAnalysisResult {
  return {
    schemaVersion: "1.0.0",
    runId,
    owner: { workbookId: "esq", modelId: "tree", workbookRevision: 1 },
    mode: "HYBRID_CAUSAL_LOGIC",
    completedAt: "2026-09-11T00:00:00Z",
    validationIssues: [],
    sequences: [
      {
        sequenceId: "safe-seq",
        path: [],
        result: { kind: "END_STATE", endStateId: "safe" },
        conditionalProbability: 0.9,
        annualFrequency: 0.009,
      },
      {
        sequenceId: "release-a",
        path: [],
        result: { kind: "END_STATE", endStateId: "release" },
        conditionalProbability: 0.04,
        annualFrequency: 0.0004,
        uncertainty: {
          conditionalProbability: {
            ...endStateUq,
            mean: 0.04,
            standardDeviation: 0.03,
            minimum: 0.005,
            percentile05: 0.01,
            median: 0.035,
            percentile95: 0.1,
            maximum: 0.15,
          },
          annualFrequency: {
            ...endStateUq,
            mean: 0.0004,
            standardDeviation: 0.0003,
            minimum: 0.00005,
            percentile05: 0.0001,
            median: 0.00035,
            percentile95: 0.001,
            maximum: 0.0015,
          },
        },
      },
      {
        sequenceId: "release-b",
        path: [],
        result: { kind: "END_STATE", endStateId: "release" },
        conditionalProbability: 0.06,
        annualFrequency: 0.0006,
        uncertainty: {
          conditionalProbability: {
            ...endStateUq,
            mean: 0.06,
            standardDeviation: 0.04,
            minimum: 0.005,
            percentile05: 0.02,
            median: 0.055,
            percentile95: 0.15,
            maximum: 0.2,
          },
          annualFrequency: {
            ...endStateUq,
            mean: 0.0006,
            standardDeviation: 0.0004,
            minimum: 0.00005,
            percentile05: 0.0002,
            median: 0.00055,
            percentile95: 0.0015,
            maximum: 0.002,
          },
        },
      },
    ],
    endStateAggregates: [
      { endStateId: "safe", annualFrequency: 0.009 },
      { endStateId: "release", annualFrequency: 0.001, uncertainty: endStateUq },
    ],
  };
}

export const eventOption: HclEventTreeOption = {
  workbookId: "esq",
  workbookName: "ESQ",
  modelId: "tree",
  modelCode: "ET",
  modelName: "Plant",
  faultTrees: [],
  sequences: [
    { id: "safe-seq", name: "Mitigated" },
    { id: "release-a", name: "Pump failure" },
    { id: "release-b", name: "Power failure" },
  ],
  endStates: [
    { id: "safe", name: "Safe state" },
    { id: "release", name: "Release" },
  ],
};

export function eventBatch(): HclEditorBatchRunResult {
  return {
    kind: "EVENT_TREE",
    scenarios: [
      {
        scenarioId: "low",
        scenarioCode: "LOW",
        scenarioName: "Low PGA",
        status: "SUCCEEDED",
        failure: null,
        result: { kind: "EVENT_TREE", result: eventResult() },
      },
      {
        scenarioId: "high",
        scenarioCode: "HIGH",
        scenarioName: "High PGA",
        status: "SUCCEEDED",
        failure: null,
        result: { kind: "EVENT_TREE", result: eventResult("run-2") },
      },
    ],
  };
}

export function eventHazard(): HclEventTreeHazardConvolutionResult {
  return {
    targetKind: "EVENT_TREE",
    gridName: "PGA grid",
    normalizeWeights: false,
    annualFrequencyScale: { value: 0.01, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8760 } },
    annualizedFrequencyScale: 0.01,
    rawWeightSum: 0.8,
    convolutionWeightSum: 0.8,
    rows: [
      {
        scenarioId: "low",
        status: "ok",
        rawWeight: 0.3,
        normalizedWeight: 0.375,
        convolutionWeight: 0.3,
        annualFrequency: 0.003,
        sequences: [
          {
            sequenceId: "safe-seq",
            conditionalProbability: 0.9,
            probabilityContribution: 0.27,
            annualContribution: 0.0027,
          },
          {
            sequenceId: "release-a",
            conditionalProbability: 0.04,
            probabilityContribution: 0.012,
            annualContribution: 0.00012,
          },
          {
            sequenceId: "release-b",
            conditionalProbability: 0.06,
            probabilityContribution: 0.018,
            annualContribution: 0.00018,
          },
        ],
      },
      {
        scenarioId: "high",
        status: "ok",
        rawWeight: 0.5,
        normalizedWeight: 0.625,
        convolutionWeight: 0.5,
        annualFrequency: 0.005,
        sequences: [
          {
            sequenceId: "safe-seq",
            conditionalProbability: 0.9,
            probabilityContribution: 0.45,
            annualContribution: 0.0045,
          },
          {
            sequenceId: "release-a",
            conditionalProbability: 0.04,
            probabilityContribution: 0.02,
            annualContribution: 0.0002,
          },
          {
            sequenceId: "release-b",
            conditionalProbability: 0.06,
            probabilityContribution: 0.03,
            annualContribution: 0.0003,
          },
        ],
      },
    ],
    sequences: [
      { sequenceId: "safe-seq", convolvedProbability: 0.72, integratedAnnualFrequency: 0.0072 },
      { sequenceId: "release-a", convolvedProbability: 0.032, integratedAnnualFrequency: 0.00032 },
      { sequenceId: "release-b", convolvedProbability: 0.048, integratedAnnualFrequency: 0.00048 },
    ],
    endStateAggregates: [
      { endStateId: "safe", convolvedProbability: 0.72, integratedAnnualFrequency: 0.0072 },
      { endStateId: "release", convolvedProbability: 0.08, integratedAnnualFrequency: 0.0008 },
    ],
  };
}
