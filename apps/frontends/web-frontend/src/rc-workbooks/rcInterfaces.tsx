import { JSX, useEffect, useId, useRef, useState } from "react";
import type { RadiologicalConsequenceAnalysis, RcLinkedWorkbooks, ReleaseCategoryInputs } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { rcFamilyAssignments, rcFamilyReferenceMatches, rcLostFamilyOverrides, rcWithFamilyOverrideRemoved, rcWithFamilyReason } from "interfaces-shared-types/rc-workbooks/linked-data";
import { blankRcMetric, nextRcMetricId, rcMetricMatchesMeasure } from "interfaces-shared-types/rc-workbooks/metrics";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { HandoffImports } from "../workbooks/workbookHandoff";
import { HANDOFF_ELEMENT_NAMES } from "interfaces-mef-types/technical-element-handoff";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RcMsSourceTerm } from "./rcMsSourceTerm";
import { RC_LINK_CODES, loadRcLinkReplacement, rcExampleLinkLabel, type RcLinkCode, type RcMutation } from "./rcLinks";
import type { RcDrawerContext } from "./rcScreens";

interface PendingLink {
  code: RcLinkCode;
  workbookId: string;
  replaced: string;
  replace: RcMutation;
}

function withCategories(rc: RadiologicalConsequenceAnalysis, releaseCategoryInputs: ReleaseCategoryInputs[]): RadiologicalConsequenceAnalysis {
  return { ...rc, releaseCategoryToConsequence: { ...rc.releaseCategoryToConsequence, releaseCategoryInputs } };
}

function withLinkedWorkbook(rc: RadiologicalConsequenceAnalysis, code: RcLinkCode, id: string): RadiologicalConsequenceAnalysis {
  const current: RcLinkedWorkbooks = rc.linkedWorkbooks ?? {};
  const next: RcLinkedWorkbooks = {};
  RC_LINK_CODES.forEach((candidate) => {
    const value = candidate === code ? id : current[candidate];
    if (value !== undefined && value.length > 0) next[candidate] = value;
  });
  return { ...rc, linkedWorkbooks: next };
}

