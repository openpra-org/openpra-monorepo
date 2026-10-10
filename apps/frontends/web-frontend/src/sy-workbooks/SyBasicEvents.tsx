import { JSX } from "react";
import { carriesUncertainExpression, type SystemBasicEvent, type SystemLogicModel } from "interfaces-mef-types/sy/systems-analysis";
import { systemLogicModelBasicEvents } from "interfaces-mef-types/sy/system-models";
import { requiresFailureRateConversionReview } from "interfaces-mef-types/modeling";
import { expressionText } from "../newly-developed-methods/shared/uncertainText";
import { PointValue, SYProvenanceChip } from "./syShared";
import { heldValueDiffers } from "./syLinks";
import { FAILURE_MODE_LABELS, toExp } from "./syViewData";
import { linkedOptions, missingReferences, useEventPoints } from "./syBasicEventValues";
import { linkedMissionTimes, useSyValueSources } from "./syMissionTimes";
import { useSyWorkbook, type SyControlledHumanFailureOption, type SyControlledLegacyParameterOption } from "./syWorkbookContext";
import type { SyDrawerContext } from "./syScreens";

type RateBasis = Extract<NonNullable<SystemBasicEvent["quantificationBasis"]>, { kind: "FAILURE_RATE" }>;

const TIME_UNIT_LABELS: Record<RateBasis["missionTime"]["unit"], string> = {
  SECOND: "s",
  MINUTE: "min",
  HOUR: "h",
  DAY: "d",
  YEAR: "yr",
};

function linkedParameter(event: SystemBasicEvent, options: readonly SyControlledLegacyParameterOption[]): SyControlledLegacyParameterOption | undefined {
  const source = event.controlledDataSource;
  if (source === undefined || source.referenceType !== "WORKBOOK_PARAMETER") return undefined;
  return options.find((option) => option.workbookId === source.workbookId && option.parameterId === source.entityId);
}

function linkedHumanFailure(event: SystemBasicEvent, options: readonly SyControlledHumanFailureOption[]): SyControlledHumanFailureOption | undefined {
  const source = event.controlledDataSource;
  if (source === undefined || source.referenceType !== "HUMAN_FAILURE_EVENT") return undefined;
  return options.find((option) => option.workbookId === source.workbookId && option.humanFailureEventId === source.entityId && option.quantificationId === source.quantificationId);
}

function SyBasicEvents({ logic, openDrawer }: {
  logic: SystemLogicModel;
  openDrawer: (context: SyDrawerContext) => void;
}): JSX.Element {
  const { sy, editable, controlledParameters, controlledLegacyParameters, controlledHumanFailures } = useSyWorkbook();
  const actionLabel = editable ? "Edit" : "View";
  const events = systemLogicModelBasicEvents(sy, logic);
  const houseEvents = logic.leafNodes.flatMap((leaf) => (leaf.kind === "HOUSE_EVENT" ? [leaf] : []));
  const values = useSyValueSources();
  const points = useEventPoints(events, values.table);
  const label = values.label;

  function componentValueCell(event: SystemBasicEvent): JSX.Element {
    if (event.expression === undefined) return <span className="sy-error">Not set</span>;
    return (
      <>
        <div><PointValue state={points.get(event.uuid)} /></div>
        <span className="sy-review-sub">{expressionText(event.expression, label)}</span>
      </>
    );
  }

  function componentSourceCell(event: SystemBasicEvent): JSX.Element {
    const sources = linkedOptions(event.expression, controlledParameters);
    const missionTimes = linkedMissionTimes(event.expression, values.missionTimeOptions);
    const missing = missingReferences(event.expression, values.table);
    if (sources.length === 0 && missionTimes.length === 0 && missing.length === 0) return <span>Typed</span>;
    return (
      <>
        {sources.map((source) => (
          <div key={`${source.workbookId}:${source.parameterId}`}>
            <div>DA · {source.parameterName}</div>
            <span className="sy-review-sub">{source.workbookName}</span>
          </div>
        ))}
        {missionTimes.map((option) => <div key={option.label}>SC · {option.label}</div>)}
        {missing.length > 0 && <span className="sy-error">Linked source unavailable</span>}
      </>
    );
  }

  function valueCell(event: SystemBasicEvent): JSX.Element {
    if (carriesUncertainExpression(event.failureMode)) return componentValueCell(event);
    const rateBasis = event.quantificationBasis?.kind === "FAILURE_RATE" ? event.quantificationBasis : undefined;
    if (requiresFailureRateConversionReview(rateBasis)) return <span className="sy-error">Review the conversion</span>;
    const parameter = linkedParameter(event, controlledLegacyParameters);
    if (rateBasis !== undefined) {
      const rate = parameter?.rateUnit === undefined ? rateBasis.failureRate : { value: parameter.value, unit: parameter.rateUnit };
      return (
        <>
          <div className="posmono">{toExp(rate.value)} /{TIME_UNIT_LABELS[rate.unit]}</div>
          <span className="sy-review-sub">{rateBasis.missionTime.value} {TIME_UNIT_LABELS[rateBasis.missionTime.unit]} mission</span>
        </>
      );
    }
    const humanFailure = linkedHumanFailure(event, controlledHumanFailures);
    const value = parameter !== undefined && parameter.rateUnit === undefined ? parameter.value : humanFailure?.value ?? event.probability;
    return value === undefined ? <span className="sy-error">Not set</span> : <span className="posmono">{toExp(value)}</span>;
  }

  function sourceCell(event: SystemBasicEvent): JSX.Element {
    if (carriesUncertainExpression(event.failureMode)) return componentSourceCell(event);
    if (event.controlledDataSource === undefined) return <span>Typed</span>;
    const parameter = linkedParameter(event, controlledLegacyParameters);
    if (parameter !== undefined) {
      return (
        <>
          <div>DA · {parameter.parameterName}</div>
          <span className="sy-review-sub">{parameter.workbookName}</span>
          {heldValueDiffers(event, parameter.value, parameter.rateUnit) && <span className="sy-review-sub sy-warn">Value changed in DA</span>}
        </>
      );
    }
    const humanFailure = linkedHumanFailure(event, controlledHumanFailures);
    if (humanFailure !== undefined) {
      return (
        <>
          <div>HR · {humanFailure.humanFailureEventName}</div>
          <span className="sy-review-sub">{humanFailure.workbookName} · {humanFailure.methodology}</span>
          {humanFailure.value !== undefined && heldValueDiffers(event, humanFailure.value) && <span className="sy-review-sub sy-warn">Value changed in HR</span>}
        </>
      );
    }
    return <span className="sy-error">Linked source unavailable</span>;
  }

  return (
    <div className="sy-review">
      <section className="sy-review-section" aria-label="Basic events">
        <div className="sy-review-title">
          <h3>Basic events</h3>
          <div className="sy-review-actions"><SYProvenanceChip>SY-A19 · A30 · A31</SYProvenanceChip></div>
        </div>
        {events.length === 0 ? <p className="sy-review-empty">No basic events in this fault tree yet. Add them in the Fault tree tab by right-clicking a gate.</p> : (
          <table className="sy-review-table sy-review-events" aria-label="Basic events">
            <thead><tr><th scope="col">Event</th><th scope="col">Failure mode</th><th scope="col">Value</th><th scope="col">Data source</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
            <tbody>
              {events.map((event) => {
                const failureMode = event.failureMode ?? "";
                return (
                  <tr key={event.uuid}>
                    <td>
                      <span className="sy-review-name">{event.name}</span>
                      <span className="sy-review-sub posmono">{event.code}</span>
                    </td>
                    <td>
                      {failureMode.length === 0 ? <span className="sy-review-none">Not recorded</span> : <span>{FAILURE_MODE_LABELS[failureMode] ?? failureMode}</span>}
                      {failureMode.length > 0 && <span className="sy-review-sub">{event.failureModeSource === undefined ? "Typed" : "DA"}</span>}
                    </td>
                    <td>{valueCell(event)}</td>
                    <td>{sourceCell(event)}</td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${event.code}`} onClick={() => openDrawer({ kind: "be", id: event.uuid })}>{actionLabel}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="sy-review-section" aria-label="House events">
        <div className="sy-review-title">
          <h3>House events</h3>
          <div className="sy-review-actions"><SYProvenanceChip>SY-A7 · A15</SYProvenanceChip></div>
        </div>
        {houseEvents.length === 0 ? <p className="sy-review-empty">No house events in this fault tree.</p> : (
          <table className="sy-review-table" aria-label="House events">
            <tbody>
              {houseEvents.map((leaf) => (
                <tr key={leaf.id}>
                  <th scope="row">
                    <span>{leaf.name}</span>
                    <span className="sy-review-sub posmono">{leaf.code}</span>
                  </th>
                  <td>{leaf.state ? "True" : "False"}</td>
                  <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${leaf.code}`} onClick={() => openDrawer({ kind: "house", id: leaf.id, modelId: logic.uuid })}>{actionLabel}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export { SyBasicEvents };
