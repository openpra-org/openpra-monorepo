import { type JSX, type ReactNode, useEffect, useState } from "react";

function Field({ label, hint, children, wide = false }: { label: string; hint?: string; children: ReactNode; wide?: boolean }): JSX.Element {
  return <label className={`sfield${wide ? " sfield--wide" : ""}`}><span className="sfield__label">{label}</span>{children}{hint !== undefined && <span className="sfield__hint">{hint}</span>}</label>;
}

function TextInput({ value, onChange, disabled, placeholder }: { value: string; onChange: (value: string) => void; disabled?: boolean; placeholder?: string }): JSX.Element {
  return <input className="sinput" value={value} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

function NumberInput({ value, onChange, disabled, step = "any" }: { value: number; onChange: (value: number) => void; disabled?: boolean; step?: string }): JSX.Element {
  return <input className="sinput sinput--number" type="number" step={step} value={Number.isFinite(value) ? value : 0} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />;
}

function TextArea({ value, onChange, disabled, rows = 4, placeholder }: { value: string; onChange: (value: string) => void; disabled?: boolean; rows?: number; placeholder?: string }): JSX.Element {
  return <textarea className="stextarea" value={value} disabled={disabled} rows={rows} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

function SelectInput({ value, onChange, options, disabled }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; disabled?: boolean }): JSX.Element {
  return <select className="sinput" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

function Section({ eyebrow, title, description, actions, children, tone = "default" }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; children: ReactNode; tone?: "default" | "sha" | "sfr" | "spr" | "integration" }): JSX.Element {
  return <section className={`ssection ssection--${tone}`}>
    <div className="ssection__head"><div>{eyebrow !== undefined && <div className="ssection__eyebrow">{eyebrow}</div>}<h2 className="ssection__title">{title}</h2>{description !== undefined && <p className="ssection__description">{description}</p>}</div>{actions !== undefined && <div className="ssection__actions">{actions}</div>}</div>
    <div className="ssection__body">{children}</div>
  </section>;
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }): JSX.Element {
  return <div className="sempty"><div className="sempty__mark">◇</div><strong>{title}</strong><p>{detail}</p>{action}</div>;
}

function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "sha" | "sfr" | "spr" | "good" | "warn" | "bad" }): JSX.Element {
  return <span className={`stag stag--${tone}`}>{children}</span>;
}

function AdvancedJsonEditor<T>({ title, value, editable, onApply }: { title: string; value: T; editable: boolean; onApply: (value: T) => void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!open) setText(JSON.stringify(value, null, 2)); }, [open, value]);
  function apply(): void {
    try {
      onApply(JSON.parse(text) as T);
      setError(null);
      setOpen(false);
    } catch (err) {
      setError((err as { message?: string }).message ?? "Invalid JSON");
    }
  }
  return <div className="sadvanced">
    <button type="button" className="sadvanced__toggle" onClick={() => setOpen((current) => !current)}><span>{open ? "▾" : "▸"}</span> Advanced MEF data · {title}</button>
    {open && <div className="sadvanced__body"><p>Every field in this schema section is available here. Changes are validated by the Seismic PRA API when autosaved.</p><textarea className="sadvanced__editor" value={text} rows={18} readOnly={!editable} onChange={(event) => setText(event.target.value)} />{error !== null && <div className="sadvanced__error">{error}</div>}{editable && <div className="sadvanced__actions"><button type="button" className="sbtn sbtn--primary" onClick={apply}>Apply section data</button></div>}</div>}
  </div>;
}

export { Field, TextInput, NumberInput, TextArea, SelectInput, Section, EmptyState, Tag, AdvancedJsonEditor };
