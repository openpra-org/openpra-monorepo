import type { EsqFragility, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { cellOf, esqCellRunId, resolveCell, type EsqResolvedSide, type EsqSideName } from "interfaces-mef-types/esq/esq-barrier-inputs";
import { parameterReferenceKey, type AleatoryVariable, type Law, type UncertainExpression, type UncertainLawField } from "interfaces-mef-types/core/uncertainty";
import type {
  UncertaintyExpressionQuery,
  UncertaintyOperationQuery,
  UncertaintyRequest,
  UncertaintyResponse,
} from "interfaces-shared-types/newly-developed-methods/shared";
import { adaptLoadCapacitySnapshot, type PraxisModelSnapshot } from "../newly-developed-methods/shared/praxis-snapshot-adapters";
import { EsqRunBuildError } from "./esq-model-run-builder";

interface EsqCellRunBuildInput {
  esq: EventSequenceQuantification;
  cellId: string;
  esqRevision: number;
}

interface EsqCellRunBuild {
  modelId: string;
  snapshot: PraxisModelSnapshot;
}

type EsqUncertaintyEvaluator = (request: UncertaintyRequest) => Promise<UncertaintyResponse>;

type FragilitySpread = "randomness" | "uncertainty";

interface FragilityFit {
  side: EsqSideName;
  spread: FragilitySpread;
  median: number;
  beta: number;
}

const SPREAD_LABELS: Record<FragilitySpread, string> = { randomness: "randomness", uncertainty: "uncertainty" };

function quantity(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "QUANTITY", law: { family: "POINT", value } } };
}

function fitKey(fit: FragilityFit): string {
  return `${fit.side}:${fit.spread}`;
}

function fitsOf(side: EsqSideName, fragility: EsqFragility): FragilityFit[] {
  const fits: FragilityFit[] = [];
  if (fragility.betaR > 0) fits.push({ side, spread: "randomness", median: fragility.median, beta: fragility.betaR });
  if (fragility.betaU > 0) fits.push({ side, spread: "uncertainty", median: fragility.median, beta: fragility.betaU });
  return fits;
}

function probeQueries(fit: FragilityFit): UncertaintyExpressionQuery[] {
  const demand: UncertainExpression = { node: "OPERATION", operation: "MULTIPLY", operands: [quantity(fit.median), { node: "OPERATION", operation: "ADD", operands: [quantity(1), quantity(fit.beta)] }] };
  return [
    { id: `${fitKey(fit)}:demand`, expression: demand, unit: "QUANTITY", probabilities: [] },
    { id: `${fitKey(fit)}:probability`, expression: { node: "MODEL", model: { form: "FRAGILITY", median: quantity(fit.median), randomness: quantity(fit.beta), demand } }, unit: "PROBABILITY", probabilities: [] },
  ];
}

function fitProblem(fit: FragilityFit, detail: string): EsqRunBuildError {
  return new EsqRunBuildError(`The ${fit.side} fragility ${SPREAD_LABELS[fit.spread]} beta ${fit.beta} could not be turned into a lognormal law: ${detail}`);
}

function pointOf(response: UncertaintyResponse, id: string, fit: FragilityFit): number {
  const answer = response.expressions.find((entry) => entry.id === id);
  if (answer === undefined) throw fitProblem(fit, "PRAXIS gave no answer.");
  if ("error" in answer) throw fitProblem(fit, answer.error);
  return answer.point;
}

async function fittedLaws(fits: readonly FragilityFit[], evaluate: EsqUncertaintyEvaluator): Promise<Map<string, Law>> {
  const laws = new Map<string, Law>();
  if (fits.length === 0) return laws;
  const probes = await evaluate({ parameters: [], laws: [], operations: [], expressions: fits.flatMap(probeQueries) });
  const operations: UncertaintyOperationQuery[] = fits.map((fit) => ({
    id: fitKey(fit),
    operation: {
      kind: "LOGNORMAL_FIT",
      mean: null,
      median: fit.median,
      quantiles: [{ probability: pointOf(probes, `${fitKey(fit)}:probability`, fit), value: pointOf(probes, `${fitKey(fit)}:demand`, fit) }],
    },
  }));
  const fitted = await evaluate({ parameters: [], laws: [], expressions: [], operations });
  for (const fit of fits) {
    const answer = fitted.operations.find((entry) => entry.id === fitKey(fit));
    if (answer === undefined) throw fitProblem(fit, "PRAXIS gave no answer.");
    if ("error" in answer) throw fitProblem(fit, answer.error);
    if (!("law" in answer)) throw fitProblem(fit, "PRAXIS gave no law.");
    laws.set(fitKey(fit), answer.law);
  }
  return laws;
}

function fragilityVariable(side: EsqSideName, fragility: EsqFragility, laws: ReadonlyMap<string, Law>): AleatoryVariable {
  const randomness = laws.get(`${side}:randomness`);
  const uncertainty = laws.get(`${side}:uncertainty`);
  const law: Law = randomness ?? { family: "POINT", value: fragility.median };
  if (uncertainty === undefined) return { law, fields: [] };
  const median: UncertainExpression = { node: "VALUE", value: { unit: "QUANTITY", law: uncertainty } };
  if (randomness === undefined) return { law, fields: [{ field: "value", value: median }] };
  if (randomness.family !== "LOGNORMAL") throw new EsqRunBuildError(`The ${side} fragility randomness gave a ${randomness.family.toLowerCase()} law, not a lognormal one.`);
  const ratio: UncertainExpression = { node: "OPERATION", operation: "DIVIDE", operands: [quantity(randomness.mean), quantity(fragility.median)] };
  const field: UncertainLawField = { field: "mean", value: { node: "OPERATION", operation: "MULTIPLY", operands: [median, ratio] } };
  return { law, fields: [field] };
}

function variableOf(name: EsqSideName, side: EsqResolvedSide, laws: ReadonlyMap<string, Law>): AleatoryVariable {
  return side.kind === "VARIABLE" ? side.variable : fragilityVariable(name, side.fragility, laws);
}

async function buildEsqCellRun(input: EsqCellRunBuildInput, evaluate: EsqUncertaintyEvaluator): Promise<EsqCellRunBuild> {
  const cell = cellOf(input.esq, input.cellId);
  if (cell === undefined) throw new EsqRunBuildError(`Cell ${input.cellId} is not in Step 04.`);
  const resolved = resolveCell(cell, input.esq);
  if (resolved.problem !== undefined) throw new EsqRunBuildError(`${cell.id}: ${resolved.problem}`);
  const sides: [EsqSideName, EsqResolvedSide][] = [["load", resolved.cell.load], ["capacity", resolved.cell.capacity]];
  const fits = sides.flatMap(([name, side]) => (side.kind === "FRAGILITY" ? fitsOf(name, side.fragility) : []));
  const laws = await fittedLaws(fits, evaluate);
  const modelId = esqCellRunId(cell.id);
  const unit = cell.unit.trim();
  const parameters = new Map(resolved.cell.parameters.map((parameter) => [parameterReferenceKey(parameter.reference), parameter] as const));
  return {
    modelId,
    snapshot: adaptLoadCapacitySnapshot(
      {
        id: modelId,
        revision: input.esqRevision,
        load: variableOf("load", resolved.cell.load, laws),
        capacity: variableOf("capacity", resolved.cell.capacity, laws),
        ...(unit.length === 0 ? {} : { unit }),
      },
      { parameters },
    ),
  };
}

export { buildEsqCellRun, type EsqCellRunBuild, type EsqCellRunBuildInput, type EsqUncertaintyEvaluator };
