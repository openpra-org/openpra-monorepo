import { useId, useState, type JSX } from "react";
import type { RcConsequenceMetric, RcMetricQuantity, RcMetricReceptor, RcMetricWindowStart } from "interfaces-mef-types/rc/metrics";
import {
  blankRcMetric,
  nextRcMetricId,
  rcMetricIssues,
  rcMetricNumberList,
  rcMetricOpenRcSupport,
  rcMetricPresets,
  rcMetricQuantityLabels,
  rcMetricReceptorLabels,
  rcMetricReceptorText,
  rcMetricStatisticsText,
  rcMetricUnit,
  rcMetricWindowStartLabels,
  rcMetricWindowText,
  rcMetricWindowUnit,
  rcMetricWindowUnits,
  rcMetricWindowValue,
  type RcMetricWindowUnit,
} from "interfaces-shared-types/rc-workbooks/metrics";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { useRcWorkbook } from "./rcWorkbookContext";
import { DrawerHead, RcAreaField, RcOptionalNumberField, RcSelectField, RcTextField, RemoveBtn } from "./rcFields";
import { RCIcon } from "./rcIcons";
import "./css/rcMetrics.css";

const CUSTOM = "custom";
const quantityOptions = Object.entries(rcMetricQuantityLabels) as [RcMetricQuantity, string][];
const receptorOptions = Object.entries(rcMetricReceptorLabels) as [RcMetricReceptor["kind"], string][];
const startOptions = Object.entries(rcMetricWindowStartLabels) as [RcMetricWindowStart, string][];
const supportText = { YES: "Yes", NO: "Not yet", UNKNOWN: "Not assessed" } as const;

function receptorFor(kind: RcMetricReceptor["kind"], current: RcMetricReceptor): RcMetricReceptor {
  const distance = current.kind === "AVERAGE_BEYOND_EAB" ? current.distanceKm : current.kind === "WITHIN_RADIUS" ? current.radiusKm : undefined;
  switch (kind) {
    case "EAB_MAXIMUM": return { kind };
    case "DISTANCE_PROFILE": return { kind };
    case "AVERAGE_BEYOND_EAB": return { kind, distanceKm: distance };
    case "WITHIN_RADIUS": return { kind, radiusKm: distance };
    case "OTHER": return { kind, description: current.kind === "OTHER" ? current.description : "" };
  }
}

