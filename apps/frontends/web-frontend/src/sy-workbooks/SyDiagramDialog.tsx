import { useEffect, useId, useRef, useState, type FormEvent, type JSX, type PointerEvent } from "react";
import type { SystemDiagram, SystemDiagramRegion, SystemDiagramRotation } from "interfaces-mef-types/sy/systems-analysis";
import { DialogHead } from "./syShared";
import { SyDiagramCanvas, capturePointer, useElementWidth, usePageAspect } from "./SyDiagramCanvas";
import {
  FULL_PAGE,
  diagramDocuments,
  displayAspect,
  loadDiagramSource,
  resolveDiagramDocument,
  roundRegion,
  searchPdf,
  withDiagram,
  withoutDiagram,
  type SyDiagramDocument,
  type SyDiagramSource,
  type SyPdfSearchResult,
} from "./syDiagrams";
import { listSyDocuments } from "./syWorkbookApi";
import { useSyWorkbook } from "./syWorkbookContext";
import "./css/syDiagrams.css";

type PickerStep = "document" | "find" | "crop" | "review";

const PAGES_PER_GROUP = 12;
const MIN_REGION = 0.01;

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function between(a: { x: number; y: number }, b: { x: number; y: number }): SystemDiagramRegion {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

function percent(value: number): string {
  return `${value * 100}%`;
}

function pageNumber(input: string, pageCount: number): number | null {
  const value = Number(input);
  return Number.isInteger(value) && value >= 1 && value <= pageCount ? value : null;
}

function groupStartFor(target: number, pageCount: number): number {
  return Math.max(1, Math.min(target, pageCount - PAGES_PER_GROUP + 1));
}

function fittedWidth(stageWidth: number, aspect: number | null, reserved: number): number {
  if (aspect === null || stageWidth <= 0) return 0;
  const maxHeight = Math.max(320, window.innerHeight - reserved);
  return Math.floor(Math.min(stageWidth, maxHeight / aspect));
}

function nextRotation(rotation: SystemDiagramRotation): SystemDiagramRotation {
  if (rotation === 0) return 90;
  if (rotation === 90) return 180;
  if (rotation === 180) return 270;
  return 0;
}

function SelectionPreview({ source, page, region, label, rotation }: {
  source: SyDiagramSource;
  page: number;
  region: SystemDiagramRegion;
  label: string;
  rotation: SystemDiagramRotation;
}): JSX.Element {
  const stage = useRef<HTMLDivElement>(null);
  const stageWidth = useElementWidth(stage);
  const pageShape = usePageAspect(source, page);
  const width = fittedWidth(stageWidth, pageShape === null ? null : displayAspect(pageShape, region, rotation), 380);
  return (
    <div className="sy-diagram-preview" ref={stage}>
      {width > 0 && <SyDiagramCanvas source={source} page={page} region={region} width={width} label={label} rotation={rotation} />}
    </div>
  );
}

function PageThumbnail({ source, page, onOpen }: { source: SyDiagramSource; page: number; onOpen: () => void }): JSX.Element {
  return (
    <button type="button" className="sy-diagram-thumb" aria-label={`Open page ${page}`} onClick={onOpen}>
      <SyDiagramCanvas source={source} page={page} region={FULL_PAGE} width={120} label={`Page ${page}`} />
      <span>Page {page}</span>
    </button>
  );
}

function CropStage({ source, page, region, onRegion }: {
  source: SyDiagramSource;
  page: number;
  region: SystemDiagramRegion | null;
  onRegion: (region: SystemDiagramRegion) => void;
}): JSX.Element {
  const stage = useRef<HTMLDivElement>(null);
  const stageWidth = useElementWidth(stage);
  const aspect = usePageAspect(source, page);
  const [draft, setDraft] = useState<SystemDiagramRegion | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const width = fittedWidth(stageWidth, aspect, 320);

  function point(event: PointerEvent<HTMLDivElement>): { x: number; y: number } {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
  }

  function finish(event: PointerEvent<HTMLDivElement>): void {
    const origin = start.current;
    if (origin === null) return;
    start.current = null;
    setDraft(null);
    const selected = between(origin, point(event));
    if (selected.width >= MIN_REGION && selected.height >= MIN_REGION) onRegion(roundRegion(selected));
  }

  const shown = draft ?? region;
  return (
    <div className="sy-diagram-crop__stage" ref={stage}>
      {width > 0 && (
        <div className="sy-diagram-crop__page" style={{ width }}>
          <SyDiagramCanvas source={source} page={page} region={FULL_PAGE} width={width} label={`Page ${page}`} />
          <div
            className="sy-diagram-crop__overlay"
            data-testid="diagram-crop-area"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              capturePointer(event);
              start.current = point(event);
              setDraft({ ...start.current, width: 0, height: 0 });
            }}
            onPointerMove={(event) => {
              const origin = start.current;
              if (origin !== null) setDraft(between(origin, point(event)));
            }}
            onPointerUp={finish}
            onPointerCancel={() => { start.current = null; setDraft(null); }}
          >
            {shown !== null && <div className="sy-diagram-crop__box" style={{ left: percent(shown.x), top: percent(shown.y), width: percent(shown.width), height: percent(shown.height) }} />}
          </div>
        </div>
      )}
    </div>
  );
}

