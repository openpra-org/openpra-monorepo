import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import {
  useRevisionedMefPatch,
  type MefMutator,
  type RevisionedMefPatcher,
} from "../workbooks/useRevisionedMefPatch";
import { getEsWorkbook, patchEsWorkbook, type EsWorkbookResponse } from "./esWorkbookApi";

type Mutator = MefMutator<EventSequenceAnalysis>;
type EsMefPatcher = RevisionedMefPatcher<EventSequenceAnalysis>;

function useEsMefPatch(
  workbookId: string,
  current: EventSequenceAnalysis | null,
  currentRevision: number | null,
  onSuccess: (nextRevision: number) => void,
  onError: (message: string) => void,
  onResync: (latest: EsWorkbookResponse) => void,
): EsMefPatcher {
  return useRevisionedMefPatch(
    workbookId,
    current,
    currentRevision,
    patchEsWorkbook,
    getEsWorkbook,
    onSuccess,
    onError,
    onResync,
  );
}

export { useEsMefPatch, type EsMefPatcher, type Mutator };
