import { JSX } from "react";
import type { SystemBasicEvent, SystemLogicModel } from "interfaces-mef-types/sy/systems-analysis";
import { systemLogicModelBasicEvents } from "interfaces-mef-types/sy/system-models";
import { requiresFailureRateConversionReview } from "interfaces-mef-types/modeling";
import { SYProvenanceChip } from "./syShared";
import { FAILURE_MODE_LABELS, toExp } from "./syViewData";
import { useSyWorkbook, type SyControlledHumanFailureOption, type SyControlledParameterOption } from "./syWorkbookContext";
import type { SyDrawerContext } from "./syScreens";

type RateBasis = Extract<NonNullable<SystemBasicEvent["quantificationBasis"]>, { kind: "FAILURE_RATE" }>;

const TIME_UNIT_LABELS: Record<RateBasis["missionTime"]["unit"], string> = {
  SECOND: "s",
  MINUTE: "min",
  HOUR: "h",
  DAY: "d",
  YEAR: "yr",
};

function linkedParameter(event: SystemBasicEvent, options: readonly SyControlledParameterOption[]): SyControlledParameterOption | undefined {
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
  const { sy, editable, controlledParameters, controlledHumanFailures } = useSyWorkbook();
  const actionLabel = editable ? "Edit" : "View";
  const events = systemLogicModelBasicEvents(sy, logic);
  const houseEvents = logic.leafNodes.flatMap((leaf) => (leaf.kind === "HOUSE_EVENT" ? [leaf] : []));

  function valueCell(event: SystemBasicEvent): JSX.Element {
    const rateBasis = event.quantificationBasis?.kind === "FAILURE_RATE" ? event.quantificationBasis : undefined;
    if (requiresFailureRateConversionReview(rateBasis)) return <span className="sy-error">Review the conversion</span>;
    const parameter = linkedParameter(event, controlledParameters);
    if (rateBasis !== undefined) {
      const rate = parameter?.parameterType === "FREQUENCY" ? parameter.value : rateBasis.failureRate.value;
      return (
        <>
          <div className="posmono">{toExp(rate)} /{TIME_UNIT_LABELS[rateBasis.failureRate.unit]}</div>
          <span className="sy-review-sub">{rateBasis.missionTime.value} {TIME_UNIT_LABELS[rateBasis.missionTime.unit]} mission</span>
        </>
      );
    }
    const humanFailure = linkedHumanFailure(event, controlledHumanFailures);
    const value = parameter !== undefined && parameter.parameterType !== "FREQUENCY" ? parameter.value : humanFailure?.value ?? event.probability;
    return value === undefined ? <span className="sy-error">Not set</span> : <span className="posmono">{toExp(value)}</span>;
  }

  function sourceCell(event: SystemBasicEvent): JSX.Element {
    if (event.controlledDataSource === undefined) return <span>Typed</span>;
    const parameter = linkedParameter(event, controlledParameters);
    if (parameter !== undefined) {
      return (
        <>
          <div>DA · {parameter.parameterName}</div>
          <span className="sy-review-sub">{parameter.workbookName}</span>
        </>
      );
    }
    const humanFailure = linkedHumanFailure(event, controlledHumanFailures);
    if (humanFailure !== undefined) {
      return (
        <>
          <div>HR · {humanFailure.humanFailureEventName}</div>
          <span className="sy-review-sub">{humanFailure.workbookName} · {humanFailure.methodology}</span>
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
        {events.length === 0 ? <p className="sy-review-empty">No basic events in this fault tree yet.</p> : (
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
