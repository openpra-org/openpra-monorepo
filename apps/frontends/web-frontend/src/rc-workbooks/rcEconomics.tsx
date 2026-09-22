import { useId, useRef, useState, type JSX, type ReactNode } from "react";
import type { RcEconomicCostCode } from "interfaces-mef-types/rc/economic-inputs";
import { parseRcSiteEconomy } from "interfaces-shared-types/rc-workbooks/economic-input-parser";
import { rcEconomicCostCoverage, rcEconomicCostIssues, rcEconomicCostSpecs } from "interfaces-shared-types/rc-workbooks/economic-costs";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RCIcon } from "./rcIcons";
import "./css/rcEconomics.css";

type Tab = "site" | "costs" | "review";
const codes = Object.keys(rcEconomicCostSpecs) as RcEconomicCostCode[];
const number = (value: number): string => value !== 0 && (value < .001 || value >= 1e6) ? value.toExponential(3) : value.toLocaleString("en-US", { maximumFractionDigits: 6 });

export function RcEconomicsPanel({ openEditor }: { openEditor: (kind: "costcategory" | "costparam" | "econreview", index: string) => void }): JSX.Element {
  const { rc, editable, mutateRc, siteReceptors } = useRcWorkbook();
  const ec = rc.economicFactors, site = rc.protectiveActionParameters.siteAndReceptors;
  const [tab, setTab] = useState<Tab>("site"), [viewFile, setViewFile] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null), tabs = useRef<HTMLDivElement>(null), id = useId();
  const input = ec.siteEconomyInput, issues = rcEconomicCostIssues(ec.costParameterEstimates, ec.decontaminationLevels);
  const coverage = rcEconomicCostCoverage(ec);
  const completeRegions = !!input && input.regions.length === input.expectedRegions;
  const currentSite = input?.sourceSiteRevision === undefined || input.sourceSiteRevision === site?.revision;
  const canConfirm = completeRegions && currentSite && coverage.complete && issues.length === 0;
  const maxUsedLevel = Math.max(0, ...ec.costParameterEstimates.map(row => row.level ?? 0));
  const saveInput = (original: string, filename: string, sourceSiteRevision?: number) => {
    const parsed = parseRcSiteEconomy(original, filename);
    mutateRc(draft => ({ ...draft, economicFactors: { ...draft.economicFactors, siteEconomyInput: { ...parsed, sourceSiteRevision }, parameterConsistencyConfirmed: false } }));
    setViewFile(false);
  };
  const importFile = async (file: File) => {
    setBusy(true); setError("");
    try {
      if (!/\.(inp|txt)$/i.test(file.name)) throw new Error("Choose an .inp or .txt file.");
      if (file.size > 2_000_000) throw new Error("Choose a file up to 2 MB.");
      saveInput(await file.text(), file.name);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not read site economy file."); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  };
  const useSiteFile = async () => {
    const file = site?.geometryFile;
    if (!file || !siteReceptors) return;
    setBusy(true); setError("");
    try { saveInput(await siteReceptors.readOriginal(file.documentId), file.filename, site.revision); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not read the Step 02 site file."); }
    finally { setBusy(false); }
  };
  const addParameter = () => {
    const choice = codes.flatMap(code => (rcEconomicCostSpecs[code].perLevel ? [1, 2, 3] : [undefined]).map(level => ({ code, level })))
      .find(({ code, level }) => !ec.costParameterEstimates.some(row => row.costCode === code && row.level === level));
    if (!choice) return;
    mutateRc(draft => ({ ...draft, economicFactors: { ...draft.economicFactors, parameterConsistencyConfirmed: false,
      costParameterEstimates: [...draft.economicFactors.costParameterEstimates, { parameter: rcEconomicCostSpecs[choice.code].label, costCode: choice.code, level: choice.level, dataBasis: "GENERIC_JUSTIFIED", source: "" }] } }));
    openEditor("costparam", String(ec.costParameterEstimates.length));
  };
  const addCategory = () => {
    mutateRc(draft => ({ ...draft, economicFactors: { ...draft.economicFactors, costCategories: [...draft.economicFactors.costCategories, { category: "", parameterDefinitions: [] }] } }));
    openEditor("costcategory", String(ec.costCategories.length));
  };
  const table = (label: string, headers: string[], rows: ReactNode[][]) => <div className="re-table-wrap"><table aria-label={label}><thead><tr>{headers.map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, col) => <td key={col}>{cell}</td>)}</tr>)}</tbody></table></div>;
  return <div className="poscard re-card"><div className="poscard__head"><WorkbookSectionHeading workbook="RC" title="Economic factors" level={3} /></div><section className="re" aria-label="Economic factors">
    <div className="re-tabs" role="tablist" aria-label="Economic factor sections" ref={tabs} onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault(); const order: Tab[] = ["site", "costs", "review"];
      const next = event.key === "Home" ? order[0] : event.key === "End" ? order[2] : order[(order.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 2)) % 3];
      setTab(next); tabs.current?.querySelectorAll<HTMLButtonElement>("button")[order.indexOf(next)]?.focus();
    }}>{(["site", "costs", "review"] as const).map(value => <button type="button" role="tab" id={`${id}-${value}`} aria-controls={`${id}-panel`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} key={value} onClick={() => setTab(value)}>{value === "site" ? "Site economy" : value === "costs" ? "Cost model" : "Review"}</button>)}</div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} tabIndex={0}>
      {tab === "site" && <><div className="re-file"><div className="re-file-info"><span>Site economy file</span><strong>{input?.filename ?? "No file selected"}</strong><span>.inp · .txt</span></div><div className="re-actions">{editable && site?.geometryFile && siteReceptors && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={() => void useSiteFile()}>Use Step 02 site file</button>}{editable && <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={() => fileInput.current?.click()}>{input ? <RCIcon.Refresh /> : <RCIcon.Plus />}{input ? "Replace file" : "Import file"}</button>}{input && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setViewFile(!viewFile)}><RCIcon.Eye />{viewFile ? "Hide file" : "View file"}</button>}</div><input ref={fileInput} type="file" accept=".inp,.txt" hidden aria-label="Import site economy file" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void importFile(file); }} /></div>
        {error && <p className="re-error" role="alert">{error}</p>}{input?.sourceSiteRevision !== undefined && site?.revision !== input.sourceSiteRevision && <p className="re-error">The Step 02 site file has changed. Reimport it here.</p>}{viewFile && input && <pre className="re-original" aria-label="Original site economy file">{input.original}</pre>}
        {input ? <><div className="re-summary"><div><span>Economic multiplier</span><strong>{number(input.economicMultiplier)}</strong></div><div><span>Regional rows supplied</span><strong>{input.regions.length} of {input.expectedRegions}</strong></div></div>
          <section className="re-group"><h3>Regional economic data</h3>{table("Regional economic data", ["Region", "Name", "Farming share", "Dairy sales share", "Farm sales ($/ha/year)", "Farmland value ($/ha)", "Non-farm value ($/person)"], input.regions.map(row => [row.index, row.name, number(row.farmFraction), number(row.dairySalesFraction), number(row.annualFarmSalesPerHectare), number(row.farmlandValuePerHectare), number(row.nonFarmlandValuePerPerson)]))}</section>
          {input.crops.length > 0 && <section className="re-group"><h3>Crop seasons and shares</h3>{table("Crop seasons and shares", ["Crop", "Growing days", "Farmland share"], input.crops.map(row => [row.name, `${row.growingStartDay} to ${row.growingEndDay}`, number(row.farmlandFraction)]))}</section>}</> : <p className="re-empty">Import a SecPop site file to review its regional economy and crop data.</p>}</>}
      {tab === "costs" && <><div className="re-heading"><h3>Cost parameters</h3>{editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addParameter}><RCIcon.Plus /> Add parameter</button>}</div>
        <div className="re-settings"><label>Decontamination levels <select className="posfield__select" value={ec.decontaminationLevels ?? ""} disabled={!editable} onChange={event => mutateRc(draft => ({ ...draft, economicFactors: { ...draft.economicFactors, decontaminationLevels: event.target.value ? Number(event.target.value) : undefined, parameterConsistencyConfirmed: false } }))}><option value="">Choose</option>{[1, 2, 3].map(level => <option value={level} key={level} disabled={level < maxUsedLevel}>{level}</option>)}</select></label>{ec.decontaminationLevels !== undefined && <span>{coverage.supplied} of {coverage.required} parameter values supplied</span>}</div>
        {ec.costParameterEstimates.length ? table("Cost parameters", ["Parameter", "Value", "Unit", "Currency year", "Source", ""], ec.costParameterEstimates.map((row, index) => {
          const spec = row.costCode ? rcEconomicCostSpecs[row.costCode] : undefined;
          return [<span key="name">{spec?.label ?? row.parameter}{row.level ? ` · level ${row.level}` : ""}{row.costCode && <small className="re-code">{row.costCode}</small>}</span>, row.value === undefined ? "Not supplied" : number(row.value), spec?.unit ?? "—", row.currencyYear ?? "—", row.source || "Not supplied", <button key="edit" type="button" className="posnav__btn posnav__btn--sm" onClick={() => openEditor("costparam", String(index))}>View{editable ? " / edit" : ""}</button>];
        })) : <p className="re-empty">No cost parameters entered.</p>}
        {issues.length > 0 && <div className="re-error" role="alert">{issues.map((issue, index) => <p key={index}>{issue}</p>)}</div>}
      </>}
      {tab === "review" && <><div className="re-heading"><h3>Economic input review</h3>{editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openEditor("econreview", "review")}><RCIcon.Settings /> Edit review</button>}</div>
        {table("Economic input review", ["Topic", "Recorded basis"], [
          ["Parameter uncertainty", ec.parameterUncertaintyCharacterization || "Not recorded"],
          ["Model uncertainty sources", ec.modelUncertainty.sources.join("; ") || "Not recorded"],
          ["Model assumptions", ec.modelUncertainty.assumptions.join("; ") || "Not recorded"],
          ["Model alternatives", ec.modelUncertainty.alternatives.join("; ") || "Not recorded"],
        ])}
        <label className="re-confirm"><input type="checkbox" checked={ec.parameterConsistencyConfirmed} disabled={!editable || !canConfirm} onChange={event => mutateRc(draft => ({ ...draft, economicFactors: { ...draft.economicFactors, parameterConsistencyConfirmed: event.target.checked } }))} />Parameter values and site coverage reviewed</label>
        <div className="re-heading re-notes-heading"><h3>Additional category notes</h3>{editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addCategory}><RCIcon.Plus /> Add category</button>}</div>
        {ec.costCategories.length ? table("Additional category notes", ["Category", "Definitions", ""], ec.costCategories.map((row, index) => [row.category || "Untitled", row.parameterDefinitions.join("; "), <button key="edit" type="button" className="posnav__btn posnav__btn--sm" onClick={() => openEditor("costcategory", String(index))}>View{editable ? " / edit" : ""}</button>])) : <p className="re-empty">No additional category notes.</p>}
      </>}
    </div></section></div>;
}
