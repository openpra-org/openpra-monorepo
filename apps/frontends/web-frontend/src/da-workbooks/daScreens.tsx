import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { JSX, useState } from "react";
import { DAIcon } from "./daIcons";
import { Badge, DaProvenanceChip, valText, unitText } from "./daShared";
import { useDaWorkbook } from "./daWorkbookContext";
import {
  CAPABILITY_CATEGORIES,
  EVIDENCE_LADDER,
  PROBABILITY_MODELS,
  PARAM_TYPES,
  ESTIMATION_APPROACH,
  DA_METHODS,
  GROUPING_BASIS,
  SOURCE_TYPES,
  type Stage,
} from "./daViewData";
import { modelLabel, paramIsWarn } from "./daSelectors";

interface DaDrawerContext {
  kind: "param" | "boundary" | "grouping" | "estimate" | "outlier" | "source" | "failuredef" | "demand" | "exposure" | "testcred" | "unavail" | "coincident" | "repair" | "recovery" | "outage" | "ccf" | "uncsource" | "preop" | "sens" | "datamod";
  id: string;
}

function MethodChips({ ids, label }: { ids: string[]; label?: string }): JSX.Element | null {
  const ms = ids.map((id) => DA_METHODS[id]).filter((m): m is (typeof DA_METHODS)[string] => m !== undefined);
  if (ms.length === 0) return null;
  return (
    <div className="hrmethods">
      {label !== undefined && <span className="hrmethods__label">{label}</span>}
      {ms.map((m) => (
        <span key={m.id} className="hrmethod-chip" title={`${m.name} · ${m.ref}`}>{m.abbr}</span>
      ))}
    </div>
  );
}

function ParamTypePill({ type }: { type: string }): JSX.Element {
  const t = PARAM_TYPES[type];
  return <span className={`daptype daptype--${t?.tone ?? "primary"}`}>{t?.short ?? type}</span>;
}

function RungPill({ approach }: { approach?: string }): JSX.Element {
  const a = approach !== undefined ? ESTIMATION_APPROACH[approach] : undefined;
  return <span className={`darung darung--${a?.rung ?? "generic"}`}>{a?.label ?? "Generic"}</span>;
}

function LadderPosition({ rung }: { rung: string }): JSX.Element {
  return (
    <div className="daladpos">
      {EVIDENCE_LADDER.map((r) => (
        <span key={r.id} className={`daladpos__rung daladpos__rung--${r.color}${r.color === rung ? " daladpos__rung--on" : ""}`} title={r.label}>{r.label}</span>
      ))}
    </div>
  );
}

