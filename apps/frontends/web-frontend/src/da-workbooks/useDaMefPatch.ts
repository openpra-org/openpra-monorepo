import { type DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import {
  useRevisionedMefPatch,
  type MefMutator,
  type RevisionedMefPatcher,
} from "../workbooks/useRevisionedMefPatch";
import { getDaWorkbook, patchDaWorkbook, type DaWorkbookResponse } from "./daWorkbookApi";

type Mutator = MefMutator<DataAnalysis>;
type DaMefPatcher = RevisionedMefPatcher<DataAnalysis>;

function useDaMefPatch(
  workbookId: string,
  current: DataAnalysis | null,
  currentRevision: number | null,
  onSuccess: (nextRevision: number) => void,
  onError: (message: string) => void,
  onResync: (latest: DaWorkbookResponse) => void,
): DaMefPatcher {
  return useRevisionedMefPatch(
    workbookId,
    current,
    currentRevision,
    patchDaWorkbook,
    getDaWorkbook,
    onSuccess,
    onError,
    onResync,
  );
}

export { useDaMefPatch, type DaMefPatcher, type Mutator };
