import { type ChangeEvent, type JSX, useEffect, useState } from "react";
import { useSeismicPraWorkbook } from "./seismicPraWorkbookContext";
import { deleteSeismicPraDocument, getSeismicPraDocumentDownload, listSeismicPraDocuments, uploadSeismicPraDocument, type SeismicPraDocumentEntry } from "./seismicPraWorkbookApi";

function sizeLabel(bytes: number): string { return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : bytes >= 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${bytes} B`; }

function SeismicPraDocumentsCard({ workbookId, canEdit }: { workbookId?: string; canEdit: boolean }): JSX.Element {
  const { mef } = useSeismicPraWorkbook();
  const [documents, setDocuments] = useState<SeismicPraDocumentEntry[] | null>(workbookId === undefined ? [] : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (workbookId === undefined) return;
    let cancelled = false;
    listSeismicPraDocuments(workbookId).then((items) => { if (!cancelled) setDocuments(items); }).catch((err: unknown) => { if (!cancelled) setError((err as { message?: string }).message ?? "Could not load documents"); });
    return () => { cancelled = true; };
  }, [workbookId]);
  async function refresh(): Promise<void> { if (workbookId !== undefined) setDocuments(await listSeismicPraDocuments(workbookId)); }
  function upload(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]; event.target.value = "";
    if (file === undefined || workbookId === undefined) return;
    setBusy(true); setError(null);
    uploadSeismicPraDocument(workbookId, file).then(refresh).catch((err: unknown) => setError((err as { message?: string }).message ?? "Upload failed")).finally(() => setBusy(false));
  }
  return <section className="ssection"><div className="ssection__head"><div><div className="ssection__eyebrow">Controlled evidence</div><h2 className="ssection__title">Supporting documents</h2><p className="ssection__description">Hazard reports and calculation files, structural response models, the SEL, fragility calculations, walkdown evidence, model files, and integrated quantification records.</p></div>{canEdit && workbookId !== undefined && <label className="sbtn sbtn--primary" style={{ cursor: busy ? "wait" : "pointer" }}>{busy ? "Uploading…" : "+ Upload file"}<input type="file" hidden disabled={busy} onChange={upload} /></label>}</div><div className="ssection__body">
    {error !== null && <div className="sadvanced__error">{error}</div>}
    {(mef.exampleDocuments ?? []).length > 0 && <div className="stablewrap"><table className="stable"><thead><tr><th>Packaged reference</th><th>Size</th><th>Extracted evidence</th><th>Links</th></tr></thead><tbody>{(mef.exampleDocuments ?? []).map((document) => <tr key={document.id}><td><strong>{document.name}</strong><code>{document.uploadedLabel}</code></td><td>{document.sizeLabel}</td><td>{document.extracted}</td><td className="smono">{document.linked}</td></tr>)}</tbody></table></div>}
    {workbookId !== undefined && (documents === null ? <p className="possubtle">Loading uploaded documents…</p> : documents.length === 0 ? <p className="possubtle">No user-uploaded documents yet.</p> : <div className="stablewrap"><table className="stable"><thead><tr><th>Uploaded file</th><th>Size</th><th>Uploaded by</th><th>Uploaded</th><th /></tr></thead><tbody>{documents.map((document) => <tr key={document.documentId}><td><button type="button" className="sdoclink" onClick={() => { void getSeismicPraDocumentDownload(workbookId, document.documentId).then(({ url }) => window.open(url, "_blank", "noopener")); }}>{document.filename}</button></td><td>{sizeLabel(document.size)}</td><td>{document.uploadedBy}</td><td>{new Date(document.uploadedAt).toLocaleDateString()}</td><td>{canEdit && <button type="button" className="siconbtn" onClick={() => { void deleteSeismicPraDocument(workbookId, document.documentId).then(refresh); }}>×</button>}</td></tr>)}</tbody></table></div>)}
  </div></section>;
}

export { SeismicPraDocumentsCard };
