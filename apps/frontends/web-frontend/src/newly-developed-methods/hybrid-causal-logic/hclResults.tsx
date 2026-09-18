import { HclFaultTreeDiagnostics, HclCompilationDiagnostics } from "./hclDiagnostics";
import { useEffect, useId, useState } from "react";
import type { HclUncertaintySummary } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import type { HclBindingEditorProps, HclEditorBatchRunResult } from "./hclBindingTypes";
import { PagedResults, ResultCsvButton, ResultWarnings } from "../shared/resultPresentation";
import { hclResultRecords, hclBatchResultRecords } from "../shared/probabilityResultExport";
import { HclResultMetric, HclUncertaintyResults, formatScientific, formatPercentage } from "./hclResultMetrics";
import { HclEventTreeResults, endStateFrequency } from "./hclEventTreeResults";
import {
  HclHazardSummary,
  HclEventTreeHazardResults,
  HclHazardBinResults,
  hazardSequenceMatchesEndState,
  type HazardSequenceLookup,
} from "./hclHazardResults";
import { hclResultLabels, sequenceEndState } from "./hclResultLabels";

function summaryValues(summary?: HclUncertaintySummary): number[] {
  return summary === undefined ?
      []
    : [
        summary.mean,
        summary.standardDeviation,
        summary.minimum,
        summary.percentile05,
        summary.median,
        summary.percentile95,
        summary.maximum,
      ];
}

function batchHasNoNumericVariation(batch: HclEditorBatchRunResult, uncertainty: boolean): boolean {
  if (
    batch.scenarios.length < 2 ||
    batch.scenarios.some((scenario) => scenario.status !== "SUCCEEDED" || scenario.result === null)
  )
    return false;
  const vectors = batch.scenarios.map((scenario) => {
    const result = scenario.result!;
    if (result.kind === "FAULT_TREE")
      return uncertainty ? summaryValues(result.result.uncertainty) : [result.result.probability];
    return [
      ...[...result.result.sequences]
        .sort((left, right) => left.sequenceId.localeCompare(right.sequenceId))
        .flatMap((sequence) =>
          uncertainty ?
            [
              ...summaryValues(sequence.uncertainty?.conditionalProbability),
              ...summaryValues(sequence.uncertainty?.annualFrequency),
            ]
          : [sequence.conditionalProbability, sequence.annualFrequency],
        ),
      ...[...result.result.endStateAggregates]
        .sort((a, b) => a.endStateId.localeCompare(b.endStateId))
        .flatMap((state) => (uncertainty ? summaryValues(state.uncertainty) : [state.annualFrequency])),
    ];
  });
  const first = vectors[0]!;
  return (
    first.length > 0 &&
    vectors.every((vector) => vector.length === first.length && vector.every((value, index) => value === first[index]))
  );
}

