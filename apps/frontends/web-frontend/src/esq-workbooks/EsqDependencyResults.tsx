import { useEffect, useId, useState, type JSX } from "react";
import { z } from "zod";
import type { EsqModel } from "interfaces-mef-types/esq/event-sequence-quantification";
import { esqEndStateRunId, esqSequenceRunId } from "interfaces-mef-types/esq/esq-run-inputs";
import type { BaseLaw, MixtureLaw } from "interfaces-mef-types/core/uncertainty";
import type {
  EsqUncertaintyHistogram,
  EventTreeAnalysisResult,
  EventTreeSequenceAnalysisResult,
} from "interfaces-shared-types/newly-developed-methods/event-tree";
import type {
  HclDistributionFit,
  HclEventTreeHazardConvolutionResult,
  HclFitFamily,
  HclHazardExceedancePoint,
  HclSampleVector,
  HclUncertaintyAdjustments,
  HclUncertaintySummary,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import type { ValidationIssue } from "interfaces-shared-types/newly-developed-methods/shared";
import { getAnalysisRunSamples } from "../newly-developed-methods/shared/analysisRunWait";
import { hclBatchResultRecords, hclResultRecords } from "../newly-developed-methods/shared/probabilityResultExport";
import { downloadResultCsv, type ResultCsvRecord } from "../newly-developed-methods/shared/resultCsv";
import { PagedResults, ResultCsvButton, enumText } from "../newly-developed-methods/shared/resultPresentation";
import { lawText, numberText } from "../newly-developed-methods/shared/uncertainText";
import { DialogHead, DialogShell } from "../es-workbooks/EsScope";
import { jsonView, useWorkbookView } from "../workbooks/workbookViewMemory";
import { sciText, treeLabel, useElementWidth } from "./esqShared";
import { END_STATE_LABELS } from "./esqViewData";
import { EsqUncertaintyCard, type EsqUncertaintyDistribution } from "./esqUncertaintyResult";
import { useEsqWorkbook } from "./esqWorkbookContext";
import type { DependencyStudy, DependencyStudyTree } from "./EsqDependencies";
import "./css/esqSolveTabs.css";
import "./css/esqDependencies.css";

type DependencyOrder = "TREE" | "HIGH" | "LOW";

type DependencyWindow =
  | { kind: "sequence"; scenarioId: string; sequenceId: string }
  | { kind: "endState"; scenarioId: string; endStateId: string }
  | { kind: "curve"; endStateId: string }
  | { kind: "details" };

type HazardRow = HclEventTreeHazardConvolutionResult["rows"][number];

interface DependencyResultSettings {
  treeId: string;
  scenarioId: string;
  endStateId: string;
  order: DependencyOrder;
}

interface ScenarioEntry {
  id: string;
  code: string;
  name: string;
  status: string;
  failure: string | null;
  result: EventTreeAnalysisResult | null;
}

interface DependencyNames {
  sequence: (sequenceId: string) => string;
  endStateOf: (sequenceId: string) => string | undefined;
  endState: (endStateId: string) => string;
  step: (modelId: string, runId: string) => string | undefined;
}

interface DecadeRange {
  low: number;
  high: number;
}

const ORDERS: readonly (readonly [DependencyOrder, string])[] = [["TREE", "Tree order"], ["HIGH", "Frequency high to low"], ["LOW", "Frequency low to high"]];

const START: DependencyResultSettings = { treeId: "", scenarioId: "", endStateId: "", order: "TREE" };

const SETTINGS_VIEW = jsonView<DependencyResultSettings>(z.object({
  treeId: z.string(),
  scenarioId: z.string(),
  endStateId: z.string(),
  order: z.enum(["TREE", "HIGH", "LOW"]),
}));

const RESULT_TEXT: Record<DependencyStudy["result"], string> = { PROBABILITY: "Probability", UNCERTAINTY: "Uncertainty" };

const EVIDENCE_TEXT: Record<DependencyStudy["evidence"], string> = { BASE: "Base evidence", SCENARIOS: "Evidence scenarios", HAZARD: "Hazard convolution" };

const STATUS_TEXT: Record<string, string> = { SKIPPED: "Skipped, zero hazard weight", FAILED: "Failed", CANCELLED: "Cancelled", QUEUED: "Queued", RUNNING: "Running" };

const FIT_FAMILY_TEXT: Record<HclFitFamily, string> = {
  BETA: "Beta",
  LOGIT_NORMAL: "Logit-normal",
  ZERO_ONE_INFLATED_BETA: "Zero and one inflated beta",
  ZERO_ONE_INFLATED_LOGIT_NORMAL: "Zero and one inflated logit-normal",
  LOGNORMAL: "Lognormal",
  GAMMA: "Gamma",
  ZERO_INFLATED_LOGNORMAL: "Zero inflated lognormal",
  ZERO_INFLATED_GAMMA: "Zero inflated gamma",
};

const RELEASE = "RADIONUCLIDE_RELEASE";

const BIN_COUNT = 40;

const QUANTILE_STEPS = 100;

const CURVE_WIDTH = 640;
const CURVE_HEIGHT = 244;
const CURVE_LEFT = 64;
const CURVE_RIGHT_GAP = 24;
const CURVE_TOP = 12;
const CURVE_BASE = 210;

function scenariosOf(tree: DependencyStudyTree): ScenarioEntry[] {
  return (tree.batchRunResult?.scenarios ?? []).map((scenario) => ({
    id: scenario.scenarioId,
    code: scenario.scenarioCode,
    name: scenario.scenarioName,
    status: scenario.status,
    failure: scenario.failure,
    result: scenario.result?.kind === "EVENT_TREE" ? scenario.result.result : null,
  }));
}

function baseOf(tree: DependencyStudyTree): EventTreeAnalysisResult | null {
  return tree.runResult?.kind === "EVENT_TREE" ? tree.runResult.result : null;
}

function hazardOf(tree: DependencyStudyTree): HclEventTreeHazardConvolutionResult | undefined {
  const hazard = tree.batchRunResult?.hazardConvolution;
  return hazard?.targetKind === "EVENT_TREE" ? hazard : undefined;
}

function endStateText(state: string): string {
  return END_STATE_LABELS[state] ?? enumText(state);
}

function namesOf(model: EsqModel, results: readonly EventTreeAnalysisResult[]): DependencyNames {
  const records = new Map(model.sequences.map((record) => [esqSequenceRunId(record.treeId, record.id), record]));
  const entries = new Map<string, EventTreeSequenceAnalysisResult>();
  for (const result of results) {
    for (const entry of result.sequences) {
      if (!entries.has(entry.sequenceId)) entries.set(entry.sequenceId, entry);
    }
  }
  const endStates = new Map<string, string>();
  for (const record of model.sequences) {
    if (record.endState !== undefined) endStates.set(esqEndStateRunId(record.endState), endStateText(record.endState));
  }
  return {
    sequence: (sequenceId) => {
      const chain = entries.get(sequenceId)?.sequenceChain?.map((link) => link.entityId) ?? [sequenceId];
      const codes = chain.map((runId) => records.get(runId)?.code);
      return codes.every((code): code is string => code !== undefined) ? codes.join(" to ") : "Unnamed sequence";
    },
    endStateOf: (sequenceId) => {
      const target = entries.get(sequenceId)?.result;
      return target?.kind === "END_STATE" ? target.endStateId : undefined;
    },
    endState: (endStateId) => endStates.get(endStateId) ?? "Unnamed end state",
    step: (_modelId, runId) => records.get(runId)?.code,
  };
}

function ordered<T>(rows: readonly T[], order: DependencyOrder, value: (row: T) => number): T[] {
  if (order === "TREE") return [...rows];
  return [...rows].sort((left, right) => (order === "HIGH" ? value(right) - value(left) : value(left) - value(right)));
}

function shareText(fraction: number): string {
  if (!Number.isFinite(fraction)) return "Unavailable";
  if (fraction === 0) return "0%";
  return `${String(Number((100 * fraction).toPrecision(4)))}%`;
}

function countText(value: number): string {
  return value.toLocaleString();
}

function statusText(entry: ScenarioEntry): string {
  return STATUS_TEXT[entry.status] ?? enumText(entry.status);
}

function issueText(issue: ValidationIssue): string {
  return `${enumText(issue.severity)}: ${issue.message}`;
}

function labeled(record: ResultCsvRecord, names: DependencyNames): ResultCsvRecord {
  const sequenceId = record["sequence_id"];
  const endStateId = record["end_state_id"];
  return {
    ...record,
    ...(typeof sequenceId === "string" ? { sequence: names.sequence(sequenceId) } : {}),
    ...(typeof endStateId === "string" ? { end_state: names.endState(endStateId) } : {}),
  };
}

function quantileOf(sorted: Float64Array, share: number): number {
  if (sorted.length === 0) return 0;
  const position = share * (sorted.length - 1);
  const low = Math.floor(position);
  const high = Math.min(sorted.length - 1, low + 1);
  const weight = position - low;
  return (sorted[low] ?? 0) * (1 - weight) + (sorted[high] ?? 0) * weight;
}

function histogramOf(sorted: Float64Array): EsqUncertaintyHistogram | null {
  const positive = sorted.filter((value) => value > 0);
  if (positive.length === 0) return null;
  const smallest = positive[0] ?? 0;
  const largest = positive[positive.length - 1] ?? 0;
  const floor = Math.floor(Math.log10(smallest));
  const ceiling = Math.ceil(Math.log10(largest));
  const low = ceiling > floor ? floor : floor - 1;
  const high = ceiling > floor ? ceiling : floor + 1;
  const width = (high - low) / BIN_COUNT;
  const counts = new Array<number>(BIN_COUNT).fill(0);
  for (const value of positive) {
    const index = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor((Math.log10(value) - low) / width)));
    counts[index] = (counts[index] ?? 0) + 1;
  }
  return { low, high, counts, zeros: sorted.length - positive.length };
}

