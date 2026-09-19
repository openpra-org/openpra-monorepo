import { useEffect, useState, type ReactNode } from "react";
import type { ValidationIssue } from "interfaces-shared-types/newly-developed-methods/shared";
import { downloadResultCsv, type ResultCsvRecord } from "./resultCsv";
import "./css/resultPresentation.css";

/** HCL_MH BNEditorPanel._append_query_result_row uses 12 significant digits. */
export function formatResultNumber(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toPrecision(12))) : "Unavailable";
}

export function ResultNumber({ value, unit = "" }: { value: number; unit?: string }) {
  return (
    <output title={`${String(value)}${unit}`}>
      {formatResultNumber(value)}
      {unit}
    </output>
  );
}

export function ResultCsvButton({
  filename,
  records,
}: {
  filename: string;
  records: () => readonly ResultCsvRecord[];
}) {
  return (
    <button
      type="button"
      className="posnav__btn posnav__btn--sm"
      onClick={() => downloadResultCsv(filename, records())}
    >
      Export results CSV
    </button>
  );
}

export function ResultWarnings({ issues }: { issues: readonly ValidationIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div
      className="analysis-results__warnings"
      aria-label="Run validation issues"
    >
      <strong>Run validation issues ({issues.length})</strong>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.code}:${index}`}>
            <strong>{issue.severity}</strong> {issue.message} <small>{issue.code}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Only the visible slice is rendered. CSV buttons receive the complete result separately. */
export function PagedResults<T>({
  items,
  label,
  resetKey,
  children,
}: {
  items: readonly T[];
  label: string;
  resetKey: string;
  children: (page: readonly T[]) => ReactNode;
}) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  useEffect(() => {
    setPage(0);
  }, [resetKey]);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages - 1);
  const start = current * size;
  return (
    <div className="analysis-results__pages">
      {items.length === 0 ?
        <p>No result rows.</p>
      : children(items.slice(start, start + size))}
      {items.length > 25 && (
        <nav
          className="analysis-results__pagination"
          aria-label={`${label} pagination`}
        >
          <span aria-live="polite">
            {start + 1}–{Math.min(start + size, items.length)} of {items.length}
          </span>
          <label>
            Rows per page{" "}
            <select
              value={size}
              onChange={(event) => {
                setSize(Number(event.target.value));
                setPage(0);
              }}
            >
              {[25, 50, 100].map((count) => (
                <option
                  key={count}
                  value={count}
                >
                  {count}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="posnav__btn posnav__btn--sm"
            disabled={current === 0}
            onClick={() => setPage(0)}
          >
            First
          </button>
          <button
            type="button"
            className="posnav__btn posnav__btn--sm"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </button>
          <span>
            Page {current + 1} of {pages}
          </span>
          <button
            type="button"
            className="posnav__btn posnav__btn--sm"
            disabled={current === pages - 1}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
          <button
            type="button"
            className="posnav__btn posnav__btn--sm"
            disabled={current === pages - 1}
            onClick={() => setPage(pages - 1)}
          >
            Last
          </button>
        </nav>
      )}
    </div>
  );
}
