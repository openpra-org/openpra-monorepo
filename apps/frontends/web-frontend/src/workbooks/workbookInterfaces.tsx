import { JSX, useState } from "react";
import {
  type ElementCode,
  type LaneEntry,
  elementMeta,
  elementInterface,
  linkBarProviders,
  inputSideLanes,
  bridgesFor,
  dockDependenciesForSr,
} from "./elementDependencies";
import "./css/workbookInterfaces.css";

type IconComponent = () => JSX.Element;

const IOIcon: Record<string, IconComponent> = {
  Layers: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l10 6-10 6L2 8l10-6z" /><path d="M2 17l10 6 10-6M2 12l10 6 10-6" /></svg>),
  Bolt: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>),
  Tree: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="10" width="5" height="4" rx="1" /><rect x="16" y="4" width="5" height="4" rx="1" /><rect x="16" y="16" width="5" height="4" rx="1" /><path d="M8 12h4v-6h4M12 12v6h4" /></svg>),
  Target: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /></svg>),
  Settings: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>),
  Person: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4" /><path d="M5 21a7 7 0 0 1 14 0" /></svg>),
  Database: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" /></svg>),
  Sigma: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 5H6l6 7-6 7h12" /></svg>),
  Atom: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1.6" fill="currentColor" /><ellipse cx="12" cy="12" rx="10" ry="4.4" /><ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(120 12 12)" /></svg>),
  Wind: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h9a2.5 2.5 0 1 1-2.5 2.5" /></svg>),
  Scale: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z" /></svg>),
  ArrowR: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>),
  Swap: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4 3 8l4 4" /><path d="M3 8h13" /><path d="m17 20 4-4-4-4" /><path d="M21 16H8" /></svg>),
  Link: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>),
};

function iconFor(element: ElementCode): IconComponent {
  return IOIcon[elementMeta(element).icon] ?? IOIcon.Link;
}