function initiatorPoint(result: EventTreeAnalysisResult): number | undefined {
  const declared = result.frequencySemantics?.annualizedInitiatingEventFrequency.value;
  if (declared !== undefined) return declared;
  const reference = result.sequences.find((entry) => entry.conditionalProbability > 0);
  return reference === undefined ? undefined : reference.annualFrequency / reference.conditionalProbability;
}

function frequencySamples(vectors: readonly HclSampleVector[], vectorId: string, initiator: number | undefined): number[] | undefined {
  const probabilities = vectors.find((vector) => vector.id === vectorId)?.values;
  if (probabilities === undefined) return undefined;
  const sampled = vectors.find((vector) => vector.id === "initiator")?.values;
  if (sampled === undefined && initiator === undefined) return undefined;
  return probabilities.map((probability, index) => probability * (sampled?.[index] ?? initiator ?? 0));
}

function distributionOf(label: string, point: number, values: readonly number[], summary: HclUncertaintySummary | undefined): EsqUncertaintyDistribution {
  const sorted = Float64Array.from(values).sort();
  const mean = values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
  return {
    label,
    point,
    mean: summary?.mean ?? mean,
    p05: summary?.percentile05 ?? quantileOf(sorted, 0.05),
    p50: summary?.median ?? quantileOf(sorted, 0.5),
    p95: summary?.percentile95 ?? quantileOf(sorted, 0.95),
    histogram: histogramOf(sorted),
    quantiles: Array.from({ length: QUANTILE_STEPS + 1 }, (_, step) => quantileOf(sorted, step / QUANTILE_STEPS)),
    trials: values.length,
    values,
  };
}

function sampleColumn(vector: HclSampleVector, names: DependencyNames): string {
  if (vector.id === "initiator") return "Initiating event frequency (/yr)";
  const [kind = "", ...rest] = vector.id.split(":");
  const id = rest.join(":");
  if (kind === "sequence") return `${names.sequence(id)} conditional probability`;
  if (kind === "endState") return `${names.endState(id)} conditional probability`;
  return vector.id;
}

function sampleRecords(vectors: readonly HclSampleVector[], names: DependencyNames): ResultCsvRecord[] {
  const used = new Set<string>();
  const columns = vectors.map((vector) => {
    const base = sampleColumn(vector, names);
    let name = base;
    let copy = 2;
    while (used.has(name)) {
      name = `${base} ${String(copy)}`;
      copy += 1;
    }
    used.add(name);
    return { name, values: vector.values };
  });
  const length = Math.max(0, ...vectors.map((vector) => vector.values.length));
  return Array.from({ length }, (_, index) => {
    const record: ResultCsvRecord = { sample: index + 1 };
    for (const column of columns) record[column.name] = column.values[index];
    return record;
  });
}