// ─── 01 — Scope & Sources ──────────────────────────────────────────────────
function ScopeScreen({ ccId, setCcId, stage, setStage }: { ccId: string; setCcId: (id: string) => void; onAction: (msg: string) => void; stage: Stage; setStage: (s: Stage) => void }): JSX.Element {
  const { da, links, editable, mutateDa } = useDaWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const [selectedTe, setSelectedTe] = useState<string | null>(null);
  const ifaceLanes: { key: string; code: string; element: string; role: string; direction: "in" | "bi" | "out"; columns: string[]; rows: { id: string; name: string; values: string[] }[]; empty: string }[] = [
    { key: "bi-POS", code: "POS", element: "Plant Operating States", role: "Operating states and outage exposure", direction: "bi", columns: ["Item", "Context", "Hours"], rows: [
      ...(links?.posStates ?? []).map((x) => ({ id: x.id, name: `${x.id} · ${x.name}`, values: [x.mode, String(x.durationHours)] })),
      ...(da.lpsdOutageDataRecords ?? []).map((o) => ({ id: o.uuid, name: `${o.uuid} · ${o.outageType}`, values: [o.plantOperatingStateRef ?? "—", String(o.durationHours)] })),
    ], empty: "Load the example to pull the operating states the parameters and the outage records are defined per." },
    { key: "out-IE", code: "IE", element: "Initiating Events", role: "Initiating-event frequencies", direction: "out", columns: ["Parameter", "Basic event", "Frequency (/yr)"], rows: da.parameters.filter((x) => x.parameterType === "FREQUENCY").map((x) => ({ id: x.uuid, name: x.name, values: [x.basicEventRef ?? "—", valText(x.value)] })), empty: "No frequency parameters defined yet." },
    { key: "in-ES", code: "ES", element: "Event Sequence Analysis", role: "Sequence families and mission context", direction: "in", columns: ["Family", "Name"], rows: (links?.esFamilies ?? []).map((f) => ({ id: f.id, name: f.id, values: [f.name] })), empty: "Load the example to pull the sequence families whose mission times frame the exposure hours." },
    { key: "bi-SY", code: "SY", element: "Systems Analysis", role: "Basic events and their estimates", direction: "bi", columns: ["Basic event", "System", "Estimate"], rows: da.parameters.filter((x) => x.parameterType !== "FREQUENCY").map((x) => ({ id: x.uuid, name: x.basicEventRef ?? x.name, values: [x.systemReference ?? "—", valText(x.value)] })), empty: "No basic-event parameters defined yet." },
    { key: "out-HR", code: "HR", element: "Human Reliability", role: "Repair, recovery and schedule records", direction: "out", columns: ["Record", "What it backs", "Value"], rows: [
      ...(da.repairTimeRecords ?? []).map((r) => ({ id: r.uuid, name: `${r.uuid} · ${r.sscReference} restoration`, values: ["Recovery-credit timing", `${String(r.repairEvents[0]?.identificationToRestorationHours ?? 0)} h`] })),
      ...(da.recoveryTimeRecords ?? []).map((r) => ({ id: r.uuid, name: `${r.uuid} · ${r.functionLost} recovery`, values: ["Function-recovery timing", `${String(r.recoveryEvents[0]?.identificationToRestorationHours ?? 0)} h`] })),
      ...(da.demandCountRecords ?? []).map((d) => ({ id: d.uuid, name: `${d.uuid} · ${d.componentGroupRef} demand schedule`, values: ["Surveillance and exposure basis", `${String(d.totalDemands)} demands per year`] })),
      ...(da.coincidentMaintenanceRecords ?? []).map((c) => ({ id: c.uuid, name: `${c.uuid} · Coincident two-train maintenance`, values: ["Multi-train work practice", valText(c.unavailabilityValue)] })),
    ], empty: "No repair, recovery or schedule records yet." },
    { key: "out-ESQ", code: "ESQ", element: "Event Sequence Quantification", role: "Parameter distributions", direction: "out", columns: ["Parameter", "Mean", "Model"], rows: da.parameters.map((x) => ({ id: x.uuid, name: x.name, values: [valText(x.value), modelLabel(x)] })), empty: "No parameters defined yet." },
  ];
  const selectedLane = ifaceLanes.find((l) => l.key === selectedTe);

  function onScopeChange(value: string): void {
    if (!editable) return;
    mutateDa((draft) => ({ ...draft, praScope: value }));
  }
  function onCcChange(newCcId: string): void {
    if (!editable) return;
    setCcId(newCcId);
    mutateDa((draft) => ({ ...draft, capabilityCategory: newCcId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(newStage: Stage): void {
    if (!editable) return;
    setStage(newStage);
    mutateDa((draft) => ({ ...draft, plantStage: newStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" }));
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Interfaces</h3></div>
        <p className="poscard__sub">Data Analysis reads the operating states, the sequence context and the basic events to estimate, then hands the frequencies, the distributions and the repair and schedule records to the consuming elements. Select an element to see the data exchanged.</p>
        <div className="poshandoff__grid">
          {ifaceLanes.map((lane) => (
            <button key={lane.key} type="button"
              className={`poshandoff__tile${selectedTe === lane.key ? " poshandoff__tile--active" : ""}`}
              onClick={() => setSelectedTe(selectedTe === lane.key ? null : lane.key)}>
              <span className="poshandoff__tile-code">{lane.code}</span>
              <span className="poshandoff__tile-name">{lane.element}</span>
              <span className="poshandoff__tile-role">{lane.direction === "out" ? "Consumes · " : lane.direction === "bi" ? "Exchanges · " : "Provides · "}{lane.role}</span>
            </button>
          ))}
        </div>
        {selectedLane !== undefined && (
          <div style={{ marginTop: 16 }}>
            <div className="possubtle" style={{ fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>
              {selectedLane.direction === "out"
                ? `${selectedLane.element} receives ${selectedLane.role.toLowerCase()} from Data Analysis`
                : selectedLane.direction === "bi"
                  ? `Data Analysis exchanges ${selectedLane.role.toLowerCase()} with ${selectedLane.element}`
                  : `Data Analysis receives ${selectedLane.role.toLowerCase()} from ${selectedLane.element}`}
            </div>
            {selectedLane.rows.length > 0 ? (
              <table className="postable postable--mid">
                <thead><tr>{selectedLane.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {selectedLane.rows.map((r) => (
                    <tr key={r.id}>
                      <td><div className="postable__name">{r.name}</div></td>
                      {r.values.map((v, idx) => <td key={selectedLane.columns[idx + 1] ?? `c${idx}`} className="mono">{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="posmuted" style={{ margin: 0 }}>{selectedLane.empty}</p>
            )}
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">PRA scope</h3></div>
        <p className="poscard__sub">Describe what this data analysis covers and what it excludes.</p>
        <WorkbookTextarea
          className="posfield__textarea"
          placeholder="State the in-scope parameters, operating states, and explicit exclusions."
          rows={4}
          value={da.praScope}
          disabled={!editable}
          onChange={(e) => onScopeChange(e.target.value)}
        />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability category</h3>
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <p className="poscard__sub">The available estimate with uncertainty, or a realistic mean for the risk-significant basic events.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            return (
              <button key={c.id} type="button" className="poscard" onClick={() => onCcChange(c.id)}
                style={{ textAlign: "left", cursor: "pointer", borderColor: active ? "var(--color-primary)" : undefined, boxShadow: active ? "0 0 0 3px var(--color-primary-focus)" : undefined, padding: 14 }}>
                <div className="posrow" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                  <Badge kind={active ? "progress" : undefined}>{c.tag}</Badge>
                </div>
                <p className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>{c.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Plant stage</h3></div>
        <p className="poscard__sub">DA has the starkest pre-operational fork, since a paper plant has no records to count at all.</p>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "Generic sources, technology experience and planned schedules stand in, with every borrowing justified."],
            ["operational", "Operational", "Plant records of failures, demands, time and outages replace the borrowed values and close the design-gap SRs."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label key={val} className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === val ? "var(--color-primary)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <WorkbookInput type="radio" name="da-stage" value={val} checked={stage === val} onChange={() => onStageChange(val)} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</div>
                  <div className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>{body}</div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── 02 — Define Parameters (HLR-A) ────────────────────────────────────────
function DefineScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  function addParam(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateDa((draft) => ({ ...draft, parameters: [...draft.parameters, { uuid, name: "New parameter", parameterType: "PROBABILITY", value: 1.0e-3, valueType: "MEAN", implementsSrs: [{ sr: "DA-A1", hlr: "A" }] }] }));
    openDrawer({ kind: "param", id: uuid });
  }
  function addBoundary(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateDa((draft) => ({ ...draft, componentBoundaries: [...draft.componentBoundaries, { uuid, name: "New boundary", systemId: "", description: "", boundaries: [""], includedItems: [], boundaryBasis: "", implementsSrs: [{ sr: "DA-A2", hlr: "A" }] }] }));
    openDrawer({ kind: "boundary", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Parameters to estimate</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <span className="possubtle">DA-A1, A3, A4</span>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addParam}><DAIcon.Plus /> Add parameter</button>}
          </div>
        </div>
        <p className="poscard__sub">Each basic event from SY becomes a parameter with a type, a matching boundary and a fitting probability model.</p>
        <div className="daparam">
          {da.parameters.map((p) => (
            <div key={p.uuid} className={`daparam__card${paramIsWarn(p) ? " daparam__card--warn" : ""}`} onClick={() => openDrawer({ kind: "param", id: p.uuid })}>
              <div className="daparam__head">
                <ParamTypePill type={p.parameterType} />
                <span className="daparam__be posmono">{p.basicEventRef}</span>
                <RungPill approach={p.estimationApproach} />
              </div>
              <div className="daparam__name">{p.name}</div>
              {p.isRiskSignificant === true && <div className="daparam__meta"><span className="daparam__rs">Risk-significant</span></div>}
              <div className="daparam__foot">
                <span className="daparam__model">{modelLabel(p)}</span>
                <span className="daparam__val posmono">{valText(p.value)}<span className="daparam__unit">{unitText(p.parameterType)}</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Component boundaries</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <DaProvenanceChip>DA-A2</DaProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addBoundary}><DAIcon.Plus /> Add boundary</button>}
          </div>
        </div>
        <p className="poscard__sub">The boundary, the failure modes and the success criteria must match the SY basic event, or the analysis double-counts.</p>
        <div className="daboundary">
          {da.componentBoundaries.map((b) => {
            const consistent = !b.boundaryBasis.toLowerCase().includes("under review");
            return (
              <div key={b.uuid} className={`daboundary__card${consistent ? "" : " daboundary__card--warn"}`} onClick={() => openDrawer({ kind: "boundary", id: b.uuid })}>
                <div className="daboundary__head">
                  <span className="daboundary__name">{b.name}</span>
                  <span className="daboundary__sys posmono">{b.systemId}</span>
                  {consistent ? <Badge kind="ok">Matches SY</Badge> : <Badge kind="warn">Overlap open</Badge>}
                </div>
                <div className="daboundary__cols">
                  <div className="daboundary__col">
                    <span className="daboundary__col-cap daboundary__col-cap--in"><DAIcon.Check /> Included</span>
                    {b.includedItems.map((x, i) => <span key={i} className="daboundary__item">{x}</span>)}
                  </div>
                  <div className="daboundary__col">
                    <span className="daboundary__col-cap daboundary__col-cap--out"><DAIcon.Close /> Excluded</span>
                    {(b.excludedItems ?? []).map((x, i) => <span key={i} className="daboundary__item daboundary__item--out">{x}</span>)}
                  </div>
                </div>
                <div className="daboundary__basis"><DAIcon.Link /> {b.boundaryBasis}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Probability model per event</h3>
          <DaProvenanceChip>DA-A3</DaProvenanceChip>
        </div>
        <p className="poscard__sub">A standby pump on demand and a running pump per hour are different objects, so each event gets the model that fits.</p>
        <table className="postable postable--mid" style={{ marginTop: 4 }}>
          <thead><tr><th>Event</th><th>Model</th><th>Basis</th></tr></thead>
          <tbody>
            {da.parameters.map((x) => {
              const m = PROBABILITY_MODELS.find((pm) => pm.paramType === x.parameterType);
              return (
                <tr key={x.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "param", id: x.uuid })} style={{ cursor: "pointer" }}>
                  <td><div className="postable__name">{x.basicEventRef ?? x.name}</div><span className="postable__name-sub">{x.name}</span></td>
                  <td>{modelLabel(x)}</td>
                  <td>{m !== undefined && <span className={`damodel-basis damodel-basis--${m.basis.toLowerCase()}`}>{m.basis === "DEMAND" ? "Per demand" : "Over time"}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── 03 — Group Populations (HLR-B) ────────────────────────────────────────
function GroupScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const groupings = da.componentGroupings ?? [];
  const outliers = da.outlierComponents ?? [];
  function addGroup(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateDa((draft) => ({ ...draft, componentGroupings: [...(draft.componentGroupings ?? []), { uuid, name: "New group", systemId: "", groupId: uuid, componentIds: [], groupingBasis: "TYPE_AND_SERVICE_CONDITIONS", designCharacteristics: [], environmentalConditions: [], serviceConditions: [], groupingJustification: "", implementsSrs: [{ sr: "DA-B1", hlr: "B" }] }] }));
    openDrawer({ kind: "grouping", id: uuid });
  }
  function addOutlier(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateDa((draft) => ({ ...draft, outlierComponents: [...(draft.outlierComponents ?? []), { uuid, systemId: "", componentId: "New outlier", potentialGroupId: "", exclusionReason: "", exclusionJustification: "", differentiatingCharacteristics: [], alternativeHandling: "", status: "TENTATIVE", implementsSrs: [{ sr: "DA-B2", hlr: "B" }] }] }));
    openDrawer({ kind: "outlier", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Homogeneous populations</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <span className="possubtle">DA-B1</span>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addGroup}><DAIcon.Plus /> Add group</button>}
          </div>
        </div>
        <p className="poscard__sub">Pool components by type at CC-I, or by type and service and environment at CC-II, since pooling unlike things poisons the estimate.</p>
        <div className="dagroup">
          {groupings.map((g) => {
            const basis = GROUPING_BASIS[g.groupingBasis];
            return (
              <div key={g.uuid} className="dagroup__card" onClick={() => openDrawer({ kind: "grouping", id: g.uuid })}>
                <div className="dagroup__head">
                  <div className="dagroup__head-main">
                    <div className="dagroup__name">{g.name}</div>
                    <div className="dagroup__sys posmono">{g.systemId}</div>
                  </div>
                  <span className={`dagroup__cc dagroup__cc--${basis?.cc === "CC-II" ? "ii" : "i"}`}>{basis?.label} · {basis?.cc}</span>
                </div>
                <div className="dagroup__members">
                  {g.componentIds.map((m, i) => <span key={i} className="dagroup__member">{m}</span>)}
                </div>
                <p className="dagroup__just">{g.groupingJustification}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Outliers held out</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <DaProvenanceChip>DA-B2</DaProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addOutlier}><DAIcon.Plus /> Add outlier</button>}
          </div>
        </div>
        <p className="poscard__sub">A never-tested valve or a mothballed spare does not get pooled with frequently exercised equipment.</p>
        <div className="daoutlier">
          {outliers.map((o) => (
            <div key={o.uuid} className="daoutlier__row" onClick={() => openDrawer({ kind: "outlier", id: o.uuid })}>
              <div className="daoutlier__main">
                <span className="daoutlier__name">{o.componentId}</span>
                <span className="daoutlier__reason">{o.exclusionReason}</span>
              </div>
              <div className="daoutlier__diff">
                {o.differentiatingCharacteristics.map((d, i) => <span key={i} className="daoutlier__tag">{d}</span>)}
              </div>
              <span className="daoutlier__status">{o.status === "CONFIRMED" ? "Confirmed" : o.status === "TENTATIVE" ? "Tentative" : "Under review"}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── 04 — Collect: Generic (HLR-C, first movement) ─────────────────────────
function GenericScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, editable, mutateDa } = useDaWorkbook();
  const sources = da.externalDataSources ?? [];
  function addSource(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateDa((draft) => ({ ...draft, externalDataSources: [...(draft.externalDataSources ?? []), { uuid, name: "New source", sourceType: "INDUSTRY_DATABASE", sourceLocation: "", timePeriod: { start: "", end: "" }, accessMethod: "", dataFormat: "", referenceDocumentation: [], implementsSrs: [{ sr: "DA-C1", hlr: "C" }] }] }));
    openDrawer({ kind: "source", id: uuid });
  }
  function appliesTo(name: string): string[] {
    return da.parameters.filter((p) => (p.dataSources ?? []).some((ds) => ds.source === name)).map((p) => p.uuid);
  }
  function isNonnuclear(limits: string[] | undefined): boolean {
    return (limits ?? []).some((l) => l.toLowerCase().includes("nonnuclear"));
  }
  function isPerState(limits: string[] | undefined): boolean {
    return !(limits ?? []).some((l) => l.toLowerCase().includes("single state"));
  }
  function applicabilityNote(limits: string[] | undefined): string {
    return (limits ?? []).find((l) => l.toLowerCase().includes("applicab")) ?? (limits ?? [])[0] ?? "";
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Generic and technology sources</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <span className="possubtle">DA-C1, C2</span>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSource}><DAIcon.Plus /> Add source</button>}
          </div>
        </div>
        <p className="poscard__sub">Collect generic estimates per operating state, and add technology experience from other facilities while the plant is pre-operational.</p>
        <div className="dasource">
          {sources.map((s) => {
            const otherFacility = s.sourceType === "OTHER_FACILITY_EXPERIENCE";
            const nonnuclear = isNonnuclear(s.limitations);
            const perState = isPerState(s.limitations);
            return (
              <div key={s.uuid} className={`dasource__card${otherFacility ? " dasource__card--other" : ""}`} onClick={() => openDrawer({ kind: "source", id: s.uuid })}>
                <div className="dasource__head">
                  <div className="dasource__head-main">
                    <div className="dasource__name">{s.name}</div>
                    <div className="dasource__type">{SOURCE_TYPES[s.sourceType] ?? s.sourceType} · {s.timePeriod.start} to {s.timePeriod.end}</div>
                  </div>
                  {nonnuclear
                    ? <span className="dasource__flag dasource__flag--nonnuclear">Nonnuclear</span>
                    : otherFacility
                      ? <span className="dasource__flag dasource__flag--other">Other facility</span>
                      : null}
                </div>
                <div className="dasource__applies">
                  {appliesTo(s.name).map((pid) => <span key={pid} className="dasource__param posmono">{pid}</span>)}
                </div>
                <p className="dasource__note">{s.qualityAssurance}</p>
                <div className="dasource__foot">
                  <span className={`dasource__state${perState ? " dasource__state--on" : ""}`}>
                    {perState ? "Collected per state" : "Single state"}
                  </span>
                  <DaProvenanceChip>{s.implementsSrs.map((r) => r.sr).join(" · ")}</DaProvenanceChip>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Reuse across operating states</h3>
          <DaProvenanceChip>DA-C25</DaProvenanceChip>
        </div>
        <p className="poscard__sub">A generic estimate is reused for another operating state only after its applicability to that state is established.</p>
        <div className="dareuse">
          {sources.filter((s) => isPerState(s.limitations)).map((s) => (
            <div key={s.uuid} className="dareuse__row" onClick={() => openDrawer({ kind: "source", id: s.uuid })}>
              <div className="dareuse__main">
                <span className="dareuse__name">{s.name}</span>
                <span className="dareuse__meta posmono">{s.timePeriod.start} to {s.timePeriod.end}</span>
              </div>
              <span className="dareuse__just">{applicabilityNote(s.limitations)}</span>
              <div className="dareuse__applies">
                {appliesTo(s.name).map((pid) => <span key={pid} className="dasource__param posmono">{pid}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export {
  ScopeScreen,
  DefineScreen,
  GroupScreen,
  GenericScreen,
  MethodChips,
  LadderPosition,
  ParamTypePill,
  RungPill,
  type DaDrawerContext,
};
