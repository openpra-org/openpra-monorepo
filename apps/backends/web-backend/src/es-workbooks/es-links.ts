import type { EsLinkedWorkbooks } from "interfaces-mef-types/es/event-sequence-analysis";
import type { EsWorkbook } from "./es-workbook.schema";

type EsDocumentLink = "POS" | "IE";

interface EsLinkedMef {
  linkedWorkbooks?: EsLinkedWorkbooks;
}

function esDocumentLink(doc: Pick<EsWorkbook, "mef" | "linkedPosWorkbookId" | "linkedIeWorkbookId">, code: EsDocumentLink): string | null {
  const linked = (doc.mef as EsLinkedMef).linkedWorkbooks?.[code];
  if (typeof linked === "string" && linked.length > 0) return linked;
  const legacy = code === "POS" ? doc.linkedPosWorkbookId : doc.linkedIeWorkbookId;
  return typeof legacy === "string" && legacy.length > 0 ? legacy : null;
}

function withEsLink(links: EsLinkedWorkbooks | undefined, code: keyof EsLinkedWorkbooks, workbookId: string | null): EsLinkedWorkbooks {
  const next: EsLinkedWorkbooks = { ...links };
  delete next[code];
  if (workbookId !== null) next[code] = workbookId;
  return next;
}

export { esDocumentLink, withEsLink, type EsLinkedMef };
