import { type JSX, type ReactNode, useId, useState } from "react";
import { POSIcon } from "../pos-workbooks/posIcons";
import { composeWorkbookCue } from "../workbooks/workbookCueContent";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";

function Field({ label, hint, children, wide = false }: { label: string; hint?: string; children: ReactNode; wide?: boolean }): JSX.Element {
  return <label className={`sfield${wide ? " sfield--wide" : ""}`}><span className="sfield__label">{label}</span>{children}{hint !== undefined && <span className="sfield__hint">{hint}</span>}</label>;
}

function TextInput({ value, onChange, disabled, placeholder }: { value: string; onChange: (value: string) => void; disabled?: boolean; placeholder?: string }): JSX.Element {
  return <WorkbookInput className="sinput" value={value} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

function NumberInput({ value, onChange, disabled, step = "any" }: { value: number; onChange: (value: number) => void; disabled?: boolean; step?: string }): JSX.Element {
  return <WorkbookInput className="sinput sinput--number" type="number" step={step} value={Number.isFinite(value) ? value : 0} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />;
}

function TextArea({ value, onChange, disabled, rows = 4, placeholder }: { value: string; onChange: (value: string) => void; disabled?: boolean; rows?: number; placeholder?: string }): JSX.Element {
  return <WorkbookTextarea className="stextarea" value={value} disabled={disabled} rows={rows} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

function SelectInput({ value, onChange, options, disabled }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; disabled?: boolean }): JSX.Element {
  return <select className="sinput" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

function InfoButton({ children, label = "More information", kind = "help" }: { children: ReactNode; label?: string; kind?: "help" | "entry" }): JSX.Element {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  return <span className="sinfo">
    <button type="button" className={`sinfo__button sinfo__button--${kind}`} aria-label={label} aria-expanded={open} aria-controls={popoverId} onClick={() => setOpen((value) => !value)}>{kind === "entry" ? <POSIcon.Notice /> : <POSIcon.Help />}</button>
    {open && <span className="sinfo__popover" id={popoverId} role="note">{children}</span>}
  </span>;
}

function Section({ title, description, actions, children, tone = "default" }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; children: ReactNode; tone?: "default" | "sha" | "sfr" | "spr" | "integration" }): JSX.Element {
  return <section className={`ssection ssection--${tone}`}>
    <div className="ssection__head"><div className="ssection__heading"><h2 className="ssection__title">{title}</h2>{description !== undefined && <InfoButton label={`About ${title}`}>{composeWorkbookCue("SEISMIC", title, description)}</InfoButton>}</div>{actions !== undefined && <div className="ssection__actions">{actions}</div>}</div>
    <div className="ssection__body">{children}</div>
  </section>;
}

function EmptyState({ title, detail, action, showMark = true }: { title: string; detail: string; action?: ReactNode; showMark?: boolean }): JSX.Element {
  return <div className="sempty">{showMark && <div className="sempty__mark">◇</div>}<strong>{title}</strong><p>{detail}</p>{action}</div>;
}

function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "sha" | "sfr" | "spr" | "good" | "warn" | "bad" }): JSX.Element {
  return <span className={`stag stag--${tone}`}>{children}</span>;
}

function Drawer({ eyebrow, title, subtitle, plainHeader = false, onClose, children, footer }: { eyebrow?: string; title: string; subtitle?: string; plainHeader?: boolean; onClose: () => void; children: ReactNode; footer?: ReactNode }): JSX.Element {
  return <div className="posdrawer-backdrop sdrawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <aside className={`posdrawer sdrawer${plainHeader ? " sdrawer--plain" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="posdrawer__head">
        <div>{eyebrow !== undefined && <div className="posdrawer__cap">{eyebrow}</div>}<div className="sdrawer__heading"><h2 className="posdrawer__title">{title}</h2>{subtitle !== undefined && <InfoButton label={`About ${title}`}>{composeWorkbookCue("SEISMIC", title, subtitle)}</InfoButton>}</div></div>
        <button type="button" className="posdrawer__close" onClick={onClose} aria-label="Close editor"><POSIcon.Close /></button>
      </div>
      <div className="posdrawer__body sdrawer__body">{children}</div>
      {footer !== undefined && <div className="sdrawer__footer">{footer}</div>}
    </aside>
  </div>;
}

export { Field, TextInput, NumberInput, TextArea, SelectInput, InfoButton, Section, EmptyState, Tag, Drawer };
