import { JSX, useEffect, useState } from "react";
import { POSIcon } from "./posIcons";
import { Badge } from "./posShared";
import { PreopAssumptionCard } from "./posPreopCard";
import { type DrawerContext } from "./posScreens";
import { statesView, evolutionsView, groupsView, isBarrierBroken, preOpsForState, preOpsForGroup, type StateView } from "./posSelectors";
import { usePosWorkbook } from "./posWorkbookContext";
import { type Mutator } from "./useMefPatch";
import {
  type PlantOperatingStatesAnalysis,
  type PlantEvolution,
  EvolutionType,
  OperatingMode,
} from "interfaces-mef-types/pos/plant-operating-state-analysis";

const EVOLUTION_TYPES = Object.values(EvolutionType);
const OPERATING_MODES = Object.values(OperatingMode);

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
      <fieldset disabled={!canEdit} className="posdrawer__body" style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>
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
          <table className="postable">
            <thead><tr><th>State</th><th>Mode</th><th>Duration</th><th>Status</th></tr></thead>
            <tbody>
              {states.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="postable__name">{s.id}</div>
                    <span className="postable__name-sub">{s.name}</span>
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

function DrawerContent({ context, onClose, canEdit, mefPatch, mefPatchDebounced }: { context: DrawerContext; onClose: () => void; canEdit: boolean; mefPatch?: (mutator: Mutator) => void; mefPatchDebounced?: (mutator: Mutator) => void }): JSX.Element | null {
  const { pos } = usePosWorkbook();
  if (context.kind === "state") {
    const s = statesView(pos).find((x) => x.id === context.id);
    if (s === undefined) return null;
    const ev = evolutionsView(pos).find((e) => e.id === s.evolutionId);
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Operating state · {s.id}</div>
            <h2 className="posdrawer__title">{s.name}</h2>
            <div className="posdrawer__sub">Part of evolution <strong>{ev?.name}</strong> · {s.mode}</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><POSIcon.Close /></button>
        </div>
        <fieldset disabled={!canEdit} className="posdrawer__body" style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>
          <div className="poscard">
            <div className="poscard__head"><h3 className="poscard__title">Coolant parameters</h3></div>
            <div className="posfield-grid posfield-grid--3">
              <div className="posfield">
                <label className="posfield__label">Coolant temperature</label>
                <input className="posfield__input" defaultValue={s.rcs.temp} />
              </div>
              <div className="posfield">
                <label className="posfield__label">Pressure</label>
                <input className="posfield__input" defaultValue={s.rcs.press} />
              </div>
              <div className="posfield">
                <label className="posfield__label">Power level</label>
                <input className="posfield__input" defaultValue={s.rcs.power} />
              </div>
            </div>
          </div>

          <div className="poscard">
            <div className="poscard__head"><h3 className="poscard__title">Radioactive material sources</h3></div>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>
              {s.sources.map((src) => <span key={src} className="poschip">{src}</span>)}
              <button type="button" className="poschip"><POSIcon.Plus /> Add source</button>
            </div>
            <p className="posfield__hint" style={{ marginTop: 8 }}>
              Ex-core sources (spent fuel, cover gas, off-gas) matter as much as in-core fuel for non-LWR designs.
            </p>
          </div>

          <div className="poscard">
            <div className="poscard__head"><h3 className="poscard__title">Radionuclide transport barriers</h3></div>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>
              {s.barriers.map((b) => (
                <span key={b} className={`poschip${isBarrierBroken(b) ? " poschip--warn" : ""}`}>{b}</span>
              ))}
              <button type="button" className="poschip"><POSIcon.Plus /> Add barrier</button>
            </div>
          </div>

          <div className="poscard">
            <div className="poscard__head"><h3 className="poscard__title">Time boundary</h3></div>
            <div className="posfield-grid">
              <div className="posfield">
                <label className="posfield__label">Starting condition</label>
                <input className="posfield__input" defaultValue="Entry from prior POS upon defined transition" />
              </div>
              <div className="posfield">
                <label className="posfield__label">Ending condition</label>
                <input className="posfield__input" defaultValue="Exit to next POS upon parameter threshold" />
              </div>
              <div className="posfield posfield-grid--span2">
                <label className="posfield__label">Mean duration</label>
                <input className="posfield__input" defaultValue={s.duration} />
              </div>
            </div>
          </div>

          {s.statusMessage !== undefined && (
            <div className="poscard" style={{ background: "rgba(196,122,24,0.08)", borderColor: "rgba(196,122,24,0.3)" }}>
              <div className="posrow" style={{ gap: 12 }}>
                <div style={{ color: "var(--color-warning)" }}><POSIcon.Warn /></div>
                <div style={{ fontSize: 13.5 }}><strong>Needs attention.</strong> {s.statusMessage}</div>
              </div>
            </div>
          )}

          <PreopAssumptionCard assumption={preOpsForState(pos, s.id)[0]} />
        </fieldset>
      </>
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
  const g = groupsView(pos).find((x) => x.id === context.id);
  if (g === undefined) return null;
  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Operating-state group · {g.id}</div>
          <h2 className="posdrawer__title">{g.name}</h2>
          <div className="posdrawer__sub">{g.members.length} member states · total {g.durationSum}</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><POSIcon.Close /></button>
      </div>
      <fieldset disabled={!canEdit} className="posdrawer__body" style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Similarity rationale</h3></div>
          <textarea className="posfield__textarea" defaultValue={g.rationale} style={{ minHeight: 120 }} />
        </div>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Bounding characteristic</h3></div>
          <input className="posfield__input" defaultValue={g.boundingCharacteristic} />
        </div>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Member states</h3></div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>
            {g.members.map((m) => <span key={m} className="poschip poschip--primary">{m}</span>)}
            <button type="button" className="poschip"><POSIcon.Plus /> Add state</button>
          </div>
        </div>

        <PreopAssumptionCard assumption={preOpsForGroup(pos, g.id)[0]} />
      </fieldset>
    </>
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