function adjustmentsText(adjustments: HclUncertaintyAdjustments | undefined): string {
  if (adjustments === undefined) return "";
  return [
    adjustments.clippedProbabilities > 0 ? `${countText(adjustments.clippedProbabilities)} sampled probabilities clipped to 0 or 1` : "",
    adjustments.epsilonAdjustedCptValues > 0 ? `${countText(adjustments.epsilonAdjustedCptValues)} CPT values raised to the CPT floor` : "",
    adjustments.zeroProbabilityContexts > 0 ? `${countText(adjustments.zeroProbabilityContexts)} zero-probability contexts counted as 0` : "",
  ].filter((part) => part.length > 0).join(" · ");
}

function fitLawText(law: BaseLaw | MixtureLaw): string {
  if (law.family !== "MIXTURE") return lawText(law);
  return law.components
    .map((component) => (component.law.family === "POINT" ? `${numberText(component.weight)} at ${numberText(component.law.value)}` : `${numberText(component.weight)} × ${lawText(component.law)}`))
    .join(" + ");
}

function decadeRange(values: readonly number[]): DecadeRange | undefined {
  const positive = values.filter((value) => value > 0 && Number.isFinite(value));
  if (positive.length === 0) return undefined;
  const low = Math.floor(Math.log10(Math.min(...positive)));
  const high = Math.ceil(Math.log10(Math.max(...positive)));
  return high > low ? { low, high } : { low: low - 1, high: low + 1 };
}

function decadeTicks(range: DecadeRange): number[] {
  const span = range.high - range.low;
  const step = span > 8 ? 2 : 1;
  return Array.from({ length: Math.floor(span / step) + 1 }, (_, index) => range.low + index * step);
}

function useRunSamples(runId: string): { vectors?: HclSampleVector[]; error?: string } {
  const { runtime } = useEsqWorkbook();
  const [state, setState] = useState<{ runId: string; vectors?: HclSampleVector[]; error?: string } | null>(null);
  useEffect(() => {
    const workbookId = runtime.workbookId;
    if (workbookId === null) return undefined;
    let cancelled = false;
    getAnalysisRunSamples("esq", workbookId, runId)
      .then((vectors) => { if (!cancelled) setState({ runId, vectors }); })
      .catch((caught: Error) => { if (!cancelled) setState({ runId, error: caught.message }); });
    return () => { cancelled = true; };
  }, [runtime.workbookId, runId]);
  return state !== null && state.runId === runId ? state : {};
}

function StatHeads(): JSX.Element {
  return (
    <>
      <th scope="col">Point estimate</th>
      <th scope="col">Mean</th>
      <th scope="col">5th percentile</th>
      <th scope="col">Median</th>
      <th scope="col">95th percentile</th>
    </>
  );
}

function StatCells({ point, summary }: { point: number; summary: HclUncertaintySummary | undefined }): JSX.Element {
  return (
    <>
      <td className="esq-dep__number-cell">{sciText(point)}</td>
      <td className="esq-dep__number-cell">{summary === undefined ? "None" : sciText(summary.mean)}</td>
      <td className="esq-dep__number-cell">{summary === undefined ? "None" : sciText(summary.percentile05)}</td>
      <td className="esq-dep__number-cell">{summary === undefined ? "None" : sciText(summary.median)}</td>
      <td className="esq-dep__number-cell">{summary === undefined ? "None" : sciText(summary.percentile95)}</td>
    </>
  );
}

