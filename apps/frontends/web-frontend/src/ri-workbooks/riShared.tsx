import { JSX, ReactNode, useRef, type KeyboardEvent } from "react";
import { RIIcon } from "./riIcons";

type BadgeKind = "ok" | "warn" | "block" | "progress" | "draft";

function Badge({ kind, children }: { kind?: BadgeKind; children: ReactNode }): JSX.Element {
  return (
    <span className={`posbadge${kind !== undefined ? ` posbadge--${kind}` : ""}`}>
      {kind !== undefined && <span className="posbadge__dot" />}
      {children}
    </span>
  );
}

function RiProvenanceChip({ children }: { children: ReactNode }): JSX.Element {
  return (
    <span className="esprov">
      <RIIcon.Link /> {children}
    </span>
  );
}

function RiTabs<T extends string>({ label, tabs, active, onChange, idBase, className }: {
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

function valText(v: number | undefined | null): string {
  if (v === undefined || v === null) return "n/a";
  return v.toExponential(1).replace("e", "E");
}

function sciText(v: number): string {
  if (!Number.isFinite(v) || v === 0) return String(v);
  const [mantissa, exponent] = v.toExponential(2).split("e");
  const power = Number(exponent);
  const digits = String(Number(mantissa));
  return power === 0 ? digits : `${digits}E${power}`;
}

function shareText(value: number | undefined): string {
  if (value === undefined) return "—";
  const percent = value * 100;
  return percent >= 0.1 ? `${Number(percent.toPrecision(3))}%` : `${sciText(percent)}%`;
}

export { Badge, RiProvenanceChip, RiTabs, sciText, shareText, valText, type BadgeKind };
