import { type JSX, type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";
import {
  HANDOFF_ELEMENT_CODES,
  handoffAddress,
  handoffSectionsOf,
  importedSections,
  type HandoffElement,
  type HandoffSectionKey,
} from "interfaces-mef-types/technical-element-handoff";
import "./css/workbookHandoff.css";

interface HandoffColumn {
  label: string;
  numeric?: boolean;
}

interface HandoffRow {
  id: string;
  cells: ReactNode[];
}

interface HandoffTableView {
  columns: HandoffColumn[];
  rows: HandoffRow[];
}

interface HandoffSubsectionView extends HandoffTableView {
  key: string;
  name: string;
}

interface HandoffTableSection extends HandoffTableView {
  key: HandoffSectionKey;
}

interface HandoffNestedSection {
  key: HandoffSectionKey;
  subsections: HandoffSubsectionView[];
}

type HandoffSectionView = HandoffTableSection | HandoffNestedSection;

interface HandoffTab {
  key: string;
  name: string;
}

interface HandoffUncertaintyInput {
  uncertaintySources?: readonly { source: string; impact: string }[];
  relatedAssumptions?: readonly { assumption: string; basis: string }[];
}

interface HandoffAssumptionInput {
  assumptionId: string;
  description: string;
  status?: string;
}

const HANDOFF_PAGE = 10;

const ASSUMPTION_COLUMNS: HandoffColumn[] = [{ label: "Kind" }, { label: "Item" }, { label: "Detail" }];

const ASSUMPTION_STATUS: Record<string, string> = { OPEN: "Open", IN_PROGRESS: "In progress", CLOSED: "Closed" };

function assumptionRows(uncertainty: HandoffUncertaintyInput | undefined, preOperational: readonly HandoffAssumptionInput[] | undefined): HandoffRow[] {
  return [
    ...(uncertainty?.uncertaintySources ?? []).map((entry, index) => ({ id: `source-${String(index)}`, cells: ["Uncertainty source", entry.source, entry.impact] })),
    ...(uncertainty?.relatedAssumptions ?? []).map((entry, index) => ({ id: `assumption-${String(index)}`, cells: ["Assumption", entry.assumption, entry.basis] })),
    ...(preOperational ?? []).map((entry, index) => ({
      id: `pre-${entry.assumptionId}-${String(index)}`,
      cells: ["Pre-operational", readableId(entry.assumptionId) === undefined ? entry.description : `${entry.assumptionId} · ${entry.description}`, entry.status === undefined ? "" : ASSUMPTION_STATUS[entry.status] ?? entry.status],
    })),
  ];
}

const HEX_DIGITS = "0123456789abcdefABCDEF";

const UUID_DASHES: readonly number[] = [8, 13, 18, 23];

function isUuid(value: string): boolean {
  if (value.length !== 36) return false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charAt(index);
    if (UUID_DASHES.includes(index) ? char !== "-" : !HEX_DIGITS.includes(char)) return false;
  }
  return true;
}

function readableId(id: string): string | undefined {
  return id.length === 0 || isUuid(id) ? undefined : id;
}

function recordLabel(id: string, name?: string): string {
  const readable = readableId(id);
  if (readable !== undefined) return readable;
  if (name === undefined) return "Unresolved record";
  return name.length > 0 ? name : "Unnamed record";
}

function idAndName(id: string, name: string): string {
  const code = readableId(id);
  if (code === undefined) return name.length > 0 ? name : "Unnamed record";
  return name.length > 0 && name !== code ? `${code} · ${name}` : code;
}

function handoffName(id: string, name = ""): ReactNode {
  const code = readableId(id);
  const title = code ?? (name.length > 0 ? name : "Unnamed record");
  const sub = code !== undefined && name.length > 0 && name !== code ? name : "";
  return <><span className="postable__name">{title}</span>{sub.length > 0 && <span className="postable__name-sub">{sub}</span>}</>;
}

function joinedOrNone(values: readonly string[]): string {
  return values.length === 0 ? "None" : values.join(", ");
}

function HandoffPager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }): JSX.Element {
  const pages = Math.max(1, Math.ceil(total / HANDOFF_PAGE));
  const label = `${String(total)} ${total === 1 ? "record" : "records"}`;
  if (pages <= 1) return <span className="wbhandoff__count">{label}</span>;
  return (
    <span className="wbhandoff__pager">
      <span className="wbhandoff__count">{page * HANDOFF_PAGE + 1} to {Math.min(total, (page + 1) * HANDOFF_PAGE)} of {label}</span>
      <button type="button" className="posnav__btn posnav__btn--sm" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</button>
      <button type="button" className="posnav__btn posnav__btn--sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next</button>
    </span>
  );
}

