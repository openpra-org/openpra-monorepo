import { JSX, useEffect, useRef, useState, KeyboardEvent } from "react";
import { type UserSearchHit } from "interfaces-shared-types";
import { searchUsers } from "./userApi";
import "./css/userTypeahead.css";

interface UserTypeaheadProps {
  value: string;
  onChange: (next: string) => void;
  onPickUser?: (hit: UserSearchHit) => void;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  inputId?: string;
  className?: string;
}

function UserTypeahead({
  value,
  onChange,
  onPickUser,
  placeholder,
  ariaLabel,
  disabled,
  inputId,
  className,
}: UserTypeaheadProps): JSX.Element {
  const [hits, setHits] = useState<UserSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2 || trimmed.includes("@")) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      searchUsers(trimmed)
        .then((res) => {
          if (cancelled) return;
          setHits(res.users);
          setActive(res.users.length > 0 ? 0 : -1);
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

  function pick(hit: UserSearchHit): void {
    onChange(hit.username);
    setOpen(false);
    setHits([]);
    if (onPickUser) onPickUser(hit);
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
    <div className={`uth${className ? ` ${className}` : ""}`} ref={wrapRef}>
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
        className="field__input uth__input"
      />
      {showList && (
        <ul className="uth__list" role="listbox">
          {hits.map((hit, i) => (
            <li
              key={hit.username}
              role="option"
              aria-selected={i === active}
              className={`uth__item${i === active ? " uth__item--active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); pick(hit); }}
              onMouseEnter={() => { setActive(i); }}
            >
              {hit.avatarUrl !== null
                ? <img src={hit.avatarUrl} alt="" className="uth__avatar uth__avatar--img" />
                : <span className="uth__avatar" aria-hidden="true">{hit.initials}</span>}
              <span className="uth__item-body">
                <span className="uth__item-name">{hit.fullName}</span>
                <span className="uth__item-meta">@{hit.username}{hit.organization ? ` · ${hit.organization}` : ""}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { UserTypeahead };
