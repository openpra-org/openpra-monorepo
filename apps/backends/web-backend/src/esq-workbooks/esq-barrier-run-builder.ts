import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { cellOf, esqCellRunId, resolveCell, type EsqResolvedSide } from "interfaces-mef-types/esq/esq-barrier-inputs";
import type { PraxisModelSnapshot } from "../newly-developed-methods/shared/praxis-snapshot-adapters";
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

function sideInput(side: EsqResolvedSide): Record<string, unknown> {
  return {
    distribution: side.distribution,
    uncertainParameters: side.uncertainParameters.map((entry) => ({
      parameter: entry.parameter,
      distribution: entry.distribution,
      ...(entry.correlationKey === undefined || entry.correlationKey.trim().length === 0 ? {} : { correlationKey: entry.correlationKey.trim() }),
    })),
  };
}

function buildEsqCellRun(input: EsqCellRunBuildInput): EsqCellRunBuild {
  const cell = cellOf(input.esq, input.cellId);
  if (cell === undefined) throw new EsqRunBuildError(`Cell ${input.cellId} is not in Step 04.`);
  const resolved = resolveCell(cell, input.esq.model);
  if (resolved.problem !== undefined) throw new EsqRunBuildError(`${cell.id}: ${resolved.problem}`);
  const modelId = esqCellRunId(cell.id);
  const unit = cell.unit.trim();
  return {
    modelId,
    snapshot: {
      id: modelId,
      methodType: "LOAD_CAPACITY",
      revision: input.esqRevision,
      load: sideInput(resolved.cell.load),
      capacity: sideInput(resolved.cell.capacity),
      ...(unit.length === 0 ? {} : { unit }),
    },
  };
}

export { buildEsqCellRun, type EsqCellRunBuild, type EsqCellRunBuildInput };
