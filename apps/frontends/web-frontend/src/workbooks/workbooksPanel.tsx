import { JSX, FormEvent, useEffect, useMemo, useState } from "react";
import { type Workbook, type WorkbookStatus, type ToolId } from "interfaces-shared-types";
import { ArrowRightIcon, CloseIcon, FolderIcon, PlusIcon, SearchIcon } from "../welcome/icons";
import { WorkbookRow } from "./workbookRow";
import { useWorkbooks } from "./useWorkbooks";
import "./css/workbooks.css";

type SortKey = "edited" | "name" | "status";

const STATUS_ORDER: Record<WorkbookStatus, number> = { "in-progress": 0, draft: 1, complete: 2 };

interface WorkbooksPanelProps {
  projectId: string;
  element: { code: string; name: string };
  tool: { id: ToolId; name: string };
  readOnly: boolean;
  onClose: () => void;
  onOpenWorkbook: (workbook: Workbook) => void;
  onError: (message: string) => void;
}

function WorkbooksPanel({
  projectId,
  element,
  tool,
  readOnly,
  onClose,
  onOpenWorkbook,
  onError,
}: WorkbooksPanelProps): JSX.Element {
  const { workbooks, loading, create } = useWorkbooks(projectId, element.code, tool.id, onError);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("edited");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const visible = useMemo(() => {
    let list = workbooks.slice();
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((w) => w.name.toLowerCase().includes(q) || w.ownerInitials.toLowerCase().includes(q));
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "status") list.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    else list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return list;
  }, [workbooks, query, sort]);

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
    <div className="wbm__backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wbm" role="dialog" aria-modal="true" aria-label={`${tool.name} workbooks`}>
        <header className="wbm__head">
          <div className="wbm__crumb">
            <span className="wbm__crumb-code">{element.code}</span>
            <span className="wbm__crumb-name">{element.name}</span>
            <ArrowRightIcon />
            <span className="wbm__crumb-tool">{tool.name}</span>
          </div>
          <button type="button" className="wbm__close" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </header>

        <div className="wbm__title-row">
          <div className="wbm__title-block">
            <h2 className="wbm__title">{tool.name}</h2>
            <p className="wbm__sub">
              {count} workbook{count === 1 ? "" : "s"} · Pick one to open, or start a new analysis.
            </p>
          </div>
          {!readOnly && !creating && (
            <button type="button" className="btn btn--primary btn--sm" onClick={() => { setCreating(true); }}>
              <PlusIcon /> New workbook
            </button>
          )}
        </div>

        <div className="wbm__toolbar">
          <div className="wbsearch">
            <span className="wbsearch__icon"><SearchIcon /></span>
            <input
              className="wbsearch__input"
              type="text"
              placeholder={`Search ${tool.name.toLowerCase()}…`}
              value={query}
              onChange={(e) => { setQuery(e.target.value); }}
            />
            {query && (
              <button type="button" className="wbsearch__clear" onClick={() => { setQuery(""); }} aria-label="Clear">
                <CloseIcon />
              </button>
            )}
          </div>
          <div className="wbsort" role="group" aria-label="Sort workbooks">
            <button type="button" className={`wbsort__opt${sort === "edited" ? " wbsort__opt--active" : ""}`} onClick={() => { setSort("edited"); }}>Last edited</button>
            <button type="button" className={`wbsort__opt${sort === "name" ? " wbsort__opt--active" : ""}`} onClick={() => { setSort("name"); }}>Name</button>
            <button type="button" className={`wbsort__opt${sort === "status" ? " wbsort__opt--active" : ""}`} onClick={() => { setSort("status"); }}>Status</button>
          </div>
        </div>

        <div className="wbm__body">
          {creating && (
            <form className="wbnew" onSubmit={submitNew}>
              <input
                className="wbnew__input"
                type="text"
                autoFocus
                placeholder={`Name your ${tool.name.toLowerCase()} workbook…`}
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
                <p>No workbooks yet{readOnly ? "." : " — create the first one."}</p>
              )}
            </div>
          ) : (
            <div className="wblist">
              {visible.map((wb) => (<WorkbookRow key={wb.id} workbook={wb} onOpen={onOpenWorkbook} />))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { WorkbooksPanel };
