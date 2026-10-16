import { JSX, useId } from "react";
import { carriesUncertainExpression, type SystemBasicEvent, type SystemLogicModel } from "interfaces-mef-types/sy/systems-analysis";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { FAILURE_RATE_CONVERSION_REVIEW_REQUIRED, failureRateToProbability, requiresFailureRateConversionReview } from "interfaces-mef-types/modeling";
import { ExpressionEditor } from "../newly-developed-methods/shared/uncertainEditor";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { DialogHead, PointValue } from "./syShared";
import { FAILURE_MODE_LABELS, toExp } from "./syViewData";
import { withMemberTotals } from "./syCcf";
import { useSyWorkbook } from "./syWorkbookContext";
import { syFaultTreeOperation, toFaultTreeEditorCatalogue } from "./SySystemModels";
import { heldValueDiffers } from "./syLinks";
import {
  linkedOptions,
  optionKey,
  pointExpression,
  useEventPoints,
  withExpression,
  withFailureMode,
} from "./syBasicEventValues";
import type { SyDrawerContext } from "./syScreens";
import { ownerSystem, useSyValueSources, useSystemHours } from "./syMissionTimes";
import { hoursPoint } from "../sc-workbooks/scMissionTimePoints";

type EventDialogKind = "be" | "house";

type RateBasis = Extract<NonNullable<SystemBasicEvent["quantificationBasis"]>, { kind: "FAILURE_RATE" }>;

type HouseEvent = Extract<SystemLogicModel["leafNodes"][number], { kind: "HOUSE_EVENT" }>;

const EVENT_DIALOG_KINDS: readonly EventDialogKind[] = ["be", "house"];

const VALUE_MODELS = ["MISSION", "STANDBY"] as const;

const TIME_UNIT_LABELS: Record<RateBasis["missionTime"]["unit"], string> = {
  SECOND: "s",
  MINUTE: "min",
  HOUR: "h",
  DAY: "d",
  YEAR: "yr",
};

const RATE_UNIT_LABELS: Record<RateBasis["failureRate"]["unit"], string> = {
  SECOND: "Per second",
  MINUTE: "Per minute",
  HOUR: "Per hour",
  DAY: "Per day",
  YEAR: "Per year",
};

const RATE_UNITS: readonly RateBasis["failureRate"]["unit"][] = ["HOUR", "DAY", "YEAR", "MINUTE", "SECOND"];

function isEventDialogKind(kind: SyDrawerContext["kind"]): kind is EventDialogKind {
  return EVENT_DIALOG_KINDS.some((candidate) => candidate === kind);
}

function parameterKey(workbookId: string, parameterId: string): string {
  return JSON.stringify([workbookId, parameterId]);
}

function humanFailureKey(workbookId: string, eventId: string, quantificationId: string): string {
  return JSON.stringify([workbookId, eventId, quantificationId]);
}

function failureModeKey(workbookId: string, failureModeId: string): string {
  return JSON.stringify([workbookId, failureModeId]);
}

