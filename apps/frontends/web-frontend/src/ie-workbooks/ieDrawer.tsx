import { JSX, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import {
  InitiatingEventCategory,
  type InitiatorDefinition,
  type InitiatingEventGroup,
  type HazardAnalysis,
} from "interfaces-mef-types/ie/initiating-event-analysis";
import { ScreeningStatus } from "interfaces-mef-types/core/shared-patterns";
import { IEIcon } from "./ieIcons";
import { INITIATOR_CATEGORIES, categoryById } from "./ieViewData";
import { useIeWorkbook, type IeDrawerContext, type IeMutator } from "./ieWorkbookContext";

function AutoTextarea({ value, onChange, placeholder, style }: { value: string; onChange: (v: string) => void; placeholder?: string; style?: CSSProperties }): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    const grow = (): void => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    grow();
    const frame = requestAnimationFrame(grow);
    let active = true;
    void document.fonts.ready.then(() => {
      if (active) grow();
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="posfield__textarea"
      style={{ overflow: "hidden", resize: "none", ...style }}
      rows={2}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const INITIATOR_SCREENING_OPTIONS: { value: ScreeningStatus; label: string }[] = [
  { value: ScreeningStatus.RETAINED, label: "Retained" },
  { value: ScreeningStatus.SCREENED_OUT, label: "Screened out" },
  { value: ScreeningStatus.MERGED, label: "Grouped" },
];

function InitiatorEditor({ initiator, states, editable, mutateIe, onClose }: {
  initiator: InitiatorDefinition;
  states: string[];
  editable: boolean;
  mutateIe: (mutator: IeMutator) => void;
  onClose: () => void;
}): JSX.Element {
  const patch = (p: Partial<InitiatorDefinition>): void => {
    mutateIe((d) => ({ ...d, initiators: d.initiators.map((i) => (i.uuid === initiator.uuid ? { ...i, ...p } : i)) }));
  };
  const toggleState = (s: string): void => {
    const has = initiator.applicableStates.includes(s);
    patch({ applicableStates: has ? initiator.applicableStates.filter((x) => x !== s) : [...initiator.applicableStates, s] });
  };
  const del = (): void => {
    mutateIe((d) => ({ ...d, initiators: d.initiators.filter((i) => i.uuid !== initiator.uuid) }));
    onClose();
  };
  const cat = categoryById(initiator.category);
  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Initiating event</div>
          <h2 className="posdrawer__title">{initiator.name.length > 0 ? initiator.name : "Untitled initiator"}</h2>
          <div className="posdrawer__sub">{initiator.uuid} · {cat?.label ?? initiator.category}</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><IEIcon.Close /></button>
      </div>
      <fieldset disabled={!editable} className="posdrawer__body" style={{ border: 0, margin: 0, minInlineSize: 0 }}>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Initiator details</h3></div>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label">Name</label>
              <input className="posfield__input" value={initiator.name} placeholder="e.g. Loss of main helium circulator" onChange={(e) => patch({ name: e.target.value })} />
            </div>
            <div className="posfield">
              <label className="posfield__label">Challenge category</label>
              <select className="posfield__input" value={initiator.category} onChange={(e) => patch({ category: e.target.value as InitiatingEventCategory })}>
                {INITIATOR_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="posfield">
              <label className="posfield__label">Disposition</label>
              <select className="posfield__input" value={initiator.screeningStatus} onChange={(e) => patch({ screeningStatus: e.target.value as ScreeningStatus })}>
                {INITIATOR_SCREENING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label">Subcategory</label>
              <input className="posfield__input" value={initiator.subcategory ?? ""} placeholder="Optional finer classification." onChange={(e) => patch({ subcategory: e.target.value })} />
            </div>
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label">Challenged safety functions (comma-separated)</label>
              <input className="posfield__input" value={initiator.challengedSafetyFunctions.join(", ")} placeholder="e.g. Remove core heat, Control reactivity" onChange={(e) => patch({ challengedSafetyFunctions: e.target.value.split(",").map((s) => s.trim()).filter((s) => s.length > 0) })} />
            </div>
          </div>
        </div>

        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Applicable operating states</h3></div>
          {states.length === 0 ? (
            <p className="posmuted" style={{ margin: 0 }}>No operating states defined yet.</p>
          ) : (
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>
              {states.map((s) => {
                const on = initiator.applicableStates.includes(s);
                return (
                  <button type="button" key={s} className={`poschip${on ? " poschip--primary" : ""}`} onClick={() => toggleState(s)}>
                    {on ? <IEIcon.Check /> : <IEIcon.Plus />} {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {editable && (
          <div className="poscard">
            <div className="poscard__head"><h3 className="poscard__title">Remove initiator</h3></div>
            <p className="posfield__hint" style={{ marginTop: 0 }}>This deletes the initiating event from the analysis.</p>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={del}><IEIcon.Close /> Delete initiator</button>
          </div>
        )}
      </fieldset>
    </>
  );
}

function GroupEditor({ group, initiators, editable, mutateIe, onClose }: {
  group: InitiatingEventGroup;
  initiators: InitiatorDefinition[];
  editable: boolean;
  mutateIe: (mutator: IeMutator) => void;
  onClose: () => void;
}): JSX.Element {
  const patch = (p: Partial<InitiatingEventGroup>): void => {
    mutateIe((d) => ({ ...d, initiatingEventGroups: d.initiatingEventGroups.map((g) => (g.uuid === group.uuid ? { ...g, ...p } : g)) }));
  };
  const toggleMember = (initId: string): void => {
    mutateIe((d) => ({ ...d, initiatingEventGroups: d.initiatingEventGroups.map((g) => {
      if (g.uuid !== group.uuid) return g;
      if (g.memberInitiatorIds.includes(initId)) {
        const members = g.memberInitiatorIds.filter((m) => m !== initId);
        return { ...g, memberInitiatorIds: members, boundingInitiatorId: g.boundingInitiatorId === initId ? (members[0] ?? "") : g.boundingInitiatorId };
      }
      const members = [...g.memberInitiatorIds, initId];
      return { ...g, memberInitiatorIds: members, boundingInitiatorId: g.boundingInitiatorId === "" ? initId : g.boundingInitiatorId };
    }) }));
  };
  const del = (): void => {
    mutateIe((d) => ({ ...d, initiatingEventGroups: d.initiatingEventGroups.filter((g) => g.uuid !== group.uuid) }));
    onClose();
  };

  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Initiating-event group</div>
          <h2 className="posdrawer__title">{group.name.length > 0 ? group.name : "Untitled group"}</h2>
          <div className="posdrawer__sub">{group.uuid} · {group.memberInitiatorIds.length} member{group.memberInitiatorIds.length === 1 ? "" : "s"}</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><IEIcon.Close /></button>
      </div>
      <fieldset disabled={!editable} className="posdrawer__body" style={{ border: 0, margin: 0, minInlineSize: 0 }}>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Group details</h3></div>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label">Name</label>
              <input className="posfield__input" value={group.name} placeholder="e.g. Pressurized loss of forced cooling" onChange={(e) => patch({ name: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Member initiators</h3></div>
          {initiators.length === 0 ? (
            <p className="posmuted" style={{ margin: 0 }}>No initiators to group yet. Add them in Step 3.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {initiators.map((i) => (
                <label key={i.uuid} className="posrow" style={{ gap: 8, alignItems: "flex-start", cursor: editable ? "pointer" : "default" }}>
                  <input type="checkbox" checked={group.memberInitiatorIds.includes(i.uuid)} disabled={!editable} onChange={() => toggleMember(i.uuid)} style={{ marginTop: 2 }} />
                  <span className="posmono possubtle" style={{ marginTop: 1 }}>{i.uuid}</span>
                  <span style={{ fontSize: 13 }}>{i.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Bounding case</h3></div>
          <select className="posfield__input" value={group.boundingInitiatorId} onChange={(e) => patch({ boundingInitiatorId: e.target.value })}>
            <option value="">None selected</option>
            {group.memberInitiatorIds.map((m) => {
              const init = initiators.find((i) => i.uuid === m);
              return <option key={m} value={m}>{m}{init !== undefined ? ` · ${init.name}` : ""}</option>;
            })}
          </select>
        </div>

        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Grouping basis</h3></div>
          <AutoTextarea value={group.groupingBasis} placeholder="Why these events are alike enough to group, and what bounds them." onChange={(v) => patch({ groupingBasis: v })} />
        </div>

        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Similarity and challenge</h3></div>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label">Similar mitigation requirements (comma-separated)</label>
              <input className="posfield__input" value={group.similarMitigationRequirements.join(", ")} placeholder="e.g. Reactor trip, Passive RCCS cooldown" onChange={(e) => patch({ similarMitigationRequirements: e.target.value.split(",").map((s) => s.trim()).filter((s) => s.length > 0) })} />
            </div>
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label">Challenged safety functions (comma-separated)</label>
              <input className="posfield__input" value={group.challengedSafetyFunctions.join(", ")} placeholder="e.g. Remove core heat" onChange={(e) => patch({ challengedSafetyFunctions: e.target.value.split(",").map((s) => s.trim()).filter((s) => s.length > 0) })} />
            </div>
          </div>
        </div>

        <div className="poscard">
          <label className="posrow" style={{ gap: 10, cursor: editable ? "pointer" : "default" }}>
            <input type="checkbox" checked={group.comparableImpactAcrossMembers} disabled={!editable} onChange={(e) => patch({ comparableImpactAcrossMembers: e.target.checked })} />
            <span style={{ fontSize: 13 }}>Comparable impact across members</span>
          </label>
        </div>
        <div className="poscard">
          <label className="posrow" style={{ gap: 10, cursor: editable ? "pointer" : "default" }}>
            <input type="checkbox" checked={group.groupingDoesNotMaskRiskSignificantSequences} disabled={!editable} onChange={(e) => patch({ groupingDoesNotMaskRiskSignificantSequences: e.target.checked })} />
            <span style={{ fontSize: 13 }}>Grouping does not mask any risk-significant sequence</span>
          </label>
        </div>

        {editable && (
          <div className="poscard">
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={del}><IEIcon.Close /> Delete group</button>
          </div>
        )}
      </fieldset>
    </>
  );
}

const HAZARD_SCREENING_OPTIONS: { value: ScreeningStatus; label: string }[] = [
  { value: ScreeningStatus.RETAINED, label: "Retained" },
  { value: ScreeningStatus.SCREENED_OUT, label: "Screened out" },
  { value: ScreeningStatus.QUALITATIVE_ANALYSIS, label: "Qualitative" },
  { value: ScreeningStatus.FULL_ANALYSIS, label: "Full analysis" },
  { value: ScreeningStatus.MERGED, label: "Merged" },
];

function HazardEditor({ hazard, editable, mutateIe, onClose }: {
  hazard: HazardAnalysis;
  editable: boolean;
  mutateIe: (mutator: IeMutator) => void;
  onClose: () => void;
}): JSX.Element {
  const patch = (p: Partial<HazardAnalysis>): void => {
    mutateIe((d) => ({ ...d, hazardAnalyses: (d.hazardAnalyses ?? []).map((h) => (h.uuid === hazard.uuid ? { ...h, ...p } : h)) }));
  };
  const setCombo = (idx: number, text: string): void => {
    patch({ potentialCombinations: hazard.potentialCombinations.map((t, j) => (j === idx ? text : t)) });
  };
  const addCombo = (): void => { patch({ potentialCombinations: [...hazard.potentialCombinations, ""] }); };
  const delCombo = (idx: number): void => { patch({ potentialCombinations: hazard.potentialCombinations.filter((_, j) => j !== idx) }); };
  const del = (): void => {
    mutateIe((d) => ({ ...d, hazardAnalyses: (d.hazardAnalyses ?? []).filter((h) => h.uuid !== hazard.uuid) }));
    onClose();
  };
  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Hazard analysis</div>
          <h2 className="posdrawer__title">{hazard.name.length > 0 ? hazard.name : "Untitled hazard"}</h2>
          <div className="posdrawer__sub">{hazard.uuid} · {hazard.hazardType === "INTERNAL" ? "Internal" : "External"}</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><IEIcon.Close /></button>
      </div>
      <fieldset disabled={!editable} className="posdrawer__body" style={{ border: 0, margin: 0, minInlineSize: 0 }}>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Hazard details</h3></div>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label">Name</label>
              <input className="posfield__input" value={hazard.name} placeholder="e.g. Seismic" onChange={(e) => patch({ name: e.target.value })} />
            </div>
            <div className="posfield">
              <label className="posfield__label">Type</label>
              <select className="posfield__input" value={hazard.hazardType} onChange={(e) => patch({ hazardType: e.target.value === "EXTERNAL" ? "EXTERNAL" : "INTERNAL" })}>
                <option value="INTERNAL">Internal</option>
                <option value="EXTERNAL">External</option>
              </select>
            </div>
            <div className="posfield">
              <label className="posfield__label">Subcategory</label>
              <input className="posfield__input" value={hazard.subcategory} placeholder="Optional" onChange={(e) => patch({ subcategory: e.target.value })} />
            </div>
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label">Description</label>
              <AutoTextarea value={hazard.description} placeholder="Describe the hazard and how it challenges the plant." onChange={(v) => patch({ description: v })} />
            </div>
          </div>
        </div>

        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Screening</h3></div>
          <div className="posfield-grid">
            <div className="posfield">
              <label className="posfield__label">Screening status</label>
              <select className="posfield__input" value={hazard.screeningStatus} onChange={(e) => patch({ screeningStatus: e.target.value as ScreeningStatus })}>
                {HAZARD_SCREENING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label">Screening basis</label>
              <AutoTextarea value={hazard.screeningBasis} placeholder="Why this hazard screens the way it does." onChange={(v) => patch({ screeningBasis: v })} />
            </div>
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label">Induced initiators (IE ids, comma-separated)</label>
              <input className="posfield__input" value={hazard.inducedInitiatorIds.join(", ")} placeholder="IE-10, IE-23" onChange={(e) => patch({ inducedInitiatorIds: e.target.value.split(",").map((s) => s.trim()).filter((s) => s.length > 0) })} />
            </div>
          </div>
        </div>

        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Hazard combinations (IE-A6)</h3>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addCombo}><IEIcon.Plus /> Add combination</button>}
          </div>
          {hazard.potentialCombinations.length === 0 ? (
            <p className="posmuted" style={{ margin: 0 }}>No combinations recorded.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {hazard.potentialCombinations.map((text, idx) => (
                <div key={idx} className="posrow" style={{ gap: 8, alignItems: "flex-start" }}>
                  <AutoTextarea value={text} placeholder="Describe the combination considered." style={{ flex: 1 }} onChange={(v) => setCombo(idx, v)} />
                  {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => delCombo(idx)}><IEIcon.Close /></button>}
                </div>
              ))}
            </div>
          )}
        </div>

        {editable && (
          <div className="poscard">
            <div className="poscard__head"><h3 className="poscard__title">Remove hazard</h3></div>
            <p className="posfield__hint" style={{ marginTop: 0 }}>This deletes the hazard analysis from the analysis.</p>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={del}><IEIcon.Close /> Delete hazard</button>
          </div>
        )}
      </fieldset>
    </>
  );
}

function IeDrawerContent({ context, onClose }: { context: IeDrawerContext; onClose: () => void }): JSX.Element {
  const { ie, editable, mutateIe } = useIeWorkbook();
  if (context.kind === "initiator") {
    const initiator = ie.initiators.find((i) => i.uuid === context.id);
    if (initiator !== undefined) return <InitiatorEditor key={initiator.uuid} initiator={initiator} states={ie.applicablePlantOperatingStates} editable={editable} mutateIe={mutateIe} onClose={onClose} />;
  } else if (context.kind === "hazard") {
    const hazard = (ie.hazardAnalyses ?? []).find((h) => h.uuid === context.id);
    if (hazard !== undefined) return <HazardEditor key={hazard.uuid} hazard={hazard} editable={editable} mutateIe={mutateIe} onClose={onClose} />;
  } else {
    const group = ie.initiatingEventGroups.find((g) => g.uuid === context.id);
    if (group !== undefined) return <GroupEditor key={group.uuid} group={group} initiators={ie.initiators} editable={editable} mutateIe={mutateIe} onClose={onClose} />;
  }
  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Record</div>
          <h2 className="posdrawer__title">No longer available</h2>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><IEIcon.Close /></button>
      </div>
      <div className="posdrawer__body">
        <div className="poscard"><p className="posmuted" style={{ margin: 0 }}>This record was removed. Close this panel.</p></div>
      </div>
    </>
  );
}

function IeDrawer({ context, onClose }: { context: IeDrawerContext; onClose: () => void }): JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="posdrawer-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="posdrawer" role="dialog" aria-modal="true">
        <IeDrawerContent context={context} onClose={onClose} />
      </div>
    </div>
  );
}

export { IeDrawer, AutoTextarea };
