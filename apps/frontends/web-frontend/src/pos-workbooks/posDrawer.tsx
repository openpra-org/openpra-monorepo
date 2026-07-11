import { JSX, useEffect, useState } from "react";
import { POSIcon } from "./posIcons";
import { Badge } from "./posShared";
import { PreopAssumptionCard } from "./posPreopCard";
import { type DrawerContext } from "./posScreens";
import { statesView, evolutionsView, preOpsForState, preOpsForGroup, stateLabel, evolutionLabel, groupLabel, formatDuration, type StateView, type PreOpAssumptionView } from "./posSelectors";
import { usePosWorkbook } from "./posWorkbookContext";
import { type Mutator } from "./useMefPatch";
import {
  type PlantOperatingStatesAnalysis,
  type PlantEvolution,
  type PlantOperatingState,
  type PlantOperatingStateGroup,
  type ParameterRange,
  type RadioactiveSource,
  type RadionuclideTransportBarrier,
  EvolutionType,
  OperatingMode,
  SourceLocation,
  BarrierStatus,
} from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { ScreeningStatus } from "interfaces-mef-types/core/shared-patterns";

const EVOLUTION_TYPES = Object.values(EvolutionType);
const OPERATING_MODES = Object.values(OperatingMode);
const SOURCE_LOCATIONS = Object.values(SourceLocation);
const BARRIER_STATUSES = Object.values(BarrierStatus);

function patchEvolution(draft: PlantOperatingStatesAnalysis, uuid: string, patch: Partial<PlantEvolution>): PlantOperatingStatesAnalysis {
  return { ...draft, plantEvolutions: draft.plantEvolutions.map((e) => (e.uuid === uuid ? { ...e, ...patch } : e)) };
}