function WorkbookUpstreamBar({ element }: { element: ElementCode }): JSX.Element | null {
  const providers = linkBarProviders(element);
  if (providers.length === 0) return null;
  return (
    <div className="wbio-bar">
      {providers.map((p) => {
        const meta = elementMeta(p.element);
        const Icon = iconFor(p.element);
        const bridges = bridgesFor(element, p.element);
        return (
          <div key={p.element} className="wbio-card">
            <div className="wbio-card__top">
              <span className="wbio-card__badge"><Icon /></span>
              <div className="wbio-card__head">
                <div className="wbio-card__el">{meta.name}</div>
                <div className="wbio-card__role">{p.role}</div>
              </div>
              <span className="wbio-card__code posmono">{p.element}</span>
            </div>
            <p className="wbio-card__detail">{p.detail}</p>
            {bridges.length > 0 && (
              <div className="wbio-card__bridges">
                {bridges.map((b) => <span key={b} className="wbio-card__bridge posmono">{b}</span>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FlowNode({ entry, lane }: { entry: LaneEntry; lane: "in" | "bi" | "out" }): JSX.Element {
  const meta = elementMeta(entry.element);
  const Icon = iconFor(entry.element);
  return (
    <div className={`wbio-flow__node wbio-flow__node--${lane}`}>
      <span className="wbio-flow__badge">{lane === "bi" ? <IOIcon.Swap /> : <Icon />}</span>
      <div className="wbio-flow__body">
        <span className="wbio-flow__el">{meta.name} <span className="wbio-flow__code posmono">{entry.element}</span></span>
        <span className="wbio-flow__use">{entry.detail}</span>
      </div>
    </div>
  );
}

function WorkbookInterfaceMap({ element, mode = "full" }: { element: ElementCode; mode?: "full" | "outputs" }): JSX.Element {
  const iface = elementInterface(element);
  const inputSide = mode === "outputs" ? [] : inputSideLanes(element);
  const hasInputCol = inputSide.length > 0;
  return (
    <>
      <div className={`wbio-flow${hasInputCol && iface.outputs.length > 0 ? "" : " wbio-flow--single"}`}>
        {hasInputCol && (
          <div className="wbio-flow__col">
            <div className="wbio-flow__col-head"><IOIcon.ArrowR /> Inputs</div>
            {inputSide.map((o) => <FlowNode key={`${o.lane}-${o.entry.element}`} entry={o.entry} lane={o.lane} />)}
          </div>
        )}
        {iface.outputs.length > 0 && (
          <div className="wbio-flow__col">
            <div className="wbio-flow__col-head">Outputs <IOIcon.ArrowR /></div>
            {iface.outputs.map((e) => <FlowNode key={`out-${e.element}`} entry={e} lane="out" />)}
          </div>
        )}
      </div>
      {iface.funnelsToEsq && (
        <div className="wbio-note">
          <IOIcon.Sigma />
          <span>This element's model-uncertainty also funnels into Event Sequence Quantification (ESQ-E1), then into Risk Integration (RI-C1).</span>
        </div>
      )}
    </>
  );
}

interface InterfaceTile {
  code: ElementCode;
  name: string;
  role: string;
  direction: "in" | "bi" | "out";
  detail: string;
  bridges: string[];
}

function interfaceTilesFor(element: ElementCode): InterfaceTile[] {
  const tiles: InterfaceTile[] = [];
  for (const { entry, lane } of inputSideLanes(element)) {
    tiles.push({
      code: entry.element,
      name: elementMeta(entry.element).name,
      role: entry.role,
      direction: lane,
      detail: entry.detail,
      bridges: bridgesFor(entry.element, element),
    });
  }
  for (const entry of elementInterface(element).outputs) {
    tiles.push({
      code: entry.element,
      name: elementMeta(entry.element).name,
      role: entry.role,
      direction: "out",
      detail: entry.detail,
      bridges: bridgesFor(element, entry.element),
    });
  }
  return tiles;
}

function WorkbookInterfaceTiles({ element }: { element: ElementCode }): JSX.Element {
  const tiles = interfaceTilesFor(element);
  const [selected, setSelected] = useState<string | null>(null);
  const active = tiles.find((t) => `${t.direction}-${t.code}` === selected);
  const selfName = elementMeta(element).name;
  return (
    <>
      <div className="poshandoff__grid">
        {tiles.map((tile) => {
          const key = `${tile.direction}-${tile.code}`;
          return (
            <button
              key={key}
              type="button"
              className={`poshandoff__tile${selected === key ? " poshandoff__tile--active" : ""}`}
              onClick={() => setSelected(selected === key ? null : key)}
            >
              <span className="poshandoff__tile-code">{tile.code}</span>
              <span className="poshandoff__tile-name">{tile.name}</span>
              <span className="poshandoff__tile-role">{tile.direction === "out" ? "Consumes · " : tile.direction === "bi" ? "Exchanges · " : "Provides · "}{tile.role}</span>
            </button>
          );
        })}
      </div>
      {active !== undefined && (
        <div style={{ marginTop: 16 }}>
          <div className="possubtle" style={{ fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>
            {active.direction === "out"
              ? `${active.name} receives ${active.role.toLowerCase()} from ${selfName}`
              : `${selfName} receives ${active.role.toLowerCase()} from ${active.name}`}
          </div>
          <p className="posmuted" style={{ margin: 0 }}>{active.detail}</p>
          {active.bridges.length > 0 && (
            <div className="posrow posrow--wrap" style={{ gap: 6, marginTop: 10 }}>
              {active.bridges.map((b) => <span key={b} className="poschip posmono">{b}</span>)}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function DockDependsChip({ element, sr }: { element: ElementCode; sr: string }): JSX.Element | null {
  const deps = dockDependenciesForSr(element, sr);
  if (deps.length === 0) return null;
  const hlrs = deps.flatMap((d) => d.hlrs);
  return (
    <span className="posdock__item-depends">
      <span className="posdock__item-depends-label">Needs</span>
      {hlrs.map((h) => <span key={h} className="posdock__item-depends-hlr">{h}</span>)}
    </span>
  );
}

export { WorkbookUpstreamBar, WorkbookInterfaceMap, WorkbookInterfaceTiles, DockDependsChip };
