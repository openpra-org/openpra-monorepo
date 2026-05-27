import { JSX, FormEvent, useMemo, useState } from "react";
import { type Workbook } from "interfaces-shared-types";
import { FolderIcon, PlusIcon, SearchIcon } from "../welcome/icons";
import { WorkbookRow } from "./workbookRow";
import { useWorkbooks } from "./useWorkbooks";
import "./css/workbooks.css";

interface LegacyElementPaneProps {
  projectId: string;
  element: { code: string; name: string };
  readOnly: boolean;
  onOpenWorkbook: (workbook: Workbook) => void;
  onError: (message: string) => void;
}

function LegacyElementPane({
  projectId,
  element,
  readOnly,
  onOpenWorkbook,
  onError,
}: LegacyElementPaneProps): JSX.Element {
  const { workbooks, loading, create } = useWorkbooks(projectId, element.code, onError);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workbooks;
    return workbooks.filter((w) => w.name.toLowerCase().includes(q) || w.ownerInitials.toLowerCase().includes(q));
  }, [workbooks, query]);

  function submitNew(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const name = newName.trim();
    if (name.length === 0) return;
    setSubmitting(true);
    create(name)
      .then(() => { setCreating(false); setNewName(""); })
      .catch((err: unknown) => { onError((err as { message?: string }).message ?? "Could not create workbook"); })
      .finally(() => { setSubmitting(false); });
  }

  const count = workbooks.length;

  return (
    <div className="lgl__work">
      <div className="lgl__work-head">
        <div className="lgl__work-crumb">
          <span className="lgl__work-crumb-code">{element.code}</span>
          <span className="lgl__work-crumb-tool">{element.name}</span>
        </div>
        {!readOnly && !creating && (
          <button type="button" className="btn btn--primary btn--sm" onClick={() => { setCreating(true); }}>
            <PlusIcon /> New workbook
          </button>
        )}
      </div>

      <h2 className="lgl__work-h">{element.name}</h2>
      <p className="lgl__work-sub">
        {count} workbook{count === 1 ? "" : "s"} in {element.name}.
      </p>

      {creating && (
        <form className="wbnew" onSubmit={submitNew}>
          <input
            className="wbnew__input"
            type="text"
            autoFocus
            placeholder="Name your workbook…"
            value={newName}
            onChange={(e) => { setNewName(e.target.value); }}
          />
          <button type="submit" className="btn btn--primary btn--sm" disabled={submitting || newName.trim().length === 0}>
            {submitting ? "Creating…" : "Create"}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setCreating(false); setNewName(""); }} disabled={submitting}>
            Cancel
          </button>
        </form>
      )}

      <div className="wbsearch wbsearch--block">
        <span className="wbsearch__icon"><SearchIcon /></span>
        <input
          className="wbsearch__input"
          type="text"
          placeholder="Search workbooks…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); }}
        />
      </div>

      {loading ? (
        <p className="wbstatus">Loading workbooks…</p>
      ) : visible.length === 0 ? (
        <div className="wbempty">
          <FolderIcon />
          {query.trim() ? (
            <>
              <p>No workbooks match &ldquo;{query.trim()}&rdquo;.</p>
              <button type="button" className="btn btn--link" onClick={() => { setQuery(""); }}>Clear search</button>
            </>
          ) : (
            <p>No workbooks yet.</p>
          )}
        </div>
      ) : (
        <div className="wblist">
          {visible.map((wb) => (<WorkbookRow key={wb.id} workbook={wb} onOpen={onOpenWorkbook} />))}
        </div>
      )}
    </div>
  );
}

export { LegacyElementPane };
