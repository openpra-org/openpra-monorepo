import { JSX, useEffect, useId, useState } from "react";
import { HANDOFF_ELEMENT_NAMES } from "interfaces-mef-types/technical-element-handoff";
import { HandoffImports } from "../workbooks/workbookHandoff";
import { listWorkbooks } from "../workbooks/workbookApi";
import { EXAMPLE_PREFIX, withDaLink } from "./posDaLinks";
import { usePosWorkbook } from "./posWorkbookContext";
import { type Mutator } from "./useMefPatch";
import "./css/posInterfaces.css";

interface PosLinkOption {
  workbookId: string;
  name: string;
}

function PosInterfaces({ canEdit, mefPatch }: { canEdit: boolean; mefPatch?: (mutator: Mutator) => void }): JSX.Element {
  const { pos, projectId } = usePosWorkbook();
  const [open, setOpen] = useState(true);
  const [options, setOptions] = useState<PosLinkOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectId = useId();
  const linkedId = pos.linkedWorkbooks?.DA;
  const linked = options?.find((option) => option.workbookId === linkedId);

  useEffect(() => {
    if (projectId === undefined) return;
    let cancelled = false;
    listWorkbooks(projectId, "DA")
      .then((result) => { if (!cancelled) setOptions(result.workbooks.map((workbook) => ({ workbookId: workbook.id, name: workbook.name }))); })
      .catch((failure: Error) => { if (!cancelled) setError(failure.message); });
    return () => { cancelled = true; };
  }, [projectId]);

  function onLink(workbookId: string): void {
    if (!canEdit || mefPatch === undefined) return;
    setError(null);
    mefPatch((draft) => withDaLink(draft, workbookId));
  }

  return (
    <>
      <div className="poshandoff__grid">
        <button
          type="button"
          className={`poshandoff__tile${open ? " poshandoff__tile--active" : ""}`}
          aria-pressed={open}
          onClick={() => setOpen(!open)}
        >
          <span className="poshandoff__tile-code">DA</span>
          <span className="poshandoff__tile-name">{HANDOFF_ELEMENT_NAMES.DA}</span>
        </button>
      </div>
      {open && (
        <div className="posiface__lane">
          <div className="posiface__link">
            <label className="posfield__label" htmlFor={selectId}>Source workbook</label>
            <select
              id={selectId}
              className="posfield__select"
              value={linkedId ?? ""}
              disabled={!canEdit || mefPatch === undefined || options === null}
              onChange={(event) => onLink(event.target.value)}
            >
              <option value="">{options !== null && options.length === 0 && linkedId === undefined ? "No DA workbooks in this project" : "Not linked"}</option>
              {(options ?? []).map((option) => <option key={option.workbookId} value={option.workbookId}>{option.name}</option>)}
              {linkedId !== undefined && linked === undefined && <option value={linkedId}>{linkedId.startsWith(EXAMPLE_PREFIX) ? "Example DA workbook" : options === null ? "" : "DA workbook not in this project"}</option>}
            </select>
          </div>
          <HandoffImports consumer="POS" producer="DA" />
          {error !== null && <p className="posiface__error" role="alert">{error}</p>}
        </div>
      )}
    </>
  );
}

export { PosInterfaces };
