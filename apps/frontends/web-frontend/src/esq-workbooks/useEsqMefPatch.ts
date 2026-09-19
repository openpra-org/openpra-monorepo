import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import {
  useRevisionedMefPatch,
  type MefMutator,
  type RevisionedMefPatcher,
} from "../workbooks/useRevisionedMefPatch";
import { getEsqWorkbook, patchEsqWorkbook, type EsqWorkbookResponse } from "./esqWorkbookApi";

type Mutator = MefMutator<EventSequenceQuantification>;
type EsqMefPatcher = RevisionedMefPatcher<EventSequenceQuantification>;

function useEsqMefPatch(
  workbookId: string,
  current: EventSequenceQuantification | null,
  currentRevision: number | null,
  onSuccess: (nextRevision: number) => void,
  onError: (message: string) => void,
  onResync: (latest: EsqWorkbookResponse) => void,
): EsqMefPatcher {
  return useRevisionedMefPatch(
    workbookId,
    current,
    currentRevision,
    patchEsqWorkbook,
    getEsqWorkbook,
    onSuccess,
    onError,
    onResync,
  );
}

export { useEsqMefPatch, type EsqMefPatcher, type Mutator };
