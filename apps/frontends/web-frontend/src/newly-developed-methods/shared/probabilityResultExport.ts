import type { FaultTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import { stringifyJson } from "interfaces-shared-types/json";
import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type {
  HclQuantificationResult,
  HclUncertaintySummary,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import type { HclEditorBatchRunResult, HclEditorRunResult } from "../hybrid-causal-logic/hclBindingTypes";
import { eventTreeSequenceLabel } from "../event-tree/eventTreeResultLabels";
import type { ResultCsvRecord } from "./resultCsv";

type RunContext = Pick<FaultTreeAnalysisResult, "runId" | "owner" | "completedAt" | "validationIssues">;
export type SequenceName = (modelId: string, sequenceId: string) => string | undefined;

export function runCsvContext(result: RunContext): ResultCsvRecord {
  return {
    run_id: result.runId,
    workbook_id: result.owner.workbookId,
    model_id: result.owner.modelId,
    workbook_revision: result.owner.workbookRevision,
    completed_at: result.completedAt,
    status: "SUCCEEDED",
    validation_issues: result.validationIssues.length === 0 ? "" : JSON.stringify(result.validationIssues),
  };
}

function uncertaintyColumns(summary?: HclUncertaintySummary): ResultCsvRecord {
  if (summary === undefined) return {};
  return {
    sample_count: summary.sampleCount,
    seed: summary.seed,
    mean: summary.mean,
    standard_deviation: summary.standardDeviation,
    minimum: summary.minimum,
    percentile_05: summary.percentile05,
    median: summary.median,
    percentile_95: summary.percentile95,
    maximum: summary.maximum,
  };
}

export function faultTreeResultRecords(result: FaultTreeAnalysisResult): ResultCsvRecord[] {
  return [
    {
      ...runCsvContext(result),
      result_type: "FAULT_TREE",
      top_gate_id: result.topGateId,
      quantity: "top_event_probability",
      unit: "probability",
      value: result.topEventProbability,
    },
  ];
}

export function eventTreeResultRecords(result: EventTreeAnalysisResult, name: SequenceName): ResultCsvRecord[] {
  const context = {
    ...runCsvContext(result),
    result_type: "EVENT_TREE",
    frequency_semantics: result.frequencySemantics === undefined ? "" : JSON.stringify(result.frequencySemantics),
  };
  const rows = result.sequences.flatMap((sequence): ResultCsvRecord[] => {
    const identity = {
      ...context,
      row_type: "SEQUENCE",
      sequence_id: sequence.sequenceId,
      sequence_label: eventTreeSequenceLabel(sequence, (modelId, id) => name(modelId || result.owner.modelId, id)),
      sequence_chain: sequence.sequenceChain === undefined ? "" : JSON.stringify(sequence.sequenceChain),
      path: JSON.stringify(sequence.path),
      destination: JSON.stringify(sequence.result),
    };
    return [
      {
        ...identity,
        quantity: "conditional_probability",
        unit: "probability",
        value: sequence.conditionalProbability,
        ...uncertaintyColumns(sequence.uncertainty?.conditionalProbability),
      },
      {
        ...identity,
        quantity: "annual_frequency",
        unit: "/yr",
        value: sequence.annualFrequency,
        ...uncertaintyColumns(sequence.uncertainty?.annualFrequency),
      },
    ];
  });
  return [
    ...rows,
    ...result.endStateAggregates.map((endState) => ({
      ...context,
      row_type: "END_STATE",
      end_state_id: endState.endStateId,
      quantity: "annual_frequency",
      unit: "/yr",
      value: endState.annualFrequency,
      ...uncertaintyColumns(endState.uncertainty),
    })),
  ];
}

function hclFaultTreeRecords(result: HclQuantificationResult): ResultCsvRecord[] {
  return [
    {
      ...runCsvContext(result),
      result_type: "HCL_FAULT_TREE",
      target_workbook_id: result.faultTreeTopGate.workbookId,
      target_model_id: result.faultTreeTopGate.modelId,
      top_gate_id: result.faultTreeTopGate.entityId,
      quantity: "top_event_probability",
      unit: "probability",
      value: result.probability,
      ...uncertaintyColumns(result.uncertainty),
    },
  ];
}

export function hclResultRecords(result: HclEditorRunResult, name: SequenceName): ResultCsvRecord[] {
  return result.kind === "FAULT_TREE" ?
      hclFaultTreeRecords(result.result)
    : eventTreeResultRecords(result.result, name);
}

/** Export existing values only; do not sum sequences or recalculate hazard quantities. */
export function hclBatchResultRecords(batch: HclEditorBatchRunResult, name: SequenceName): ResultCsvRecord[] {
  const scenarios = new Map(batch.scenarios.map((row) => [row.scenarioId, row]));
  const scenarioIdentity = (id: string): ResultCsvRecord => {
    const scenario = scenarios.get(id);
    return { scenario_id: id, scenario_code: scenario?.scenarioCode, scenario_name: scenario?.scenarioName };
  };
  let rows: ResultCsvRecord[] = batch.scenarios.flatMap((scenario) => {
    const context = { ...scenarioIdentity(scenario.scenarioId), status: scenario.status, failure: scenario.failure };
    return scenario.result === null ?
        [context]
      : hclResultRecords(scenario.result, name).map((row) => ({ ...row, ...context }));
  });
  const hazard = batch.hazardConvolution;
  if (hazard === undefined) return rows;
  const context: ResultCsvRecord = {
    result_type: "HAZARD_CONVOLUTION",
    grid_name: hazard.gridName,
    annual_frequency_scale: hazard.annualizedFrequencyScale,
    annual_frequency_input: stringifyJson(hazard.annualFrequencyScale),
    normalize_weights: hazard.normalizeWeights,
    raw_weight_sum: hazard.rawWeightSum,
    convolution_weight_sum: hazard.convolutionWeightSum,
  };
  const weights = (row: (typeof hazard.rows)[number]): ResultCsvRecord => ({
    ...context,
    ...scenarioIdentity(row.scenarioId),
    status: row.status,
    raw_weight: row.rawWeight,
    normalized_weight: row.normalizedWeight,
    convolution_weight: row.convolutionWeight,
    annual_frequency: row.annualFrequency,
  });
  if (hazard.targetKind === "FAULT_TREE") {
    rows = rows.concat(
      hazard.rows.map((row) => ({
        ...weights(row),
        row_type: "HAZARD_BIN",
        conditional_probability: row.conditionalProbability,
        probability_contribution: row.probabilityContribution,
        annual_contribution: row.annualContribution,
      })),
    );
    rows = rows.concat({
      ...context,
      row_type: "INTEGRATED",
      convolved_probability: hazard.convolvedProbability,
      integrated_annual_frequency: hazard.integratedAnnualFrequency,
    });
  } else {
    rows = rows.concat(
      hazard.rows.flatMap((row) =>
        row.sequences.length === 0 ?
          [{ ...weights(row), row_type: "HAZARD_BIN" }]
        : row.sequences.map((sequence) => ({
            ...weights(row),
            row_type: "HAZARD_BIN_SEQUENCE",
            sequence_id: sequence.sequenceId,
            conditional_probability: sequence.conditionalProbability,
            probability_contribution: sequence.probabilityContribution,
            annual_contribution: sequence.annualContribution,
          })),
      ),
    );
    rows = rows.concat(
      hazard.sequences.map((sequence) => ({
        ...context,
        row_type: "INTEGRATED_SEQUENCE",
        sequence_id: sequence.sequenceId,
        convolved_probability: sequence.convolvedProbability,
        integrated_annual_frequency: sequence.integratedAnnualFrequency,
      })),
    );
    rows = rows.concat(
      hazard.endStateAggregates.map((endState) => ({
        ...context,
        row_type: "INTEGRATED_END_STATE",
        end_state_id: endState.endStateId,
        convolved_probability: endState.convolvedProbability,
        integrated_annual_frequency: endState.integratedAnnualFrequency,
      })),
    );
  }
  return rows;
}
