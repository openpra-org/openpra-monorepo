import type { IeLinkedWorkbooks } from "interfaces-mef-types/ie/initiating-event-analysis";
import type { IeWorkbook } from "./ie-workbook.schema";

interface IeLinkedMef {
  linkedWorkbooks?: IeLinkedWorkbooks;
  applicablePlantOperatingStates?: string[];
}

function iePosLink(doc: Pick<IeWorkbook, "mef" | "linkedPosWorkbookId">): string | null {
  const linked = (doc.mef as IeLinkedMef).linkedWorkbooks?.POS;
  if (typeof linked === "string" && linked.length > 0) return linked;
  const legacy = doc.linkedPosWorkbookId;
  return typeof legacy === "string" && legacy.length > 0 ? legacy : null;
}

function withIePosLink(links: IeLinkedWorkbooks | undefined, workbookId: string | null): IeLinkedWorkbooks {
  const next: IeLinkedWorkbooks = { ...links };
  delete next.POS;
  if (workbookId !== null) next.POS = workbookId;
  return next;
}

export { iePosLink, withIePosLink, type IeLinkedMef };
