import { HclSolverDiagnostics } from "./hclDiagnostics";
import type {
  EventTreeAnalysisResult,
  EventTreeEndStateAggregate,
  EventTreeSequenceAnalysisResult,
} from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { HclSampleVector } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import type { HclCalculationType } from "./hclBindingTypes";
import { eventTreeSequenceLabel } from "../event-tree/eventTreeResultLabels";
import { PagedResults } from "../shared/resultPresentation";
import { formatScientific, HclResultMetric, HclUncertaintyResults } from "./hclResultMetrics";
import { sequenceEndState } from "./hclResultLabels";

export interface HclEventTreeViewLabels {
  sequenceName: (modelId: string, sequenceId: string) => string | undefined;
  endStateName: (id: string) => string;
}

export function displayedSequenceName(
  sequence: EventTreeSequenceAnalysisResult,
  modelId: string,
  labels: HclEventTreeViewLabels,
): string {
  return eventTreeSequenceLabel(sequence, (treeId, id) => labels.sequenceName(treeId || modelId, id));
}

function unionText(state: EventTreeEndStateAggregate): string | undefined {
  if (state.sequenceSum === undefined) return undefined;
  return `Union of its sequences · sequence sum ${formatScientific(state.sequenceSum)}/yr${state.sequencesOverlap === true ? " · sequences overlap" : ""}`;
}

export function eventTreeSampleColumn(result: EventTreeAnalysisResult, labels: HclEventTreeViewLabels): (vector: HclSampleVector) => string {
  const sequences = new Map(result.sequences.map((sequence) => [sequence.sequenceId, sequence]));
  return (vector) => {
    if (vector.id === "initiator") return "Initiating event frequency /yr";
    const [kind = "", ...rest] = vector.id.split(":");
    const id = rest.join(":");
    if (kind === "sequence") {
      const sequence = sequences.get(id);
      return `${sequence === undefined ? id : displayedSequenceName(sequence, result.owner.modelId, labels)} conditional probability`;
    }
    if (kind === "endState") return `${labels.endStateName(id)} conditional probability`;
    return vector.id;
  };
}

/** All-outcome totals are display summaries only. Selected values come directly from returned aggregates. */
export function endStateFrequency(result: EventTreeAnalysisResult, selected: string): number | undefined {
  if (selected !== "") return result.endStateAggregates.find((state) => state.endStateId === selected)?.annualFrequency;
  if (result.endStateAggregates.length === 0) return undefined;
  return result.endStateAggregates.reduce((sum, state) => sum + state.annualFrequency, 0);
}

export function HclEventTreeResults({
  result,
  calculationType,
  selectedEndState,
  labels,
  inline = false,
}: {
  result: EventTreeAnalysisResult;
  calculationType: HclCalculationType;
  selectedEndState: string;
  labels: HclEventTreeViewLabels;
  inline?: boolean;
}) {
  const states = result.endStateAggregates.filter(
    (state) => selectedEndState === "" || state.endStateId === selectedEndState,
  );
  const sequences = result.sequences.filter(
    (sequence) => selectedEndState === "" || sequenceEndState(sequence) === selectedEndState,
  );
  const resetKey = `${result.runId}:${selectedEndState}:${calculationType}`;
  const total = endStateFrequency(result, selectedEndState);
  return (
    <div className="hcleditor__event-results">
      <section aria-label="End-state results">
        <h4>End-state results</h4>
        {calculationType === "PROBABILITY" && selectedEndState === "" && total !== undefined && (
          <HclResultMetric
            label="All outcomes"
            value={`${formatScientific(total)}/yr`}
            exactValue={total}
            detail="Annual frequency across all returned end states"
          />
        )}
        <PagedResults
          items={states}
          label="Dependency end states"
          resetKey={resetKey}
        >
          {(page) =>
            page.map((state) => {
              const union = unionText(state);
              return (
                <div
                  key={state.endStateId}
                  className="hcleditor__end-state-result"
                >
                  {calculationType === "PROBABILITY" ?
                    <HclResultMetric
                      label={labels.endStateName(state.endStateId)}
                      value={`${formatScientific(state.annualFrequency)}/yr`}
                      exactValue={state.annualFrequency}
                      detail={union ?? "End-state annual frequency"}
                    />
                  : <>
                      <HclUncertaintyResults
                        summary={state.uncertainty}
                        label={labels.endStateName(state.endStateId)}
                        annual
                        inline={inline}
                      />
                      {union !== undefined && <p className="analysis-results__identity">{union}</p>}
                    </>
                  }
                </div>
              );
            })
          }
        </PagedResults>
      </section>
      <section aria-label="Sequence results">
        <h4>
          Sequence results{" "}
          <small>
            {sequences.length} of {result.sequences.length} shown
          </small>
        </h4>
        <PagedResults
          items={sequences}
          label="Dependency sequences"
          resetKey={resetKey}
        >
          {(page) => (
            <div className="hcleditor__batch-table">
              {page.map((sequence) => {
                const name = displayedSequenceName(sequence, result.owner.modelId, labels);
                const endState = sequenceEndState(sequence);
                return (
                  <div
                    key={sequence.sequenceId}
                    className="hcleditor__sequence-analysis"
                  >
                    {calculationType === "PROBABILITY" ?
                      <HclResultMetric
                        label={name}
                        value={`${formatScientific(sequence.annualFrequency)}/yr`}
                        exactValue={sequence.annualFrequency}
                        ratio={sequence.conditionalProbability}
                        detail={`Conditional probability ${String(sequence.conditionalProbability)}`}
                      />
                    : <>
                        <HclUncertaintyResults
                          summary={sequence.uncertainty?.conditionalProbability}
                          label={`${name} conditional probability`}
                          inline={inline}
                        />
                        <HclUncertaintyResults
                          summary={sequence.uncertainty?.annualFrequency}
                          annual
                          label={name}
                          inline={inline}
                        />
                      </>
                    }
                    <p className="analysis-results__identity">
                      End state: {endState === undefined ? "Unavailable" : labels.endStateName(endState)}
                    </p>
                    <HclSolverDiagnostics key={result.runId} diagnostics={sequence.diagnostics} resetKey={`${result.runId}:${sequence.sequenceId}`} />
                  </div>
                );
              })}
            </div>
          )}
        </PagedResults>
      </section>
    </div>
  );
}