function FactsTable({ label, rows }: { label: string; rows: readonly (readonly [string, string])[] }): JSX.Element {
  return (
    <table className="postable postable--mid es-records esq-results esq-dep__table esq-dep__facts" aria-label={label}>
      <tbody>
        {rows.map(([name, value]) => (
          <tr key={name}>
            <th scope="row">{name}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Issues({ issues }: { issues: readonly ValidationIssue[] }): JSX.Element | null {
  if (issues.length === 0) return null;
  return (
    <ul className="esq-dep__issues" aria-label="Run validation issues">
      {issues.map((issue, index) => <li key={`${issue.code}:${String(index)}`}>{issueText(issue)}</li>)}
    </ul>
  );
}

function EndStateTable({ result, uncertainty, names, onOpen }: { result: EventTreeAnalysisResult; uncertainty: boolean; names: DependencyNames; onOpen: (endStateId: string) => void }): JSX.Element | null {
  const states = [...result.endStateAggregates].sort((left, right) => names.endState(left.endStateId).localeCompare(names.endState(right.endStateId)));
  if (states.length === 0) return null;
  return (
    <section className="esq-dep__section" aria-label="End states">
      <h4 className="esq-dep__title">End states</h4>
      <table className="postable postable--mid es-records esq-results esq-dep__table" aria-label="End states">
        <thead><tr><th scope="col">End state</th>{uncertainty ? <StatHeads /> : <th scope="col">Frequency (/yr)</th>}</tr></thead>
        <tbody>
          {states.map((state) => {
            const name = names.endState(state.endStateId);
            const overlap = state.sequencesOverlap === true && state.sequenceSum !== undefined ? `The sequences overlap, their sum is ${sciText(state.sequenceSum)}` : "";
            return (
              <tr key={state.endStateId}>
                <td>
                  {uncertainty
                    ? <button type="button" className="es-records__link" aria-label={`Distribution of ${name}`} onClick={() => onOpen(state.endStateId)}>{name}</button>
                    : <span className="postable__name">{name}</span>}
                  {overlap.length > 0 && <span className="postable__name-sub">{overlap}</span>}
                </td>
                {uncertainty ? <StatCells point={state.annualFrequency} summary={state.uncertainty} /> : <td className="esq-dep__number-cell">{sciText(state.annualFrequency)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function SequenceTable({ result, uncertainty, names, order, resetKey, onOpen }: {
  result: EventTreeAnalysisResult;
  uncertainty: boolean;
  names: DependencyNames;
  order: DependencyOrder;
  resetKey: string;
  onOpen: (sequenceId: string) => void;
}): JSX.Element | null {
  const rows = ordered(result.sequences, order, (entry) => entry.annualFrequency);
  if (rows.length === 0) return null;
  return (
    <section className="esq-dep__section" aria-label="Sequences">
      <h4 className="esq-dep__title">Sequences</h4>
      <PagedResults items={rows} label="Dependency sequences" resetKey={resetKey}>
        {(page) => (
          <table className="postable postable--mid es-records esq-results esq-dep__table" aria-label="Sequences">
            <thead>
              <tr>
                <th scope="col">Sequence</th>
                {uncertainty ? <StatHeads /> : <><th scope="col">Conditional probability</th><th scope="col">Frequency (/yr)</th></>}
              </tr>
            </thead>
            <tbody>
              {page.map((entry) => {
                const name = names.sequence(entry.sequenceId);
                const endState = entry.result.kind === "END_STATE" ? names.endState(entry.result.endStateId) : "";
                return (
                  <tr key={entry.sequenceId}>
                    <td>
                      {uncertainty
                        ? <button type="button" className="es-records__link" aria-label={`Distribution of ${name}`} onClick={() => onOpen(entry.sequenceId)}>{name}</button>
                        : <span className="postable__name">{name}</span>}
                      {endState.length > 0 && <span className="postable__name-sub">{endState}</span>}
                    </td>
                    {uncertainty ? <StatCells point={entry.annualFrequency} summary={entry.uncertainty?.annualFrequency} /> : (
                      <>
                        <td className="esq-dep__number-cell">{sciText(entry.conditionalProbability)}</td>
                        <td className="esq-dep__number-cell">{sciText(entry.annualFrequency)}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </PagedResults>
    </section>
  );
}

function ScenarioOverview({ scenarios, uncertainty, endStateId, names, order, resetKey, onPick }: {
  scenarios: readonly ScenarioEntry[];
  uncertainty: boolean;
  endStateId: string;
  names: DependencyNames;
  order: DependencyOrder;
  resetKey: string;
  onPick: (scenarioId: string) => void;
}): JSX.Element | null {
  if (scenarios.length === 0) return null;
  const valueOf = (entry: ScenarioEntry): EventTreeAnalysisResult["endStateAggregates"][number] | undefined => entry.result?.endStateAggregates.find((state) => state.endStateId === endStateId);
  const rows = ordered(scenarios, order, (entry) => valueOf(entry)?.annualFrequency ?? -1);
  const endState = endStateId.length === 0 ? "End state" : names.endState(endStateId);
  const span = uncertainty ? 5 : 1;
  return (
    <section className="esq-dep__section" aria-label="Scenarios">
      <h4 className="esq-dep__title">{`${endState} by scenario`}</h4>
      <PagedResults items={rows} label="Dependency scenarios" resetKey={resetKey}>
        {(page) => (
          <table className="postable postable--mid es-records esq-results esq-dep__table" aria-label={`${endState} by scenario`}>
            <thead><tr><th scope="col">Scenario</th>{uncertainty ? <StatHeads /> : <th scope="col">{`${endState} (/yr)`}</th>}</tr></thead>
            <tbody>
              {page.map((entry) => {
                const value = valueOf(entry);
                return (
                  <tr key={entry.id}>
                    <td>
                      {entry.result === null
                        ? <span className="postable__name">{entry.code}</span>
                        : <button type="button" className="es-records__link" aria-label={`Results of ${entry.code}`} onClick={() => onPick(entry.id)}>{entry.code}</button>}
                      {entry.name !== entry.code && <span className="postable__name-sub">{entry.name}</span>}
                    </td>
                    {entry.result === null ? (
                      <td colSpan={span}>
                        <span className="esq-dep__flag">{statusText(entry)}</span>
                        {entry.failure !== null && <span className="postable__name-sub">{entry.failure}</span>}
                      </td>
                    ) : value === undefined ? <td colSpan={span}>None</td>
                      : uncertainty ? <StatCells point={value.annualFrequency} summary={value.uncertainty} />
                      : <td className="esq-dep__number-cell">{sciText(value.annualFrequency)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </PagedResults>
    </section>
  );
}

function cellContribution(row: HazardRow, endStateId: string, names: DependencyNames): number {
  return row.sequences.reduce((total, entry) => (names.endStateOf(entry.sequenceId) === endStateId ? total + entry.annualContribution : total), 0);
}

function HazardOverview({ hazard, scenarios, endStateId, names, order, resetKey, onPick, onCurve }: {
  hazard: HclEventTreeHazardConvolutionResult;
  scenarios: readonly ScenarioEntry[];
  endStateId: string;
  names: DependencyNames;
  order: DependencyOrder;
  resetKey: string;
  onPick: (scenarioId: string) => void;
  onCurve: (endStateId: string) => void;
}): JSX.Element {
  const scenarioOf = new Map(scenarios.map((entry) => [entry.id, entry]));
  const states = [...hazard.endStateAggregates].sort((left, right) => names.endState(left.endStateId).localeCompare(names.endState(right.endStateId)));
  const curves = states.some((state) => (state.exceedance ?? []).length > 0);
  const sequences = ordered(hazard.sequences, order, (entry) => entry.integratedAnnualFrequency);
  const cells = ordered(hazard.rows, order, (row) => cellContribution(row, endStateId, names));
  const endState = endStateId.length === 0 ? "End state" : names.endState(endStateId);
  return (
    <>
      <section className="esq-dep__section" aria-label="Hazard grid">
        <h4 className="esq-dep__title">Hazard grid</h4>
        <FactsTable label="Hazard grid" rows={[
          ["Grid", hazard.gridName],
          ["Covered probability", shareText(hazard.rawWeightSum)],
          ["Annual scale", `${sciText(hazard.annualizedFrequencyScale)} per year`],
          ["Weights", `${hazard.normalizeWeights ? "Normalized" : "Raw"}, applied weights sum to ${shareText(hazard.convolutionWeightSum)}`],
        ]} />
      </section>
      {states.length > 0 && (
        <section className="esq-dep__section" aria-label="End states over the grid">
          <h4 className="esq-dep__title">End states over the grid</h4>
          <table className="postable postable--mid es-records esq-results esq-dep__table" aria-label="End states over the grid">
            <thead>
              <tr>
                <th scope="col">End state</th>
                <th scope="col">Convolved probability</th>
                <th scope="col">Integrated frequency (/yr)</th>
                {curves && <th scope="col" className="es-records__act" aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {states.map((state) => {
                const name = names.endState(state.endStateId);
                return (
                  <tr key={state.endStateId}>
                    <td><span className="postable__name">{name}</span></td>
                    <td className="esq-dep__number-cell">{sciText(state.convolvedProbability)}</td>
                    <td className="esq-dep__number-cell">{sciText(state.integratedAnnualFrequency)}</td>
                    {curves && (
                      <td className="es-records__act">
                        {(state.exceedance ?? []).length > 0 && <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Exceedance curve of ${name}`} onClick={() => onCurve(state.endStateId)}>Curve</button>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      {sequences.length > 0 && (
        <section className="esq-dep__section" aria-label="Sequences over the grid">
          <h4 className="esq-dep__title">Sequences over the grid</h4>
          <PagedResults items={sequences} label="Dependency grid sequences" resetKey={resetKey}>
            {(page) => (
              <table className="postable postable--mid es-records esq-results esq-dep__table" aria-label="Sequences over the grid">
                <thead><tr><th scope="col">Sequence</th><th scope="col">Convolved probability</th><th scope="col">Integrated frequency (/yr)</th></tr></thead>
                <tbody>
                  {page.map((entry) => {
                    const target = names.endStateOf(entry.sequenceId);
                    return (
                      <tr key={entry.sequenceId}>
                        <td>
                          <span className="postable__name">{names.sequence(entry.sequenceId)}</span>
                          {target !== undefined && <span className="postable__name-sub">{names.endState(target)}</span>}
                        </td>
                        <td className="esq-dep__number-cell">{sciText(entry.convolvedProbability)}</td>
                        <td className="esq-dep__number-cell">{sciText(entry.integratedAnnualFrequency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </PagedResults>
        </section>
      )}
      {cells.length > 0 && (
        <section className="esq-dep__section" aria-label="Cells">
          <h4 className="esq-dep__title">Cells</h4>
          <PagedResults items={cells} label="Dependency grid cells" resetKey={`${resetKey}:${endStateId}`}>
            {(page) => (
              <table className="postable postable--mid es-records esq-results esq-dep__table" aria-label="Cells">
                <thead><tr><th scope="col">Cell</th><th scope="col">Weight</th><th scope="col">Cell frequency (/yr)</th><th scope="col">{`${endState} (/yr)`}</th></tr></thead>
                <tbody>
                  {page.map((row) => {
                    const scenario = scenarioOf.get(row.scenarioId);
                    const code = scenario?.code ?? "Unnamed cell";
                    const skipped = row.status === "skipped_zero_weight";
                    return (
                      <tr key={row.scenarioId}>
                        <td>
                          {scenario === undefined || skipped
                            ? <span className="postable__name">{code}</span>
                            : <button type="button" className="es-records__link" aria-label={`Results of ${code}`} onClick={() => onPick(row.scenarioId)}>{code}</button>}
                          {scenario !== undefined && scenario.name !== scenario.code && <span className="postable__name-sub">{scenario.name}</span>}
                        </td>
                        <td className="esq-dep__number-cell">{shareText(row.convolutionWeight)}</td>
                        <td className="esq-dep__number-cell">{sciText(row.annualFrequency)}</td>
                        <td className="esq-dep__number-cell">{skipped ? <span className="esq-dep__flag">Skipped</span> : sciText(cellContribution(row, endStateId, names))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </PagedResults>
        </section>
      )}
    </>
  );
}

function HazardCell({ row, scenario, names, order, resetKey }: {
  row: HazardRow;
  scenario: ScenarioEntry;
  names: DependencyNames;
  order: DependencyOrder;
  resetKey: string;
}): JSX.Element {
  const skipped = row.status === "skipped_zero_weight";
  const sequences = ordered(row.sequences, order, (entry) => entry.annualContribution);
  return (
    <>
      <section className="esq-dep__section" aria-label="Cell">
        <h4 className="esq-dep__title">Cell</h4>
        <FactsTable label="Cell" rows={[
          ["Evidence", scenario.name],
          ["Raw weight", shareText(row.rawWeight)],
          ["Normalized weight", shareText(row.normalizedWeight)],
          ["Applied weight", shareText(row.convolutionWeight)],
          ["Cell frequency (/yr)", sciText(row.annualFrequency)],
          ["Status", skipped ? "Skipped, zero hazard weight" : "Quantified"],
        ]} />
      </section>
      {!skipped && sequences.length > 0 && (
        <section className="esq-dep__section" aria-label="Sequences in this cell">
          <h4 className="esq-dep__title">Sequences in this cell</h4>
          <PagedResults items={sequences} label="Dependency cell sequences" resetKey={resetKey}>
            {(page) => (
              <table className="postable postable--mid es-records esq-results esq-dep__table" aria-label="Sequences in this cell">
                <thead><tr><th scope="col">Sequence</th><th scope="col">Conditional probability</th><th scope="col">Probability contribution</th><th scope="col">Frequency contribution (/yr)</th></tr></thead>
                <tbody>
                  {page.map((entry) => {
                    const name = names.sequence(entry.sequenceId);
                    const target = names.endStateOf(entry.sequenceId);
                    return (
                      <tr key={entry.sequenceId}>
                        <td>
                          <span className="postable__name">{name}</span>
                          {target !== undefined && <span className="postable__name-sub">{names.endState(target)}</span>}
                        </td>
                        <td className="esq-dep__number-cell">{sciText(entry.conditionalProbability)}</td>
                        <td className="esq-dep__number-cell">{sciText(entry.probabilityContribution)}</td>
                        <td className="esq-dep__number-cell">{sciText(entry.annualContribution)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </PagedResults>
        </section>
      )}
    </>
  );
}

function FitTable({ fit }: { fit: HclDistributionFit }): JSX.Element {
  const counts = [
    `Fitted to ${countText(fit.samples)} samples`,
    fit.zeroSamples > 0 ? `${countText(fit.zeroSamples)} at 0` : "",
    fit.oneSamples > 0 ? `${countText(fit.oneSamples)} at 1` : "",
  ].filter((part) => part.length > 0).join(" · ");
  const rejected = fit.rejected ?? [];
  return (
    <section className="esq-dep__section" aria-label="Distribution fit">
      <h4 className="esq-dep__window-head">Distribution fit</h4>
      <p className="esq-dep__note">{counts}</p>
      {fit.candidates.length > 0 && (
        <table className="postable postable--mid es-records esq-results esq-dep__table" aria-label="Fitted families">
          <thead><tr><th scope="col">Family</th><th scope="col">AIC</th><th scope="col">BIC</th><th scope="col">KS</th><th scope="col">CDF RMSE</th><th scope="col">PDF RMSE</th></tr></thead>
          <tbody>
            {fit.candidates.map((candidate, index) => (
              <tr key={candidate.family}>
                <td>
                  <span className="postable__name">{index === 0 ? `${FIT_FAMILY_TEXT[candidate.family]}, best fit` : FIT_FAMILY_TEXT[candidate.family]}</span>
                  <span className="postable__name-sub">{fitLawText(candidate.law)}</span>
                </td>
                <td className="esq-dep__number-cell">{String(Number(candidate.aic.toPrecision(6)))}</td>
                <td className="esq-dep__number-cell">{String(Number(candidate.bic.toPrecision(6)))}</td>
                <td className="esq-dep__number-cell">{numberText(candidate.ksStatistic)}</td>
                <td className="esq-dep__number-cell">{numberText(candidate.cdfRmse)}</td>
                <td className="esq-dep__number-cell">{numberText(candidate.pdfRmse)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rejected.length > 0 && <FactsTable label="Families not fitted" rows={rejected.map((entry) => [FIT_FAMILY_TEXT[entry.family], entry.reason] as const)} />}
    </section>
  );
}

function SampledDistribution({ result, vectorId, label, point, summary }: {
  result: EventTreeAnalysisResult;
  vectorId: string;
  label: string;
  point: number;
  summary: HclUncertaintySummary | undefined;
}): JSX.Element | null {
  const samples = useRunSamples(result.runId);
  const adjustments = adjustmentsText(summary?.adjustments);
  const spread: (readonly [string, string])[] = summary === undefined ? [] : [
    ["Samples", countText(summary.sampleCount)],
    ["Seed", String(summary.seed)],
    ["Standard deviation (/yr)", sciText(summary.standardDeviation)],
    ["Minimum (/yr)", sciText(summary.minimum)],
    ["Maximum (/yr)", sciText(summary.maximum)],
  ];
  if (samples.error !== undefined) return <p className="es-scope-error" role="alert">{samples.error}</p>;
  if (samples.vectors === undefined) return null;
  const values = frequencySamples(samples.vectors, vectorId, initiatorPoint(result));
  return (
    <>
      {values !== undefined && values.length > 0 && <EsqUncertaintyCard distribution={distributionOf(label, point, values, summary)} details={summary === undefined ? "" : `${countText(summary.sampleCount)} samples · seed ${String(summary.seed)}`} />}
      {spread.length > 0 && <FactsTable label={`Spread of ${label}`} rows={spread} />}
      {adjustments.length > 0 && <p className="esq-dep__note">{adjustments}</p>}
      {summary?.fit !== undefined && <FitTable fit={summary.fit} />}
    </>
  );
}

function SequenceWindow({ result, sequenceId, scenario, names, onClose }: {
  result: EventTreeAnalysisResult;
  sequenceId: string;
  scenario: ScenarioEntry | undefined;
  names: DependencyNames;
  onClose: () => void;
}): JSX.Element | null {
  const entry = result.sequences.find((candidate) => candidate.sequenceId === sequenceId);
  if (entry === undefined) return null;
  const name = names.sequence(sequenceId);
  const facts: (readonly [string, string])[] = [
    ...(scenario === undefined ? [] : [["Scenario", scenario.name === scenario.code ? scenario.code : `${scenario.code} · ${scenario.name}`] as const]),
    ["End state", entry.result.kind === "END_STATE" ? names.endState(entry.result.endStateId) : "None"],
    ["Conditional probability", sciText(entry.conditionalProbability)],
    ["Frequency (/yr)", sciText(entry.annualFrequency)],
  ];
  return (
    <DialogShell label="Dependency sequence" onClose={onClose} fit>
      <DialogHead cap="Dependency sequence" title={name} onClose={onClose} />
      <div className="modal__body esq-dialog-body">
        <div className="esq-dep__window">
          <FactsTable label={name} rows={facts} />
          <SampledDistribution result={result} vectorId={`sequence:${sequenceId}`} label={name} point={entry.annualFrequency} summary={entry.uncertainty?.annualFrequency} />
        </div>
      </div>
    </DialogShell>
  );
}

function EndStateWindow({ result, endStateId, scenario, names, onClose }: {
  result: EventTreeAnalysisResult;
  endStateId: string;
  scenario: ScenarioEntry | undefined;
  names: DependencyNames;
  onClose: () => void;
}): JSX.Element | null {
  const state = result.endStateAggregates.find((candidate) => candidate.endStateId === endStateId);
  if (state === undefined) return null;
  const name = names.endState(endStateId);
  const facts: (readonly [string, string])[] = [
    ...(scenario === undefined ? [] : [["Scenario", scenario.name === scenario.code ? scenario.code : `${scenario.code} · ${scenario.name}`] as const]),
    ["Frequency (/yr)", sciText(state.annualFrequency)],
  ];
  return (
    <DialogShell label="Dependency end state" onClose={onClose} fit>
      <DialogHead cap="Dependency end state" title={name} onClose={onClose} />
      <div className="modal__body esq-dialog-body">
        <div className="esq-dep__window">
          <FactsTable label={name} rows={facts} />
          <SampledDistribution result={result} vectorId={`endState:${endStateId}`} label={name} point={state.annualFrequency} summary={state.uncertainty} />
        </div>
      </div>
    </DialogShell>
  );
}

function HazardCurve({ points, label }: { points: readonly HclHazardExceedancePoint[]; label: string }): JSX.Element {
  const [frameRef, width] = useElementWidth(CURVE_WIDTH);
  const drawn = points.filter((point) => point.threshold > 0 && point.exceedanceFrequency > 0);
  const across = decadeRange(drawn.map((point) => point.threshold));
  const up = decadeRange(drawn.map((point) => point.exceedanceFrequency));
  if (across === undefined || up === undefined) return <p className="esq-dep__note">Every cell has a zero frequency, so there is no curve to draw.</p>;
  const right = Math.max(CURVE_LEFT + 120, width - CURVE_RIGHT_GAP);
  const x = (value: number): number => CURVE_LEFT + ((Math.log10(value) - across.low) / (across.high - across.low)) * (right - CURVE_LEFT);
  const y = (value: number): number => CURVE_BASE - ((Math.log10(value) - up.low) / (up.high - up.low)) * (CURVE_BASE - CURVE_TOP);
  const path = drawn.map((point, index) => {
    const previous = drawn[index - 1];
    const at = `${x(point.threshold).toFixed(1)},${y(point.exceedanceFrequency).toFixed(1)}`;
    return previous === undefined ? `M${at}` : `L${x(previous.threshold).toFixed(1)},${y(point.exceedanceFrequency).toFixed(1)} L${at}`;
  }).join(" ");
  return (
    <div className="esq-dep-chart">
      <div ref={frameRef} className="esq-dep-chart__frame">
        <svg className="esq-dep-chart__svg" width={width} height={CURVE_HEIGHT} viewBox={`0 0 ${String(width)} ${String(CURVE_HEIGHT)}`} role="img" aria-label={`Frequency of the cells whose ${label} probability is at or above each value, on log scales`}>
          {decadeTicks(up).map((decade) => (
            <g key={`up-${String(decade)}`}>
              <line className="esq-dep-chart__grid" x1={CURVE_LEFT} y1={y(10 ** decade)} x2={right} y2={y(10 ** decade)} />
              <text className="esq-dep-chart__number" x={CURVE_LEFT - 8} y={y(10 ** decade) + 4} textAnchor="end">{`1E${String(decade)}`}</text>
            </g>
          ))}
          <path className="esq-dep-chart__curve" d={path} />
          <line className="esq-dep-chart__axis" x1={CURVE_LEFT} y1={CURVE_BASE} x2={right} y2={CURVE_BASE} />
          {decadeTicks(across).map((decade) => (
            <g key={`across-${String(decade)}`}>
              <line className="esq-dep-chart__axis" x1={x(10 ** decade)} y1={CURVE_BASE} x2={x(10 ** decade)} y2={CURVE_BASE + 4} />
              <text className="esq-dep-chart__number" x={x(10 ** decade)} y={CURVE_BASE + 20} textAnchor="middle">{`1E${String(decade)}`}</text>
            </g>
          ))}
        </svg>
      </div>
      <p className="esq-dep-chart__axes">
        <span>{`Across: conditional probability of ${label}`}</span>
        <span>Up: frequency of the cells at or above it (/yr)</span>
      </p>
    </div>
  );
}

function CurveWindow({ hazard, endStateId, names, onClose }: { hazard: HclEventTreeHazardConvolutionResult; endStateId: string; names: DependencyNames; onClose: () => void }): JSX.Element | null {
  const state = hazard.endStateAggregates.find((candidate) => candidate.endStateId === endStateId);
  if (state === undefined) return null;
  const name = names.endState(endStateId);
  const points = state.exceedance ?? [];
  return (
    <DialogShell label="Hazard exceedance" onClose={onClose} fit>
      <DialogHead cap="Hazard exceedance" title={name} onClose={onClose} />
      <div className="modal__body esq-dialog-body">
        <div className="esq-dep__window">
          <HazardCurve points={points} label={name} />
          <div className="esq-dep__inline">
            <ResultCsvButton filename={`${name} hazard exceedance.csv`} records={() => points.map((point) => ({
              threshold: point.threshold,
              bin_weight: point.weight,
              exceedance_weight: point.exceedanceWeight,
              exceedance_frequency_per_year: point.exceedanceFrequency,
            }))} />
          </div>
        </div>
      </div>
    </DialogShell>
  );
}

function DetailsWindow({ study, tree, model, scenarios, results, onClose }: {
  study: DependencyStudy;
  tree: DependencyStudyTree;
  model: EsqModel;
  scenarios: readonly ScenarioEntry[];
  results: readonly EventTreeAnalysisResult[];
  onClose: () => void;
}): JSX.Element {
  const finished = scenarios.filter((entry) => entry.result !== null).length;
  const skipped = scenarios.filter((entry) => entry.status === "SKIPPED").length;
  const summary = results.flatMap((result) => result.sequences.flatMap((entry) => (entry.uncertainty === undefined ? [] : [entry.uncertainty.annualFrequency])))[0];
  const issues = results.flatMap((result) => result.validationIssues);
  const facts: (readonly [string, string])[] = [
    ["Event tree", treeLabel(model, tree.treeId)],
    ["Result", RESULT_TEXT[study.result]],
    ["Evidence", EVIDENCE_TEXT[study.evidence]],
    ...(scenarios.length === 0 ? [] : [["Scenarios", `${countText(finished)} of ${countText(scenarios.length)} quantified${skipped > 0 ? `, ${countText(skipped)} skipped` : ""}`] as const]),
    ...(summary === undefined ? [] : [["Samples", countText(summary.sampleCount)] as const, ["Seed", String(summary.seed)] as const]),
  ];
  return (
    <DialogShell label="Dependency run details" onClose={onClose} fit>
      <DialogHead cap="Dependency run" title={treeLabel(model, tree.treeId)} onClose={onClose} />
      <div className="modal__body esq-dialog-body">
        <div className="esq-dep__window">
          <FactsTable label="Dependency run details" rows={facts} />
          <Issues issues={issues} />
        </div>
      </div>
    </DialogShell>
  );
}

function SamplesButton({ result, names }: { result: EventTreeAnalysisResult; names: DependencyNames }): JSX.Element {
  const { runtime } = useEsqWorkbook();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download(): Promise<void> {
    const workbookId = runtime.workbookId;
    if (workbookId === null) return;
    setLoading(true);
    setError(null);
    try {
      downloadResultCsv("dependency samples.csv", sampleRecords(await getAnalysisRunSamples("esq", workbookId, result.runId), names));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The samples could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="posnav__btn posnav__btn--sm" disabled={loading} onClick={() => { void download(); }}>{loading ? "Loading samples…" : "Export samples CSV"}</button>
      {error !== null && <span className="es-scope-error" role="alert">{error}</span>}
    </>
  );
}

function EsqDependencyResults({ study, model }: { study: DependencyStudy; model: EsqModel }): JSX.Element | null {
  const fieldId = useId();
  const [settings, setSettings] = useWorkbookView<DependencyResultSettings>("solve.dependency.results", START, SETTINGS_VIEW);
  const [shownWindow, setShownWindow] = useState<DependencyWindow | null>(null);
  const found = study.trees.find((entry) => entry.treeId === settings.treeId) ?? study.trees[0];
  if (found === undefined) return null;
  const tree: DependencyStudyTree = found;
  const uncertainty = study.result === "UNCERTAINTY";
  const scenarios = scenariosOf(tree);
  const hazard = hazardOf(tree);
  const base = baseOf(tree);
  const results = [...(base === null ? [] : [base]), ...scenarios.flatMap((entry) => (entry.result === null ? [] : [entry.result]))];
  const names = namesOf(model, results);
  const chosen = study.evidence === "BASE" ? undefined : scenarios.find((entry) => entry.id === settings.scenarioId);
  const overview = study.evidence !== "BASE" && chosen === undefined;
  const endStateIds = [...new Set([
    ...results.flatMap((result) => result.endStateAggregates.map((state) => state.endStateId)),
    ...(hazard?.endStateAggregates.map((state) => state.endStateId) ?? []),
  ])].sort((left, right) => names.endState(left).localeCompare(names.endState(right)));
  const releaseId = esqEndStateRunId(RELEASE);
  const endStateId = endStateIds.includes(settings.endStateId) ? settings.endStateId : endStateIds.includes(releaseId) ? releaseId : endStateIds[0] ?? "";
  const single = study.evidence === "BASE" ? base : chosen?.result ?? null;
  const hazardRow = hazard === undefined || chosen === undefined ? undefined : hazard.rows.find((row) => row.scenarioId === chosen.id);
  const resetKey = `${tree.treeId}:${study.result}:${study.evidence}:${chosen?.id ?? ""}:${settings.order}`;
  const scenarioWord = study.evidence === "HAZARD" ? "Cell" : "Scenario";

  function set(patch: Partial<DependencyResultSettings>): void {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function resultOf(scenarioId: string): EventTreeAnalysisResult | null {
    return scenarioId.length === 0 ? base : scenarios.find((entry) => entry.id === scenarioId)?.result ?? null;
  }

  function csvRecords(): ResultCsvRecord[] {
    const records = tree.batchRunResult !== null ? hclBatchResultRecords(tree.batchRunResult, names.step)
      : tree.runResult !== null ? hclResultRecords(tree.runResult, names.step)
      : [];
    return records.map((record) => labeled(record, names));
  }

  function openSequence(sequenceId: string): void {
    setShownWindow({ kind: "sequence", scenarioId: chosen?.id ?? "", sequenceId });
  }

  function body(): JSX.Element | null {
    if (study.evidence === "HAZARD") {
      if (hazard === undefined) return null;
      if (chosen === undefined) return <HazardOverview hazard={hazard} scenarios={scenarios} endStateId={endStateId} names={names} order={settings.order} resetKey={resetKey} onPick={(scenarioId) => set({ scenarioId })} onCurve={(id) => setShownWindow({ kind: "curve", endStateId: id })} />;
      if (hazardRow === undefined) return null;
      return <HazardCell row={hazardRow} scenario={chosen} names={names} order={settings.order} resetKey={resetKey} />;
    }
    if (overview) return <ScenarioOverview scenarios={scenarios} uncertainty={uncertainty} endStateId={endStateId} names={names} order={settings.order} resetKey={`${resetKey}:${endStateId}`} onPick={(scenarioId) => set({ scenarioId })} />;
    if (chosen !== undefined && chosen.result === null) {
      return <p className="es-scope-error" role="alert">{chosen.failure ?? statusText(chosen)}</p>;
    }
    if (single === null) return null;
    return (
      <>
        <Issues issues={single.validationIssues} />
        <EndStateTable result={single} uncertainty={uncertainty} names={names} onOpen={(id) => setShownWindow({ kind: "endState", scenarioId: chosen?.id ?? "", endStateId: id })} />
        <SequenceTable result={single} uncertainty={uncertainty} names={names} order={settings.order} resetKey={resetKey} onOpen={openSequence} />
      </>
    );
  }

  function renderWindow(): JSX.Element | null {
    if (shownWindow === null) return null;
    const close = (): void => setShownWindow(null);
    switch (shownWindow.kind) {
      case "details":
        return <DetailsWindow study={study} tree={tree} model={model} scenarios={scenarios} results={results} onClose={close} />;
      case "curve":
        return hazard === undefined ? null : <CurveWindow hazard={hazard} endStateId={shownWindow.endStateId} names={names} onClose={close} />;
      case "sequence": {
        const { scenarioId, sequenceId } = shownWindow;
        const result = resultOf(scenarioId);
        const scenario = scenarios.find((entry) => entry.id === scenarioId);
        return result === null ? null : <SequenceWindow result={result} sequenceId={sequenceId} scenario={scenario} names={names} onClose={close} />;
      }
      case "endState": {
        const { scenarioId, endStateId: windowEndStateId } = shownWindow;
        const result = resultOf(scenarioId);
        const scenario = scenarios.find((entry) => entry.id === scenarioId);
        return result === null ? null : <EndStateWindow result={result} endStateId={windowEndStateId} scenario={scenario} names={names} onClose={close} />;
      }
    }
  }

  return (
    <div className="esq-dep__results" role="region" aria-label="Dependency results">
      <div className="es-records__bar">
        <div className="es-records__filters">
          {study.trees.length > 1 && (
            <div className="es-records__filter">
              <label className="posfield__label" htmlFor={`${fieldId}-tree`}>Event tree</label>
              <select id={`${fieldId}-tree`} className="posfield__select" value={tree.treeId} onChange={(event) => set({ treeId: event.target.value })}>
                {study.trees.map((entry) => <option key={entry.treeId} value={entry.treeId}>{treeLabel(model, entry.treeId)}</option>)}
              </select>
            </div>
          )}
          {study.evidence !== "BASE" && scenarios.length > 0 && (
            <div className="es-records__filter">
              <label className="posfield__label" htmlFor={`${fieldId}-scenario`}>{scenarioWord}</label>
              <select id={`${fieldId}-scenario`} className="posfield__select" value={chosen?.id ?? ""} onChange={(event) => set({ scenarioId: event.target.value })}>
                <option value="">{study.evidence === "HAZARD" ? "All cells" : "All scenarios"}</option>
                {scenarios.map((entry) => <option key={entry.id} value={entry.id}>{entry.code}</option>)}
              </select>
            </div>
          )}
          {overview && endStateIds.length > 1 && (
            <div className="es-records__filter">
              <label className="posfield__label" htmlFor={`${fieldId}-end-state`}>End state</label>
              <select id={`${fieldId}-end-state`} className="posfield__select" value={endStateId} onChange={(event) => set({ endStateId: event.target.value })}>
                {endStateIds.map((id) => <option key={id} value={id}>{names.endState(id)}</option>)}
              </select>
            </div>
          )}
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-order`}>Order</label>
            <select id={`${fieldId}-order`} className="posfield__select" value={settings.order} onChange={(event) => {
              const order = ORDERS.find(([option]) => option === event.target.value)?.[0];
              if (order !== undefined) set({ order });
            }}>
              {ORDERS.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
            </select>
          </div>
        </div>
        <div className="es-records__actions">
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setShownWindow({ kind: "details" })}>Details</button>
          {(tree.batchRunResult !== null || tree.runResult !== null) && <ResultCsvButton filename="dependency results.csv" records={csvRecords} />}
          {uncertainty && single !== null && <SamplesButton result={single} names={names} />}
        </div>
      </div>
      {tree.failure !== null ? <p className="es-scope-error" role="alert">{tree.failure}</p> : body()}
      {renderWindow()}
    </div>
  );
}

export { EsqDependencyResults };
