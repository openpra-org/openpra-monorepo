import { JSX, useEffect, useState, type ChangeEvent } from "react";
import { DAIcon } from "./daIcons";
import { listDaDocuments, uploadDaDocument, deleteDaDocument, getDaDocumentDownload, type DaDocumentEntry } from "./daWorkbookApi";

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function DaDocumentsCard({ workbookId, canEdit }: { workbookId: string; canEdit: boolean }): JSX.Element {
  const [docs, setDocs] = useState<DaDocumentEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listDaDocuments(workbookId)
      .then((d) => { if (!cancelled) setDocs(d); })
      .catch((err: unknown) => { if (!cancelled) setError((err as { message?: string }).message ?? "Could not load documents"); });
    return () => { cancelled = true; };
  }, [workbookId]);

  async function refresh(): Promise<void> {
    setDocs(await listDaDocuments(workbookId));
  }

  function onUpload(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file === undefined) return;
    setBusy(true);
    setError(null);
    uploadDaDocument(workbookId, file)
      .then(refresh)
      .catch((err: unknown) => setError((err as { message?: string }).message ?? "Upload failed"))
      .finally(() => setBusy(false));
  }

  function onDelete(documentId: string): void {
    deleteDaDocument(workbookId, documentId)
      .then(refresh)
      .catch((err: unknown) => setError((err as { message?: string }).message ?? "Could not delete"));
  }

  function onDownload(documentId: string): void {
    getDaDocumentDownload(workbookId, documentId)
      .then(({ url }) => { window.open(url, "_blank", "noopener"); })
      .catch((err: unknown) => setError((err as { message?: string }).message ?? "Could not download"));
  }

  return (
    <div className="poscard">
      <div className="poscard__head">
        <h3 className="poscard__title">Supporting documents</h3>
        {canEdit && (
          <label className="posnav__btn posnav__btn--sm posnav__btn--primary" style={{ cursor: busy ? "wait" : "pointer" }}>
            <DAIcon.Plus /> {busy ? "Uploading…" : "Upload"}
            <input type="file" hidden onChange={onUpload} disabled={busy} />
          </label>
        )}
      </div>
      <p className="poscard__sub">The Systems Analysis basic-event list, the generic and common-cause databases, the sodium-facility operating experience and the planned schedule that support this analysis.</p>
      {error !== null && <p className="possubtle" style={{ color: "#b73b3b" }}>{error}</p>}
      {docs === null ? (
        <p className="possubtle">Loading documents…</p>
      ) : docs.length === 0 ? (
        <p className="possubtle">No documents uploaded yet.</p>
      ) : (
        <table className="postable">
          <thead><tr><th>File</th><th>Size</th><th>Uploaded by</th><th></th></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.documentId}>
                <td>
                  <button type="button" onClick={() => onDownload(d.documentId)} style={{ background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer", padding: 0, textAlign: "left", font: "inherit" }}>{d.filename}</button>
                </td>
                <td className="posmono">{fmtSize(d.size)}</td>
                <td>{d.uploadedBy}</td>
                <td style={{ textAlign: "right" }}>
                  {canEdit && (
                    <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => onDelete(d.documentId)}><DAIcon.Close /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export { DaDocumentsCard };
