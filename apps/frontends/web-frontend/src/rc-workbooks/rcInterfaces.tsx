import { JSX, useId, useState } from "react";
import type { RadiologicalConsequenceAnalysis, RcLinkedWorkbooks, ReleaseCategoryInputs } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { rcFamilyReferenceMatches } from "interfaces-shared-types/rc-workbooks/step-checks";
import { rcMsBoundingMember } from "interfaces-shared-types/rc-workbooks/ms-source-term";
import { blankRcMetric, nextRcMetricId, rcMetricMatchesMeasure } from "interfaces-shared-types/rc-workbooks/metrics";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { useRcWorkbook } from "./rcWorkbookContext";
import { RcMsSourceTerm } from "./rcMsSourceTerm";
import { RC_LINK_CODES, type RcLinkCode } from "./rcLinks";
import type { RcDrawerContext } from "./rcScreens";

const RC_LINK_TILES: Record<RcLinkCode, { name: string; handoff: string }> = {
  ES: { name: "Event Sequence Analysis", handoff: "Provides · Release categories and families" },
  MS: { name: "Mechanistic Source Term", handoff: "Provides · Source terms" },
  RI: { name: "Risk Integration", handoff: "Provides measures · Receives results" },
};

const WORKBOOK_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  "in-progress": "In progress",
  complete: "Complete",
};

const emptyCharacteristics: ReleaseCategoryInputs["releaseCharacteristics"] = { importantRadionuclides: [], radionuclideGroupFractions: [], releasePhaseTimings: [] };

function withCategories(rc: RadiologicalConsequenceAnalysis, releaseCategoryInputs: ReleaseCategoryInputs[]): RadiologicalConsequenceAnalysis {
  return { ...rc, releaseCategoryToConsequence: { ...rc.releaseCategoryToConsequence, releaseCategoryInputs } };
}