function RcEsLane(): JSX.Element | null {
  const { rc, editable, mutateRc, linked } = useRcWorkbook();
  const es = linked.es;
  if (es === undefined) return null;
  const esId = es.workbookId;
  const categories = rc.releaseCategoryToConsequence.releaseCategoryInputs;
  const families = es.analysis.eventSequenceFamilies;
  const assignments = rcFamilyAssignments(rc, linked);
  const lost = rcLostFamilyOverrides(rc, linked);
  const assignmentOf = (familyId: string) => assignments.find((entry) => entry.familyId === familyId);
  const reference = (entityId: string) => ({ referenceType: "EVENT_SEQUENCE_FAMILY" as const, workbookId: esId, entityId });

  function assign(familyId: string, categoryId: string): void {
    mutateRc((draft) => withCategories(draft, draft.releaseCategoryToConsequence.releaseCategoryInputs.map((category) => {
      const kept = (category.eventSequenceFamilyReferences ?? []).filter((entry) => !rcFamilyReferenceMatches(entry, esId, familyId));
      return { ...category, eventSequenceFamilyReferences: category.releaseCategory === categoryId ? [...kept, reference(familyId)] : kept };
    })));
  }
  function setBounding(category: ReleaseCategoryInputs, patch: Partial<NonNullable<ReleaseCategoryInputs["boundingMember"]>>): void {
    mutateRc((draft) => withCategories(draft, draft.releaseCategoryToConsequence.releaseCategoryInputs.map((entry) => entry.releaseCategory !== category.releaseCategory ? entry
      : { ...entry, boundingMember: { sequenceId: entry.boundingMember?.sequenceId ?? "", basis: entry.boundingMember?.basis ?? "", ...patch } })));
  }

  return (
    <>
      <div className="rc-link-head">
        <h4 className="rcscope__title">Family map</h4>
      </div>
      {families.length === 0 && lost.length === 0 ? <p className="posmuted rc-link-note">The linked workbook has no event sequence families.</p> : (
        <div className="rc-link-table">
          <table className="postable postable--mid rc-family-table" aria-label="Family map">
            <thead><tr><th>Event sequence family</th><th>Release category</th><th>Reason</th></tr></thead>
            <tbody>
              {families.map((family) => {
                const assignment = assignmentOf(family.uuid);
                const fromEs = assignment?.linkedCategory ?? "";
                return (
                  <tr key={family.uuid}>
                    <td><div className="postable__name">{family.uuid}</div><span className="postable__name-sub">{family.name}</span></td>
                    <td><select className="posfield__select" aria-label={`Release category for ${family.uuid}`} value={assignment?.category ?? ""} disabled={!editable || categories.length === 0} onChange={(event) => assign(family.uuid, event.target.value)}>
                      <option value="">{fromEs === "" ? "No release · ES" : "No release"}</option>
                      {categories.map((category) => <option key={category.releaseCategory} value={category.releaseCategory}>{category.releaseCategory === fromEs ? `${category.releaseCategory} · ES` : category.releaseCategory}</option>)}
                    </select></td>
                    <td>{assignment?.typed === true && <WorkbookInput className="posfield__input" aria-label={`Reason for ${family.uuid}`} value={assignment.reason ?? ""} disabled={!editable} onChange={(event) => mutateRc((draft) => rcWithFamilyReason(draft, family.uuid, event.target.value))} />}</td>
                  </tr>
                );
              })}
              {lost.map((entry) => (
                <tr key={entry.familyId}>
                  <td><div className="postable__name">{entry.familyId}</div><span className="postable__name-sub">Linked row not found</span></td>
                  <td>{entry.releaseCategory ?? "No release"}</td>
                  <td>{editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateRc((draft) => rcWithFamilyOverrideRemoved(draft, entry.familyId))}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {categories.length > 0 && <>
        <h4 className="rcscope__title">Bounding members</h4>
        <div className="rc-link-table">
          <table className="postable postable--mid rc-bounding-table" aria-label="Bounding members">
            <thead><tr><th>Release category</th><th>Bounding sequence</th><th>Screening basis</th></tr></thead>
            <tbody>{categories.map((category) => {
              const mapped = families.filter((family) => assignmentOf(family.uuid)?.category === category.releaseCategory);
              const sequenceId = category.boundingMember?.sequenceId ?? "";
              const listed = mapped.some((family) => family.memberSequenceIds.includes(sequenceId));
              return (
                <tr key={category.releaseCategory}>
                  <td><div className="postable__name">{category.releaseCategory}</div></td>
                  <td><select className="posfield__select" aria-label={`Bounding sequence for ${category.releaseCategory}`} value={sequenceId} disabled={!editable || mapped.length === 0} onChange={(event) => setBounding(category, { sequenceId: event.target.value })}>
                    <option value="">{mapped.length ? "Choose a sequence" : "Assign families first"}</option>
                    {sequenceId && !listed && <option value={sequenceId}>{sequenceId}</option>}
                    {mapped.map((family) => <optgroup key={family.uuid} label={family.uuid}>{family.memberSequenceIds.map((id) => <option key={id} value={id}>{id}</option>)}</optgroup>)}
                  </select></td>
                  <td><WorkbookInput className="posfield__input" aria-label={`Screening basis for ${category.releaseCategory}`} value={category.boundingMember?.basis ?? ""} disabled={!editable} onChange={(event) => setBounding(category, { basis: event.target.value })} /></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </>}
    </>
  );
}

function RcRiLane({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element | null {
  const { rc, editable, mutateRc, links, linked } = useRcWorkbook();
  const measures = linked.ri === undefined ? undefined : links.riMeasures;
  if (!measures) return null;
  const metrics = rc.scope.metrics ?? [];

  function rename(metricId: string, name: string): void {
    mutateRc((draft) => ({ ...draft, scope: { ...draft.scope, metrics: (draft.scope.metrics ?? []).map((metric) => metric.id === metricId ? { ...metric, name } : metric) } }));
  }
  function addMetric(name: string): void {
    const id = nextRcMetricId(metrics);
    mutateRc((draft) => ({ ...draft, scope: { ...draft.scope, metrics: [...(draft.scope.metrics ?? []), { id, ...blankRcMetric, name }] } }));
    openDrawer({ kind: "metric", id });
  }

  if (measures.length === 0) return <p className="posmuted rc-link-note">The linked workbook defines no consequence measures.</p>;
  return (
    <div className="rc-link-table">
      <table className="postable postable--mid" aria-label="Risk Integration measures">
        <thead><tr><th>RI consequence measure</th><th>Metric that supplies it</th></tr></thead>
        <tbody>{measures.map((measure) => {
          const match = metrics.find((metric) => rcMetricMatchesMeasure(metric.name, measure));
          return (
            <tr key={measure}>
              <td><div className="postable__name">{measure}</div></td>
              <td>{match || !editable ? (
                <select className="posfield__select" aria-label={`Metric for ${measure}`} value={match?.id ?? ""} disabled={!editable} onChange={(event) => { if (event.target.value) rename(event.target.value, measure); }}>
                  {!match && <option value="">No metric</option>}
                  {metrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.id} · {metric.name.trim() || "Unnamed metric"}</option>)}
                </select>
              ) : (
                <div className="rc-link-actions">
                  <select className="posfield__select" aria-label={`Metric for ${measure}`} value="" disabled={metrics.length === 0} onChange={(event) => { if (event.target.value) rename(event.target.value, measure); }}>
                    <option value="">No metric</option>
                    {metrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.id} · {metric.name.trim() || "Unnamed metric"}</option>)}
                  </select>
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => addMetric(measure)}>Add metric</button>
                </div>
              )}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function RcInterfaces({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
  const { rc, editable, mutateRc, links, setSourceTermDraft } = useRcWorkbook();
  const [selected, setSelected] = useState<RcLinkCode | null>("ES");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<RcLinkCode | null>(null);
  const [pending, setPending] = useState<PendingLink | null>(null);
  const latestMutate = useRef(mutateRc);
  const selectId = useId();
  const options = selected === null ? [] : links.options[selected];
  const linkedId = selected === null ? undefined : rc.linkedWorkbooks?.[selected];
  const linkedOption = options.find((workbook) => workbook.id === linkedId);
  const exampleLabel = linkedId === undefined ? undefined : rcExampleLinkLabel(linkedId);
  const nothingToLink = options.length === 0 && linkedId === undefined;
  const unavailable = selected !== null && (failed === selected || (links.unavailable ?? []).includes(selected));

  useEffect(() => {
    latestMutate.current = mutateRc;
  }, [mutateRc]);

  function applyLink(code: RcLinkCode, id: string, replace: RcMutation): void {
    latestMutate.current((draft) => withLinkedWorkbook(replace(draft), code, id));
  }

  function onLink(code: RcLinkCode, id: string): void {
    if (!editable) return;
    setFailed(null);
    setPending(null);
    if (id.length === 0) {
      applyLink(code, id, (draft) => draft);
      return;
    }
    setBusy(true);
    loadRcLinkReplacement(code, id, rc)
      .then((replacement) => {
        if (replacement.replaced === undefined) applyLink(code, id, replacement.replace);
        else setPending({ code, workbookId: id, replaced: replacement.replaced, replace: replacement.replace });
      })
      .catch(() => setFailed(code))
      .finally(() => setBusy(false));
  }

  function confirmPending(): void {
    if (pending === null) return;
    setPending(null);
    if (pending.code === "MS") rc.releaseCategoryToConsequence.releaseCategoryInputs.forEach((category) => setSourceTermDraft(category.releaseCategory, undefined));
    applyLink(pending.code, pending.workbookId, pending.replace);
  }

  return (
    <>
      <div className="poshandoff__grid rc-handoff__interface-tiles">
        {RC_LINK_CODES.map((code) => (
          <button key={code} type="button" aria-pressed={selected === code}
            className={`poshandoff__tile${selected === code ? " poshandoff__tile--active" : ""}`}
            onClick={() => { setSelected(selected === code ? null : code); setPending(null); setFailed(null); }}>
            <span className="poshandoff__tile-code">{code}</span>
            <span className="poshandoff__tile-name">{HANDOFF_ELEMENT_NAMES[code]}</span>
          </button>
        ))}
      </div>
      {selected !== null && (
        <div className="rc-link-lane">
          <div className="rc-link-select">
            <label className="posfield__label" htmlFor={selectId}>Source workbook</label>
            <select id={selectId} className="posfield__select" value={pending !== null && pending.code === selected ? pending.workbookId : linkedId ?? ""} disabled={!editable || nothingToLink || busy} onChange={(event) => onLink(selected, event.target.value)}>
              <option value="">{nothingToLink ? `No ${selected} workbooks in this project` : "Not linked"}</option>
              {exampleLabel !== undefined && linkedId !== undefined && <option value={linkedId}>{exampleLabel}</option>}
              {options.map((workbook) => <option key={workbook.id} value={workbook.id}>{workbook.name}</option>)}
              {linkedId !== undefined && linkedOption === undefined && exampleLabel === undefined && <option value={linkedId}>{`${selected} workbook not in this project`}</option>}
            </select>
          </div>
          {pending !== null && pending.code === selected && (
            <div className="rc-link-confirm" role="group" aria-label="Confirm the link">
              <span>Linking replaces {pending.replaced}.</span>
              <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={busy} onClick={confirmPending}>Link {options.find((workbook) => workbook.id === pending.workbookId)?.name ?? selected}</button>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setPending(null)}>Cancel</button>
            </div>
          )}
          {unavailable && <p className="rc-link-error" role="alert">Linked workbook unavailable</p>}
          <HandoffImports consumer="RC" producer={selected} />
          {selected === "ES" && <RcEsLane />}
          {selected === "MS" && <RcMsSourceTerm openDrawer={openDrawer} />}
          {selected === "RI" && <RcRiLane openDrawer={openDrawer} />}
        </div>
      )}
    </>
  );
}

export { RcInterfaces };
