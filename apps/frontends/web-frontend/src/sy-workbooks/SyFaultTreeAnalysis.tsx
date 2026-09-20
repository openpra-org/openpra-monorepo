import type { JSX } from "react";
import type { FaultTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import { FaultTreeResults } from "../newly-developed-methods/fault-tree";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
import { useSyWorkbook } from "./syWorkbookContext";
import "./css/syFaultTreeAnalysis.css";

interface Props {
  exactResult: FaultTreeAnalysisResult | null;
  exactResultIsStale: boolean;
  exactRunError: string | null;
  exactRunning: boolean;
  sourceWarning: string | null;
  onRunExact: () => void;
}

export function SyFaultTreeAnalysis({
  exactResult, exactResultIsStale, exactRunError, exactRunning, sourceWarning, onRunExact,
}: Props): JSX.Element {
  const { editable, runtime } = useSyWorkbook();
  const saveBlockedReason = analysisSaveBlock(runtime);

  return (
    <section className="syft-analysis" aria-label="Fault-tree quantification">
      <div className="syft-analysis__heading">
        <h3>Fault-tree quantification</h3>
        <button
          type="button"
          className="posnav__btn posnav__btn--sm posnav__btn--primary"
          disabled={exactRunning || !editable || saveBlockedReason !== null}
          onClick={onRunExact}
        >
          {exactRunning ? "Running…" : "Run probability"}
        </button>
      </div>
      {saveBlockedReason !== null && <p className="syft-analysis__notice" role="status">{saveBlockedReason}</p>}
      {(exactRunError ?? sourceWarning) !== null && <p className="syft-analysis__error" role="alert">{exactRunError ?? sourceWarning}</p>}
      <FaultTreeResults analysisResult={exactResult} resultIsStale={exactResultIsStale} />
    </section>
  );
}