function RcEsLane(): JSX.Element | null {
  const { rc, editable, mutateRc, links } = useRcWorkbook();
  const linkedEs = rc.linkedWorkbooks?.ES, es = links.es;
  if (!linkedEs || !es) return null;
  const esId: string = linkedEs;
  const categories = rc.releaseCategoryToConsequence.releaseCategoryInputs;
  const families = es.eventSequenceFamilies;
  const holder = (familyId: string) => categories.find((category) => (category.eventSequenceFamilyReferences ?? []).some((reference) => rcFamilyReferenceMatches(reference, esId, familyId)))?.releaseCategory ?? "";
  const reference = (entityId: string) => ({ referenceType: "EVENT_SEQUENCE_FAMILY" as const, workbookId: esId, entityId });
  const missing = [...new Set((es.releaseCategoryMappings ?? []).map((mapping) => mapping.releaseCategoryId))].filter((id) => !categories.some((category) => category.releaseCategory === id));
  const unassigned = families.filter((family) => (family.releaseCategoryIds ?? []).some((id) => categories.some((category) => category.releaseCategory === id) || missing.includes(id)) && !holder(family.uuid));

  function assign(familyId: string, categoryId: string): void {
    mutateRc((draft) => withCategories(draft, draft.releaseCategoryToConsequence.releaseCategoryInputs.map((category) => {
      const kept = (category.eventSequenceFamilyReferences ?? []).filter((entry) => !rcFamilyReferenceMatches(entry, esId, familyId));
      return { ...category, eventSequenceFamilyReferences: category.releaseCategory === categoryId ? [...kept, reference(familyId)] : kept };
    })));
  }
  function addFromEs(): void {
    mutateRc((draft) => {
      const current = draft.releaseCategoryToConsequence.releaseCategoryInputs;
      const added = missing.map((releaseCategory): ReleaseCategoryInputs => {
        const bounding = links.ms ? rcMsBoundingMember(links.ms, releaseCategory) : undefined;
        return { releaseCategory, ...(bounding ? { boundingMember: bounding } : {}), releaseCharacteristics: emptyCharacteristics };
      });
      return withCategories(draft, [...current, ...added].map((category) => {
        const joining = unassigned.filter((family) => family.releaseCategoryIds?.find((id) => current.some((entry) => entry.releaseCategory === id) || missing.includes(id)) === category.releaseCategory);
        return joining.length ? { ...category, eventSequenceFamilyReferences: [...(category.eventSequenceFamilyReferences ?? []), ...joining.map((family) => reference(family.uuid))] } : category;
      }));
    });
  }
  function setBounding(category: ReleaseCategoryInputs, patch: Partial<NonNullable<ReleaseCategoryInputs["boundingMember"]>>): void {
    mutateRc((draft) => withCategories(draft, draft.releaseCategoryToConsequence.releaseCategoryInputs.map((entry) => entry.releaseCategory !== category.releaseCategory ? entry
      : { ...entry, boundingMember: { sequenceId: entry.boundingMember?.sequenceId ?? "", basis: entry.boundingMember?.basis ?? "", ...patch } })));
  }

  return (
    <>
      <div className="rc-link-head">
        <h4 className="rcscope__title">Family map</h4>
        {editable && (missing.length > 0 || unassigned.length > 0) && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addFromEs}>Add {missing.length ? "categories and families" : "families"} from ES</button>}
      </div>
      {families.length === 0 ? <p className="posmuted rc-link-note">The linked workbook has no event sequence families.</p> : (
        <div className="rc-link-table">
          <table className="postable postable--mid" aria-label="Family map">
            <thead><tr><th>Event sequence family</th><th>Release category</th></tr></thead>
            <tbody>{families.map((family) => (
              <tr key={family.uuid}>
                <td><div className="postable__name">{family.uuid}</div><span className="postable__name-sub">{family.name}</span></td>
                <td><select className="posfield__select" aria-label={`Release category for ${family.uuid}`} value={holder(family.uuid)} disabled={!editable || categories.length === 0} onChange={(event) => assign(family.uuid, event.target.value)}>
                  <option value="">No release</option>
                  {categories.map((category) => <option key={category.releaseCategory} value={category.releaseCategory}>{category.releaseCategory}</option>)}
                </select></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {categories.length > 0 && <>
        <h4 className="rcscope__title">Bounding members</h4>
        <div className="rc-link-table">
          <table className="postable postable--mid rc-bounding-table" aria-label="Bounding members">
            <thead><tr><th>Release category</th><th>Bounding sequence</th><th>Screening basis</th></tr></thead>
            <tbody>{categories.map((category) => {
              const mapped = families.filter((family) => holder(family.uuid) === category.releaseCategory);
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
  const { rc, editable, mutateRc, links } = useRcWorkbook();
  const measures = rc.linkedWorkbooks?.RI ? links.riMeasures : undefined;
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
  const { rc, editable, mutateRc, links } = useRcWorkbook();
  const [selected, setSelected] = useState<RcLinkCode | null>("ES");
  const selectId = useId();
  const options = selected === null ? [] : links.options[selected];
  const linkedId = selected === null ? undefined : rc.linkedWorkbooks?.[selected];
  const linked = options.find((workbook) => workbook.id === linkedId);

  function onLink(code: RcLinkCode, id: string): void {
    if (!editable) return;
    mutateRc((draft) => {
      const current: RcLinkedWorkbooks = draft.linkedWorkbooks ?? {};
      const next: RcLinkedWorkbooks = {};
      RC_LINK_CODES.forEach((candidate) => {
        const value = candidate === code ? id : current[candidate];
        if (value !== undefined && value.length > 0) next[candidate] = value;
      });
      return { ...draft, linkedWorkbooks: next };
    });
  }

  return (
    <>
      <div className="poshandoff__grid rc-handoff__interface-tiles">
        {RC_LINK_CODES.map((code) => (
          <button key={code} type="button" aria-pressed={selected === code}
            className={`poshandoff__tile${selected === code ? " poshandoff__tile--active" : ""}`}
            onClick={() => setSelected(selected === code ? null : code)}>
            <span className="poshandoff__tile-code">{code}</span>
            <span className="poshandoff__tile-name">{RC_LINK_TILES[code].name}</span>
            <span className="poshandoff__tile-role">{RC_LINK_TILES[code].handoff}</span>
          </button>
        ))}
      </div>
      {selected !== null && (
        <div className="rc-link-lane">
          <div className="rc-link-select">
            <label className="posfield__label" htmlFor={selectId}>Source workbook</label>
            <select id={selectId} className="posfield__select" value={linkedId ?? ""} disabled={!editable || options.length === 0} onChange={(event) => onLink(selected, event.target.value)}>
              <option value="">{options.length === 0 ? `No ${selected} workbooks in this project` : "Not linked"}</option>
              {options.map((workbook) => <option key={workbook.id} value={workbook.id}>{workbook.name}</option>)}
            </select>
          </div>
          {linkedId !== undefined && linked === undefined && <p className="posmuted rc-link-note">The linked workbook is not in this project.</p>}
          {linked !== undefined && (
            <div className="rc-link-table">
              <table className="postable postable--mid" aria-label={`Linked ${selected} workbook`}>
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
            </div>
          )}
          {selected === "ES" && <RcEsLane />}
          {selected === "MS" && <RcMsSourceTerm openDrawer={openDrawer} />}
          {selected === "RI" && <RcRiLane openDrawer={openDrawer} />}
        </div>
      )}
    </>
  );
}

export { RcInterfaces };
