import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { JSX, useId, useState } from "react";
import {
  ESQ_PLAN_DEFAULTS,
  type EsqFrequencyBasis,
  type EsqLinkCode,
  type EsqLinkedWorkbooks,
  type EsqModuleCounting,
  type EsqQuantificationPlan,
  type EsqScopeAspect,
  type EsqStateWeighting,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import { Badge, EsqProvenanceChip, EsqTabs, FormRow } from "./esqShared";
import { useEsqWorkbook } from "./esqWorkbookContext";
import {
  CAPABILITY_CATEGORIES,
  ESQ_LINK_TILES,
  ESQ_PLAN_SOURCES,
  ESQ_SCOPE_ASPECTS,
  FREQUENCY_BASIS_OPTIONS,
  MODULE_COUNTING_OPTIONS,
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
  scopeItemsToComplete,
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

const WORKBOOK_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  "in-progress": "In progress",
  complete: "Complete",
};

function linkedWorkbookLabel(id: string, options: readonly { id: string; name: string }[]): string {
  return options.find((workbook) => workbook.id === id)?.name ?? exampleLinkLabel(id) ?? "the linked workbook";
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
  const nothingToLink = options.length === 0 && exampleLabel === undefined;

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
            <span className="poshandoff__tile-role">{candidate.handoff}</span>
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
            </select>
          </div>
          {linkedId !== undefined && linked === undefined && exampleLabel === undefined && (
            <p className="posmuted esq-scope-note">The linked workbook is not in this project.</p>
          )}
          {exampleLabel !== undefined && (
            <table className="postable postable--mid" aria-label={`Linked ${tile.label} workbook`}>
              <thead><tr><th>Workbook</th><th>Status</th><th>Version</th><th>Owner</th><th>Updated</th></tr></thead>
              <tbody>
                <tr>
                  <td><div className="postable__name">{exampleLabel}</div></td>
                  <td>Example</td>
                  <td className="posmono">—</td>
                  <td>OpenPRA</td>
                  <td className="posmono">—</td>
                </tr>
              </tbody>
            </table>
          )}
          {linked !== undefined && (
            <table className="postable postable--mid" aria-label={`Linked ${tile.label} workbook`}>
              <thead><tr><th>Workbook</th><th>Status</th><th>Version</th><th>Owner</th><th>Updated</th></tr></thead>
              <tbody>
                <tr>
                  <td><div className="postable__name">{linked.name}</div></td>
                  <td>{WORKBOOK_STATUS_LABEL[linked.status] ?? linked.status}</td>
                  <td className="posmono">v{linked.version}</td>
                  <td>{linked.ownerFullName}</td>
                  <td className="posmono">{linked.updatedAt.slice(0, 10)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}

const EMPTY_SCOPE_TEXT: Record<EsqScopeAspect, string> = {
  HAZARD_GROUP: "No hazard group yet. Add one by hand.",
  OPERATING_STATE: "No operating state yet. Link POS or ES above, or add one by hand.",
  SOURCE: "No source yet. Link POS above, or add one by hand.",
  INITIATOR_GROUP: "No initiator group yet. Link IE or ES above, or add one by hand.",
};

function capitalized(text: string): string {
  return text.length === 0 ? text : `${text[0]?.toUpperCase() ?? ""}${text.slice(1)}`;
}

function EsqScopeTable(): JSX.Element {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const [aspect, setAspect] = useState<EsqScopeAspect>("HAZARD_GROUP");
  const [draftItem, setDraftItem] = useState("");
  const tabId = useId();
  const spec = ESQ_SCOPE_ASPECTS.find((candidate) => candidate.aspect === aspect) ?? ESQ_SCOPE_ASPECTS[0];
  const rows = scopeRowsView(esq, upstream, aspect);
  const unset = rows.filter((row) => row.state === "unset").length;
  const columns = spec.fromEs ? 4 : 3;

  function onState(row: EsqScopeRow, next: EsqScopeState): void {
    if (!editable) return;
    mutateEsq((draft) => withScopeState(draft, aspect, row, next));
  }
  function onReason(row: EsqScopeRow, reason: string): void {
    if (!editable) return;
    mutateEsq((draft) => withScopeReason(draft, aspect, row, reason));
  }
  function onAdd(): void {
    if (!editable || draftItem.trim().length === 0) return;
    const name = draftItem;
    mutateEsq((draft) => withScopeItemAdded(draft, aspect, name));
    setDraftItem("");
  }
  function onIncludeRest(): void {
    if (!editable) return;
    mutateEsq((draft) => withRestIncluded(draft, aspect, scopeRowsView(draft, upstream, aspect)));
  }

  return (
    <div className="esq-scope">
      <h4 className="esq-scope__title">Coverage</h4>
      <EsqTabs
        label="Coverage"
        tabs={ESQ_SCOPE_ASPECTS.map((candidate) => ({ id: candidate.aspect, label: `${candidate.label} (${scopeRowsView(esq, upstream, candidate.aspect).length})` }))}
        active={aspect}
        onChange={setAspect}
        idBase={tabId}
        className="esq-step__tabs esq-scope__tabs"
      />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${aspect}`} tabIndex={0} className="esq-scope__panel">
        <div className="esq-scope__wrap">
          <table className={`postable esq-scope__table${spec.fromEs ? " esq-scope__table--es" : ""}`} aria-label={spec.label}>
            <thead>
              <tr>
                <th>{capitalized(spec.item)}</th>
                {spec.fromEs && <th>In ES</th>}
                <th>Included?</th>
                <th>Reason for exclusion</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={columns} className="esq-scope__empty">{EMPTY_SCOPE_TEXT[aspect]}</td></tr>}
              {rows.map((row) => {
                const reasonMissing = row.state === "excluded" && row.reason.trim().length === 0;
                return (
                  <tr key={row.key}>
                    <td>
                      <span className="esq-scope__item">{row.label}</span>
                      {row.byHand && <span className="esq-scope__tag">By hand</span>}
                      {row.detail !== undefined && <span className="esq-scope__hint">{row.detail}</span>}
                    </td>
                    {spec.fromEs && <td>{row.inEs === undefined ? "—" : row.inEs ? "Yes" : "No"}</td>}
                    <td>
                      <select
                        className="posfield__select"
                        aria-label={`${row.label} inclusion`}
                        value={row.state}
                        disabled={!editable}
                        onChange={(event) => onState(row, event.target.value === "included" ? "included" : event.target.value === "excluded" ? "excluded" : "unset")}
                      >
                        <option value="unset">Not set</option>
                        <option value="included">Included</option>
                        <option value="excluded">Excluded</option>
                      </select>
                    </td>
                    <td>
                      {row.state === "excluded" ? (
                        <>
                          <WorkbookInput
                            className="posfield__input"
                            aria-label={`${row.label} exclusion reason`}
                            aria-invalid={reasonMissing}
                            value={row.reason}
                            disabled={!editable}
                            onChange={(event) => onReason(row, event.target.value)}
                          />
                          {reasonMissing && <span className="esq-scope__error" role="alert">Reason required</span>}
                        </>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {editable && (
          <div className="esq-scope__bar">
            <input
              className="posfield__input esq-scope__new"
              aria-label={`New ${spec.item}`}
              value={draftItem}
              onChange={(event) => setDraftItem(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") onAdd(); }}
            />
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={draftItem.trim().length === 0} onClick={onAdd}>Add {spec.item}</button>
            {unset > 0 && <button type="button" className="posnav__btn posnav__btn--sm esq-scope__rest" onClick={onIncludeRest}>Include the {unset} not set</button>}
          </div>
        )}
      </div>
    </div>
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

function EsqPlanCard(): JSX.Element {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const fieldId = useId();
  const values = planValues(esq);
  const plan: EsqQuantificationPlan = esq.quantificationPlan ?? {};
  const ieId = esq.linkedWorkbooks?.IE;
  const ieModules = upstream.ie?.metadata.plantIdentity?.numberOfModules;
  const modules = plan.modulesPerPlant;
  const link = modules?.link;
  const linkedToCurrent = link !== undefined && link.workbookId === ieId;
  const ieName = ieId === undefined ? undefined : linkedWorkbookLabel(ieId, upstream.options.IE);
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
  function onFrequencyBasis(value: EsqFrequencyBasis): void {
    patchPlan((current) => ({ ...current, frequencyBasis: value === ESQ_PLAN_DEFAULTS.frequencyBasis ? undefined : { value, reason: current.frequencyBasis?.reason } }));
  }
  function onStateWeighting(value: EsqStateWeighting): void {
    patchPlan((current) => ({ ...current, stateWeighting: value === ESQ_PLAN_DEFAULTS.stateWeighting ? undefined : { value, reason: current.stateWeighting?.reason } }));
  }
  function onModuleCounting(value: EsqModuleCounting): void {
    patchPlan((current) => ({ ...current, moduleCounting: value === ESQ_PLAN_DEFAULTS.moduleCounting ? undefined : { value, reason: current.moduleCounting?.reason } }));
  }
  function onReportingFloor(text: string): void {
    const value = Number(text);
    if (text.trim().length === 0 || !Number.isFinite(value)) return;
    patchPlan((current) => ({ ...current, reportingFloorPerYear: value === ESQ_PLAN_DEFAULTS.reportingFloorPerYear ? undefined : { value, reason: current.reportingFloorPerYear?.reason } }));
  }
  function onConvergence(text: string): void {
    const value = Number(text);
    if (text.trim().length === 0 || !Number.isFinite(value)) return;
    patchPlan((current) => ({ ...current, convergenceStepPercent: value === ESQ_PLAN_DEFAULTS.convergenceStepPercent ? undefined : { value, reason: current.convergenceStepPercent?.reason } }));
  }
  function onModulesSource(value: string): void {
    if (value === "linked" && ieId !== undefined && ieModules !== undefined) {
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
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="ESQ" title="Quantification plan" level={3} />
        <EsqProvenanceChip>ESQ-A2 · A4 · B3</EsqProvenanceChip>
      </div>
      <div className="esq-form esq-form--card">
        <FormRow label="Frequency basis" htmlFor={`${fieldId}-basis`}>
          <select id={`${fieldId}-basis`} className="posfield__select" value={values.frequencyBasis} disabled={!editable} onChange={(event) => onFrequencyBasis(event.target.value === "PER_REACTOR_YEAR" ? "PER_REACTOR_YEAR" : "PER_PLANT_YEAR")}>
            {FREQUENCY_BASIS_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <PlanDefault planKey="frequencyBasis" changed={planChanged(esq, "frequencyBasis")} editable={editable} onRestore={() => restore("frequencyBasis")} />
        </FormRow>
        <PlanReasonRow planKey="frequencyBasis" id={`${fieldId}-basis-reason`} />
        <FormRow label="State weighting" htmlFor={`${fieldId}-weighting`}>
          <select id={`${fieldId}-weighting`} className="posfield__select" value={values.stateWeighting} disabled={!editable} onChange={(event) => onStateWeighting(event.target.value === "TYPED_SHARES" ? "TYPED_SHARES" : "POS_HOURS")}>
            {STATE_WEIGHTING_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <PlanDefault planKey="stateWeighting" changed={planChanged(esq, "stateWeighting")} editable={editable} onRestore={() => restore("stateWeighting")} />
        </FormRow>
        <PlanReasonRow planKey="stateWeighting" id={`${fieldId}-weighting-reason`} />
        <FormRow label="Modules per plant" htmlFor={`${fieldId}-modules`}>
          {link === undefined ? (
            <WorkbookInput id={`${fieldId}-modules`} className="posfield__input posmono esq-form__number" type="number" min="1" step="1" value={modules?.value ?? ""} disabled={!editable}
              onChange={(event) => onModulesTyped(event.target.value)} />
          ) : (
            <span id={`${fieldId}-modules`} className="posmono esq-form__value">{modules?.value}</span>
          )}
          {ieId === undefined && link === undefined ? (
            <span className="esq-form__unit">Typed</span>
          ) : (
            <select className="posfield__select" aria-label="Modules per plant source" value={link === undefined ? "typed" : "linked"} disabled={!editable} onChange={(event) => onModulesSource(event.target.value)}>
              <option value="typed">Typed</option>
              {(link !== undefined || (ieId !== undefined && ieModules !== undefined)) && <option value="linked">Linked to IE · {link !== undefined && !linkedToCurrent ? linkedWorkbookLabel(link.workbookId, upstream.options.IE) : ieName}</option>}
            </select>
          )}
        </FormRow>
        {link !== undefined && !linkedToCurrent && (
          <p className="esq-form__warn" role="status">
            This value is linked to an IE workbook that ESQ no longer links.
            {editable && ieId !== undefined && ieModules !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onModulesSource("linked")}>Link to {ieName} ({ieModules})</button>}
          </p>
        )}
        {linkedToCurrent && ieModules !== undefined && modules !== undefined && ieModules !== modules.value && (
          <p className="esq-form__warn" role="status">
            The IE workbook now gives {ieModules} modules.
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onModulesSource("linked")}>Use {ieModules}</button>}
          </p>
        )}
        {(modules?.value ?? 1) > 1 && (
          <>
            <FormRow label="Single-module sequences" htmlFor={`${fieldId}-counting`}>
              <select id={`${fieldId}-counting`} className="posfield__select" value={values.moduleCounting} disabled={!editable} onChange={(event) => onModuleCounting(event.target.value === "ONCE_PER_PLANT" ? "ONCE_PER_PLANT" : "EACH_MODULE")}>
                {MODULE_COUNTING_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
              <PlanDefault planKey="moduleCounting" changed={planChanged(esq, "moduleCounting")} editable={editable} onRestore={() => restore("moduleCounting")} />
            </FormRow>
            <PlanReasonRow planKey="moduleCounting" id={`${fieldId}-counting-reason`} />
          </>
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
          <WorkbookInput id={`${fieldId}-floor`} className="posfield__input posmono esq-form__number" type="number" step="any" min="0" value={values.reportingFloorPerYear} disabled={!editable}
            onChange={(event) => onReportingFloor(event.target.value)} />
          <span className="esq-form__unit">per plant-year</span>
          <PlanDefault planKey="reportingFloorPerYear" changed={planChanged(esq, "reportingFloorPerYear")} editable={editable} onRestore={() => restore("reportingFloorPerYear")} />
        </FormRow>
        <PlanReasonRow planKey="reportingFloorPerYear" id={`${fieldId}-floor-reason`} />
        <FormRow label="Convergence step" htmlFor={`${fieldId}-convergence`}>
          <WorkbookInput id={`${fieldId}-convergence`} className="posfield__input posmono esq-form__number" type="number" step="any" min="0" max="100" value={values.convergenceStepPercent} disabled={!editable}
            onChange={(event) => onConvergence(event.target.value)} />
          <span className="esq-form__unit">% per decade</span>
          <PlanDefault planKey="convergenceStepPercent" changed={planChanged(esq, "convergenceStepPercent")} editable={editable} onRestore={() => restore("convergenceStepPercent")} />
        </FormRow>
        <PlanReasonRow planKey="convergenceStepPercent" id={`${fieldId}-convergence-reason`} />
      </div>
    </div>
  );
}

function ScopeScreen({ ccId, setCcId, stage, setStage, documents }: {
  ccId: string;
  setCcId: (id: string) => void;
  stage: Stage;
  setStage: (s: Stage) => void;
  documents: JSX.Element | null;
}): JSX.Element {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const todo = scopeItemsToComplete(esq, upstream);

  function onScopeChange(value: string): void {
    if (!editable) return;
    mutateEsq((draft) => ({ ...draft, praScope: value }));
  }
  function onCcChange(newCcId: string): void {
    if (!editable) return;
    setCcId(newCcId);
    mutateEsq((draft) => ({ ...draft, capabilityCategory: newCcId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(newStage: Stage): void {
    if (!editable) return;
    setStage(newStage);
    mutateEsq((draft) => ({ ...draft, plantStage: newStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" }));
  }

  return (
    <div className="esq-step">
      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading workbook="ESQ" title="Interfaces" level={3} /></div>
        <EsqInterfaces />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="ESQ" title="PRA scope" level={3} />
          <EsqProvenanceChip>ESQ-A2</EsqProvenanceChip>
        </div>
        <WorkbookTextarea
          className="posfield__textarea esq-scope__text"
          aria-label="PRA scope"
          rows={3}
          fitContent
          value={esq.praScope}
          disabled={!editable}
          onChange={(event) => onScopeChange(event.target.value)}
        />
        <EsqScopeTable />
      </div>

      <EsqPlanCard />

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="ESQ" title="Capability category" level={3} />
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <div className="esq-scope-choices">
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            return (
              <button key={c.id} type="button" className={`esq-scope-choice${active ? " esq-scope-choice--active" : ""}`} aria-pressed={active} disabled={!editable} onClick={() => onCcChange(c.id)}>
                <span className="esq-scope-choice__head">
                  <span className="esq-scope-choice__name">{c.name}</span>
                  <Badge kind={active ? "progress" : undefined}>{c.tag}</Badge>
                </span>
                <span className="esq-scope-choice__desc">{c.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading workbook="ESQ" title="Plant stage" level={3} /></div>
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

      {documents}

      {todo.length > 0 && (
        <details className="esq-todo">
          <summary>{todo.length} {todo.length === 1 ? "item" : "items"} to complete</summary>
          <ul>{todo.map((item) => <li key={item}>{item}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

export { ScopeScreen };