export function RcMetricsCard({ openDrawer }: { openDrawer: (context: { kind: string; id: string }) => void }): JSX.Element {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const metrics = rc.scope.metrics ?? [];
  const [choice, setChoice] = useState<string>(rcMetricPresets[0].key);
  const addId = useId();
  const presetTaken = (key: string): boolean => metrics.some((metric) => metric.name === rcMetricPresets.find((preset) => preset.key === key)?.metric.name);
  const add = (): void => {
    const id = nextRcMetricId(metrics);
    const preset = rcMetricPresets.find((item) => item.key === choice);
    const metric: RcConsequenceMetric = { id, ...structuredClone(preset?.metric ?? blankRcMetric) };
    mutateRc((draft) => ({ ...draft, scope: { ...draft.scope, metrics: [...(draft.scope.metrics ?? []), metric] } }));
    openDrawer({ kind: "metric", id });
  };
  return (
    <div className="poscard rc-handoff__wide-card rc-metrics">
      <div className="poscard__head"><WorkbookSectionHeading workbook="RC" title="Consequence metrics" level={3} /></div>
      {metrics.length === 0 ? <p className="rc-metrics__empty">No consequence metrics yet.</p> : (
        <div className="rc-metrics__table-wrap">
          <table className="postable rc-metrics__table" aria-label="Consequence metrics">
            <thead><tr><th>Metric</th><th>Receptors</th><th>Exposure window</th><th>Protective actions</th><th>Statistics</th><th>OpenRC</th></tr></thead>
            <tbody>{metrics.map((metric) => {
              const issues = rcMetricIssues(metric), support = rcMetricOpenRcSupport(metric), unit = rcMetricUnit(metric);
              return (
                <tr key={metric.id}>
                  <td>
                    <button type="button" className="rc-metrics__name" onClick={() => openDrawer({ kind: "metric", id: metric.id })}>{metric.name.trim() || "Unnamed metric"}</button>
                    <span className="rc-metrics__note">{metric.id} · {rcMetricQuantityLabels[metric.quantity]}{unit ? ` · ${unit}` : ""}</span>
                    {issues.length > 0 && <span className="rc-metrics__issues">{issues.length} {issues.length === 1 ? "item" : "items"} to complete</span>}
                  </td>
                  <td>{rcMetricReceptorText(metric.receptor)}</td>
                  <td>{rcMetricWindowText(metric.window)}</td>
                  <td>{metric.protectiveActionsCredited ? "Credited" : "Not credited"}</td>
                  <td>{rcMetricStatisticsText(metric)}</td>
                  <td>{supportText[support.status]}<span className="rc-metrics__note">{support.reason}</span></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
      {editable && (
        <div className="rc-metrics__add">
          <label htmlFor={addId}>Metric to add</label>
          <select id={addId} className="posfield__select" value={choice} onChange={(event) => setChoice(event.target.value)}>
            {rcMetricPresets.map((preset) => <option key={preset.key} value={preset.key} disabled={presetTaken(preset.key)}>{preset.label}</option>)}
            <option value={CUSTOM}>Custom metric</option>
          </select>
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={choice !== CUSTOM && presetTaken(choice)} onClick={add}><RCIcon.Plus /> Add metric</button>
        </div>
      )}
      <div className="posfield rc-metrics__basis">
        <label className="posfield__label" htmlFor={`${addId}-basis`}>Metric selection basis</label>
        <WorkbookTextarea id={`${addId}-basis`} className="posfield__textarea" rows={2} value={rc.scope.metricSelectionApplicationBasis ?? ""} disabled={!editable}
          onChange={(event) => mutateRc((draft) => ({ ...draft, scope: { ...draft.scope, metricSelectionApplicationBasis: event.target.value } }))} />
      </div>
    </div>
  );
}

export function RcMetricDrawer({ id, onClose, centered }: { id: string; onClose: () => void; centered: boolean }): JSX.Element | null {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const metric = rc.scope.metrics?.find((item) => item.id === id);
  const [windowUnit, setWindowUnit] = useState<RcMetricWindowUnit>(() => rcMetricWindowUnit(metric?.window?.seconds));
  const fieldId = useId();
  if (metric === undefined) return null;
  const dis = !editable;
  const patch = (next: Partial<RcConsequenceMetric>): void => mutateRc((draft) => ({
    ...draft,
    scope: { ...draft.scope, metrics: (draft.scope.metrics ?? []).map((item) => (item.id === id ? { ...item, ...next } : item)) },
  }));
  const remove = (): void => {
    mutateRc((draft) => ({ ...draft, scope: { ...draft.scope, metrics: (draft.scope.metrics ?? []).filter((item) => item.id !== id) } }));
    onClose();
  };
  const unitSeconds = (unit: RcMetricWindowUnit): number => rcMetricWindowUnits.find((item) => item.id === unit)?.seconds ?? 86400;
  const receptor = metric.receptor, unit = rcMetricUnit(metric);
  return (
    <>
      <DrawerHead cap="Consequence metric" title={metric.name.trim() || "Unnamed metric"} sub={metric.id} onClose={onClose} centered={centered} />
      <div className={`${centered ? "modal__body" : "posdrawer__body"} rc-metric-form`}>
        <RcTextField label="Name" value={metric.name} onChange={(name) => patch({ name })} disabled={dis} />
        <RcSelectField label="Quantity" value={metric.quantity} options={quantityOptions} disabled={dis}
          onChange={(value) => { const quantity = value as RcMetricQuantity; patch({ quantity, customUnit: quantity === "CUSTOM" ? metric.customUnit ?? "" : undefined }); }} />
        {metric.quantity === "CUSTOM" && <RcTextField label="Unit" value={metric.customUnit ?? ""} onChange={(customUnit) => patch({ customUnit })} disabled={dis} />}
        <RcSelectField label="Receptors" value={receptor.kind} options={receptorOptions} disabled={dis}
          onChange={(value) => patch({ receptor: receptorFor(value as RcMetricReceptor["kind"], receptor) })} />
        {receptor.kind === "AVERAGE_BEYOND_EAB" && <RcOptionalNumberField label="Distance beyond the EAB (km)" value={receptor.distanceKm} min={0} disabled={dis}
          onChange={(distanceKm) => patch({ receptor: { kind: "AVERAGE_BEYOND_EAB", distanceKm: distanceKm !== undefined && distanceKm > 0 ? distanceKm : undefined } })} />}
        {receptor.kind === "WITHIN_RADIUS" && <RcOptionalNumberField label="Radius from the release (km)" value={receptor.radiusKm} min={0} disabled={dis}
          onChange={(radiusKm) => patch({ receptor: { kind: "WITHIN_RADIUS", radiusKm: radiusKm !== undefined && radiusKm > 0 ? radiusKm : undefined } })} />}
        {receptor.kind === "OTHER" && <RcAreaField label="Receptor description" value={receptor.description} rows={2} disabled={dis}
          onChange={(description) => patch({ receptor: { kind: "OTHER", description } })} />}
        <div className="posfield">
          <label className="posfield__label" htmlFor={`${fieldId}-window`}>Exposure window</label>
          <div className="rc-metric-window">
            <WorkbookInput id={`${fieldId}-window`} className="posfield__input posmono" type="number" min={0} step="any" disabled={dis}
              value={metric.window ? rcMetricWindowValue(metric.window.seconds, windowUnit) : ""}
              onChange={(event) => {
                if (event.target.value === "") { patch({ window: undefined }); return; }
                const value = Number(event.target.value);
                if (!Number.isFinite(value) || value <= 0) return;
                patch({ window: { seconds: Math.round(value * unitSeconds(windowUnit)), start: metric.window?.start ?? "RELEASE_ONSET" } });
              }} />
            <select className="posfield__select" aria-label="Exposure window unit" value={windowUnit} disabled={dis}
              onChange={(event) => setWindowUnit(event.target.value as RcMetricWindowUnit)}>
              {rcMetricWindowUnits.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
        </div>
        <RcSelectField label="Window starts at" value={metric.window?.start ?? "RELEASE_ONSET"} options={startOptions} disabled={dis || metric.window === undefined}
          onChange={(value) => { if (metric.window) patch({ window: { ...metric.window, start: value as RcMetricWindowStart } }); }} />
        <RcSelectField label="Protective actions" value={metric.protectiveActionsCredited ? "yes" : "no"} options={[["no", "Not credited"], ["yes", "Credited"]]} disabled={dis}
          onChange={(value) => patch({ protectiveActionsCredited: value === "yes" })} />
        <RcSelectField label="Mean" value={metric.statistics.mean ? "yes" : "no"} options={[["yes", "Reported"], ["no", "Not reported"]]} disabled={dis}
          onChange={(value) => patch({ statistics: { ...metric.statistics, mean: value === "yes" } })} />
        <RcTextField label="Percentiles (comma separated)" value={metric.statistics.percentiles.join(", ")} disabled={dis}
          onChange={(text) => patch({ statistics: { ...metric.statistics, percentiles: rcMetricNumberList(text, (value) => value > 0 && value < 100) } })} />
        <RcTextField label={`Exceedance thresholds${unit ? ` (${unit})` : ""}`} value={metric.statistics.exceedanceThresholds.join(", ")} disabled={dis}
          onChange={(text) => patch({ statistics: { ...metric.statistics, exceedanceThresholds: rcMetricNumberList(text, (value) => value > 0) } })} />
        <RcAreaField label="Criterion or use" value={metric.criterion} rows={3} disabled={dis} onChange={(criterion) => patch({ criterion })} />
        <RcAreaField label="Basis" value={metric.basis} rows={3} disabled={dis} onChange={(basis) => patch({ basis })} />
        {editable && <RemoveBtn label="Remove metric" onClick={remove} />}
      </div>
    </>
  );
}
