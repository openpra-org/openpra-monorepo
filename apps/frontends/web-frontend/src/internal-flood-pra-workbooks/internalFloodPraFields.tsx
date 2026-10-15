import { type JSX, type ReactNode } from "react";
import { POSIcon } from "../pos-workbooks/posIcons";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";

export function Field({ label, hint, children, wide = false }: { label: string; hint?: string; children: ReactNode; wide?: boolean }): JSX.Element {
  return <label className={`flfield${wide ? " flfield--wide" : ""}`}><span className="flfield__label">{label}</span>{children}{hint !== undefined && <span className="flfield__hint">{hint}</span>}</label>;
}

export function TextInput({ value, onChange, disabled, placeholder }: { value: string; onChange: (value: string) => void; disabled?: boolean; placeholder?: string }): JSX.Element {
  return <WorkbookInput className="flinput" value={value} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

export function NumberInput({ value, onChange, disabled }: { value: number; onChange: (value: number) => void; disabled?: boolean }): JSX.Element {
  return <WorkbookInput className="flinput flinput--number" type="number" step="any" value={Number.isFinite(value) ? value : 0} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />;
}

export function TextArea({ value, onChange, disabled, rows = 4, placeholder }: { value: string; onChange: (value: string) => void; disabled?: boolean; rows?: number; placeholder?: string }): JSX.Element {
  return <WorkbookTextarea className="fltextarea" value={value} disabled={disabled} rows={rows} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

export function SelectInput({ value, onChange, options, disabled }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; disabled?: boolean }): JSX.Element {
  return <select className="flinput" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }): JSX.Element {
  return <section className="flsection"><div className="flsection__head"><div className="flsection__heading"><h2>{title}</h2></div>{actions !== undefined && <div className="flsection__actions">{actions}</div>}</div><div className="flsection__body">{children}</div></section>;
}

export function Drawer({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }): JSX.Element {
  return <div className="posdrawer-backdrop fldrawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><aside className="posdrawer fldrawer" role="dialog" aria-modal="true" aria-label={title}><div className="posdrawer__head"><div><div className="posdrawer__cap">Internal Flood PRA · Flat record editor</div><div className="flsection__heading"><h2 className="posdrawer__title">{title}</h2></div></div><button type="button" className="posdrawer__close" onClick={onClose} aria-label="Close editor"><POSIcon.Close /></button></div><div className="posdrawer__body fldrawer__body">{children}</div>{footer !== undefined && <div className="fldrawer__footer">{footer}</div>}</aside></div>;
}
