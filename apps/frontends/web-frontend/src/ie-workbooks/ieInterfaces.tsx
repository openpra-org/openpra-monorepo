import { JSX, useEffect, useId, useState } from "react";
import { HANDOFF_ELEMENT_NAMES } from "interfaces-mef-types/technical-element-handoff";
import { HandoffImports } from "../workbooks/workbookHandoff";
import { listWorkbooks } from "../workbooks/workbookApi";
import { EXAMPLE_PREFIX, withDaLink } from "./ieDaLinks";
import { useIeWorkbook } from "./ieWorkbookContext";
import "./css/ieInterfaces.css";

type IeLinkCode = "POS" | "DA";

interface IeLinkOption {
  workbookId: string;
  name: string;
}

interface IePosLinkActions {
  available: () => Promise<IeLinkOption[]>;
  link: (workbookId: string) => Promise<void>;
  unlink: () => Promise<void>;
}

interface IeLaneOptions {
  options: IeLinkOption[] | null;
  loadError: string | null;
}

const IE_LINK_CODES: readonly IeLinkCode[] = ["POS", "DA"];

const NOT_LOADED: IeLaneOptions = { options: null, loadError: null };

function PosLane({ links, options, loadError }: IeLaneOptions & { links?: IePosLinkActions }): JSX.Element {
  const { posLink, editable } = useIeWorkbook();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectId = useId();
  const linkedId = posLink.linkedPosWorkbookId;
  const linked = options?.find((option) => option.workbookId === linkedId);
  const shownError = error ?? loadError;

  function onLink(workbookId: string): void {
    if (links === undefined || !editable) return;
    setBusy(true);
    setError(null);
    (workbookId.length === 0 ? links.unlink() : links.link(workbookId))
      .catch((failure: Error) => setError(failure.message))
      .finally(() => setBusy(false));
  }

  return (
    <div className="ieiface__lane">
      <div className="ieiface__link">
        <label className="posfield__label" htmlFor={selectId}>Source workbook</label>
        <select
          id={selectId}
          className="posfield__select"
          value={linkedId ?? ""}
          disabled={!editable || links === undefined || busy || options === null}
          onChange={(event) => onLink(event.target.value)}
        >
          <option value="">{options !== null && options.length === 0 && linkedId === null ? "No POS workbooks in this project" : "Not linked"}</option>
          {(options ?? []).map((option) => <option key={option.workbookId} value={option.workbookId}>{option.name}</option>)}
          {linkedId !== null && linked === undefined && <option value={linkedId}>{posLink.linkedName ?? (linkedId.startsWith("example") ? "Example POS workbook" : options === null ? "" : "POS workbook not in this project")}</option>}
        </select>
      </div>
      <HandoffImports consumer="IE" producer="POS" />
      {shownError !== null && <p className="ieiface__error" role="alert">{shownError}</p>}
    </div>
  );
}

function DaLane({ options, loadError }: IeLaneOptions): JSX.Element {
  const { ie, editable, mutateIe } = useIeWorkbook();
  const selectId = useId();
  const linkedId = ie.linkedWorkbooks?.DA;
  const linked = options?.find((option) => option.workbookId === linkedId);

  function onLink(workbookId: string): void {
    if (!editable) return;
    mutateIe((draft) => withDaLink(draft, workbookId));
  }

  return (
    <div className="ieiface__lane">
      <div className="ieiface__link">
        <label className="posfield__label" htmlFor={selectId}>Source workbook</label>
        <select
          id={selectId}
          className="posfield__select"
          value={linkedId ?? ""}
          disabled={!editable || options === null}
          onChange={(event) => onLink(event.target.value)}
        >
          <option value="">{options !== null && options.length === 0 && linkedId === undefined ? "No DA workbooks in this project" : "Not linked"}</option>
          {(options ?? []).map((option) => <option key={option.workbookId} value={option.workbookId}>{option.name}</option>)}
          {linkedId !== undefined && linked === undefined && <option value={linkedId}>{linkedId.startsWith(EXAMPLE_PREFIX) ? "Example DA workbook" : options === null ? "" : "DA workbook not in this project"}</option>}
        </select>
      </div>
      <HandoffImports consumer="IE" producer="DA" />
      {loadError !== null && <p className="ieiface__error" role="alert">{loadError}</p>}
    </div>
  );
}

function IeInterfaces({ posLinks }: { posLinks?: IePosLinkActions }): JSX.Element {
  const { projectId } = useIeWorkbook();
  const [selected, setSelected] = useState<IeLinkCode | null>("POS");
  const [posOptions, setPosOptions] = useState<IeLaneOptions>(NOT_LOADED);
  const [daOptions, setDaOptions] = useState<IeLaneOptions>(NOT_LOADED);

  useEffect(() => {
    if (posLinks === undefined) return;
    let cancelled = false;
    posLinks.available()
      .then((found) => { if (!cancelled) setPosOptions({ options: found, loadError: null }); })
      .catch((failure: Error) => { if (!cancelled) setPosOptions({ options: null, loadError: failure.message }); });
    return () => { cancelled = true; };
  }, [posLinks]);

  useEffect(() => {
    if (projectId === undefined) return;
    let cancelled = false;
    listWorkbooks(projectId, "DA")
      .then((result) => { if (!cancelled) setDaOptions({ options: result.workbooks.map((workbook) => ({ workbookId: workbook.id, name: workbook.name })), loadError: null }); })
      .catch((failure: Error) => { if (!cancelled) setDaOptions({ options: null, loadError: failure.message }); });
    return () => { cancelled = true; };
  }, [projectId]);

  return (
    <>
      <div className="poshandoff__grid">
        {IE_LINK_CODES.map((code) => (
          <button
            key={code}
            type="button"
            className={`poshandoff__tile${selected === code ? " poshandoff__tile--active" : ""}`}
            aria-pressed={selected === code}
            onClick={() => setSelected(selected === code ? null : code)}
          >
            <span className="poshandoff__tile-code">{code}</span>
            <span className="poshandoff__tile-name">{HANDOFF_ELEMENT_NAMES[code]}</span>
          </button>
        ))}
      </div>
      {selected === "POS" && <PosLane links={posLinks} options={posOptions.options} loadError={posOptions.loadError} />}
      {selected === "DA" && <DaLane options={daOptions.options} loadError={daOptions.loadError} />}
    </>
  );
}

export { IeInterfaces };
export type { IePosLinkActions };