export function HclResults({
  runResult,
  batchRunResult,
  workflow = "MANUAL",
  calculationType = "PROBABILITY",
  eventTreeOptions,
  faultTreeOptions,
}: Pick<
  HclBindingEditorProps,
  "runResult" | "batchRunResult" | "workflow" | "calculationType" | "eventTreeOptions" | "faultTreeOptions"
>) {
  const [selectedEndState, setSelectedEndState] = useState("");
  const selectionId = useId();
  const batchKey =
    JSON.stringify(batchRunResult?.scenarios.map((scenario) => [scenario.scenarioId, scenario.result?.result.runId])) ??
    "";
  const runKey = `${workflow}:${calculationType}:${workflow === "MANUAL" ? (runResult?.result.runId ?? "") : batchKey}`;
  useEffect(() => {
    setSelectedEndState("");
  }, [runKey]);
  const eventResults =
    workflow === "MANUAL" ?
      runResult?.kind === "EVENT_TREE" ?
        [runResult.result]
      : []
    : (batchRunResult?.scenarios.flatMap((scenario) =>
        scenario.result?.kind === "EVENT_TREE" ? [scenario.result.result] : [],
      ) ?? []);
  const labels = hclResultLabels(eventTreeOptions, eventResults);
  const hazard =
    workflow === "BATCH" && calculationType === "PROBABILITY" ? batchRunResult?.hazardConvolution : undefined;
  const endStateIds = [
    ...new Set([
      ...eventResults.flatMap((result) => [
        ...result.endStateAggregates.map((state) => state.endStateId),
        ...result.sequences.flatMap((sequence) => {
          const state = sequenceEndState(sequence);
          return state === undefined ? [] : [state];
        }),
      ]),
      ...(hazard?.targetKind === "EVENT_TREE" ? hazard.endStateAggregates.map((state) => state.endStateId) : []),
    ]),
  ].sort((a, b) => labels.endStateName(a).localeCompare(labels.endStateName(b)));
  const selected = endStateIds.includes(selectedEndState) ? selectedEndState : "";
  const sequences: HazardSequenceLookup = new Map(
    eventResults.flatMap((result) =>
      result.sequences.map((sequence) => [sequence.sequenceId, { sequence, modelId: result.owner.modelId }] as const),
    ),
  );
  const noVariation =
    batchRunResult !== null &&
    hazard === undefined &&
    batchHasNoNumericVariation(batchRunResult, calculationType === "UNCERTAINTY");
  const outcomeLabel = selected === "" ? "All outcomes" : labels.endStateName(selected);
  return (
    <>
      {endStateIds.length > 0 && (
        <div className="analysis-results__toolbar hcleditor__end-state-filter">
          <label htmlFor={selectionId}>
            End state{" "}
            <select
              id={selectionId}
              value={selected}
              onChange={(event) => setSelectedEndState(event.target.value)}
            >
              <option value="">All outcomes</option>
              {endStateIds.map((id) => (
                <option
                  key={id}
                  value={id}
                >
                  {labels.endStateName(id)}
                </option>
              ))}
            </select>
          </label>
          <small>CSV exports all outcomes.</small>
        </div>
      )}
      {workflow === "MANUAL" && runResult?.kind === "FAULT_TREE" && (
        <div
          className="hcleditor__analysis-result"
          aria-label="HCL fault-tree result"
        >
          <div className="analysis-results__toolbar">
            <strong>
              {faultTreeOptions.find(
                (option) =>
                  option.modelId === runResult.result.faultTreeTopGate.modelId &&
                  option.workbookId === runResult.result.faultTreeTopGate.workbookId,
              )?.modelName ?? runResult.result.faultTreeTopGate.modelId}
            </strong>
            <ResultCsvButton
              filename={`hcl-${runResult.result.runId}.csv`}
              records={() => hclResultRecords(runResult, labels.sequenceName)}
            />
          </div>
          <ResultWarnings issues={runResult.result.validationIssues} />
          {calculationType === "PROBABILITY" ?
            <div className="hcleditor__result-grid hcleditor__result-grid--single">
              <HclResultMetric
                label="Top event probability"
                value={formatScientific(runResult.result.probability)}
                exactValue={runResult.result.probability}
                ratio={runResult.result.probability}
              />
            </div>
          : <HclUncertaintyResults summary={runResult.result.uncertainty} />}
          <HclFaultTreeDiagnostics result={runResult.result} />
          {runResult.result.compilationReuse !== undefined && <HclCompilationDiagnostics stats={runResult.result.compilationReuse} />}
        </div>
      )}
      {workflow === "MANUAL" && runResult?.kind === "EVENT_TREE" && (
        <div
          className="hcleditor__batch-result"
          aria-label="HCL event-tree result"
        >
          <div className="hcleditor__batch-heading">
            <strong>Event-tree results</strong>
            <ResultCsvButton
              filename={`hcl-${runResult.result.runId}.csv`}
              records={() => hclResultRecords(runResult, labels.sequenceName)}
            />
            <span>{runResult.result.sequences.length} sequences calculated</span>
          </div>
          <ResultWarnings issues={runResult.result.validationIssues} />
          {runResult.result.compilationReuse !== undefined && <HclCompilationDiagnostics stats={runResult.result.compilationReuse} />}
          <HclEventTreeResults
            result={runResult.result}
            calculationType={calculationType}
            selectedEndState={selected}
            labels={labels}
          />
        </div>
      )}
      {workflow === "BATCH" && batchRunResult !== null && (
        <div
          className="hcleditor__batch-result"
          aria-label="HCL scenario batch result"
        >
          <div className="hcleditor__batch-heading">
            <strong>{hazard === undefined ? "Scenario results" : "Hazard convolution"}</strong>
            <ResultCsvButton
              filename="hcl-batch-results.csv"
              records={() => hclBatchResultRecords(batchRunResult, labels.sequenceName)}
            />
            <span>
              {batchRunResult.scenarios.filter((scenario) => scenario.status === "SUCCEEDED").length} of{" "}
              {batchRunResult.scenarios.length} completed{noVariation ? " · No variation across scenarios" : ""}
            </span>
          </div>
          <HclCompilationDiagnostics key={batchKey} stats={batchRunResult.compilationReuse} />
          {hazard !== undefined && <HclHazardSummary hazard={hazard} />}
          {hazard?.targetKind === "EVENT_TREE" && (
            <HclEventTreeHazardResults
              hazard={hazard}
              selectedEndState={selected}
              sequences={sequences}
              labels={labels}
              resetKey={batchKey}
            />
          )}
          <PagedResults
            items={batchRunResult.scenarios}
            label="HCL scenarios"
            resetKey={`${batchKey}:${selected}`}
          >
            {(page) => (
              <div className="hcleditor__batch-table">
                {page.map((scenario) => {
                  const result = scenario.result;
                  const eventHazardRow =
                    hazard?.targetKind === "EVENT_TREE" ?
                      hazard.rows.find((row) => row.scenarioId === scenario.scenarioId)
                    : undefined;
                  const failedOrSkipped =
                    scenario.status === "SKIPPED" ?
                      "Skipped: zero hazard weight"
                    : (scenario.failure ?? scenario.status);
                  if (
                    calculationType === "PROBABILITY" &&
                    result?.kind !== "EVENT_TREE" &&
                    eventHazardRow === undefined
                  ) {
                    const ft = result?.kind === "FAULT_TREE" ? result.result : undefined;
                    const row =
                      hazard?.targetKind === "FAULT_TREE" ?
                        hazard.rows.find((candidate) => candidate.scenarioId === scenario.scenarioId)
                      : undefined;
                    const value =
                      scenario.status !== "SUCCEEDED" || ft === undefined ? failedOrSkipped
                      : row === undefined ? formatScientific(ft.probability)
                      : `${formatScientific(row.annualContribution)}/yr`;
                    return (
                      <div
                        key={scenario.scenarioId}
                        className="hcleditor__scenario-analysis"
                      >
                        <HclResultMetric
                          label={scenario.scenarioCode}
                          value={value}
                          exactValue={
                            scenario.status === "SUCCEEDED" ? (row?.annualContribution ?? ft?.probability) : undefined
                          }
                          ratio={
                            scenario.status === "SUCCEEDED" ? (row?.convolutionWeight ?? ft?.probability) : undefined
                          }
                          detail={
                            row === undefined ?
                              scenario.scenarioName
                            : `${scenario.scenarioName} · ${formatPercentage(row.convolutionWeight)} weight`
                          }
                        />
                        {result !== null && <ResultWarnings issues={result.result.validationIssues} />}
                        {ft !== undefined && <HclFaultTreeDiagnostics result={ft} />}
                      </div>
                    );
                  }
                  let summary = failedOrSkipped;
                  if (result?.kind === "FAULT_TREE")
                    summary =
                      result.result.uncertainty === undefined ?
                        "No uncertainty result"
                      : `Mean ${formatScientific(result.result.uncertainty.mean)}`;
                  if (result?.kind === "EVENT_TREE") {
                    const count = result.result.sequences.filter(
                      (sequence) => selected === "" || sequenceEndState(sequence) === selected,
                    ).length;
                    const frequency = endStateFrequency(result.result, selected);
                    summary =
                      eventHazardRow !== undefined ?
                        `${eventHazardRow.sequences.filter((row) => hazardSequenceMatchesEndState(row.sequenceId, selected, sequences)).length} sequence contributions`
                      : calculationType === "UNCERTAINTY" ? `${count} ${count === 1 ? "sequence" : "sequences"}`
                      : frequency === undefined ? "No end-state result"
                      : `${outcomeLabel}: ${formatScientific(frequency)}/yr`;
                  }
                  return (
                    <details
                      key={scenario.scenarioId}
                      className="hcleditor__scenario-result"
                    >
                      <summary>
                        <span className="hcleditor__scenario-result-identity">
                          <strong>{scenario.scenarioCode}</strong>
                          <small>{scenario.scenarioName}</small>
                        </span>
                        <output>{summary}</output>
                      </summary>
                      <div className="hcleditor__scenario-result-body">
                        {scenario.failure !== null && <p className="bneditor__error">{scenario.failure}</p>}
                        {result !== null && <ResultWarnings issues={result.result.validationIssues} />}
                        {result?.kind === "FAULT_TREE" && calculationType === "UNCERTAINTY" && (
                          <HclUncertaintyResults
                            summary={result.result.uncertainty}
                            label="Statistics"
                            inline
                          />
                        )}
                        {result?.kind === "FAULT_TREE" && <HclFaultTreeDiagnostics result={result.result} />}
                        {eventHazardRow !== undefined && (
                          <HclHazardBinResults
                            row={eventHazardRow}
                            selectedEndState={selected}
                            sequences={sequences}
                            labels={labels}
                            resetKey={`${batchKey}:${scenario.scenarioId}`}
                          />
                        )}
                        {eventHazardRow !== undefined && result?.kind === "EVENT_TREE" && (
                          <p>
                            Scenario annual frequencies use the initiating-event frequency. Hazard contributions use the
                            grid's annual scale.
                          </p>
                        )}
                        {result?.kind === "EVENT_TREE" && (
                          <HclEventTreeResults
                            result={result.result}
                            calculationType={calculationType}
                            selectedEndState={selected}
                            labels={labels}
                            inline
                          />
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </PagedResults>
        </div>
      )}
    </>
  );
}