function nonNegativeNumber(value: string): number | undefined {
  if (value.trim().length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function unlinked(event: SystemBasicEvent): SystemBasicEvent {
  const { controlledDataSource: _source, dataAnalysisBasicEventRef: _reference, ...rest } = event;
  return rest;
}

function BasicEventDialog({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf, controlledParameters, controlledLegacyParameters, controlledHumanFailures, controlledFailureModes } = useSyWorkbook();
  const modeListId = useId();
  const values = useSyValueSources();
  const found = sy.systemBasicEvents.find((event) => event.uuid === id);
  const point = useEventPoints(found === undefined ? [] : [found], values.table).get(id);
  const owner = found === undefined ? undefined : ownerSystem(sy, found.uuid);
  const ownerHours = hoursPoint(useSystemHours(owner === undefined ? [] : [owner]).get(owner?.uuid ?? ""));

  if (found === undefined) return null;
  const be = found;
  const ownerRef = owner?.uuid;
  const component = carriesUncertainExpression(be.failureMode);
  const rateBasis = be.quantificationBasis?.kind === "FAILURE_RATE" ? be.quantificationBasis : undefined;
  const needsReview = requiresFailureRateConversionReview(rateBasis);
  const isHuman = be.failureMode === "HUMAN_ERROR";
  const source = be.controlledDataSource;
  const sourceKey = source === undefined ? ""
    : source.referenceType === "HUMAN_FAILURE_EVENT"
      ? humanFailureKey(source.workbookId, source.entityId, source.quantificationId)
      : parameterKey(source.workbookId, source.entityId);
  const parameterOptions = controlledLegacyParameters.filter((option) => (rateBasis === undefined) === (option.rateUnit === undefined));
  const linkedParameter = parameterOptions.find((option) => parameterKey(option.workbookId, option.parameterId) === sourceKey);
  const linkedHumanFailure = controlledHumanFailures.find((option) => humanFailureKey(option.workbookId, option.humanFailureEventId, option.quantificationId) === sourceKey);
  const sourceKnown = isHuman ? linkedHumanFailure !== undefined : linkedParameter !== undefined;
  const heldDiffers = isHuman
    ? linkedHumanFailure?.value !== undefined && heldValueDiffers(be, linkedHumanFailure.value)
    : linkedParameter !== undefined && heldValueDiffers(be, linkedParameter.value, linkedParameter.rateUnit);
  const liveValue = isHuman ? linkedHumanFailure?.value : linkedParameter?.value;
  const liveUnit = isHuman ? undefined : linkedParameter?.rateUnit;
  const heldText = rateBasis === undefined ? (be.probability === undefined ? "no value" : toExp(be.probability)) : `${toExp(rateBasis.failureRate.value)} /${TIME_UNIT_LABELS[rateBasis.failureRate.unit]}`;
  const sourceLabel = isHuman ? "Human Reliability event and HEP" : "Data Analysis parameter";
  const sourceChoices = isHuman ? controlledHumanFailures.length : controlledLegacyParameters.length;
  const failureMode = be.failureMode ?? "";
  const failureModeLabel = FAILURE_MODE_LABELS[failureMode] ?? failureMode;
  const modeSource = be.failureModeSource;
  const modeKey = modeSource === undefined ? "" : failureModeKey(modeSource.workbookId, modeSource.failureModeId);
  const modeKnown = modeSource === undefined || controlledFailureModes.some((option) => failureModeKey(option.workbookId, option.failureModeId) === modeKey);
  const repairJustification = be.repairJustification ?? "";
  const justificationMissing = be.repairModeled === true && repairJustification.trim().length === 0;

  function replace(change: (event: SystemBasicEvent) => SystemBasicEvent): void {
    if (!editable) return;
    mutateSy((draft) => withMemberTotals({
      ...draft,
      systemBasicEvents: draft.systemBasicEvents.map((event) => (event.uuid === be.uuid ? change(event) : event)),
    }, new Set([be.uuid])));
  }

  function patch(fields: Partial<SystemBasicEvent>): void {
    replace((event) => ({ ...event, ...fields }));
  }

  function setExpression(expression: UncertainExpression): void {
    const before = new Set(linkedOptions(be.expression, controlledParameters).map(optionKey));
    const added = linkedOptions(expression, controlledParameters).filter((option) => !before.has(optionKey(option)));
    const named = added.length === 1 ? added[0] : undefined;
    replace((event) => {
      const valued = withExpression(event, expression);
      if (named?.failureModeId === undefined || named.failureModeName === undefined) return valued;
      return withFailureMode(valued, named.failureModeName, { workbookId: named.workbookId, failureModeId: named.failureModeId }, owner?.missionTime);
    });
  }

  function setInput(kind: string): void {
    if (kind === "PROBABILITY") {
      patch({ quantificationBasis: { kind: "PROBABILITY" }, controlledDataSource: undefined, dataAnalysisBasicEventRef: undefined });
      return;
    }
    if (rateBasis !== undefined || ownerHours === undefined) return;
    const basis: RateBasis = {
      kind: "FAILURE_RATE",
      failureRate: { value: 0, unit: "HOUR" },
      missionTime: { value: ownerHours, unit: "HOUR" },
      conversion: "EXPONENTIAL",
    };
    patch({ quantificationBasis: basis, probability: failureRateToProbability(basis), controlledDataSource: undefined, dataAnalysisBasicEventRef: undefined });
  }

  function setModeSource(key: string): void {
    const option = controlledFailureModes.find((candidate) => failureModeKey(candidate.workbookId, candidate.failureModeId) === key);
    if (option === undefined) {
      replace((event) => withFailureMode(event, event.failureMode, undefined, owner?.missionTime));
      return;
    }
    replace((event) => unlinked(withFailureMode(event, option.name, { workbookId: option.workbookId, failureModeId: option.failureModeId }, owner?.missionTime)));
  }

  function setTypedMode(text: string): void {
    const typed = text.trim();
    const standard = Object.keys(FAILURE_MODE_LABELS).find((code) => FAILURE_MODE_LABELS[code]?.toLowerCase() === typed.toLowerCase());
    replace((event) => unlinked(withFailureMode(event, typed.length === 0 ? undefined : standard ?? typed, undefined, owner?.missionTime)));
  }

  function setRate(basis: RateBasis): void {
    patch(requiresFailureRateConversionReview(basis) ? { quantificationBasis: basis } : { quantificationBasis: basis, probability: failureRateToProbability(basis) });
  }

  function setSource(key: string): void {
    if (isHuman) {
      const option = controlledHumanFailures.find((candidate) => humanFailureKey(candidate.workbookId, candidate.humanFailureEventId, candidate.quantificationId) === key);
      if (option === undefined) {
        patch({ controlledDataSource: undefined });
        return;
      }
      patch({
        ...(option.value === undefined ? {} : { probability: option.value }),
        quantificationBasis: { kind: "PROBABILITY" },
        controlledDataSource: { referenceType: "HUMAN_FAILURE_EVENT", workbookId: option.workbookId, entityId: option.humanFailureEventId, quantificationId: option.quantificationId },
        dataAnalysisBasicEventRef: undefined,
      });
      return;
    }
    const option = parameterOptions.find((candidate) => parameterKey(candidate.workbookId, candidate.parameterId) === key);
    if (option === undefined) {
      patch({ controlledDataSource: undefined, dataAnalysisBasicEventRef: undefined });
      return;
    }
    const nextBasis = rateBasis === undefined ? undefined : { ...rateBasis, failureRate: { value: option.value, unit: option.rateUnit ?? rateBasis.failureRate.unit } };
    patch({
      probability: nextBasis === undefined ? option.value : failureRateToProbability(nextBasis),
      quantificationBasis: nextBasis ?? { kind: "PROBABILITY" },
      controlledDataSource: { referenceType: "WORKBOOK_PARAMETER", workbookId: option.workbookId, entityId: option.parameterId },
      dataAnalysisBasicEventRef: undefined,
    });
  }

  function applyExponential(): void {
    if (rateBasis === undefined) return;
    const rate = linkedParameter === undefined ? rateBasis.failureRate : { value: linkedParameter.value, unit: linkedParameter.rateUnit ?? rateBasis.failureRate.unit };
    const reviewed: RateBasis = { ...rateBasis, failureRate: rate, conversion: "EXPONENTIAL" };
    patch({ quantificationBasis: reviewed, probability: failureRateToProbability(reviewed) });
  }

  function componentValue(): JSX.Element {
    return (
      <div className="posfield posfield-grid--span2"><span className="posfield__label">Value</span>
        {be.expression === undefined ? (
          <div className="sy-event-review">
            <p className="sy-error">No value yet.</p>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setExpression(pointExpression(0))}>Add a value</button>}
          </div>
        ) : (
          <>
            <ExpressionEditor expression={be.expression} unit="PROBABILITY" options={values.options} models={VALUE_MODELS} defaultTime={owner?.missionTime} disabled={!editable} onChange={setExpression} />
            <span className="sy-review-sub">Point value <PointValue state={point} /></span>
          </>
        )}
        {controlledParameters.length === 0 && <span className="posmuted">Typed. Link a DA workbook in Step 01 Interfaces to pick a parameter.</span>}
      </div>
    );
  }

  function legacyValue(): JSX.Element {
    return (
      <>
        {!isHuman && !needsReview && (
          <div className="posfield"><label className="posfield__label">Input</label>
            {editable ? (
              <select className="posfield__select" aria-label="Input" value={rateBasis === undefined ? "PROBABILITY" : "FAILURE_RATE"} onChange={(event) => setInput(event.target.value)}>
                <option value="PROBABILITY">Probability</option>
                <option value="FAILURE_RATE" disabled={rateBasis === undefined && ownerHours === undefined}>Failure rate</option>
              </select>
            ) : <div>{rateBasis === undefined ? "Probability" : "Failure rate"}</div>}
          </div>
        )}
        {rateBasis !== undefined && (
          <div className="posfield"><label className="posfield__label">Mission time ({TIME_UNIT_LABELS[rateBasis.missionTime.unit]})</label>
            {editable ? <WorkbookInput className="posfield__input posmono" type="number" min="0" step="any" aria-label="Mission time" value={rateBasis.missionTime.value} onChange={(event) => {
              const time = nonNegativeNumber(event.target.value);
              if (time !== undefined && time > 0) setRate({ ...rateBasis, missionTime: { ...rateBasis.missionTime, value: time } });
            }} /> : <div className="posmono">{rateBasis.missionTime.value}</div>}
          </div>
        )}
        <div className="posfield posfield-grid--span2"><label className="posfield__label">{sourceLabel}</label>
          {source === undefined && sourceChoices === 0 ? (
            <span className="posmuted">{isHuman ? "Typed. Link an HR workbook in Step 01 Interfaces to pick its event and HEP." : "Typed. Link a DA workbook in Step 01 Interfaces to pick a parameter."}</span>
          ) : editable ? (
            <select className="posfield__select" aria-label={sourceLabel} value={sourceKey} disabled={needsReview} onChange={(event) => setSource(event.target.value)}>
              <option value="">Typed</option>
              {source !== undefined && !sourceKnown && <option value={sourceKey}>Linked source unavailable</option>}
              {isHuman
                ? controlledHumanFailures.map((option) => {
                    const key = humanFailureKey(option.workbookId, option.humanFailureEventId, option.quantificationId);
                    return <option key={key} value={key}>{option.workbookName} · {option.humanFailureEventName} · {option.methodology} · {option.valueText}</option>;
                  })
                : parameterOptions.map((option) => {
                    const key = parameterKey(option.workbookId, option.parameterId);
                    return <option key={key} value={key}>{option.workbookName} · {option.parameterName} · {toExp(option.value)}{option.rateUnit === undefined ? "" : ` /${TIME_UNIT_LABELS[option.rateUnit]}`}</option>;
                  })}
            </select>
          ) : (
            <div>{source === undefined ? "Typed"
              : isHuman && linkedHumanFailure !== undefined ? `${linkedHumanFailure.workbookName} · ${linkedHumanFailure.humanFailureEventName} · ${linkedHumanFailure.methodology}`
              : linkedParameter !== undefined ? `${linkedParameter.workbookName} · ${linkedParameter.parameterName}`
              : "Linked source unavailable"}</div>
          )}
        </div>
        {heldDiffers && liveValue !== undefined && (
          <div className="posfield posfield-grid--span2 sy-event-review">
            <p className="sy-warn" role="status">{isHuman ? "HR" : "DA"} now gives {toExp(liveValue)}{liveUnit === undefined ? "" : ` /${TIME_UNIT_LABELS[liveUnit]}`}. This event still holds {heldText}.</p>
            {editable && !needsReview && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setSource(sourceKey)}>{isHuman ? "Apply HR value" : "Apply DA value"}</button>}
          </div>
        )}
        {source === undefined && rateBasis === undefined && (
          <div className="posfield"><label className="posfield__label">Probability</label>
            {editable ? <WorkbookInput className="posfield__input posmono" type="number" min="0" max="1" step="any" aria-label="Probability" value={be.probability ?? ""} onChange={(event) => {
              const value = nonNegativeNumber(event.target.value);
              if (value !== undefined && value <= 1) patch({ probability: value, quantificationBasis: { kind: "PROBABILITY" } });
            }} /> : <div className="posmono">{be.probability === undefined ? "" : toExp(be.probability)}</div>}
          </div>
        )}
        {source === undefined && rateBasis !== undefined && (
          <div className="posfield"><label className="posfield__label">Failure rate (per {TIME_UNIT_LABELS[rateBasis.failureRate.unit]})</label>
            {editable ? <WorkbookInput className="posfield__input posmono" type="number" min="0" step="any" aria-label="Failure rate" value={rateBasis.failureRate.value} onChange={(event) => {
              const rate = nonNegativeNumber(event.target.value);
              if (rate !== undefined) setRate({ ...rateBasis, failureRate: { ...rateBasis.failureRate, value: rate } });
            }} /> : <div className="posmono">{toExp(rateBasis.failureRate.value)}</div>}
          </div>
        )}
        {source === undefined && rateBasis !== undefined && (
          <div className="posfield"><label className="posfield__label">Rate unit</label>
            {editable ? (
              <select className="posfield__select" aria-label="Rate unit" value={rateBasis.failureRate.unit} onChange={(event) => {
                const unit = RATE_UNITS.find((candidate) => candidate === event.target.value);
                if (unit !== undefined) setRate({ ...rateBasis, failureRate: { ...rateBasis.failureRate, unit } });
              }}>
                {RATE_UNITS.map((unit) => <option key={unit} value={unit}>{RATE_UNIT_LABELS[unit]}</option>)}
              </select>
            ) : <div>{RATE_UNIT_LABELS[rateBasis.failureRate.unit]}</div>}
          </div>
        )}
        {needsReview && (
          <div className="posfield posfield-grid--span2 sy-event-review">
            <p className="sy-error" role="alert">{FAILURE_RATE_CONVERSION_REVIEW_REQUIRED}</p>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={applyExponential}>Use exponential conversion</button>}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <DialogHead cap={`Basic event · ${ownerRef === undefined ? "Workbook catalogue" : shortOf(ownerRef)}`} title={be.name.length > 0 ? be.name : be.code} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="Basic event name" value={be.name} onChange={(event) => { if (event.target.value.trim().length > 0) patch({ name: event.target.value.trim() }); }} /> : <div>{be.name}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Code</label>
            {editable ? <WorkbookInput className="posfield__input posmono" aria-label="Basic event code" value={be.code} onChange={(event) => { if (event.target.value.trim().length > 0) patch({ code: event.target.value.trim() }); }} /> : <div className="posmono">{be.code}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Failure mode source</label>
            {controlledFailureModes.length === 0 && modeSource === undefined ? <span className="posmuted">Typed. Link a DA workbook with failure modes in Step 01 Interfaces to pick one.</span> : editable ? (
              <select className="posfield__select" aria-label="Failure mode source" value={modeKey} onChange={(event) => setModeSource(event.target.value)}>
                <option value="">Typed</option>
                {!modeKnown && <option value={modeKey}>Linked failure mode unavailable</option>}
                {controlledFailureModes.map((option) => {
                  const key = failureModeKey(option.workbookId, option.failureModeId);
                  return <option key={key} value={key}>{option.workbookName} · {option.name}</option>;
                })}
              </select>
            ) : <div>{modeSource === undefined ? "Typed" : modeKnown ? failureModeLabel : "Linked failure mode unavailable"}</div>}
          </div>
          {modeSource === undefined && (
            <div className="posfield"><label className="posfield__label">Failure mode</label>
              {editable ? (
                <>
                  <WorkbookInput className="posfield__input" aria-label="Failure mode" list={modeListId} value={failureModeLabel} onChange={(event) => setTypedMode(event.target.value)} />
                  <datalist id={modeListId}>{Object.values(FAILURE_MODE_LABELS).map((label) => <option key={label} value={label} />)}</datalist>
                </>
              ) : <div>{failureModeLabel}</div>}
            </div>
          )}
          {component ? componentValue() : legacyValue()}
          <div className="posfield"><label className="posfield__label">Repair credited</label>
            {editable ? (
              <select className="posfield__select" aria-label="Repair credited" value={be.repairModeled === true ? "yes" : "no"} onChange={(event) => patch({ repairModeled: event.target.value === "yes" })}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            ) : <div>{be.repairModeled === true ? "Yes" : "No"}</div>}
          </div>
          {be.repairModeled === true && (
            <div className="posfield"><label className="posfield__label">Mean time to repair (h)</label>
              {editable ? <WorkbookInput className="posfield__input posmono" type="number" min="0" step="any" aria-label="Mean time to repair (h)" value={be.meanTimeToRepair ?? ""} onChange={(event) => {
                const hours = nonNegativeNumber(event.target.value);
                if (event.target.value.trim().length === 0 || hours !== undefined) patch({ meanTimeToRepair: hours });
              }} /> : <div className="posmono">{be.meanTimeToRepair ?? ""}</div>}
            </div>
          )}
          {be.repairModeled === true && (
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Why repair is credited</label>
              {editable ? (
                <>
                  <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="Repair justification" aria-invalid={justificationMissing} value={repairJustification} onChange={(event) => patch({ repairJustification: event.target.value.trim().length === 0 ? undefined : event.target.value })} />
                  {justificationMissing && <span className="sy-error" role="alert">Justification required</span>}
                </>
              ) : <div>{repairJustification}</div>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function HouseEventDialog({ id, modelId, onClose }: { id: string; modelId: string | undefined; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, shortOf, controlledLegacyParameters, controlledHumanFailures } = useSyWorkbook();
  const model = sy.systemLogicModels.find((candidate) => candidate.uuid === modelId);
  const leaf = model?.leafNodes.find((candidate) => candidate.id === id);
  if (model === undefined || leaf === undefined || leaf.kind !== "HOUSE_EVENT") return null;
  const logic = model;
  const house: HouseEvent = leaf;

  function update(fields: Partial<Pick<HouseEvent, "code" | "name" | "description" | "state">>): void {
    if (!editable) return;
    const catalogue = toFaultTreeEditorCatalogue(sy.systemBasicEvents, { legacyParameters: controlledLegacyParameters, humanFailures: controlledHumanFailures });
    mutateSy(syFaultTreeOperation(logic, catalogue, { type: "UPDATE_LEAF", leafId: house.id, leaf: { ...house, ...fields } }));
  }

  return (
    <>
      <DialogHead cap={`House event · ${shortOf(logic.systemReference)}`} title={house.name.length > 0 ? house.name : house.code} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
            {editable ? <WorkbookInput className="posfield__input" aria-label="House event name" value={house.name} onChange={(event) => { if (event.target.value.trim().length > 0) update({ name: event.target.value.trim() }); }} /> : <div>{house.name}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">Code</label>
            {editable ? <WorkbookInput className="posfield__input posmono" aria-label="House event code" value={house.code} onChange={(event) => { if (event.target.value.trim().length > 0) update({ code: event.target.value.trim() }); }} /> : <div className="posmono">{house.code}</div>}
          </div>
          <div className="posfield"><label className="posfield__label">State</label>
            {editable ? (
              <select className="posfield__select" aria-label="State" value={house.state ? "true" : "false"} onChange={(event) => update({ state: event.target.value === "true" })}>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : <div>{house.state ? "True" : "False"}</div>}
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label">Description</label>
            {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} aria-label="House event description" value={house.description} onChange={(event) => update({ description: event.target.value })} /> : <div>{house.description}</div>}
          </div>
        </div>
      </div>
    </>
  );
}

function EventDialogContent({ context, onClose }: { context: SyDrawerContext & { kind: EventDialogKind }; onClose: () => void }): JSX.Element | null {
  if (context.kind === "house") return <HouseEventDialog id={context.id} modelId={context.modelId} onClose={onClose} />;
  return <BasicEventDialog id={context.id} onClose={onClose} />;
}

export { EventDialogContent, isEventDialogKind };
export type { EventDialogKind };
