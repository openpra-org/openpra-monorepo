import { createContext, type JSX, type ReactNode, useContext, useMemo } from "react";
import { ShareIcon } from "../welcome/icons";
import { WorkbookShareModal, type WorkbookShareActions } from "./workbookShareModal";
import { addWorkbookShare, getWorkbookShares, removeWorkbookShare, updateWorkbookShare } from "./workbookSharingApi";
import type { WorkbookSharing } from "./useWorkbookSharing";

interface WorkbookSharingContextValue {
  sharedOnly: boolean;
  authoring: boolean;
  openShare?: () => void;
}

const WorkbookSharingContext = createContext<WorkbookSharingContextValue>({ sharedOnly: false, authoring: true });

function WorkbookSharingProvider({ workbookId, workbookName, sharing, children }: {
  workbookId: string;
  workbookName: string;
  sharing: WorkbookSharing;
  children: ReactNode;
}): JSX.Element {
  const value = useMemo((): WorkbookSharingContextValue => ({
    sharedOnly: sharing.sharedOnly,
    authoring: sharing.authoring,
    openShare: sharing.canShare ? sharing.openShare : undefined,
  }), [sharing.sharedOnly, sharing.authoring, sharing.canShare, sharing.openShare]);
  const actions = useMemo((): WorkbookShareActions => ({
    load: () => getWorkbookShares(workbookId),
    add: (identifier, access) => addWorkbookShare(workbookId, identifier, access),
    update: (username, access) => updateWorkbookShare(workbookId, username, access),
    remove: (username) => removeWorkbookShare(workbookId, username),
  }), [workbookId]);
  return (
    <WorkbookSharingContext.Provider value={value}>
      {children}
      {sharing.shareOpen && <WorkbookShareModal title={`Share "${workbookName}"`} actions={actions} onClose={sharing.closeShare} />}
    </WorkbookSharingContext.Provider>
  );
}

function useWorkbookSharingContext(): WorkbookSharingContextValue {
  return useContext(WorkbookSharingContext);
}

function WorkbookShareButton(): JSX.Element | null {
  const { openShare } = useWorkbookSharingContext();
  if (openShare === undefined) return null;
  return (
    <button type="button" className="posnav__btn posnav__btn--sm" onClick={openShare} title="Share this workbook">
      <ShareIcon /> Share
    </button>
  );
}

export { WorkbookShareButton, WorkbookSharingProvider, useWorkbookSharingContext };
