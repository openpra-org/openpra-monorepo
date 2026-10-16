import { JSX, useId, useState } from "react";
import {
  ESQ_PLAN_DEFAULTS,
  type EsqLinkCode,
  type EsqLinkedWorkbooks,
  type EsqQuantificationPlan,
  type EsqScopeAspect,
  type EsqStateWeighting,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { HandoffImports, readableId } from "../workbooks/workbookHandoff";
import { DialogHead, DialogShell } from "../es-workbooks/EsScope";
import { Badge, FormRow, sciText } from "./esqShared";
import { useEsqWorkbook } from "./esqWorkbookContext";
import {
  CAPABILITY_CATEGORIES,
  ESQ_LINK_TILES,
  ESQ_PLAN_SOURCES,
  ESQ_SCOPE_ASPECTS,
  PLANT_STAGES,
  STATE_WEIGHTING_OPTIONS,
  exampleLinkLabel,
  type EsqPlanKey,
  type Stage,
} from "./esqViewData";
import {
  planChanged,
  planReason,
  planValues,
  riReportingFloor,
  scopeRowsView,
  withPlan,
  withPlanDefault,
  withPlanReason,
  withRestIncluded,
  withScopeItemAdded,
  withScopeReason,
  withScopeState,
  type EsqScopeRow,
  type EsqScopeState,
} from "./esqSelectors";
import "./css/esqScope.css";

function linkedWorkbookLabel(id: string, options: readonly { id: string; name: string }[]): string {
  return options.find((workbook) => workbook.id === id)?.name ?? exampleLinkLabel(id) ?? "the linked workbook";
}

function rowTitle(row: EsqScopeRow): string {
  const code = readableId(row.key);
  if (code !== undefined) return code;
  return row.label.length > 0 ? row.label : "Unnamed record";
}

function rowSub(row: EsqScopeRow): string {
  if (row.byHand) return "Typed";
  const code = readableId(row.key);
  return code !== undefined && row.label.length > 0 && row.label !== code ? row.label : "";
}

function scopeStateOf(value: string): EsqScopeState {
  return value === "included" ? "included" : value === "excluded" ? "excluded" : "unset";
}

function withArticle(noun: string): string {
  return `${"aeiou".includes(noun.charAt(0)) ? "an" : "a"} ${noun}`;
}

function sameValue(left: number, right: number): boolean {
  return Math.abs(left - right) <= Math.abs(right) * 1e-9;
}

function EsqInterfaces(): JSX.Element {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const [selected, setSelected] = useState<EsqLinkCode | null>("ES");
  const selectId = useId();
  const links: EsqLinkedWorkbooks = esq.linkedWorkbooks ?? {};
  const tile = ESQ_LINK_TILES.find((candidate) => candidate.code === selected);
  const options = tile === undefined ? [] : upstream.options[tile.code];
  const linkedId = tile === undefined ? undefined : links[tile.code];
  const linked = options.find((workbook) => workbook.id === linkedId);
  const exampleLabel = linkedId === undefined ? undefined : exampleLinkLabel(linkedId);
  const nothingToLink = options.length === 0 && linkedId === undefined;

  function onLink(code: EsqLinkCode, id: string): void {
    if (!editable) return;
    mutateEsq((draft) => {
      const current: EsqLinkedWorkbooks = draft.linkedWorkbooks ?? {};
      const next: EsqLinkedWorkbooks = {};
      for (const candidate of ESQ_LINK_TILES) {
        const value = candidate.code === code ? id : current[candidate.code];
        if (value !== undefined && value.length > 0) next[candidate.code] = value;
      }
      return { ...draft, linkedWorkbooks: next };
    });
  }

  return (
    <>
      <div className="poshandoff__grid esq-scope-tiles">
        {ESQ_LINK_TILES.map((candidate) => (
          <button
            key={candidate.code}
            type="button"
            className={`poshandoff__tile${selected === candidate.code ? " poshandoff__tile--active" : ""}`}
            aria-pressed={selected === candidate.code}
            onClick={() => setSelected(selected === candidate.code ? null : candidate.code)}
          >
            <span className="poshandoff__tile-code">{candidate.label}</span>
            <span className="poshandoff__tile-name">{candidate.name}</span>
          </button>
        ))}
      </div>
      {tile !== undefined && (
        <div className="esq-scope-lane">
          <div className="esq-scope-link">
            <label className="posfield__label" htmlFor={selectId}>Source workbook</label>
            <select
              id={selectId}
              className="posfield__select"
              value={linkedId ?? ""}
              disabled={!editable || nothingToLink}
              onChange={(event) => onLink(tile.code, event.target.value)}
            >
              <option value="">{nothingToLink ? `No ${tile.label} workbooks in this project` : "Not linked"}</option>
              {exampleLabel !== undefined && linkedId !== undefined && <option value={linkedId}>{exampleLabel}</option>}
              {options.map((workbook) => <option key={workbook.id} value={workbook.id}>{workbook.name}</option>)}
              {linkedId !== undefined && linked === undefined && exampleLabel === undefined && <option value={linkedId}>{`${tile.label} workbook not in this project`}</option>}
            </select>
          </div>
          {tile.code !== "HS" && <HandoffImports consumer="ESQ" producer={tile.code} />}
        </div>
      )}
    </>
  );
}

function CoverageTable({ onEdit }: { onEdit: (aspect: EsqScopeAspect) => void }): JSX.Element {
  const { esq, editable, upstream } = useEsqWorkbook();
  const actionLabel = editable ? "Edit" : "View";
  return (
    <div className="poscard">
      <div className="poscard__head"><WorkbookSectionHeading title="Coverage" level={3} /></div>
      <table className="postable postable--mid esq-scope-table" aria-label="Coverage">
        <thead><tr><th scope="col">Scope item</th><th scope="col">Included</th><th scope="col">Excluded</th><th scope="col" className="esq-scope-edit" aria-label="Actions" /></tr></thead>
        <tbody>
          {ESQ_SCOPE_ASPECTS.map((spec) => {
            const rows = scopeRowsView(esq, upstream, spec.aspect);
            const included = rows.filter((row) => row.state === "included");
            const excluded = rows.filter((row) => row.state === "excluded");
            const unset = rows.filter((row) => row.state === "unset").length;
            const noReason = excluded.filter((row) => row.reason.trim().length === 0).length;
            return (
              <tr key={spec.aspect}>
                <td>
                  <span className="postable__name">{spec.label}</span>
                  {unset > 0 && <span className="esq-scope-flag">{unset} not set</span>}
                  {noReason > 0 && <span className="esq-scope-flag">{noReason} without a reason</span>}
                </td>
                <td>{included.length === 0 ? <span className="posmuted">None</span> : included.map(rowTitle).join(", ")}</td>
                <td>{excluded.length === 0 ? <span className="posmuted">None</span> : excluded.map(rowTitle).join(", ")}</td>
                <td className="esq-scope-edit">
                  <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${spec.label.toLowerCase()}`} onClick={() => onEdit(spec.aspect)}>{actionLabel}</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CoverageDialog({ aspect, onClose }: { aspect: EsqScopeAspect; onClose: () => void }): JSX.Element {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const [draft, setDraft] = useState("");
  const spec = ESQ_SCOPE_ASPECTS.find((candidate) => candidate.aspect === aspect) ?? ESQ_SCOPE_ASPECTS[0];
  const rows = scopeRowsView(esq, upstream, aspect);
  const unset = rows.filter((row) => row.state === "unset").length;
  const showEs = rows.some((row) => row.inEs !== undefined);
  const showActions = editable && rows.some((row) => row.byHand);
  const addLabel = `Add ${withArticle(spec.item)}`;

  function setState(row: EsqScopeRow, next: EsqScopeState): void {
    if (!editable) return;
    mutateEsq((current) => withScopeState(current, aspect, row, next));
  }
  function setReason(row: EsqScopeRow, reason: string): void {
    if (!editable) return;
    mutateEsq((current) => withScopeReason(current, aspect, row, reason));
  }
  function add(): void {
    const name = draft.trim();
    if (!editable || name.length === 0) return;
    mutateEsq((current) => withScopeItemAdded(current, aspect, name));
    setDraft("");
  }
  function includeRest(): void {
    if (!editable) return;
    mutateEsq((current) => withRestIncluded(current, aspect, scopeRowsView(current, upstream, aspect)));
  }

  return (
    <DialogShell label={spec.label} onClose={onClose} fit>
      <DialogHead cap="Coverage · ESQ-A2" title={spec.label} onClose={onClose} />
      <div className="modal__body esq-scope-dialog">
        {editable && unset > 0 && (
          <div className="posrow esq-scope-dialog-bar">
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={includeRest}>Include the {unset} not set</button>
          </div>
        )}
        {rows.length > 0 && (
          <table className="postable postable--mid esq-scope-items" aria-label={spec.label}>
            <thead>
              <tr>
                <th scope="col">Item</th>
                {showEs && <th scope="col">In ES</th>}
                <th scope="col">Included</th>
                <th scope="col" className="esq-scope-reason-col">Reason for exclusion</th>
                {showActions && <th scope="col" className="esq-scope-act" aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const title = rowTitle(row);
                const sub = rowSub(row);
                const reasonMissing = row.state === "excluded" && row.reason.trim().length === 0;
                return (
                  <tr key={row.key}>
                    <td>
                      <span className="postable__name">{title}</span>
                      {sub.length > 0 && <span className="postable__name-sub">{sub}</span>}
                    </td>
                    {showEs && <td>{row.inEs === undefined ? "" : row.inEs ? "Yes" : "No"}</td>}
                    <td>
                      <select className="posfield__select" aria-label={`${title} included`} value={row.state} disabled={!editable} onChange={(event) => setState(row, scopeStateOf(event.target.value))}>
                        {!row.byHand && <option value="unset">Not set</option>}
                        <option value="included">Included</option>
                        <option value="excluded">Excluded</option>
                      </select>
                    </td>
                    <td>
                      {row.state === "excluded" && (editable ? (
                        <>
                          <WorkbookTextarea className="posfield__textarea esq-scope-reason" rows={1} fitContent aria-label={`${title} reason for exclusion`} aria-invalid={reasonMissing} value={row.reason} onChange={(event) => setReason(row, event.target.value)} />
                          {reasonMissing && <span className="esq-scope-reason-error" role="alert">Reason required</span>}
                        </>
                      ) : row.reason)}
                    </td>
                    {showActions && (
                      <td className="esq-scope-act">
                        {row.byHand && <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Remove ${title}`} onClick={() => setState(row, "unset")}>Remove</button>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {editable && (
          <div className="esq-scope-add">
            <input
              className="posfield__input"
              aria-label={addLabel}
              placeholder={addLabel}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }}
            />
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={draft.trim().length === 0} onClick={add}>Add</button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function PlanDefault({ planKey, changed, editable, onRestore }: { planKey: EsqPlanKey; changed: boolean; editable: boolean; onRestore: () => void }): JSX.Element {
  return (
    <>
      <span className="esq-form__unit">{ESQ_PLAN_SOURCES[planKey]}</span>
      {changed && editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={onRestore}>Restore default</button>}
    </>
  );
}

function PlanReasonRow({ planKey, id }: { planKey: EsqPlanKey; id: string }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  if (!planChanged(esq, planKey)) return null;
  const reason = planReason(esq, planKey);
  return (
    <FormRow label="Reason for change" htmlFor={id} top>
      <WorkbookTextarea
        id={id}
        className="posfield__textarea"
        rows={2}
        fitContent
        aria-invalid={reason.trim().length === 0}
        value={reason}
        disabled={!editable}
        onChange={(event) => { const text = event.target.value; if (editable) mutateEsq((draft) => withPlanReason(draft, planKey, text)); }}
      />
      {reason.trim().length === 0 && <span className="esq-form__error" role="alert">Reason required</span>}
    </FormRow>
  );
}

function PlanCard(): JSX.Element {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const fieldId = useId();
  const values = planValues(esq);
  const plan: EsqQuantificationPlan = esq.quantificationPlan ?? {};
  const ieId = esq.linkedWorkbooks?.IE;
  const ieModules = upstream.ie?.metadata.plantIdentity?.numberOfModules;
  const modules = plan.modulesPerPlant;
  const moduleLink = modules?.link;
  const modulesFromCurrent = moduleLink !== undefined && moduleLink.workbookId === ieId;
  const ieName = ieId === undefined ? undefined : linkedWorkbookLabel(ieId, upstream.options.IE);
  const riId = esq.linkedWorkbooks?.RI;
  const riFloor = riReportingFloor(esq, upstream.ri);
  const floor = plan.reportingFloorPerYear;
  const floorLink = floor?.link;
  const floorFromCurrent = floorLink !== undefined && floorLink.workbookId === riId;
  const riName = riId === undefined ? undefined : linkedWorkbookLabel(riId, upstream.options.RI);
  const multiIncluded = esq.modelIntegration.multiReactorSequencesIncluded;
  const multiBasis = esq.modelIntegration.multiReactorInclusionBasis ?? "";

  function patchPlan(fields: (current: EsqQuantificationPlan) => EsqQuantificationPlan): void {
    if (!editable) return;
    mutateEsq((draft) => withPlan(draft, fields(draft.quantificationPlan ?? {})));
  }
  function restore(key: EsqPlanKey): void {
    if (!editable) return;
    mutateEsq((draft) => withPlanDefault(draft, key));
  }
  function onStateWeighting(value: EsqStateWeighting): void {
    patchPlan((current) => ({ ...current, stateWeighting: value === ESQ_PLAN_DEFAULTS.stateWeighting ? undefined : { value, reason: current.stateWeighting?.reason } }));
  }
  function onReportingFloor(text: string): void {
    const value = Number(text);
    if (text.trim().length === 0 || !Number.isFinite(value)) return;
    patchPlan((current) => ({ ...current, reportingFloorPerYear: value === ESQ_PLAN_DEFAULTS.reportingFloorPerYear ? undefined : { value, reason: current.reportingFloorPerYear?.reason } }));
  }
  function onFloorSource(value: string): void {
    if (value === "imported" && riId !== undefined && riFloor !== undefined) {
      patchPlan((current) => ({ ...current, reportingFloorPerYear: { value: riFloor, link: { element: "RI", workbookId: riId, field: "minimumReportingFrequencyPerPlantYear" } } }));
      return;
    }
    if (value !== "typed") return;
    patchPlan((current) => {
      const typed = current.reportingFloorPerYear?.value;
      return { ...current, reportingFloorPerYear: typed === undefined || typed === ESQ_PLAN_DEFAULTS.reportingFloorPerYear ? undefined : { value: typed } };
    });
  }
  function onConvergence(text: string): void {
    const value = Number(text);
    if (text.trim().length === 0 || !Number.isFinite(value)) return;
    patchPlan((current) => ({ ...current, convergenceStepPercent: value === ESQ_PLAN_DEFAULTS.convergenceStepPercent ? undefined : { value, reason: current.convergenceStepPercent?.reason } }));
  }
  function onModulesSource(value: string): void {
    if (value === "imported" && ieId !== undefined && ieModules !== undefined) {
      patchPlan((current) => ({ ...current, modulesPerPlant: { value: ieModules, link: { element: "IE", workbookId: ieId, field: "numberOfModules" } } }));
      return;
    }
    if (value === "typed") patchPlan((current) => ({ ...current, modulesPerPlant: current.modulesPerPlant === undefined ? undefined : { value: current.modulesPerPlant.value } }));
  }
  function onModulesTyped(text: string): void {
    const value = Number(text);
    if (text.trim().length === 0) {
      patchPlan((current) => ({ ...current, modulesPerPlant: undefined }));
      return;
    }
    if (Number.isInteger(value) && value >= 1) patchPlan((current) => ({ ...current, modulesPerPlant: { value } }));
  }
  function onMultiReactor(value: string): void {
    if (!editable) return;
    mutateEsq((draft) => ({ ...draft, modelIntegration: { ...draft.modelIntegration, multiReactorSequencesIncluded: value === "included" } }));
  }
  function onMultiBasis(text: string): void {
    if (!editable) return;
    mutateEsq((draft) => ({ ...draft, modelIntegration: { ...draft.modelIntegration, multiReactorInclusionBasis: text } }));
  }

  return (
    <div className="poscard">
      <div className="poscard__head"><WorkbookSectionHeading title="Quantification plan" level={3} /></div>
      <div className="esq-form esq-form--card">
        <FormRow label="State weighting" htmlFor={`${fieldId}-weighting`}>
          <select id={`${fieldId}-weighting`} className="posfield__select" value={values.stateWeighting} disabled={!editable} onChange={(event) => onStateWeighting(event.target.value === "TYPED_SHARES" ? "TYPED_SHARES" : "POS_HOURS")}>
            {STATE_WEIGHTING_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <PlanDefault planKey="stateWeighting" changed={planChanged(esq, "stateWeighting")} editable={editable} onRestore={() => restore("stateWeighting")} />
        </FormRow>
        <PlanReasonRow planKey="stateWeighting" id={`${fieldId}-weighting-reason`} />
        <FormRow label="Modules per plant" htmlFor={`${fieldId}-modules`}>
          {moduleLink === undefined ? (
            <WorkbookInput id={`${fieldId}-modules`} className="posfield__input posmono esq-form__number" type="number" min="1" step="1" value={modules?.value ?? ""} disabled={!editable}
              onChange={(event) => onModulesTyped(event.target.value)} />
          ) : (
            <span id={`${fieldId}-modules`} className="posmono esq-form__value">{modules?.value}</span>
          )}
          {ieId === undefined && moduleLink === undefined ? (
            <span className="esq-form__unit">Typed</span>
          ) : (
            <select className="posfield__select" aria-label="Modules per plant source" value={moduleLink === undefined ? "typed" : "imported"} disabled={!editable} onChange={(event) => onModulesSource(event.target.value)}>
              <option value="typed">Typed</option>
              {(moduleLink !== undefined || (ieId !== undefined && ieModules !== undefined)) && <option value="imported">Imported from IE · {moduleLink !== undefined && !modulesFromCurrent ? linkedWorkbookLabel(moduleLink.workbookId, upstream.options.IE) : ieName}</option>}
            </select>
          )}
          {modules === undefined && <span className="esq-form__error" role="alert">Required</span>}
        </FormRow>
        {moduleLink !== undefined && !modulesFromCurrent && (
          <p className="esq-form__warn" role="status">
            This value comes from an IE workbook that ESQ no longer links.
            {editable && ieId !== undefined && ieModules !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onModulesSource("imported")}>Import from {ieName} ({ieModules})</button>}
          </p>
        )}
        {modulesFromCurrent && ieModules !== undefined && modules !== undefined && ieModules !== modules.value && (
          <p className="esq-form__warn" role="status">
            The IE workbook now gives {ieModules} modules.
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onModulesSource("imported")}>Use {ieModules}</button>}
          </p>
        )}
        <FormRow label="Sequences with several reactors" htmlFor={`${fieldId}-multi`}>
          <select id={`${fieldId}-multi`} className="posfield__select" value={multiIncluded ? "included" : "excluded"} disabled={!editable} onChange={(event) => onMultiReactor(event.target.value)}>
            <option value="included">Included</option>
            <option value="excluded">Not in scope</option>
          </select>
        </FormRow>
        <FormRow label="Basis" htmlFor={`${fieldId}-multi-basis`} top>
          <WorkbookTextarea id={`${fieldId}-multi-basis`} className="posfield__textarea" rows={2} fitContent value={multiBasis} disabled={!editable} onChange={(event) => onMultiBasis(event.target.value)} />
          {!multiIncluded && multiBasis.trim().length === 0 && <span className="esq-form__error" role="alert">Basis required</span>}
        </FormRow>
        <FormRow label="Reporting floor" htmlFor={`${fieldId}-floor`}>
          {floorLink === undefined ? (
            <WorkbookInput id={`${fieldId}-floor`} className="posfield__input posmono esq-form__number" type="number" step="any" min="0" value={values.reportingFloorPerYear} disabled={!editable}
              onChange={(event) => onReportingFloor(event.target.value)} />
          ) : (
            <span id={`${fieldId}-floor`} className="posmono esq-form__value">{sciText(values.reportingFloorPerYear)}</span>
          )}
          <span className="esq-form__unit">per reactor-year</span>
          {(floorLink !== undefined || (riId !== undefined && riFloor !== undefined)) && (
            <select className="posfield__select" aria-label="Reporting floor source" value={floorLink === undefined ? "typed" : "imported"} disabled={!editable} onChange={(event) => onFloorSource(event.target.value)}>
              <option value="typed">Typed</option>
              <option value="imported">Imported from RI · {floorLink !== undefined && !floorFromCurrent ? linkedWorkbookLabel(floorLink.workbookId, upstream.options.RI) : riName}</option>
            </select>
          )}
          {floorLink === undefined && <PlanDefault planKey="reportingFloorPerYear" changed={planChanged(esq, "reportingFloorPerYear")} editable={editable} onRestore={() => restore("reportingFloorPerYear")} />}
          {!(values.reportingFloorPerYear > 0) && <span className="esq-form__error" role="alert">Enter a value above zero</span>}
        </FormRow>
        {floorLink !== undefined && !floorFromCurrent && (
          <p className="esq-form__warn" role="status">
            This value comes from an RI workbook that ESQ no longer links.
            {editable && riId !== undefined && riFloor !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onFloorSource("imported")}>Import from {riName} ({sciText(riFloor)})</button>}
          </p>
        )}
        {floorFromCurrent && riFloor !== undefined && floor !== undefined && !sameValue(floor.value, riFloor) && (
          <p className="esq-form__warn" role="status">
            The RI workbook now gives {sciText(riFloor)} per reactor-year.
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onFloorSource("imported")}>Use {sciText(riFloor)}</button>}
          </p>
        )}
        <PlanReasonRow planKey="reportingFloorPerYear" id={`${fieldId}-floor-reason`} />
        <FormRow label="Convergence step" htmlFor={`${fieldId}-convergence`}>
          <WorkbookInput id={`${fieldId}-convergence`} className="posfield__input posmono esq-form__number" type="number" step="any" min="0" max="100" value={values.convergenceStepPercent} disabled={!editable}
            onChange={(event) => onConvergence(event.target.value)} />
          <span className="esq-form__unit">% per decade</span>
          <PlanDefault planKey="convergenceStepPercent" changed={planChanged(esq, "convergenceStepPercent")} editable={editable} onRestore={() => restore("convergenceStepPercent")} />
          {!(values.convergenceStepPercent > 0 && values.convergenceStepPercent < 100) && <span className="esq-form__error" role="alert">Enter a value between 0 and 100</span>}
        </FormRow>
        <PlanReasonRow planKey="convergenceStepPercent" id={`${fieldId}-convergence-reason`} />
      </div>
    </div>
  );
}

function EsqScopeScreen({ ccId, setCcId, stage, setStage }: {
  ccId: string;
  setCcId: (id: string) => void;
  stage: Stage;
  setStage: (stage: Stage) => void;
}): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const [dialog, setDialog] = useState<EsqScopeAspect | null>(null);
  const cc = CAPABILITY_CATEGORIES.find((candidate) => candidate.id === ccId) ?? CAPABILITY_CATEGORIES[0];

  function onCcChange(nextId: string): void {
    if (!editable) return;
    setCcId(nextId);
    mutateEsq((draft) => ({ ...draft, capabilityCategory: nextId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(nextStage: Stage): void {
    if (!editable) return;
    setStage(nextStage);
    mutateEsq((draft) => ({ ...draft, plantStage: nextStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" }));
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading title="Interfaces" level={3} /></div>
        <p className="poscard__sub">Links are optional. A linked workbook fills the coverage and the quantification plan below, which you can also type by hand.</p>
        <EsqInterfaces />
      </div>

      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading title="PRA scope" level={3} /></div>
        <WorkbookTextarea
          className="posfield__textarea esq-scope-text"
          aria-label="PRA scope"
          rows={3}
          value={esq.praScope}
          disabled={!editable}
          onChange={(event) => { if (editable) mutateEsq((draft) => ({ ...draft, praScope: event.target.value })); }}
        />
      </div>

      <CoverageTable onEdit={setDialog} />

      <PlanCard />

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading title="Capability category" level={3} />
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <div className="esq-scope-choices">
          {CAPABILITY_CATEGORIES.map((candidate) => {
            const active = candidate.id === ccId;
            return (
              <button key={candidate.id} type="button" className={`esq-scope-choice${active ? " esq-scope-choice--active" : ""}`} aria-pressed={active} disabled={!editable} onClick={() => onCcChange(candidate.id)}>
                <span className="esq-scope-choice__head">
                  <span className="esq-scope-choice__name">{candidate.name}</span>
                  <Badge kind={active ? "progress" : undefined}>{candidate.tag}</Badge>
                </span>
                <span className="esq-scope-choice__desc">{candidate.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading title="Plant stage" level={3} /></div>
        <div className="esq-scope-choices">
          {PLANT_STAGES.map((option) => (
            <label key={option.id} className={`esq-scope-choice${stage === option.id ? " esq-scope-choice--active" : ""}`}>
              <span className="esq-scope-choice__head">
                <WorkbookInput type="radio" name="esq-stage" value={option.id} checked={stage === option.id} disabled={!editable} onChange={() => onStageChange(option.id)} />
                <span className="esq-scope-choice__name">{option.title}</span>
              </span>
              <span className="esq-scope-choice__desc">{option.body}</span>
            </label>
          ))}
        </div>
      </div>

      {dialog !== null && <CoverageDialog aspect={dialog} onClose={() => setDialog(null)} />}
    </>
  );
}

export { EsqScopeScreen };
