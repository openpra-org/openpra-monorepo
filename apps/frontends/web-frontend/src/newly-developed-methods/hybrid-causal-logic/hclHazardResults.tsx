import type { EventTreeSequenceAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type {
  HclEventTreeHazardConvolutionResult,
  HclHazardConvolutionResult,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import type { HclEventTreeViewLabels } from "./hclEventTreeResults";
import { displayedSequenceName } from "./hclEventTreeResults";
import { sequenceEndState } from "./hclResultLabels";
import { formatScientific, formatPercentage, HclResultMetric } from "./hclResultMetrics";
import { PagedResults, ResultNumber, formatResultNumber } from "../shared/resultPresentation";

export type HazardSequenceLookup = ReadonlyMap<string, { sequence: EventTreeSequenceAnalysisResult; modelId: string }>;

export function hazardSequenceMatchesEndState(id: string, selected: string, sequences: HazardSequenceLookup): boolean {
  const sequence = sequences.get(id)?.sequence;
  return selected === "" || (sequence !== undefined && sequenceEndState(sequence) === selected);
}

function sequenceEndStateIfKnown(id: string, sequences: HazardSequenceLookup): string | undefined {
  const sequence = sequences.get(id)?.sequence;
  return sequence === undefined ? undefined : sequenceEndState(sequence);
}

function sequenceIdentity(id: string, sequences: HazardSequenceLookup, labels: HclEventTreeViewLabels) {
  const source = sequences.get(id);
  const endState = source === undefined ? undefined : sequenceEndState(source.sequence);
  return {
    name: source === undefined ? id : displayedSequenceName(source.sequence, source.modelId, labels),
    endState: endState === undefined ? "Unavailable" : labels.endStateName(endState),
  };
}

export function HclHazardSummary({ hazard }: { hazard: HclHazardConvolutionResult }) {
  return (
    <div
      className="hcleditor__convolution-summary"
      aria-label="Hazard convolution summary"
    >
      <HclResultMetric
        label="Grid"
        value={hazard.gridName}
      />
      <HclResultMetric
        label="Covered probability"
        value={formatPercentage(hazard.rawWeightSum)}
        exactValue={hazard.rawWeightSum}
        ratio={hazard.rawWeightSum}
      />
      <HclResultMetric
        label="Annual scale"
        value={`${formatScientific(hazard.annualizedFrequencyScale)}/yr`}
        exactValue={hazard.annualizedFrequencyScale}
      />
      <HclResultMetric
        label="Weights"
        value={hazard.normalizeWeights ? "Normalized" : "Raw"}
        detail={`Applied weight sum ${String(hazard.convolutionWeightSum)}`}
      />
      {hazard.targetKind === "FAULT_TREE" && (
        <>
          <HclResultMetric
            label="Convolved probability"
            value={formatPercentage(hazard.convolvedProbability)}
            exactValue={hazard.convolvedProbability}
            ratio={hazard.convolvedProbability}
          />
          <HclResultMetric
            label="Integrated frequency"
            value={`${formatScientific(hazard.integratedAnnualFrequency)}/yr`}
            exactValue={hazard.integratedAnnualFrequency}
          />
        </>
      )}
    </div>
  );
}

export function HclEventTreeHazardResults({
  hazard,
  selectedEndState,
  sequences,
  labels,
  resetKey,
}: {
  hazard: HclEventTreeHazardConvolutionResult;
  selectedEndState: string;
  sequences: HazardSequenceLookup;
  labels: HclEventTreeViewLabels;
  resetKey: string;
}) {
  const states = hazard.endStateAggregates.filter(
    (state) => selectedEndState === "" || state.endStateId === selectedEndState,
  );
  const rows = hazard.sequences.filter((sequence) =>
    hazardSequenceMatchesEndState(sequence.sequenceId, selectedEndState, sequences),
  );
  const missingDestinations =
    selectedEndState !== "" &&
    hazard.sequences.some((row) => sequenceEndStateIfKnown(row.sequenceId, sequences) === undefined);
  const pageKey = `${resetKey}:${selectedEndState}`;
  const totalFrequency = states.reduce((sum, state) => sum + state.integratedAnnualFrequency, 0);
  const totalProbability = states.reduce((sum, state) => sum + state.convolvedProbability, 0);
  return (
    <div className="hcleditor__event-results">
      <section aria-label="Integrated end-state results">
        <h4>Integrated end-state results</h4>
        {selectedEndState === "" && states.length > 0 && (
          <HclResultMetric
            label="All outcomes"
            value={`${formatScientific(totalFrequency)}/yr`}
            exactValue={totalFrequency}
            detail={`Integrated annual frequency across all returned end states · Convolved probability ${formatResultNumber(totalProbability)}`}
          />
        )}
        <PagedResults
          items={states}
          label="Integrated end states"
          resetKey={pageKey}
        >
          {(page) => (
            <div className="hcleditor__result-table">
              <table>
                <thead>
                  <tr>
                    <th>End state</th>
                    <th>Convolved probability</th>
                    <th>Integrated frequency /yr</th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((state) => (
                    <tr key={state.endStateId}>
                      <th scope="row">{labels.endStateName(state.endStateId)}</th>
                      <td>
                        <ResultNumber value={state.convolvedProbability} />
                      </td>
                      <td>
                        <ResultNumber value={state.integratedAnnualFrequency} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PagedResults>
      </section>
      <section aria-label="Integrated sequence results">
        <h4>
          Integrated sequence results{" "}
          <small>
            {rows.length} of {hazard.sequences.length} shown
          </small>
        </h4>
        {missingDestinations && (
          <p>Some sequence destinations are unavailable. View All outcomes to inspect those rows.</p>
        )}
        <PagedResults
          items={rows}
          label="Integrated sequences"
          resetKey={pageKey}
        >
          {(page) => (
            <div className="hcleditor__result-table">
              <table>
                <thead>
                  <tr>
                    <th>Sequence</th>
                    <th>End state</th>
                    <th>Convolved probability</th>
                    <th>Integrated frequency /yr</th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((sequence) => {
                    const identity = sequenceIdentity(sequence.sequenceId, sequences, labels);
                    return (
                      <tr key={sequence.sequenceId}>
                        <th scope="row">{identity.name}</th>
                        <td>{identity.endState}</td>
                        <td>
                          <ResultNumber value={sequence.convolvedProbability} />
                        </td>
                        <td>
                          <ResultNumber value={sequence.integratedAnnualFrequency} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PagedResults>
      </section>
    </div>
  );
}

export function HclHazardBinResults({
  row,
  selectedEndState,
  sequences,
  labels,
  resetKey,
}: {
  row: HclEventTreeHazardConvolutionResult["rows"][number];
  selectedEndState: string;
  sequences: HazardSequenceLookup;
  labels: HclEventTreeViewLabels;
  resetKey: string;
}) {
  const rows = row.sequences.filter((sequence) =>
    hazardSequenceMatchesEndState(sequence.sequenceId, selectedEndState, sequences),
  );
  return (
    <section aria-label="Hazard-bin contributions">
      <h4>Hazard-bin contributions</h4>
      <div className="hcleditor__convolution-summary">
        <HclResultMetric
          label="Raw weight"
          value={formatPercentage(row.rawWeight)}
          exactValue={row.rawWeight}
        />
        <HclResultMetric
          label="Normalized weight"
          value={formatPercentage(row.normalizedWeight)}
          exactValue={row.normalizedWeight}
        />
        <HclResultMetric
          label="Applied weight"
          value={formatPercentage(row.convolutionWeight)}
          exactValue={row.convolutionWeight}
        />
        <HclResultMetric
          label="Bin frequency"
          value={`${formatScientific(row.annualFrequency)}/yr`}
          exactValue={row.annualFrequency}
        />
      </div>
      {row.status === "skipped_zero_weight" ?
        <p>Skipped: zero hazard weight</p>
      : <PagedResults
          items={rows}
          label="Hazard-bin sequences"
          resetKey={`${resetKey}:${selectedEndState}`}
        >
          {(page) => (
            <div className="hcleditor__result-table">
              <table>
                <thead>
                  <tr>
                    <th>Sequence</th>
                    <th>End state</th>
                    <th>Conditional probability</th>
                    <th>Probability contribution</th>
                    <th>Annual contribution /yr</th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((sequence) => {
                    const identity = sequenceIdentity(sequence.sequenceId, sequences, labels);
                    return (
                      <tr key={sequence.sequenceId}>
                        <th scope="row">{identity.name}</th>
                        <td>{identity.endState}</td>
                        <td>
                          <ResultNumber value={sequence.conditionalProbability} />
                        </td>
                        <td>
                          <ResultNumber value={sequence.probabilityContribution} />
                        </td>
                        <td>
                          <ResultNumber value={sequence.annualContribution} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PagedResults>
      }
    </section>
  );
}
