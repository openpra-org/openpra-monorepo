import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import {
  useRevisionedMefPatch,
  type MefMutator,
  type RevisionedMefPatcher,
} from "../workbooks/useRevisionedMefPatch";
import { getSyWorkbook, patchSyWorkbook, type SyWorkbookResponse } from "./syWorkbookApi";

type Mutator = MefMutator<SystemsAnalysis>;
type SyMefPatcher = RevisionedMefPatcher<SystemsAnalysis>;

function useSyMefPatch(
  workbookId: string,
  current: SystemsAnalysis | null,
  currentRevision: number | null,
  onSuccess: (nextRevision: number) => void,
  onError: (message: string) => void,
  onResync: (latest: SyWorkbookResponse) => void,
): SyMefPatcher {
  return useRevisionedMefPatch(
    workbookId,
    current,
    currentRevision,
    patchSyWorkbook,
    getSyWorkbook,
    onSuccess,
    onError,
    onResync,
  );
}

export { useSyMefPatch, type SyMefPatcher, type Mutator };