function EvolutionEditor({ ev, durationFraction, states, canEdit, mefPatch, mefPatchDebounced, onClose }: {
  ev: PlantEvolution;
  durationFraction: number;
  states: StateView[];
  canEdit: boolean;
  mefPatch?: (mutator: Mutator) => void;
  mefPatchDebounced?: (mutator: Mutator) => void;
  onClose: () => void;
}): JSX.Element {
  const [name, setName] = useState(ev.name);
  const [evType, setEvType] = useState<EvolutionType>(ev.type);
  const [description, setDescription] = useState(ev.description);
  const [source, setSource] = useState(ev.sourceDocumentRef ?? "");
  const [modes, setModes] = useState<string[]>(ev.operatingModes);

  function save(patch: Partial<PlantEvolution>): void {
    if (!canEdit || mefPatchDebounced === undefined) return;
    mefPatchDebounced((d) => patchEvolution(d, ev.uuid, patch));
  }
  function onName(v: string): void { setName(v); save({ name: v }); }
  function onType(v: EvolutionType): void { setEvType(v); save({ type: v }); }
  function onDescription(v: string): void { setDescription(v); save({ description: v }); }
  function onSource(v: string): void { setSource(v); save({ sourceDocumentRef: v }); }
  function onToggleMode(m: string): void {
    const next = modes.includes(m) ? modes.filter((x) => x !== m) : [...modes, m];
    setModes(next);
    save({ operatingModes: next });
  }
  function onDelete(): void {
    if (mefPatch === undefined) return;
    mefPatch((d) => removeEvolution(d, ev.uuid));
    onClose();
  }

  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Plant evolution</div>
          <h2 className="posdrawer__title">{name.length > 0 ? name : "Untitled evolution"}</h2>
          <div className="posdrawer__sub">{evType.split("_").join(" ").toLowerCase()} · {(durationFraction * 100).toFixed(1)} % of state hours</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><POSIcon.Close /></button>
      </div>
      <fieldset disabled={!canEdit} className="posdrawer__body" style={{ border: 0, margin: 0, minInlineSize: 0 }}>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Evolution details</h3></div>
          <div className="posfield-grid">
            <div className="posfield">
              <label className="posfield__label">Name</label>
              <input className="posfield__input" value={name} placeholder="e.g. Refuelling outage" onChange={(ev2) => onName(ev2.target.value)} />
            </div>
            <div className="posfield">
              <label className="posfield__label">Type</label>
              <select className="posfield__input" value={evType} onChange={(ev2) => onType(ev2.target.value as EvolutionType)}>
                {EVOLUTION_TYPES.map((t) => <option key={t} value={t}>{t.split("_").join(" ").toLowerCase()}</option>)}
              </select>
            </div>
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label">Description</label>
              <textarea className="posfield__textarea" value={description} placeholder="State what happens during this evolution." onChange={(ev2) => onDescription(ev2.target.value)} />
            </div>
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label">Source document</label>
              <input className="posfield__input" value={source} placeholder="Cite the design or procedure document." onChange={(ev2) => onSource(ev2.target.value)} />
            </div>
          </div>
        </div>

        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Operating modes</h3></div>
          <p className="posfield__hint" style={{ marginTop: 0 }}>Pick the plant modes this evolution passes through.</p>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>
            {OPERATING_MODES.map((m) => {
              const on = modes.includes(m);
              return (
                <button type="button" key={m} className={`poschip${on ? " poschip--primary" : ""}`} onClick={() => onToggleMode(m)}>
                  {on ? <POSIcon.Check /> : <POSIcon.Plus />} {m.toLowerCase()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Operating states within this evolution</h3>
            <Badge kind="ok">{states.length} states</Badge>
          </div>
          {states.length === 0 ? (
            <p className="posmuted" style={{ margin: 0 }}>No operating states point to this evolution yet.</p>
          ) : (
          <table className="postable postable--mid">
            <thead><tr><th>State</th><th>Mode</th><th>Duration</th><th>Status</th></tr></thead>
            <tbody>
              {states.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="postable__name">{stateLabel(s.name)}</div>
                    <span className="postable__name-sub">{s.description}</span>
                  </td>
                  <td className="mono">{s.mode}</td>
                  <td className="mono">{s.duration}</td>
                  <td>
                    {s.status === "ok" && <Badge kind="ok">Ready</Badge>}
                    {s.status === "warn" && <Badge kind="warn">Attention</Badge>}
                    {s.status === "draft" && <Badge kind="draft">Draft</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>

        {canEdit && (
          <div className="poscard">
            <div className="poscard__head"><h3 className="poscard__title">Remove evolution</h3></div>
            <p className="posfield__hint" style={{ marginTop: 0 }}>This deletes the evolution from the analysis. Any state that points to it will need a new parent.</p>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={onDelete}><POSIcon.Close /> Delete evolution</button>
          </div>
        )}
      </fieldset>
    </>
  );
}

function removeEvolution(draft: PlantOperatingStatesAnalysis, uuid: string): PlantOperatingStatesAnalysis {
  return { ...draft, plantEvolutions: draft.plantEvolutions.filter((e) => e.uuid !== uuid) };
}

function putState(draft: PlantOperatingStatesAnalysis, next: PlantOperatingState): PlantOperatingStatesAnalysis {
  return { ...draft, plantOperatingStates: draft.plantOperatingStates.map((s) => (s.uuid === next.uuid ? next : s)) };
}

function removeState(draft: PlantOperatingStatesAnalysis, uuid: string): PlantOperatingStatesAnalysis {
  const durationById = new Map(draft.plantOperatingStates.map((s) => [s.uuid, s.meanDurationHours]));
  return {
    ...draft,
    plantOperatingStates: draft.plantOperatingStates.filter((s) => s.uuid !== uuid),
    plantOperatingStateGroups: (draft.plantOperatingStateGroups ?? []).map((g) => {
      if (!g.memberPosIds.includes(uuid)) return g;
      const memberPosIds = g.memberPosIds.filter((id) => id !== uuid);
      const summedDurationHours = memberPosIds.reduce((acc, id) => acc + (durationById.get(id) ?? 0), 0);
      return { ...g, memberPosIds, summedDurationHours };
    }),
  };
}

function blankSource(): RadioactiveSource {
  return {
    uuid: crypto.randomUUID(),
    name: "",
    location: SourceLocation.IN_CORE,
    description: "",
    radionuclides: [],
    status: "",
    releasePaths: [],
    barriers: [],
    screeningStatus: ScreeningStatus.RETAINED,
  };
}

function blankBarrier(): RadionuclideTransportBarrier {
  return {
    uuid: crypto.randomUUID(),
    name: "",
    status: BarrierStatus.INTACT,
    monitoringParameters: [],
    breachCriteria: [],
  };
}

function NumberField({ value, onCommit }: { value: number; onCommit: (n: number) => void }): JSX.Element {
  const [text, setText] = useState(String(value));
  return (
    <input
      className="posfield__input"
      value={text}
      style={{ width: "100%" }}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim().length > 0 && !Number.isNaN(n)) onCommit(n);
      }}
    />
  );
}

function RangeRow({ label, value, onChange }: { label: string; value: ParameterRange; onChange: (next: ParameterRange) => void }): JSX.Element {
  const cap = { fontSize: 11, marginTop: 3 };
  return (
    <div className="posfield posfield-grid--span2">
      <label className="posfield__label">{label}</label>
      <div className="posrow" style={{ gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <NumberField value={value.min} onCommit={(n) => onChange({ ...value, min: n })} />
          <div className="possubtle" style={cap}>Min</div>
        </div>
        <div style={{ flex: 1 }}>
          <NumberField value={value.max} onCommit={(n) => onChange({ ...value, max: n })} />
          <div className="possubtle" style={cap}>Max</div>
        </div>
        <div style={{ flex: 1 }}>
          <NumberField value={value.representative} onCommit={(n) => onChange({ ...value, representative: n })} />
          <div className="possubtle" style={cap}>Typical</div>
        </div>
        <div style={{ width: 90 }}>
          <input className="posfield__input" value={value.units ?? ""} style={{ width: "100%" }} onChange={(e) => onChange({ ...value, units: e.target.value })} />
          <div className="possubtle" style={cap}>Units</div>
        </div>
      </div>
    </div>
  );
}

function StateEditor({ state, evolutions, preop, canEdit, mefPatch, mefPatchDebounced, onClose }: {
  state: PlantOperatingState;
  evolutions: { uuid: string; name: string }[];
  preop?: PreOpAssumptionView;
  canEdit: boolean;
  mefPatch?: (mutator: Mutator) => void;
  mefPatchDebounced?: (mutator: Mutator) => void;
  onClose: () => void;
}): JSX.Element {
  const [draft, setDraft] = useState<PlantOperatingState>(state);

  function update(next: PlantOperatingState): void {
    setDraft(next);
    if (!canEdit || mefPatchDebounced === undefined) return;
    mefPatchDebounced((d) => putState(d, next));
  }
  function onSourceChange(uuid: string, patch: Partial<RadioactiveSource>): void {
    update({ ...draft, radioactiveMaterialSources: draft.radioactiveMaterialSources.map((s) => (s.uuid === uuid ? { ...s, ...patch } : s)) });
  }
  function onBarrierChange(uuid: string, patch: Partial<RadionuclideTransportBarrier>): void {
    update({ ...draft, radionuclideTransportBarriers: draft.radionuclideTransportBarriers.map((b) => (b.uuid === uuid ? { ...b, ...patch } : b)) });
  }
  function onDelete(): void {
    if (mefPatch === undefined) return;
    mefPatch((d) => removeState(d, draft.uuid));
    onClose();
  }

  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Operating state</div>
          <h2 className="posdrawer__title">{draft.name.length > 0 ? draft.name : "Untitled state"}</h2>
          <div className="posdrawer__sub">{draft.operatingMode.toLowerCase()}</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><POSIcon.Close /></button>
      </div>
      <fieldset disabled={!canEdit} className="posdrawer__body" style={{ border: 0, margin: 0, minInlineSize: 0 }}>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">State details</h3></div>
          <div className="posfield-grid">
            <div className="posfield">
              <label className="posfield__label">Name</label>
              <input className="posfield__input" value={draft.name} placeholder="e.g. Hot standby" onChange={(e) => update({ ...draft, name: e.target.value })} />
            </div>
            <div className="posfield">
              <label className="posfield__label">Evolution</label>
              <select className="posfield__input" value={draft.evolutionId} onChange={(e) => update({ ...draft, evolutionId: e.target.value })}>
                <option value="">Unassigned</option>
                {evolutions.map((ev) => <option key={ev.uuid} value={ev.uuid}>{evolutionLabel(ev.name)}</option>)}
              </select>
            </div>
            <div className="posfield">
              <label className="posfield__label">Operating mode</label>
              <select className="posfield__input" value={draft.operatingMode} onChange={(e) => update({ ...draft, operatingMode: e.target.value as OperatingMode })}>
                {OPERATING_MODES.map((m) => <option key={m} value={m}>{m.toLowerCase()}</option>)}
              </select>
            </div>
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label">Description</label>
              <textarea className="posfield__textarea" value={draft.description} placeholder="Describe the plant configuration in this state." onChange={(e) => update({ ...draft, description: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Reactor coolant parameters</h3></div>
          <div className="posfield-grid">
            <RangeRow label="Coolant temperature" value={draft.rcsParameters.reactorCoolantTemperature} onChange={(v) => update({ ...draft, rcsParameters: { ...draft.rcsParameters, reactorCoolantTemperature: v } })} />
            <RangeRow label="Coolant pressure" value={draft.rcsParameters.coolantPressure} onChange={(v) => update({ ...draft, rcsParameters: { ...draft.rcsParameters, coolantPressure: v } })} />
            <RangeRow label="Power level" value={draft.rcsParameters.powerLevel} onChange={(v) => update({ ...draft, rcsParameters: { ...draft.rcsParameters, powerLevel: v } })} />
            <RangeRow label="Decay heat" value={draft.rcsParameters.decayHeatLevel} onChange={(v) => update({ ...draft, rcsParameters: { ...draft.rcsParameters, decayHeatLevel: v } })} />
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label">RCS configuration</label>
              <textarea className="posfield__textarea" value={draft.rcsParameters.rcsConfigurationDescription} placeholder="Describe the coolant-system lineup." onChange={(e) => update({ ...draft, rcsParameters: { ...draft.rcsParameters, rcsConfigurationDescription: e.target.value } })} />
            </div>
          </div>
        </div>

        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Configuration and boundary</h3></div>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2">
              <label className="posfield__label">Boundary configuration</label>
              <input className="posfield__input" value={draft.rcbConfiguration} placeholder="e.g. Reactor vessel closed. Containment intact." onChange={(e) => update({ ...draft, rcbConfiguration: e.target.value })} />
            </div>
            <div className="posfield">
              <label className="posfield__label">Starting condition</label>
              <input className="posfield__input" value={draft.timeBoundary.startingCondition} placeholder="What opens this state." onChange={(e) => update({ ...draft, timeBoundary: { ...draft.timeBoundary, startingCondition: e.target.value } })} />
            </div>
            <div className="posfield">
              <label className="posfield__label">Ending condition</label>
              <input className="posfield__input" value={draft.timeBoundary.endingCondition} placeholder="What closes this state." onChange={(e) => update({ ...draft, timeBoundary: { ...draft.timeBoundary, endingCondition: e.target.value } })} />
            </div>
          </div>
        </div>

        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Radioactive material sources</h3>
            {canEdit && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => update({ ...draft, radioactiveMaterialSources: [...draft.radioactiveMaterialSources, blankSource()] })}><POSIcon.Plus /> Add source</button>}
          </div>
          {draft.radioactiveMaterialSources.length === 0 ? (
            <p className="posmuted" style={{ margin: 0 }}>No sources yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {draft.radioactiveMaterialSources.map((src) => (
                <div key={src.uuid} className="posrow" style={{ gap: 8, alignItems: "center" }}>
                  <input className="posfield__input" value={src.name} placeholder="Source name" style={{ flex: 2 }} onChange={(e) => onSourceChange(src.uuid, { name: e.target.value })} />
                  <select className="posfield__input" value={src.location} style={{ flex: 1 }} onChange={(e) => onSourceChange(src.uuid, { location: e.target.value as SourceLocation })}>
                    {SOURCE_LOCATIONS.map((l) => <option key={l} value={l}>{l.split("_").join(" ").toLowerCase()}</option>)}
                  </select>
                  <input className="posfield__input" value={src.status} placeholder="Status" style={{ flex: 1 }} onChange={(e) => onSourceChange(src.uuid, { status: e.target.value })} />
                  {canEdit && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => update({ ...draft, radioactiveMaterialSources: draft.radioactiveMaterialSources.filter((x) => x.uuid !== src.uuid) })}><POSIcon.Close /></button>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Radionuclide transport barriers</h3>
            {canEdit && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => update({ ...draft, radionuclideTransportBarriers: [...draft.radionuclideTransportBarriers, blankBarrier()] })}><POSIcon.Plus /> Add barrier</button>}
          </div>
          {draft.radionuclideTransportBarriers.length === 0 ? (
            <p className="posmuted" style={{ margin: 0 }}>No barriers yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {draft.radionuclideTransportBarriers.map((b) => (
                <div key={b.uuid} className="posrow" style={{ gap: 8, alignItems: "center" }}>
                  <input className="posfield__input" value={b.name} placeholder="Barrier name" style={{ flex: 2 }} onChange={(e) => onBarrierChange(b.uuid, { name: e.target.value })} />
                  <select className="posfield__input" value={b.status ?? BarrierStatus.INTACT} style={{ flex: 1 }} onChange={(e) => onBarrierChange(b.uuid, { status: e.target.value as BarrierStatus })}>
                    {BARRIER_STATUSES.map((st) => <option key={st} value={st}>{st.toLowerCase()}</option>)}
                  </select>
                  {canEdit && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => update({ ...draft, radionuclideTransportBarriers: draft.radionuclideTransportBarriers.filter((x) => x.uuid !== b.uuid) })}><POSIcon.Close /></button>}
                </div>
              ))}
            </div>
          )}
        </div>

        {canEdit && (
          <div className="poscard">
            <div className="poscard__head"><h3 className="poscard__title">Remove state</h3></div>
            <p className="posfield__hint" style={{ marginTop: 0 }}>This deletes the operating state from the analysis.</p>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={onDelete}><POSIcon.Close /> Delete state</button>
          </div>
        )}

        <PreopAssumptionCard assumption={preop} />
      </fieldset>
    </>
  );
}

function putGroup(draft: PlantOperatingStatesAnalysis, next: PlantOperatingStateGroup): PlantOperatingStatesAnalysis {
  return { ...draft, plantOperatingStateGroups: (draft.plantOperatingStateGroups ?? []).map((g) => (g.uuid === next.uuid ? next : g)) };
}

function removeGroup(draft: PlantOperatingStatesAnalysis, uuid: string): PlantOperatingStatesAnalysis {
  return { ...draft, plantOperatingStateGroups: (draft.plantOperatingStateGroups ?? []).filter((g) => g.uuid !== uuid) };
}

const GROUP_EVOLUTION_TYPES = Object.values(EvolutionType);

function GroupEditor({ group, states, preop, canEdit, mefPatch, mefPatchDebounced, onClose }: {
  group: PlantOperatingStateGroup;
  states: { uuid: string; name: string; durationHours: number }[];
  preop?: PreOpAssumptionView;
  canEdit: boolean;
  mefPatch?: (mutator: Mutator) => void;
  mefPatchDebounced?: (mutator: Mutator) => void;
  onClose: () => void;
}): JSX.Element {
  const [draft, setDraft] = useState<PlantOperatingStateGroup>(group);
  const freqValue = typeof draft.entryFrequency === "number" ? draft.entryFrequency : draft.entryFrequency.value;
  const [freqText, setFreqText] = useState(String(freqValue));
  const durationById = new Map(states.map((s) => [s.uuid, s.durationHours]));
  function update(next: PlantOperatingStateGroup): void {
    setDraft(next);
    if (!canEdit || mefPatchDebounced === undefined) return;
    mefPatchDebounced((d) => putGroup(d, next));
  }
  function toggleMember(uuid: string): void {
    const memberPosIds = draft.memberPosIds.includes(uuid)
      ? draft.memberPosIds.filter((id) => id !== uuid)
      : [...draft.memberPosIds, uuid];
    const summedDurationHours = memberPosIds.reduce((acc, id) => acc + (durationById.get(id) ?? 0), 0);
    update({ ...draft, memberPosIds, summedDurationHours });
  }
  function onFreq(v: string): void {
    setFreqText(v);
    const n = Number(v);
    if (v.trim().length === 0 || Number.isNaN(n) || n < 0) return;
    const entryFrequency = typeof draft.entryFrequency === "number" ? n : { ...draft.entryFrequency, value: n };
    update({ ...draft, entryFrequency });
  }
  function onBounding(v: string): void {
    const rest = draft.boundingCharacteristics.slice(1);
    update({ ...draft, boundingCharacteristics: v.trim().length > 0 ? [v, ...rest] : rest });
  }
  function onDelete(): void {
    if (mefPatch === undefined) return;
    mefPatch((d) => removeGroup(d, draft.uuid));
    onClose();
  }
  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Operating-state group</div>
          <h2 className="posdrawer__title">{groupLabel(draft.name)}</h2>
          <div className="posdrawer__sub">{draft.memberPosIds.length} member states · total {formatDuration(draft.summedDurationHours)}</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><POSIcon.Close /></button>
      </div>
      <fieldset disabled={!canEdit} className="posdrawer__body" style={{ border: 0, margin: 0, minInlineSize: 0 }}>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Group details</h3></div>
          <div className="posfield-grid">
            <div className="posfield">
              <label className="posfield__label">Name</label>
              <input className="posfield__input" value={draft.name} placeholder="e.g. Shutdown / cooldown group" onChange={(e) => update({ ...draft, name: e.target.value })} />
            </div>
            <div className="posfield">
              <label className="posfield__label">Evolution type</label>
              <select className="posfield__input" value={draft.evolutionType} onChange={(e) => update({ ...draft, evolutionType: e.target.value as EvolutionType })}>
                {GROUP_EVOLUTION_TYPES.map((t) => <option key={t} value={t}>{t.split("_").join(" ").toLowerCase()}</option>)}
              </select>
            </div>
            <div className="posfield">
              <label className="posfield__label">Entry frequency (per year)</label>
              <input className="posfield__input" value={freqText} placeholder="per year" onChange={(e) => onFreq(e.target.value)} />
            </div>
            <div className="posfield">
              <label className="posfield__label">Summed duration (computed)</label>
              <div className="mono" style={{ padding: "8px 0" }}>{formatDuration(draft.summedDurationHours)}</div>
            </div>
          </div>
        </div>

        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Member states</h3></div>
          {states.length === 0 ? (
            <p className="posmuted" style={{ margin: 0 }}>No operating states to group yet.</p>
          ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {states.map((s) => (
              <label key={s.uuid} className="posrow" style={{ gap: 8, cursor: canEdit ? "pointer" : "default" }}>
                <input type="checkbox" checked={draft.memberPosIds.includes(s.uuid)} disabled={!canEdit} onChange={() => toggleMember(s.uuid)} />
                <span style={{ fontSize: 13 }}>{stateLabel(s.name)}</span>
                <span className="possubtle" style={{ marginLeft: "auto", fontSize: 13 }}>{formatDuration(s.durationHours)}</span>
              </label>
            ))}
          </div>
          )}
        </div>

        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Similarity rationale</h3></div>
          <textarea className="posfield__textarea" value={draft.similarityBasis} placeholder="Why these states are similar enough to group." style={{ minHeight: 110 }} onChange={(e) => update({ ...draft, similarityBasis: e.target.value })} />
        </div>

        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Bounding characteristic</h3></div>
          <input className="posfield__input" value={draft.boundingCharacteristics[0] ?? ""} placeholder="e.g. Lowest helium temperature, the bounding state" onChange={(e) => onBounding(e.target.value)} />
        </div>

        <div className="poscard">
          <label className="posrow" style={{ gap: 10, cursor: canEdit ? "pointer" : "default" }}>
            <input type="checkbox" checked={draft.doesNotMaskRiskSignificantContributors} disabled={!canEdit} onChange={(e) => update({ ...draft, doesNotMaskRiskSignificantContributors: e.target.checked })} />
            <span style={{ fontSize: 13 }}>Grouping does not mask any risk-significant contributors</span>
          </label>
        </div>

        {canEdit && (
          <div className="poscard">
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={onDelete}><POSIcon.Close /> Delete group</button>
          </div>
        )}

        <PreopAssumptionCard assumption={preop} />
      </fieldset>
    </>
  );
}

function DrawerContent({ context, onClose, canEdit, mefPatch, mefPatchDebounced }: { context: DrawerContext; onClose: () => void; canEdit: boolean; mefPatch?: (mutator: Mutator) => void; mefPatchDebounced?: (mutator: Mutator) => void }): JSX.Element | null {
  const { pos } = usePosWorkbook();
  if (context.kind === "state") {
    const rawState = pos.plantOperatingStates.find((x) => x.uuid === context.id);
    if (rawState === undefined) return null;
    const evolutions = pos.plantEvolutions.map((e) => ({ uuid: e.uuid, name: e.name }));
    return (
      <StateEditor
        key={rawState.uuid}
        state={rawState}
        evolutions={evolutions}
        preop={preOpsForState(pos, rawState.uuid)[0]}
        canEdit={canEdit}
        mefPatch={mefPatch}
        mefPatchDebounced={mefPatchDebounced}
        onClose={onClose}
      />
    );
  }
  if (context.kind === "evolution") {
    const e = evolutionsView(pos).find((x) => x.id === context.id);
    const rawEv = pos.plantEvolutions.find((x) => x.uuid === context.id);
    if (e === undefined || rawEv === undefined) return null;
    const states = statesView(pos).filter((s) => s.evolutionId === e.id);
    return (
      <EvolutionEditor
        key={rawEv.uuid}
        ev={rawEv}
        durationFraction={e.durationFraction}
        states={states}
        canEdit={canEdit}
        mefPatch={mefPatch}
        mefPatchDebounced={mefPatchDebounced}
        onClose={onClose}
      />
    );
  }
  const rawGroup = (pos.plantOperatingStateGroups ?? []).find((x) => x.uuid === context.id);
  if (rawGroup === undefined) return null;
  const groupStates = pos.plantOperatingStates.map((s) => ({ uuid: s.uuid, name: s.name, durationHours: s.meanDurationHours }));
  return (
    <GroupEditor
      key={rawGroup.uuid}
      group={rawGroup}
      states={groupStates}
      preop={preOpsForGroup(pos, rawGroup.uuid)[0]}
      canEdit={canEdit}
      mefPatch={mefPatch}
      mefPatchDebounced={mefPatchDebounced}
      onClose={onClose}
    />
  );
}

function Drawer({ context, onClose, canEdit, mefPatch, mefPatchDebounced }: { context: DrawerContext; onClose: () => void; canEdit: boolean; mefPatch?: (mutator: Mutator) => void; mefPatchDebounced?: (mutator: Mutator) => void }): JSX.Element {
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
    <div
      className="posdrawer-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="posdrawer" role="dialog" aria-modal="true">
        <DrawerContent context={context} onClose={onClose} canEdit={canEdit} mefPatch={mefPatch} mefPatchDebounced={mefPatchDebounced} />
      </div>
    </div>
  );
}

export { Drawer, DrawerContent };
