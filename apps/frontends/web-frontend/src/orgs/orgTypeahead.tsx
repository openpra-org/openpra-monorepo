import { JSX, useEffect, useRef, useState, KeyboardEvent } from "react";
import { type OrgSearchHit } from "interfaces-shared-types";
import { searchOrgs } from "./orgsApi";
import "./css/orgTypeahead.css";

interface OrgTypeaheadProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  inputId?: string;
  className?: string;
}

function OrgTypeahead({
  value,
  onChange,
  placeholder,
  ariaLabel,
  disabled,
  inputId,
  className,
}: OrgTypeaheadProps): JSX.Element {
  const [hits, setHits] = useState<OrgSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      searchOrgs(trimmed)
        .then((res) => {
          if (cancelled) return;
          setHits(res.orgs);
          setActive(res.orgs.length > 0 ? 0 : -1);
        })
        .catch(() => { if (!cancelled) setHits([]); });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [value]);

  useEffect(() => {
    function onClick(e: globalThis.MouseEvent): void {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("mousedown", onClick); };
  }, []);

  function pick(hit: OrgSearchHit): void {
    onChange(hit.name);
    setOpen(false);
    setHits([]);
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>): void {
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? hits.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(hits[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && hits.length > 0;

  return (
    <div className={`oth${className ? ` ${className}` : ""}`} ref={wrapRef}>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); }}
        onKeyDown={handleKey}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={showList}
        autoComplete="off"
        disabled={disabled}
        className="field__input oth__input"
      />
      {showList && (
        <ul className="oth__list" role="listbox">
          {hits.map((hit, i) => (
            <li
              key={hit.id}
              role="option"
              aria-selected={i === active}
              className={`oth__item${i === active ? " oth__item--active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); pick(hit); }}
              onMouseEnter={() => { setActive(i); }}
            >
              <span className="oth__item-name">{hit.name}</span>
              <span className="oth__item-meta">{hit.memberCount} member{hit.memberCount === 1 ? "" : "s"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { OrgTypeahead };
