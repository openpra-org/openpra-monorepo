import { JSX } from "react";
import { SYIcon } from "./syIcons";
import { Badge, type BadgeKind } from "./syShared";
import {
  SY_SYSTEM_META,
  SY_SAFETY_FUNCTIONS,
  CCF_MODELS,
  SHARED_CAUSE_LABELS,
  CONFIRM_METHODS,
  SPATIAL_COUPLINGS,
  REPAIR_CREDIT,
  NOMENCLATURE,
  LEVEL_OF_DETAIL,
  SY_LABELING_SCHEME,
  SY_METHODOLOGY_TOC,
  DEP_KIND,
  type CapabilityCategory,
} from "./syViewData";
import { type CcScore } from "./sySelectors";
import { useSyWorkbook } from "./syWorkbookContext";
import { generateSyReport } from "./syDocx";
import { type SyDrawerContext } from "./syScreens";

const LOGIC_LOOPS: { id: string; loop: string; resolution: string }[] = [
  { id: "LL-1", loop: "DC power and room cooling depend on each other", resolution: "Broken by crediting the battery for the cooling restart window, with the assumption logged." },
];

function DepsScreen(): JSX.Element {
  const { sy } = useSyWorkbook();
  const supportCols = sy.systemDefinitions.filter((s) => SY_SYSTEM_META[s.uuid]?.kind === "support").map((s) => s.uuid);
  function cellFor(rowId: string, colId: string): string | null {
    const dep = sy.systemDependencies.find((d) => d.dependentSystem === rowId && d.supportingSystem === colId);
    return dep?.details ?? null;
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Support dependency matrix</h3>
          <span className="syprov"><SYIcon.Link /> SY-B5 · SY-B6</span>
        </div>
        <p className="poscard__sub">Each row depends on the marked support systems, with the need set by engineering analysis.</p>
        <div className="sydep">
          <table className="sydep__table">
            <thead>
              <tr>
                <th className="sydep__corner">System</th>
                {supportCols.map((id) => <th key={id} className="sydep__colhead">{SY_SYSTEM_META[id]?.short ?? id}</th>)}
              </tr>
            </thead>
            <tbody>
              {sy.systemDefinitions.map((row) => (
                <tr key={row.uuid}>
                  <td className="sydep__rowhead">{row.name}</td>
                  {supportCols.map((cid) => {
                    const dep = cellFor(row.uuid, cid);
                    const self = row.uuid === cid;
                    const k = dep !== null ? DEP_KIND[dep] : null;
                    return (
                      <td key={cid} className="sydep__cell">
                        {self ? <span className="sydep__self">—</span>
                          : k !== null ? <span className={`sydep__dep ${k.cls}`}>{k.label}</span>
                          : <span className="sydep__none" />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {LOGIC_LOOPS.map((l) => (
          <div key={l.id} className="syloop">
            <span className="syloop__icon"><SYIcon.Refresh /></span>
            <div><div className="syloop__head">Logic loop. {l.loop}</div><div className="syloop__res">{l.resolution}</div></div>
          </div>
        ))}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Support success criteria</h3>
          <span className="syprov"><SYIcon.Link /> SY-B7 · SY-B9 · SY-B13</span>
        </div>
        <p className="poscard__sub">Conservative criteria at CC-I, or realistic ones for the risk-significant support systems.</p>
        <div className="scsys">
          {(sy.supportSystemSuccessCriteria ?? []).map((n) => {
            const meta = SY_SYSTEM_META[n.systemReference];
            const def = sy.systemDefinitions.find((s) => s.uuid === n.systemReference);
            return (
              <div key={n.uuid} className="scsys__card">
                <div className="scsys__head">
                  <span className="scsys__icon"><NamedIcon name={meta?.icon ?? "Settings"} /></span>
                  <span className="scsys__name">{def?.name ?? n.systemReference}</span>
                  <span className={`syd-method syd-method--${n.criteriaType.toLowerCase()}`} style={{ marginLeft: "auto" }}>{n.criteriaType === "REALISTIC" ? "Realistic" : "Conservative"}</span>
                </div>
                <div className="scsys__dep" style={{ borderTop: "none", paddingTop: 0, marginTop: 0 }}>{n.successCriteria}</div>
                <div className="scsys__cap" style={{ marginTop: 8 }}>
                  <span className="scsys__cap-k">Supports</span>
                  <span className="scsys__cap-v" style={{ fontFamily: "inherit", fontWeight: 600 }}>{n.supportedSystems.map((s) => SY_SYSTEM_META[s]?.short ?? s).join(", ")}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Spatial and environmental couplings</h3>
          <span className="syprov"><SYIcon.Link /> SY-B8 · SY-B14</span>
        </div>
        <p className="poscard__sub">Two trains in one room are not two independent coin flips, so shared space enters the model.</p>
        <div className="syspc">
          {SPATIAL_COUPLINGS.map((s) => (
            <div key={s.id} className={`syspc__card${s.status === "warn" ? " syspc__card--warn" : ""}`}>
              <div className="syspc__head">
                <span className="syspc__icon"><NamedIcon name={s.icon} /></span>
                <span className="syspc__name">{s.name}</span>
                <span className={`syspc__type syspc__type--${s.type.toLowerCase()}`}>{s.type === "SPATIAL" ? "Spatial" : "Environmental"}</span>
              </div>
              <div className="syspc__affects">
                {s.affects.map((a) => <span key={a} className="syspc__affects-tag">{a}</span>)}
              </div>
              <div className="syspc__hazard">{s.hazard}</div>
              <div className="syspc__treat"><SYIcon.Check /> {s.treatment}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Depletable inventories</h3>
          <span className="syprov"><SYIcon.Link /> SY-B12</span>
        </div>
        <p className="poscard__sub">Each inventory is checked against the mission time, the way component times are in Success Criteria.</p>
        <div className="syinv">
          {(sy.depletionModels ?? []).map((d) => {
            const def = sy.systemDefinitions.find((s) => s.uuid === d.associatedSystem);
            const mission = def?.missionTimeHours ?? 24;
            const cap = d.initialQuantity;
            const passive = cap <= 0;
            const span = Math.max(mission, cap);
            const cP = passive ? 100 : Math.max(5, (cap / span) * 100);
            const mP = Math.max(5, (mission / span) * 100);
            const supports = d.missionTimeSupported === true;
            return (
              <div key={d.uuid} className={`syinv__row${supports ? "" : " syinv__row--warn"}`}>
                <div className="syinv__lead">
                  <span className="syinv__icon"><NamedIcon name={d.resourceType === "battery" ? "Battery" : d.resourceType === "air" ? "Wind" : "Gauge"} /></span>
                  <div>
                    <div className="syinv__name">{d.description ?? d.resourceType}</div>
                    <div className="syinv__note">{SY_SYSTEM_META[d.associatedSystem ?? ""]?.short ?? d.associatedSystem ?? ""}</div>
                  </div>
                </div>
                <div className="syinv__gauge">
                  <div className="syinv__bars">
                    <div className="syinv__bar">
                      <span className="syinv__bar-k">Capacity</span>
                      <div className="syinv__track"><div className={`syinv__fill syinv__fill--cap${supports ? "" : " syinv__fill--short"}`} style={{ width: `${cP}%` }} /></div>
                      <span className="syinv__bar-v posmono">{passive ? "Passive" : `${cap} h`}</span>
                    </div>
                    <div className="syinv__bar">
                      <span className="syinv__bar-k">Mission</span>
                      <div className="syinv__track"><div className="syinv__fill syinv__fill--mission" style={{ width: `${mP}%` }} /></div>
                      <span className="syinv__bar-v posmono">{mission} h</span>
                    </div>
                  </div>
                  <div className={`syinv__verdict syinv__verdict--${supports ? "ok" : "warn"}`}>
                    {supports ? <><SYIcon.Check /> Supports the mission</> : <><SYIcon.Warn /> Load shedding under review</>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Digital I&C and software</h3>
          <span className="syprov"><SYIcon.Link /> SY-B11</span>
        </div>
        <p className="poscard__sub">For digital actuation this requirement is load-bearing, since software is a shared cause across systems.</p>
        {(sy.digitalInstrumentationAndControl ?? []).map((d) => {
          const def = sy.systemDefinitions.find((s) => s.uuid === d.systemReference);
          return (
            <div key={d.uuid} className="sydig">
              <div className="sydig__head">
                <span className="sydig__icon"><SYIcon.Cpu /></span>
                <div>
                  <div className="sydig__name">{d.name}</div>
                  <div className="sydig__sys">{def?.name ?? d.systemReference}</div>
                </div>
                <Badge kind="warn">CC-II open</Badge>
              </div>
              <div className="sydig__method"><strong>Method.</strong> {d.methodology}</div>
              <div className="sydig__modes">
                {(d.failureModes ?? []).map((m) => <span key={m} className="sydig__mode">{m}</span>)}
              </div>
              {(d.specialConsiderations ?? []).map((c) => <div key={c} className="sydig__sw"><SYIcon.Code /> {c}</div>)}
            </div>
          );
        })}
      </div>
    </>
  );
}

function NamedIcon({ name }: { name: string }): JSX.Element {
  const Icon = SYIcon[name] ?? SYIcon.Link;
  return <Icon />;
}

function IntegrityScreen({ stage }: { stage: string }): JSX.Element {
  const { sy } = useSyWorkbook();
  const isOp = stage === "operational";
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Plant-fidelity confirmation</h3>
          <span className="syprov"><SYIcon.Link /> {isOp ? "SY-A5" : "SY-A6"}</span>
        </div>
        <p className="poscard__sub">{isOp ? "Confirm the model through staff discussions and, at CC-II, plant investigations and walkdowns." : "Confirm the model matches the design intent, with walkdowns deferred to the as-built plant."}</p>
        <table className="postable">
          <thead><tr><th>System</th><th>Method</th><th>Finding</th><th>Date</th></tr></thead>
          <tbody>
            {(sy.systemConfirmationRecords ?? []).map((c) => {
              const meta = c.systemReference !== undefined ? SY_SYSTEM_META[c.systemReference] : undefined;
              return (
                <tr key={c.uuid}>
                  <td style={{ fontWeight: 600 }}>{meta?.short ?? c.systemReference ?? "—"}</td>
                  <td><span className="syd-method syd-method--review">{CONFIRM_METHODS[c.method] ?? c.method}</span></td>
                  <td className="possubtle" style={{ fontSize: 12 }}>{c.findings}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{c.date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!isOp && (
          <div className="eswarn" style={{ marginTop: 10 }}><span className="eswarn__icon"><SYIcon.Warn /></span><span>Walkdowns and plant investigations apply at the operating stage, so the pre-operational model leans on design review.</span></div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Level of detail</h3>
          <span className="syprov"><SYIcon.Link /> {isOp ? "SY-A10" : "SY-A11"} · SY-A22</span>
        </div>
        <div className="syintegrity">
          <div className="syintegrity__cell">
            <span className="syintegrity__k"><SYIcon.Layers /> Model detail</span>
            <span className="syintegrity__v">{LEVEL_OF_DETAIL.basis}</span>
          </div>
          <div className="syintegrity__cell">
            <span className="syintegrity__k"><SYIcon.Person /> Human event detail</span>
            <span className="syintegrity__v">{LEVEL_OF_DETAIL.hfeBasis}</span>
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Nomenclature</h3>
          <span className="syprov"><SYIcon.Link /> SY-A30</span>
        </div>
        <p className="poscard__sub">One designator per component failure mode across every system and train, which lets the quantifier link the trees.</p>
        <div className="synom">
          <div className="synom__scheme"><SYIcon.Tag /> Scheme. <span className="posmono">{NOMENCLATURE.scheme}</span></div>
          <div className="synom__list">
            {NOMENCLATURE.examples.map((e) => (
              <div key={e.designator} className="synom__row">
                <span className="synom__desig posmono">{e.designator}</span>
                <span className="synom__arrow"><SYIcon.ArrowR /></span>
                <span className="synom__reads">{e.reads}</span>
              </div>
            ))}
          </div>
          <div className="synom__note"><SYIcon.Sparkle /><span>{NOMENCLATURE.note}</span></div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Labeling scheme</h3>
          <span className="syprov"><SYIcon.Link /> Methodology report</span>
        </div>
        <p className="poscard__sub">The event-type codes the fault trees use, so every element reads the same names.</p>
        <table className="postable">
          <thead><tr><th>Type</th><th>Code</th><th>Example</th><th>Note</th></tr></thead>
          <tbody>
            {SY_LABELING_SCHEME.map((l, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{l.type}</td>
                <td className="posmono" style={{ fontSize: 11.5 }}>{l.code}</td>
                <td className="posmono" style={{ fontSize: 11.5 }}>{l.example}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{l.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

interface RegisterRow {
  id: string;
  type: string;
  tone: BadgeKind | undefined;
  item: string;
  detail: string;
  sr: string;
}

const PA_SR: Record<string, string> = {
  "PA-1": "SY-A33",
  "PA-2": "SY-A26",
  "PA-3": "SY-B17",
  "PA-4": "SY-C3",
};

function UncertScreen(): JSX.Element {
  const { sy } = useSyWorkbook();
  const register: RegisterRow[] = [
    ...(sy.uncertaintyAnalyses ?? []).flatMap((u) => u.modelUncertainties.map((m) => ({ id: m.uncertaintyId, type: "Uncertainty", tone: "progress" as BadgeKind, item: m.description, detail: m.impact, sr: "SY-B16" }))),
    ...(sy.preOperationalAssumptions ?? []).map((a) => ({ id: a.uuid, type: "Pre-op", tone: "warn" as BadgeKind, item: a.influenceOnDefinition, detail: a.description, sr: PA_SR[a.uuid] ?? "SY-A33" })),
    ...(sy.sensitivityStudies ?? []).map((s) => ({ id: s.uuid, type: "Sensitivity", tone: undefined, item: s.name ?? s.description, detail: s.results ?? "", sr: "SY-A32" })),
  ];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability representation</h3>
          <span className="syprov"><SYIcon.Link /> SY-A29</span>
        </div>
        <p className="poscard__sub">Conservative when a rated capability might be exceeded, realistic only with supporting analysis or data.</p>
        <div className="syoc">
          {(sy.overCapacityConsiderations ?? []).map((o) => {
            const def = sy.systemDefinitions.find((s) => s.uuid === o.system);
            const realistic = o.treatment === "REALISTIC_JUSTIFIED";
            return (
              <div key={o.uuid} className="syoc__row">
                <div>
                  <div className="syoc__sys">{def?.name ?? o.system}</div>
                  <div className="syoc__scn">{o.potentialExceedanceScenarios[0] ?? ""}</div>
                  <div className="syoc__basis">{o.justificationForCapability ?? ""}</div>
                </div>
                <span className={`syd-method syd-method--${realistic ? "realistic" : "conservative"}`}>
                  {realistic ? "Realistic (CC-II)" : "Conservative (CC-I)"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Repair credit</h3>
          <span className="syprov"><SYIcon.Link /> SY-A31</span>
        </div>
        <p className="poscard__sub">Repair of hardware faults is not credited unless data or analysis supports it.</p>
        <table className="postable">
          <thead><tr><th>Item</th><th>System</th><th>Repair credited</th><th>Basis</th></tr></thead>
          <tbody>
            {REPAIR_CREDIT.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.item}</td>
                <td>{SY_SYSTEM_META[r.system]?.short ?? r.system}</td>
                <td>{r.credited ? <Badge kind="warn">Credited</Badge> : <Badge>Not credited</Badge>}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{r.basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Open items register</h3>
          <span className="possubtle">{register.length} items · SY-A32, A33, B16, B17</span>
        </div>
        <table className="postable">
          <thead><tr><th>Type</th><th>Item</th><th>Detail</th><th>SR</th></tr></thead>
          <tbody>
            {register.map((r) => (
              <tr key={r.id}>
                <td><Badge kind={r.tone}>{r.type}</Badge></td>
                <td style={{ fontWeight: 600 }}>{r.item}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{r.detail}</td>
                <td className="posmono" style={{ fontSize: 11 }}>{r.sr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DraftScreen({ cc, scores, stage, onSubmitDraft, canSubmit }: {
  cc: CapabilityCategory;
  scores: CcScore;
  stage: string;
  onSubmitDraft: (ready: boolean) => void;
  canSubmit: boolean;
}): JSX.Element {
  const { sy } = useSyWorkbook();
  const ready = scores.blocked === 0 && scores.warn === 0;
  function downloadJson(): void {
    const blob = new Blob([JSON.stringify(sy, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sy.name} — SY Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{sy.name}</h1>
        <h2>Systems Analysis Methodology</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {SY_METHODOLOGY_TOC.map(([t, p], i) => (<div key={i} className="posgen__preview-toc-row"><span>{t}</span><span>{p}</span></div>))}
        </div>
      </div>
      <div className="posgen__side">
        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Conformance check</h3>
          <div className="posgen__bar"><span className="posgen__bar-label">Capability category</span><span style={{ fontWeight: 700 }}>{cc.name} · {cc.tag}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Plant stage</span><span style={{ fontWeight: 700 }}>{stage === "pre_operational" ? "Pre-operational" : "Operational"}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Items satisfied</span><span className="posmono">{scores.met} / {scores.applicable}</span></div>
          {scores.warn > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "var(--color-warning)" }}>Needs attention</span><span className="posmono">{scores.warn}</span></div>}
          {scores.blocked > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "#b73b3b" }}>Blocked</span><span className="posmono">{scores.blocked}</span></div>}
        </div>
        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Hand-off to internal review</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {ready
              ? <>All items pass at <strong>{cc.name}</strong>. Producing the draft locks Steps 1 to 7 and advances the workbook to <strong>Internal Technical Review</strong>.</>
              : <>{scores.warn} item{scores.warn === 1 ? "" : "s"} need attention. A working draft is fine, but approval waits.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && (
              <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onSubmitDraft(ready)}>
                <SYIcon.Send /> Submit draft to internal review
              </button>
            )}
            <button type="button" className="posnav__btn" onClick={() => { void generateSyReport(sy, "methodology", "", ready); }}><SYIcon.Download /> Download draft (.docx)</button>
            <button type="button" className="posnav__btn" onClick={downloadJson}><SYIcon.Download /> Download JSON</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawerContent({ context, onClose }: { context: SyDrawerContext; onClose: () => void }): JSX.Element | null {
  const { sy } = useSyWorkbook();

  if (context.kind === "system") {
    const sysDef = sy.systemDefinitions.find((s) => s.uuid === context.id);
    if (sysDef === undefined) return null;
    const meta = SY_SYSTEM_META[sysDef.uuid];
    const logic = sy.systemLogicModels.find((m) => m.systemReference === sysDef.uuid);
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">System · {meta?.short ?? sysDef.uuid}</div>
            <h2 className="posdrawer__title">{sysDef.name}</h2>
            <p className="posdrawer__sub">{meta !== undefined ? (SY_SAFETY_FUNCTIONS[meta.sf]?.name ?? meta.sf) : ""} · {logic?.modelRepresentation ?? "System-level"}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="sytop" style={{ margin: 0 }}>
            <span className="sytop__icon"><SYIcon.Target /></span>
            <div>
              <div className="sytop__cap">Top event</div>
              <div className="sytop__text">{sysDef.description ?? sysDef.name}</div>
              {meta !== undefined && <div className="sytop__crit">{meta.criterion}</div>}
            </div>
          </div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Mission time</label><div className="posmono">{sysDef.missionTimeHours !== undefined ? `${sysDef.missionTimeHours} h` : "—"}</div></div>
            <div className="posfield"><label className="posfield__label">Components</label><div className="posmono">{meta?.components ?? "—"}</div></div>
            <div className="posfield"><label className="posfield__label">Basic events</label><div className="posmono">{logic?.basicEvents.length ?? meta?.basicEvents ?? 0}</div></div>
            <div className="posfield"><label className="posfield__label">Alignments</label><div>{meta?.alignments ?? 1} modeled</div></div>
          </div>
          <div>
            <div className="essec">Model boundary</div>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>{sysDef.boundaries.map((b, i) => <span key={i} className="poschip">{b}</span>)}</div>
          </div>
          {meta?.statusNote !== undefined && <div className="eswarn"><span className="eswarn__icon"><SYIcon.Warn /></span><span>{meta.statusNote}</span></div>}
        </div>
      </>
    );
  }

  if (context.kind === "ccf") {
    const g = sy.commonCauseFailureGroups.find((x) => x.uuid === context.id);
    if (g === undefined) return null;
    const model = CCF_MODELS[g.modelType];
    const shared = g.sharedCauseFactors ?? {};
    const sharedKeys = Object.keys(shared).filter((k) => shared[k as keyof typeof shared] === true);
    const otherList = Array.isArray(shared.otherFactors) ? shared.otherFactors : [];
    const affects = g.affectedSystems.filter((a) => a !== g.affectedSystems[0]);
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Common cause group · {g.scope === "INTRASYSTEM" ? "Within a system" : "Across systems"}</div>
            <h2 className="posdrawer__title">{g.name}</h2>
            <p className="posdrawer__sub">{model?.label ?? g.modelType} · {g.dataAnalysisCCFParameterRef ?? "—"}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div>
            <div className="essec">Grouping basis (SY-B3)</div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--color-text-muted)", margin: 0 }}>{g.description}</p>
          </div>
          <div>
            <div className="essec">Members</div>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>{g.affectedComponents.map((m) => <span key={m} className="poschip posmono">{m}</span>)}</div>
          </div>
          <div>
            <div className="essec">Shared causes</div>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>
              {sharedKeys.map((s) => <span key={s} className="poschip poschip--primary">{SHARED_CAUSE_LABELS[s] ?? s}</span>)}
              {otherList.map((s) => <span key={s} className="poschip poschip--primary">{s}</span>)}
            </div>
          </div>
          {affects.length > 0 && (
            <div>
              <div className="essec">Couples</div>
              <div className="posrow posrow--wrap" style={{ gap: 6 }}>{affects.map((a) => { const def = sy.systemDefinitions.find((s) => s.uuid === a); return <span key={a} className="poschip">{def?.name ?? a}</span>; })}</div>
            </div>
          )}
          <div className="eswarn" style={{ background: "var(--color-primary-soft)", borderColor: "var(--color-primary-focus)" }}>
            <span className="eswarn__icon" style={{ color: "var(--color-primary)" }}><SYIcon.Link /></span>
            <span>Consistent with the Data Analysis common cause model at {g.dataAnalysisCCFParameterRef ?? "—"} (SY-B4). {g.riskSignificanceJustification ?? ""}</span>
          </div>
        </div>
      </>
    );
  }

  if (context.kind === "hfe") {
    const h = sy.humanFailureEventIntegrations.find((x) => x.uuid === context.id);
    if (h === undefined) return null;
    const def = sy.systemDefinitions.find((s) => s.uuid === h.system);
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">Human failure event · {h.hfeType === "PRE_INITIATOR" ? "Pre-initiator" : "Post-initiator"}</div>
            <h2 className="posdrawer__title">{h.taskDescription}</h2>
            <p className="posdrawer__sub">{def?.name ?? h.system} · {h.hfeReference}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">System</label><div style={{ fontWeight: 700 }}>{def?.name ?? h.system}</div></div>
            <div className="posfield"><label className="posfield__label">Test & maintenance</label><div>{h.isTestMaintenance ? "Yes" : "No"}</div></div>
            <div className="posfield"><label className="posfield__label">HR reference</label><div className="posmono">{h.hfeReference}</div></div>
            <div className="posfield"><label className="posfield__label">Placed under</label><div className="posmono">{h.implementsSrs.map((s) => s.sr).join(", ")}</div></div>
          </div>
          <div className="eswarn"><span className="eswarn__icon"><SYIcon.Person /></span><span>SY places the event in the model, Human Reliability quantifies it.</span></div>
        </div>
      </>
    );
  }

  return null;
}

function PlaceholderScreen({ label }: { label: string }): JSX.Element {
  return <div className="poscard"><div className="syempty"><div className="syempty__title">{label}</div><p className="syempty__hint">This step is not part of the current workbook view.</p></div></div>;
}

export { DepsScreen, IntegrityScreen, UncertScreen, DraftScreen, DrawerContent, PlaceholderScreen };
