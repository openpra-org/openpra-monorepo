interface WorkbookLinkedRevision {
  code: string;
  workbookId: string;
  name: string;
  revision?: number;
  fingerprint: string;
}

interface WorkbookSignedAgainst {
  recordedAt: string;
  event: "SUBMITTED" | "SIGNED";
  links: WorkbookLinkedRevision[];
}

interface WorkbookLinkedRevisionStatus {
  signedAgainst: WorkbookSignedAgainst | null;
  current: WorkbookLinkedRevision[];
  outOfDate: boolean;
}

function linkedRevisionChanged(signed: WorkbookLinkedRevision, current: readonly WorkbookLinkedRevision[]): boolean {
  const now = current.find((entry) => entry.code === signed.code);
  return now === undefined || now.workbookId !== signed.workbookId || now.fingerprint !== signed.fingerprint;
}

function linkedRevisionsOutOfDate(signedAgainst: WorkbookSignedAgainst | null, current: readonly WorkbookLinkedRevision[]): boolean {
  if (signedAgainst === null) return false;
  if (current.some((entry) => !signedAgainst.links.some((signed) => signed.code === entry.code))) return true;
  return signedAgainst.links.some((signed) => linkedRevisionChanged(signed, current));
}

export { linkedRevisionChanged, linkedRevisionsOutOfDate, type WorkbookLinkedRevision, type WorkbookLinkedRevisionStatus, type WorkbookSignedAgainst };
