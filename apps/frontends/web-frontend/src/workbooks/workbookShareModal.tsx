import { type FormEvent, type JSX, useEffect, useState } from "react";
import type { WorkbookShareAccess, WorkbookShareEntry, WorkbookSharesResponse } from "interfaces-shared-types/workbooks";
import { UserTypeahead } from "../users/userTypeahead";
import { CloseIcon } from "./reviewIcons";
import "./css/workbookShareModal.css";

interface WorkbookShareActions {
  load: () => Promise<WorkbookSharesResponse>;
  add: (identifier: string, access: WorkbookShareAccess) => Promise<WorkbookSharesResponse>;
  update: (username: string, access: WorkbookShareAccess) => Promise<WorkbookSharesResponse>;
  remove: (username: string) => Promise<WorkbookSharesResponse>;
}

const ACCESS_OPTIONS: { value: WorkbookShareAccess; label: string }[] = [
  { value: "edit", label: "Can edit" },
  { value: "view", label: "Can view" },
];

function accessOf(value: string): WorkbookShareAccess {
  return value === "view" ? "view" : "edit";
}

function WorkbookShareModal({ title, actions, onClose }: { title: string; actions: WorkbookShareActions; onClose: () => void }): JSX.Element {
  const [entries, setEntries] = useState<WorkbookShareEntry[]>([]);
  const [identifier, setIdentifier] = useState("");
  const [access, setAccess] = useState<WorkbookShareAccess>("edit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    actions.load()
      .then((shares) => { if (!cancelled) setEntries(shares.entries); })
      .catch((failure: Error) => { if (!cancelled) setError(failure.message); });
    return () => { cancelled = true; };
  }, [actions]);

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      const listOpen = event.target instanceof HTMLElement && event.target.getAttribute("aria-expanded") === "true";
      if (event.key === "Escape" && !busy && !listOpen) onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); };
  }, [busy, onClose]);

  function run(work: () => Promise<WorkbookSharesResponse>, after?: () => void): void {
    setBusy(true);
    setError(null);
    work()
      .then((shares) => {
        setEntries(shares.entries);
        after?.();
      })
      .catch((failure: Error) => { setError(failure.message); })
      .finally(() => { setBusy(false); });
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const person = identifier.trim();
    if (person === "") return;
    run(() => actions.add(person, access), () => { setIdentifier(""); });
  }

  return (
    <div className="wbshare-overlay" onClick={() => { if (!busy) onClose(); }}>
      <div className="wbshare-modal" role="dialog" aria-modal="true" aria-labelledby="wbshare-title" onClick={(event) => { event.stopPropagation(); }}>
        <header className="wbshare__head">
          <h2 className="wbshare__title" id="wbshare-title">{title}</h2>
          <button type="button" className="wbshare__close" onClick={onClose} aria-label="Close" disabled={busy}><CloseIcon /></button>
        </header>

        {error !== null && <p className="wbshare__error" role="alert">{error}</p>}

        <form className="wbshare__add" onSubmit={submit} noValidate>
          <UserTypeahead
            value={identifier}
            onChange={setIdentifier}
            placeholder="Username or email"
            ariaLabel="Username or email"
            disabled={busy}
            className="wbshare__person"
          />
          <select className="wbshare__access" value={access} onChange={(event) => { setAccess(accessOf(event.target.value)); }} disabled={busy} aria-label="Access for the new person">
            {ACCESS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button type="submit" className="wbshare__share-btn" disabled={busy || identifier.trim() === ""}>Share</button>
        </form>

        {entries.length > 0 && (
          <section className="wbshare__section" aria-labelledby="wbshare-people">
            <h3 className="wbshare__subtitle" id="wbshare-people">People with access</h3>
            <ul className="wbshare__list">
              {entries.map((entry) => (
                <li key={entry.username} className="wbshare__row">
                  <span className="wbshare__who">
                    <span className="wbshare__name">{entry.fullName}</span>
                    <span className="wbshare__username">@{entry.username}</span>
                  </span>
                  <select
                    className="wbshare__access"
                    value={entry.access}
                    onChange={(event) => { const next = accessOf(event.target.value); run(() => actions.update(entry.username, next)); }}
                    disabled={busy}
                    aria-label={`Access for ${entry.fullName}`}
                  >
                    {ACCESS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <button type="button" className="wbshare__remove" onClick={() => { run(() => actions.remove(entry.username)); }} disabled={busy}>Remove</button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

export { WorkbookShareModal, type WorkbookShareActions };
