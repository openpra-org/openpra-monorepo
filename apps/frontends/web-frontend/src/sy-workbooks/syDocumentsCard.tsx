import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { JSX, useEffect, useState, type ChangeEvent } from "react";
import { SYIcon } from "./syIcons";
import { listSyDocuments, uploadSyDocument, deleteSyDocument, getSyDocumentDownload, type SyDocumentEntry } from "./syWorkbookApi";
import { useSyWorkbook } from "./syWorkbookContext";

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function SyDocumentsCard({ workbookId, canEdit }: { workbookId: string; canEdit: boolean }): JSX.Element {
  const { sy } = useSyWorkbook();
  const exampleDocs = sy.exampleDocuments ?? [];
  const [docs, setDocs] = useState<SyDocumentEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listSyDocuments(workbookId)
      .then((d) => { if (!cancelled) setDocs(d); })
      .catch((err: unknown) => { if (!cancelled) setError((err as { message?: string }).message ?? "Could not load documents"); });
    return () => { cancelled = true; };
  }, [workbookId]);

  async function refresh(): Promise<void> {
    setDocs(await listSyDocuments(workbookId));
  }

  function onUpload(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file === undefined) return;
    setBusy(true);
    setError(null);
    uploadSyDocument(workbookId, file)
      .then(refresh)
      .catch((err: unknown) => setError((err as { message?: string }).message ?? "Upload failed"))
      .finally(() => setBusy(false));
  }

  function onDelete(documentId: string): void {
    deleteSyDocument(workbookId, documentId)
      .then(refresh)
      .catch((err: unknown) => setError((err as { message?: string }).message ?? "Could not delete"));
  }

  function onDownload(documentId: string): void {
    getSyDocumentDownload(workbookId, documentId)
      .then(({ url }) => { window.open(url, "_blank", "noopener"); })
      .catch((err: unknown) => setError((err as { message?: string }).message ?? "Could not download"));
  }

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="SY" title="Supporting documents" level={3} />
        {canEdit && (
          <label className="posnav__btn posnav__btn--sm posnav__btn--primary" style={{ cursor: busy ? "wait" : "pointer" }}>
            <SYIcon.Plus /> {busy ? "Uploading…" : "Upload"}
            <WorkbookInput type="file" hidden onChange={onUpload} disabled={busy} />
          </label>
        )}
      </div>
      <p className="poscard__sub">System design descriptions, failure mode analyses, common cause parameter dossiers and method references that support these system models.</p>
      {error !== null && <p className="possubtle" style={{ color: "#b73b3b" }}>{error}</p>}
      {docs === null ? (
        <p className="possubtle">Loading documents…</p>
      ) : docs.length === 0 && exampleDocs.length > 0 ? (
        <table className="postable">
          <thead><tr><th>Document</th><th>Source</th><th>What it provides</th></tr></thead>
          <tbody>
            {exampleDocs.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.url !== undefined
                    ? <button type="button" onClick={() => { if (d.url !== undefined) window.open(d.url, "_blank", "noopener"); }} style={{ background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer", padding: 0, textAlign: "left", font: "inherit" }}>{d.name}</button>
                    : <span>{d.name}</span>}
                  <span className="postable__name-sub">{d.uploadedLabel}</span>
                </td>
                <td className="possubtle">{d.sizeLabel}</td>
                <td className="possubtle" style={{ fontSize: 12.5 }}>{d.extracted}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
                    <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => onDelete(d.documentId)}><SYIcon.Close /></button>
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

export { SyDocumentsCard };
