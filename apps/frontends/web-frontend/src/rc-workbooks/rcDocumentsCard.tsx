import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { JSX, useEffect, useState, type ChangeEvent } from "react";
import { RCIcon } from "./rcIcons";
import { listRcDocuments, uploadRcDocument, deleteRcDocument, getRcDocumentDownload, type RcDocumentEntry } from "./rcWorkbookApi";
import { useRcWorkbook } from "./rcWorkbookContext";

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function RcDocumentsCard({ workbookId, canEdit }: { workbookId?: string; canEdit: boolean }): JSX.Element {
  const { rc } = useRcWorkbook();
  const exampleDocs = rc.exampleDocuments ?? [];
  const [docs, setDocs] = useState<RcDocumentEntry[] | null>(workbookId === undefined ? [] : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (workbookId === undefined) return;
    let cancelled = false;
    listRcDocuments(workbookId)
      .then((d) => { if (!cancelled) setDocs(d); })
      .catch((err: unknown) => { if (!cancelled) setError((err as { message?: string }).message ?? "Could not load documents"); });
    return () => { cancelled = true; };
  }, [workbookId]);

  async function refresh(): Promise<void> {
    if (workbookId === undefined) return;
    setDocs(await listRcDocuments(workbookId));
  }

  function onUpload(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file === undefined || workbookId === undefined) return;
    setBusy(true);
    setError(null);
    uploadRcDocument(workbookId, file)
      .then(refresh)
      .catch((err: unknown) => setError((err as { message?: string }).message ?? "Upload failed"))
      .finally(() => setBusy(false));
  }

  function onDelete(documentId: string): void {
    if (workbookId === undefined) return;
    deleteRcDocument(workbookId, documentId)
      .then(refresh)
      .catch((err: unknown) => setError((err as { message?: string }).message ?? "Could not delete"));
  }

  function onDownload(documentId: string): void {
    if (workbookId === undefined) return;
    getRcDocumentDownload(workbookId, documentId)
      .then(({ url }) => { window.open(url, "_blank", "noopener"); })
      .catch((err: unknown) => setError((err as { message?: string }).message ?? "Could not download"));
  }

  const uploads = docs ?? [];
  return (
    <div className="poscard">
      <div className="poscard__head">
        <h3 className="poscard__title">Supporting documents</h3>
        {canEdit && workbookId !== undefined && (
          <label className="posnav__btn posnav__btn--sm posnav__btn--primary" style={{ cursor: busy ? "wait" : "pointer" }}>
            <RCIcon.Plus /> {busy ? "Uploading…" : "Upload"}
            <WorkbookInput type="file" hidden onChange={onUpload} disabled={busy} />
          </label>
        )}
      </div>
      <p className="poscard__sub">The source-term table, the emergency plan, the evacuation study, the weather record, the dispersion and dose bases and the regional cost data that support this analysis.</p>
      {error !== null && <p className="possubtle" style={{ color: "#b73b3b" }}>{error}</p>}
      {exampleDocs.length > 0 && (
        <table className="postable">
          <thead><tr><th>Reference</th><th>Source</th><th>What it supports</th><th>Links</th></tr></thead>
          <tbody>
            {exampleDocs.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.url !== undefined ? (
                    <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)" }}>{d.name}</a>
                  ) : (
                    <span className="postable__name">{d.name}</span>
                  )}
                  <div className="possubtle posmono" style={{ fontSize: 11 }}>{d.uploadedLabel}</div>
                </td>
                <td className="possubtle" style={{ fontSize: 12 }}>{d.sizeLabel}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{d.extracted}</td>
                <td className="posmono">{d.linked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {workbookId !== undefined && (docs === null ? (
        <p className="possubtle">Loading documents…</p>
      ) : uploads.length === 0 ? (
        <p className="possubtle">No documents uploaded yet.</p>
      ) : (
        <table className="postable">
          <thead><tr><th>File</th><th>Size</th><th>Uploaded by</th><th></th></tr></thead>
          <tbody>
            {uploads.map((d) => (
              <tr key={d.documentId}>
                <td>
                  <button type="button" onClick={() => onDownload(d.documentId)} style={{ background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer", padding: 0, textAlign: "left", font: "inherit" }}>{d.filename}</button>
                </td>
                <td className="posmono">{fmtSize(d.size)}</td>
                <td>{d.uploadedBy}</td>
                <td style={{ textAlign: "right" }}>
                  {canEdit && (
                    <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => onDelete(d.documentId)}><RCIcon.Close /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}

export { RcDocumentsCard };
