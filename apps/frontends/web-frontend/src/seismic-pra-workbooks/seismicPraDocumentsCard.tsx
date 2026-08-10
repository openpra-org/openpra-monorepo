import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { type ChangeEvent, type JSX, useEffect, useState } from "react";
import { POSIcon } from "../pos-workbooks/posIcons";
import { useSeismicPraWorkbook } from "./seismicPraWorkbookContext";
import { getSeismicPraDocumentDownload, listSeismicPraDocuments, updateSeismicPraDocument, uploadSeismicPraDocument, type SeismicPraDocumentEntry } from "./seismicPraWorkbookApi";

function DocumentName({ name, editable, onSave }: { name: string; editable: boolean; onSave: (name: string) => void }): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(name);

  function save(): void {
    const next = text.trim();
    setEditing(false);
    if (next.length === 0) {
      setText(name);
      return;
    }
    if (next !== name) onSave(next);
  }

  if (!editable) return <div className="posdoc__name">{name}</div>;
  if (editing) {
    return <input className="posdoc__name-input" value={text} aria-label="Document name" autoFocus onChange={(event) => setText(event.target.value)} onBlur={save} onKeyDown={(event) => {
      if (event.key === "Enter") event.currentTarget.blur();
      if (event.key === "Escape") {
        setText(name);
        setEditing(false);
      }
    }} />;
  }
  return <div className="posdoc__name-row">
    <span className="posdoc__name">{name}</span>
    <button type="button" className="posdoc__name-edit" aria-label="Edit document name" onClick={() => { setText(name); setEditing(true); }}><POSIcon.Pencil /></button>
  </div>;
}

function SeismicPraDocumentsCard({ workbookId, canEdit }: { workbookId?: string; canEdit: boolean }): JSX.Element {
  const { mef, editable, mutate } = useSeismicPraWorkbook();
  const examples = mef.exampleDocuments ?? [];
  const [documents, setDocuments] = useState<SeismicPraDocumentEntry[] | null>(workbookId === undefined ? [] : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canChange = canEdit && editable;

  useEffect(() => {
    if (workbookId === undefined) return;
    let cancelled = false;
    listSeismicPraDocuments(workbookId)
      .then((items) => { if (!cancelled) setDocuments(items); })
      .catch((err) => { if (!cancelled) setError((err as { message?: string }).message ?? "Could not load documents"); });
    return () => { cancelled = true; };
  }, [workbookId]);

  async function refresh(): Promise<void> {
    if (workbookId !== undefined) setDocuments(await listSeismicPraDocuments(workbookId));
  }

  function upload(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined || workbookId === undefined) return;
    setBusy(true);
    setError(null);
    uploadSeismicPraDocument(workbookId, file)
      .then(refresh)
      .catch((err) => setError((err as { message?: string }).message ?? "Upload failed"))
      .finally(() => setBusy(false));
  }

  function renameUpload(documentId: string, name: string): void {
    if (workbookId === undefined) return;
    setError(null);
    updateSeismicPraDocument(workbookId, documentId, name)
      .then(refresh)
      .catch((err) => setError((err as { message?: string }).message ?? "Could not rename document"));
  }

  function renameExample(documentId: string, name: string): void {
    mutate((current) => ({
      ...current,
      exampleDocuments: (current.exampleDocuments ?? []).map((document) => document.id === documentId ? { ...document, name } : document),
    }));
  }

  function viewUpload(documentId: string): void {
    if (workbookId === undefined) return;
    setError(null);
    getSeismicPraDocumentDownload(workbookId, documentId)
      .then(({ url }) => window.open(url, "_blank", "noopener"))
      .catch((err) => setError((err as { message?: string }).message ?? "Could not open document"));
  }

  const uploads = documents ?? [];
  const showUploads = uploads.length > 0;
  const showExamples = !showUploads && examples.length > 0;

  return <div className="poscard">
    <div className="poscard__head">
      <WorkbookSectionHeading workbook="SEISMIC" title="Supporting Documents" />
      {canChange && workbookId !== undefined && <label className="posnav__btn posnav__btn--sm posnav__btn--primary" style={{ cursor: busy ? "wait" : "pointer" }}>
        <POSIcon.Plus /> {busy ? "Uploading…" : "Upload"}
        <input type="file" hidden disabled={busy} onChange={upload} />
      </label>}
    </div>
    <p className="poscard__sub">Documents that support the Seismic PRA scope, inputs, calculations, models, and conclusions.</p>
    {error !== null && <p className="possubtle sdocuments__error">{error}</p>}
    {documents === null ? <p className="possubtle">Loading documents…</p> : showUploads ? <div className="sdocuments__list">
      {uploads.map((document) => <div key={document.documentId} className="sdocuments__row">
        <div className="sdocuments__main">
          <DocumentName name={document.filename} editable={canChange} onSave={(name) => renameUpload(document.documentId, name)} />
        </div>
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => viewUpload(document.documentId)}><POSIcon.Eye /> View source</button>
      </div>)}
    </div> : showExamples ? <div className="sdocuments__list">
      {examples.map((document) => <div key={document.id} className="sdocuments__row">
        <div className="sdocuments__main">
          <DocumentName name={document.name} editable={canChange} onSave={(name) => renameExample(document.id, name)} />
        </div>
        {document.url !== undefined
          ? <a className="posnav__btn posnav__btn--sm" href={document.url} target="_blank" rel="noopener noreferrer"><POSIcon.Eye /> View source</a>
          : <button type="button" className="posnav__btn posnav__btn--sm" disabled title="No source file is attached to this packaged example"><POSIcon.Eye /> View source</button>}
      </div>)}
    </div> : <p className="possubtle">No documents uploaded yet.</p>}
  </div>;
}

export { SeismicPraDocumentsCard };
