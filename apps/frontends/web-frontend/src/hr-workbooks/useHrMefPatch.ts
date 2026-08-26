import { type HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import {
  useRevisionedMefPatch,
  type MefMutator,
  type RevisionedMefPatcher,
} from "../workbooks/useRevisionedMefPatch";
import { getHrWorkbook, patchHrWorkbook, type HrWorkbookResponse } from "./hrWorkbookApi";

type Mutator = MefMutator<HumanReliabilityAnalysis>;
type HrMefPatcher = RevisionedMefPatcher<HumanReliabilityAnalysis>;

function useHrMefPatch(
  workbookId: string,
  current: HumanReliabilityAnalysis | null,
  currentRevision: number | null,
  onSuccess: (nextRevision: number) => void,
  onError: (message: string) => void,
  onResync: (latest: HrWorkbookResponse) => void,
): HrMefPatcher {
  return useRevisionedMefPatch(
    workbookId,
    current,
    currentRevision,
    patchHrWorkbook,
    getHrWorkbook,
    onSuccess,
    onError,
    onResync,
  );
}

export { useHrMefPatch, type HrMefPatcher, type Mutator };