function HandoffTable({ view, label }: { view: HandoffTableView; label: string }): JSX.Element {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(view.rows.length / HANDOFF_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = view.rows.slice(current * HANDOFF_PAGE, (current + 1) * HANDOFF_PAGE);
  return (
    <>
      <div className="wbhandoff__bar">
        <HandoffPager page={current} total={view.rows.length} onPage={setPage} />
      </div>
      {view.rows.length > 0 && (
        <div className="wbhandoff__table">
          <table className="postable" aria-label={label}>
            <thead>
              <tr>{view.columns.map((column) => <th key={column.label} scope="col" className={column.numeric === true ? "wbhandoff__num" : undefined}>{column.label}</th>)}</tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id}>
                  {row.cells.map((cell, index) => (
                    <td key={view.columns[index]?.label ?? String(index)} className={view.columns[index]?.numeric === true ? "wbhandoff__num" : undefined}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function HandoffTabs({ tabs, active, label, nested, onSelect }: {
  tabs: readonly HandoffTab[];
  active: string;
  label: string;
  nested: boolean;
  onSelect: (key: string) => void;
}): JSX.Element {
  const tabsRef = useRef<HTMLDivElement>(null);
  const idBase = useId();

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.key === active);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    const next = tabs[nextIndex];
    if (next === undefined) return;
    onSelect(next.key);
    tabsRef.current?.querySelectorAll<HTMLButtonElement>("button")[nextIndex]?.focus();
  }

  return (
    <div className={nested ? "wbhandoff__tabs wbhandoff__tabs--nested" : "wbhandoff__tabs"} role="tablist" aria-label={label} ref={tabsRef} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          id={`${idBase}-${tab.key}`}
          aria-selected={active === tab.key}
          tabIndex={active === tab.key ? 0 : -1}
          onClick={() => onSelect(tab.key)}
        >
          {tab.name}
        </button>
      ))}
    </div>
  );
}

function NestedSection({ view, address }: { view: HandoffNestedSection; address: string }): JSX.Element | null {
  const [selected, setSelected] = useState<string | null>(null);
  const active = view.subsections.find((subsection) => subsection.key === selected) ?? view.subsections[0];
  if (active === undefined) return null;
  return (
    <>
      <HandoffTabs tabs={view.subsections} active={active.key} label={address} nested onSelect={setSelected} />
      <HandoffTable key={active.key} view={active} label={`${address}.${active.name}`} />
    </>
  );
}

function TechnicalElementHandoff({ element, sections }: {
  element: HandoffElement;
  sections: readonly HandoffSectionView[];
}): JSX.Element {
  const catalog = handoffSectionsOf(element).filter((section) => sections.some((view) => view.key === section.key));
  const [selected, setSelected] = useState<string | null>(null);
  const active = catalog.find((section) => section.key === selected) ?? catalog[0];
  const view = active === undefined ? undefined : sections.find((candidate) => candidate.key === active.key);

  return (
    <section className="poscard wbhandoff" aria-label="Technical Element Handoff">
      {active !== undefined && <HandoffTabs tabs={catalog} active={active.key} label="Handoff sections" nested={false} onSelect={setSelected} />}
      {active !== undefined && view !== undefined && (
        <div className="wbhandoff__panel" role="tabpanel" aria-label={handoffAddress(active)}>
          {"subsections" in view
            ? <NestedSection key={active.key} view={view} address={handoffAddress(active)} />
            : <HandoffTable key={active.key} view={view} label={handoffAddress(active)} />}
        </div>
      )}
    </section>
  );
}

function HandoffImports({ consumer, producer }: { consumer: HandoffElement; producer: HandoffElement }): JSX.Element | null {
  const sections = importedSections(consumer, producer);
  if (sections.length === 0) return null;
  return (
    <div className="wbhandoff__imports" aria-label={`Sections imported from ${HANDOFF_ELEMENT_CODES[producer]}`}>
      <span className="wbhandoff__readers-label">Imports</span>
      {sections.map((section) => <span key={section.key} className="wbhandoff__chip posmono">{handoffAddress(section)}</span>)}
    </div>
  );
}

export { ASSUMPTION_COLUMNS, HandoffImports, TechnicalElementHandoff, assumptionRows, handoffName, idAndName, joinedOrNone, readableId, recordLabel };
export type { HandoffAssumptionInput, HandoffColumn, HandoffRow, HandoffSectionView, HandoffSubsectionView, HandoffUncertaintyInput };
