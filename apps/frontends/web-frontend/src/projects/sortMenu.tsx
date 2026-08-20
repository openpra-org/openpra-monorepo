import { JSX, useEffect, useRef, useState } from "react";
import { CaretIcon, CheckIcon, SortIcon } from "../welcome/icons";
import "./css/sortMenu.css";

type SortKey =
  | "edited-desc"
  | "edited-asc"
  | "name-asc"
  | "name-desc"
  | "progress-desc"
  | "progress-asc";

const OPTIONS: { id: SortKey; label: string }[] = [
  { id: "edited-desc", label: "Last edited (newest)" },
  { id: "edited-asc", label: "Last edited (oldest)" },
  { id: "name-asc", label: "Name (A–Z)" },
  { id: "name-desc", label: "Name (Z–A)" },
  { id: "progress-desc", label: "Progress (high → low)" },
  { id: "progress-asc", label: "Progress (low → high)" },
];

function SortMenu({ sort, setSort }: { sort: SortKey; setSort: (s: SortKey) => void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("mousedown", onClick); };
  }, [open]);
  const active = OPTIONS.find((o) => o.id === sort) ?? OPTIONS[0];

  return (
    <div className="ap__sort" ref={ref}>
      <button
        type="button"
        className="ap__sort-btn"
        onClick={() => { setOpen((o) => !o); }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <SortIcon /> <span>{active.label}</span> <CaretIcon />
      </button>
      {open && (
        <div className="ap__sort-pop" role="menu">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitemradio"
              aria-checked={o.id === sort}
              className={`ap__sort-opt${o.id === sort ? " ap__sort-opt--active" : ""}`}
              onClick={() => { setSort(o.id); setOpen(false); }}
            >
              {o.label}
              {o.id === sort && <span className="ap__sort-check"><CheckIcon /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { SortMenu };
export type { SortKey };
