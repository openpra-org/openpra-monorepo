import { useId, useRef, useState, type JSX } from "react";
import type { RcHealthParameterRecord } from "interfaces-mef-types/rc/health-inputs";
import { parseRcHealthInput, rcHealthEffectLabel } from "interfaces-shared-types/rc-workbooks/health-input-parser";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RCIcon } from "./rcIcons";
import "./css/rcHealthInputs.css";

type Tab = "effects" | "model" | "sources";
const words = (value: string) => value.toLowerCase().replace(/_/g, " ");
const number = (value: number) => value !== 0 && (value < 0.001 || value >= 1e6) ? value.toExponential(3) : String(value);

export function RcHealthPanel({ openEditor }: { openEditor: (kind: "healthparams" | "riskfactor", index: string) => void }): JSX.Element {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const he = rc.healthEffects;
  const [tab, setTab] = useState<Tab>("effects"), [viewFile, setViewFile] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null), tabs = useRef<HTMLDivElement>(null), id = useId();
  const records = he.healthInput?.records ?? [];
  const setList = (kind: "earlyHealthEffects" | "latentHealthEffects", list: string[]) =>
    mutateRc(draft => ({ ...draft, healthEffects: { ...draft.healthEffects, [kind]: list } }));
  const toggle = (record: RcHealthParameterRecord) => {
    const kind = record.kind === "latent_cancer" ? "latentHealthEffects" : "earlyHealthEffects";
    const label = rcHealthEffectLabel(record), list = he[kind];
    setList(kind, list.includes(label) ? list.filter(value => value !== label) : [...list, label]);
  };
  const importFile = async (file: File) => {
    setBusy(true); setError("");
    try {
      if (!/\.(inp|txt)$/i.test(file.name)) throw new Error("Choose an .inp or .txt file.");
      if (file.size > 128_000) throw new Error("Choose a file up to 128 KB.");
      const parsed = parseRcHealthInput(await file.text(), file.name);
      mutateRc(draft => ({ ...draft, healthEffects: {
        ...draft.healthEffects,
        healthInput: parsed,
        earlyHealthEffects: parsed.records.filter(record => record.kind === "early_fatality").map(rcHealthEffectLabel),
        latentHealthEffects: parsed.records.filter(record => record.kind === "latent_cancer").map(rcHealthEffectLabel),
      } }));
      setViewFile(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not read health input."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const addSource = () => {
    mutateRc(draft => ({ ...draft, healthEffects: { ...draft.healthEffects, riskFactorSources: [...draft.healthEffects.riskFactorSources, { source: "", recognizedBody: "" }] } }));
    openEditor("riskfactor", String(he.riskFactorSources.length));
  };
  const manuallyEdit = (kind: "earlyHealthEffects" | "latentHealthEffects", index: number, value?: string) => {
    const list = he[kind];
    setList(kind, value === undefined ? list.filter((_, i) => i !== index) : index === list.length ? [...list, value] : list.map((item, i) => i === index ? value : item));
  };
  const review = (name: string, items: { label: string; value: string }[]) => <table className="rh-review" aria-label={name}><tbody>{items.map(item => <tr key={item.label}><th scope="row">{item.label}</th><td>{item.value || "Not recorded"}</td></tr>)}</tbody></table>;
  const selection = (kind: "earlyHealthEffects" | "latentHealthEffects", title: string) => <section className="rh-manual"><h4>{title}</h4>{he[kind].map((effect, index) => <div className="rh-manual-row" key={index}><WorkbookInput className="posfield__input" aria-label={`${title} ${index + 1}`} value={effect} disabled={!editable} onChange={event => manuallyEdit(kind, index, event.target.value)} />{editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => manuallyEdit(kind, index)}>Remove</button>}</div>)}{editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => manuallyEdit(kind, he[kind].length, "")}><RCIcon.Plus /> Add effect</button>}</section>;
  const group = (kind: RcHealthParameterRecord["kind"], title: string) => {
    const rows = records.filter(record => record.kind === kind);
    if (!rows.length) return null;
    return <section className="rh-group"><h3>{title} <span>{rows.length}</span></h3><div className="rh-table-wrap"><table aria-label={title}><thead><tr><th scope="col">Use</th><th scope="col">Effect</th><th scope="col">Organ</th><th scope="col">Card</th><th scope="col">Parameters in file</th></tr></thead><tbody>{rows.map(record => {
      const list = record.kind === "latent_cancer" ? he.latentHealthEffects : he.earlyHealthEffects;
      return <tr key={record.cardId}><td><input type="checkbox" aria-label={`Use ${rcHealthEffectLabel(record)}`} checked={list.includes(rcHealthEffectLabel(record))} disabled={!editable} onChange={() => toggle(record)} /></td><td>{rcHealthEffectLabel(record)}</td><td>{record.organ}</td><td className="rh-mono">{record.cardId}</td><td className="rh-values">{kind === "early_fatality" ? <>α {number(record.values[0])} Sv · β {number(record.values[1])} · threshold {number(record.values[2])} Sv</> : kind === "latent_cancer" ? <>fatality {number(record.values[3])} /Sv · incidence {number(record.values[4])} /Sv <span>· all values: {record.values.map(number).join(" · ")}</span></> : record.values.map(number).join(" · ")}</td></tr>;
    })}</tbody></table></div></section>;
  };
  return <div className="poscard rh-card"><div className="poscard__head"><WorkbookSectionHeading workbook="RC" title="Health-effect inputs" level={3} /></div><section className="rh" aria-label="Health-effect inputs">
    <div className="rh-tabs" role="tablist" aria-label="Health-effect sections" ref={tabs} onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault(); const order: Tab[] = ["effects", "model", "sources"], index = order.indexOf(tab);
      const next = event.key === "Home" ? order[0] : event.key === "End" ? order[2] : order[(index + (event.key === "ArrowRight" ? 1 : 2)) % 3];
      setTab(next); tabs.current?.querySelectorAll<HTMLButtonElement>("button")[order.indexOf(next)]?.focus();
    }}>{(["effects", "model", "sources"] as const).map(value => <button type="button" role="tab" id={`${id}-${value}`} aria-controls={`${id}-panel`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} key={value} onClick={() => setTab(value)}>{value === "effects" ? "Effects and file" : value === "model" ? "Model" : "Sources"}</button>)}</div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} tabIndex={0}>
      {tab === "effects" && <><div className="rh-file"><div className="rh-file-info"><span>Health parameter file</span><strong>{he.healthInput?.filename ?? "No file selected"}</strong><span>.inp · .txt</span></div><div className="rh-actions">{editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={() => input.current?.click()}>{he.healthInput ? <RCIcon.Refresh /> : <RCIcon.Plus />}{he.healthInput ? "Replace file" : "Import file"}</button>}{he.healthInput && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setViewFile(!viewFile)}><RCIcon.Eye />{viewFile ? "Hide file" : "View file"}</button>}</div><input ref={input} type="file" accept=".inp,.txt" hidden aria-label="Import health parameter file" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void importFile(file); }} /></div>
        {error && <p className="rh-error" role="alert">{error}</p>}{viewFile && he.healthInput && <pre className="rh-original" aria-label="Original health parameter file">{he.healthInput.original}</pre>}
        {records.length ? <>{group("early_fatality", "Early fatality")}{group("early_injury", "Early injury")}{group("latent_cancer", "Latent cancer")}</> : <div className="rh-manual-grid">{selection("earlyHealthEffects", "Early effects")}{selection("latentHealthEffects", "Latent effects")}</div>}</>}
      {tab === "model" && <><div className="rh-heading"><h3>Effect treatment</h3>{editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openEditor("healthparams", "he")}><RCIcon.Settings /> Edit treatment</button>}</div>{review("Health-effect treatment", [
        { label: "Early effects", value: `${words(he.earlyEffectParameters.approach)}${he.earlyEffectParameters.description ? ` · ${he.earlyEffectParameters.description}` : ""}` },
        { label: "Latent effects", value: `${words(he.latentEffectParameters.approach)}${he.latentEffectParameters.description ? ` · ${he.latentEffectParameters.description}` : ""}` },
        { label: "Age and gender", value: he.ageGenderHomogeneous ? "Homogeneous" : "Not homogeneous" },
        { label: "Parameter uncertainty", value: he.parameterUncertaintyCharacterization ?? "" },
      ])}</>}
      {tab === "sources" && <><div className="rh-heading"><h3>Risk-factor sources</h3>{editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSource}><RCIcon.Plus /> Add source</button>}</div>{he.riskFactorSources.length ? <table className="rh-sources" aria-label="Risk-factor sources"><thead><tr><th>Source</th><th>Recognized body</th><th>Version</th><th></th></tr></thead><tbody>{he.riskFactorSources.map((source, index) => <tr key={index}><td>{source.source || "Not recorded"}</td><td>{source.recognizedBody || "Not recorded"}</td><td>{source.version || "Not recorded"}</td><td><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openEditor("riskfactor", String(index))}>View{editable ? " / edit" : ""}</button></td></tr>)}</tbody></table> : <p className="rh-empty">No risk-factor source recorded.</p>}</>}
    </div></section></div>;
}
