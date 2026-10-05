import { JSX, ReactNode, useRef, type KeyboardEvent } from "react";
import { DAIcon } from "./daIcons";

type BadgeKind = "ok" | "warn" | "block" | "progress" | "draft";

function Badge({ kind, children }: { kind?: BadgeKind; children: ReactNode }): JSX.Element {
  return (
    <span className={`posbadge${kind !== undefined ? ` posbadge--${kind}` : ""}`}>
      {kind !== undefined && <span className="posbadge__dot" />}
      {children}
    </span>
  );
}

function DaProvenanceChip({ children }: { children: ReactNode }): JSX.Element {
  return <span className="esprov">{children}</span>;
}

function PlotToggle({ open, label, onToggle }: { open: boolean; label: string; onToggle: () => void }): JSX.Element {
  return (
    <button type="button" className="da-rowtable__plot" aria-expanded={open} aria-label={`${open ? "Hide" : "Plot"} the distribution of ${label}`} onClick={(event) => { event.stopPropagation(); onToggle(); }}>
      {open ? "Hide" : "Plot"}
    </button>
  );
}

function DetailToggle({ open, label, onToggle }: { open: boolean; label: string; onToggle: () => void }): JSX.Element {
  return (
    <button type="button" className="da-rowtable__plot" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} the details of ${label}`} onClick={(event) => { event.stopPropagation(); onToggle(); }}>
      {open ? "Hide" : "Show"}
    </button>
  );
}

function DetailRow({ span, width, children }: { span: number; width: number; children: ReactNode }): JSX.Element {
  return (
    <tr className="da-rowtable__detail-row">
      <td colSpan={span} className="da-rowtable__detail">
        <div className="da-rowtable__detail-inner" style={width > 0 ? { width: `${width}px` } : undefined}>{children}</div>
      </td>
    </tr>
  );
}

function FieldList({ items }: { items: { label: string; value: string }[] }): JSX.Element {
  return (
    <dl className="da-fields">
      {items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
    </dl>
  );
}

function ClampCell({ text }: { text: string }): JSX.Element {
  const value = text.trim();
  return <td className="da-rowtable__text da-rowtable__long">{value.length === 0 ? "—" : <div className="da-rowtable__clamp" title={value}>{value}</div>}</td>;
}

function rowClass(muted: boolean, open: boolean): string | undefined {
  const names = [muted ? "da-rowtable__muted" : "", open ? "da-rowtable__row--on" : ""].filter((name) => name.length > 0);
  return names.length === 0 ? undefined : names.join(" ");
}

function FormRow({ label, htmlFor, top = false, children }: { label: string; htmlFor?: string; top?: boolean; children: ReactNode }): JSX.Element {
  return (
    <div className={`da-form__row${top ? " da-form__row--top" : ""}`}>
      <label className="posfield__label da-form__label" htmlFor={htmlFor}>{label}</label>
      <div className="da-form__control">{children}</div>
    </div>
  );
}

function FormFoot({ onClose, children }: { onClose: () => void; children?: ReactNode }): JSX.Element {
  return (
    <div className="modal__foot da-form__foot">
      {children}
      <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary da-form__done" onClick={onClose}>Done</button>
    </div>
  );
}

function ModalHead({ cap, title, onClose }: { cap: string; title: string; onClose: () => void }): JSX.Element {
  return (
    <div className="modal__head">
      <div>
        <div className="posdrawer__cap">{cap}</div>
        <h2 className="modal__title">{title}</h2>
      </div>
      <button type="button" className="modal__close" onClick={onClose} aria-label="Close"><DAIcon.Close /></button>
    </div>
  );
}

function DaTabs<T extends string>({ label, tabs, active, onChange, idBase, className }: {
  label: string;
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  idBase: string;
  className: string;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const index = tabs.findIndex((t) => t.id === active);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    const next = tabs[nextIndex];
    if (next === undefined) return;
    onChange(next.id);
    ref.current?.querySelectorAll<HTMLButtonElement>("button")[nextIndex]?.focus();
  }

  return (
    <div className={className} role="tablist" aria-label={label} ref={ref} onKeyDown={onKeyDown}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`${idBase}-${t.id}`}
          aria-controls={`${idBase}-panel`}
          aria-selected={t.id === active}
          tabIndex={t.id === active ? 0 : -1}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function sciText(v: number): string {
  if (!Number.isFinite(v) || v === 0) return String(v);
  const [mantissa, exponent] = v.toExponential(2).split("e");
  const power = Number(exponent);
  const digits = String(Number(mantissa));
  return power === 0 ? digits : `${digits}E${power}`;
}

function valText(v: number | undefined | null): string {
  if (v === undefined || v === null) return "—";
  return v.toExponential(1).replace("e", "E");
}

export { Badge, ClampCell, DaProvenanceChip, DaTabs, DetailRow, DetailToggle, FieldList, FormFoot, FormRow, ModalHead, PlotToggle, rowClass, sciText, valText, type BadgeKind };