function SyDiagramDialog({ systemId, diagramId, onClose }: { systemId: string; diagramId?: string; onClose: () => void }): JSX.Element | null {
  const { sy, editable, mutateSy, runtime } = useSyWorkbook();
  const system = sy.systemDefinitions.find((candidate) => candidate.uuid === systemId);
  const existing = system?.diagrams?.find((diagram) => diagram.uuid === diagramId);
  const [documents, setDocuments] = useState<SyDiagramDocument[] | null>(null);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<SyDiagramDocument | null>(() => (existing === undefined ? null : resolveDiagramDocument(sy, runtime.workbookId, existing)));
  const [source, setSource] = useState<SyDiagramSource | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [step, setStep] = useState<PickerStep>(existing === undefined ? "document" : "review");
  const [query, setQuery] = useState(system?.name ?? "");
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState<{ page: number; total: number } | null>(null);
  const [result, setResult] = useState<SyPdfSearchResult | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [groupStart, setGroupStart] = useState(1);
  const [pageInput, setPageInput] = useState("");
  const [page, setPage] = useState(existing?.page ?? 1);
  const [region, setRegion] = useState<SystemDiagramRegion | null>(existing?.region ?? null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [rotation, setRotation] = useState<SystemDiagramRotation>(existing?.rotation ?? 0);
  const [titleEdited, setTitleEdited] = useState(existing !== undefined);
  const searchRun = useRef(0);
  const autoSearched = useRef<string | null>(null);
  const searchId = useId();
  const pageInputId = useId();
  const chosenUrl = chosen?.url ?? null;
  const chosenKind = chosen?.kind ?? null;
  const exampleDocuments = sy.exampleDocuments;
  const systemName = system?.name ?? "";

  async function runSearch(loaded: SyDiagramSource, text: string): Promise<void> {
    searchRun.current += 1;
    const run = searchRun.current;
    setSearching(true);
    setResult(null);
    setProgress(null);
    try {
      const found = await searchPdf(loaded, text, (current, total) => { if (run === searchRun.current) setProgress({ page: current, total }); }, () => run !== searchRun.current);
      if (run !== searchRun.current) return;
      setResult(found);
      if (found.pagesWithText === 0) setBrowsing(true);
    } catch (err) {
      if (run === searchRun.current) setSourceError(err instanceof Error && err.message.length > 0 ? err.message : "The document could not be searched.");
    } finally {
      if (run === searchRun.current) setSearching(false);
    }
  }

  useEffect(() => {
    let active = true;
    const workbookId = runtime.workbookId;
    if (workbookId === null) {
      setDocuments(diagramDocuments({ exampleDocuments }, null, []));
      return undefined;
    }
    listSyDocuments(workbookId)
      .then((uploaded) => { if (active) setDocuments(diagramDocuments({ exampleDocuments }, workbookId, uploaded)); })
      .catch((err: Error) => {
        if (!active) return;
        setDocuments(diagramDocuments({ exampleDocuments }, null, []));
        setDocumentsError(err.message.length > 0 ? err.message : "The uploaded documents could not be listed.");
      });
    return () => { active = false; };
  }, [runtime.workbookId, exampleDocuments]);

  useEffect(() => {
    if (chosenUrl === null || chosenKind === null) return undefined;
    let active = true;
    setSource(null);
    setSourceError(null);
    loadDiagramSource({ url: chosenUrl, kind: chosenKind })
      .then((loaded) => { if (active) setSource(loaded); })
      .catch((err: Error) => { if (active) setSourceError(err.message.length > 0 ? err.message : "The document could not be opened."); });
    return () => { active = false; };
  }, [chosenUrl, chosenKind]);

  useEffect(() => {
    if (step !== "find" || source === null || chosenUrl === null || autoSearched.current === chosenUrl || query.trim().length === 0) return;
    autoSearched.current = chosenUrl;
    void runSearch(source, query);
  });

  useEffect(() => () => { searchRun.current += 1; }, []);

  if (system === undefined) return null;

  function choose(document: SyDiagramDocument): void {
    setChosen(document);
    setRotation(0);
    if (!titleEdited) setTitle(`${systemName} diagram`);
    setResult(null);
    setBrowsing(false);
    setGroupStart(1);
    setPageInput("");
    setRegion(null);
    setPage(1);
    setStep(document.kind === "pdf" ? "find" : "crop");
  }

  function openPage(target: number, caption: string | null): void {
    setPage(target);
    setRegion(null);
    if (!titleEdited) setTitle(caption !== null ? caption.slice(0, 160) : `${systemName} diagram`);
    setStep("crop");
  }

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (source !== null) void runSearch(source, query);
  }

  function goToPage(event: FormEvent<HTMLFormElement>, pageCount: number): void {
    event.preventDefault();
    const target = pageNumber(pageInput, pageCount);
    if (target !== null) setGroupStart(groupStartFor(target, pageCount));
  }

  function save(): void {
    if (!editable || chosen === null || region === null || title.trim().length === 0) return;
    const diagram: SystemDiagram = {
      uuid: existing?.uuid ?? crypto.randomUUID(),
      title: title.trim(),
      documentId: chosen.documentId,
      filename: chosen.filename,
      page,
      region: roundRegion(region),
      ...(rotation === 0 ? {} : { rotation }),
    };
    mutateSy((draft) => withDiagram(draft, systemId, diagram));
    onClose();
  }

  function remove(): void {
    if (!editable || existing === undefined) return;
    const diagramUuid = existing.uuid;
    mutateSy((draft) => withoutDiagram(draft, systemId, diagramUuid));
    onClose();
  }

  function select(selected: SystemDiagramRegion): void {
    setRegion(selected);
    setStep("review");
  }

  function renderDocuments(): JSX.Element {
    if (documents === null) return <p className="sy-review-empty">Loading documents…</p>;
    if (documents.length === 0) return <p className="sy-review-empty">No PDF or image documents yet. Upload the source document in Step 01.</p>;
    return (
      <table className="sy-review-table" aria-label="Documents">
        <thead><tr><th scope="col">Document</th><th scope="col">Type</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.documentId}>
              <td><span className="sy-review-name">{document.filename}</span>{document.example && <span className="sy-review-sub">Example document</span>}</td>
              <td>{document.kind === "pdf" ? "PDF" : "Image"}</td>
              <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Choose ${document.filename}`} onClick={() => choose(document)}>Choose</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  function renderFind(loaded: SyDiagramSource): JSX.Element {
    const lastGroupStart = Math.max(1, loaded.pageCount - PAGES_PER_GROUP + 1);
    const groupPages = Array.from({ length: Math.min(PAGES_PER_GROUP, loaded.pageCount - groupStart + 1) }, (_, index) => groupStart + index);
    return (
      <>
        <form className="sy-diagram-search" onSubmit={submitSearch}>
          <label className="posfield__label" htmlFor={searchId}>Search this document</label>
          <div className="sy-diagram-search__row">
            <input id={searchId} className="posfield__input" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button type="submit" className="posnav__btn posnav__btn--primary" disabled={searching || query.trim().length === 0}>Search</button>
            <button type="button" className="posnav__btn" aria-expanded={browsing} onClick={() => setBrowsing((value) => !value)}>{browsing ? "Hide pages" : "Browse pages"}</button>
          </div>
        </form>
        {browsing && (
          <section className="sy-diagram-browse" aria-label="Pages">
            <div className="sy-diagram-crop__bar">
              <button type="button" className="posnav__btn posnav__btn--sm" disabled={groupStart <= 1} onClick={() => setGroupStart(Math.max(1, groupStart - PAGES_PER_GROUP))}>Previous pages</button>
              <span className="sy-diagram-status">Pages {groupStart} to {groupStart + groupPages.length - 1} of {loaded.pageCount}</span>
              <button type="button" className="posnav__btn posnav__btn--sm" disabled={groupStart >= lastGroupStart} onClick={() => setGroupStart(Math.min(lastGroupStart, groupStart + PAGES_PER_GROUP))}>Next pages</button>
              <form className="sy-diagram-goto" onSubmit={(event) => goToPage(event, loaded.pageCount)}>
                <label className="sy-diagram-goto__label" htmlFor={pageInputId}>Go to page</label>
                <input
                  id={pageInputId}
                  className="posfield__input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={loaded.pageCount}
                  step={1}
                  value={pageInput}
                  onChange={(event) => setPageInput(event.target.value)}
                />
                <button type="submit" className="posnav__btn posnav__btn--sm" disabled={pageNumber(pageInput, loaded.pageCount) === null}>Go</button>
              </form>
            </div>
            <div className="sy-diagram-thumbs">
              {groupPages.map((target) => <PageThumbnail key={target} source={loaded} page={target} onOpen={() => openPage(target, null)} />)}
            </div>
          </section>
        )}
        {searching && <p className="sy-diagram-status" role="status">{progress === null ? "Searching…" : `Searching page ${progress.page} of ${progress.total}`}</p>}
        {result !== null && (result.hits.length === 0
          ? <p className="sy-review-empty">{result.pagesWithText === 0 ? "This PDF has no searchable text. Browse the pages instead." : `No page matches "${query}".`}</p>
          : (
            <table className="sy-review-table" aria-label="Matching pages">
              <thead><tr><th scope="col">Page</th><th scope="col">Match</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {result.hits.map((hit) => (
                  <tr key={hit.page}>
                    <td className="posmono sy-review-num">{hit.page}</td>
                    <td><div className="sy-review-lines">{hit.lines.map((line, index) => <span key={`${index}:${line}`}>{line}</span>)}</div></td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Open page ${hit.page}`} onClick={() => openPage(hit.page, hit.caption)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </>
    );
  }

  function renderCrop(loaded: SyDiagramSource): JSX.Element {
    return (
      <>
        <div className="sy-diagram-crop__bar">
          {chosen?.kind === "pdf" && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setStep("find")}>Back to search</button>}
          {loaded.pageCount > 1 && (
            <>
              <button type="button" className="posnav__btn posnav__btn--sm" disabled={page <= 1} onClick={() => { setPage(page - 1); setRegion(null); }}>Previous page</button>
              <span className="sy-diagram-status">Page {page} of {loaded.pageCount}</span>
              <button type="button" className="posnav__btn posnav__btn--sm" disabled={page >= loaded.pageCount} onClick={() => { setPage(page + 1); setRegion(null); }}>Next page</button>
            </>
          )}
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => select(FULL_PAGE)}>Use whole page</button>
        </div>
        <p className="sy-diagram-status">Drag across the page to select the diagram.</p>
        <CropStage source={loaded} page={page} region={region} onRegion={select} />
      </>
    );
  }

  function renderReview(loaded: SyDiagramSource): JSX.Element {
    return (
      <>
        {region === null
          ? <p className="sy-review-empty">No part of the page is selected.</p>
          : <SelectionPreview source={loaded} page={page} region={region} label={title.trim().length > 0 ? title : "Selected diagram"} rotation={rotation} />}
        {editable && (
          <div className="sy-diagram-crop__bar">
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setStep("crop")}>Re-crop</button>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setRotation(nextRotation(rotation))}>Rotate</button>
            {chosen?.kind === "pdf" && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setStep("find")}>Choose another page</button>}
          </div>
        )}
        <label className="posfield">
          <span className="posfield__label">Title</span>
          <input className="posfield__input" value={title} readOnly={!editable} onChange={(event) => { setTitle(event.target.value); setTitleEdited(true); }} />
        </label>
      </>
    );
  }

  function renderStep(): JSX.Element {
    if (step === "document") return renderDocuments();
    if (chosen === null) return <p className="sy-review-error">The source document of this diagram is not in this workbook.</p>;
    if (sourceError !== null) return <p className="sy-review-error">{sourceError}</p>;
    if (source === null) return <p className="sy-review-empty">Opening {chosen.filename}…</p>;
    if (step === "find") return renderFind(source);
    return step === "crop" ? renderCrop(source) : renderReview(source);
  }

  return (
    <>
      <DialogHead cap="Diagram · SY-A8" title={existing === undefined ? `Add a diagram for ${systemName}` : existing.title} onClose={onClose} />
      <div className="modal__body sy-diagram-dialog">
        {step !== "document" && chosen !== null && (
          <div className="sy-diagram-source">
            <span><strong>{chosen.filename}</strong>{(step === "crop" || step === "review") && ` · page ${page}`}</span>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { searchRun.current += 1; setSearching(false); setStep("document"); }}>Choose another document</button>}
          </div>
        )}
        {documentsError !== null && step === "document" && <p className="sy-review-error">{documentsError}</p>}
        {renderStep()}
        <div className="posrow sy-dialog-actions">
          {existing !== undefined && editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove diagram</button>}
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onClose}>Cancel</button>
          {editable && (
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={step !== "review" || chosen === null || region === null || title.trim().length === 0} onClick={save}>Save diagram</button>
          )}
        </div>
      </div>
    </>
  );
}

export { SyDiagramDialog };
